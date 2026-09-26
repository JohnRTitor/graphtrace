import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('../../', import.meta.url).pathname;

function svelteFiles(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry.startsWith('.')) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) svelteFiles(full, found);
		else if (entry.endsWith('.svelte')) found.push(full);
	}
	return found;
}

/**
 * `fitView` from `useSvelteFlow` reads the viewport to decide where to pan and
 * then writes it. Called directly inside an `$effect`, those reads become
 * dependencies of that effect, so the write re-triggers the effect and it fits
 * again - an animated fit that re-arms itself every frame.
 *
 * That is not theoretical: selecting an algorithm froze the whole app with
 * `effect_update_depth_exceeded` thrown from GameTreeCanvas, and the graph
 * editor carried the identical pattern. The loop is invisible in review because
 * `fitView` looks like a harmless imperative call.
 *
 * Wrapping the call in `untrack()` keeps its internal reads out of the
 * dependency graph, which is the only thing that makes it safe here.
 */
describe('viewport effects do not self-trigger', () => {
	const files = svelteFiles(SRC);

	it('finds the canvas components', () => {
		expect(files.length).toBeGreaterThan(10);
	});

	it.each(files)('%s wraps any fitView call made inside an effect', (file) => {
		const source = readFileSync(file, 'utf8');

		// Every `$effect(...)` / `$effect.by(...)` body in the file.
		const bodies = source.match(/\$effect(?:\.by)?\([\s\S]*?\n\t\}\);/g) ?? [];
		for (const body of bodies) {
			if (!/\bfitView\s*\(/.test(body)) continue;
			// Strip the comment block so the explanation of *why* untrack is needed
			// does not read as a call site.
			const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
			const calls = code.match(/\bfitView\s*\(/g) ?? [];
			const untracked = code.match(/untrack\s*\([\s\S]*?\bfitView\s*\(/g) ?? [];
			expect(
				untracked.length,
				`fitView inside an $effect must be wrapped in untrack():\n${body.trim()}`
			).toBe(calls.length);
		}
	});
});
