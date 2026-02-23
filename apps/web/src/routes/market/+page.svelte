<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchUniverse } from '$lib/api';
	import { marketState, getTopBoardName } from '$lib/runes/market-state.svelte';

	onMount(async () => {
		const data = await fetchUniverse();
		marketState.boards = data.boards;
		marketState.watchlist = data.watchlist;
		marketState.activeBoardCode = data.boards[0]?.code ?? '';
		marketState.activeSymbol = data.watchlist[0]?.symbol ?? '';
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
		</section>

		<footer class="footer">
			当前版块：{getTopBoardName() || '未选择'} ｜ 当前个股：{marketState.activeSymbol || '未选择'}
		</footer>
	</div>
</main>
