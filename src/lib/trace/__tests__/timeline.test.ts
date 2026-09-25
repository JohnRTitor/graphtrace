import { describe, expect, it } from 'vitest';
import { toTraceEvents } from '../types';
import { buildTimeline, kindToTraceToken, kindsInOrder, TIMELINE_BUCKETS } from '../timeline';

const trace = (kinds: string[]) => toTraceEvents(kinds.map((kind) => kind), kinds);

describe('trace timeline', () => {
	describe('buildTimeline', () => {
		it('is empty for an empty trace', () => {
			expect(buildTimeline([])).toEqual([]);
		});

		it('caps the number of columns regardless of trace length', () => {
			expect(buildTimeline(trace(new Array(50_000).fill('visit')))).toHaveLength(TIMELINE_BUCKETS);
			expect(buildTimeline(trace(new Array(50_000).fill('visit')), 20)).toHaveLength(20);
		});

		it('never produces more columns than there are events', () => {
			expect(buildTimeline(trace(['a', 'b', 'c']), 100)).toHaveLength(3);
		});

		it('accounts for every event exactly once', () => {
			const buckets = buildTimeline(trace(new Array(1000).fill('visit')));
			expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1000);
		});

		it('starts each bucket where the previous one ended', () => {
			const buckets = buildTimeline(trace(new Array(37).fill('visit')));
			for (let index = 1; index < buckets.length; index++) {
				expect(buckets[index].start).toBe(
					buckets[index - 1].start + buckets[index - 1].count
				);
			}
		});

		it('tallies the kinds inside each bucket', () => {
			const buckets = buildTimeline(trace(['visit', 'evaluate', 'visit', 'backup']), 1);

			expect(buckets).toHaveLength(1);
			expect(buckets[0].count).toBe(4);
			expect(buckets[0].kinds.map((entry) => entry.kind).sort()).toEqual([
				'backup',
				'evaluate',
				'visit'
			]);
			expect(buckets[0].kinds.find((entry) => entry.kind === 'visit')?.count).toBe(2);
		});

		it('orders the kinds of a bucket by how common they are', () => {
			const buckets = buildTimeline(trace(['visit', 'visit', 'visit', 'prune']), 1);
			expect(buckets[0].kinds[0]).toEqual({ kind: 'visit', count: 3 });
		});

		it('never reports a kind count exceeding the bucket size', () => {
			for (const bucket of buildTimeline(trace(['a', 'a', 'b', 'c', 'c', 'c']), 3)) {
				for (const entry of bucket.kinds) {
					expect(entry.count).toBeLessThanOrEqual(bucket.count);
				}
			}
		});
	});

	describe('kindToTraceToken', () => {
		it('maps the pathfinding vocabulary onto the reserved colours', () => {
			expect(kindToTraceToken('discover')).toBe('frontier');
			expect(kindToTraceToken('expand')).toBe('visited');
			expect(kindToTraceToken('update')).toBe('visited');
			expect(kindToTraceToken('path')).toBe('path');
			expect(kindToTraceToken('no-path')).toBe('pruned');
		});

		it('maps the adversarial vocabulary onto the reserved colours', () => {
			expect(kindToTraceToken('visit')).toBe('visited');
			expect(kindToTraceToken('evaluate')).toBe('visited');
			expect(kindToTraceToken('prune')).toBe('pruned');
			expect(kindToTraceToken('backup')).toBe('current');
			expect(kindToTraceToken('choose')).toBe('current');
		});

		it('falls back to neutral rather than borrowing a trace colour', () => {
			// A lifecycle marker has no visual state of its own. If it borrowed, say,
			// the frontier colour, then "frontier" would stop meaning one thing.
			expect(kindToTraceToken('start')).toBe('neutral');
			expect(kindToTraceToken('finish')).toBe('neutral');
			expect(kindToTraceToken('some-future-kinds-kind')).toBe('neutral');
		});

		it('only ever returns reserved tokens or neutral', () => {
			const kinds = ['start', 'discover', 'expand', 'update', 'skip', 'path', 'no-path', 'finish',
				'visit', 'evaluate', 'prune', 'backup', 'choose', 'augment', 'saturate', 'compare', 'swap'];
			for (const kind of kinds) {
				expect(['frontier', 'visited', 'current', 'path', 'pruned', 'neutral']).toContain(
					kindToTraceToken(kind)
				);
			}
		});
	});

	describe('kindsInOrder', () => {
		it('lists each kind once, in first-appearance order', () => {
			expect(kindsInOrder(trace(['start', 'visit', 'evaluate', 'visit', 'backup']))).toEqual([
				'start',
				'visit',
				'evaluate',
				'backup'
			]);
		});

		it('is empty for an empty trace', () => {
			expect(kindsInOrder([])).toEqual([]);
		});
	});
});
