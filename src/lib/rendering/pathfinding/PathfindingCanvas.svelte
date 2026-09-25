<script lang="ts">
	import { environmentState } from '$lib/state/environment.svelte';
	import { playbackState, type PlaybackState } from '$lib/state/playback.svelte';
	import MazeCanvas from '$lib/rendering/konva/MazeCanvas.svelte';
	import GraphEditor from '$lib/rendering/svelte-flow/GraphEditor.svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';

	let { playback = playbackState } = $props<{ playback?: PlaybackState }>();

	// Within the pathfinding family the environment type picks the surface: a cell
	// grid drawn with Konva, or a node-edge graph drawn with SvelteFlow.
</script>

<div class="relative h-full w-full">
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
