<script lang="ts">
	import 'virtual:uno.css';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="description" content="西瓜说股 v3.0：市场总览与个股详情原型。" />
	<title>西瓜说股 v3.0</title>
</svelte:head>

{@render children()}