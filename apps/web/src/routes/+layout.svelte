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
			<div class="xg-logo">
				<svg class="xg-icon" viewBox="0 0 100 100" role="img" aria-label="XG logo">
					<defs>
						<linearGradient id="xgGrad" x1="23" y1="25" x2="58" y2="76" gradientUnits="userSpaceOnUse">
							<stop offset="0%" stop-color="#67e5a8" />
							<stop offset="100%" stop-color="#1ccbb0" />
						</linearGradient>
					</defs>
					<rect x="2" y="2" width="96" height="96" rx="24" fill="#141d3c" />
					<g>
						<path
							d="M73 31a20 20 0 1 0 0 38"
							fill="none"
							stroke="#ffffff"
							stroke-width="11"
							stroke-linecap="round"
						/>
						<rect x="57" y="45" width="24" height="10" rx="2" fill="#ffffff" />
					</g>
					<path
						d="M23 25h18l16 25-16 25H23l15-25-15-25zm12 9h7l9 16-9 16h-7l9-16-9-16z"
						fill="url(#xgGrad)"
					/>
				</svg>
			</div>
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
