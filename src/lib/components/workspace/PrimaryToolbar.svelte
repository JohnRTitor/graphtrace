<script lang="ts">
	import { editorState } from '$lib/state/editor.svelte';
	import { environmentState } from '$lib/state/environment.svelte';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';

	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import Eraser from '@lucide/svelte/icons/eraser';
	import Flag from '@lucide/svelte/icons/flag';
	import Target from '@lucide/svelte/icons/target';
	import Weight from '@lucide/svelte/icons/weight';
	import Circle from '@lucide/svelte/icons/circle';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Move from '@lucide/svelte/icons/move';
	import Search from '@lucide/svelte/icons/search';

	import CostBrushPanel from './CostBrushPanel.svelte';
</script>

<div class="flex items-center gap-1 border-b bg-card p-2 shadow-sm">
	<ToggleGroup 
		type="single" 
		value={editorState.mode} 
		onValueChange={(v) => { if (v) editorState.mode = v as any; }}
		class="justify-start flex-wrap gap-1"
	>
		{#if environmentState.environmentType === 'graph'}
			<ToggleGroupItem value="move" aria-label="Move Node" title="Pointer / Move">
				<Move class="h-4 w-4" />
			</ToggleGroupItem>
			<ToggleGroupItem value="node" aria-label="Add Node" title="Add Node">
				<Circle class="h-4 w-4" />
			</ToggleGroupItem>
			<ToggleGroupItem value="edge" aria-label="Add Edge" title="Add Edge">
				<ArrowRight class="h-4 w-4" />
			</ToggleGroupItem>
			<ToggleGroupItem value="remove" aria-label="Remove" title="Remove">
				<Trash2 class="h-4 w-4" />
			</ToggleGroupItem>
		{:else}
			<ToggleGroupItem value="wall" aria-label="Draw Walls" title="Draw Walls">
				<MousePointer2 class="h-4 w-4" />
			</ToggleGroupItem>
			<ToggleGroupItem value="erase" aria-label="Erase" title="Erase">
				<Eraser class="h-4 w-4" />
			</ToggleGroupItem>
		{/if}

		<div class="w-px h-6 bg-border mx-1"></div>

		<ToggleGroupItem value="start" aria-label="Set Start" title="Set Start">
			<Flag class="h-4 w-4 text-green-500" />
		</ToggleGroupItem>
		<ToggleGroupItem value="goal" aria-label="Set Goal" title="Set Goal">
			<Target class="h-4 w-4 text-red-500" />
		</ToggleGroupItem>

		<div class="w-px h-6 bg-border mx-1"></div>

		<ToggleGroupItem value="weight" aria-label="Cost Brush" title="Cost Brush">
			<Weight class="h-4 w-4" />
		</ToggleGroupItem>
		<!-- Popover for cost settings next to the tool -->
		<Popover>
			<PopoverTrigger class="h-9 px-2 hover:bg-accent hover:text-accent-foreground rounded-md flex items-center justify-center">
				<Search class="h-3 w-3" />
			</PopoverTrigger>
			<PopoverContent class="w-80" side="bottom" align="start">
				<CostBrushPanel />
			</PopoverContent>
		</Popover>
	</ToggleGroup>
</div>
