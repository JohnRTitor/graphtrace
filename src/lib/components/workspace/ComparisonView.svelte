<script lang="ts">
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { playbackState, comparePlaybackStates } from '$lib/state/playback.svelte';
	import { executionStore, MAX_COMPARISON_PANES } from '$lib/state/execution-store.svelte';
	import { rendererFor } from '$lib/families/renderers';
	import { getAlgorithmSummary } from '$lib/algorithms';
	import { getFamily } from '$lib/families/registry';
	import type { AnyExecution } from '$lib/domain/execution';
	import { Button } from '$lib/components/ui/button';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '$lib/components/ui/empty';
	import { Tooltip, TooltipContent, TooltipProvider } from '$lib/components/ui/tooltip';
	import { kindToTraceToken } from '$lib/trace/timeline';
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

	const LAYOUTS: { id: Layout; icon: typeof Grid2x2; label: string }[] = [
		{ id: 'auto', icon: Grid2x2, label: 'Auto grid' },
		{ id: 'columns', icon: Columns2, label: 'Two columns' },
		{ id: 'rows', icon: Rows2, label: 'Two rows' }
	];

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
	 * Pane arrangement above `md`: one row for two, 2x2 for three and four.
	 * Chosen so no pane is ever a thin sliver, which is the failure mode of
	 * laying four panes out in a single row.
	 */
	let gridClass = $derived.by(() => {
		const count = paneExecutions.length;
		if (count <= 1) return 'grid-cols-1';
		if (layout === 'rows') return 'grid-cols-2 grid-rows-2';
		return 'grid-cols-2';
	});

	/**
	 * Below `md` the panes page instead of stacking.
	 *
	 * A phone has one pane's worth of width, and the canvas is roughly 545px tall
	 * once the transport has its share - so four stacked panes are 136px each and
	 * none of them is a graph. A horizontal snap scroller gives each pane the
	 * whole viewport, which is the only arrangement in which a comparison is
	 * legible on a phone at all.
	 */
	const PANE_SCROLLER = 'gt-scroll-x flex snap-x snap-mandatory md:grid md:snap-none';
	const PANE = 'relative flex min-h-0 w-[88vw] shrink-0 snap-center flex-col overflow-hidden md:w-auto md:shrink';

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

<TooltipProvider delayDuration={300}>
	<div class="flex h-full w-full flex-col">
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div class="flex items-center gap-2 border-b bg-card px-2 py-1.5">
				<span class="truncate text-xs font-medium text-muted-foreground">
					Comparing {paneExecutions.length} of {MAX_COMPARISON_PANES} panes
				</span>
				<div class="flex-1"></div>
				<!-- Arranging zero panes is not a decision, so the control waits for one. -->
				<ToggleGroup
					type="single"
					value={layout}
					onValueChange={(value) => {
						if (value) layout = value as Layout;
					}}
					variant="outline"
					aria-label="Pane arrangement"
					class="shrink-0 {paneExecutions.length === 0 ? 'hidden' : ''}"
				>
					{#each LAYOUTS as option (option.id)}
						<Tooltip>
							<ToggleGroupItem
								value={option.id}
								aria-label={option.label}
								class="size-8"
							>
								<option.icon class="h-3.5 w-3.5" />
							</ToggleGroupItem>
							<TooltipContent side="bottom">{option.label}</TooltipContent>
						</Tooltip>
					{/each}
				</ToggleGroup>
			</div>

			{#if paneExecutions.length === 0}
				<Empty class="h-full">
					<EmptyHeader>
						<EmptyTitle class="text-xs font-medium text-foreground">No panes yet</EmptyTitle>
						<EmptyDescription class="text-xs">
							Run an algorithm to fill this pane. Each pane holds one algorithm's trace,
							and the transport below drives every open pane at once.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			{:else}
			<div class="{PANE_SCROLLER} min-h-0 flex-1 {gridClass}">
				{#each paneExecutions as execution, index (execution.id)}
					{@const Renderer = rendererForPane(execution)}
					{@const state = playbackFor(index)}
					{@const head = headline(execution)}
					{@const step = stepLabel(state)}
					<div class="{PANE} md:border-r">
						<div class="absolute left-2 top-2 z-20 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-md border bg-background/90 px-2 py-1 backdrop-blur-sm gt-transition-state">
							<span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
								{index + 1}
							</span>
							<span class="truncate text-xs font-medium">{algorithmLabel(execution)}</span>
							<span class="hidden text-[10px] text-muted-foreground sm:inline">
								{familyLabel(execution)}
							</span>
							<span class="gt-mono hidden border-l pl-2 text-[10px] text-muted-foreground sm:inline">
								{head.label} {head.value}
							</span>
							<Button
								variant="ghost"
								size="icon-xs"
								class="size-7 shrink-0"
								onclick={() => closePane(index)}
								aria-label={`Close pane ${index + 1}`}
							>
								<X class="h-3.5 w-3.5" />
							</Button>
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
							<span class="gt-mono border-l pl-1.5 text-[10px] text-muted-foreground">
								{step.at}
							</span>
						</div>
					</div>
				{/each}
			</div>
			{/if}
		</div>
	</div>
</TooltipProvider>
