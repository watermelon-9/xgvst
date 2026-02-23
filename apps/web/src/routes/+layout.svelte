<script lang="ts">
	import { onMount } from 'svelte';
	import 'virtual:uno.css';
	import '../app.css';

	let { children } = $props();
	let theme = $state<'light' | 'dark'>('light');

	const applyTheme = (value: 'light' | 'dark') => {
		theme = value;
		document.documentElement.dataset.theme = value;
	};

	onMount(() => {
		const saved = localStorage.getItem('xgvst-theme');
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		applyTheme(saved === 'dark' || (!saved && prefersDark) ? 'dark' : 'light');
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
	<meta name="description" content="西瓜说股 v3.0：市场总览与个股详情原型。" />
	<title>西瓜说股 v3.0</title>
</svelte:head>

<button type="button" class="theme-toggle" onclick={toggleTheme} aria-label="切换明暗主题">
	<span>{theme === 'light' ? '🌙 暗黑' : '☀️ 亮色'}</span>
</button>

{@render children()}
