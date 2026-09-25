<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { browser } from '$app/environment';
	import { environmentState } from '$lib/state/environment.svelte';
	import { playbackState } from '$lib/state/playback.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { invalidatePlaybackIfNeeded } from '$lib/state/invalidate';
	import type { MazeRenderer } from './MazeRenderer';
	import { Button } from '$lib/components/ui/button';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import Maximize from '@lucide/svelte/icons/maximize';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import MazeContextMenu from './MazeContextMenu.svelte';
	import EditCostDialog from '$lib/components/workspace/EditCostDialog.svelte';
	import type { NodeId } from '$lib/graph/types';
	import type { PlaybackState } from '$lib/state/playback.svelte';

	let { playback = playbackState } = $props<{ playback?: PlaybackState }>();

	let container = $state<HTMLDivElement | null>(null);
	let renderer = $state.raw<MazeRenderer | null>(null);

	// Watch theme
	let isDark = $state(false);

	// Context menu target: the cell under the pointer at the moment of the
	// right-click, resolved via the same authoritative screen->grid
	// transform the renderer uses for painting (see maze-coords.ts).
	let menuOpen = $state(false);
	let mazeCellTarget = $state<NodeId | null>(null);
	let mazeCostOpen = $state(false);
	let mazeCostCellId = $state<NodeId | null>(null);
	let renderGrid = $derived(
		playback.problem?.type === 'grid' ? playback.problem.grid : environmentState.grid
	);

	onMount(() => {
		if (!browser || !container) return;
		let disposed = false;
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.attributeName === 'class') {
					isDark = document.documentElement.classList.contains('dark');
				}
			});
		});
		observer.observe(document.documentElement, { attributes: true });
		isDark = document.documentElement.classList.contains('dark');

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				renderer?.resize(entry.contentRect.width, entry.contentRect.height);
			}
		});
		resizeObserver.observe(container);

		void import('./MazeRenderer').then(({ MazeRenderer: Renderer }) => {
			if (disposed || !container) return;
			renderer = new Renderer(container);
			renderer.setContext(editorState, environmentState);
			renderer.setContextMenuHandler((cellId) => {
				if (cellId !== null && environmentState.grid.nodes.has(cellId)) {
					mazeCellTarget = cellId;
					menuOpen = true;
				} else {
					mazeCellTarget = null;
					menuOpen = false;
				}
			});
			renderer.resize(container.clientWidth, container.clientHeight);
			renderer.renderEnvironment(renderGrid);
			renderer.fitToView();
		});

		return () => {
			disposed = true;
			observer.disconnect();
			resizeObserver.disconnect();
			renderer?.destroy();
		};
	});

	$effect(() => {
		if (renderer) {
			renderer.updateTheme(isDark ? 'dark' : 'light');
		}
	});

	$effect(() => {
		if (renderer) {
			renderer.updateShowCosts(environmentState.showCosts);
		}
	});

	// Re-render environment when grid changes
	$effect(() => {
		if (renderer && renderGrid) {
			renderer.renderEnvironment(renderGrid);
		}
	});

	// Re-render visualization when vizState changes
	$effect(() => {
		if (renderer) {
			renderer.renderVisualization(playback.vizState, renderGrid);
		}
	});

	$effect(() => {
		if (renderer) {
			renderer.updateSelection(editorState.selection, renderGrid);
		}
	});

	function handleMenuOpenChange(open: boolean) {
		menuOpen = open && mazeCellTarget !== null;
	}

	function openMazeCostDialog(cellId: NodeId) {
		mazeCostCellId = cellId;
		mazeCostOpen = true;
	}

	function handleGridKeydown(event: KeyboardEvent) {
		const key = event.key;
		if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(key)) return;
		const selected = editorState.selection?.type === 'cell' ? editorState.selection.id : environmentState.gridStart;
		if (!selected) return;
		const [row, col] = selected.split(',').map(Number);
		let nextRow = row;
		let nextCol = col;
		if (key === 'ArrowUp') nextRow--;
		if (key === 'ArrowDown') nextRow++;
		if (key === 'ArrowLeft') nextCol--;
		if (key === 'ArrowRight') nextCol++;
		nextRow = Math.max(0, Math.min(environmentState.gridRows - 1, nextRow));
		nextCol = Math.max(0, Math.min(environmentState.gridCols - 1, nextCol));
		event.preventDefault();
		editorState.selection = { type: 'cell', id: `${nextRow},${nextCol}` };
		if (key === 'Enter' || key === ' ') {
			editorState.onPointerDown(`${nextRow},${nextCol}`);
			editorState.onPointerUp(`${nextRow},${nextCol}`);
		}
	}
	function saveMazeCost(cost: number) {
		invalidatePlaybackIfNeeded();
		if (mazeCostCellId !== null) environmentState.setGridCost(mazeCostCellId, cost);
	}

</script>

<div class="relative w-full h-full bg-background">
	<ContextMenu.Root open={menuOpen} onOpenChange={handleMenuOpenChange}>
		<ContextMenu.Trigger class="block w-full h-full">
			<div
				bind:this={container}
				class="h-full w-full cursor-crosshair focus-visible:ring-2 focus-visible:ring-ring"
				style:touch-action="none"
				role="grid"
				aria-label="Graph grid editor"
				aria-describedby="maze-grid-instructions"
				aria-rowcount={environmentState.gridRows}
				aria-colcount={environmentState.gridCols}
				tabindex="0"
				onkeydown={handleGridKeydown}
			></div>
		</ContextMenu.Trigger>
		<ContextMenu.Content>
			{#if mazeCellTarget !== null}
				<MazeContextMenu cellId={mazeCellTarget} onEditCost={openMazeCostDialog} />
			{/if}
		</ContextMenu.Content>
	</ContextMenu.Root>
	<span id="maze-grid-instructions" class="sr-only">Use arrow keys to move between cells and Enter or Space to apply the current edit tool.</span>

	{#if mazeCostCellId !== null}
		<EditCostDialog
			bind:open={mazeCostOpen}
			initialCost={environmentState.grid.nodes.get(mazeCostCellId)?.cost ?? 1}
			title="Edit Cell Cost"
			onSave={saveMazeCost}
		/>
	{/if}

	{#snippet zoomButton(Icon: Component<{ class?: string }>, label: string, onClick: () => void)}
		<Button variant="ghost" size="icon" class="h-10 w-10 sm:h-8 sm:w-8" onclick={onClick} title={label}>
			<Icon class="h-4 w-4" />
			<span class="sr-only">{label}</span>
		</Button>
	{/snippet}

	<div class="absolute bottom-20 right-4 z-10 flex flex-col gap-2 rounded-md border bg-background/80 p-1 shadow-sm backdrop-blur-sm sm:bottom-4">
		{@render zoomButton(ZoomIn, 'Zoom In', () => renderer?.zoomIn())}
		{@render zoomButton(ZoomOut, 'Zoom Out', () => renderer?.zoomOut())}
		{@render zoomButton(Maximize, 'Fit to View', () => renderer?.fitToView())}
	</div>
</div>
