<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { useAuth } from '$lib/auth/useAuth.svelte';
	import { mockUniverse } from '$lib/api/mock';
	import { useToast } from '$lib/ui/toast.svelte';

	const auth = useAuth();
	const toast = useToast();
	const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

	onMount(() => {
		auth.bootstrap();
		const emailFromQuery = new URLSearchParams(window.location.search).get('email')?.trim();
		if (emailFromQuery) {
			email = emailFromQuery;
		}
	});

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) {
			toast.error('请先修正表单错误后再登录');
			return;
		}

		loading = true;
		try {
			await new Promise((resolve) => setTimeout(resolve, 650));
			auth.signIn(email.trim().toLowerCase());

			const syncResult = await auth.syncWatchlist(mockUniverse.watchlist.map((item) => item.symbol));
			if (syncResult.ok) {
				toast.success('登录成功，已同步自选股');
			} else {
				toast.info(`登录成功，自选同步异常：${syncResult.error ?? '未知错误'}`);
			}

			await goto('/market');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(`登录失败：${message}`);
		} finally {
			loading = false;
		}
	}
</script>

<main class="auth-shell">
	<section class="auth-card glass-card">
		<header class="auth-head">
			<p class="auth-eyebrow">XGVST v2</p>
			<h1>邮箱登录</h1>
			<p>仅支持邮箱流程登录，登录后自动进入市场页并触发自选同步。</p>
		</header>

		<form class="auth-form" novalidate onsubmit={onSubmit}>
			<label class="auth-label" for="login-email">邮箱</label>
			<input
				id="login-email"
				type="email"
				class={`auth-field ${emailError ? 'is-invalid' : ''}`}
				bind:value={email}
				placeholder="name@example.com"
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
				class={`auth-field ${passwordError ? 'is-invalid' : ''}`}
				bind:value={password}
				placeholder="至少 6 位"
				autocomplete="current-password"
				required
			/>
			{#if passwordError}
				<p class="auth-error">{passwordError}</p>
			{/if}

			<button type="submit" class="auth-submit" disabled={!canSubmit}>
				{loading ? '登录中...' : '登录并进入市场'}
			</button>
		</form>

		<footer class="auth-foot">
			<a href="/auth/register">注册账号</a>
			<a href="/auth/forgot-password">忘记密码</a>
		</footer>
	</section>
</main>
