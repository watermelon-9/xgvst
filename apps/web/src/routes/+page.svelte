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
		<header class="market-toolbar glass-card">
			<div class="toolbar-left">
				<div class="toolbar-title">西瓜说股 v3.0（v2 对齐模式）</div>
				<div class="toolbar-sub">主市场 | 09:30-15:00 | 三栏联动</div>
			</div>
			<div class="toolbar-right">
				<span class="toolbar-chip">沪深A</span>
				<span class="toolbar-chip">行情延时: Mock</span>
			</div>
		</header>

		<MarketLayout initialTab={data.initialTab}>
			{#snippet left()}
				<div class="pane-content compact">
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
						<h3 class="section-title">自选股</h3>
						<div class="stack-list">
							{#each watchlist as item}
								<button
									type="button"
									class={`market-row ${activeSymbol === item.symbol ? 'active' : ''}`}
									onclick={() => (activeSymbol = item.symbol)}
								>
									<span>{item.name}（{item.symbol}）</span>
									<span>{item.last}</span>
								</button>
							{/each}
						</div>
					</section>
				</div>
			{/snippet}

			{#snippet center()}
				<div class="pane-content compact">
					<h3 class="section-title">行情列表</h3>
					<div class="quote-table">
						<div class="quote-head">
							<span>名称/代码</span>
							<span>最新</span>
							<span>涨跌幅</span>
						</div>
						{#each watchlist as item}
							<button
								type="button"
								class={`quote-row ${activeSymbol === item.symbol ? 'active' : ''}`}
								onclick={() => (activeSymbol = item.symbol)}
							>
								<span>{item.name} / {item.symbol}</span>
								<span>{item.last}</span>
								<span class={item.changePct >= 0 ? 'trend-up' : 'trend-down'}>{item.changePct}%</span>
							</button>
						{/each}
					</div>
				</div>
			{/snippet}

			{#snippet right()}
				<div class="pane-content compact">
					<h3 class="section-title">个股分时/K线</h3>
					<div class="kline-toolbar">
						<button type="button" class="kline-btn active">分时</button>
						<button type="button" class="kline-btn">5日</button>
						<button type="button" class="kline-btn">日K</button>
						<button type="button" class="kline-btn">周K</button>
					</div>
					<div class="kline-shell glass">
						<div class="kline-symbol">{activeQuote?.name} · {activeSymbol}</div>
						<p class="muted">当前版块：{selectedBoard?.name ?? '--'}</p>
						<div class="kline-grid" aria-label="kline skeleton"></div>
					</div>
				</div>
			{/snippet}
		</MarketLayout>
	</section>
</main>
