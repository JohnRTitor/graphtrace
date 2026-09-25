import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from '../editor.svelte';
import { environmentState } from '../environment.svelte';

const originalEnvironmentType = environmentState.environmentType;
const originalGraph = environmentState.graph.serialize();

function loadTestGraph() {
	environmentState.environmentType = 'graph';
	environmentState.loadGraph({
		nodes: [
			{ id: 'edge-node', x: 0, y: 0, label: 'Edge node' },
			{ id: 'B', x: 10, y: 0, label: 'B' }
		],
		edges: [
			{ id: 'node-edge', source: 'edge-node', target: 'B', weight: 1, directed: false }
		],
		start: null,
		goal: null
	});
}

describe('EditorState graph interactions', () => {
	beforeEach(() => {
		loadTestGraph();
	});

	afterEach(() => {
		environmentState.loadGraph(JSON.parse(originalGraph));
		environmentState.environmentType = originalEnvironmentType;
		vi.restoreAllMocks();
	});

	it('classifies graph objects from the model maps', () => {
		const editor = new EditorState();
		editor.mode = 'edge';

		editor.onPointerDown('edge-node');
		expect(editor.selection).toEqual({ type: 'node', id: 'edge-node' });

		editor.onPointerUp(null);
		editor.onPointerDown('node-edge');
		expect(editor.selection).toEqual({ type: 'edge', id: 'node-edge' });
	});

	it('does not create an edge for an aborted edge drag', () => {
		const editor = new EditorState();
		editor.mode = 'edge';
		const executeCommand = vi.spyOn(environmentState, 'executeCommand');

		editor.onPointerDown('edge-node');
		editor.onPointerUp(null);

		expect(executeCommand).not.toHaveBeenCalled();
	});

	it('restores a graph node when a move is canceled', () => {
		const editor = new EditorState();
		editor.mode = 'move';
		const executeCommand = vi.spyOn(environmentState, 'executeCommand');

		editor.onPointerDown('edge-node');
		editor.onPointerMove(null, 100, 80);
		expect(environmentState.graph.nodes.get('edge-node')?.x).toBe(100);
		expect(environmentState.graph.nodes.get('edge-node')?.y).toBe(80);

		editor.onPointerLeave();

		expect(environmentState.graph.nodes.get('edge-node')?.x).toBe(0);
		expect(environmentState.graph.nodes.get('edge-node')?.y).toBe(0);
		expect(executeCommand).not.toHaveBeenCalled();
	});
});
