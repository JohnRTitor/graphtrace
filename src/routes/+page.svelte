<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import ProblemBuilderPanel from '$lib/components/workspace/ProblemBuilderPanel.svelte';
	import PrimaryToolbar from '$lib/components/workspace/PrimaryToolbar.svelte';
	import Inspector from '$lib/components/workspace/Inspector.svelte';
	import AlgorithmCompatibilityBanner from '$lib/components/workspace/AlgorithmCompatibilityBanner.svelte';
	import PlaybackControls from '$lib/components/PlaybackControls.svelte';
	import ComparisonView from '$lib/components/workspace/ComparisonView.svelte';
	import CanvasView from '$lib/components/CanvasView.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import KeyboardShortcutsDialog from '$lib/components/KeyboardShortcutsDialog.svelte';
	import { generateBlankGrid } from '$lib/generators/random';
	import { environmentState } from '$lib/state/environment.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import { onMount } from 'svelte';
	import { ScrollArea } from '$lib/components/ui/scroll-area';

	let shortcutsOpen = $state(false);

	onMount(() => {
		// Initialize with default preset
		const initialGrid = generateBlankGrid(30, 40, { seed: 12345 });
		environmentState.replaceGrid(initialGrid);
	});
</script>

<svelte:head>
	<title>GraphTrace - Interactive Algorithm Visualizer</title>
	<meta name="description" content="A production-quality interactive pathfinding algorithm visualizer." />
</svelte:head>

<div class="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
	<Header onOpenShortcuts={() => (shortcutsOpen = true)} />
	
	<main class="flex flex-1 overflow-hidden">
		<!-- Sidebar Controls -->
		<aside class="w-[320px] shrink-0 border-r bg-card hidden md:block z-10 shadow-sm relative h-full">
			<ScrollArea class="h-full">
				<ProblemBuilderPanel />
			</ScrollArea>
		</aside>
		
		<!-- Main Canvas Area -->
		<div class="relative flex flex-1 flex-col overflow-hidden">
			<!-- Banner & Toolbar -->
			<div class="flex flex-col z-10">
				<AlgorithmCompatibilityBanner />
				<PrimaryToolbar />
			</div>
			
			<div class="relative flex-1 overflow-hidden">
				{#if executionStore.isComparing}
					<ComparisonView />
				{:else}
					<CanvasView />
				{/if}
				
				<!-- Stats overlay floating panel -->
				<StatsPanel />
				
				<!-- Persistent Playback Dock -->
				<div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-card rounded-lg shadow-lg border p-2 min-w-100">
					<PlaybackControls />
				</div>
			</div>
		</div>

		<!-- Right Inspector Panel -->
		<aside class="w-70 lg:w-[320px] shrink-0 border-l bg-card hidden md:block z-10 shadow-sm relative h-full">
			<ScrollArea class="h-full">
				<Inspector />
			</ScrollArea>
		</aside>
	</main>
</div>

<KeyboardShortcutsDialog bind:open={shortcutsOpen} />
