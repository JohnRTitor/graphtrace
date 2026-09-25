<script lang="ts">
	import { editorState } from '$lib/state/editor.svelte';
	import { environmentState } from '$lib/state/environment.svelte';
	import { playbackState } from '$lib/state/playback.svelte';
	import type { TraceStateToken } from '$lib/families/types';
	import type { GameTreeTraceState } from '$lib/families/adversarial/tree-state';
	import { Separator } from '$lib/components/ui/separator';

	/**
	 * The "at this step" readout, split out of `InspectorPanel` on purpose.
	 *
	 * This is the only part of the inspector that depends on the trace state, and
	 * the trace state changes on every playback step. Keeping it in the same
	 * component as the family schema meant the schema's thunks - including the
	 * walkable-cell count, which walks the whole grid - were re-evaluated on every
	 * step of playback. Isolating the dependency here means advancing a step
	 * re-renders this handful of rows and nothing else.
	 */

	let selectedId = $derived(
		editorState.selection ? editorState.selection.id : null
	);
	let pathfinding = $derived(playbackState.pathfindingState);
	let tree = $derived(playbackState.gameTreeState);

	let cellState = $derived(
		pathfinding && selectedId ? pathfinding.cellStates.get(selectedId) : undefined
	);
	let cost = $derived(
		pathfinding && selectedId ? pathfinding.costData.get(selectedId) : undefined
	);
	let nodeValue = $derived(
		tree && selectedId !== null ? tree.values.get(selectedId) : undefined
	);
	let window_ = $derived(
		tree && selectedId !== null ? tree.bounds.get(selectedId) : undefined
	);
	let isPruned = $derived(
		tree && selectedId !== null ? tree.pruned.has(selectedId) : false
	);

	/**
	 * The reserved colour for a cell's trace state.
	 *
	 * The same mapping the timeline uses, so a cell that is `discovered` in the
	 * canvas is the same blue in the inspector as in the scrubber.
	 */
	function tokenFor(state: string): TraceStateToken {
		switch (state) {
			case 'discovered':
				return 'frontier';
			case 'expanded':
				return 'visited';
			case 'path':
				return 'path';
			default:
				return 'current';
		}
	}

	function finite(value: number | undefined): string {
		if (value === undefined) return '—';
		return Number.isFinite(value) ? String(value) : '∞';
	}

	function alphaBeta(bounds: { alpha: number; beta: number } | undefined): string {
		if (!bounds) return '—';
		const show = (value: number) => (Number.isFinite(value) ? String(value) : '∞');
		return `${show(bounds.alpha)} / ${show(bounds.beta)}`;
	}
</script>

{#if cellState || cost}
	<Separator />
	<div class="space-y-2">
		<h3 class="text-xs font-medium">At this step</h3>
		<dl class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-xs">
			{#if cellState}
				<dt class="text-muted-foreground">state</dt>
				<dd class="flex items-center gap-1.5">
					<span
						class="gt-trace-swatch"
						style:background-color={`var(--trace-${tokenFor(cellState)})`}
					></span>
					{cellState}
				</dd>
			{/if}
			{#if cost?.g !== undefined}
				<dt class="text-muted-foreground">g</dt>
				<dd class="gt-mono">{finite(cost.g)}</dd>
			{/if}
			{#if cost?.f !== undefined}
				<dt class="text-muted-foreground">f</dt>
				<dd class="gt-mono">{finite(cost.f)}</dd>
			{/if}
		</dl>
	</div>
{:else if nodeValue !== undefined || isPruned}
	<Separator />
	<div class="space-y-2">
		<h3 class="text-xs font-medium">At this step</h3>
		<dl class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-xs">
			<dt class="text-muted-foreground">value</dt>
			<dd class="gt-mono">
				{#if isPruned}<span class="text-muted-foreground">pruned</span>{:else}{nodeValue}{/if}
			</dd>
			{#if window_}
				<dt class="text-muted-foreground">α / β</dt>
				<dd class="gt-mono">{alphaBeta(window_)}</dd>
			{/if}
		</dl>
	</div>
{/if}
