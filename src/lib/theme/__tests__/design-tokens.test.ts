import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	darkTracePalette,
	lightTracePalette,
	PRUNED_OPACITY,
	elevation,
	radii,
	tracePaletteFor,
	TRACE_STATE_TOKENS,
	type TraceStateToken
} from '../tokens';

const SRC = join(process.cwd(), 'src');

/**
 * Every source file in the repo, read as raw text.
 *
 * Read from disk rather than through Vite's `?raw` because the Tailwind plugin
 * consumes `.css` before `?raw` can see it, and the stylesheet is half of what
 * this test checks.
 */
function sourceFiles(dir: string = SRC): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			found.push(...sourceFiles(full));
			continue;
		}
		if (/\.(ts|svelte|css|js)$/.test(entry)) found.push(full);
	}
	return found;
}

const allSource = sourceFiles()
	// This test asserts on its own source, so reading it back would be circular.
	.filter((file) => !file.includes('design-tokens.test'))
	.map((file) => ({ file: file.slice(SRC.length + 1), contents: readFileSync(file, 'utf8') }));

const css = allSource.find((entry) => entry.file === 'routes/layout.css')!.contents;

/**
 * The `@theme inline` block only. Bounding the slice matters: the
 * `prefers-reduced-motion` overrides further down the file are deliberately 0ms
 * and would otherwise be measured against the 150-220ms design band.
 */
const themeBlock = css.slice(css.indexOf('@theme inline {'), css.indexOf('@layer base {'));

/**
 * Files allowed to contain trace-palette literals: the TS token module and the
 * CSS custom-property declarations that mirror it. Nothing else.
 */
const ALLOWED = new Set(['lib/theme/tokens.ts', 'routes/layout.css']);

describe('design tokens', () => {
	it('reserves exactly five trace-state meanings', () => {
		expect([...TRACE_STATE_TOKENS]).toEqual([
			'frontier',
			'visited',
			'current',
			'path',
			'pruned'
		]);
	});

	it('gives every trace state a distinct colour in both themes', () => {
		for (const palette of [darkTracePalette, lightTracePalette]) {
			const values = TRACE_STATE_TOKENS.map((token) => palette[token]);
			expect(new Set(values).size, 'trace colours collided').toBe(values.length);
		}
	});

	it('uses the same hue identity in both themes, only lightness changes', () => {
		for (const token of TRACE_STATE_TOKENS) {
			const dark = hexToRgb(darkTracePalette[token]);
			const light = hexToRgb(lightTracePalette[token]);
			const darkHue = hueOf(dark);
			const lightHue = hueOf(light);

			// Allow a little slack for rounding, but a state must not change hue
			// between themes or "the blue one" would stop meaning one thing.
			expect(Math.min(angleDelta(darkHue, lightHue), angleDelta(darkHue, lightHue + 360)))
				.toBeLessThan(12);
		}
	});

	it('keeps every trace colour legible against its own theme background', () => {
		for (const theme of ['light', 'dark'] as const) {
			const palette = tracePaletteFor(theme);
			for (const token of TRACE_STATE_TOKENS) {
				expect(contrastRatio(palette[token], palette.background)).toBeGreaterThan(2.2);
			}
		}
	});

	it('keeps the trace palette literals out of every other file', () => {
		const literals = new Set<string>();
		for (const palette of [darkTracePalette, lightTracePalette]) {
			for (const token of TRACE_STATE_TOKENS) literals.add(palette[token]);
		}

		const offenders: string[] = [];
		for (const { file, contents } of allSource) {
			if (ALLOWED.has(file)) continue;
			for (const literal of literals) {
				// Case-insensitive: a renderer may not quietly re-spell the value.
				if (contents.toLowerCase().includes(literal.toLowerCase())) {
					offenders.push(`${file} contains ${literal}`);
				}
			}
		}

		expect(offenders).toEqual([]);
	});

	it('keeps the CSS custom properties in step with the TS palette', () => {

		for (const theme of ['light', 'dark'] as const) {
			const block = css.slice(css.indexOf(theme === 'dark' ? '.dark {' : ':root {'));
			const scoped = block.slice(0, block.indexOf('}'));
			for (const token of TRACE_STATE_TOKENS) {
				expect(scoped, `${theme} is missing --trace-${token}`).toContain(
					`--trace-${token}: ${tracePaletteFor(theme)[token]}`
				);
			}
		}
	});

	it('keeps every motion duration inside the 150-220ms design band', () => {
		const durations = [...themeBlock.matchAll(/--motion-duration-[a-z]+:\s*(\d+)ms/g)].map(
			(match) => Number(match[1])
		);

		expect(durations.length).toBeGreaterThan(0);
		for (const duration of durations) {
			expect(duration).toBeGreaterThanOrEqual(150);
			expect(duration).toBeLessThanOrEqual(220);
		}
	});

	it('names every motion duration it declares, so none is left uncollapsed', () => {
		const declared = new Set(
			[...themeBlock.matchAll(/--motion-duration-([a-z]+):/g)].map((match) => match[1])
		);
		const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

		for (const name of declared) {
			expect(reduced, `${name} is not collapsed under reduced motion`).toContain(
				`--motion-duration-${name}: 0ms`
			);
		}
	});

	it('collapses every motion duration under prefers-reduced-motion', () => {
		const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

		for (const name of ['feedback', 'state', 'canvas', 'panel']) {
			expect(reduced).toContain(`--motion-duration-${name}: 0ms`);
		}
		expect(reduced).toContain('transition-duration: 0ms !important');
	});

	it('registers a monospace face for data and keeps it separate from the UI face', () => {

		expect(css).toContain("@fontsource-variable/jetbrains-mono");
		expect(css).toContain("--font-mono: 'JetBrains Mono Variable'");
		expect(css).toContain("--font-sans: 'Inter Variable'");
	});

	it('documents its radii and elevation', () => {
		expect(Object.keys(radii)).toEqual(['sm', 'md', 'lg', 'xl', 'full']);
		expect(radii.lg).toBe(0.5);
		expect(PRUNED_OPACITY).toBeGreaterThan(0);
		expect(PRUNED_OPACITY).toBeLessThan(1);
	});

	it('keeps the elevation and radius docs true', () => {
		const doc = readFileSync(join(process.cwd(), 'docs/design-tokens.md'), 'utf8');

		// The doc is only useful if it describes the shipped values, so the values
		// it quotes are checked rather than trusted.
		expect(doc).toContain(`--radius-lg\` | \`${radii.lg}rem\``);
		for (const value of Object.values(elevation)) {
			expect(doc).toContain(value);
			expect(themeBlock).toContain(value);
		}
		expect(PRUNED_OPACITY).toBe(0.32);
		expect(doc).toContain('0.32');
	});

	it('leaves no shadcn chart tokens behind', () => {
		// The app draws no charts. Leaving these primary-adjacent tokens around
		// invites them being used for something that is not a chart.
		expect(css).not.toMatch(/--chart-\d/);
		expect(themeBlock).not.toMatch(/--color-chart-/);
	});

	it('keeps the dark background a graphite rather than pure black', () => {
		const dark = css.slice(css.indexOf('.dark {'));
		const background = dark.match(/--background:\s*([^;]+);/)?.[1]?.trim();

		expect(background).toBeTruthy();
		expect(background).not.toBe('oklch(0 0 0)');
		expect(background).not.toBe('#000');
		expect(background).not.toBe('#000000');
	});
});

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
	return {
		r: parseInt(hex.slice(1, 3), 16),
		g: parseInt(hex.slice(3, 5), 16),
		b: parseInt(hex.slice(5, 7), 16)
	};
}

function hueOf({ r, g, b }: Rgb): number {
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	if (delta === 0) return 0;
	let hue: number;
	if (max === r) hue = ((g - b) / delta) % 6;
	else if (max === g) hue = (b - r) / delta + 2;
	else hue = (r - g) / delta + 4;
	return ((hue * 60) % 360 + 360) % 360;
}

function angleDelta(a: number, b: number): number {
	return Math.abs(((a - b + 540) % 360) - 180);
}

function relativeLuminance(hex: string): number {
	const { r, g, b } = hexToRgb(hex);
	const channel = (value: number) => {
		const normalized = value / 255;
		return normalized <= 0.03928
			? normalized / 12.92
			: Math.pow((normalized + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: string, b: string): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const [light, dark] = la > lb ? [la, lb] : [lb, la];
	return (light + 0.05) / (dark + 0.05);
}

export type { TraceStateToken };
