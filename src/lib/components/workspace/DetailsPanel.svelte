<script lang="ts">
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import FloatingPanel from '$lib/components/FloatingPanel.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import type { AnyExecution } from '$lib/domain/execution';
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

<div class="flex h-full flex-col">
	<Tabs bind:value={tab} class="flex h-full flex-col gap-0">
		<div class="flex items-center gap-1 border-b px-2 py-1.5">
			<TabsList class="flex-1 bg-transparent p-0">
				{#each TABS as entry (entry.id)}
					<TabsTrigger
						value={entry.id}
						class="gt-transition-state data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
					>
						<entry.icon class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">{entry.label}</span>
					</TabsTrigger>
				{/each}
			</TabsList>

			<button
				type="button"
				class="rounded-md p-1.5 text-muted-foreground gt-transition-feedback hover:bg-accent hover:text-accent-foreground"
				onclick={() => (poppedOut = tab)}
				title="Pop this tab out into a floating window"
				aria-label={`Pop ${tab} out into a floating window`}
			>
				<PanelRightOpen class="h-3.5 w-3.5" />
			</button>
		</div>

		{#each TABS as entry (entry.id)}
			<TabsContent value={entry.id} class="mt-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
				{@render panelContent(entry.id)}
			</TabsContent>
		{/each}
	</Tabs>
</div>

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
					<button
						type="button"
						class="rounded p-1 text-muted-foreground gt-transition-feedback hover:bg-accent"
						onpointerdown={(event) => event.stopPropagation()}
						onclick={() => floating?.resetPosition()}
						title="Reset position"
						aria-label="Reset position"
					>
						<RotateCcw class="h-3 w-3" />
					</button>
					<button
						type="button"
						class="rounded p-1 text-muted-foreground gt-transition-feedback hover:bg-accent"
						onpointerdown={(event) => event.stopPropagation()}
						onclick={() => (poppedOut = null)}
						title="Dock back"
						aria-label="Dock back"
					>
						<X class="h-3 w-3" />
					</button>
				</div>
			</div>
		{/snippet}
		<div class="max-h-[70vh] w-80 overflow-y-auto">
			{@render panelContent(poppedOut)}
		</div>
	</FloatingPanel>
{/if}
