import { describe, expect, it } from 'vitest';
import { isPlaybackEcho, quantiseToStep, stepForPercentage, TIMELINE_STEP } from '../playback.svelte';

/**
 * The timeline scrubber is a controlled slider, but its `onValueChange` is called
 * from the value *setter*, so pushing the playhead's position in from outside
 * fires the handler exactly as a drag would.
 *
 * The handler pauses and seeks, so every playback step stopped playback on its
 * first frame: it ran for a moment and then stopped, leaving the readout at
 * "1 / 36 (3%)" and the trace back at the start.
 */
describe('timeline scrub guard', () => {
	it('reads the playhead pushing its own position in as an echo, not a scrub', () => {
		// Every position the playhead can occupy, across trace lengths from a
		// hand-made tree to a large generated one.
		for (const total of [1, 2, 7, 36, 128, 4096, 17240]) {
			const stride = Math.max(1, Math.floor(total / 60));
			for (let step = 0; step <= total; step += stride) {
				const progress = (step / total) * 100;
				const emitted = quantiseToStep(progress);
				expect(
					isPlaybackEcho(emitted, progress),
					`total ${total}, step ${step} at ${progress}% was treated as a scrub`
				).toBe(true);
			}
		}
	});

	it('does not rely on the step the value maps to', () => {
		// The reason this guard compares quantised floats rather than steps: for a
		// 36-event trace, step 2 sits at 5.5555…%, the slider rounds down to 5.55%,
		// and flooring that lands back on step 1. One step adrift, and enough to
		// look exactly like a drag.
		const total = 36;
		const step = 2;
		const progress = (step / total) * 100;

		expect(quantiseToStep(progress)).toBeLessThan(progress);
		expect(stepForPercentage(quantiseToStep(progress), total)).toBe(step - 1);
		expect(isPlaybackEcho(quantiseToStep(progress), progress)).toBe(true);
	});

	it('still honours a real move of the playhead', () => {
		expect(isPlaybackEcho(quantiseToStep(50), 3 / 36 * 100)).toBe(false);
		expect(isPlaybackEcho(quantiseToStep(0), 50)).toBe(false);
		expect(isPlaybackEcho(quantiseToStep(100), 99)).toBe(false);
	});

	it('degrades safely with no trace or bad input', () => {
		// No events means progress is 0, so the slider sitting at 0 is an echo.
		expect(isPlaybackEcho(0, 0)).toBe(true);
		expect(isPlaybackEcho(Number.NaN, 0)).toBe(false);
		expect(quantiseToStep(Number.NaN)).toBe(0);
		expect(quantiseToStep(50, 0)).toBe(0);
	});

	it('rounds onto the slider grid it is meant to mirror', () => {
		expect(TIMELINE_STEP).toBe(0.05);
		expect(quantiseToStep(5.555555555555555)).toBeCloseTo(5.55, 10);
		expect(quantiseToStep(5.57)).toBeCloseTo(5.55, 10);
		expect(quantiseToStep(0)).toBe(0);
		expect(quantiseToStep(100)).toBe(100);
	});

	it('keeps stepForPercentage clamping, since seekPercentage uses it', () => {
		expect(stepForPercentage(-10, 36)).toBe(0);
		expect(stepForPercentage(500, 36)).toBe(36);
		expect(stepForPercentage(3, 36)).toBe(1);
		expect(stepForPercentage(100, 36)).toBe(36);
	});
});
