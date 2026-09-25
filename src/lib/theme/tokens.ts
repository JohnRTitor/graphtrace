/**
 * GraphTrace design tokens - the single source of truth.
 *
 * Three separate vocabularies live here, and keeping them apart is the point:
 *
 * 1. **Chrome** - surfaces, text, borders, the one accent hue. Used for
 *    interface furniture: buttons, badges, panels, focus rings.
 * 2. **Trace state** - exactly five meanings, colourblind-safe, held fixed across
 *    every problem family. `frontier | visited | current | path | pruned` mean the
 *    same thing in a grid BFS and in a minimax trace.
 * 3. **Motion and shape** - durations, easings and radii.
 *
 * The trace-state palette is deliberately NOT exposed as Tailwind colour classes
 * and must never be reused for generic chrome: if a badge were green, "green"
 * would stop meaning "final path". `__tests__/design-tokens.test.ts` enforces
 * that the hex values below appear in no other file.
 *
 * Colours are drawn from the Okabe-Ito colourblind-safe set. Konva cannot read
 * CSS custom properties, so the same values are mirrored here as hex for the
 * canvas renderers; that is why this file is the only place they may appear.
 */

export type ThemeName = 'light' | 'dark';

/** The reserved trace-state vocabulary. Fixed: adding a meaning is a redesign. */
export const TRACE_STATE_TOKENS = [
	'frontier',
	'visited',
	'current',
	'path',
	'pruned'
] as const;

export type TraceStateToken = (typeof TRACE_STATE_TOKENS)[number];

export type TracePalette = Record<TraceStateToken, string> & {
	/** Untraced environment surface, e.g. a walkable grid cell. */
	surface: string;
	/** Barriers and other non-traversable environment. */
	barrier: string;
	/** Faint grid or dot pattern. */
	structure: string;
	/** Secondary text inside the canvas. */
	mutedText: string;
	/** Canvas background. */
	background: string;
	/** Selection outline. */
	selection: string;
	/** Start / goal markers. */
	start: string;
	goal: string;
	/** Pointer-hover wash. Alpha, so it differs per theme. */
	hover: string;
};

export const darkTracePalette: TracePalette = {
	background: '#12141a',
	surface: '#1b1f2a',
	structure: '#272c3a',
	barrier: '#39405a',
	mutedText: '#8b93a7',

	// Okabe-Ito hues, at dark-theme lightness.
	frontier: '#56b4e9',
	visited: '#5b8def',
	current: '#f5d90a',
	path: '#2fbf8f',
	pruned: '#c77dbb',

	hover: 'rgba(255, 255, 255, 0.18)',
	start: '#2fbf8f',
	goal: '#e8734a',
	selection: '#7cc4ff'
};

export const lightTracePalette: TracePalette = {
	background: '#f7f8fa',
	surface: '#e9ecf2',
	structure: '#d5dae4',
	barrier: '#a8b0c2',
	mutedText: '#5a6377',

	// Same hues as dark, darkened for legibility on a light surface. The hue
	// identity is what carries the meaning, so it must not change with theme.
	frontier: '#1b7fb8',
	visited: '#2a4fb8',
	current: '#a37b00',
	path: '#0f7a58',
	pruned: '#9c4b8f',

	hover: 'rgba(15, 23, 42, 0.12)',
	start: '#0f7a58',
	goal: '#b8421f',
	selection: '#1b6fb5'
};

export function tracePaletteFor(theme: ThemeName): TracePalette {
	return theme === 'dark' ? darkTracePalette : lightTracePalette;
}

/** Opacity applied to pruned content, on top of its own colour. */
export const PRUNED_OPACITY = 0.32;

/**
 * Motion.
 *
 * Durations are in the 150-220ms band the design calls for: long enough to read
 * as a cause-and-effect transition, short enough not to make stepping through a
 * trace feel laggy. `--motion-duration-*` is driven to 0ms by the
 * `prefers-reduced-motion` block in layout.css, so every consumer needs no
 * JavaScript to respect the preference.
 */
export const motion = {
	/** Node/edge/tree-branch state change. */
	state: 180,
	/** Panel open and close. */
	panel: 220,
	/** Canvas pan and zoom. */
	canvas: 200,
	/** Small affordance feedback, e.g. a pressed button. */
	feedback: 150
} as const;

/** Spring used for panel open/close, as a CSS `linear()` easing. */
export const springEasing =
	'linear(0, 0.0083 1.1%, 0.0327 2.2%, 0.1264 4.4%, 0.5207 8.9%, 0.6871 11.6%, 0.8462 14.4%, 0.9566 17.2%, 1.0247 19.9%, 1.0573 22.7%, 1.0594 25.6%, 1.0352 30.4%, 0.9999 35.4%, 0.9772 40.2%, 0.9963 47%, 1.0053 55.4%, 1.0017 65.4%, 1)';

/** Standard ease-out for state changes. */
export const easeOut = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Radii, in rem. Tighter than the shadcn default for controls and cards, because
 * this is a dense technical tool: rounded chrome reads as friendly, and sharp
 * chrome reads as an instrument.
 */
export const radii = {
	sm: 0.25,
	md: 0.375,
	lg: 0.5,
	xl: 0.75,
	full: 9999
} as const;

/**
 * Elevation. Two steps only: a resting card and a floating surface. More steps
 * than that and a dense three-column layout stops reading as flat. Mirrored as
 * `--shadow-rest` / `--shadow-raised` in layout.css.
 */
export const elevation = {
	rest: '0 1px 2px 0 rgb(0 0 0 / 0.28)',
	raised: '0 8px 24px -6px rgb(0 0 0 / 0.45)'
} as const;

