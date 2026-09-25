/**
 * Family-agnostic trace transport.
 *
 * `TraceEvent` is the envelope every piece of shared chrome consumes (playback
 * engine, timeline scrubber, comparison view, metrics table). Its `kind` is always
 * one of the owning family's declared `eventKinds`; its `payload` is opaque here.
 *
 * A family keeps its native payload union (e.g. `AlgorithmEvent` for pathfinding)
 * and converts on demand via its `toTraceEvents` adapter, so nothing about the
 * family's own semantics leaks into the shared layer.
 *
 * See docs/adr/0001-problem-families-and-trace-events.md
 */

import type { VisualizationState } from '../visualization/types';
import type { GameTreeTraceState } from '../families/adversarial/tree-state';

/**
 * The trace state a family produces, as a structural union.
 *
 * Type-only imports, so this module stays free of a runtime cycle back into the
 * families. Renderers narrow structurally (`'cellStates' in state`) rather than by
 * a discriminant field, which is what lets the pre-existing `VisualizationState`
 * keep its exact shape - the reducer and player tests assert on it.
 */
export type TraceState = VisualizationState | GameTreeTraceState;

export type TraceEvent<TPayload = unknown> = {
	/** Zero-based index of this event within its trace. */
	step: number;
	/** Discriminator drawn from the owning family's `eventKinds` vocabulary. */
	kind: string;
	/** Family-specific event data. Never inspected by shared chrome. */
	payload: TPayload;
};

/** How a metric column reads its value out of a family's metrics record. */
export type MetricColumn = {
	/** Key into the family's metrics record. */
	key: string;
	label: string;
	/** Which direction is "better"; drives comparison highlighting. */
	better?: 'lower' | 'higher';
	/** Overrides the default numeric rendering (e.g. percentages, ms suffixes). */
	format?: (value: number) => string;
	/** Shown as the row's tooltip, so a metric is self-explaining. */
	description?: string;
};

/** A flat, numeric metrics record as produced by any family. */
export type MetricsRecord = Record<string, number>;

/**
 * Fields every family metrics record shares, so the chrome can render a status
 * row without knowing the family.
 */
export const commonMetricColumns: MetricColumn[] = [
	{
		key: 'executionTimeMs',
		label: 'Execution Time',
		better: 'lower',
		format: (value) => `${value.toFixed(2)} ms`
	}
];

/** Builds the envelope for a native trace. `kinds[i]` supplies `TraceEvent.kind`. */
export function toTraceEvents<TPayload>(
	payloads: readonly TPayload[],
	kinds: readonly string[]
): TraceEvent<TPayload>[] {
	return payloads.map((payload, step) => ({
		step,
		kind: kinds[step] ?? 'unknown',
		payload
	}));
}

/**
 * Finds the next event of `kind` strictly after `fromStep`, wrapping to the
 * beginning. Returns -1 when the trace contains no such event.
 *
 * Linear rather than indexed: the timeline's track is binned separately and the
 * jump controls are used one at a time, so building a full index per trace would
 * cost more than it saves.
 */
export function nextStepOfKind(
	events: readonly TraceEvent[],
	kind: string,
	fromStep: number
): number {
	for (let i = fromStep + 1; i < events.length; i++) {
		if (events[i].kind === kind) return i;
	}
	for (let i = 0; i <= Math.min(fromStep, events.length - 1); i++) {
		if (events[i].kind === kind) return i;
	}
	return -1;
}

/** Finds the previous event of `kind` strictly before `fromStep`, wrapping. */
export function previousStepOfKind(
	events: readonly TraceEvent[],
	kind: string,
	fromStep: number
): number {
	for (let i = Math.min(fromStep, events.length - 1) - 1; i >= 0; i--) {
		if (events[i].kind === kind) return i;
	}
	for (let i = events.length - 1; i > fromStep; i--) {
		if (events[i].kind === kind) return i;
	}
	return -1;
}
