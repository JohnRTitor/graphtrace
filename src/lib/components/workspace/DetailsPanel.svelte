<script lang="ts">
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button';
	import { Tooltip, TooltipContent, TooltipProvider } from '$lib/components/ui/tooltip';
	import FloatingPanel from '$lib/components/FloatingPanel.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import InspectorPanel from './InspectorPanel.svelte';
	import MetricsPanel from './MetricsPanel.svelte';
	import LegendPanel from './LegendPanel.svelte';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import ChartNoAxesColumn from '@lucide/svelte/icons/chart-no-axes-column';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import PanelRightOpen from '@lucide/svelte/icons/panel-right-open';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import X from '@lucide/svelte/icons/x';

	type PanelTab = 'inspector' | 'metrics' | 'legend';

	let tab = $state<PanelTab>('inspector');
	let poppedOut = $state<PanelTab | null>(null);
	let floating = $state<ReturnType<typeof FloatingPanel>>();

	let executions = $derived.by(() => {
		const panes = executionStore.paneExecutions;
		return panes.length > 0 ? panes : [];
	});

	const TABS: { id: PanelTab; label: string; icon: typeof SlidersHorizontal }[] = [
		{ id: 'inspector', label: 'Inspector', icon: SlidersHorizontal },
		{ id: 'metrics', label: 'Metrics', icon: ChartNoAxesColumn },
		{ id: 'legend', label: 'Legend', icon: BookOpen }
	];
</script>

{#snippet panelContent(which: PanelTab)}
	{#if which === 'inspector'}
		<InspectorPanel />
	{:else if which === 'metrics'}
		<MetricsPanel {executions} />
	{:else}
		<LegendPanel />
	{/if}
{/snippet}

<TooltipProvider delayDuration={300}>
	<div class="flex h-full min-h-0 flex-col">
		<Tabs bind:value={tab} class="flex h-full min-h-0 flex-col gap-0">
			<!--
				The extra right padding below `xl` clears the sheet's own close button,
				which is absolutely positioned in the same corner. CSS rather than state:
				the panel is docked at `xl` and in a sheet below it, and that split is
				already expressed by a breakpoint.
			-->
			<div class="flex items-center gap-1 border-b py-1.5 pr-11 xl:pr-2">
				<!--
					`min-w-0` and `truncate` throughout: three labelled tabs plus the
					pop-out button do not fit a 288px column exactly, and a tab bar that
					clips is worse than one whose longest label truncates. The labels are
					`sr-only` below `sm` so the bar is icons-only on a phone, where the
					sheet is the panel and the width is not the constraint.
				-->
				<TabsList class="min-w-0 flex-1 bg-transparent p-0">
					{#each TABS as entry (entry.id)}
						<!--
							Tooltiped because the label is only visible from `xl`: below
							that the bar is icons, and an unlabelled icon that is the only
							way to reach the metrics table is a dead end on a tablet.
						-->
						<Tooltip>
							<TabsTrigger
								value={entry.id}
								class="h-11 min-w-0 flex-1 truncate px-1.5 text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground sm:h-9"
							>
								<entry.icon class="h-3.5 w-3.5 shrink-0" />
								<span class="sr-only xl:not-sr-only">{entry.label}</span>
							</TabsTrigger>
							<TooltipContent side="bottom">{entry.label}</TooltipContent>
						</Tooltip>
					{/each}
				</TabsList>

				<!--
					Drag-to-position is a pointer idiom with no touch equivalent, and the
					panel it would detach is already the default presentation on a phone.
					Hidden below `lg` rather than disabled.
				-->
				<Tooltip>
					<Button
						variant="ghost"
						size="icon"
						class="hidden size-9 shrink-0 xl:inline-flex"
						onclick={() => (poppedOut = tab)}
						aria-label={`Pop ${tab} out into a floating window`}
					>
						<PanelRightOpen class="h-3.5 w-3.5" />
					</Button>
					<TooltipContent side="bottom">Pop this tab out into a floating window</TooltipContent>
				</Tooltip>
			</div>

			{#each TABS as entry (entry.id)}
				<TabsContent value={entry.id} class="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
					{@render panelContent(entry.id)}
				</TabsContent>
			{/each}
		</Tabs>
	</div>
</TooltipProvider>

<!--
	The pop-out is opt-in per tab and the default is the single docked panel.
	Two competing spatial paradigms in one screen is what this replaced: a fixed
	aside and a separately draggable, position-persisting overlay.
-->
{#if poppedOut}
	<FloatingPanel id={`graphtrace-${poppedOut}`} bind:this={floating}>
		{#snippet header()}
			<div class="flex items-center justify-between gap-2 px-3 py-2">
				<span class="text-xs font-semibold">
					{TABS.find((entry) => entry.id === poppedOut)?.label}
				</span>
				<div class="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon-sm"
						class="size-7"
						onpointerdown={(event) => event.stopPropagation()}
						onclick={() => floating?.resetPosition()}
						aria-label="Reset position"
					>
						<RotateCcw class="h-3 w-3" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						class="size-7"
						onpointerdown={(event) => event.stopPropagation()}
						onclick={() => (poppedOut = null)}
						aria-label="Dock back"
					>
						<X class="h-3 w-3" />
					</Button>
				</div>
			</div>
		{/snippet}
		<div class="max-h-[70dvh] w-full overflow-y-auto">
			{@render panelContent(poppedOut)}
		</div>
	</FloatingPanel>
{/if}
