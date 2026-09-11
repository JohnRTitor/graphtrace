<script lang="ts">
	import { algorithmList } from '$lib/algorithms';
	import { environmentState } from '$lib/state/environment.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { generateRandomGrid, generateBlankGrid } from '$lib/generators/random';
	import { generatePerfectMaze, generateBraidedMaze } from '$lib/generators/maze';
	import { generateRandomGraph } from '$lib/generators/random-graph';
	
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { Slider } from '$lib/components/ui/slider';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	
	import Shuffle from '@lucide/svelte/icons/shuffle';

	function handleGenerate() {
		if (environmentState.environmentType === 'graph') {
			const options = {
				nodeCount: environmentState.graphNodeCount,
				edgeMultiplier: environmentState.graphEdgeMultiplier,
				directed: environmentState.graphDirected,
				weighted: environmentState.graphWeighted && !!environmentState.currentAlgorithm?.supportsWeights,
				ensurePath: environmentState.graphEnsurePath,
				seed: environmentState.environmentSeed
			};
			const snapshot = generateRandomGraph(options);
			environmentState.replaceGraph(snapshot.nodes, snapshot.edges, snapshot.start, snapshot.goal, snapshot.directed);
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

		{#if environmentState.environmentType !== 'blank'}
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
			<div class="space-y-3 pt-2">
				<div class="flex flex-col gap-2">
					<Label class="text-xs">Nodes</Label>
					<Select type="single" value={environmentState.graphNodeCount.toString()} onValueChange={(v) => environmentState.graphNodeCount = parseInt(v)}>
						<SelectTrigger>{environmentState.graphNodeCount}</SelectTrigger>
						<SelectContent>
							{#each [5, 10, 15, 20, 25, 30, 40, 50, 75, 100] as count}
								<SelectItem value={count.toString()}>{count}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<div class="space-y-3 pt-2">
					<div class="flex items-center justify-between">
						<Label class="text-xs font-normal text-muted-foreground">Edge Density</Label>
						<span class="text-xs text-muted-foreground">{environmentState.graphEdgeMultiplier.toFixed(1)}x</span>
					</div>
					<Slider
						type="single"
						value={environmentState.graphEdgeMultiplier}
						onValueChange={(v) => environmentState.graphEdgeMultiplier = v as number}
						max={10}
						min={0.5}
						step={0.5}
					/>
				</div>

				<div class="flex items-center justify-between">
					<Label for="ensure-path" class="text-xs font-medium">Ensure path Start → Goal</Label>
					<Switch id="ensure-path" checked={environmentState.graphEnsurePath} onCheckedChange={(v) => environmentState.graphEnsurePath = v} />
				</div>
				{#if environmentState.currentAlgorithm?.supportsWeights}
				<div class="flex items-center justify-between">
					<Label for="weighted-graph" class="text-xs font-medium">Weighted edges</Label>
					<Switch id="weighted-graph" checked={environmentState.graphWeighted} onCheckedChange={(v) => environmentState.graphWeighted = v} />
				</div>
				{/if}
			</div>

			<div class="flex items-center justify-between pt-2">
				<Label for="directed" class="text-xs font-medium text-muted-foreground">Directed Edges</Label>
				<Switch
					id="directed"
					checked={environmentState.graphDirected}
					onCheckedChange={(v) => environmentState.setGraphDirected(v)}
				/>
			</div>
			
			<Button variant="secondary" size="sm" class="w-full mt-2" onclick={handleGenerate}>Generate Random Graph</Button>
		{/if}

		<div class="grid grid-cols-2 gap-2 pt-2">
			{#if environmentState.environmentType !== 'graph'}
				<Button size="sm" onclick={handleGenerate}>Generate</Button>
				<Button variant="outline" size="sm" onclick={handleClear}>Clear</Button>
			{:else}
				<Button size="sm" disabled={!environmentState.canUndo} onclick={() => environmentState.undo()}>Undo</Button>
				<Button variant="outline" size="sm" disabled={!environmentState.canRedo} onclick={() => environmentState.redo()}>Redo</Button>
				<div class="col-span-2">
					<Button variant="outline" class="w-full" size="sm" onclick={handleClear}>Clear Graph</Button>
				</div>
			{/if}
		</div>
	</div>

</div>
