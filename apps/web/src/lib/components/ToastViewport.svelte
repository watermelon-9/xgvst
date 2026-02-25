<script lang="ts">
	import { useToast } from '$lib/ui/toast.svelte';

	const toast = useToast();
</script>

<section class="toast-viewport" aria-live="polite" aria-label="系统提示">
	{#each toast.state.items as item (item.id)}
		<div class={`toast-item toast-${item.tone}`} role="status">
			<span>{item.message}</span>
			<button type="button" class="toast-close" onclick={() => toast.remove(item.id)} aria-label="关闭提示">
				×
			</button>
		</div>
	{/each}
</section>
