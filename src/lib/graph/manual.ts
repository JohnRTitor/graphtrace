import type { BaseGraph, BaseGraphEdge, BaseGraphNode, NodeId } from './types';

export type GraphNode = {
	id: NodeId;
	x: number;
	y: number;
	label: string;
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
	| { type: 'set-directed'; from: boolean; to: boolean }
	| { type: 'clear'; nodes: GraphNode[]; edges: GraphEdge[]; start: NodeId | null; goal: NodeId | null };

export class ManualGraph implements BaseGraph {
	nodes = new Map<NodeId, GraphNode>();
	edges = new Map<string, GraphEdge>();
	start: NodeId | null = null;
	goal: NodeId | null = null;
	directed: boolean = false;

	private undoStack: GraphCommand[] = [];
	private redoStack: GraphCommand[] = [];

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
	execute(cmd: GraphCommand, isRedo = false) {
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
			case 'set-directed':
				this.directed = cmd.to;
				break;
			case 'clear':
				this.nodes.clear();
				this.edges.clear();
				this.start = null;
				this.goal = null;
				break;
		}

		this._version++;
		if (!isRedo) {
			this.undoStack.push(cmd);
			this.redoStack = [];
		}
	}

	undo() {
		const cmd = this.undoStack.pop();
		if (!cmd) return;

		switch (cmd.type) {
			case 'add-node':
				this.nodes.delete(cmd.node.id);
				break;
			case 'remove-node':
				this.nodes.set(cmd.node.id, { ...cmd.node });
				for (const edge of cmd.attachedEdges) {
					this.edges.set(edge.id, { ...edge });
				}
				if (cmd.wasStart) this.start = cmd.node.id;
				if (cmd.wasGoal) this.goal = cmd.node.id;
				break;
			case 'move-node':
				const n = this.nodes.get(cmd.id);
				if (n) {
					n.x = cmd.from.x;
					n.y = cmd.from.y;
				}
				break;
			case 'add-edge':
				this.edges.delete(cmd.edge.id);
				break;
			case 'remove-edge':
				this.edges.set(cmd.edge.id, { ...cmd.edge });
				break;
			case 'set-start':
				this.start = cmd.from;
				break;
			case 'set-goal':
				this.goal = cmd.from;
				break;
			case 'set-weight':
				const e = this.edges.get(cmd.edgeId);
				if (e) e.weight = cmd.from;
				break;
			case 'set-directed':
				this.directed = cmd.from;
				break;
			case 'clear':
				for (const node of cmd.nodes) this.nodes.set(node.id, { ...node });
				for (const edge of cmd.edges) this.edges.set(edge.id, { ...edge });
				this.start = cmd.start;
				this.goal = cmd.goal;
				break;
		}

		this._version++;
		this.redoStack.push(cmd);
	}

	redo() {
		const cmd = this.redoStack.pop();
		if (!cmd) return;
		this.execute(cmd, true);
		this.undoStack.push(cmd);
	}

	canUndo() {
		return this.undoStack.length > 0;
	}

	canRedo() {
		return this.redoStack.length > 0;
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
		this.directed = typeof data.directed === 'boolean' ? data.directed : false;
		this._version++;
		
		// Clear stacks when loading new graph
		this.undoStack = [];
		this.redoStack = [];
	}
}
