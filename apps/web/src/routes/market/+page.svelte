<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchUniverse } from '$lib/api/client';
	import { marketState, getTopBoardName } from '$lib/runes/market-state.svelte';

	onMount(async () => {
		const data = await fetchUniverse();
		marketState.boards = data.boards;
		marketState.watchlist = data.watchlist;
		marketState.activeBoardCode = data.boards[0]?.code ?? '';
		marketState.activeSymbol = data.watchlist[0]?.symbol ?? '';
	});
</script>

<main class="min-h-screen bg-bgPurple text-white p-6">
	<div class="mx-auto max-w-6xl space-y-6">
		<header class="flex items-center justify-between">
			<h1 class="text-2xl font-bold">市场总览（Mock）</h1>
			<a href="/" class="text-sm text-white/70 hover:text-white">返回首页</a>
		</header>

		<section class="grid gap-4 md:grid-cols-2">
			<div class="rounded-xl bg-white/10 p-4">
				<h2 class="mb-3 font-semibold">版块</h2>
				<div class="space-y-2">
					{#each marketState.boards as board}
						<button
							type="button"
							class={`w-full rounded-lg px-3 py-2 text-left transition ${marketState.activeBoardCode === board.code ? 'bg-white/20' : 'bg-white/5'}`}
							onclick={() => (marketState.activeBoardCode = board.code)}
						>
							<div class="flex items-center justify-between">
								<span>{board.name}</span>
								<span class={board.changePct >= 0 ? 'text-up' : 'text-down'}>{board.changePct}%</span>
							</div>
						</button>
					{/each}
				</div>
			</div>

			<div class="rounded-xl bg-white/10 p-4">
				<h2 class="mb-3 font-semibold">自选</h2>
				<div class="space-y-2">
					{#each marketState.watchlist as item}
						<a
							href={`/detail/${item.symbol}`}
							class="block rounded-lg bg-white/5 px-3 py-2 hover:bg-white/15 transition"
							onmouseenter={() => (marketState.activeSymbol = item.symbol)}
						>
							<div class="flex items-center justify-between">
								<div>
									<div>{item.name}</div>
									<div class="text-xs text-white/60">{item.symbol}</div>
								</div>
								<div class="text-right">
									<div>{item.last}</div>
									<div class={item.changePct >= 0 ? 'text-up text-xs' : 'text-down text-xs'}>{item.changePct}%</div>
								</div>
							</div>
						</a>
					{/each}
				</div>
			</div>
		</section>

		<footer class="text-sm text-white/70">
			当前版块：{getTopBoardName() || '未选择'} ｜ 当前个股：{marketState.activeSymbol || '未选择'}
		</footer>
	</div>
</main>