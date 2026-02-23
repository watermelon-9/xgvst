<script lang="ts">
	let { params } = $props();
</script>

<main class="page">
	<div class="container max-w-[900px]">
		<header class="topbar">
			<h1 class="title">个股详情：{params.symbol}</h1>
			<a href="/market" class="back-link">返回市场页</a>
		</header>

		<section class="panel mt-4 p-5">
			<p class="subtitle m-0">
				P1.1 仅完成详情页路由骨架。后续阶段将接入分时/K线、MA/VOL/VAR7 与实时订阅。
			</p>
		</section>
	</div>
</main>
