<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { GamePlayer } from '$lib/graph/game-tree';
	import type { TreeNodeData } from './tree-adapter';
	import { formatTreeValue, nodeShapeFor, NODE_SHAPE_CLASSES } from './tree-adapter';

	let { data, selected = false }: { data: TreeNodeData; selected?: boolean } = $props();

	/**
	 * MAX and MIN must be distinguishable at a glance without reading a label, so
	 * they differ in shape as well as in hue: MAX is a rectangle, MIN is a circle.
	 * Shape survives a colourblind view and a greyscale screenshot; hue alone does
	 * not.
	 *
	 * The shape itself lives in the adapter, so this component has no say in it and
	 * the two cannot drift apart.
	 */
	const ROLE_LABELS: Record<GamePlayer, string> = {
		max: 'MAX',
		min: 'MIN',
		terminal: 'LEAF'
	};

	let shape = $derived(nodeShapeFor(data.player));
	let isCircle = $derived(shape === 'circle');
	let moveText = $derived(data.moveLabel || (data.isRoot ? 'root' : data.digest ?? '—'));

	let role = $derived(ROLE_LABELS[data.player] ?? 'LEAF');

	let fill = $derived.by(() => {
		switch (data.state) {
			case 'chosen':
				return data.colors.path;
			case 'visiting':
				return data.colors.current;
			case 'backed-up':
				return data.colors.visited;
			case 'evaluated':
				return data.colors.frontier;
			case 'pruned':
				return data.colors.pruned;
			default:
				return data.colors.surface;
		}
	});

	let borderColor = $derived.by(() => {
		if (selected) return data.colors.selection;
		if (data.isRoot) return data.colors.selection;
		return data.colors.structure;
	});

	// Pruned content is dimmed rather than hidden: the skipped work is the point
	// of the family, so it has to stay on screen, recognisable as skipped.
	let dimmed = $derived(data.state === 'pruned');
	let opacity = $derived(dimmed ? data.colors.prunedOpacity : 1);

	let showValue = $derived(
		data.showValues && (data.value !== undefined || (data.state === 'evaluated' && data.utility !== null))
	);
	let displayedValue = $derived(
		data.value !== undefined ? data.value : (data.state === 'evaluated' ? data.utility : undefined)
	);
</script>

<!--
	The outer box is always the layout footprint (`TREE_NODE_WIDTH` x
	`TREE_NODE_HEIGHT`), so the tree keeps the geometry the adapter computed. The
	inner body is the visible node, which is what differs by shape: a circle for
	MIN, a sharp rectangle for MAX. A circle cannot hold the move label, so that
	label moves below it rather than being dropped.
-->
<div class="group relative flex h-16 w-[148px] items-center justify-center">
	<div
		class="relative flex flex-col items-center justify-center border text-center gt-transition-state {NODE_SHAPE_CLASSES[shape]}"
		style:background-color={fill}
		style:border-color={borderColor}
		style:opacity={opacity}
		style:border-width={selected || data.isRoot ? '2px' : '1px'}
		style:box-shadow={data.state === 'visiting' ? `0 0 0 3px ${data.colors.current}33` : undefined}
	>
		<Handle type="target" position={Position.Top} class="!h-1.5 !w-1.5 !border-0 !bg-transparent" />

		<span class="text-[10px] font-semibold uppercase tracking-wider opacity-70" style:color={data.colors.mutedText}>
			{role}
		</span>

		{#if !isCircle}
			<span
				class="max-w-[132px] truncate text-xs font-medium"
				style:color={dimmed ? data.colors.mutedText : 'inherit'}
			>
				{moveText}
			</span>
		{/if}

		{#if showValue}
			<!--
				Keyed on the value and the backup tick so a new number always animates in
				even when it repeats a previous one, and so stepping backwards re-keys it
				too. The animation is CSS only, so prefers-reduced-motion disables it
				without any JavaScript branch.
			-->
			{#key `${displayedValue}:${data.backupTick}`}
				<span
					class="gt-mono absolute -right-2 -top-2 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold gt-backup-in"
					style:background-color={data.colors.background}
					style:border-color={fill}
					style:color={fill}
				>
					{formatTreeValue(displayedValue)}
				</span>
			{/key}
		{/if}

		<Handle type="source" position={Position.Bottom} class="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
	</div>

	{#if isCircle}
		<span
			class="absolute -bottom-4 left-1/2 w-28 -translate-x-1/2 truncate text-center text-[10px]"
			style:color={data.colors.mutedText}
		>
			{moveText}
		</span>
	{/if}

	{#if data.showValues && data.alpha !== undefined && !dimmed}
		<span
			class="gt-mono absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] opacity-60"
			class:-bottom-3={!isCircle}
			class:-bottom-7={isCircle}
			style:color={data.colors.mutedText}
		>
			α {formatTreeValue(data.alpha)} β {formatTreeValue(data.beta)}
		</span>
	{/if}
</div>

<style>
	/* A backed-up value arrives from below and settles, which is the motion that
	   communicates causality: the number came up the tree, it did not appear. */
	@keyframes gt-backup-in {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.9);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.gt-backup-in {
		animation: gt-backup-in var(--motion-duration-state) var(--motion-ease-state) both;
	}
</style>
