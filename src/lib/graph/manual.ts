import type { BaseGraph, BaseGraphEdge, BaseGraphNode, NodeId } from './types';
import { defaultGraphCostModel, getGraphEntryCost, isValidCost, type CostModel } from '../domain/cost-model';

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
	| { type: 'set-edge-directed'; edgeId: string; from: boolean; to: boolean }
	| { type: 'set-node-cost'; nodeId: NodeId; from: number | undefined; to: number | undefined }
	| { type: 'set-label'; id: NodeId; from: string; to: string }
	| { type: 'clear'; nodes: GraphNode[]; edges: GraphEdge[]; start: NodeId | null; goal: NodeId | null }
	| { type: 'replace-graph'; oldNodes: GraphNode[]; oldEdges: GraphEdge[]; oldStart: NodeId | null; oldGoal: NodeId | null; newNodes: GraphNode[]; newEdges: GraphEdge[]; newStart: NodeId | null; newGoal: NodeId | null }
	| { type: 'batch'; commands: GraphCommand[] };

type NormalizedGraphData = {
	nodes: Map<NodeId, GraphNode>;
	edges: Map<string, GraphEdge>;
	start: NodeId | null;
	goal: NodeId | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object';
}

function isValidGraphNode(value: unknown): value is GraphNode {
	if (!isRecord(value)) return false;

	return (
		typeof value.id === 'string' &&
		typeof value.label === 'string' &&
		typeof value.x === 'number' &&
		Number.isFinite(value.x) &&
		typeof value.y === 'number' &&
		Number.isFinite(value.y) &&
		(value.cost === undefined || isValidCost(value.cost))
	);
}

function isValidGraphEdge(value: unknown): value is GraphEdge {
	if (!isRecord(value)) return false;

	return (
		typeof value.id === 'string' &&
		typeof value.source === 'string' &&
		typeof value.target === 'string' &&
		isValidCost(value.weight) &&
		typeof value.directed === 'boolean'
	);
}

function normalizeGraphData(data: unknown): NormalizedGraphData | null {
	if (!isRecord(data) || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
		return null;
	}

	const nodes = new Map<NodeId, GraphNode>();
	for (const value of data.nodes) {
		if (isValidGraphNode(value)) {
			nodes.set(value.id, { ...value });
		}
	}

	const edges = new Map<string, GraphEdge>();
	for (const value of data.edges) {
		if (
			isValidGraphEdge(value) &&
			nodes.has(value.source) &&
			nodes.has(value.target) &&
			!edges.has(value.id)
		) {
			edges.set(value.id, { ...value });
		}
	}

	return {
		nodes,
		edges,
		start: typeof data.start === 'string' && nodes.has(data.start) ? data.start : null,
		goal: typeof data.goal === 'string' && nodes.has(data.goal) ? data.goal : null
	};
}

export class ManualGraph implements BaseGraph {
	nodes = new Map<NodeId, GraphNode>();
	edges = new Map<string, GraphEdge>();
	start: NodeId | null = null;
	goal: NodeId | null = null;

	constructor(private costModel: CostModel = defaultGraphCostModel) {}

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
			let target: NodeId;
			if (edge.source === id) {
				target = edge.target;
			} else if (!edge.directed && edge.target === id) {
				target = edge.source;
			} else {
				continue;
			}

			const enteredNode = this.nodes.get(target);
			if (!enteredNode) continue;

			const weight = getGraphEntryCost(this.costModel, id, edge, enteredNode);
			if (isValidCost(weight)) {
				neighbors.push({ target, weight });
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
				if (isValidGraphNode(cmd.node)) {
					this.nodes.set(cmd.node.id, { ...cmd.node });
				}
				break;
			case 'remove-node':
				this.nodes.delete(cmd.node.id);
				for (const edge of this.getAttachedEdges(cmd.node.id)) {
					this.edges.delete(edge.id);
				}
				if (this.start === cmd.node.id) this.start = null;
				if (this.goal === cmd.node.id) this.goal = null;
				break;
			case 'move-node': {
				const n = this.nodes.get(cmd.id);
				if (n && Number.isFinite(cmd.to.x) && Number.isFinite(cmd.to.y)) {
					n.x = cmd.to.x;
					n.y = cmd.to.y;
				}
				break;
			}
			case 'add-edge':
				if (
					isValidGraphEdge(cmd.edge) &&
					this.nodes.has(cmd.edge.source) &&
					this.nodes.has(cmd.edge.target)
				) {
					this.edges.set(cmd.edge.id, { ...cmd.edge });
				}
				break;
			case 'remove-edge':
				this.edges.delete(cmd.edge.id);
				break;
			case 'set-start':
				if (cmd.to === null || this.nodes.has(cmd.to)) {
					this.start = cmd.to;
				}
				break;
			case 'set-goal':
				if (cmd.to === null || this.nodes.has(cmd.to)) {
					this.goal = cmd.to;
				}
				break;
			case 'set-weight':
				const e = this.edges.get(cmd.edgeId);
				if (e && isValidCost(cmd.to)) e.weight = cmd.to;
				break;
			case 'set-edge-directed':
				const ed = this.edges.get(cmd.edgeId);
				if (ed && typeof cmd.to === 'boolean') ed.directed = cmd.to;
				break;
			case 'set-node-cost':
				const costNode = this.nodes.get(cmd.nodeId);
				if (costNode) {
					if (cmd.to === undefined) {
						delete costNode.cost;
					} else if (isValidCost(cmd.to)) {
						costNode.cost = cmd.to;
					}
				}
				break;
			case 'set-label': {
				const labelNode = this.nodes.get(cmd.id);
				if (labelNode && typeof cmd.to === 'string') labelNode.label = cmd.to;
				break;
			}
			case 'clear':
				this.nodes.clear();
				this.edges.clear();
				this.start = null;
				this.goal = null;
				break;
			case 'replace-graph': {
				const normalized = normalizeGraphData({
					nodes: cmd.newNodes,
					edges: cmd.newEdges,
					start: cmd.newStart,
					goal: cmd.newGoal
				});
				if (normalized) {
					this.nodes.clear();
					this.edges.clear();
					for (const node of normalized.nodes.values()) this.nodes.set(node.id, node);
					for (const edge of normalized.edges.values()) this.edges.set(edge.id, edge);
					this.start = normalized.start;
					this.goal = normalized.goal;
				}
				break;
			}
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
			goal: this.goal
		});
	}

	load(data: unknown): boolean {
		const normalized = normalizeGraphData(data);
		if (!normalized) {
			console.error('Invalid graph data');
			return false;
		}

		this.nodes.clear();
		this.edges.clear();
		for (const node of normalized.nodes.values()) this.nodes.set(node.id, node);
		for (const edge of normalized.edges.values()) this.edges.set(edge.id, edge);
		this.start = normalized.start;
		this.goal = normalized.goal;
		this._version++;
		return true;
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
		case 'set-edge-directed':
			return { type: 'set-edge-directed', edgeId: cmd.edgeId, from: cmd.to, to: cmd.from };
		case 'set-node-cost':
			return { type: 'set-node-cost', nodeId: cmd.nodeId, from: cmd.to, to: cmd.from };
		case 'set-label':
			return { type: 'set-label', id: cmd.id, from: cmd.to, to: cmd.from };
		case 'clear':
			return { type: 'replace-graph', oldNodes: [], oldEdges: [], oldStart: null, oldGoal: null, newNodes: cmd.nodes, newEdges: cmd.edges, newStart: cmd.start, newGoal: cmd.goal };
		case 'replace-graph':
			return { type: 'replace-graph', oldNodes: cmd.newNodes, oldEdges: cmd.newEdges, oldStart: cmd.newStart, oldGoal: cmd.newGoal, newNodes: cmd.oldNodes, newEdges: cmd.oldEdges, newStart: cmd.oldStart, newGoal: cmd.oldGoal };
		case 'batch':
			// Inverse of batch is the inverse of commands in reverse order
			const inverseCommands = cmd.commands.map(invertGraphCommand).reverse();
			return { type: 'batch', commands: inverseCommands };
	}
}
