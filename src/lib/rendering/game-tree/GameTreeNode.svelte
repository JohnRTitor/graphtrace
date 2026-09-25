<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { GamePlayer } from '$lib/graph/game-tree';
	import type { TreeNodeData } from './tree-adapter';
	import { formatTreeValue } from './tree-adapter';

	let { data, selected = false }: { data: TreeNodeData; selected?: boolean } = $props();

	/**
	 * MAX and MIN must be distinguishable at a glance without reading a label, so
	 * they differ in shape (a flat top for MAX, a rounded one for MIN) as well as
	 * in hue. Shape survives a colourblind view and a greyscale screenshot; hue
	 * alone does not.
	 */
	const ROLE_LABELS: Record<GamePlayer, string> = {
		max: 'MAX',
		min: 'MIN',
		terminal: 'LEAF'
	};

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

<div
	class="group relative flex h-16 w-[148px] flex-col items-center justify-center border text-center gt-transition-state"
	class:rounded-b-lg={data.player === 'min'}
	class:rounded-t-lg={data.player === 'max'}
	class:rounded-lg={data.player === 'terminal'}
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

	<span
		class="max-w-[132px] truncate text-xs font-medium"
		style:color={dimmed ? data.colors.mutedText : 'inherit'}
	>
		{data.moveLabel || (data.isRoot ? 'root' : data.digest ?? '—')}
	</span>

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

	{#if data.showValues && data.alpha !== undefined && !dimmed}
		<span class="gt-mono absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] opacity-60" style:color={data.colors.mutedText}>
			α {formatTreeValue(data.alpha)} β {formatTreeValue(data.beta)}
		</span>
	{/if}

	<Handle type="source" position={Position.Bottom} class="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
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
