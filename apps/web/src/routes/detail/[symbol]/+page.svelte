<script lang="ts">
	let { params } = $props();
</script>

<main class="page">
	<div class="container container-narrow">
		<header class="topbar">
			<h1 class="title">个股详情：{params.symbol}</h1>
			<a href="/detail" class="back-link">返回详情索引</a>
		</header>

		<section class="panel panel-spaced">
			<p class="subtitle subtitle-tight">
				P1.1 仅完成详情页路由骨架。后续阶段将接入分时/K线、MA/VOL/VAR7 与实时订阅。
			</p>
		</section>
	</div>
</main>
