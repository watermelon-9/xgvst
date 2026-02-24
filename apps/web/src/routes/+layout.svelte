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

<header class="app-header">
	<a class="brand-link" href="/" aria-label="返回首页">
		<div class="brand-emblem" aria-hidden="true">
			<svg class="xg-mark" viewBox="0 0 64 64" role="img" aria-label="XG logo">
				<path fill="#24d3b1" d="M8 14h14l12 18-12 18H8l12-18z" />
				<path fill="#1ab89c" d="M19 23h6l6 9-6 9h-6l6-9z" />
				<path
					fill="#f8fafc"
					d="M40.5 16c7.7 0 14 6.3 14 14s-6.3 14-14 14c-4.2 0-8-1.9-10.6-4.9l5.2-4.4c1.4 1.6 3.5 2.5 5.8 2.5 4.1 0 7.5-3.3 7.5-7.4s-3.4-7.4-7.5-7.4h-3.6l4.8-6h2.4z"
				/>
				<rect x="35.2" y="29.5" width="13.2" height="5.5" rx="2.75" fill="#f8fafc" transform="rotate(-37 41.8 32.25)" />
			</svg>
		</div>
		<div class="brand-copy">
			<div class="brand-main">XGVST</div>
			<div class="brand-sub">Master Volatility. Master Markets.</div>
		</div>
	</a>

	<div class="header-actions">
		<div class="user-chip">Hoeltu ▼</div>
		<button type="button" class="theme-toggle" onclick={toggleTheme} aria-label="切换明暗主题">
			<span>{theme === 'light' ? '🌙 暗黑' : '☀️ 亮色'}</span>
		</button>
	</div>
</header>

{@render children()}
