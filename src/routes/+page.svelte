<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import ProblemBuilderPanel from '$lib/components/workspace/ProblemBuilderPanel.svelte';
	import PrimaryToolbar from '$lib/components/workspace/PrimaryToolbar.svelte';
	import DetailsPanel from '$lib/components/workspace/DetailsPanel.svelte';
	import AlgorithmCompatibilityBanner from '$lib/components/workspace/AlgorithmCompatibilityBanner.svelte';
	import AlgorithmPalette from '$lib/components/workspace/AlgorithmPalette.svelte';
	import PlaybackControls from '$lib/components/PlaybackControls.svelte';
	import ComparisonView from '$lib/components/workspace/ComparisonView.svelte';
	import CanvasView from '$lib/components/CanvasView.svelte';
	import KeyboardShortcutsDialog from '$lib/components/KeyboardShortcutsDialog.svelte';
	import { generateBlankGrid } from '$lib/generators/random';
	import { environmentState } from '$lib/state/environment.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import { onMount } from 'svelte';

	let shortcutsOpen = $state(false);
	let paletteOpen = $state(false);
	let mobilePanel: 'builder' | 'inspector' | null = $state(null);

	function toggleMobilePanel(panel: 'builder' | 'inspector') {
		mobilePanel = mobilePanel === panel ? null : panel;
	}

	/**
	 * Cmd/Ctrl+K is bound on the document so the palette opens from anywhere,
	 * including from inside the grid canvas. It is handled before the single-key
	 * shortcuts can see it, so a stray modifier is never read as one of them.
	 */
	function onKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			paletteOpen = true;
		}
	}

	onMount(() => {
		window.addEventListener('keydown', onKeydown);
		// Initialize with a default preset.
		environmentState.replaceGrid(generateBlankGrid(30, 40, { seed: 12345 }));
		return () => window.removeEventListener('keydown', onKeydown);
	});
</script>

<svelte:head>
	<title>GraphTrace - Algorithm Visualizer</title>
	<meta
		name="description"
		content="An interactive visualizer for pathfinding and adversarial search: BFS, DFS, A*, minimax and alpha-beta pruning."
	/>
</svelte:head>

<div class="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
	<Header
		onOpenShortcuts={() => (shortcutsOpen = true)}
		onOpenPalette={() => (paletteOpen = true)}
		onToggleBuilder={() => toggleMobilePanel('builder')}
		onToggleInspector={() => toggleMobilePanel('inspector')}
	/>

	<main class="flex flex-1 overflow-hidden">
		<!-- Problem builder: Algorithm / Environment / Parameters -->
		<aside
			class="fixed inset-y-14 left-0 z-40 w-[min(88vw,360px)] shrink-0 border-r bg-card shadow-lg gt-transition-panel md:static md:z-10 md:block md:w-[320px] md:shadow-sm {mobilePanel === 'builder' ? '' : 'hidden'}"
			aria-label="Problem builder"
		>
			<ProblemBuilderPanel onOpenPalette={() => (paletteOpen = true)} />
		</aside>

		<div class="relative flex flex-1 flex-col overflow-hidden">
			<div class="z-10 flex flex-col">
				<AlgorithmCompatibilityBanner />
				<PrimaryToolbar />
			</div>

			<div class="relative flex-1 overflow-hidden">
				{#if executionStore.isComparing}
					<ComparisonView />
				{:else}
					<CanvasView />
				{/if}

				<div class="absolute bottom-3 left-3 right-3 z-20 rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur-sm gt-transition-panel sm:bottom-6 sm:left-1/2 sm:right-auto sm:w-[30rem] sm:-translate-x-1/2">
					<PlaybackControls />
				</div>
			</div>
		</div>

		{#if mobilePanel}
			<button
				type="button"
				class="fixed inset-0 z-30 cursor-default bg-background/60 md:hidden"
				aria-label="Close side panel"
				onclick={() => (mobilePanel = null)}
			></button>
		{/if}

		<!-- One docked panel: Inspector / Metrics / Legend, with opt-in pop-out -->
		<aside
			class="fixed inset-y-14 right-0 z-40 w-[min(88vw,360px)] shrink-0 border-l bg-card shadow-lg gt-transition-panel md:static md:z-10 md:block md:w-[320px] md:shadow-sm {mobilePanel === 'inspector' ? '' : 'hidden'}"
			aria-label="Details"
		>
			<DetailsPanel />
		</aside>
	</main>
</div>

<AlgorithmPalette bind:open={paletteOpen} onOpenChange={(value) => (paletteOpen = value)} />
<KeyboardShortcutsDialog bind:open={shortcutsOpen} />
