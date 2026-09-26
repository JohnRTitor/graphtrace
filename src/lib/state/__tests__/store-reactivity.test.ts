import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * A private field read by a public getter has to be `$state`.
 *
 * `PlaybackState._loadedExecutionId` was a plain field while every field around it
 * was `$state`. The UI reads `hasLoadedTrace` from `$derived` in the transport
 * dock, and a plain field registers no dependency, so those deriveds froze at
 * whatever they first computed:
 *
 *   hasTrace    -> permanently false
 *   panes       -> permanently empty
 *
 * The visible result was that every transport control iterated an empty list, and
 * the play button took its "no trace loaded yet" branch and re-ran the algorithm.
 * The slider jumped to the start and the canvas reset - a restart that looks
 * exactly like a pause that misfired. It read correctly when called imperatively,
 * which is why the same getter looked fine everywhere else.
 *
 * This cannot be caught by asserting behaviour: `$effect` is a no-op under
 * vitest's SSR condition, so a stale derived is indistinguishable from a fresh
 * one here. The declaration itself is the thing that is wrong, so that is what is
 * asserted.
 */
const STORES = [
	'playback.svelte.ts',
	'editor.svelte.ts',
	'environment.svelte.ts',
	'execution-store.svelte.ts',
	'history-store.svelte.ts'
];

const dir = new URL('../', import.meta.url).pathname;

/** Bodies of `get name() { ... }`, brace-matched so nested blocks do not truncate. */
function getterBodies(source: string): string[] {
	const bodies: string[] = [];
	const pattern = /\n\s*get\s+\w+\s*\([^)]*\)\s*(?::[^{]+)?\{/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(source)) !== null) {
		let depth = 1;
		let index = pattern.lastIndex;
		while (index < source.length && depth > 0) {
			if (source[index] === '{') depth += 1;
			else if (source[index] === '}') depth -= 1;
			index += 1;
		}
		bodies.push(source.slice(pattern.lastIndex, index - 1));
	}
	return bodies;
}

/** Private fields declared without `$state`. */
function plainPrivateFields(source: string): string[] {
	const fields: string[] = [];
	const pattern = /private\s+(_\w+)\s*(?::[^=;]+)?=\s*([^;\n]+)/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(source)) !== null) {
		if (!match[2].includes('$state')) fields.push(match[1]);
	}
	return fields;
}

describe('store fields exposed through getters are reactive', () => {
	it.each(STORES)('%s exposes no non-reactive field through a getter', (file) => {
		const source = readFileSync(dir + file, 'utf8');
		const exposed = new Set<string>();
		for (const body of getterBodies(source)) {
			for (const [, field] of body.matchAll(/this\.(_\w+)/g)) exposed.add(field);
		}
		const offenders = plainPrivateFields(source).filter((field) => exposed.has(field));
		expect(
			offenders,
			`${offenders.join(', ')} read from a getter but not $state, so any $derived over them is frozen`
		).toEqual([]);
	});

	it('keeps the loaded execution id reactive', () => {
		// Named explicitly as well, so the failure names the field that caused it.
		const source = readFileSync(dir + 'playback.svelte.ts', 'utf8');
		expect(source).toMatch(/private _loadedExecutionId\s*=\s*\$state/);
	});

	it('extracts getter bodies past nested braces, or the check above is vacuous', () => {
		// Guards the guard: a truncated scan would silently stop finding fields.
		const bodies = getterBodies(
			'class X {\n\tget a() {\n\t\tif (this._deep) {\n\t\t\treturn this._buried;\n\t\t}\n\t\treturn 0;\n\t}\n}'
		);
		expect(bodies).toHaveLength(1);
		expect(bodies[0]).toContain('this._buried');
	});
});
