import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeShapeFor, NODE_SHAPE_CLASSES } from '../tree-adapter';
import type { GamePlayer } from '$lib/graph/game-tree';

const NODE_SOURCE = readFileSync(
	new URL('../GameTreeNode.svelte', import.meta.url).pathname,
	'utf8'
);

/**
 * MAX and MIN are told apart by shape as well as hue, because hue does not
 * survive a colourblind view or a greyscale screenshot.
 *
 * The shapes used to be the same rectangle with a different pair of corners
 * rounded, which at 64px tall is very close to invisible - it read as a
 * rendering bug rather than a design. So the contract asserted here is that MAX
 * and MIN resolve to genuinely different outlines.
 *
 * These test the shape table rather than rendered markup: `GameTreeNode` renders
 * SvelteFlow `Handle`s, which require a node context that only exists inside a
 * live flow, so the component cannot be server-rendered on its own.
 */
describe('game tree node shape encodes the player', () => {
	it('maps MAX to a rectangle and MIN to a circle', () => {
		expect(nodeShapeFor('max')).toBe('rectangle');
		expect(nodeShapeFor('min')).toBe('circle');
	});

	it('gives a leaf its own shape, distinct from both', () => {
		expect(nodeShapeFor('terminal')).toBe('leaf');
		const players: GamePlayer[] = ['max', 'min', 'terminal'];
		expect(new Set(players.map((player) => nodeShapeFor(player))).size).toBe(3);
	});

	it('rounds the circle fully and leaves the rectangle square', () => {
		expect(NODE_SHAPE_CLASSES.circle).toContain('rounded-full');
		expect(NODE_SHAPE_CLASSES.rectangle).toContain('rounded-none');
		expect(NODE_SHAPE_CLASSES.rectangle).not.toMatch(/rounded-(?!none)/);
	});

	it('makes the circle square, or rounded-full draws an ellipse', () => {
		// Equal width and height is what makes `rounded-full` a circle.
		const width = NODE_SHAPE_CLASSES.circle.match(/\bw-(\S+)/)?.[1];
		const height = NODE_SHAPE_CLASSES.circle.match(/\bh-(\S+)/)?.[1];
		expect(width).toBeDefined();
		expect(height).toBe(width);
	});

	it('gives every shape a distinct outline', () => {
		const outlines = Object.values(NODE_SHAPE_CLASSES).map((c) =>
			c.match(/rounded\S*/)?.[0] ?? 'none'
		);
		expect(new Set(outlines).size).toBe(outlines.length);
	});

	it('keeps rectangles at the layout footprint width', () => {
		// The adapter positions nodes on a 148px box, so a rectangle must not
		// narrow itself or the tree stops lining up with its computed layout.
		for (const shape of ['rectangle', 'leaf'] as const) {
			expect(NODE_SHAPE_CLASSES[shape]).toContain('w-[148px]');
		}
	});

	it('is applied verbatim by the component, so the two cannot drift', () => {
		expect(NODE_SOURCE).toContain('NODE_SHAPE_CLASSES[shape]');
		// No shape may be hard-coded in the component, or there would be a second
		// definition that the table above does not describe.
		expect(NODE_SOURCE).not.toMatch(/class:rounded-(full|none|lg)/);
		expect(NODE_SOURCE).not.toMatch(/class:(h|w)-\d+/);
	});
});
