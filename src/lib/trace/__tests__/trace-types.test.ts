import { describe, expect, it } from 'vitest';
import {
	nextStepOfKind,
	previousStepOfKind,
	toTraceEvents
} from '../types';

const trace = toTraceEvents(
	['a1', 'b1', 'a2', 'c1', 'b2'],
	['alpha', 'beta', 'alpha', 'gamma', 'beta']
);

describe('trace envelope', () => {
	it('numbers events by position and pairs each kind with its payload', () => {
		expect(trace).toEqual([
			{ step: 0, kind: 'alpha', payload: 'a1' },
			{ step: 1, kind: 'beta', payload: 'b1' },
			{ step: 2, kind: 'alpha', payload: 'a2' },
			{ step: 3, kind: 'gamma', payload: 'c1' },
			{ step: 4, kind: 'beta', payload: 'b2' }
		]);
	});

	it('marks a kind it was not given as unknown rather than dropping the event', () => {
		const mismatched = toTraceEvents(['x', 'y'], ['alpha']);

		expect(mismatched[0].kind).toBe('alpha');
		expect(mismatched[1].kind).toBe('unknown');
	});

	it('wraps an empty trace', () => {
		expect(toTraceEvents([], [])).toEqual([]);
	});

	describe('nextStepOfKind', () => {
		it('finds the next matching event strictly after the current step', () => {
			expect(nextStepOfKind(trace, 'beta', 0)).toBe(1);
			expect(nextStepOfKind(trace, 'alpha', 0)).toBe(2);
		});

		it('wraps around to the start of the trace', () => {
			expect(nextStepOfKind(trace, 'alpha', 2)).toBe(0);
			expect(nextStepOfKind(trace, 'beta', 4)).toBe(1);
		});

		it('returns -1 for a kind that never occurs', () => {
			expect(nextStepOfKind(trace, 'prune', 0)).toBe(-1);
		});

		it('returns -1 for an empty trace', () => {
			expect(nextStepOfKind([], 'alpha', 0)).toBe(-1);
		});
	});

	describe('previousStepOfKind', () => {
		it('finds the previous matching event strictly before the current step', () => {
			expect(previousStepOfKind(trace, 'alpha', 2)).toBe(0);
			expect(previousStepOfKind(trace, 'beta', 4)).toBe(1);
		});

		it('wraps around to the end of the trace', () => {
			expect(previousStepOfKind(trace, 'beta', 1)).toBe(4);
		});

		it('returns -1 for a kind that never occurs', () => {
			expect(previousStepOfKind(trace, 'prune', 3)).toBe(-1);
		});
	});
});
