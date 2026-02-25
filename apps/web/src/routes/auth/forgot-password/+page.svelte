<script lang="ts">
	import { useToast } from '$lib/ui/toast.svelte';

	const toast = useToast();
	const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	let email = $state('');
	let loading = $state(false);

	const emailError = $derived.by(() => {
		if (!email.trim()) return '请输入邮箱地址';
		if (!EMAIL_PATTERN.test(email.trim())) return '邮箱格式不正确';
		return '';
	});

	const canSubmit = $derived(!loading && !emailError);

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) {
			toast.error('请填写有效邮箱后再提交');
			return;
		}

		loading = true;
		await new Promise((resolve) => setTimeout(resolve, 700));
		toast.success(`重置邮件已发送至 ${email.trim().toLowerCase()}（模拟）`);
		loading = false;
	}
</script>

<main class="auth-shell auth-shell-forgot">
	<section class="auth-card auth-card-forgot" data-auth-flow="email-password" data-auth-alt-entry="none">
		<aside class="auth-side auth-side-forgot" aria-label="找回密码品牌信息">
			<h1>找回密码</h1>
			<p>通过邮箱重置密码，继续访问你的红紫交易台。</p>
			<div class="auth-side-tags" aria-hidden="true">
				<span>邮箱验证</span>
				<span>安全重置</span>
				<span>快速恢复</span>
			</div>
		</aside>

		<div class="auth-main-panel">
			<header class="auth-head auth-head-plain">
				<h2>重置入口</h2>
				<p>请输入注册邮箱，我们会发送重置链接（演示环境为模拟发送）。</p>
				<p class="auth-sentinel" data-auth-entry-rule="email-only" data-auth-provider="none-phone-wechat-third-party">
					仅邮箱账号体系，不提供手机号/微信/三方找回入口。
				</p>
			</header>

			<form class="auth-form" novalidate onsubmit={onSubmit}>
				<label class="auth-label" for="forgot-email">邮箱</label>
				<input
					id="forgot-email"
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

				<button type="submit" class="auth-submit" disabled={!canSubmit}>
					{loading ? '发送中…' : '发送重置邮件'}
				</button>
			</form>

			<footer class="auth-foot">
				<a href="/auth/login">返回登录</a>
				<a href="/auth/register">去注册</a>
			</footer>
		</div>
	</section>
</main>
