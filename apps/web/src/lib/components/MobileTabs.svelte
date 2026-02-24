<script lang="ts">
	import type { Snippet } from 'svelte';

	type TabKey = 'left' | 'center' | 'right';
	type Tab = { key: TabKey; label: string };

	let {
		tabs,
		active,
		onChange,
		children
	}: {
		tabs: Tab[];
		active: TabKey;
		onChange: (key: TabKey) => void;
		children: Snippet;
	} = $props();

	const SWIPE_THRESHOLD = 56;
	let touchStartX = $state(0);
	let touchStartY = $state(0);

	function handleTouchStart(event: TouchEvent) {
		const touch = event.changedTouches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
	}

	function handleTouchEnd(event: TouchEvent) {
		const touch = event.changedTouches[0];
		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;
		if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) return;

		const currentIndex = tabs.findIndex((tab) => tab.key === active);
		if (currentIndex < 0) return;

		const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
		if (nextIndex < 0 || nextIndex >= tabs.length) return;
		onChange(tabs[nextIndex].key);
	}
</script>

<section
	class="mobile-tab-content"
	role="group"
	aria-label="移动端面板"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
>
	{@render children()}
</section>

<nav class="mobile-tabs glass-card" aria-label="移动端底部导航">
	{#each tabs as tab}
		<button
			type="button"
			class={`mobile-tab-btn ${tab.key === active ? 'is-active' : ''}`}
			onclick={() => onChange(tab.key)}
		>
			{tab.label}
		</button>
	{/each}
</nav>
