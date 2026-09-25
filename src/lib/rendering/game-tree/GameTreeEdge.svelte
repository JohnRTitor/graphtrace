<script lang="ts">
	import { BaseEdge, EdgeLabel, getBezierPath, type EdgeProps } from '@xyflow/svelte';
	import type { TreeFlowEdge } from './tree-adapter';

	// `EdgeProps` is parameterised by a whole Edge, not by the data record, which
	// is why this mirrors the manual graph's edge component rather than
	// parameterising on `TreeEdgeData`.
	let {
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		markerEnd,
		style,
		data
	} = $props<EdgeProps & { data?: TreeFlowEdge['data'] }>();

	let path = $derived(getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition
	}));

	let stroke = $derived.by(() => {
		switch (data?.state) {
			case 'path':
				return data.colors.path;
			case 'pruned':
				return data.colors.pruned;
			case 'traversed':
				return data.colors.visited;
			default:
				return data?.colors.structure ?? 'transparent';
		}
	});

	let strokeWidth = $derived(
		data?.state === 'path' ? 2.5 : data?.state === 'pruned' ? 1 : 1.25
	);
	let opacity = $derived(
		data?.state === 'pruned' ? Number(data.colors.prunedOpacity) : data?.state === 'none' ? 0.55 : 1
	);
	// Pruned edges are dashed so "this move was skipped" does not depend on
	// colour alone.
	let dash = $derived(data?.state === 'pruned' ? 'stroke-dasharray: 4 4;' : '');

	let labelX = $derived((sourceX + targetX) / 2);
	let labelY = $derived((sourceY + targetY) / 2);
</script>

<BaseEdge
	{id}
	path={path[0]}
	{markerEnd}
	style="stroke: {stroke}; stroke-width: {strokeWidth}px; opacity: {opacity}; {dash} {style || ''}"
	class="gt-transition-state"
/>

{#if data?.moveLabel && data.state !== 'pruned'}
	<EdgeLabel>
		<span
			class="gt-mono pointer-events-none absolute rounded px-1 text-[9px] gt-transition-state"
			style:transform="translate(-50%, -50%) translate({labelX}px,{labelY}px)"
			style:color={data.colors.mutedText}
			style:opacity={data.state === 'none' ? 0.5 : 0.9}
		>
			{data.moveLabel}
		</span>
	</EdgeLabel>
{/if}
