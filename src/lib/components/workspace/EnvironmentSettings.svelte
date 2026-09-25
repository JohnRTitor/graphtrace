<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Slider } from '$lib/components/ui/slider';
	import { Switch } from '$lib/components/ui/switch';
	import { Separator } from '$lib/components/ui/separator';
	import { environmentState } from '$lib/state/environment.svelte';
	import { getAlgorithmSummary } from '$lib/algorithms';
	import Shuffle from '@lucide/svelte/icons/shuffle';

	/**
	 * The Parameters tab.
	 *
	 * Every control here is family-specific, which is the reason the tab exists:
	 * pathfinding exposes cell costs and grid dimensions, adversarial exposes
	 * branching and search depth, and neither needs to know about the other.
	 */
	let family = $derived(environmentState.family);
	let isAdversarial = $derived(environmentState.isAdversarialFamily);

	const ENVIRONMENT_LABELS: Record<string, string> = {
		perfect_maze: 'Perfect Maze',
		braided_maze: 'Braided Maze',
		random_obstacles: 'Random Obstacles',
		blank: 'Blank Grid',
		graph: 'Manual Graph',
		manual_tree: 'Manual Tree',
		tic_tac_toe: 'Tic-Tac-Toe (full)',
		tic_tac_toe_limited: 'Tic-Tac-Toe (depth limited)',
		nim: 'Nim',
		random_tree: 'Random Game Tree'
	};

	const ENVIRONMENT_DESCRIPTIONS: Record<string, string> = {
		perfect_maze: 'A connected maze with exactly one route between any two cells. No loops.',
		braided_maze: 'A maze with intentionally added loops and alternative routes.',
		random_obstacles: 'An arbitrary obstacle field. May contain multiple routes or disconnected regions.',
		blank: 'An empty grid.',
		graph: 'Manual node and edge editing mode.',
		manual_tree: 'A small tree you edit by hand. Set terminal utilities and add moves.',
		tic_tac_toe: 'The full game from a fixed opening. No heuristics: every leaf is a real outcome.',
		tic_tac_toe_limited: 'Cut off at a fixed depth and scored with a heuristic, as a real engine would.',
		nim: 'Normal-play Nim. Every position resolves to a win or a loss; there are no draws.',
		random_tree: 'Uniform structure with random utilities - the honest baseline for pruning.'
	};

	const inputClass =
		'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm gt-transition-state focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

	function onEnvironmentChange(type: string) {
		environmentState.environmentType = type as typeof environmentState.environmentType;
	}
</script>

<div class="space-y-5 p-4">
	<section class="space-y-2">
		<Label for="environment-select" class="text-xs">Environment</Label>
		<select
			id="environment-select"
			class={inputClass}
			value={environmentState.environmentType}
			onchange={(event) => onEnvironmentChange(event.currentTarget.value)}
		>
			{#each family?.environmentTypes ?? [] as type (type)}
				<option value={type}>{ENVIRONMENT_LABELS[type] ?? type}</option>
			{/each}
		</select>
		<p class="text-xs leading-relaxed text-muted-foreground">
			{ENVIRONMENT_DESCRIPTIONS[environmentState.environmentType] ?? ''}
		</p>
	</section>

	<Separator />

	<section class="space-y-3">
		<Label for="seed-input" class="text-xs">Seed</Label>
		<div class="flex gap-2">
			<input
				id="seed-input"
				type="number"
				class="{inputClass} gt-mono"
				bind:value={environmentState.environmentSeed}
			/>
			<button
				type="button"
				class="gt-mono h-9 w-9 shrink-0 rounded-md border gt-transition-feedback hover:bg-accent"
				onclick={() => (environmentState.environmentSeed = Math.floor(Math.random() * 1000000))}
				title="Randomize seed and regenerate"
				aria-label="Randomize seed and regenerate"
			>
				<Shuffle class="mx-auto h-4 w-4" />
			</button>
		</div>
		<p class="text-xs text-muted-foreground">
			Changing the seed and regenerating reproduces a tree exactly.
		</p>
	</section>

	{#if isAdversarial}
		<Separator />
		<section class="space-y-4">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search space</h3>

			{#if environmentState.environmentType === 'tic_tac_toe_limited'}
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<Label for="ttt-depth" class="text-xs font-normal text-muted-foreground">Depth limit</Label>
						<span class="gt-mono text-xs text-muted-foreground">{environmentState.gameTreeOptions.tttDepth} plies</span>
					</div>
					<Slider
						id="ttt-depth"
						type="single"
						value={environmentState.gameTreeOptions.tttDepth}
						onValueChange={(value) => environmentState.updateGameTreeOptions({ tttDepth: value })}
						min={1}
						max={7}
						step={1}
					/>
					<p class="text-xs text-muted-foreground">
						Nodes at the cut are scored by a heuristic instead of a real outcome.
					</p>
				</div>
			{/if}

			{#if environmentState.environmentType === 'nim'}
				<div class="flex flex-col gap-2">
					<Label for="nim-heaps" class="text-xs">Heaps</Label>
					<input
						id="nim-heaps"
						type="number"
						min="1"
						max="3"
						class="{inputClass} gt-mono"
						value={environmentState.gameTreeOptions.nimHeapCount}
						onchange={(event) =>
							environmentState.updateGameTreeOptions({ nimHeapCount: Number(event.currentTarget.value) })}
					/>
					<Label for="nim-stones" class="mt-2 text-xs">Max stones per heap</Label>
					<input
						id="nim-stones"
						type="number"
						min="1"
						max="3"
						class="{inputClass} gt-mono"
						value={environmentState.gameTreeOptions.nimMaxStones}
						onchange={(event) =>
							environmentState.updateGameTreeOptions({ nimMaxStones: Number(event.currentTarget.value) })}
					/>
					<p class="text-xs text-muted-foreground">
						Bounded so the whole tree stays under a couple of thousand nodes.
					</p>
				</div>
			{/if}

			{#if environmentState.environmentType === 'random_tree'}
				<div class="space-y-3">
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<Label for="branching" class="text-xs font-normal text-muted-foreground">Branching factor</Label>
							<span class="gt-mono text-xs text-muted-foreground">{environmentState.gameTreeOptions.randomBranching}</span>
						</div>
						<Slider
							id="branching"
							type="single"
							value={environmentState.gameTreeOptions.randomBranching}
							onValueChange={(value) => environmentState.updateGameTreeOptions({ randomBranching: value })}
							min={2}
							max={6}
							step={1}
						/>
					</div>
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<Label for="random-depth" class="text-xs font-normal text-muted-foreground">Depth</Label>
							<span class="gt-mono text-xs text-muted-foreground">{environmentState.gameTreeOptions.randomDepth}</span>
						</div>
						<Slider
							id="random-depth"
							type="single"
							value={environmentState.gameTreeOptions.randomDepth}
							onValueChange={(value) => environmentState.updateGameTreeOptions({ randomDepth: value })}
							min={1}
							max={5}
							step={1}
						/>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="space-y-1">
							<Label for="min-util" class="text-xs">Min utility</Label>
							<input
								id="min-util"
								type="number"
								class="{inputClass} gt-mono"
								value={environmentState.gameTreeOptions.randomMinUtility}
								onchange={(event) =>
									environmentState.updateGameTreeOptions({ randomMinUtility: Number(event.currentTarget.value) })}
							/>
						</div>
						<div class="space-y-1">
							<Label for="max-util" class="text-xs">Max utility</Label>
							<input
								id="max-util"
								type="number"
								class="{inputClass} gt-mono"
								value={environmentState.gameTreeOptions.randomMaxUtility}
								onchange={(event) =>
									environmentState.updateGameTreeOptions({ randomMaxUtility: Number(event.currentTarget.value) })}
							/>
						</div>
					</div>
				</div>
			{/if}

			{#if environmentState.environmentType === 'manual_tree'}
				<button
					type="button"
					class="w-full rounded-md border px-3 py-2 text-xs font-medium gt-transition-feedback hover:bg-accent"
					onclick={() => environmentState.randomizeGameTreeTerminals()}
				>
					Randomize terminal utilities
				</button>
			{/if}
		</section>
	{:else}
		<Separator />

		{#if environmentState.environmentType !== 'graph'}
			<section class="space-y-3">
				<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grid</h3>
				<div class="grid grid-cols-2 gap-2">
					<div class="space-y-1">
						<Label for="grid-rows" class="text-xs">Rows</Label>
						<input
							id="grid-rows"
							type="number"
							min="5"
							max="100"
							class="{inputClass} gt-mono"
							bind:value={environmentState.gridRowsSetting}
						/>
					</div>
					<div class="space-y-1">
						<Label for="grid-cols" class="text-xs">Cols</Label>
						<input
							id="grid-cols"
							type="number"
							min="5"
							max="100"
							class="{inputClass} gt-mono"
							bind:value={environmentState.gridColsSetting}
						/>
					</div>
				</div>
			</section>
		{/if}

		{#if environmentState.environmentType === 'braided_maze'}
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label for="loop-density" class="text-xs font-normal text-muted-foreground">Loop density</Label>
					<span class="gt-mono text-xs text-muted-foreground">{environmentState.loopDensity}%</span>
				</div>
				<Slider
					id="loop-density"
					type="single"
					bind:value={environmentState.loopDensity}
					min={0}
					max={100}
					step={5}
				/>
			</div>
		{/if}

		{#if environmentState.environmentType === 'random_obstacles'}
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label for="obstacle-density" class="text-xs font-normal text-muted-foreground">Obstacle density</Label>
					<span class="gt-mono text-xs text-muted-foreground">{environmentState.obstacleDensity}%</span>
				</div>
				<Slider
					id="obstacle-density"
					type="single"
					bind:value={environmentState.obstacleDensity}
					min={0}
					max={100}
					step={5}
				/>
			</div>
		{/if}

		{#if environmentState.environmentType === 'graph'}
			<section class="space-y-3">
				<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Graph</h3>
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<Label for="node-count" class="text-xs font-normal text-muted-foreground">Nodes</Label>
						<span class="gt-mono text-xs text-muted-foreground">{environmentState.graphNodeCount}</span>
					</div>
					<Slider
						id="node-count"
						type="single"
						value={environmentState.graphNodeCount}
						onValueChange={(value) => (environmentState.graphNodeCount = value)}
						min={5}
						max={100}
						step={5}
					/>
				</div>
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<Label for="edge-density" class="text-xs font-normal text-muted-foreground">Edge density</Label>
						<span class="gt-mono text-xs text-muted-foreground">{environmentState.graphEdgeMultiplier.toFixed(1)}x</span>
					</div>
					<Slider
						id="edge-density"
						type="single"
						value={environmentState.graphEdgeMultiplier}
						onValueChange={(value) => (environmentState.graphEdgeMultiplier = value)}
						min={0.5}
						max={10}
						step={0.5}
					/>
				</div>
				<div class="flex items-center justify-between">
					<Label for="ensure-path" class="text-xs font-medium">Ensure path Start → Goal</Label>
					<Switch
						id="ensure-path"
						checked={environmentState.graphEnsurePath}
						onCheckedChange={(value) => (environmentState.graphEnsurePath = value)}
					/>
				</div>
				{#if getAlgorithmSummary(environmentState.selectedAlgorithmId)?.supportsWeights}
					<div class="flex items-center justify-between">
						<Label for="weighted-graph" class="text-xs font-medium">Weighted edges</Label>
						<Switch
							id="weighted-graph"
							checked={environmentState.graphWeighted}
							onCheckedChange={(value) => (environmentState.graphWeighted = value)}
						/>
					</div>
				{/if}
				<div class="flex items-center justify-between">
					<Label for="directed-graph" class="text-xs font-medium">New edges directed by default</Label>
					<Switch
						id="directed-graph"
						checked={environmentState.defaultEdgeDirected}
						onCheckedChange={(value) => (environmentState.defaultEdgeDirected = value)}
					/>
				</div>
			</section>
		{/if}
	{/if}
</div>
