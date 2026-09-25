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
	let mobilePanel: 'builder' | 'inspector' | null = $state(null);

	function toggleMobilePanel(panel: 'builder' | 'inspector') {
		mobilePanel = mobilePanel === panel ? null : panel;
	}

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

<div class="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
		<Header
			onOpenShortcuts={() => (shortcutsOpen = true)}
			onToggleBuilder={() => toggleMobilePanel('builder')}
			onToggleInspector={() => toggleMobilePanel('inspector')}
		/>
	
	<main class="flex flex-1 overflow-hidden">
		<!-- Sidebar Controls -->
		<aside
			class={`fixed inset-y-0 left-0 z-50 w-[min(88vw,360px)] shrink-0 border-r bg-card shadow-lg md:static md:z-10 md:block md:w-[320px] md:shadow-sm ${mobilePanel === 'builder' ? '' : 'hidden'}`}
			aria-label="Problem builder"
		>
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
				<div class="absolute bottom-3 left-3 right-3 z-20 rounded-lg border bg-card p-2 shadow-lg sm:bottom-6 sm:left-1/2 sm:right-auto sm:w-[28rem] sm:-translate-x-1/2">
					<PlaybackControls />
				</div>
			</div>
		</div>

		{#if mobilePanel}
			<button
				type="button"
				class="fixed inset-0 z-40 cursor-default bg-background/60 md:hidden"
				aria-label="Close side panel"
				onclick={() => (mobilePanel = null)}
			></button>
		{/if}

		<!-- Right Inspector Panel -->
		<aside
			class={`fixed inset-y-0 right-0 z-50 w-[min(88vw,360px)] shrink-0 border-l bg-card shadow-lg md:static md:z-10 md:block md:w-[320px] md:shadow-sm ${mobilePanel === 'inspector' ? '' : 'hidden'}`}
			aria-label="Inspector"
		>
			<ScrollArea class="h-full">
				<Inspector />
			</ScrollArea>
		</aside>
	</main>
</div>

<KeyboardShortcutsDialog bind:open={shortcutsOpen} />
