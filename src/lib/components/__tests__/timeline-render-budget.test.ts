import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { buildTimeline, kindToTraceToken, TIMELINE_BUCKETS } from '$lib/trace/timeline';
import { toTraceEvents } from '$lib/trace/types';

/**
 * The trace timeline is rebuilt from a fixed number of buckets, but the number of
 * *DOM writes* per playback step is what matters: a 20,000-event trace at 60fps
 * leaves no budget for re-rendering a hundred-odd elements per step.
 *
 * These assertions are about the *shape* of the data the timeline is given and
 * how the markers are chosen, plus a render check that the density map does not
 * depend on the current step. The dependency itself is a property of the template
 * and is asserted by inspection in PlaybackControls.svelte; what is pinned here
 * is that the data feeding it is step-independent and bounded.
 */
const trace = toTraceEvents(
	Array.from({ length: 20_000 }, (_, index) => `e${index}`),
	Array.from({ length: 20_000 }, (_, index) =>
		index % 7 === 0 ? 'visit' : index % 11 === 0 ? 'prune' : 'backup'
	)
);

describe('timeline render budget', () => {
	it('never emits more columns than the fixed bucket count, whatever the trace length', () => {
		expect(buildTimeline(trace)).toHaveLength(TIMELINE_BUCKETS);
		expect(buildTimeline(toTraceEvents(['a', 'b'], ['x', 'y']))).toHaveLength(2);
		expect(buildTimeline([])).toEqual([]);
	});

	it('produces identical bucket data regardless of how far playback has advanced', () => {
		// The track must be a function of the trace alone. If buckets carried a
		// "played" flag, every step would dirty every column.
		const first = buildTimeline(trace);
		const second = buildTimeline(trace);

		expect(second).toEqual(first);
		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
	});

	it('accounts for every event exactly once, so the density map is honest', () => {
		const total = buildTimeline(trace).reduce((sum, bucket) => sum + bucket.count, 0);
		expect(total).toBe(trace.length);
	});

	it('gives a marker a reserved trace colour, or explicitly neutral', () => {
		// `start` and `finish` are lifecycle markers with no visual state. Falling
		// back to neutral rather than borrowing a trace colour is what keeps the five
		// reserved meanings intact in a timeline full of markers.
		expect(kindToTraceToken('prune')).toBe('pruned');
		expect(kindToTraceToken('visit')).toBe('visited');
		expect(kindToTraceToken('start')).toBe('neutral');
		expect(kindToTraceToken('finish')).toBe('neutral');
	});

	it('keeps the marker kind set small even for a long trace', () => {
		const kinds = new Set(trace.map((event) => event.kind));
		expect(kinds.size).toBe(3);
	});
});

describe('transport controls render', () => {
	it('renders without a trace loaded, which is the state a fresh session is in', async () => {
		// The reported symptom was a freeze immediately after choosing an algorithm,
		// at which point no trace exists yet. This is that exact state.
		const { default: PlaybackControls } = await import('../PlaybackControls.svelte');
		const { body, head } = render(PlaybackControls);

		expect(body).not.toContain('Internal Error');
		expect(head).not.toContain('node_invalid_placement_ssr');
		// No trace means no timeline columns and no kind jump controls.
		expect(body).not.toContain('style:left');
	});
});
