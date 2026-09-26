<script lang="ts">
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
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
	import Info from '@lucide/svelte/icons/info';

	interface Props {
		onOpenPalette: () => void;
	}

	let { onOpenPalette }: Props = $props();

	let tab = $state('algorithm');

	// The tab resets when the family changes: carrying the environment tab across
	// a family switch would land the user on controls that no longer apply.
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

<Tabs bind:value={tab} class="flex h-full min-h-0 flex-col gap-0">
	<TabsList class="m-3 grid w-auto grid-cols-2 gap-1">
		<TabsTrigger value="algorithm" class="h-11 min-w-0 truncate text-xs sm:h-9">Algorithm</TabsTrigger>
		<TabsTrigger value="environment" class="h-11 min-w-0 truncate text-xs sm:h-9">Environment</TabsTrigger>
	</TabsList>

	<TabsContent value="algorithm" class="mt-0 min-h-0 flex-1 overflow-y-auto">
		<div class="space-y-4 p-3 pt-0 sm:p-4 sm:pt-0">
			<div class="space-y-2">
				<Button variant="outline" class="h-11 w-full justify-between sm:h-9" onclick={onOpenPalette}>
					<span class="truncate">{summary?.name ?? 'Select an algorithm'}</span>
					<span class="gt-mono flex items-center gap-0.5 rounded border bg-muted px-1 text-[10px] text-muted-foreground">
						<Command class="h-2.5 w-2.5" />K
					</span>
				</Button>

				{#if summary}
					<div class="flex flex-wrap gap-1">
						{#each algorithmBadges(summary) as badge (badge.title)}
							<Badge
								variant="secondary"
								class="gt-mono px-1.5 py-0 text-[10px] font-normal"
								title={badge.title}
							>
								{badge.label}
							</Badge>
						{/each}
					</div>
				{/if}
			</div>

			<p class="text-xs leading-relaxed text-muted-foreground">
				{summary?.description ?? 'Choose an algorithm from the palette.'}
			</p>

			{#if family && summary && summary.properties.optimal === false}
				<Alert class="rounded-lg py-2.5">
					<Info />
					<AlertTitle class="text-xs">Not optimal</AlertTitle>
					<AlertDescription class="text-xs">
						This algorithm is complete but not optimal: it will always finish, but it may
						not return the best answer.
					</AlertDescription>
				</Alert>
			{/if}

			{#if family && environmentState.isAdversarialFamily}
				<Alert class="rounded-lg py-2.5">
					<Info />
					<AlertTitle class="text-xs">Same value, less work</AlertTitle>
					<AlertDescription class="text-xs">
						Both algorithms here return the same root value on the same tree. Alpha-beta
						simply declines to look at some branches - dim them in the canvas to see
						which.
					</AlertDescription>
				</Alert>
			{/if}

			<div class="grid grid-cols-2 gap-2">
				<Button
					variant="outline"
					size="sm"
					class="h-11 sm:h-8"
					disabled={!environmentState.canUndo}
					onclick={() => environmentState.undo()}
				>
					<Undo2 class="h-3.5 w-3.5" /> Undo
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="h-11 sm:h-8"
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

	<TabsContent value="environment" class="mt-0 min-h-0 flex-1 overflow-y-auto">
		<!--
			One settings panel, not one per tab.

			"Environment" and "Parameters" used to be two tabs rendering the same
			component, which meant every control existed twice in the DOM: duplicate
			`id`s, so a `<label for>` pointed at whichever copy the browser found
			first, and duplicate options in the environment select. The distinction
			was never real - both tabs showed the same controls - so they are one tab
			now, and the actions that build the problem sit with the settings that
			describe it.
		-->
		<EnvironmentSettings />
		<div class="grid grid-cols-2 gap-2 px-3 pb-3 sm:px-4 sm:pb-4">
			<Button size="sm" class="h-11 sm:h-8" onclick={handleGenerate}>
				<Shuffle class="h-3.5 w-3.5" /> Generate
			</Button>
			<Button variant="outline" size="sm" class="h-11 sm:h-8" onclick={handleClear}>
				<Eraser class="h-3.5 w-3.5" /> Clear
			</Button>
		</div>
	</TabsContent>
</Tabs>
