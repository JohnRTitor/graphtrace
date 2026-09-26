import type { Component } from 'svelte';
import type { Problem } from '../domain/problem';
import type { EnvironmentType } from '../generators/types';
import type { MetricColumn, TraceEvent, TraceState } from '../trace/types';
import type { AlgorithmSummary } from '../algorithms/types';
import type { GameTree } from '../graph/game-tree';

/**
 * A field in the inspector schema.
 *
 * The inspector is data-driven per family so adding a family does not mean
 * writing a new inspector component. `read`/`value` are zero-argument thunks
 * because the schema is rebuilt whenever the panel renders, which is what keeps
 * the fields live without a subscription per field.
 */
export type InspectorField =
	| {
			kind: 'text' | 'number';
			id: string;
			label: string;
			description?: string;
			read: () => string | number;
			write?: (value: string) => void;
			mono?: boolean;
	  }
	| {
			kind: 'readonly';
			id: string;
			label: string;
			value: () => string;
			mono?: boolean;
	  }
	| {
			kind: 'derived';
			id: string;
			label: string;
			value: () => string;
			hint?: string;
			mono?: boolean;
	  };
/** Resolves a schema field's current display value. */
export function inspectorFieldValue(field: InspectorField): string {
	// `read` and `value` are mutually exclusive across the union, so a field is
	// read through whichever it declares.
	const source = field as { read?: () => string | number; value?: () => string };
	return String(source.read?.() ?? source.value?.() ?? '');
}

/** A labelled swatch in the Legend tab, bound to a trace-state token. */
export type LegendEntry = {
	/** Key into the semantic trace palette defined in the theme. */
	token: TraceStateToken;
	label: string;
	description: string;
};

/**
 * The reserved trace-state vocabulary. These five meanings hold across every
 * family and are never reused for generic chrome - see the design tokens doc.
 */
export type TraceStateToken = 'frontier' | 'visited' | 'current' | 'path' | 'pruned';

/**
 * A problem family: the unit of extension.
 *
 * The first block is the prompt's shape. The `matchProblem` / `createTraceState`
 * / `reduce` / `toTraceEvents` hooks are the additions required for a family to
 * actually *run* rather than merely be described; all four are data, so adding a
 * family is still one file. See docs/adr/0001.
 */
export type ProblemFamily = {
	id: string;
	name: string;
	icon: Component<{ class?: string }>;
	environmentTypes: EnvironmentType[];
	/** Algorithm ids resolved through the per-algorithm registry. */
	algorithms: string[];
	eventKinds: string[];
	renderer: Component<{ playback?: unknown }>;
	inspectorSchema: () => InspectorField[];
	metricsColumns: MetricColumn[];
	/** `planned` families are visible in the switcher but have nothing wired up. */
	status: 'ready' | 'planned';
	description: string;

	// --- execution hooks ---
	/** Whether this family owns the given problem. */
	matchProblem: (problem: Problem) => boolean;
	createTraceState: () => TraceState;
	reduce: (state: TraceState, event: TraceEvent) => TraceState;
	/**
	 * In-place fast path for the playback engine, equivalent to `reduce` but
	 * allowed to mutate and return the same state object.
	 *
	 * Optional: the engine falls back to `reduce` when a family does not supply
	 * one, so this is only for families whose trace is hot enough to be worth a
	 * hand-written mutating reducer.
	 *
	 * The `tree` is the game tree the execution was snapshotted with. Only the
	 * game-tree family needs it, to dim a pruned subtree, but it is threaded
	 * through uniformly rather than special-cased per family.
	 */
	stepInto?: (state: TraceState, event: TraceEvent, tree?: GameTree) => TraceState;
	/** Wraps a family's native trace into the shared envelope. */
	toTraceEvents: (trace: readonly unknown[]) => TraceEvent[];
	/** Algorithm summaries for the palette, resolved from the algorithm registry. */
	algorithmSummaries: () => AlgorithmSummary[];
	legend: () => LegendEntry[];
};

export type FamilyId = string;

/**
 * The canvas component that owns a family's visualization.
 *
 * Every renderer takes the same `playback` prop so `CanvasView` and the
 * comparison grid can mount any family's renderer without knowing which family
 * it is. The type is structural (rather than importing `PlaybackState`) so this
 * module stays free of state imports.
 */
export type RendererProps = {
	playback?: unknown;
};

export type RendererComponent = Component<RendererProps>;
