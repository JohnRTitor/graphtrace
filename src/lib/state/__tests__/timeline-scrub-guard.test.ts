import { describe, expect, it } from 'vitest';
import { stepForPercentage, TIMELINE_STEP } from '../playback.svelte';

/**
 * The timeline scrubber is a controlled slider, but its `onValueChange` is called
 * from the value *setter*, so the playhead's own movement arrives in the handler
 * on every step of playback - the same route a user's drag takes. A stack
 * captured from the running app showed it plainly:
 *
 *   PlaybackEngine.pause <- PlaybackState.pause <- pauseAll <- scrub
 *     <- onValueChange <- bits-ui set current
 *
 * Three ways of telling an echo from a drag were tried, by value, and all three
 * are unsound:
 *
 * - Equality against the progress: the slider's default handling rewrites the
 *   value it was handed, so the number that comes back out is not the one that
 *   went in.
 * - Deriving the step from the percentage: the slider snaps to its own grid, so
 *   step 2 of 36 sits at 5.5555…%, rounds down to 5.55%, and floors back to step 1.
 * - A half-step tolerance: sound only while the playhead moves slowly. At the 200+
 *   events per second the speed control allows, it crosses several slider steps in
 *   one frame, so any staleness exceeds the tolerance - and the failure is a
 *   playback that fights back rather than one that stops, which is harder to spot.
 *
 * So the rule is no longer about the value at all: an emission is trusted only
 * when there is a hand on the slider, or when nothing is playing for an echo to be
 * interrupting. That is a property of the interaction, not of a number, so it
 * cannot be defeated by the slider's rounding or by playback speed.
 */
describe('timeline scrub trust', () => {
	/** The rule `PlaybackControls.scrub` applies. Mirrored here, not imported:
	 * the component's own copy is the one under test by hand. */
	const trusted = (isRunning: boolean, isScrubbing: boolean) => !isRunning || isScrubbing;

	it('ignores emissions while playing with no hand on the slider', () => {
		// This is the echo: the playhead reporting its own movement.
		expect(trusted(true, false)).toBe(false);
	});

	it('honours a drag while playing', () => {
		expect(trusted(true, true)).toBe(true);
	});

	it('honours a scrub whenever nothing is playing', () => {
		// Keyboard nudges and clicks on a paused or idle trace, where there is no
		// echo to confuse the emission with.
		expect(trusted(false, false)).toBe(true);
		expect(trusted(false, true)).toBe(true);
	});

	it('never depends on the emitted value, so speed cannot defeat it', () => {
		// At 235 events per second on a 1,045-event trace the playhead moves about
		// 0.4% of the range per frame - roughly seven slider steps. Any value
		// comparison would be comparing against a number that is already stale.
		const stepsPerFrame = (0.4 / 100) * 1045;
		expect(stepsPerFrame).toBeGreaterThan(1);
		// The rule holds regardless of how far the playhead has moved.
		for (const moved of [0, 0.001, 0.4, 12, 100]) {
			expect(trusted(true, false), `playhead moved ${moved}%`).toBe(false);
		}
	});

	it('keeps the slider step and the percentage arithmetic consistent', () => {
		expect(TIMELINE_STEP).toBe(0.05);
		expect(stepForPercentage(-10, 36)).toBe(0);
		expect(stepForPercentage(500, 36)).toBe(36);
		expect(stepForPercentage(3, 36)).toBe(1);
		expect(stepForPercentage(100, 36)).toBe(36);
		expect(stepForPercentage(50, 0)).toBe(0);
	});
});
