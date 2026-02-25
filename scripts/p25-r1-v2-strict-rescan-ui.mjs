#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const BASE_URL = (process.env.P25_BASE_URL ?? 'http://127.0.0.1:4173').replace(/\/$/, '');
const OUT_DIR = path.resolve(process.env.P25_OUT_DIR ?? 'reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan');
const AUTH_ROUTES = ['/auth/login', '/auth/register', '/auth/forgot-password'];
const SCAN_ROUTES = [...AUTH_ROUTES, '/market'];

const PROFILES = [
  {
    name: 'desktop',
    contextOptions: { viewport: { width: 1440, height: 900 } }
  },
  {
    name: 'mobile',
    contextOptions: {
      ...devices['iPhone 13']
    }
  }
];

const EMAIL_TEXT_REGEX = /邮箱|email/i;

async function scanPage(page, route) {
  const result = {
    route,
    url: `${BASE_URL}${route}`,
    status: null,
    finalUrl: null,
    title: null,
    navCount: 0,
    inputSummary: null,
    emailTextHit: false,
    authUiStrictPass: null,
    notes: []
  };

  const response = await page.goto(result.url, { waitUntil: 'networkidle', timeout: 20000 });
  result.status = response?.status() ?? null;
  result.finalUrl = page.url();
  result.title = await page.title();

  const analyzed = await page.evaluate(({ emailRegexSource, emailRegexFlags }) => {
    const EMAIL_RE = new RegExp(emailRegexSource, emailRegexFlags);

    const navNodes = [
      ...Array.from(document.querySelectorAll('nav')),
      ...Array.from(document.querySelectorAll('[role="navigation"]'))
    ];

    const dedupNav = new Set(navNodes);

    const inputs = Array.from(document.querySelectorAll('input')).map((el) => ({
      type: (el.getAttribute('type') || 'text').toLowerCase(),
      name: (el.getAttribute('name') || '').toLowerCase(),
      id: (el.getAttribute('id') || '').toLowerCase(),
      placeholder: (el.getAttribute('placeholder') || '').toLowerCase(),
      autocomplete: (el.getAttribute('autocomplete') || '').toLowerCase()
    }));

    const emailInputs = inputs.filter((it) =>
      it.type === 'email' ||
      it.name.includes('email') ||
      it.id.includes('email') ||
      it.placeholder.includes('email') ||
      it.placeholder.includes('邮箱') ||
      it.autocomplete === 'email'
    );

    const passwordInputs = inputs.filter((it) => it.type === 'password');

    const nonMetaInputs = inputs.filter((it) => !['hidden', 'submit', 'button', 'reset', 'checkbox', 'radio'].includes(it.type));
    const nonEmailInputs = nonMetaInputs.filter((it) => !emailInputs.includes(it));

    const bodyText = document.body?.innerText || '';
    const hasEmailText = EMAIL_RE.test(bodyText);

    return {
      navCount: dedupNav.size,
      inputSummary: {
        allInputs: inputs.length,
        emailInputs: emailInputs.length,
        passwordInputs: passwordInputs.length,
        nonEmailInputs: nonEmailInputs.length
      },
      hasEmailText
    };
  }, { emailRegexSource: EMAIL_TEXT_REGEX.source, emailRegexFlags: EMAIL_TEXT_REGEX.flags });

  result.navCount = analyzed.navCount;
  result.inputSummary = analyzed.inputSummary;
  result.emailTextHit = analyzed.hasEmailText;

  if (AUTH_ROUTES.includes(route)) {
    const pass =
      analyzed.navCount === 0 &&
      analyzed.inputSummary.emailInputs >= 1 &&
      analyzed.inputSummary.passwordInputs === 0 &&
      analyzed.inputSummary.nonEmailInputs === 0 &&
      analyzed.hasEmailText;

    result.authUiStrictPass = pass;

    if (!pass) {
      if (analyzed.navCount !== 0) result.notes.push('认证页存在导航结构');
      if (analyzed.inputSummary.emailInputs < 1) result.notes.push('认证页未发现邮箱输入入口');
      if (analyzed.inputSummary.passwordInputs > 0) result.notes.push('认证页出现密码输入，违反“仅邮箱入口”');
      if (analyzed.inputSummary.nonEmailInputs > 0) result.notes.push('认证页存在非邮箱输入项');
      if (!analyzed.hasEmailText) result.notes.push('认证页未发现邮箱文案');
    }
  }

  return result;
}

async function verifyPostLoginFlow(page) {
  const outcome = {
    attempted: true,
    loginRoute: `${BASE_URL}/auth/login`,
    hasEmailInput: false,
    hasSubmitAction: false,
    clicked: false,
    redirectToMarket: false,
    finalUrl: null,
    tokenSyncDetected: false,
    noFlicker: false,
    details: []
  };

  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });

  const probe = await page.evaluate(() => {
    const email = document.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]');
    const submit = document.querySelector('button[type="submit"], [role="button"], input[type="submit"]');
    return {
      hasEmail: Boolean(email),
      hasSubmit: Boolean(submit),
      submitText: (submit?.textContent || '').trim().slice(0, 64)
    };
  });

  outcome.hasEmailInput = probe.hasEmail;
  outcome.hasSubmitAction = probe.hasSubmit;

  if (!probe.hasEmail || !probe.hasSubmit) {
    outcome.details.push('登录页缺少可操作邮箱输入或提交动作，无法完成登录后跳转/同步验证');
    outcome.finalUrl = page.url();
    return outcome;
  }

  await page.fill('input[type="email"], input[name*="email" i], input[id*="email" i]', 'p25-r1@example.com');
  outcome.clicked = true;

  const navTrace = [];
  const start = Date.now();

  for (let i = 0; i < 8; i += 1) {
    navTrace.push(page.url());
    await page.waitForTimeout(250);
  }

  try {
    await page.click('button[type="submit"], input[type="submit"], [role="button"]', { timeout: 2000 });
  } catch {
    outcome.details.push('提交动作点击失败');
  }

  for (let i = 0; i < 16; i += 1) {
    navTrace.push(page.url());
    await page.waitForTimeout(250);
  }

  outcome.finalUrl = page.url();
  outcome.redirectToMarket = outcome.finalUrl.includes('/market');

  const storageProbe = await page.evaluate(() => {
    const localKeys = Object.keys(localStorage);
    const sessionKeys = Object.keys(sessionStorage);
    const keyHit = [...localKeys, ...sessionKeys].some((k) => /token|auth|session|user/i.test(k));
    return {
      keyHit,
      localKeys: localKeys.slice(0, 20),
      sessionKeys: sessionKeys.slice(0, 20)
    };
  });

  outcome.tokenSyncDetected = storageProbe.keyHit;

  const bounced = navTrace.some((u, idx) => idx > 0 && navTrace[idx - 1].includes('/market') && u.includes('/auth/'));
  outcome.noFlicker = outcome.redirectToMarket && !bounced;

  if (!outcome.redirectToMarket) outcome.details.push('点击后未跳转到 /market');
  if (!outcome.tokenSyncDetected) outcome.details.push('未检测到本地会话/Token同步迹象');
  if (!outcome.noFlicker) outcome.details.push('未满足无闪烁判定（含回跳或未完成跳转）');
  outcome.details.push(`flowDurationMs=${Date.now() - start}`);

  return outcome;
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const profileResults = [];

  try {
    for (const profile of PROFILES) {
      const context = await browser.newContext(profile.contextOptions);
      const page = await context.newPage();

      const routeResults = [];
      for (const route of SCAN_ROUTES) {
        // eslint-disable-next-line no-await-in-loop
        const routeResult = await scanPage(page, route);
        routeResults.push(routeResult);
      }

      let postLogin = null;
      if (profile.name === 'desktop') {
        postLogin = await verifyPostLoginFlow(page);
      }

      profileResults.push({
        profile: profile.name,
        routes: routeResults,
        postLogin
      });

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    profiles: profileResults
  };

  const outFile = path.join(OUT_DIR, 'ui-scan.json');
  await writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({ ok: true, outFile }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
