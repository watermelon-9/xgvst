<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchUniverse } from '$lib/api';
	import { marketState } from '$lib/runes/market-state.svelte';
	import { quoteStore, mountQuoteStore, setQuoteSubscriptionScope } from '$lib/runes/quote-store.svelte';

	let { params } = $props();

	onMount(() => {
		const unmountQuoteStore = mountQuoteStore();

		void (async () => {
			if (marketState.watchlist.length > 0) return;
			const data = await fetchUniverse();
			marketState.watchlist = data.watchlist;
		})();

		return () => {
			unmountQuoteStore();
		};
	});

	$effect(() => {
		marketState.activeSymbol = params.symbol;
		setQuoteSubscriptionScope({
			activeSymbol: params.symbol,
			watchlistSymbols: marketState.watchlist.map((item) => item.symbol)
		});
	});
</script>

<main class="page">
	<div class="container container-narrow">
		<header class="topbar">
			<h1 class="title">个股详情：{params.symbol}</h1>
			<a href="/market" class="back-link">返回市场页</a>
		</header>

		<section class="panel panel-spaced">
			<p class="subtitle subtitle-tight">已接入 quoteStore（Svelte5 runes）+ 按需订阅链路。</p>
			<p class="subtitle subtitle-tight">
				当前订阅：{quoteStore.subscribedSymbols.join(', ') || '--'}（切换 symbol 会触发精准重订阅）
			</p>
			<p class="subtitle subtitle-tight">重订阅次数：{quoteStore.resubscribeCount}</p>
		</section>

		<section class="panel panel-spaced">
			<h2>当前 symbol 实时 Tick</h2>
			<div class="list">
				<div class="row-link">
					<div class="row-between">
						<div>连接状态</div>
						<div class="muted">{quoteStore.socketStats.status}</div>
					</div>
				</div>
				<div class="row-link">
					<div class="row-between">
						<div>价格</div>
						<div>{quoteStore.latestTickBySymbol[params.symbol]?.price ?? '--'}</div>
					</div>
				</div>
				<div class="row-link">
					<div class="row-between">
						<div>涨跌幅</div>
						<div
							class={
								(quoteStore.latestTickBySymbol[params.symbol]?.changePct ?? 0) >= 0
									? 'up'
									: 'down'
							}
						>
							{quoteStore.latestTickBySymbol[params.symbol]?.changePct ?? '--'}
						</div>
					</div>
				</div>
			</div>
		</section>

		{#if marketState.watchlist.length > 0}
			<section class="panel panel-spaced">
				<h2>快速切换（验证精准重订阅）</h2>
				<div class="card-grid card-grid-spaced">
					{#each marketState.watchlist as item}
						<a class="card" href={`/detail/${item.symbol}`}>
							<h3>{item.name}（{item.symbol}）</h3>
							<p>点击切换 symbol，订阅列表会更新为「当前个股+自选」</p>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</main>
