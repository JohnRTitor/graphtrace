<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { environmentState } from '$lib/state/environment.svelte';
	import { playbackState } from '$lib/state/playback.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { MazeRenderer } from './MazeRenderer';
	import { Button } from '$lib/components/ui/button';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import Maximize from '@lucide/svelte/icons/maximize';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import MazeContextMenu from './MazeContextMenu.svelte';
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

	onMount(() => {
		if (!browser || !container) return;
		
		renderer = new MazeRenderer(container);
		renderer.setContext(editorState, environmentState);
		renderer.setContextMenuHandler((cellId) => {
			mazeCellTarget = cellId;
		});

		// Observe theme changes
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
				if (renderer) {
					renderer.resize(entry.contentRect.width, entry.contentRect.height);
				}
			}
		});
		resizeObserver.observe(container);

		return () => {
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
		if (renderer && environmentState.grid) {
			renderer.renderEnvironment(environmentState.grid);
		}
	});

	// Re-render visualization when vizState changes
	$effect(() => {
		if (renderer) {
			renderer.renderVisualization(playback.vizState, environmentState.grid);
		}
	});

</script>

<div class="relative w-full h-full bg-background">
	{#if browser}
		<ContextMenu.Root bind:open={menuOpen}>
			<ContextMenu.Trigger class="block w-full h-full">
				<div bind:this={container} class="w-full h-full cursor-crosshair" style:touch-action="none"></div>
			</ContextMenu.Trigger>
			<ContextMenu.Content>
				{#if mazeCellTarget}
					<MazeContextMenu cellId={mazeCellTarget} />
				{/if}
			</ContextMenu.Content>
		</ContextMenu.Root>
		
		<!-- Zoom Controls -->
		{#snippet zoomButton(Icon: any, label: string, onClick: () => void)}
			<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onClick} title={label}>
				<Icon class="h-4 w-4" />
				<span class="sr-only">{label}</span>
			</Button>
		{/snippet}

		<div class="absolute bottom-4 right-4 flex flex-col gap-2 z-10 bg-background/80 backdrop-blur-sm p-1 rounded-md border shadow-sm">
			{@render zoomButton(ZoomIn, 'Zoom In', () => renderer?.zoomIn())}
			{@render zoomButton(ZoomOut, 'Zoom Out', () => renderer?.zoomOut())}
			{@render zoomButton(Maximize, 'Fit to View', () => renderer?.fitToView())}
		</div>
	{/if}
</div>
