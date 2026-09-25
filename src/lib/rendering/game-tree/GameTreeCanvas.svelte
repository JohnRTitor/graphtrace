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
		type Edge
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { onMount } from 'svelte';
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

	$effect(() => {
		// Re-fit when the tree's shape changes, not on every trace step: refitting
		// per step would fight the user's own panning.
		void tree.nodes.size;
		if (browser) fitView({ duration: 200 });
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
	class="relative h-full w-full"
	style:color-scheme={isDark ? 'dark' : 'light'}
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
		<Controls />
	</SvelteFlow>

	<!--
		Tree editing surface. Game moves and utilities are not graph topology, so
		this panel is deliberately separate from the manual graph's tool strip: the
		tools here act on a selection, not on a paint mode.
	-->
	<div
		class="absolute bottom-4 left-4 z-10 flex flex-col gap-2 rounded-lg border bg-card/90 p-2 shadow-md backdrop-blur-sm gt-transition-panel"
	>
		<div class="flex items-center gap-1">
			<button
				type="button"
				class="rounded-md border px-2 py-1 text-xs font-medium gt-transition-feedback enabled:hover:bg-accent disabled:opacity-40"
				disabled={!tree.root}
				onclick={addChild}
			>
				Add move
			</button>
			<button
				type="button"
				class="rounded-md border px-2 py-1 text-xs font-medium gt-transition-feedback enabled:hover:bg-accent disabled:opacity-40"
				disabled={!selectedNode}
				onclick={makeRoot}
			>
				Make root
			</button>
			<button
				type="button"
				class="rounded-md border px-2 py-1 text-xs font-medium gt-transition-feedback enabled:hover:bg-accent disabled:opacity-40"
				disabled={!selectedNode}
				onclick={() => selectedNode && environmentState.removeGameTreeNode(selectedNode)}
			>
				Remove
			</button>
		</div>

		<label class="flex items-center gap-2 px-1 text-xs text-muted-foreground">
			<input type="checkbox" bind:checked={showValues} class="accent-primary" />
			Show values
		</label>
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
				<label class="block space-y-1 text-[11px] text-muted-foreground">
					<span>Utility</span>
					<input
						type="number"
						class="gt-mono h-7 w-full rounded-md border bg-background px-2 text-xs"
						value={node.utility ?? 0}
						onchange={(event) =>
							environmentState.setGameTreeUtility(node.id, Number(event.currentTarget.value))}
					/>
				</label>
			{:else}
				<div class="space-y-1">
					<span class="text-[11px] text-muted-foreground">Node kind</span>
					<div class="flex gap-1">
						{#each ['max', 'min', 'terminal'] as role}
							{@const isActive = node.player === role}
							<button
								type="button"
								class="flex-1 rounded-md border px-1 py-1 text-[10px] uppercase gt-transition-feedback enabled:hover:bg-accent"
								class:border-primary={isActive}
								disabled={isActive}
								onclick={() => {
									invalidatePlaybackIfNeeded();
									environmentState.setGameTreePlayer(node.id, role as GamePlayer);
								}}
							>
								{role}
							</button>
						{/each}
					</div>
				</div>
				<label class="block space-y-1 text-[11px] text-muted-foreground">
					<span>Move label</span>
					<input
						type="text"
						class="h-7 w-full rounded-md border bg-background px-2 text-xs"
						value={node.moveLabel}
						onchange={(event) => environmentState.setGameTreeMoveLabel(node.id, event.currentTarget.value)}
					/>
				</label>
			{/if}
		</div>
	{/if}
</div>
