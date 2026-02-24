<script lang="ts">
	import MarketLayout from '$lib/components/MarketLayout.svelte';
	import { mockUniverse } from '$lib/api/mock';

	let { data } = $props();

	const boards = mockUniverse.boards;
	const watchlist = mockUniverse.watchlist;

	let activeBoardCode = $state(boards[0]?.code ?? '');
	let activeSymbol = $state(watchlist[0]?.symbol ?? '');

	$effect(() => {
		if (data.initialBoard) activeBoardCode = data.initialBoard;
		if (data.initialSymbol) activeSymbol = data.initialSymbol;
	});

	const activeQuote = $derived(watchlist.find((item) => item.symbol === activeSymbol) ?? watchlist[0]);
	const selectedBoard = $derived(boards.find((board) => board.code === activeBoardCode));
</script>

<main class="page page-market">
	<section class="container container-wide">
		<header class="hero glass-card">
			<p class="hero-kicker">西瓜说股 v3.0 / P3.1</p>
			<h1 class="title neon-text">暗紫毛玻璃 · 三栏响应式首页</h1>
			<p class="subtitle">PC 端三栏 Grid（fr 动态列宽）+ 移动端 Tab（Runes + 手势滑动）+ 自动/手动主题切换。</p>
		</header>

		<MarketLayout initialTab={data.initialTab}>
			{#snippet left()}
				<div class="pane-content">
					<section>
						<h3 class="section-title">全部分块</h3>
						<div class="stack-list">
							{#each boards as board}
								<button
									type="button"
									class={`market-row ${activeBoardCode === board.code ? 'active' : ''}`}
									onclick={() => (activeBoardCode = board.code)}
								>
									<span>{board.name}</span>
									<span class={board.changePct >= 0 ? 'trend-up' : 'trend-down'}>{board.changePct}%</span>
								</button>
							{/each}
						</div>
					</section>

					<section>
						<h3 class="section-title">自选</h3>
						<div class="stack-list">
							{#each watchlist as item}
								<button
									type="button"
									class={`market-row ${activeSymbol === item.symbol ? 'active' : ''}`}
									onclick={() => (activeSymbol = item.symbol)}
								>
									<span>{item.name}</span>
									<span class="muted">{item.symbol}</span>
								</button>
							{/each}
						</div>
					</section>
				</div>
			{/snippet}

			{#snippet center()}
				<div class="pane-content">
					<h3 class="section-title">行情表</h3>
					<div class="quote-table">
						<div class="quote-head">
							<span>代码</span>
							<span>最新</span>
							<span>涨跌幅</span>
						</div>
						{#each watchlist as item}
							<button
								type="button"
								class={`quote-row ${activeSymbol === item.symbol ? 'active' : ''}`}
								onclick={() => (activeSymbol = item.symbol)}
							>
								<span>{item.symbol}</span>
								<span>{item.last}</span>
								<span class={item.changePct >= 0 ? 'trend-up' : 'trend-down'}>{item.changePct}%</span>
							</button>
						{/each}
					</div>
				</div>
			{/snippet}

			{#snippet right()}
				<div class="pane-content">
					<h3 class="section-title">K线占位</h3>
					<div class="kline-shell glass">
						<div class="kline-symbol neon-text">{activeQuote?.name} · {activeSymbol}</div>
						<p class="muted">当前版块：{selectedBoard?.name ?? '--'}</p>
						<div class="kline-grid" aria-label="kline skeleton"></div>
					</div>
				</div>
			{/snippet}
		</MarketLayout>
	</section>
</main>
