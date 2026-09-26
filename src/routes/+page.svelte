<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
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
	import { SidebarInset, SidebarProvider } from '$lib/components/ui/sidebar';
	import {
		Sheet,
		SheetContent,
		SheetDescription,
		SheetHeader,
		SheetTitle
	} from '$lib/components/ui/sheet';
	import { IsMobile, DETAILS_BREAKPOINT } from '$lib/hooks/is-mobile.svelte';
	import { onMount } from 'svelte';

	let shortcutsOpen = $state(false);
	let paletteOpen = $state(false);

	/**
	 * Two flags, because the two presentations of the details panel are genuinely
	 * different things: the docked column is a layout fact that is on by default
	 * and the user collapses, while the sheet is a modal that is closed by
	 * default. One flag with a viewport-dependent meaning would have to guess a
	 * starting value before the viewport is known, and either the sheet opens on
	 * load on a phone or the column is missing on a desktop.
	 */
	let detailsCollapsed = $state(false);
	let detailsSheetOpen = $state(false);

	/** Below the width at which the details panel docks rather than overlays. */
	const detailsCompact = new IsMobile(DETAILS_BREAKPOINT);

	function toggleDetails() {
		if (detailsCompact.current) detailsSheetOpen = !detailsSheetOpen;
		else detailsCollapsed = !detailsCollapsed;
	}

	let detailsOpen = $derived(
		detailsCompact.current ? detailsSheetOpen : !detailsCollapsed
	);

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

<!--
	The shell.

	Three regions at `lg` and above - builder, canvas, details - and one at `lg`
	and below, where the builder and details become sheets over a canvas that
	takes the whole viewport. `SidebarProvider` supplies the mobile sheet, the
	focus trap and the ⌘B toggle, and `min-h-svh` is overridden to `h-dvh` because
	this is a fixed-viewport app that must never scroll.

	The transport is in normal flow rather than floating over the canvas. It used
	to be an absolutely positioned bar, which meant the bottom third of every
	graph sat underneath it and every canvas-local control had to be nudged clear
	by a guessed constant. In flow the graph is never covered, the canvas overlays
	go back to plain corner offsets, and the only cost is that the canvas is
	shorter by the dock's height - which is the honest trade for a visualisation
	tool.
-->
<SidebarProvider class="h-dvh overflow-hidden">
	<AppSidebar onOpenPalette={() => (paletteOpen = true)} />

	<SidebarInset class="min-w-0 overflow-hidden">
		<Header
			onOpenShortcuts={() => (shortcutsOpen = true)}
			onOpenPalette={() => (paletteOpen = true)}
			onToggleDetails={toggleDetails}
			{detailsOpen}
		/>

		<div class="flex min-h-0 flex-1 overflow-hidden">
			<main class="flex min-w-0 flex-1 flex-col overflow-hidden">
				<div class="z-10 flex shrink-0 flex-col">
					<AlgorithmCompatibilityBanner />
					<PrimaryToolbar />
				</div>

				<div class="relative min-h-0 flex-1 overflow-hidden">
					{#if executionStore.isComparing}
						<ComparisonView />
					{:else}
						<CanvasView />
					{/if}
				</div>

				<div
					data-slot="dock"
					class="z-20 shrink-0 border-t bg-card/95 px-2 py-2 backdrop-blur-sm sm:px-3 sm:py-3 lg:mx-auto lg:w-full lg:max-w-[30rem] lg:rounded-t-xl lg:border lg:border-t-0"
				>
					<PlaybackControls />
				</div>
			</main>

			<!--
				The docked half of the details panel. Unmounted while collapsed, not
				merely hidden, so a collapsed panel costs no layout and no paint.
			-->
			<aside class="hidden w-80 shrink-0 border-l bg-card xl:block xl:w-88" aria-label="Details">
				{#if !detailsCollapsed}
					<DetailsPanel />
				{/if}
			</aside>
		</div>
	</SidebarInset>
</SidebarProvider>

<!-- The overlay half, for everything below `lg`. -->
<Sheet bind:open={detailsSheetOpen}>
	<SheetContent side="right" class="w-[min(22rem,90vw)] gap-0 bg-card p-0 xl:hidden">
		<SheetHeader class="sr-only">
			<SheetTitle>Details</SheetTitle>
			<SheetDescription>Inspector, metrics and trace legend.</SheetDescription>
		</SheetHeader>
		<DetailsPanel />
	</SheetContent>
</Sheet>

<AlgorithmPalette bind:open={paletteOpen} onOpenChange={(value) => (paletteOpen = value)} />
<KeyboardShortcutsDialog bind:open={shortcutsOpen} />
