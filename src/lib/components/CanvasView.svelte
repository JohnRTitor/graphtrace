<script lang="ts">
	import { environmentState } from '$lib/state/environment.svelte';
	import MazeCanvas from '$lib/rendering/konva/MazeCanvas.svelte';
	import GraphEditor from '$lib/rendering/svelte-flow/GraphEditor.svelte';
</script>

<div class="relative h-full w-full overflow-hidden bg-muted/20">
	{#if environmentState.environmentType === 'graph'}
		{#key 'graph'}
			<GraphEditor />
		{/key}
	{:else}
		{#key 'maze'}
			<MazeCanvas />
		{/key}
	{/if}
</div>
