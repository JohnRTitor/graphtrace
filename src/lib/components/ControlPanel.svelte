<script lang="ts">
	import { algorithmList } from '$lib/algorithms';
	import { environmentState } from '$lib/state/environment.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { generateRandomGrid, generateBlankGrid } from '$lib/generators/random';
	import { generatePerfectMaze, generateBraidedMaze } from '$lib/generators/maze';
	
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
	import Circle from '@lucide/svelte/icons/circle';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Move from '@lucide/svelte/icons/move';

	import Shuffle from '@lucide/svelte/icons/shuffle';

	function handleGenerate() {
		if (environmentState.environmentType === 'graph') {
			environmentState.clearGraph();
			return;
		}

		const options = {
			seed: environmentState.environmentSeed,
			loopDensity: environmentState.loopDensity,
			obstacleDensity: environmentState.obstacleDensity,
			weighted: environmentState.currentAlgorithm?.supportsWeights
		};

		let newGrid;
		switch (environmentState.environmentType) {
			case 'perfect_maze':
				newGrid = generatePerfectMaze(environmentState.gridRowsSetting, environmentState.gridColsSetting, options);
				break;
			case 'braided_maze':
				newGrid = generateBraidedMaze(environmentState.gridRowsSetting, environmentState.gridColsSetting, options);
				break;
			case 'random_obstacles':
				newGrid = generateRandomGrid(environmentState.gridRowsSetting, environmentState.gridColsSetting, options);
				break;
			case 'blank':
			default:
				newGrid = generateBlankGrid(environmentState.gridRowsSetting, environmentState.gridColsSetting, options);
				break;
		}
		
		environmentState.replaceGrid(newGrid);
	}

	function randomizeSeed() {
		environmentState.environmentSeed = Math.floor(Math.random() * 1000000);
		handleGenerate();
	}
	
	function handleClear() {
		if (environmentState.environmentType === 'graph') {
			environmentState.clearGraph();
		} else {
			environmentState.clearGrid();
		}
	}

	function onEnvironmentChange(type: string) {
		environmentState.environmentType = type as any;
		if (type === 'graph' && (editorState.mode === 'wall' || editorState.mode === 'erase')) {
			editorState.mode = 'node';
		} else if (type !== 'graph' && (editorState.mode === 'node' || editorState.mode === 'edge' || editorState.mode === 'remove' || editorState.mode === 'move')) {
			editorState.mode = 'wall';
		}
	}

	const environmentDescriptions = {
		'perfect_maze': 'A connected maze with exactly one route between any two cells. No loops.',
		'braided_maze': 'A maze with intentionally added loops and alternative routes.',
		'random_obstacles': 'An arbitrary obstacle field. May contain multiple routes or disconnected regions.',
		'blank': 'An empty grid.',
		'graph': 'Manual node and edge editing mode.'
	};
</script>

<div class="flex h-full flex-col gap-6 p-4 overflow-y-auto">
	<!-- Algorithm Selection -->
	<div class="space-y-3">
		<Label>Algorithm</Label>
		<Select
			type="single"
			bind:value={environmentState.selectedAlgorithmId}
		>
			<SelectTrigger>
				{environmentState.currentAlgorithm?.name ?? 'Select algorithm'}
			</SelectTrigger>
			<SelectContent>
				{#each algorithmList as algo}
					<SelectItem value={algo.id}>{algo.name}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
		<p class="text-xs text-muted-foreground">
			{environmentState.currentAlgorithm?.description}
		</p>
	</div>

	<Separator />

	<!-- Environment & Grid -->
	<div class="space-y-4">
		<h3 class="text-sm font-medium">Environment</h3>
		
		<div class="space-y-3">
			<Select
				type="single"
				value={environmentState.environmentType}
				onValueChange={onEnvironmentChange}
			>
				<SelectTrigger>
					{#if environmentState.environmentType === 'perfect_maze'}
						Perfect Maze
					{:else if environmentState.environmentType === 'braided_maze'}
						Braided Maze
					{:else if environmentState.environmentType === 'random_obstacles'}
						Random Obstacles
					{:else if environmentState.environmentType === 'graph'}
						Manual Graph
					{:else}
						Blank Grid
					{/if}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="perfect_maze">Perfect Maze</SelectItem>
					<SelectItem value="braided_maze">Braided Maze</SelectItem>
					<SelectItem value="random_obstacles">Random Obstacles</SelectItem>
					<SelectItem value="blank">Blank Grid</SelectItem>
					<SelectItem value="graph">Manual Graph</SelectItem>
				</SelectContent>
			</Select>
			
			<p class="text-xs text-muted-foreground">
				{environmentDescriptions[environmentState.environmentType]}
			</p>
		</div>

		{#if environmentState.environmentType !== 'blank' && environmentState.environmentType !== 'graph'}
			<div class="flex flex-col gap-2">
				<Label class="text-xs">Seed</Label>
				<div class="flex gap-2">
					<input 
						type="number" 
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" 
						bind:value={environmentState.environmentSeed} 
					/>
					<Button variant="outline" size="icon" class="h-9 w-9 shrink-0" onclick={randomizeSeed} title="Randomize Seed">
						<Shuffle class="h-4 w-4" />
					</Button>
				</div>
			</div>
		{/if}

		{#if environmentState.environmentType !== 'graph'}
			<div class="flex gap-4">
				<div class="flex flex-col gap-2 w-1/2">
					<Label class="text-xs">Rows</Label>
					<input 
						type="number" 
						min="5" max="100"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
						bind:value={environmentState.gridRowsSetting} 
					/>
				</div>
				<div class="flex flex-col gap-2 w-1/2">
					<Label class="text-xs">Cols</Label>
					<input 
						type="number" 
						min="5" max="100"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" 
						bind:value={environmentState.gridColsSetting} 
					/>
				</div>
			</div>
		{/if}

		{#if environmentState.environmentType === 'braided_maze'}
			<div class="space-y-3 pt-2">
				<div class="flex items-center justify-between">
					<Label class="text-xs font-normal text-muted-foreground">Loop Density</Label>
					<span class="text-xs text-muted-foreground">{environmentState.loopDensity}%</span>
				</div>
				<Slider
					type="single"
					bind:value={environmentState.loopDensity}
					max={100}
					min={0}
					step={5}
				/>
			</div>
		{/if}

		{#if environmentState.environmentType === 'random_obstacles'}
			<div class="space-y-3 pt-2">
				<div class="flex items-center justify-between">
					<Label class="text-xs font-normal text-muted-foreground">Obstacle Density</Label>
					<span class="text-xs text-muted-foreground">{environmentState.obstacleDensity}%</span>
				</div>
				<Slider
					type="single"
					bind:value={environmentState.obstacleDensity}
					max={100}
					min={0}
					step={5}
				/>
			</div>
		{/if}

		{#if environmentState.environmentType === 'graph'}
			<div class="flex items-center justify-between">
				<Label for="directed" class="text-sm font-medium">Directed Edges</Label>
				<Switch
					id="directed"
					checked={environmentState.graphDirected}
					onCheckedChange={(v) => environmentState.setGraphDirected(v)}
				/>
			</div>
		{/if}

		<div class="grid grid-cols-2 gap-2 pt-2">
			{#if environmentState.environmentType !== 'graph'}
				<Button size="sm" onclick={handleGenerate}>Generate</Button>
				<Button variant="outline" size="sm" onclick={handleClear}>Clear</Button>
			{:else}
				<Button size="sm" disabled={!environmentState.graphCanUndo} onclick={() => environmentState.undoGraph()}>Undo</Button>
				<Button variant="outline" size="sm" disabled={!environmentState.graphCanRedo} onclick={() => environmentState.redoGraph()}>Redo</Button>
				<div class="col-span-2">
					<Button variant="outline" class="w-full" size="sm" onclick={handleClear}>Clear Graph</Button>
				</div>
			{/if}
		</div>
	</div>

	<Separator />

	<!-- Editing Tools -->
	<div class="space-y-3">
		<h3 class="text-sm font-medium">Tools</h3>
		
		{#snippet toolButton(value: string, label: string, Icon: any, iconClass: string = "h-4 w-4")}
			<ToggleGroupItem {value} aria-label={label} title={label}>
				<Icon class={iconClass} />
			</ToggleGroupItem>
		{/snippet}

		<ToggleGroup 
			type="single" 
			value={editorState.mode} 
			onValueChange={(v) => { if (v) editorState.mode = v as any; }}
			class="justify-start flex-wrap gap-1"
		>
			{#if environmentState.environmentType === 'graph'}
				{@render toolButton("node", "Add Node", Circle)}
				{@render toolButton("edge", "Add Edge", ArrowRight)}
				{@render toolButton("move", "Move Node", Move)}
				{@render toolButton("remove", "Remove Node/Edge", Trash2)}
			{:else}
				{@render toolButton("wall", "Draw Walls", MousePointer2)}
				{@render toolButton("erase", "Erase", Eraser)}
			{/if}

			{@render toolButton("start", "Set Start", Flag, "h-4 w-4 text-green-500")}
			{@render toolButton("goal", "Set Goal", Target, "h-4 w-4 text-red-500")}
			
			{#if environmentState.currentAlgorithm?.supportsWeights}
				{@render toolButton("weight", "Set Weight", Weight)}
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
					min={1}
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
				checked={environmentState.showCosts}
				onCheckedChange={(v) => environmentState.showCosts = v}
			/>
		</div>
		
		<PlaybackControls />
	</div>
</div>
