import { describe, it, expect, beforeEach } from 'vitest';
import { EnvironmentState } from '../../state/environment.svelte';
import { serializeWorkspace, deserializeWorkspace } from '../save-load';

describe('save-load', () => {
	let envState: EnvironmentState;

	beforeEach(() => {
		envState = new EnvironmentState();
	});

	it('should serialize and deserialize a grid workspace correctly', () => {
		// Setup environment state
		envState.environmentType = 'blank';
		envState.environmentSeed = 999;
		envState.setGridWall('1,1', true);
		envState.setGridStart('0,0');
		envState.setGridGoal('10,10');
		
		const json = serializeWorkspace(envState);
		
		// Create a new environment state to load into
		const newEnvState = new EnvironmentState();
		deserializeWorkspace(json, newEnvState);
		
		expect(newEnvState.environmentType).toBe('blank');
		expect(newEnvState.environmentSeed).toBe(999);
		
		const grid = newEnvState.grid;
		expect(grid.start).toBe('0,0');
		expect(grid.goal).toBe('10,10');
		expect(grid.nodes.get('1,1')?.walkable).toBe(false);
	});

	it('should serialize and deserialize a graph workspace correctly', () => {
		// Setup environment state
		envState.environmentType = 'graph';
		envState.environmentSeed = 123;
		envState.addGraphNode(10, 20, 'A');
		envState.addGraphNode(30, 40, 'B');
		
		const nodes = Array.from(envState.graph.nodes.keys());
		const nodeA = nodes[0];
		const nodeB = nodes[1];
		
		envState.addGraphEdge(nodeA, nodeB, 5);
		envState.setGraphStart(nodeA);
		envState.setGraphGoal(nodeB);
		
		const json = serializeWorkspace(envState);
		
		// Create a new environment state to load into
		const newEnvState = new EnvironmentState();
		deserializeWorkspace(json, newEnvState);
		
		expect(newEnvState.environmentType).toBe('graph');
		expect(newEnvState.environmentSeed).toBe(123);
		
		const graph = newEnvState.graph;
		expect(graph.start).toBe(nodeA);
		expect(graph.goal).toBe(nodeB);
		expect(graph.nodes.size).toBe(2);
		expect(graph.edges.size).toBe(1);
		
		const edge = Array.from(graph.edges.values())[0];
		expect(edge.weight).toBe(5);
		expect(edge.source).toBe(nodeA);
		expect(edge.target).toBe(nodeB);
	});

	it('rejects malformed grid data before changing the environment', () => {
		const malformed = JSON.stringify({
			schemaVersion: '1.0',
			environmentType: 'blank',
			environmentSeed: 1,
			grid: {
				data: {
					rows: 2,
					cols: 2,
					nodes: [['0,0', { id: '0,0', row: 0, col: 0, walkable: true, cost: 1 }]],
					start: '0,0',
					goal: null
				}
			}
		});

		expect(() => deserializeWorkspace(malformed, envState)).toThrow();
		expect(envState.environmentType).toBe('blank');
	});

	it('rejects graph edges with missing endpoints', () => {
		const malformed = JSON.stringify({
			schemaVersion: '1.0',
			environmentType: 'graph',
			environmentSeed: 1,
			graph: {
				data: {
					nodes: [['A', { id: 'A', x: 0, y: 0, label: 'A' }]],
					edges: [['bad', { id: 'bad', source: 'A', target: 'missing', weight: 1, directed: false }]],
					start: 'A',
					goal: null
				}
			}
		});

		expect(() => deserializeWorkspace(malformed, envState)).toThrow();
		expect(envState.environmentType).not.toBe('graph');
	});

	describe('game tree workspaces', () => {
		it('serializes and deserializes a game tree, keeping the adversarial family', () => {
			envState.familyId = 'adversarial';
			envState.environmentType = 'nim';
			envState.environmentSeed = 4242;
			envState.handleGenerateGameTree();
			envState.setGameTreeUtility(envState.gameTree.root!, 11);

			const json = serializeWorkspace(envState);
			const loaded = new EnvironmentState();
			deserializeWorkspace(json, loaded);

			expect(loaded.familyId).toBe('adversarial');
			expect(loaded.environmentType).toBe('nim');
			expect(loaded.environmentSeed).toBe(4242);
			expect(loaded.gameTree.nodes.size).toBe(envState.gameTree.nodes.size);
			expect(loaded.gameTree.root).toBe(envState.gameTree.root);
			expect(loaded.gameTree.nodes.get(envState.gameTree.root!)?.utility).toBe(11);
			expect(Array.from(loaded.gameTree.children.keys()).sort()).toEqual(
				Array.from(envState.gameTree.children.keys()).sort()
			);
		});

		it('rejects a game tree workspace whose tree data is unusable', () => {
			const malformed = JSON.stringify({
				schemaVersion: '1.0',
				environmentType: 'manual_tree',
				environmentSeed: 1,
				familyId: 'adversarial',
				gameTree: { data: { nodes: [], children: [], root: null } }
			});

			expect(() => deserializeWorkspace(malformed, envState)).toThrow();
		});

		it('rejects a game tree workspace with no game tree at all', () => {
			const malformed = JSON.stringify({
				schemaVersion: '1.0',
				environmentType: 'manual_tree',
				environmentSeed: 1,
				familyId: 'adversarial'
			});

			expect(() => deserializeWorkspace(malformed, envState)).toThrow();
		});

		it('ignores a family id that is unknown or unbuilt', () => {
			const json = JSON.stringify({
				schemaVersion: '1.0',
				environmentType: 'blank',
				environmentSeed: 7,
				familyId: 'optimization',
				grid: {
					data: {
						rows: 1,
						cols: 1,
						nodes: [['0,0', { id: '0,0', row: 0, col: 0, walkable: true, cost: 1 }]],
						start: null,
						goal: null
					}
				}
			});

			deserializeWorkspace(json, envState);
			expect(envState.familyId).toBe('pathfinding');
			expect(envState.environmentType).toBe('blank');
		});

		it('still loads a workspace that predates the family field', () => {
			const json = JSON.stringify({
				schemaVersion: '1.0',
				environmentType: 'blank',
				environmentSeed: 3,
				grid: {
					data: {
						rows: 1,
						cols: 1,
						nodes: [['0,0', { id: '0,0', row: 0, col: 0, walkable: true, cost: 1 }]],
						start: null,
						goal: null
					}
				}
			});

			const loaded = new EnvironmentState();
			deserializeWorkspace(json, loaded);
			expect(loaded.familyId).toBe('pathfinding');
			expect(loaded.grid.rows).toBe(1);
		});
	});
});
