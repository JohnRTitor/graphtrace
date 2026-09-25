<script lang="ts">
	import { environmentState } from '$lib/state/environment.svelte';
	import MazeCanvas from '$lib/rendering/konva/MazeCanvas.svelte';
	import GraphEditor from '$lib/rendering/svelte-flow/GraphEditor.svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { playbackState, type PlaybackState } from '$lib/state/playback.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';

	let { playback = playbackState } = $props<{ playback?: PlaybackState }>();
</script>

<div class={`relative h-full w-full overflow-hidden bg-muted/20 ${executionStore.isComparing ? 'pointer-events-none' : ''}`}>
	{#if environmentState.environmentType === 'graph'}
		{#key 'graph'}
			<SvelteFlowProvider>
				<GraphEditor {playback} />
			</SvelteFlowProvider>
		{/key}
	{:else}
		{#key 'maze'}
			<MazeCanvas {playback} />
		{/key}
	{/if}
</div>
