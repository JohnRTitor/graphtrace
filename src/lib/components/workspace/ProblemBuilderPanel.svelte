<script lang="ts">
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { environmentState } from '$lib/state/environment.svelte';
	import { playbackState } from '$lib/state/playback.svelte';
	import { getAlgorithmSummary } from '$lib/algorithms';
	import { algorithmBadges } from './algorithm-badges';
	import { Button } from '$lib/components/ui/button';
	import EnvironmentSettings from './EnvironmentSettings.svelte';
	import Command from '@lucide/svelte/icons/command';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import Eraser from '@lucide/svelte/icons/eraser';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Redo2 from '@lucide/svelte/icons/redo-2';

	interface Props {
		onOpenPalette: () => void;
	}

	let { onOpenPalette }: Props = $props();

	let tab = $state('algorithm');

	// The tab resets when the family changes: carrying "Parameters" across a
	// family switch would land the user on controls that no longer apply.
	$effect(() => {
		void environmentState.familyId;
		tab = 'algorithm';
	});

	let summary = $derived(getAlgorithmSummary(environmentState.selectedAlgorithmId));
	let family = $derived(environmentState.family);

	function handleGenerate() {
		if (environmentState.isAdversarialFamily) {
			environmentState.handleGenerateGameTree();
			return;
		}
		environmentState.handleGenerate();
	}

	function handleClear() {
		if (environmentState.isAdversarialFamily) {
			environmentState.clearGameTree();
		} else if (environmentState.isPathfindingGraph) {
			environmentState.clearGraph();
		} else {
			environmentState.clearGrid();
		}
	}
</script>

<Tabs bind:value={tab} class="flex h-full flex-col gap-0">
	<TabsList class="m-3 grid w-auto grid-cols-3 gap-1">
		<TabsTrigger value="algorithm" class="text-xs">Algorithm</TabsTrigger>
		<TabsTrigger value="environment" class="text-xs">Environment</TabsTrigger>
		<TabsTrigger value="parameters" class="text-xs">Parameters</TabsTrigger>
	</TabsList>

	<TabsContent value="algorithm" class="mt-0 flex-1 overflow-y-auto">
		<div class="space-y-4 p-4 pt-0">
			<div class="space-y-2">
				<Button variant="outline" class="w-full justify-between" onclick={onOpenPalette}>
					<span class="truncate">{summary?.name ?? 'Select an algorithm'}</span>
					<kbd class="gt-mono flex items-center gap-0.5 rounded border bg-muted px-1 text-[10px] text-muted-foreground">
						<Command class="h-2.5 w-2.5" />K
					</kbd>
				</Button>

				{#if summary}
					<div class="flex flex-wrap gap-1">
						{#each algorithmBadges(summary) as badge (badge.title)}
							<span
								class="gt-mono rounded bg-muted px-1.5 py-0.5 text-[10px] {badge.muted
									? 'text-muted-foreground'
									: ''}"
								title={badge.title}
							>
								{badge.label}
							</span>
						{/each}
					</div>
				{/if}
			</div>

			<p class="text-xs leading-relaxed text-muted-foreground">
				{summary?.description ?? 'Choose an algorithm from the palette.'}
			</p>

			{#if family && summary && summary.properties.optimal === false}
				<p class="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
					This algorithm is complete but not optimal: it will always finish, but it may not
					return the best answer.
				</p>
			{/if}

			{#if family && environmentState.isAdversarialFamily}
				<p class="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
					Both algorithms here return the same root value on the same tree. Alpha-beta
					simply declines to look at some branches - dim them in the canvas to see which.
				</p>
			{/if}

			<div class="grid grid-cols-2 gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={!environmentState.canUndo}
					onclick={() => environmentState.undo()}
				>
					<Undo2 class="h-3.5 w-3.5" /> Undo
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={!environmentState.canRedo}
					onclick={() => environmentState.redo()}
				>
					<Redo2 class="h-3.5 w-3.5" /> Redo
				</Button>
			</div>

			{#if playbackState.hasLoadedTrace}
				<p class="text-xs text-muted-foreground">
					Editing the environment discards the loaded trace.
				</p>
			{/if}
		</div>
	</TabsContent>

	<TabsContent value="environment" class="mt-0 flex-1 overflow-y-auto">
		<EnvironmentSettings />
		<div class="grid grid-cols-2 gap-2 px-4 pb-4">
			<Button size="sm" onclick={handleGenerate}>
				<Shuffle class="h-3.5 w-3.5" /> Generate
			</Button>
			<Button variant="outline" size="sm" onclick={handleClear}>
				<Eraser class="h-3.5 w-3.5" /> Clear
			</Button>
		</div>
	</TabsContent>

	<TabsContent value="parameters" class="mt-0 flex-1 overflow-y-auto">
		<EnvironmentSettings />
	</TabsContent>
</Tabs>
