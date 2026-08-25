<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { gridState } from '$lib/state/grid.svelte';
	import { playbackState } from '$lib/state/playback.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { settingsState } from '$lib/state/settings.svelte';
	import { CanvasRenderer } from '$lib/visualization/renderer';
	import { pixelToGrid } from '$lib/visualization/coordinates';

	let canvasElement: HTMLCanvasElement | undefined = $state();
	let containerElement: HTMLDivElement | undefined = $state();
	let renderer: CanvasRenderer | undefined;
	let resizeObserver: ResizeObserver | undefined;

	let hoveredNodeId = $state<string | null>(null);

	// Initial setup
	onMount(() => {
		if (!canvasElement || !containerElement) return;

		renderer = new CanvasRenderer(canvasElement);

		resizeObserver = new ResizeObserver((entries) => {
			if (entries.length === 0 || !renderer) return;
			const { width, height } = entries[0].contentRect;
			renderer.resize(width, height, gridState.rows, gridState.cols);
			draw();
		});

		resizeObserver.observe(containerElement);
	});

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
	});

	// Reactively draw when state changes
	$effect(() => {
		// Read all dependencies to track them
		gridState.grid; 
		playbackState.vizState;
		settingsState.showCosts;
		
		draw();
	});

	// Re-render when theme changes (requires reading document class list which isn't reactive,
	// but the UI re-renders will eventually catch up, or we can set up a MutationObserver.
	// For simplicity, Svelte effects on theme toggle usually re-run components)

	function draw() {
		if (!renderer) return;
		
		requestAnimationFrame(() => {
			renderer!.render(gridState.grid, playbackState.vizState, {
				showCosts: settingsState.showCosts
			});
		});
	}

	function handlePointerDown(e: PointerEvent) {
		if (!canvasElement) return;
		e.preventDefault(); // Prevent text selection
		
		const rect = canvasElement.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		
		const gridPos = pixelToGrid(x, y, (renderer as any).config);
		if (gridPos) {
			const id = `${gridPos.row},${gridPos.col}`;
			editorState.onPointerDown(id);
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!canvasElement) return;
		
		const rect = canvasElement.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		
		const gridPos = pixelToGrid(x, y, (renderer as any).config);
		if (gridPos) {
			const id = `${gridPos.row},${gridPos.col}`;
			hoveredNodeId = id;
			editorState.onPointerMove(id);
		} else {
			hoveredNodeId = null;
		}
	}

	function handlePointerUp() {
		editorState.onPointerUp();
	}

	function handlePointerLeave() {
		hoveredNodeId = null;
		editorState.onPointerLeave();
	}
</script>

<div 
	class="relative h-full w-full overflow-hidden bg-muted/20"
	bind:this={containerElement}
>
	<canvas
		bind:this={canvasElement}
		class="absolute left-0 top-0 h-full w-full cursor-crosshair touch-none"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointerleave={handlePointerLeave}
		onpointercancel={handlePointerUp}
	></canvas>
	
	<!-- Optional Node Inspector Overlay could go here if hoveredNodeId is not null -->
</div>
