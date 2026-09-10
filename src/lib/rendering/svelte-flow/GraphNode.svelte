<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import type { GraphNodeData } from './types';
	
	let { data, selected } = $props<{
		data: GraphNodeData;
		selected?: boolean;
	}>();

	let bgStyle = $derived.by(() => {
		if (data.state === 'path') return data.colors.path;
		if (data.state === 'current') return data.colors.current;
		if (data.state === 'expanded') return data.colors.expanded;
		if (data.state === 'discovered') return data.colors.discovered;
		return data.colors.bg;
	});

	let borderStyle = $derived.by(() => {
		if (selected) return `2px solid ${data.colors.text}`;
		if (data.isStart) return `2px solid ${data.colors.start}`;
		if (data.isGoal) return `2px solid ${data.colors.goal}`;
		return `1px solid ${data.colors.wall}`;
	});
	
	let textStyle = $derived.by(() => {
		// If the node is highlighted with a bright background, we might need dark text, 
		// but using the text color from palette is usually safe if it has enough contrast.
		// For simplicity, we use the palette text color, but force it to white/black if needed.
		// For now, let's just use the palette's text color.
		if (data.state !== 'none' && data.state !== 'discovered') return '#ffffff'; // White text on colored backgrounds usually works best
		return data.colors.text;
	});

	let showHandles = $derived(editorState.mode === 'edge');
	let handleClass = $derived(`w-3 h-3 bg-muted-foreground/50 transition-opacity ${showHandles ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 hover:opacity-100!'}`);

</script>

<div 
	class="relative flex min-w-12.5 min-h-12.5 items-center justify-center rounded-full shadow-sm transition-colors duration-200 group"
	style:background-color={bgStyle}
	style:border={borderStyle}
	style:color={textStyle}
>
	<Handle type="target" position={Position.Top} class={handleClass} />
	
	<div class="flex flex-col items-center justify-center font-medium text-sm">
		{data.label}
	</div>

	<!-- Cost overlays for A* -->
	{#if data.showCosts && (data.g !== undefined || data.h !== undefined)}
		<div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-background/80 px-1 rounded shadow-sm" style:color={data.colors.text}>
			{#if data.f !== undefined}
				<span class="font-bold">f:{Math.round(data.f)}</span>
			{/if}
			{#if data.g !== undefined}
				<span class="text-muted-foreground ml-1">g:{Math.round(data.g)}</span>
			{/if}
			{#if data.h !== undefined}
				<span class="text-muted-foreground ml-1">h:{Math.round(data.h)}</span>
			{/if}
		</div>
	{/if}

	<Handle type="source" position={Position.Bottom} class={handleClass} />
	<Handle type="source" position={Position.Right} class={handleClass} />
	<Handle type="target" position={Position.Left} class={handleClass} />
</div>
