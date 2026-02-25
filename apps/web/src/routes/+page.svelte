<script lang="ts">
	import MarketLayout from '$lib/components/MarketLayout.svelte';
	import { mockUniverse } from '$lib/api/mock';

	type KlinePeriod = 'fs' | '5d' | 'day' | 'week';

	let { data } = $props();

	const boards = mockUniverse.boards;
	const watchlist = mockUniverse.watchlist;

	const marketPulse = [
		{ label: '上证指数', value: '3,128.66', changePct: 0.42 },
		{ label: '深证成指', value: '10,231.08', changePct: -0.16 },
		{ label: '创业板指', value: '2,108.72', changePct: 0.84 },
		{ label: '北向资金', value: '+42.6亿', changePct: 0.91 }
	];

	const periodTabs: Array<{ key: KlinePeriod; label: string }> = [
		{ key: 'fs', label: '分时' },
		{ key: '5d', label: '5日' },
		{ key: 'day', label: '日K' },
		{ key: 'week', label: '周K' }
	];

	let activeBoardCode = $state(boards[0]?.code ?? '');
	let activeSymbol = $state(watchlist[0]?.symbol ?? '');
	let activePeriod = $state<KlinePeriod>('fs');

	$effect(() => {
		if (data.initialBoard) activeBoardCode = data.initialBoard;
		if (data.initialSymbol) activeSymbol = data.initialSymbol;
	});

	const activeQuote = $derived(watchlist.find((item) => item.symbol === activeSymbol) ?? watchlist[0]);
	const selectedBoard = $derived(boards.find((board) => board.code === activeBoardCode));

	const quoteRows = $derived(
		watchlist.map((item, index) => {
			const turnover = `${(12.8 + index * 4.3).toFixed(1)}亿`;
			return {
				...item,
				turnover,
				amplitude: `${(1.9 + index * 0.56).toFixed(2)}%`
			};
		})
	);

	const activeSnapshot = $derived(
		(() => {
			const quote = activeQuote;
			if (!quote) {
				return {
					open: '--',
					high: '--',
					low: '--',
					pe: '--',
					volume: '--',
					turnoverRate: '--'
				};
			}

			const high = quote.last * 1.012;
			const low = quote.last * 0.988;
			const open = quote.last * (1 - quote.changePct / 100 / 2);

			return {
				open: open.toFixed(2),
				high: high.toFixed(2),
				low: low.toFixed(2),
				pe: (13.5 + quote.changePct * 3.6).toFixed(2),
				volume: `${(4.6 + Math.abs(quote.changePct) * 1.2).toFixed(2)}万手`,
				turnoverRate: `${(3.1 + Math.abs(quote.changePct) * 0.9).toFixed(2)}%`
			};
		})()
	);

	const depthRows = $derived(
		(() => {
			const quote = activeQuote;
			if (!quote) return [];
			return Array.from({ length: 5 }).map((_, idx) => {
				const level = idx + 1;
				const sellPrice = quote.last + (5 - idx) * 0.02;
				const buyPrice = quote.last - (5 - idx) * 0.02;
				return {
					level,
					sellPrice: sellPrice.toFixed(2),
					sellSize: `${(2.1 + idx * 0.5).toFixed(1)}k`,
					buyPrice: buyPrice.toFixed(2),
					buySize: `${(2.4 + idx * 0.4).toFixed(1)}k`
				};
			});
		})()
	);
</script>

<main class="page page-market">
	<section class="container container-wide home-v2039">
		<header class="market-toolbar glass-card home-toolbar">
			<div class="toolbar-left">
				<p class="home-kicker">v2.039 首页还原 · 主看盘</p>
				<div class="toolbar-title">西瓜说股 · 全市场交易台</div>
				<div class="toolbar-sub">09:30-15:00 | 沪深A | 盘口与分时联动</div>
			</div>
			<div class="toolbar-right">
				<span class="toolbar-chip">竞价已结束</span>
				<span class="toolbar-chip">行情源：Mock</span>
				<span class="toolbar-chip">刷新：500ms</span>
			</div>
		</header>

		<section class="home-pulse" aria-label="指数脉冲区">
			{#each marketPulse as pulse}
				<article class="pulse-card glass-card">
					<div class="pulse-label">{pulse.label}</div>
					<div class="pulse-value">{pulse.value}</div>
					<div class={pulse.changePct >= 0 ? 'trend-up' : 'trend-down'}>
						{pulse.changePct >= 0 ? '+' : ''}{pulse.changePct.toFixed(2)}%
					</div>
				</article>
			{/each}
		</section>

		<MarketLayout initialTab={data.initialTab}>
			{#snippet left()}
				<div class="pane-content compact home-pane-left">
					<section>
						<div class="section-headline">
							<h3 class="section-title">热点分块</h3>
							<span class="section-badge">{boards.length}</span>
						</div>
						<div class="stack-list">
							{#each boards as board}
								<button
									type="button"
									class={`market-row market-row-wide ${activeBoardCode === board.code ? 'active' : ''}`}
									onclick={() => (activeBoardCode = board.code)}
								>
									<div>
										<p>{board.name}</p>
										<p class="row-desc">主线热度持续</p>
									</div>
									<div class="align-right">
										<p class={board.changePct >= 0 ? 'trend-up' : 'trend-down'}>
											{board.changePct >= 0 ? '+' : ''}{board.changePct}%
										</p>
										<p class="row-desc">成交活跃</p>
									</div>
								</button>
							{/each}
						</div>
					</section>

					<section>
						<div class="section-headline">
							<h3 class="section-title">自选股池</h3>
							<span class="section-badge">{watchlist.length}</span>
						</div>
						<div class="stack-list">
							{#each watchlist as item}
								<button
									type="button"
									class={`market-row market-row-wide ${activeSymbol === item.symbol ? 'active' : ''}`}
									onclick={() => (activeSymbol = item.symbol)}
								>
									<div>
										<p>{item.name}</p>
										<p class="row-desc">{item.symbol}</p>
									</div>
									<div class="align-right">
										<p>{item.last.toFixed(2)}</p>
										<p class={item.changePct >= 0 ? 'trend-up row-desc' : 'trend-down row-desc'}>
											{item.changePct >= 0 ? '+' : ''}{item.changePct}%
										</p>
									</div>
								</button>
							{/each}
						</div>
					</section>
				</div>
			{/snippet}

			{#snippet center()}
				<div class="pane-content compact home-pane-center">
					<section class="center-topbar">
						<div>
							<h3 class="section-title">实时行情榜</h3>
							<p class="row-desc">按涨跌幅实时排序 · 点击切换右侧图表</p>
						</div>
						<div class="center-tag">盘口联动 ON</div>
					</section>

					<div class="quote-table quote-table-v2039">
						<div class="quote-head quote-head-v2039">
							<span>名称 / 代码</span>
							<span>最新</span>
							<span>涨跌幅</span>
							<span>成交额</span>
						</div>
						{#each quoteRows as item}
							<button
								type="button"
								class={`quote-row quote-row-v2039 ${activeSymbol === item.symbol ? 'active' : ''}`}
								onclick={() => (activeSymbol = item.symbol)}
							>
								<span>
									<strong>{item.name}</strong>
									<small>{item.symbol}</small>
								</span>
								<span>{item.last.toFixed(2)}</span>
								<span class={item.changePct >= 0 ? 'trend-up' : 'trend-down'}>
									{item.changePct >= 0 ? '+' : ''}{item.changePct}%
								</span>
								<span>{item.turnover}</span>
							</button>
						{/each}
					</div>
				</div>
			{/snippet}

			{#snippet right()}
				<div class="pane-content compact home-pane-right">
					<section class="right-summary">
						<div class="kline-symbol">{activeQuote?.name} · {activeSymbol}</div>
						<div class="kline-price-row">
							<strong>{activeQuote?.last.toFixed(2)}</strong>
							<span class={activeQuote && activeQuote.changePct >= 0 ? 'trend-up' : 'trend-down'}>
								{activeQuote && activeQuote.changePct >= 0 ? '+' : ''}{activeQuote?.changePct}%
							</span>
							<span class="row-desc">振幅 {quoteRows.find((row) => row.symbol === activeSymbol)?.amplitude}</span>
						</div>
						<div class="kline-toolbar">
							{#each periodTabs as tab}
								<button
									type="button"
									class={`kline-btn ${activePeriod === tab.key ? 'active' : ''}`}
									onclick={() => (activePeriod = tab.key)}
								>
									{tab.label}
								</button>
							{/each}
						</div>
					</section>

					<div class="kline-shell glass">
						<div class="kline-grid kline-grid-v2039" aria-label="kline skeleton"></div>
						<p class="muted">当前版块：{selectedBoard?.name ?? '--'} · 数据刷新：500ms</p>
					</div>

					<section class="snapshot-grid" aria-label="个股快照">
						<div class="snapshot-item">
							<span>今开</span>
							<strong>{activeSnapshot.open}</strong>
						</div>
						<div class="snapshot-item">
							<span>最高</span>
							<strong>{activeSnapshot.high}</strong>
						</div>
						<div class="snapshot-item">
							<span>最低</span>
							<strong>{activeSnapshot.low}</strong>
						</div>
						<div class="snapshot-item">
							<span>市盈率</span>
							<strong>{activeSnapshot.pe}</strong>
						</div>
						<div class="snapshot-item">
							<span>成交量</span>
							<strong>{activeSnapshot.volume}</strong>
						</div>
						<div class="snapshot-item">
							<span>换手率</span>
							<strong>{activeSnapshot.turnoverRate}</strong>
						</div>
					</section>

					<section class="depth-panel" aria-label="五档盘口">
						<header class="section-headline">
							<h3 class="section-title">五档盘口</h3>
							<span class="section-badge">Level-1</span>
						</header>
						<div class="depth-list">
							{#each depthRows as row}
								<div class="depth-row">
									<span class="trend-down">卖{row.level} {row.sellPrice}</span>
									<span class="muted">{row.sellSize}</span>
									<span class="trend-up">买{row.level} {row.buyPrice}</span>
									<span class="muted">{row.buySize}</span>
								</div>
							{/each}
						</div>
					</section>
				</div>
			{/snippet}
		</MarketLayout>
	</section>
</main>
