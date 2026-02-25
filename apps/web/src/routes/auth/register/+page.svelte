<script lang="ts">
	import { goto } from '$app/navigation';
	import { useToast } from '$lib/ui/toast.svelte';
	import AuthFrame from '$lib/components/auth/AuthFrame.svelte';

	const toast = useToast();
	const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let inviteCode = $state('');
	let remember = $state(true);
	let loading = $state(false);

	const emailError = $derived.by(() => {
		if (!email.trim()) return '请输入邮箱地址';
		if (!EMAIL_PATTERN.test(email.trim())) return '邮箱格式不正确';
		return '';
	});

	const passwordError = $derived.by(() => {
		if (!password) return '请输入密码';
		if (password.length < 6) return '至少6位';
		return '';
	});

	const confirmError = $derived.by(() => {
		if (!confirmPassword) return '请再次输入密码';
		if (confirmPassword !== password) return '两次密码不一致';
		return '';
	});

	const inviteError = $derived.by(() => {
		if (!inviteCode.trim()) return '请输入邀请码';
		return '';
	});

	const canSubmit = $derived(!loading && !emailError && !passwordError && !confirmError && !inviteError);

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) {
			toast.error('请先修正表单错误后再提交');
			return;
		}

		loading = true;
		await new Promise((resolve) => setTimeout(resolve, 700));
		toast.success('注册成功，请登录');
		await goto(`/auth/login?email=${encodeURIComponent(email.trim().toLowerCase())}`);
	}
</script>

<AuthFrame
	tone="register"
	sideAriaLabel="注册说明"
	sideTitle="西瓜说股"
	sideDescription="邮箱体系 + 邀请码机制，注册完成后可直接进入行情系统。"
	sideTags={['仅邮箱账号', '邀请码必填', '红紫主题']}
	headTitle="创建账号"
	headDescription="注册后自动登录，注册账号必须为邮箱，邀请码为必填项。"
>
	{#snippet form()}
		<form class="auth-form" novalidate onsubmit={onSubmit}>
			<label class="auth-label" for="register-email">邮箱 *</label>
			<input
				id="register-email"
				type="email"
				name="email"
				class={`auth-field ${emailError ? 'is-invalid' : ''}`}
				bind:value={email}
				placeholder="请输入邮箱地址"
				autocomplete="email"
				required
			/>
			{#if emailError}
				<p class="auth-error">{emailError}</p>
			{/if}

			<label class="auth-label" for="register-password">密码 *</label>
			<input
				id="register-password"
				type="password"
				name="password"
				class={`auth-field ${passwordError ? 'is-invalid' : ''}`}
				bind:value={password}
				placeholder="至少6位"
				autocomplete="new-password"
				required
			/>
			{#if passwordError}
				<p class="auth-error">{passwordError}</p>
			{/if}

			<label class="auth-label" for="register-confirm">确认密码 *</label>
			<input
				id="register-confirm"
				type="password"
				name="confirmPassword"
				class={`auth-field ${confirmError ? 'is-invalid' : ''}`}
				bind:value={confirmPassword}
				placeholder="请再次输入密码"
				autocomplete="new-password"
				required
			/>
			{#if confirmError}
				<p class="auth-error">{confirmError}</p>
			{/if}

			<label class="auth-label" for="register-invite">邀请码 *</label>
			<input
				id="register-invite"
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

			<div class="auth-meta-row">
				<label class="auth-check">
					<input type="checkbox" name="remember" bind:checked={remember} />
					<span>记住账号</span>
				</label>
				<a class="auth-link" href="/auth/login">已有账号？去登录</a>
			</div>

			<button type="submit" class="auth-submit" disabled={!canSubmit}>
				{loading ? '注册中…' : '注册并进入'}
			</button>
		</form>
	{/snippet}

	{#snippet footer()}
		<a href="/auth/login">返回登录</a>
		<a href="/auth/forgot-password">忘记密码</a>
		<a href="/">返回首页</a>
	{/snippet}
</AuthFrame>
