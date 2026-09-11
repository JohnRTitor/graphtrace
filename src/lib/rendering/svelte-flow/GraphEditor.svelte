<script lang="ts">
	import { SvelteFlow, Background, Controls, useSvelteFlow, type NodeTypes, type EdgeTypes, type Connection, BackgroundVariant, type Edge, type Node, ConnectionMode } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { environmentState } from '$lib/state/environment.svelte';
	import { playbackState } from '$lib/state/playback.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import GraphNodeComponent from './GraphNode.svelte';
	import GraphEdgeComponent from './GraphEdge.svelte';
	import { toFlowNodes, toFlowEdges, extractPathEdges } from './flow-adapter';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import GraphBackgroundMenu from './GraphBackgroundMenu.svelte';
	import GraphNodeMenu from './GraphNodeMenu.svelte';
	import GraphEdgeMenu from './GraphEdgeMenu.svelte';
	import RenameNodeDialog from './RenameNodeDialog.svelte';
	import type { GraphContextTarget } from '$lib/state/context-menu-targets';
	import type { NodeId } from '$lib/graph/types';
	import type { PlaybackState } from '$lib/state/playback.svelte';

	let { playback = playbackState } = $props<{ playback?: PlaybackState }>();

	const nodeTypes: NodeTypes = {
		custom: GraphNodeComponent
	};

	const edgeTypes: EdgeTypes = {
		custom: GraphEdgeComponent
	};

	const { screenToFlowPosition, fitView, getNodes, getEdges, updateNode, updateEdge } = useSvelteFlow();

	// We derive nodes and edges from the underlying graph + viz state.
	// This ensures one-way data flow: Graph/Viz -> SvelteFlow -> DOM.
	
	let isDark = $state(false);

	onMount(() => {
		if (browser) {
			const observer = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					if (mutation.attributeName === 'class') {
						isDark = document.documentElement.classList.contains('dark');
					}
				});
			});
			observer.observe(document.documentElement, { attributes: true });
			isDark = document.documentElement.classList.contains('dark');
			return () => observer.disconnect();
		}
	});

	let colors = $derived.by(() => {
		return isDark ? {
			bg: '#000000',
			wall: '#334155',
			gridLines: '#1e293b',
			weight: '#475569',
			text: '#94a3b8',
			start: '#22c55e',
			goal: '#ef4444',
			discovered: '#3b82f6',
			expanded: '#6366f1',
			path: '#eab308',
			current: '#d946ef',
		} : {
			bg: '#ffffff',
			wall: '#94a3b8',
			gridLines: '#e2e8f0',
			weight: '#cbd5e1',
			text: '#64748b',
			start: '#22c55e',
			goal: '#ef4444',
			discovered: '#60a5fa',
			expanded: '#818cf8',
			path: '#facc15',
			current: '#e879f9',
		};
	});

	let pathEdges = $derived.by(() => {
		if (!playback.vizState?.pathNodes || playback.vizState.pathNodes.size === 0) return new Set<string>();
		return extractPathEdges(Array.from(playback.vizState.pathNodes), environmentState.graph);
	});

	let nodes = $derived.by(() => {
		return toFlowNodes(environmentState.graph, playback.vizState, environmentState.showCosts, colors);
	});

	let edges = $derived.by(() => {
		return toFlowEdges(environmentState.graph, playback.vizState, pathEdges, colors);
	});

	function handlePaneClick({ event }: { event: MouseEvent | TouchEvent }) {
		editorState.selection = null;
		if (editorState.mode !== 'node') return;
		
		const position = screenToFlowPosition({ x: ('clientX' in event ? event.clientX : event.touches[0].clientX), y: ('clientY' in event ? event.clientY : event.touches[0].clientY) });
		environmentState.addGraphNode(position.x, position.y, `N${environmentState.graph.nodes.size + 1}`);
	}

	function handleNodeClick({ event, node }: { event: MouseEvent | TouchEvent, node: Node }) {
		editorState.selection = { type: 'node', id: node.id };
		const mode = editorState.mode;
		if (mode === 'remove') {
			environmentState.removeGraphNode(node.id);
		} else if (mode === 'start') {
			environmentState.setGraphStart(node.id);
		} else if (mode === 'goal') {
			environmentState.setGraphGoal(node.id);
		}
	}

	function handleEdgeClick({ event, edge }: { event: MouseEvent | TouchEvent, edge: Edge }) {
		editorState.selection = { type: 'edge', id: edge.id };
		const mode = editorState.mode;
		if (mode === 'remove') {
			environmentState.removeGraphEdge(edge.id);
		} else if (mode === 'cost') {
			environmentState.setGraphWeight(edge.id, editorState.costValue);
		}
	}

	function handleConnect(connection: Connection) {
		if (editorState.mode !== 'edge' || !connection.source || !connection.target) return;
		environmentState.addGraphEdge(connection.source, connection.target, editorState.costValue);
	}

	function handleNodeDragStop({ event, targetNode: node, nodes }: { event: MouseEvent | TouchEvent, targetNode: Node | null, nodes: Node[] }) {
		if (node) {
			environmentState.moveGraphNode(node.id, node.position.x, node.position.y);
		}
	}

	// === Context menu ===
	// The right-clicked object (node/edge/background) is the sole source of
	// truth for the menu target - it is resolved directly from SvelteFlow's
	// own contextmenu events below, never from ambient selection state.
	let menuOpen = $state(false);
	let graphContextTarget = $state<GraphContextTarget | null>(null);

	function onNodeContextMenu({ node }: { node: Node; event: MouseEvent }) {
		graphContextTarget = { type: 'node', nodeId: node.id };
	}

	function onEdgeContextMenu({ edge }: { edge: Edge; event: MouseEvent }) {
		graphContextTarget = { type: 'edge', edgeId: edge.id };
	}

	function onPaneContextMenu({ event }: { event: MouseEvent }) {
		const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
		graphContextTarget = { type: 'background', flowX: position.x, flowY: position.y };
	}

	function handleFitView() {
		fitView();
	}

	function handleClearSelection() {
		for (const n of getNodes()) {
			if (n.selected) updateNode(n.id, { selected: false });
		}
		for (const e of getEdges()) {
			if (e.selected) updateEdge(e.id, { selected: false });
		}
	}

	// Rename dialog state lives here (not inside the menu) because the
	// ContextMenu.Content that hosts the "Rename" item unmounts as soon as
	// the menu closes.
	let renameOpen = $state(false);
	let renameNodeId = $state<NodeId | null>(null);
	let renameInitialLabel = $state('');

	function openRenameDialog(nodeId: NodeId, currentLabel: string) {
		renameNodeId = nodeId;
		renameInitialLabel = currentLabel;
		renameOpen = true;
	}

</script>

<div class={`w-full h-full relative ${editorState.mode === 'edge' ? 'cursor-crosshair' : ''}`} style:color-scheme={isDark ? 'dark' : 'light'}>
	{#if browser}
		<ContextMenu.Root bind:open={menuOpen}>
			<ContextMenu.Trigger class="block w-full h-full">
				<SvelteFlow
					{nodes}
					{edges}
					{nodeTypes}
					{edgeTypes}
					colorMode={isDark ? 'dark' : 'light'}
					onpaneclick={handlePaneClick}
					onnodeclick={handleNodeClick}
					onedgeclick={handleEdgeClick}
					onconnect={handleConnect}
					onnodedragstop={handleNodeDragStop}
					onnodecontextmenu={onNodeContextMenu}
					onedgecontextmenu={onEdgeContextMenu}
					onpanecontextmenu={onPaneContextMenu}
					nodesDraggable={editorState.mode === 'move'}
					nodesConnectable={editorState.mode === 'edge'}
					connectionMode={ConnectionMode.Loose}
					elementsSelectable={true}
					fitView
				>
					<Background variant={BackgroundVariant.Dots} />
					<Controls />
				</SvelteFlow>
			</ContextMenu.Trigger>
			<ContextMenu.Content>
				{#if graphContextTarget?.type === 'background'}
					<GraphBackgroundMenu
						flowX={graphContextTarget.flowX}
						flowY={graphContextTarget.flowY}
						onFitView={handleFitView}
						onClearSelection={handleClearSelection}
					/>
				{:else if graphContextTarget?.type === 'node'}
					<GraphNodeMenu nodeId={graphContextTarget.nodeId} onRename={openRenameDialog} />
				{:else if graphContextTarget?.type === 'edge'}
					<GraphEdgeMenu edgeId={graphContextTarget.edgeId} />
				{/if}
			</ContextMenu.Content>
		</ContextMenu.Root>

		{#if renameNodeId}
			<RenameNodeDialog bind:open={renameOpen} nodeId={renameNodeId} initialLabel={renameInitialLabel} />
		{/if}
	{/if}
</div>

