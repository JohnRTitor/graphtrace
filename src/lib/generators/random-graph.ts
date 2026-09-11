import type { GraphNode, GraphEdge } from '../graph/manual';
import type { NodeId } from '../graph/types';
import { PRNG } from '../utils/random';
import type { RandomGraphOptions } from './types';

export type GraphSnapshot = {
	nodes: GraphNode[];
	edges: GraphEdge[];
	start: NodeId | null;
	goal: NodeId | null;
};

export function generateRandomGraph(options: RandomGraphOptions): GraphSnapshot {
	const prng = new PRNG(options.seed);
	
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const genId = () => {
		let result = '';
		for (let i = 0; i < 6; i++) {
			result += chars.charAt(prng.nextInt(0, chars.length));
		}
		return result;
	};
	
	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];
	
	const N = Math.max(2, options.nodeCount); // At least 2 nodes for start/goal
	
	// Canvas logical size (Svelte Flow can zoom/pan, so this is just a reasonable spread)
	const WIDTH = 800;
	const HEIGHT = 600;
	const MIN_DIST = 60;
	
	// 1. Generate Nodes with rejection sampling
	for (let i = 0; i < N; i++) {
		let x = 0, y = 0;
		let valid = false;
		for (let attempt = 0; attempt < 50; attempt++) {
			x = 50 + prng.nextFloat() * (WIDTH - 100);
			y = 50 + prng.nextFloat() * (HEIGHT - 100);
			
			valid = true;
			for (const other of nodes) {
				const dx = other.x - x;
				const dy = other.y - y;
				if (Math.sqrt(dx * dx + dy * dy) < MIN_DIST) {
					valid = false;
					break;
				}
			}
			if (valid) break;
		}
		
		nodes.push({
			id: `node-${genId()}`,
			x,
			y,
			label: String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '')
		});
	}
	
	// 2. Start and Goal
	// Pick two distinct nodes
	const shuffledNodes = prng.shuffle(nodes);
	const startNode = shuffledNodes[0];
	const goalNode = shuffledNodes[1];
	
	// Helper to track edges
	const edgeSet = new Set<string>();
	const getEdgeKey = (s: string, t: string) => 
		options.directed ? `${s}->${t}` : (s < t ? `${s}-${t}` : `${t}-${s}`);
	
	const addEdge = (s: string, t: string) => {
		if (s === t) return false; // no self-loops
		const key = getEdgeKey(s, t);
		if (edgeSet.has(key)) return false; // no duplicates
		
		edgeSet.add(key);
		edges.push({
			id: `edge-${genId()}`,
			source: s,
			target: t,
			weight: options.weighted ? prng.nextInt(1, 10) : 1, // 1 to 9
			directed: options.directed
		});
		return true;
	};

	// 3. Ensure Path / Connectivity
	if (options.ensurePath) {
		// Build a random spanning tree for undirected
		const unvisited = [...shuffledNodes];
		const visited = [unvisited.shift()!];
		
		while (unvisited.length > 0) {
			const uIdx = prng.nextInt(0, visited.length);
			const vIdx = prng.nextInt(0, unvisited.length);
			
			const u = visited[uIdx];
			const v = unvisited[vIdx];
			
			addEdge(u.id, v.id);
			
			visited.push(v);
			unvisited.splice(vIdx, 1);
		}
	}
	
	// 4. Fill remaining density
	// We use the edgeMultiplier from options to determine the target edges.
	let targetEdges = Math.floor(options.edgeMultiplier * N);
	
	const maxPossibleEdges = options.directed ? N * (N - 1) : (N * (N - 1)) / 2;
	targetEdges = Math.min(targetEdges, maxPossibleEdges);
	
	let attempts = 0;
	const maxAttempts = targetEdges * 10; // safety limit
	
	while (edges.length < targetEdges && attempts < maxAttempts) {
		const s = nodes[prng.nextInt(0, N)].id;
		const t = nodes[prng.nextInt(0, N)].id;
		addEdge(s, t);
		attempts++;
	}

	return {
		nodes,
		edges,
		start: startNode.id,
		goal: goalNode.id
	};
}
