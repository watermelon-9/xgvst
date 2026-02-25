#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const RAW_DIR = path.resolve('reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan');
const OUT_FILE = path.join(RAW_DIR, 'summary.json');

const ROUTES = ['/auth/login', '/auth/register', '/auth/forgot-password', '/market'];
const PROFILES = ['mobile', 'desktop'];

const THRESHOLDS = {
  perf: 0.9,
  a11y: 0.9,
  cls: 0.1
};

function routeToName(route) {
  return route.replace(/^\//, '').replace(/\//g, '-');
}

function round(n, digits = 3) {
  return Number(Number(n).toFixed(digits));
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function run() {
  await mkdir(RAW_DIR, { recursive: true });

  const uiScan = await readJson(path.join(RAW_DIR, 'ui-scan.json'));

  const lh = [];
  for (const route of ROUTES) {
    const name = routeToName(route);
    for (const profile of PROFILES) {
      const file = path.join(RAW_DIR, 'lh', `${profile}-${name}.json`);
      const report = await readJson(file);
      lh.push({
        route,
        profile,
        status: report.fetchTime ? 'ok' : 'unknown',
        performance: round(report.categories.performance?.score ?? 0),
        accessibility: round(report.categories.accessibility?.score ?? 0),
        cls: round(report.audits['cumulative-layout-shift']?.numericValue ?? 999, 4),
        finalUrl: report.finalUrl ?? null,
        file: path.relative(path.resolve('.'), file)
      });
    }
  }

  const authUiRows = [];
  for (const profileRow of uiScan.profiles) {
    for (const row of profileRow.routes.filter((r) => r.route.startsWith('/auth/'))) {
      authUiRows.push({
        profile: profileRow.profile,
        route: row.route,
        status: row.status,
        authUiStrictPass: !!row.authUiStrictPass,
        navCount: row.navCount,
        emailInputs: row.inputSummary?.emailInputs ?? 0,
        nonEmailInputs: row.inputSummary?.nonEmailInputs ?? 0,
        passwordInputs: row.inputSummary?.passwordInputs ?? 0,
        emailTextHit: !!row.emailTextHit,
        notes: row.notes ?? []
      });
    }
  }

  const postLogin = uiScan.profiles.find((p) => p.profile === 'desktop')?.postLogin ?? null;

  const dod = {
    dod1_multi_endpoint_scan: {
      pass: lh.length === ROUTES.length * PROFILES.length,
      evidence: `${lh.length}/${ROUTES.length * PROFILES.length} LH samples + UI scan`
    },
    dod2_auth_page_strict_ui: {
      pass: authUiRows.every((r) => r.authUiStrictPass),
      failedRows: authUiRows.filter((r) => !r.authUiStrictPass)
    },
    dod3_lh_perf_a11y_cls: {
      pass: lh.every((r) => r.performance >= THRESHOLDS.perf && r.accessibility >= THRESHOLDS.a11y && r.cls <= THRESHOLDS.cls),
      thresholds: THRESHOLDS,
      failedRows: lh.filter((r) => !(r.performance >= THRESHOLDS.perf && r.accessibility >= THRESHOLDS.a11y && r.cls <= THRESHOLDS.cls))
    },
    dod4_post_login_redirect_sync_no_flicker: {
      pass: !!(postLogin?.redirectToMarket && postLogin?.tokenSyncDetected && postLogin?.noFlicker),
      details: postLogin
    }
  };

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: uiScan.baseUrl,
    thresholds: THRESHOLDS,
    lighthouse: lh,
    authUi: authUiRows,
    postLogin,
    dod,
    finalPass: Object.values(dod).every((x) => x.pass)
  };

  await writeFile(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, outFile: OUT_FILE, finalPass: report.finalPass }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
