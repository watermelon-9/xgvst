<script lang="ts">
	import { onMount } from 'svelte';
	import { initPwa } from '$lib/pwa';
	import '../app.css';

	let { children } = $props();
	let theme = $state<'light' | 'dark'>('dark');
	let themeMeta: HTMLMetaElement | null = null;

	const resolveInitialTheme = (): 'light' | 'dark' => {
		if (typeof document === 'undefined') return 'dark';
		return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
	};

	const applyTheme = (value: 'light' | 'dark') => {
		theme = value;
		document.documentElement.dataset.theme = value;
		themeMeta?.setAttribute('content', value === 'dark' ? '#111827' : '#f4f6fb');
	};

	onMount(() => {
		themeMeta = document.querySelector('meta[name="theme-color"]');
		theme = resolveInitialTheme();
		initPwa();
	});

	const toggleTheme = () => {
		const next = theme === 'light' ? 'dark' : 'light';
		applyTheme(next);
		localStorage.setItem('xgvst-theme', next);
	};
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta
		name="description"
		content="XGVST — Master Volatility. Master Markets. 提供市场总览、行情追踪与个股分析。"
	/>
	<meta name="theme-color" content="#111827" />
	<title>XGVST — Master Volatility. Master Markets.</title>
</svelte:head>

<button type="button" class="theme-toggle" onclick={toggleTheme} aria-label="切换明暗主题">
	<span>{theme === 'light' ? '🌙 暗黑' : '☀️ 亮色'}</span>
</button>

{@render children()}
