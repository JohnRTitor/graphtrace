<script lang="ts">
	import { environmentState } from '$lib/state/environment.svelte';
	import { playbackState, type PlaybackState } from '$lib/state/playback.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import { rendererFor } from '$lib/families/renderers';
	import { SvelteFlowProvider } from '@xyflow/svelte';

	let { playback = playbackState } = $props<{ playback?: PlaybackState }>();

	/**
	 * The renderer is chosen by family, not by environment type. This is the one
	 * place the dispatch happens; everything downstream - the toolbar, the
	 * inspector, the metrics table - reads the family registry instead of
	 * switching on a type string.
	 */
	let familyId = $derived(playback.familyId ?? environmentState.familyId);
	let Renderer = $derived(rendererFor(familyId));
</script>

<div class={`relative h-full w-full ${executionStore.isComparing ? 'pointer-events-none' : ''}`}>
	{#if Renderer}
		<!--
			Re-keyed on the family so a canvas belonging to the previous family is
			torn down completely. The comparison grid mounts one of these per pane, so
			the key also keeps each pane's canvas independent.
		-->
		{#key familyId}
			<SvelteFlowProvider>
				<Renderer {playback} />
			</SvelteFlowProvider>
		{/key}
	{/if}
</div>
