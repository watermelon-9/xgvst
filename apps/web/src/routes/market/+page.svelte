<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchUniverse, useQuoteWebSocket, type QuoteTick } from '$lib/api';
	import { marketState, getTopBoardName } from '$lib/runes/market-state.svelte';

	const sampleSymbols = ['000001', '600519'];
	const quoteSocket = useQuoteWebSocket();

	let latestTick = $state<QuoteTick | null>(null);
	let latestSource = $state<string>('—');
	let latestTickBySymbol = $state<Record<string, QuoteTick | undefined>>({});
	let tickTransportCounter = $state<Record<QuoteTick['transport'], number>>({
		'ws-binary': 0,
		'ws-protobuf': 0,
		'ws-json-fallback': 0
	});
	let latestTickDataType = $state<string>('none');

	const tickRenderChain = 'WS frame(binary/json fallback) → QuoteTick(type-guard) → latestTickBySymbol → 面板渲染';

	function isRenderableTick(tick: QuoteTick): boolean {
		return (
			typeof tick.symbol === 'string' &&
			typeof tick.source === 'string' &&
			typeof tick.ts === 'string' &&
			typeof tick.price === 'number' &&
			Number.isFinite(tick.price) &&
			typeof tick.changePct === 'number' &&
			Number.isFinite(tick.changePct)
		);
	}

	onMount(() => {
		const detach = quoteSocket.onTick((tick) => {
			if (!sampleSymbols.includes(tick.symbol)) return;
			if (!isRenderableTick(tick)) return;

			latestTick = tick;
			latestSource = tick.source;
			latestTickBySymbol[tick.symbol] = tick;
			tickTransportCounter[tick.transport] += 1;
			latestTickDataType = `${typeof tick.price}/${typeof tick.changePct}/${typeof tick.symbol}`;
		});

		void (async () => {
			const data = await fetchUniverse();
			marketState.boards = data.boards;
			marketState.watchlist = data.watchlist;
			marketState.activeBoardCode = data.boards[0]?.code ?? '';
			marketState.activeSymbol = data.watchlist[0]?.symbol ?? '';
		})();

		quoteSocket.connect();
		quoteSocket.subscribe(sampleSymbols);

		return () => {
			detach();
			quoteSocket.unsubscribe(sampleSymbols);
			quoteSocket.close();
		};
	});
</script>

<main class="page">
	<div class="container">
		<header class="topbar">
			<h1 class="title">市场总览</h1>
			<a href="/" class="back-link">返回首页</a>
		</header>

		<section class="panel-grid">
			<div class="panel">
				<h2>版块</h2>
				<div class="list">
					{#each marketState.boards as board}
						<button
							type="button"
							class={`row-btn ${marketState.activeBoardCode === board.code ? 'active' : ''}`}
							onclick={() => (marketState.activeBoardCode = board.code)}
						>
							<div class="row-between">
								<span>{board.name}</span>
								<span class={board.changePct >= 0 ? 'up' : 'down'}>{board.changePct}%</span>
							</div>
						</button>
					{/each}
				</div>
			</div>

			<div class="panel">
				<h2>自选</h2>
				<div class="list">
					{#each marketState.watchlist as item}
						<a
							href={`/detail/${item.symbol}`}
							class="row-link"
							onmouseenter={() => (marketState.activeSymbol = item.symbol)}
						>
							<div class="row-between">
								<div>
									<div>{item.name}</div>
									<div class="muted">{item.symbol}</div>
								</div>
								<div class="align-right">
									<div>{item.last}</div>
									<div class={item.changePct >= 0 ? 'up muted' : 'down muted'}>{item.changePct}%</div>
								</div>
							</div>
						</a>
					{/each}
				</div>
			</div>

			<div class="panel">
				<h2>实时 Tick（WS）</h2>
				<div class="list">
					{#each sampleSymbols as symbol}
						<div class="row-link">
							<div class="row-between">
								<div>
									<div>{symbol}</div>
									<div class="muted">
										{latestTickBySymbol[symbol]?.source ?? 'waiting...'}
										{#if latestTickBySymbol[symbol]}
											({latestTickBySymbol[symbol]?.transport})
										{/if}
									</div>
								</div>
								<div class="align-right">
									<div>{latestTickBySymbol[symbol]?.price ?? '--'}</div>
									<div
										class={
											(latestTickBySymbol[symbol]?.changePct ?? 0) >= 0 ? 'up muted' : 'down muted'
										}
									>
										{latestTickBySymbol[symbol]?.changePct ?? '--'}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<footer class="footer">
			当前版块：{getTopBoardName() || '未选择'} ｜ 当前个股：{marketState.activeSymbol || '未选择'} ｜
			最新 WS Tick：{latestTick?.symbol ?? '--'} @{latestSource}
			<br />
			链路：{tickRenderChain}
			<br />
			类型校验：{latestTickDataType}
			<br />
			JSON tick 残留：{tickTransportCounter['ws-json-fallback'] === 0
				? '未检测到'
				: `检测到 ${tickTransportCounter['ws-json-fallback']} 条（仅兼容兜底）`}
		</footer>
	</div>
</main>
