<script lang="ts">
	import { algorithmList } from '$lib/algorithms';
	import { settingsState } from '$lib/state/settings.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { gridState } from '$lib/state/grid.svelte';
	import { generateRandomGrid } from '$lib/generators/random';
	import { generateMaze } from '$lib/generators/maze';
	
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { Slider } from '$lib/components/ui/slider';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	
	import PlaybackControls from './PlaybackControls.svelte';
	
	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import Eraser from '@lucide/svelte/icons/eraser';
	import Flag from '@lucide/svelte/icons/flag';
	import Target from '@lucide/svelte/icons/target';
	import Weight from '@lucide/svelte/icons/weight';

	let density = $state(30); // 0-100 mapped to 0-1

	function handleRandom() {
		const newGrid = generateRandomGrid(gridState.rows, gridState.cols, {
			density: density / 100,
			weighted: settingsState.currentAlgorithm?.supportsWeights
		});
		gridState.replaceGrid(newGrid);
	}

	function handleMaze() {
		const newGrid = generateMaze(gridState.rows, gridState.cols);
		gridState.replaceGrid(newGrid);
	}
	
	function handleClear() {
		gridState.clear();
	}
</script>

<div class="flex h-full flex-col gap-6 p-4">
	<!-- Algorithm Selection -->
	<div class="space-y-3">
		<Label>Algorithm</Label>
		<Select
			type="single"
			bind:value={settingsState.selectedAlgorithmId}
		>
			<SelectTrigger>
				{settingsState.currentAlgorithm?.name ?? 'Select algorithm'}
			</SelectTrigger>
			<SelectContent>
				{#each algorithmList as algo}
					<SelectItem value={algo.id}>{algo.name}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
		<p class="text-xs text-muted-foreground">
			{settingsState.currentAlgorithm?.description}
		</p>
	</div>

	<Separator />

	<!-- Environment & Grid -->
	<div class="space-y-4">
		<h3 class="text-sm font-medium">Environment</h3>
		
		<div class="grid grid-cols-2 gap-2">
			<Button variant="outline" size="sm" onclick={handleRandom}>Random</Button>
			<Button variant="outline" size="sm" onclick={handleMaze}>Maze</Button>
			<Button variant="outline" size="sm" class="col-span-2" onclick={handleClear}>Clear Grid</Button>
		</div>

		<div class="space-y-3 pt-2">
			<div class="flex items-center justify-between">
				<Label class="text-xs font-normal text-muted-foreground">Random Density</Label>
				<span class="text-xs text-muted-foreground">{density}%</span>
			</div>
			<Slider
				type="single"
				bind:value={density}
				max={100}
				min={0}
				step={5}
			/>
		</div>
	</div>

	<Separator />

	<!-- Editing Tools -->
	<div class="space-y-3">
		<h3 class="text-sm font-medium">Tools</h3>
		
		<ToggleGroup 
			type="single" 
			value={editorState.mode} 
			onValueChange={(v) => { if (v) editorState.mode = v as any; }}
			class="justify-start flex-wrap gap-1"
		>
			<ToggleGroupItem value="wall" aria-label="Draw Walls" title="Draw Walls">
				<MousePointer2 class="h-4 w-4" />
			</ToggleGroupItem>
			<ToggleGroupItem value="erase" aria-label="Erase" title="Erase">
				<Eraser class="h-4 w-4" />
			</ToggleGroupItem>
			<ToggleGroupItem value="start" aria-label="Move Start" title="Move Start">
				<Flag class="h-4 w-4 text-green-500" />
			</ToggleGroupItem>
			<ToggleGroupItem value="goal" aria-label="Move Goal" title="Move Goal">
				<Target class="h-4 w-4 text-red-500" />
			</ToggleGroupItem>
			
			{#if settingsState.currentAlgorithm?.supportsWeights}
				<ToggleGroupItem value="weight" aria-label="Draw Weights" title="Draw Weights">
					<Weight class="h-4 w-4" />
				</ToggleGroupItem>
			{/if}
		</ToggleGroup>

		{#if editorState.mode === 'weight'}
			<div class="space-y-3 pt-2 pl-1 pr-1">
				<div class="flex items-center justify-between">
					<Label class="text-xs font-normal text-muted-foreground">Weight Value</Label>
					<span class="text-xs text-muted-foreground">{editorState.weightValue}</span>
				</div>
				<Slider
					type="single"
					value={editorState.weightValue}
					onValueChange={(v) => editorState.weightValue = v}
					max={20}
					min={2}
					step={1}
				/>
			</div>
		{/if}
	</div>

	<div class="mt-auto flex flex-col gap-4">
		<Separator />
		
		<div class="flex items-center justify-between">
			<Label for="show-costs" class="text-sm font-medium">Show Costs (A*)</Label>
			<Switch
				id="show-costs"
				checked={settingsState.showCosts}
				onCheckedChange={(v) => settingsState.showCosts = v}
			/>
		</div>
		
		<PlaybackControls />
	</div>
</div>
