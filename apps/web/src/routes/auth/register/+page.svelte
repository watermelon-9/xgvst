<script lang="ts">
	import { goto } from '$app/navigation';
	import { useToast } from '$lib/ui/toast.svelte';

	const toast = useToast();
	const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
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

	const confirmError = $derived.by(() => {
		if (!confirmPassword) return '请确认密码';
		if (confirmPassword !== password) return '两次密码输入不一致';
		return '';
	});

	const canSubmit = $derived(!loading && !emailError && !passwordError && !confirmError);

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) {
			toast.error('请先修正表单错误后再注册');
			return;
		}

		loading = true;
		await new Promise((resolve) => setTimeout(resolve, 800));
		toast.success('注册成功，请使用邮箱登录');
		await goto(`/auth/login?email=${encodeURIComponent(email.trim().toLowerCase())}`);
	}
</script>

<main class="auth-shell auth-shell-register">
	<section class="auth-card auth-card-register" data-auth-flow="email-password" data-auth-alt-entry="none">
		<aside class="auth-side auth-side-register" aria-label="注册品牌信息">
			<h1>创建账号</h1>
			<p>加入西瓜说股，开启红紫主题交易台体验。</p>
			<div class="auth-side-tags" aria-hidden="true">
				<span>邮箱体系</span>
				<span>安全凭证</span>
				<span>渐变主题</span>
			</div>
		</aside>

		<div class="auth-main-panel">
			<header class="auth-head auth-head-plain">
				<h2>邮箱注册</h2>
				<p>仅支持邮箱+密码注册流程，不提供手机号/微信/三方登录入口。</p>
				<p class="auth-sentinel" data-auth-entry-rule="email-only" data-auth-provider="none-phone-wechat-third-party">
					认证入口：仅邮箱账号体系（含密码凭证）。
				</p>
			</header>

			<form class="auth-form" novalidate onsubmit={onSubmit}>
				<label class="auth-label" for="register-email">邮箱</label>
				<input
					id="register-email"
					type="email"
					name="email"
					class={`auth-field ${emailError ? 'is-invalid' : ''}`}
					bind:value={email}
					placeholder="name@example.com"
					autocomplete="email"
					required
				/>
				{#if emailError}
					<p class="auth-error">{emailError}</p>
				{/if}

				<label class="auth-label" for="register-password">密码</label>
				<input
					id="register-password"
					type="password"
					name="password"
					class={`auth-field ${passwordError ? 'is-invalid' : ''}`}
					bind:value={password}
					placeholder="至少 6 位"
					autocomplete="new-password"
					required
				/>
				{#if passwordError}
					<p class="auth-error">{passwordError}</p>
				{/if}

				<label class="auth-label" for="register-confirm">确认密码</label>
				<input
					id="register-confirm"
					type="password"
					name="confirmPassword"
					class={`auth-field ${confirmError ? 'is-invalid' : ''}`}
					bind:value={confirmPassword}
					placeholder="再次输入密码"
					autocomplete="new-password"
					required
				/>
				{#if confirmError}
					<p class="auth-error">{confirmError}</p>
				{/if}

				<button type="submit" class="auth-submit" disabled={!canSubmit}>
					{loading ? '注册中…' : '注册账号'}
				</button>
			</form>

			<footer class="auth-foot auth-foot-center">
				<a href="/auth/login">返回登录</a>
			</footer>
		</div>
	</section>
</main>
