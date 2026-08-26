<script lang="ts">
	import { SvelteFlow, Background, Controls, useSvelteFlow, type NodeTypes, type EdgeTypes, type Connection, BackgroundVariant, type Edge, type Node } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { environmentState } from '$lib/state/environment.svelte';
	import { playbackState } from '$lib/state/playback.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import GraphNodeComponent from './GraphNode.svelte';
	import GraphEdgeComponent from './GraphEdge.svelte';
	import { toFlowNodes, toFlowEdges, extractPathEdges } from './flow-adapter';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	const nodeTypes: NodeTypes = {
		custom: GraphNodeComponent
	};

	const edgeTypes: EdgeTypes = {
		custom: GraphEdgeComponent
	};

	const { screenToFlowPosition } = useSvelteFlow();

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
		if (!playbackState.vizState?.pathNodes || playbackState.vizState.pathNodes.size === 0) return new Set<string>();
		return extractPathEdges(Array.from(playbackState.vizState.pathNodes), environmentState.graph);
	});

	let nodes = $derived.by(() => {
		return toFlowNodes(environmentState.graph, playbackState.vizState, environmentState.showCosts, colors);
	});

	let edges = $derived.by(() => {
		return toFlowEdges(environmentState.graph, playbackState.vizState, pathEdges, colors);
	});

	function handlePaneClick({ event }: { event: MouseEvent | TouchEvent }) {
		if (editorState.mode !== 'node') return;
		
		const position = screenToFlowPosition({ x: ('clientX' in event ? event.clientX : event.touches[0].clientX), y: ('clientY' in event ? event.clientY : event.touches[0].clientY) });
		environmentState.addGraphNode(position.x, position.y, `N${environmentState.graph.nodes.size + 1}`);
	}

	function handleNodeClick({ event, node }: { event: MouseEvent | TouchEvent, node: Node }) {
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
		const mode = editorState.mode;
		if (mode === 'remove') {
			environmentState.removeGraphEdge(edge.id);
		} else if (mode === 'weight') {
			environmentState.setGraphWeight(edge.id, editorState.weightValue);
		}
	}

	function handleConnect(connection: Connection) {
		if (editorState.mode !== 'edge' || !connection.source || !connection.target) return;
		environmentState.addGraphEdge(connection.source, connection.target, editorState.weightValue);
	}

	function handleNodeDragStop({ event, targetNode: node, nodes }: { event: MouseEvent | TouchEvent, targetNode: Node | null, nodes: Node[] }) {
		if (node) {
			environmentState.moveGraphNode(node.id, node.position.x, node.position.y);
		}
	}

</script>

<div class="w-full h-full relative" style:color-scheme={isDark ? 'dark' : 'light'}>
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
		nodesDraggable={editorState.mode === 'move'}
		nodesConnectable={editorState.mode === 'edge'}
		elementsSelectable={true}
		fitView
	>
		<Background variant={BackgroundVariant.Dots} />
		<Controls />
	</SvelteFlow>
</div>
