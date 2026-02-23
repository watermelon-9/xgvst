<script lang="ts">
	let { params } = $props();
</script>

<main class="min-h-screen bg-bgPurple text-white p-6">
	<div class="mx-auto max-w-4xl space-y-6">
		<header class="flex items-center justify-between">
			<h1 class="text-2xl font-bold">个股详情：{params.symbol}</h1>
			<a href="/market" class="text-sm text-white/70 hover:text-white">返回市场页</a>
		</header>

		<section class="rounded-xl bg-white/10 p-6">
			<p class="text-white/80">P1.1 仅完成详情页路由骨架。后续阶段将接入分时/K线、MA/VOL/VAR7 与实时订阅。</p>
		</section>
	</div>
</main>