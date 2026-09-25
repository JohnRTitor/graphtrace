import type { TraceEvent } from './types';

/**
 * One tick per event kind per bucket.
 *
 * A minimax trace over a depth-limited Tic-Tac-Toe tree runs to tens of
 * thousands of events. Drawing a DOM element per event would make the scrubber
 * slower than the thing it is scrubbing, so the track is binned: each bucket
 * keeps the kinds present in it and the count for each.
 */
export type TimelineBucket = {
	/** Index of the first event in this bucket. */
	start: number;
	/** Number of events in this bucket. */
	count: number;
	/** Event kinds present, with how many of each. */
	kinds: { kind: string; count: number }[];
};

export const TIMELINE_BUCKETS = 120;

/**
 * Bins a trace into a fixed number of buckets, preserving order and totals.
 *
 * The bucket count is capped so the rendered width is stable: a 20,000-event
 * trace and a 200-event one produce the same number of ticks, only denser.
 */
export function buildTimeline(
	events: readonly TraceEvent[],
	bucketCount: number = TIMELINE_BUCKETS
): TimelineBucket[] {
	if (events.length === 0) return [];

	const total = events.length;
	const buckets: TimelineBucket[] = [];
	const usable = Math.max(1, Math.min(bucketCount, total));

	for (let index = 0; index < usable; index++) {
		const start = Math.floor((index * total) / usable);
		const end = Math.max(start + 1, Math.floor(((index + 1) * total) / usable));
		const tally = new Map<string, number>();
		for (let step = start; step < end && step < total; step++) {
			const kind = events[step].kind;
			tally.set(kind, (tally.get(kind) ?? 0) + 1);
		}
		buckets.push({
			start,
			count: end - start,
			kinds: Array.from(tally, ([kind, count]) => ({ kind, count })).sort(
				(a, b) => b.count - a.count
			)
		});
	}

	return buckets;
}

/**
 * Maps an event kind onto one of the five reserved trace colours.
 *
 * A kind that has no reserved colour - `start`, `finish`, or a future family's
 * own word - falls back to the muted foreground rather than borrowing a trace
 * colour, because borrowing one would break the fixed meaning of that colour.
 */
export function kindToTraceToken(kind: string): 'frontier' | 'visited' | 'current' | 'path' | 'pruned' | 'neutral' {
	switch (kind) {
		case 'discover':
			return 'frontier';
		case 'expand':
		case 'update':
		case 'visit':
		case 'evaluate':
			return 'visited';
		case 'backup':
		case 'choose':
			return 'current';
		case 'path':
			return 'path';
		case 'prune':
			return 'pruned';
		case 'no-path':
			return 'pruned';
		default:
			// start / finish and anything a future family invents.
			return 'neutral';
	}
}

/** The event kinds present in a trace, in the order they first appear. */
export function kindsInOrder(events: readonly TraceEvent[]): string[] {
	const order: string[] = [];
	for (const event of events) {
		if (!order.includes(event.kind)) order.push(event.kind);
	}
	return order;
}

export type { TraceEvent };
