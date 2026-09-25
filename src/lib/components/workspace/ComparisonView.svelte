<script lang="ts">
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { playbackState, comparePlaybackStates } from '$lib/state/playback.svelte';
	import { executionStore, MAX_COMPARISON_PANES } from '$lib/state/execution-store.svelte';
	import { rendererFor } from '$lib/families/renderers';
	import { getAlgorithmSummary } from '$lib/algorithms';
	import { getFamily } from '$lib/families/registry';
	import type { AnyExecution } from '$lib/domain/execution';
	import { Button } from '$lib/components/ui/button';
	import { kindToTraceToken } from '$lib/trace/timeline';
	import { nextStepOfKind } from '$lib/trace/types';
	import Grid2x2 from '@lucide/svelte/icons/grid-2x2';
	import Columns2 from '@lucide/svelte/icons/columns-2';
	import Rows2 from '@lucide/svelte/icons/rows-2';
	import X from '@lucide/svelte/icons/x';

	/**
	 * The comparison view.
	 *
	 * Generalised from a hard-coded two panes to 2-4, auto-arranged in a grid.
	 * The layout is a function of the pane count, so adding a third or fourth
	 * algorithm needs no markup change - and because each pane is a
	 * `(execution, family)` pair resolved through the registry, the view works
	 * across families: minimax against alpha-beta on one tree, or BFS against A*
	 * on one grid.
	 */
	type Layout = 'auto' | 'columns' | 'rows';

	let layout = $state<Layout>('auto');
	let paneExecutions = $derived(executionStore.paneExecutions);

	/** The playback state for pane `index`; pane 0 is the active pane. */
	function playbackFor(index: number) {
		return index === 0 ? playbackState : comparePlaybackStates[index - 1];
	}

	function rendererForPane(execution: AnyExecution) {
		return rendererFor(execution.familyId);
	}

	function algorithmLabel(execution: AnyExecution): string {
		return getAlgorithmSummary(execution.algorithmId)?.name ?? execution.algorithmId;
	}

	function familyLabel(execution: AnyExecution): string {
		return getFamily(execution.familyId)?.name ?? execution.familyId;
	}

	/**
	 * Grid arrangement for N panes: one row for two, 2x2 for three and four.
	 * Chosen so no pane is ever a thin sliver, which is the failure mode of
	 * laying four panes out in a single row.
	 */
	let gridClass = $derived.by(() => {
		const count = paneExecutions.length;
		if (count <= 1) return 'grid-cols-1';
		if (layout === 'columns') return 'grid-cols-1 sm:grid-cols-2';
		if (layout === 'rows') return 'grid-cols-1';
		if (count === 2) return 'grid-cols-1 md:grid-cols-2';
		return 'grid-cols-1 md:grid-cols-2';
	});

	/** Per-pane headline metric, so a pane is readable without the metrics tab. */
	function headline(execution: AnyExecution): { label: string; value: string } {
		const metrics = execution.metrics;
		if (execution.familyId === 'adversarial') {
			const rate = typeof metrics.pruneRate === 'number' ? metrics.pruneRate : 0;
			return { label: 'pruned', value: `${metrics.nodesPruned ?? 0} (${rate.toFixed(0)}%)` };
		}
		return {
			label: 'expanded',
			value: String(metrics.nodesExpanded ?? 0)
		};
	}

	function closePane(index: number) {
		const execution = paneExecutions[index];
		if (!execution) return;
		if (index === 0) {
			// Dismissing the active pane promotes the first comparison pane, so the
			// view never collapses to nothing while other panes remain.
			const next = paneExecutions[1];
			executionStore.activeId = next?.id ?? null;
			executionStore.compareIds = paneExecutions.slice(2).map((entry) => entry.id);
		} else {
			executionStore.compareIds = paneExecutions.filter((_, i) => i !== index).map((e) => e.id);
		}
	}

	/**
	 * The step each pane is on, and what it is doing there.
	 *
	 * This is the whole comparison in one line per pane: two algorithms on the
	 * same tree sit at different steps on purpose, and seeing *why* - one is on a
	 * `visit` while the other is already on a `backup` - is what makes the saving
	 * legible.
	 */
	function stepLabel(state: typeof playbackState): { kind: string; token: string; at: string } {
		const kind = state.currentKind ?? '—';
		return {
			kind,
			token: kindToTraceToken(kind),
			at: `${state.currentStep}/${state.totalSteps}`
		};
	}
</script>

<div class="flex h-full w-full flex-col">
	<div class="flex flex-1 flex-col overflow-hidden pb-44 sm:pb-40">
		<div class="flex items-center gap-2 border-b bg-card px-2 py-1.5">
			<span class="text-xs font-medium text-muted-foreground">
				Comparing {paneExecutions.length} of {MAX_COMPARISON_PANES} panes
			</span>
			<div class="flex-1"></div>
			<div class="flex items-center gap-0.5" role="group" aria-label="Pane arrangement">
				{#each [{ id: 'auto', icon: Grid2x2, label: 'Auto grid' }, { id: 'columns', icon: Columns2, label: 'Columns' }, { id: 'rows', icon: Rows2, label: 'Rows' }] as option (option.id)}
					<button
						type="button"
						class="rounded-md p-1.5 gt-transition-feedback"
						class:bg-accent={layout === option.id}
						class:text-accent-foreground={layout === option.id}
						class:text-muted-foreground={layout !== option.id}
						onclick={() => (layout = option.id as Layout)}
						title={option.label}
						aria-label={option.label}
						aria-pressed={layout === option.id}
					>
						<option.icon class="h-3.5 w-3.5" />
					</button>
				{/each}
			</div>
		</div>

		<div class="grid min-h-0 flex-1 {gridClass}">
			{#each paneExecutions as execution, index (execution.id)}
				{@const Renderer = rendererForPane(execution)}
				{@const state = playbackFor(index)}
				{@const head = headline(execution)}
				{@const step = stepLabel(state)}
				<div class="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-b md:border-r">
					<div class="absolute left-2 top-2 z-20 flex items-center gap-2 rounded-md border bg-background/90 px-2 py-1 backdrop-blur-sm gt-transition-state">
						<span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
							{index + 1}
						</span>
						<span class="text-xs font-medium">{algorithmLabel(execution)}</span>
						<span class="text-[10px] text-muted-foreground">{familyLabel(execution)}</span>
						<span class="gt-mono border-l pl-2 text-[10px] text-muted-foreground">
							{head.label} {head.value}
						</span>
						<button
							type="button"
							class="rounded p-0.5 text-muted-foreground gt-transition-feedback hover:bg-accent hover:text-foreground"
							onclick={() => closePane(index)}
							title="Close pane"
							aria-label={`Close pane ${index + 1}`}
						>
							<X class="h-3 w-3" />
						</button>
					</div>

					{#if Renderer}
						<SvelteFlowProvider>
							<Renderer playback={state} />
						</SvelteFlowProvider>
					{/if}

					<div class="pointer-events-none absolute bottom-2 left-2 z-20 flex items-center gap-1.5 rounded-md border bg-background/90 px-2 py-1 backdrop-blur-sm gt-transition-state">
						<span
							class="gt-trace-swatch !h-2 !w-2"
							style:background-color={step.token === 'neutral'
								? 'var(--muted-foreground)'
								: `var(--trace-${step.token})`}
						></span>
						<span class="gt-mono text-[10px] text-muted-foreground">{step.kind}</span>
						<span class="gt-mono border-l pl-1.5 text-[10px] text-muted-foreground">{step.at}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
