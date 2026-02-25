<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { useToast } from '$lib/ui/toast.svelte';
	import type { useAuth as useAuthFactory } from '$lib/auth/useAuth.svelte';

	type AuthApi = ReturnType<typeof useAuthFactory>;

	const toast = useToast();
	const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const LOGIN_FLOW_STORAGE_KEY = 'xgvst.auth.loginFlow';
	const LOGIN_REDIRECT_TARGET = '/market';

	let authApi = $state<AuthApi | null>(null);
	let email = $state('');
	let password = $state('');
	let loading = $state(false);

	const emailError = $derived.by(() => {
		if (!email.trim()) return '请输入邮箱地址';
		if (!EMAIL_PATTERN.test(email.trim())) return '邮箱格式不正确';
		return '';
	});

	const passwordError = $derived.by(() => {
		if (!password) return '请输入密码';
		if (password.length < 6) return '密码长度至少 6 位';
		return '';
	});

	const canSubmit = $derived(!loading && !emailError && !passwordError);

	const ensureAuthApi = async (): Promise<AuthApi> => {
		if (authApi) return authApi;
		const { useAuth } = await import('$lib/auth/useAuth.svelte');
		authApi = useAuth();
		return authApi;
	};

	onMount(() => {
		void ensureAuthApi().then((api) => {
			api.bootstrap();
		});
		const emailFromQuery = new URLSearchParams(window.location.search).get('email')?.trim();
		if (emailFromQuery) {
			email = emailFromQuery;
		} else {
			email = 'xgvst@gmail.com';
		}
	});

	function persistLoginFlow(payload: {
		email: string;
		sync: 'ok' | 'degraded';
		syncError: string | null;
		redirectTo: string;
		at: string;
	}) {
		if (typeof window === 'undefined') return;
		try {
			window.sessionStorage.setItem(LOGIN_FLOW_STORAGE_KEY, JSON.stringify(payload));
		} catch {
			// ignore storage errors
		}
	}

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) {
			toast.error('请先修正表单错误后再登录');
			return;
		}

		loading = true;
		try {
			const auth = await ensureAuthApi();
			const normalizedEmail = email.trim().toLowerCase();
			auth.signIn(normalizedEmail);

			const { mockUniverse } = await import('$lib/api/mock');
			const syncResult = await auth.syncWatchlist(mockUniverse.watchlist.map((item) => item.symbol));
			const sync = syncResult.ok ? 'ok' : 'degraded';
			const syncError = syncResult.ok ? null : syncResult.error ?? '未知错误';

			persistLoginFlow({
				email: normalizedEmail,
				sync,
				syncError,
				redirectTo: LOGIN_REDIRECT_TARGET,
				at: new Date().toISOString()
			});

			if (syncResult.ok) {
				toast.success('登录成功，已同步自选股');
			} else {
				toast.info(`登录成功，自选同步异常：${syncError}`);
			}

			await goto(
				`${LOGIN_REDIRECT_TARGET}?authFlow=login-success&sync=${sync}&uid=${encodeURIComponent(normalizedEmail)}&redirect=${encodeURIComponent(LOGIN_REDIRECT_TARGET)}`,
				{ replaceState: true }
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(`登录失败：${message}`);
		} finally {
			loading = false;
		}
	}
</script>

<main class="auth-shell auth-shell-login">
	<section class="auth-card auth-card-login" data-auth-flow="email-password" data-auth-alt-entry="none">
		<aside class="auth-login-brand" aria-label="品牌信息">
			<h1>西瓜说股</h1>
			<p class="auth-login-brand-sub">智能版块联动 · VAR7 主力吸筹分析平台</p>
			<div class="auth-login-tags" aria-hidden="true">
				<span>概念/行业/地域</span>
				<span>K线 + 成交量 + VAR7</span>
				<span>红紫主题</span>
			</div>
			<p class="auth-login-brand-foot">© Xigua Quant Studio</p>
		</aside>

		<div class="auth-login-form-panel">
			<header class="auth-head">
				<h1>账号登录</h1>
				<p>请输入邮箱和密码进入西瓜说股</p>
				<p class="auth-sentinel" data-auth-entry-rule="email-only" data-auth-provider="none-phone-wechat-third-party">
					认证入口：仅邮箱（含密码凭证），不提供手机号/微信/三方登录。
				</p>
			</header>

			<form class="auth-form" novalidate onsubmit={onSubmit} data-auth-entry-rule="email-only">
				<label class="auth-label" for="login-email">邮箱</label>
				<input
					id="login-email"
					type="email"
					name="email"
					class={`auth-field ${emailError ? 'is-invalid' : ''}`}
					bind:value={email}
					placeholder="vienh642@gmail.com"
					autocomplete="email"
					required
				/>
				{#if emailError}
					<p class="auth-error">{emailError}</p>
				{/if}

				<label class="auth-label" for="login-password">密码</label>
				<input
					id="login-password"
					type="password"
					name="password"
					data-auth-credential="password"
					class={`auth-field ${passwordError ? 'is-invalid' : ''}`}
					bind:value={password}
					placeholder="••••••••••••••••"
					autocomplete="current-password"
					required
				/>
				{#if passwordError}
					<p class="auth-error">{passwordError}</p>
				{/if}

				<div class="auth-meta-row">
					<label class="auth-check">
						<input type="checkbox" name="remember" checked />
						<span>记住账号</span>
					</label>
					<a class="auth-link" href="/auth/forgot-password">忘记密码?</a>
				</div>

				<button type="submit" class="auth-submit" disabled={!canSubmit}>
					{loading ? '登录中…' : '登录'}
				</button>
			</form>

			<footer class="auth-foot auth-foot-center">
				<a href="/auth/register">新用户注册（邀请码必填）</a>
			</footer>
		</div>
	</section>
</main>
