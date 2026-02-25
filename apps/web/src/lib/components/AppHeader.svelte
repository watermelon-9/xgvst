<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { useAuth } from '$lib/auth/useAuth.svelte';
	import { useToast } from '$lib/ui/toast.svelte';

	const auth = useAuth();
	const toast = useToast();
	const currentPath = $derived(page.url.pathname);

	onMount(() => {
		auth.bootstrap();
	});

	function signOut() {
		auth.signOut();
		toast.success('已退出登录');
	}
</script>

<header class="app-header glass-card" aria-label="主导航栏">
	<div class="app-header-inner">
		<a href="/" class="app-brand" aria-label="返回首页">
			<span class="brand-dot"></span>
			<span>XGVST</span>
		</a>
		<nav class="app-nav" aria-label="站点导航">
			<a href="/" class={`app-nav-link ${currentPath === '/' ? 'is-active' : ''}`}>首页</a>
			<a href="/market" class={`app-nav-link ${currentPath.startsWith('/market') ? 'is-active' : ''}`}>市场</a>
			<a href="/detail" class={`app-nav-link ${currentPath.startsWith('/detail') ? 'is-active' : ''}`}>详情</a>
		</nav>
		<div class="app-auth-entry">
			{#if auth.isAuthenticated()}
				<span class="auth-tag">{auth.state.user?.displayName}</span>
				<button type="button" class="app-header-btn" onclick={signOut}>退出</button>
			{:else}
				<a href="/auth/login" class="app-header-btn">登录</a>
			{/if}
		</div>
	</div>
</header>
