<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Slider } from '$lib/components/ui/slider';
	import { Switch } from '$lib/components/ui/switch';
	import { Separator } from '$lib/components/ui/separator';
	import { Input } from '$lib/components/ui/input';
	import { InputGroup, InputGroupAddon, InputGroupInput } from '$lib/components/ui/input-group';
	import { Button } from '$lib/components/ui/button';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui/select';
	import { environmentState } from '$lib/state/environment.svelte';
	import { getAlgorithmSummary } from '$lib/algorithms';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import Dices from '@lucide/svelte/icons/dices';

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

	/**
	 * Section heading.
	 *
	 * `text-[11px] uppercase` rather than `text-xs`: this panel is read at a
	 * glance next to a canvas, and the heading is a label for the group below
	 * it rather than prose. The one place a heading is genuinely prose - the
	 * algorithm notes in the Algorithm tab - uses normal case.
	 */
	const SECTION_HEADING = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

	/**
	 * The one control in this panel that is tall enough to hit on a phone and
	 * dense enough to sit in a sidebar on a desktop. The `sm:` easing rather than
	 * a bare size is the same rule as `--tap`, expressed per control: the panel is
	 * a fixed-width column, so a fixed 44px row would push the third control below
	 * the fold on a 13" laptop for no gain.
	 */
	const CONTROL_HEIGHT = 'h-11 sm:h-9';

	function onEnvironmentChange(type: string) {
		environmentState.environmentType = type as typeof environmentState.environmentType;
	}
</script>

<!--
	A slider with its current value in the label row.

	The read-out is a sibling of the label rather than inside it, so the whole
	row is one tap target and the number is not part of the accessible name -
	the slider announces its own value.
-->
{#snippet sliderRow(
	id: string,
	label: string,
	readout: string,
	min: number,
	max: number,
	step: number,
	current: number,
	set: (value: number) => void
)}
	<div class="space-y-2">
		<div class="flex items-center justify-between gap-2">
			<Label for={id} class="text-xs font-normal text-muted-foreground">{label}</Label>
			<span class="gt-mono text-xs text-muted-foreground">{readout}</span>
		</div>
		<Slider {id} type="single" value={current} onValueChange={set} {min} {max} {step} />
	</div>
{/snippet}

{#snippet switchRow(id: string, label: string, checked: boolean, set: (value: boolean) => void)}
	<div class="flex min-h-11 items-center justify-between gap-3">
		<Label for={id} class="text-xs font-medium">{label}</Label>
		<Switch {id} checked={checked} onCheckedChange={set} />
	</div>
{/snippet}

<!--
	Spacing is the mobile design here, not decoration. This panel shares a column
	with a canvas, so every block it gives to padding is a block the visualisation
	loses: `space-y-4 p-3` on a phone, easing to the roomier `space-y-5 p-4` from
	`sm` where the canvas has pixels to spare.
-->
<div class="space-y-4 p-3 sm:space-y-5 sm:p-4">
	<section class="space-y-2">
		<Label for="environment-select" class="text-xs">Environment</Label>
		<Select
			type="single"
			value={environmentState.environmentType}
			onValueChange={(value) => {
				if (value) onEnvironmentChange(value);
			}}
		>
			<SelectTrigger
				id="environment-select"
				class="data-[size=default]:h-11 w-full sm:data-[size=default]:h-9"
			>
				<!--
					The label is read from the environment state rather than from
					`SelectValue`. bits-ui derives `SelectValue` from the *mounted*
					items, and the only way to keep those mounted is `forceMount` on
					the content - which renders the listbox inside the builder sheet's
					stacking context, where the sheet's own content paints over it and
					the options stop being clickable on a phone.
					The state is the source of truth here anyway, so reading it is both
					simpler and more correct, and it is what the trigger's accessible
					name comes from.
				-->
				<span data-slot="select-value" class="truncate">
					{ENVIRONMENT_LABELS[environmentState.environmentType] ??
						environmentState.environmentType ??
						'Choose an environment'}
				</span>
			</SelectTrigger>
			<SelectContent>
				{#each family?.environmentTypes ?? [] as type (type)}
					<SelectItem value={type} label={ENVIRONMENT_LABELS[type] ?? type}>
						{ENVIRONMENT_LABELS[type] ?? type}
					</SelectItem>
				{/each}
			</SelectContent>
		</Select>
		<p class="text-xs leading-relaxed text-muted-foreground">
			{ENVIRONMENT_DESCRIPTIONS[environmentState.environmentType] ?? ''}
		</p>
	</section>

	<Separator />

	<section class="space-y-2">
		<Label for="seed-input" class="text-xs">Seed</Label>
		<InputGroup class="h-11 sm:h-9">
			<InputGroupInput
				id="seed-input"
				type="number"
				class="gt-mono"
				bind:value={environmentState.environmentSeed}
			/>
			<InputGroupAddon class="py-0">
				<Button
					variant="ghost"
					size="icon"
					class="size-11 sm:size-9"
					onclick={() => (environmentState.environmentSeed = Math.floor(Math.random() * 1000000))}
					aria-label="Randomize seed"
				>
					<Shuffle class="h-4 w-4" />
				</Button>
			</InputGroupAddon>
		</InputGroup>
		<p class="text-xs text-muted-foreground">
			Changing the seed and regenerating reproduces a tree exactly.
		</p>
	</section>

	{#if isAdversarial}
		<Separator />
		<section class="space-y-4">
			<h3 class={SECTION_HEADING}>Search space</h3>

			{#if environmentState.environmentType === 'tic_tac_toe_limited'}
				{@render sliderRow(
					'ttt-depth',
					'Depth limit',
					`${environmentState.gameTreeOptions.tttDepth} plies`,
					1,
					7,
					1,
					environmentState.gameTreeOptions.tttDepth,
					(value) => environmentState.updateGameTreeOptions({ tttDepth: value })
				)}
				<p class="text-xs text-muted-foreground">
					Nodes at the cut are scored by a heuristic instead of a real outcome.
				</p>
			{/if}

			{#if environmentState.environmentType === 'nim'}
				<div class="grid grid-cols-2 gap-2">
					<div class="space-y-1">
						<Label for="nim-heaps" class="text-xs">Heaps</Label>
						<Input
							id="nim-heaps"
							type="number"
							min="1"
							max="3"
							class="gt-mono {CONTROL_HEIGHT}"
							value={environmentState.gameTreeOptions.nimHeapCount}
							onchange={(event) =>
								environmentState.updateGameTreeOptions({
									nimHeapCount: Number(event.currentTarget.value)
								})}
						/>
					</div>
					<div class="space-y-1">
						<Label for="nim-stones" class="text-xs">Max stones</Label>
						<Input
							id="nim-stones"
							type="number"
							min="1"
							max="3"
							class="gt-mono {CONTROL_HEIGHT}"
							value={environmentState.gameTreeOptions.nimMaxStones}
							onchange={(event) =>
								environmentState.updateGameTreeOptions({
									nimMaxStones: Number(event.currentTarget.value)
								})}
						/>
					</div>
				</div>
				<p class="text-xs text-muted-foreground">
					Bounded so the whole tree stays under a couple of thousand nodes.
				</p>
			{/if}

			{#if environmentState.environmentType === 'random_tree'}
				<div class="space-y-3">
					{@render sliderRow(
						'branching',
						'Branching factor',
						String(environmentState.gameTreeOptions.randomBranching),
						2,
						6,
						1,
						environmentState.gameTreeOptions.randomBranching,
						(value) => environmentState.updateGameTreeOptions({ randomBranching: value })
					)}
					{@render sliderRow(
						'random-depth',
						'Depth',
						String(environmentState.gameTreeOptions.randomDepth),
						1,
						5,
						1,
						environmentState.gameTreeOptions.randomDepth,
						(value) => environmentState.updateGameTreeOptions({ randomDepth: value })
					)}
					<div class="grid grid-cols-2 gap-2">
						<div class="space-y-1">
							<Label for="min-util" class="text-xs">Min utility</Label>
							<Input
								id="min-util"
								type="number"
								class="gt-mono {CONTROL_HEIGHT}"
								value={environmentState.gameTreeOptions.randomMinUtility}
								onchange={(event) =>
									environmentState.updateGameTreeOptions({
										randomMinUtility: Number(event.currentTarget.value)
									})}
							/>
						</div>
						<div class="space-y-1">
							<Label for="max-util" class="text-xs">Max utility</Label>
							<Input
								id="max-util"
								type="number"
								class="gt-mono {CONTROL_HEIGHT}"
								value={environmentState.gameTreeOptions.randomMaxUtility}
								onchange={(event) =>
									environmentState.updateGameTreeOptions({
										randomMaxUtility: Number(event.currentTarget.value)
									})}
							/>
						</div>
					</div>
				</div>
			{/if}

			{#if environmentState.environmentType === 'manual_tree'}
				<Button
					variant="outline"
					size="sm"
					class="h-11 w-full sm:h-8"
					onclick={() => environmentState.randomizeGameTreeTerminals()}
				>
					<Dices class="h-3.5 w-3.5" />
					Randomize terminal utilities
				</Button>
			{/if}
		</section>
	{:else}
		<Separator />

		{#if environmentState.environmentType !== 'graph'}
			<section class="space-y-3">
				<h3 class={SECTION_HEADING}>Grid</h3>
				<div class="grid grid-cols-2 gap-2">
					<div class="space-y-1">
						<Label for="grid-rows" class="text-xs">Rows</Label>
						<Input
							id="grid-rows"
							type="number"
							min="5"
							max="100"
							class="gt-mono {CONTROL_HEIGHT}"
							bind:value={environmentState.gridRowsSetting}
						/>
					</div>
					<div class="space-y-1">
						<Label for="grid-cols" class="text-xs">Cols</Label>
						<Input
							id="grid-cols"
							type="number"
							min="5"
							max="100"
							class="gt-mono {CONTROL_HEIGHT}"
							bind:value={environmentState.gridColsSetting}
						/>
					</div>
				</div>
			</section>
		{/if}

		{#if environmentState.environmentType === 'braided_maze'}
			{@render sliderRow(
				'loop-density',
				'Loop density',
				`${environmentState.loopDensity}%`,
				0,
				100,
				5,
				environmentState.loopDensity,
				(value) => (environmentState.loopDensity = value)
			)}
		{/if}

		{#if environmentState.environmentType === 'random_obstacles'}
			{@render sliderRow(
				'obstacle-density',
				'Obstacle density',
				`${environmentState.obstacleDensity}%`,
				0,
				100,
				5,
				environmentState.obstacleDensity,
				(value) => (environmentState.obstacleDensity = value)
			)}
		{/if}

		{#if environmentState.environmentType === 'graph'}
			<section class="space-y-3">
				<h3 class={SECTION_HEADING}>Graph</h3>
				{@render sliderRow(
					'node-count',
					'Nodes',
					String(environmentState.graphNodeCount),
					5,
					100,
					5,
					environmentState.graphNodeCount,
					(value) => (environmentState.graphNodeCount = value)
				)}
				{@render sliderRow(
					'edge-density',
					'Edge density',
					`${environmentState.graphEdgeMultiplier.toFixed(1)}x`,
					0.5,
					10,
					0.5,
					environmentState.graphEdgeMultiplier,
					(value) => (environmentState.graphEdgeMultiplier = value)
				)}
				{@render switchRow(
					'ensure-path',
					'Ensure path Start → Goal',
					environmentState.graphEnsurePath,
					(value) => (environmentState.graphEnsurePath = value)
				)}
				{#if getAlgorithmSummary(environmentState.selectedAlgorithmId)?.supportsWeights}
					{@render switchRow(
						'weighted-graph',
						'Weighted edges',
						environmentState.graphWeighted,
						(value) => (environmentState.graphWeighted = value)
					)}
				{/if}
				{@render switchRow(
					'directed-graph',
					'New edges directed',
					environmentState.defaultEdgeDirected,
					(value) => (environmentState.defaultEdgeDirected = value)
				)}
			</section>
		{/if}
	{/if}
</div>
