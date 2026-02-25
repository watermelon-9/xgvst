<script lang="ts">
	import { goto } from '$app/navigation';
	import { useToast } from '$lib/ui/toast.svelte';

	const toast = useToast();
	const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	let email = $state('');
	let inviteCode = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);

	const emailError = $derived.by(() => {
		if (!email.trim()) return '请输入注册邮箱';
		if (!EMAIL_PATTERN.test(email.trim())) return '邮箱格式不正确';
		return '';
	});

	const inviteError = $derived.by(() => {
		if (!inviteCode.trim()) return '请输入邀请码';
		return '';
	});

	const newPasswordError = $derived.by(() => {
		if (!newPassword) return '请输入新密码';
		if (newPassword.length < 6) return '至少6位';
		return '';
	});

	const confirmError = $derived.by(() => {
		if (!confirmPassword) return '请再次输入新密码';
		if (confirmPassword !== newPassword) return '两次密码不一致';
		return '';
	});

	const canSubmit = $derived(
		!loading && !emailError && !inviteError && !newPasswordError && !confirmError
	);

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) {
			toast.error('请先修正表单后再提交');
			return;
		}

		loading = true;
		await new Promise((resolve) => setTimeout(resolve, 700));
		toast.success('验证通过，密码已重置（UI演示）');
		await goto(`/auth/login?email=${encodeURIComponent(email.trim().toLowerCase())}`);
	}
</script>

<main class="auth-shell auth-shell-forgot">
	<section class="auth-card auth-card-simple" data-auth-flow="email-password" data-auth-alt-entry="none">
		<header class="auth-head auth-head-plain">
			<h1>忘记密码</h1>
			<p>请输入注册邮箱 + 邀请码，并设置新密码。验证通过后将直接重置密码。</p>
			<p class="auth-sentinel" data-auth-entry-rule="email-only" data-auth-provider="none-phone-wechat-third-party">
				仅邮箱账号体系，不提供手机号/微信/三方找回入口。
			</p>
		</header>

		<form class="auth-form auth-form-simple" novalidate onsubmit={onSubmit}>
			<label class="auth-label" for="forgot-email">邮箱</label>
			<input
				id="forgot-email"
				type="email"
				name="email"
				class={`auth-field ${emailError ? 'is-invalid' : ''}`}
				bind:value={email}
				placeholder="请输入注册邮箱"
				autocomplete="email"
				required
			/>
			{#if emailError}
				<p class="auth-error">{emailError}</p>
			{/if}

			<label class="auth-label" for="forgot-invite">邀请码</label>
			<input
				id="forgot-invite"
				type="text"
				name="inviteCode"
				class={`auth-field ${inviteError ? 'is-invalid' : ''}`}
				bind:value={inviteCode}
				placeholder="请输入邀请码"
				autocomplete="off"
				required
			/>
			{#if inviteError}
				<p class="auth-error">{inviteError}</p>
			{/if}

			<label class="auth-label" for="forgot-password">新密码</label>
			<input
				id="forgot-password"
				type="password"
				name="newPassword"
				class={`auth-field ${newPasswordError ? 'is-invalid' : ''}`}
				bind:value={newPassword}
				placeholder="至少6位"
				autocomplete="new-password"
				required
			/>
			{#if newPasswordError}
				<p class="auth-error">{newPasswordError}</p>
			{/if}

			<label class="auth-label" for="forgot-confirm">确认新密码</label>
			<input
				id="forgot-confirm"
				type="password"
				name="confirmPassword"
				class={`auth-field ${confirmError ? 'is-invalid' : ''}`}
				bind:value={confirmPassword}
				placeholder="请再次输入新密码"
				autocomplete="new-password"
				required
			/>
			{#if confirmError}
				<p class="auth-error">{confirmError}</p>
			{/if}

			<button type="submit" class="auth-submit" disabled={!canSubmit}>
				{loading ? '验证中…' : '验证并重置密码'}
			</button>
		</form>

		<footer class="auth-foot auth-foot-center">
			<a href="/auth/login">返回登录</a>
		</footer>
	</section>
</main>
