import type { BaseGraph, BaseGraphEdge, BaseGraphNode, NodeId } from './types';

export type GraphNode = {
	id: NodeId;
	x: number;
	y: number;
	label: string;
	cost?: number;
};

export type GraphEdge = {
	id: string; // unique edge id to support multi-edges
	source: NodeId;
	target: NodeId;
	weight: number;
	directed: boolean;
};

export type GraphCommand = 
	| { type: 'add-node'; node: GraphNode }
	| { type: 'remove-node'; node: GraphNode; attachedEdges: GraphEdge[]; wasStart?: boolean; wasGoal?: boolean }
	| { type: 'move-node'; id: NodeId; from: { x: number; y: number }; to: { x: number; y: number } }
	| { type: 'add-edge'; edge: GraphEdge }
	| { type: 'remove-edge'; edge: GraphEdge }
	| { type: 'set-start'; from: NodeId | null; to: NodeId | null }
	| { type: 'set-goal'; from: NodeId | null; to: NodeId | null }
	| { type: 'set-weight'; edgeId: string; from: number; to: number }
	| { type: 'set-node-cost'; nodeId: NodeId; from: number | undefined; to: number }
	| { type: 'set-directed'; from: boolean; to: boolean }
	| { type: 'set-label'; id: NodeId; from: string; to: string }
	| { type: 'reverse-edge'; edgeId: string; oldSource: NodeId; oldTarget: NodeId }
	| { type: 'clear'; nodes: GraphNode[]; edges: GraphEdge[]; start: NodeId | null; goal: NodeId | null }
	| { type: 'replace-graph'; oldNodes: GraphNode[]; oldEdges: GraphEdge[]; oldStart: NodeId | null; oldGoal: NodeId | null; oldDirected: boolean; newNodes: GraphNode[]; newEdges: GraphEdge[]; newStart: NodeId | null; newGoal: NodeId | null; newDirected: boolean }
	| { type: 'batch'; commands: GraphCommand[] };

export class ManualGraph implements BaseGraph {
	nodes = new Map<NodeId, GraphNode>();
	edges = new Map<string, GraphEdge>();
	start: NodeId | null = null;
	goal: NodeId | null = null;
	directed: boolean = false;

	private _version = 0;

	get version() {
		return this._version;
	}

	// BaseGraph Implementation
	getNode(id: NodeId): BaseGraphNode | undefined {
		const node = this.nodes.get(id);
		return node ? { id: node.id } : undefined;
	}

	getNeighbors(id: NodeId): BaseGraphEdge[] {
		const neighbors: BaseGraphEdge[] = [];
		for (const edge of this.edges.values()) {
			if (edge.source === id) {
				neighbors.push({ target: edge.target, weight: edge.weight });
			} else if (!edge.directed && edge.target === id) {
				neighbors.push({ target: edge.source, weight: edge.weight });
			}
		}
		return neighbors;
	}

	getHeuristic(nodeA: NodeId, nodeB: NodeId): number {
		const a = this.nodes.get(nodeA);
		const b = this.nodes.get(nodeB);
		if (!a || !b) return 0;
		// Return 0 to guarantee admissible heuristic (Dijkstra) since edge weights are arbitrary
		return 0;
	}

	getStart(): NodeId | null {
		return this.start;
	}

	getGoal(): NodeId | null {
		return this.goal;
	}

	// Operations
	execute(cmd: GraphCommand) {
		switch (cmd.type) {
			case 'add-node':
				this.nodes.set(cmd.node.id, { ...cmd.node });
				break;
			case 'remove-node':
				this.nodes.delete(cmd.node.id);
				for (const edge of cmd.attachedEdges) {
					this.edges.delete(edge.id);
				}
				if (this.start === cmd.node.id) this.start = null;
				if (this.goal === cmd.node.id) this.goal = null;
				break;
			case 'move-node':
				const n = this.nodes.get(cmd.id);
				if (n) {
					n.x = cmd.to.x;
					n.y = cmd.to.y;
				}
				break;
			case 'add-edge':
				this.edges.set(cmd.edge.id, { ...cmd.edge });
				break;
			case 'remove-edge':
				this.edges.delete(cmd.edge.id);
				break;
			case 'set-start':
				this.start = cmd.to;
				break;
			case 'set-goal':
				this.goal = cmd.to;
				break;
			case 'set-weight':
				const e = this.edges.get(cmd.edgeId);
				if (e) e.weight = cmd.to;
				break;
			case 'set-node-cost':
				const costNode = this.nodes.get(cmd.nodeId);
				if (costNode) costNode.cost = cmd.to;
				break;
			case 'set-directed':
				this.directed = cmd.to;
				break;
			case 'set-label': {
				const labelNode = this.nodes.get(cmd.id);
				if (labelNode) labelNode.label = cmd.to;
				break;
			}
			case 'reverse-edge': {
				const revEdge = this.edges.get(cmd.edgeId);
				if (revEdge) {
					revEdge.source = cmd.oldTarget;
					revEdge.target = cmd.oldSource;
				}
				break;
			}
			case 'clear':
				this.nodes.clear();
				this.edges.clear();
				this.start = null;
				this.goal = null;
				break;
			case 'replace-graph':
				this.nodes.clear();
				this.edges.clear();
				for (const node of cmd.newNodes) this.nodes.set(node.id, { ...node });
				for (const edge of cmd.newEdges) this.edges.set(edge.id, { ...edge });
				this.start = cmd.newStart;
				this.goal = cmd.newGoal;
				this.directed = cmd.newDirected;
				break;
			case 'batch':
				for (const c of cmd.commands) this.execute(c);
				break;
		}

		this._version++;
	}

	getAttachedEdges(nodeId: NodeId): GraphEdge[] {
		const attached: GraphEdge[] = [];
		for (const edge of this.edges.values()) {
			if (edge.source === nodeId || edge.target === nodeId) {
				attached.push({ ...edge });
			}
		}
		return attached;
	}

	// Serialization
	serialize() {
		return JSON.stringify({
			nodes: Array.from(this.nodes.values()),
			edges: Array.from(this.edges.values()),
			start: this.start,
			goal: this.goal,
			directed: this.directed
		});
	}

	load(data: any) {
		if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
			console.error("Invalid graph data");
			return;
		}
		
		const validNodes = new Map<NodeId, GraphNode>();
		for (const n of data.nodes) {
			if (n && typeof n.id === 'string' && typeof n.x === 'number' && typeof n.y === 'number' && Number.isFinite(n.x) && Number.isFinite(n.y)) {
				validNodes.set(n.id, n);
			}
		}

		const validEdges = new Map<string, GraphEdge>();
		for (const e of data.edges) {
			if (e && typeof e.id === 'string' && typeof e.source === 'string' && typeof e.target === 'string' && typeof e.weight === 'number' && typeof e.directed === 'boolean') {
				if (validNodes.has(e.source) && validNodes.has(e.target) && !validEdges.has(e.id)) {
					validEdges.set(e.id, e);
				}
			}
		}

		const nodes = Array.from(this.nodes.values());
		const edges = Array.from(this.edges.values());
		const start = this.start;
		const goal = this.goal;

		this.execute({
			type: 'clear',
			nodes,
			edges,
			start,
			goal
		});

		// Then manually apply state (bypassing execute so it's not part of the clear command)
		this.nodes.clear();
		this.edges.clear();
		for (const n of validNodes.values()) this.nodes.set(n.id, n);
		for (const e of validEdges.values()) this.edges.set(e.id, e);
		this.start = validNodes.has(data.start) ? data.start : null;
		this.goal = validNodes.has(data.goal) ? data.goal : null;
		this._version++;
	}
}

export function invertGraphCommand(cmd: GraphCommand): GraphCommand {
	switch (cmd.type) {
		case 'add-node':
			return { type: 'remove-node', node: cmd.node, attachedEdges: [] };
		case 'remove-node': {
			const batch: GraphCommand[] = [ { type: 'add-node', node: cmd.node } ];
			for (const edge of cmd.attachedEdges) {
				batch.push({ type: 'add-edge', edge });
			}
			if (cmd.wasStart) batch.push({ type: 'set-start', from: null, to: cmd.node.id });
			if (cmd.wasGoal) batch.push({ type: 'set-goal', from: null, to: cmd.node.id });
			return { type: 'batch', commands: batch };
		}
		case 'move-node':
			return { type: 'move-node', id: cmd.id, from: cmd.to, to: cmd.from };
		case 'add-edge':
			return { type: 'remove-edge', edge: cmd.edge };
		case 'remove-edge':
			return { type: 'add-edge', edge: cmd.edge };
		case 'set-start':
			return { type: 'set-start', from: cmd.to, to: cmd.from };
		case 'set-goal':
			return { type: 'set-goal', from: cmd.to, to: cmd.from };
		case 'set-weight':
			return { type: 'set-weight', edgeId: cmd.edgeId, from: cmd.to, to: cmd.from };
		case 'set-node-cost':
			return { type: 'set-node-cost', nodeId: cmd.nodeId, from: cmd.to, to: cmd.from ?? 0 };
		case 'set-directed':
			return { type: 'set-directed', from: cmd.to, to: cmd.from };
		case 'set-label':
			return { type: 'set-label', id: cmd.id, from: cmd.to, to: cmd.from };
		case 'reverse-edge':
			return { type: 'reverse-edge', edgeId: cmd.edgeId, oldSource: cmd.oldTarget, oldTarget: cmd.oldSource };
		case 'clear':
			return { type: 'replace-graph', oldNodes: [], oldEdges: [], oldStart: null, oldGoal: null, oldDirected: false, newNodes: cmd.nodes, newEdges: cmd.edges, newStart: cmd.start, newGoal: cmd.goal, newDirected: false }; // Note: directed doesn't change on clear
		case 'replace-graph':
			return { type: 'replace-graph', oldNodes: cmd.newNodes, oldEdges: cmd.newEdges, oldStart: cmd.newStart, oldGoal: cmd.newGoal, oldDirected: cmd.newDirected, newNodes: cmd.oldNodes, newEdges: cmd.oldEdges, newStart: cmd.oldStart, newGoal: cmd.oldGoal, newDirected: cmd.oldDirected };
		case 'batch':
			// Inverse of batch is the inverse of commands in reverse order
			const inverseCommands = cmd.commands.map(invertGraphCommand).reverse();
			return { type: 'batch', commands: inverseCommands };
	}
}
