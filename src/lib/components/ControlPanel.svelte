<script lang="ts">
	import { algorithmList } from '$lib/algorithms';
	import { settingsState } from '$lib/state/settings.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { gridState } from '$lib/state/grid.svelte';
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

	import Shuffle from '@lucide/svelte/icons/shuffle';

	function handleGenerate() {
		const options = {
			seed: settingsState.environmentSeed,
			loopDensity: settingsState.loopDensity,
			obstacleDensity: settingsState.obstacleDensity,
			weighted: settingsState.currentAlgorithm?.supportsWeights
		};

		let newGrid;
		switch (settingsState.environmentType) {
			case 'perfect_maze':
				newGrid = generatePerfectMaze(gridState.rows, gridState.cols, options);
				break;
			case 'braided_maze':
				newGrid = generateBraidedMaze(gridState.rows, gridState.cols, options);
				break;
			case 'random_obstacles':
				newGrid = generateRandomGrid(gridState.rows, gridState.cols, options);
				break;
			case 'blank':
			default:
				newGrid = generateBlankGrid(gridState.rows, gridState.cols, options);
				break;
		}
		
		gridState.replaceGrid(newGrid);
	}

	function randomizeSeed() {
		settingsState.environmentSeed = Math.floor(Math.random() * 1000000);
		handleGenerate();
	}
	
	function handleClear() {
		gridState.clear();
	}

	const environmentDescriptions = {
		'perfect_maze': 'A connected maze with exactly one route between any two cells. No loops.',
		'braided_maze': 'A maze with intentionally added loops and alternative routes.',
		'random_obstacles': 'An arbitrary obstacle field. May contain multiple routes or disconnected regions.',
		'blank': 'An empty grid.'
	};
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
		
		<div class="space-y-3">
			<Select
				type="single"
				bind:value={settingsState.environmentType}
			>
				<SelectTrigger>
					{#if settingsState.environmentType === 'perfect_maze'}
						Perfect Maze
					{:else if settingsState.environmentType === 'braided_maze'}
						Braided Maze
					{:else if settingsState.environmentType === 'random_obstacles'}
						Random Obstacles
					{:else}
						Blank Grid
					{/if}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="perfect_maze">Perfect Maze</SelectItem>
					<SelectItem value="braided_maze">Braided Maze</SelectItem>
					<SelectItem value="random_obstacles">Random Obstacles</SelectItem>
					<SelectItem value="blank">Blank Grid</SelectItem>
				</SelectContent>
			</Select>
			
			<p class="text-xs text-muted-foreground">
				{environmentDescriptions[settingsState.environmentType]}
			</p>
		</div>

		{#if settingsState.environmentType !== 'blank'}
			<div class="flex flex-col gap-2">
				<Label class="text-xs">Seed</Label>
				<div class="flex gap-2">
					<input 
						type="number" 
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" 
						bind:value={settingsState.environmentSeed} 
					/>
					<Button variant="outline" size="icon" class="h-9 w-9 shrink-0" onclick={randomizeSeed} title="Randomize Seed">
						<Shuffle class="h-4 w-4" />
					</Button>
				</div>
			</div>
		{/if}

		{#if settingsState.environmentType === 'braided_maze'}
			<div class="space-y-3 pt-2">
				<div class="flex items-center justify-between">
					<Label class="text-xs font-normal text-muted-foreground">Loop Density</Label>
					<span class="text-xs text-muted-foreground">{settingsState.loopDensity}%</span>
				</div>
				<Slider
					type="single"
					bind:value={settingsState.loopDensity}
					max={100}
					min={0}
					step={5}
				/>
			</div>
		{/if}

		{#if settingsState.environmentType === 'random_obstacles'}
			<div class="space-y-3 pt-2">
				<div class="flex items-center justify-between">
					<Label class="text-xs font-normal text-muted-foreground">Obstacle Density</Label>
					<span class="text-xs text-muted-foreground">{settingsState.obstacleDensity}%</span>
				</div>
				<Slider
					type="single"
					bind:value={settingsState.obstacleDensity}
					max={100}
					min={0}
					step={5}
				/>
			</div>
		{/if}

		<div class="grid grid-cols-2 gap-2 pt-2">
			<Button size="sm" onclick={handleGenerate}>Generate</Button>
			<Button variant="outline" size="sm" onclick={handleClear}>Clear Grid</Button>
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
