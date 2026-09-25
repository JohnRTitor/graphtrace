<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	interface Props {
		id: string;
		header?: import('svelte').Snippet;
		children?: import('svelte').Snippet;
	}

	let { id, header, children }: Props = $props();

	// State
	let x = $state<number | undefined>(undefined);
	let y = $state<number | undefined>(undefined);
	let isDragging = $state(false);

	let panelElement = $state<HTMLElement | null>(null);

	const LOCAL_STORAGE_KEY = $derived(`graphtrace.floating-panel.${id}.position`);

	// Drag state
	let dragStartX = 0;
	let dragStartY = 0;
	let startX = 0;
	let startY = 0;

	onMount(() => {
		// Load from local storage
		if (browser) {
			const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
			if (saved) {
				try {
					const pos = JSON.parse(saved);
					if (typeof pos.x === 'number' && typeof pos.y === 'number') {
						x = pos.x;
						y = pos.y;
					}
				} catch (e) {
					console.warn('Failed to parse saved panel position', e);
				}
			}
			if (x !== undefined && y !== undefined) {
				queueMicrotask(checkBounds);
			}
		}
	});

	// Clamp function
	function clamp(val: number, min: number, max: number) {
		return Math.max(min, Math.min(max, val));
	}

	// Need to run bounds check when window resizes or panel mounts
	function checkBounds() {
		if (x === undefined || y === undefined || !panelElement || !panelElement.parentElement) return;

		const parent = panelElement.parentElement;
		const parentRect = parent.getBoundingClientRect();
		const panelRect = panelElement.getBoundingClientRect();

		// Margin
		const MARGIN = 16;

		// Calculate max bounds
		const maxX = parentRect.width - panelRect.width;
		const maxY = parentRect.height - panelRect.height;

		let newX = clamp(x, MARGIN, Math.max(MARGIN, maxX - MARGIN));
		let newY = clamp(y, MARGIN, Math.max(MARGIN, maxY - MARGIN));

		if (newX !== x || newY !== y) {
			x = newX;
			y = newY;
			savePosition();
		}
	}

	// Use a resize observer to watch container
	$effect(() => {
		if (!panelElement || !panelElement.parentElement) return;
		const parent = panelElement.parentElement;

		const observer = new ResizeObserver(() => {
			if (x !== undefined && y !== undefined) {
				checkBounds();
			}
		});

		observer.observe(parent);
		observer.observe(panelElement);

		return () => {
			observer.disconnect();
		};
	});

	function savePosition() {
		if (browser && x !== undefined && y !== undefined) {
			localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ x, y }));
		}
	}

	export function resetPosition() {
		x = undefined;
		y = undefined;
		if (browser) {
			localStorage.removeItem(LOCAL_STORAGE_KEY);
		}
	}

	function handlePointerDown(e: PointerEvent) {
		if (!panelElement || !panelElement.parentElement) return;

		// Stop propagation so canvas doesn't receive this
		e.stopPropagation();

		// Calculate initial position if undefined
		if (x === undefined || y === undefined) {
			// It's currently positioned by CSS right/top
			const parentRect = panelElement.parentElement.getBoundingClientRect();
			const rect = panelElement.getBoundingClientRect();

			x = rect.left - parentRect.left;
			y = rect.top - parentRect.top;
		}

		isDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		startX = x;
		startY = y;

		// Capture pointer
		if (e.target instanceof HTMLElement) {
			e.target.setPointerCapture(e.pointerId);
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging) return;
		e.stopPropagation();

		const deltaX = e.clientX - dragStartX;
		const deltaY = e.clientY - dragStartY;

		x = startX + deltaX;
		y = startY + deltaY;

		checkBounds();
	}

	function handlePointerUp(e: PointerEvent) {
		if (!isDragging) return;
		e.stopPropagation();
		isDragging = false;
		savePosition();

		if (e.target instanceof HTMLElement && e.target.hasPointerCapture(e.pointerId)) {
			e.target.releasePointerCapture(e.pointerId);
		}
	}

	function handlePointerCancel(e: PointerEvent) {
		if (!isDragging) return;
		isDragging = false;

		if (e.target instanceof HTMLElement && e.target.hasPointerCapture(e.pointerId)) {
			e.target.releasePointerCapture(e.pointerId);
		}
	}
</script>

<div
	bind:this={panelElement}
	class="absolute z-10 w-72 transition-shadow {isDragging ? 'shadow-xl' : 'shadow-md'}"
	role="region"
	aria-label={id}
	style:right={x === undefined ? '16px' : 'auto'}
	style:top={y === undefined ? '16px' : `${y}px`}
	style:left={x === undefined ? 'auto' : `${x}px`}
	style:touch-action="none"
>
	<div class="bg-card text-card-foreground rounded-xl border flex flex-col overflow-hidden {isDragging ? 'select-none' : ''}">
		<!-- Header/Handle -->
		<div
			class="cursor-grab active:cursor-grabbing touch-none"
			role="presentation"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerCancel}
			onlostpointercapture={handlePointerCancel}
		>
			{@render header?.()}
		</div>
		
		<!-- Content -->
		<div class={isDragging ? 'pointer-events-none' : ''}>
			{@render children?.()}
		</div>
	</div>
</div>
