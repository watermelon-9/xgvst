<script lang="ts">
	import 'uno.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>西瓜说股 v3.0</title>
</svelte:head>

{@render children()}