<script lang="ts">
	import { BaseEdge, EdgeLabel, getBezierPath, type EdgeProps } from '@xyflow/svelte';
	import type { CustomEdge } from './types';

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
		data,
		selected
	} = $props<EdgeProps & { data?: CustomEdge['data'] }>();

	let edgePath = $derived(getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	}));

	let strokeColor = $derived.by(() => {
		if (data?.state === 'path') return data.colors.path;
		if (data?.state === 'expanded') return data.colors.expanded;
		if (data?.state === 'discovered') return data.colors.discovered;
		if (selected) return data?.colors.text || '#000';
		return data?.colors.wall || '#666';
	});

	let strokeWidth = $derived.by(() => {
		if (data?.state === 'path') return 3;
		if (selected) return 2;
		return 1.5;
	});

	// For label positioning
	let labelX = $derived((sourceX + targetX) / 2);
	let labelY = $derived((sourceY + targetY) / 2);

</script>

<BaseEdge
	path={edgePath[0]}
	{markerEnd}
	style="stroke: {strokeColor}; stroke-width: {strokeWidth}px; {style || ''}"
/>

{#if data?.weight !== undefined && data.weight !== 1}
	<EdgeLabel>
		<div
			style:transform="translate(-50%, -50%) translate({labelX}px,{labelY}px)"
			class="pointer-events-none absolute text-[10px] font-medium bg-background px-1 py-0.5 rounded shadow-sm border"
			style:color={data.colors.text}
		>
			{data.weight}
		</div>
	</EdgeLabel>
{/if}
