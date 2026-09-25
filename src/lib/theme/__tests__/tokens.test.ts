import { describe, expect, it } from 'vitest';
import { darkTracePalette, lightTracePalette, tracePaletteFor } from '../tokens';

/**
 * Two palette entries sharing a value is invisible in review and ambiguous on
 * screen: nothing tells the reader that the green outline on a cell is a cursor
 * rather than the start marker, because to the eye they are the same green.
 *
 * This actually happened - the selection outline was drawn in `path`, which is
 * the solution-path green and the same value as `start`, so painting with the
 * goal brush left a green ring on the finish cell that read as a start marker.
 */
const PALETTES = [
	['dark', darkTracePalette],
	['light', lightTracePalette]
] as const;

/**
 * Pairs that deliberately share a hue, because they never have to be told apart
 * where they meet. `path` fills whole cells along the solution and `start` is a
 * 2px outline; a green cell with a green outline is one meaning, not two.
 *
 * Anything not listed here must be distinguishable - that is the rule the
 * selection/goal bug broke.
 */
const INTENTIONAL_SHARED_HUES: Record<string, ReadonlySet<string>> = {
	path: new Set(['start']),
	start: new Set(['path'])
};

const isIntentional = (a: string, b: string) =>
	INTENTIONAL_SHARED_HUES[a]?.has(b) ?? false;

describe('trace palette', () => {
	it.each(PALETTES)('%s keeps every colour distinct unless sharing is intentional', (_name, palette) => {
		const entries = Object.entries(palette);
		for (const [key, value] of entries) {
			for (const [otherKey, otherValue] of entries) {
				if (key === otherKey) continue;
				if (isIntentional(key, otherKey)) continue;
				expect(
					value === otherValue,
					`${key} and ${otherKey} are both ${value}, so one is indistinguishable from the other`
				).toBe(false);
			}
		}
	});

	it.each(PALETTES)('%s distinguishes the selection outline from everything else', (_name, palette) => {
		// The specific collision that made the goal brush look broken. The selection
		// is the one cursor-like colour, so it has to be unique: it is drawn in the
		// topmost layer and will happily land on top of a marker.
		expect(palette.selection).not.toBe(palette.start);
		expect(palette.selection).not.toBe(palette.goal);
		expect(palette.selection).not.toBe(palette.path);
	});

	it.each(PALETTES)('%s uses opaque hex for structural colours', (_name, palette) => {
		// `hover` is deliberately alpha; everything else is a solid hex.
		for (const key of ['background', 'surface', 'structure', 'barrier', 'start', 'goal', 'selection'] as const) {
			expect(palette[key], `${key} should be a hex colour`).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it('resolves per theme and keeps hue identity across themes', () => {
		expect(tracePaletteFor('dark')).toBe(darkTracePalette);
		expect(tracePaletteFor('light')).toBe(lightTracePalette);
	});
});

