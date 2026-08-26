<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import CanvasView from '$lib/components/CanvasView.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import KeyboardShortcutsDialog from '$lib/components/KeyboardShortcutsDialog.svelte';
	import { generateDefaultPreset } from '$lib/generators/presets';
	import { environmentState } from '$lib/state/environment.svelte';
	import { onMount } from 'svelte';
	import { ScrollArea } from '$lib/components/ui/scroll-area';

	let shortcutsOpen = $state(false);

	onMount(() => {
		// Initialize with default preset
		const initialGrid = generateDefaultPreset(30, 40);
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
				<ControlPanel />
			</ScrollArea>
		</aside>
		
		<!-- Main Canvas Area -->
		<div class="relative flex flex-1 flex-col overflow-hidden">
			<!-- Mobile Controls Toggle could go here -->
			
			<div class="relative flex-1 overflow-hidden">
				<CanvasView />
				
				<!-- Stats overlay floating panel -->
				<StatsPanel />
			</div>
		</div>
	</main>
</div>

<KeyboardShortcutsDialog bind:open={shortcutsOpen} />
