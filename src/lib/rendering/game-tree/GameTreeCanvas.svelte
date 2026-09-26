<script lang="ts">
	import {
		SvelteFlow,
		Background,
		BackgroundVariant,
		Controls,
		useSvelteFlow,
		type NodeTypes,
		type EdgeTypes,
		type Node,
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { environmentState } from '$lib/state/environment.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { invalidatePlaybackIfNeeded } from '$lib/state/invalidate';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import GameTreeNode from './GameTreeNode.svelte';
	import GameTreeEdge from './GameTreeEdge.svelte';
	import { toTreeEdges, toTreeNodes, treeColors } from './tree-adapter';
	import { playbackState, type PlaybackState } from '$lib/state/playback.svelte';
	import type { NodeId } from '$lib/graph/types';
	import type { GamePlayer } from '$lib/graph/game-tree';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';

	let { playback = playbackState }: { playback?: PlaybackState } = $props();

	const nodeTypes: NodeTypes = { tree: GameTreeNode };
	const edgeTypes: EdgeTypes = { tree: GameTreeEdge };

	const { fitView } = useSvelteFlow();

	let isDark = $state(false);
	let showValues = $state(true);

	onMount(() => {
		if (!browser) return;
		const read = () => {
			isDark = document.documentElement.classList.contains('dark');
		};
		const observer = new MutationObserver(read);
		observer.observe(document.documentElement, { attributes: true });
		read();
		return () => observer.disconnect();
	});

	// The trace's own snapshot wins when a trace is loaded, so scrubbing a
	// recorded run never re-renders against an environment that has moved on.
	let tree = $derived(
		playback.problem?.type === 'game-tree' ? playback.problem.tree : environmentState.gameTree
	);
	let colors = $derived(treeColors(isDark ? 'dark' : 'light'));
	let flow = $derived(toTreeNodes(tree, playback.gameTreeState, colors, showValues));
	let edges = $derived(toTreeEdges(tree, playback.gameTreeState, colors));

	let selectedNode = $state<NodeId | null>(null);
	let selectedNodeModel = $derived(selectedNode ? (tree.nodes.get(selectedNode) ?? null) : null);

	/**
	 * Re-frame on an aspect-ratio change.
	 *
	 * xyflow keeps its own resize observer, so the surface is always the right
	 * size; what goes stale on a rotation is the framing. Only a large change
	 * triggers it, so an ordinary resize does not fight a user who has panned,
	 * and the tree is not tiny because the phone turned sideways.
	 */
	let surfaceElement = $state<HTMLDivElement | null>(null);
	let lastAspect = $state(0);

	$effect(() => {
		const element = surfaceElement;
		if (!element) return;
		const width = element.clientWidth;
		const height = element.clientHeight;
		if (!width || !height) return;
		const aspect = width / height;
		const previous = lastAspect;
		lastAspect = aspect;
		if (previous && Math.abs(aspect - previous) > 0.15 && browser) {
			untrack(() => fitView({ duration: 0 }));
		}
	});

	$effect(() => {
		// Re-fit when the tree's shape changes, not on every trace step: refitting
		// per step would fight the user's own panning.
		void tree.nodes.size;
		// `untrack` is load-bearing. `fitView` reads the viewport to decide where to
		// pan and then writes it, and inside an effect those reads become
		// dependencies of this effect - so writing the viewport re-triggers it,
		// which fits again. An animated fit then re-arms itself every frame until
		// Svelte aborts with `effect_update_depth_exceeded` and the page stops
		// responding to input entirely.
		if (browser) untrack(() => fitView({ duration: 200 }));
	});

	function handleNodeClick({ node }: { node: Node }) {
		selectedNode = node.id;
		if (executionStore.isComparing) return;
		if (editorState.mode === 'remove') {
			environmentState.removeGameTreeNode(node.id);
		}
	}

	function handlePaneClick() {
		selectedNode = null;
	}

	function addChild() {
		const parent = selectedNode ?? tree.root;
		if (parent) environmentState.addGameTreeChild(parent);
	}

	function makeRoot() {
		if (selectedNode) environmentState.makeGameTreeRoot(selectedNode);
	}

	const ROLE_LABELS: Record<GamePlayer, string> = { max: 'MAX to move', min: 'MIN to move', terminal: 'Terminal' };
</script>

<div
	bind:this={surfaceElement}
	class="relative h-full w-full"
	style:color-scheme={isDark ? 'dark' : 'light'}
	style:touch-action="none"
	role="application"
	aria-label="Game tree editor"
>
	<SvelteFlow
		nodes={flow.nodes}
		{edges}
		{nodeTypes}
		{edgeTypes}
		colorMode={isDark ? 'dark' : 'light'}
		onnodeclick={handleNodeClick}
		onpaneclick={handlePaneClick}
		fitView
		minZoom={0.05}
		maxZoom={2.5}
		nodesDraggable={false}
		nodesConnectable={false}
		elementsSelectable={!executionStore.isComparing}
		panOnScroll
	>
		<Background variant={BackgroundVariant.Dots} gap={24} />
		<Controls position="bottom-right" />
	</SvelteFlow>

	<!--
		Tree editing surface. Game moves and utilities are not graph topology, so
		this panel is deliberately separate from the manual graph's tool strip: the
		tools here act on a selection, not on a paint mode.
	-->
	<div
		class="gt-transition-panel absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-col gap-2 rounded-lg border bg-card/90 p-2 shadow-lg backdrop-blur-sm sm:bottom-4 sm:left-4"
	>
		<div class="flex items-center gap-1">
			<Button
				variant="outline"
				size="sm"
				class="h-9 px-2.5 text-xs sm:h-8"
				disabled={!tree.root}
				onclick={addChild}
			>
				Add move
			</Button>
			<Button
				variant="outline"
				size="sm"
				class="h-9 px-2.5 text-xs sm:h-8"
				disabled={!selectedNode}
				onclick={makeRoot}
			>
				Make root
			</Button>
			<Button
				variant="outline"
				size="sm"
				class="h-9 px-2.5 text-xs sm:h-8"
				disabled={!selectedNode}
				onclick={() => selectedNode && environmentState.removeGameTreeNode(selectedNode)}
			>
				Remove
			</Button>
		</div>

		<div class="flex min-h-9 items-center justify-between gap-3 px-1">
			<Label for="show-values" class="cursor-pointer text-xs text-muted-foreground">
				Show values
			</Label>
			<Switch id="show-values" bind:checked={showValues} />
		</div>
	</div>

	{#if selectedNodeModel}
		{@const node = selectedNodeModel}
		<div
			class="absolute right-4 top-4 z-10 w-56 space-y-2 rounded-lg border bg-card/95 p-3 shadow-md backdrop-blur-sm gt-transition-panel"
		>
			<div class="text-xs font-semibold">Node</div>
			<dl class="gt-mono space-y-1 text-[11px]">
				<div class="flex justify-between gap-2">
					<dt class="text-muted-foreground">id</dt>
					<dd class="truncate">{node.id}</dd>
				</div>
				<div class="flex justify-between gap-2">
					<dt class="text-muted-foreground">depth</dt>
					<dd>{node.depth}</dd>
				</div>
				<div class="flex justify-between gap-2">
					<dt class="text-muted-foreground">role</dt>
					<dd>{ROLE_LABELS[node.player]}</dd>
				</div>
				{#if node.state}
					<div class="flex justify-between gap-2">
						<dt class="text-muted-foreground">state</dt>
						<dd>{node.state}</dd>
					</div>
				{/if}
			</dl>

			{#if node.player === 'terminal'}
				<div class="space-y-1">
					<Label for="node-utility" class="text-[11px] text-muted-foreground">Utility</Label>
					<Input
						id="node-utility"
						type="number"
						class="gt-mono h-9 text-xs sm:h-7"
						value={node.utility ?? 0}
						onchange={(event) =>
							environmentState.setGameTreeUtility(node.id, Number(event.currentTarget.value))}
					/>
				</div>
			{:else}
				<div class="space-y-1">
					<span class="text-[11px] text-muted-foreground">Node kind</span>
					<ToggleGroup
						type="single"
						value={node.player}
						onValueChange={(role) => {
							if (!role || role === node.player) return;
							invalidatePlaybackIfNeeded();
							environmentState.setGameTreePlayer(node.id, role as GamePlayer);
						}}
						variant="outline"
						aria-label="Node kind"
						class="w-full"
					>
						{#each ['max', 'min', 'terminal'] as role (role)}
							<ToggleGroupItem
								value={role}
								class="h-9 flex-1 px-1 text-[10px] uppercase sm:h-7"
							>
								{role}
							</ToggleGroupItem>
						{/each}
					</ToggleGroup>
				</div>
				<div class="space-y-1">
					<Label for="node-move-label" class="text-[11px] text-muted-foreground">
						Move label
					</Label>
					<Input
						id="node-move-label"
						type="text"
						class="h-9 text-xs sm:h-7"
						value={node.moveLabel}
						onchange={(event) => environmentState.setGameTreeMoveLabel(node.id, event.currentTarget.value)}
					/>
				</div>
			{/if}
		</div>
	{/if}
</div>
