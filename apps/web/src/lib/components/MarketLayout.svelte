<script lang="ts">
	import type { Snippet } from 'svelte';
	import MobileTabs from './MobileTabs.svelte';

	type TabKey = 'left' | 'center' | 'right';
	type Tab = { key: TabKey; label: string };

	let {
		left,
		center,
		right,
		initialTab = 'center'
	}: {
		left: Snippet;
		center: Snippet;
		right: Snippet;
		initialTab?: TabKey;
	} = $props();

	let activeTab = $state<TabKey>('center');
	$effect(() => {
		activeTab = initialTab;
	});

	const tabs: Tab[] = [
		{ key: 'left', label: '分块/自选' },
		{ key: 'center', label: '行情表' },
		{ key: 'right', label: '个股K线' }
	];

	function setActiveTab(next: TabKey) {
		activeTab = next;
	}
</script>

<section class="market-grid desktop-only" aria-label="PC 三栏布局">
	<article class="glass-card pane-left">
		<header class="pane-title">全部分块 + 自选</header>
		{@render left()}
	</article>
	<article class="glass-card pane-center">
		<header class="pane-title">行情表</header>
		{@render center()}
	</article>
	<article class="glass-card pane-right">
		<header class="pane-title">个股K线</header>
		{@render right()}
	</article>
</section>

<section class="mobile-only" aria-label="移动端 Tab 布局">
	<MobileTabs {tabs} active={activeTab} onChange={setActiveTab}>
		<article class="glass-card">
			<header class="pane-title">
				{tabs.find((tab) => tab.key === activeTab)?.label}
			</header>

			{#if activeTab === 'left'}
				{@render left()}
			{:else if activeTab === 'center'}
				{@render center()}
			{:else}
				{@render right()}
			{/if}
		</article>
	</MobileTabs>
</section>
