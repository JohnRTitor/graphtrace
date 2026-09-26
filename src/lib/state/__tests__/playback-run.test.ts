import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { environmentState } from '../environment.svelte';
import { playbackState } from '../playback.svelte';

/**
 * Playback appeared to start and then stop after a frame or two, leaving the
 * readout back at the first step.
 *
 * The engine itself is sound - it only reports `completed` at the end of the
 * trace - so the suspicion is that something re-loads or resets the pane while
 * the animation loop is live. `requestAnimationFrame` is stubbed here so the loop
 * can be stepped by hand and the status watched directly, which is the only way
 * to see a race that resolves in a couple of frames.
 */
describe('playback stays running', () => {
	let frames: FrameRequestCallback[] = [];
	let now = 0;
	const realRaf = globalThis.requestAnimationFrame;
	const realCancel = globalThis.cancelAnimationFrame;
	const realNow = performance.now;

	beforeEach(() => {
		frames = [];
		now = 0;
		// The node test environment has no rAF, so it is installed rather than
		// spied on. `playbackState.play()` schedules through it immediately.
		globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
			frames.push(cb);
			return frames.length;
		}) as typeof requestAnimationFrame;
		globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
		performance.now = () => now;
	});

	afterEach(() => {
		if (realRaf) globalThis.requestAnimationFrame = realRaf;
		if (realCancel) globalThis.cancelAnimationFrame = realCancel;
		performance.now = realNow;
	});

	/** Advance `count` animation frames, `ms` apart, as a real display would. */
	function advance(count: number, ms = 20) {
		for (let i = 0; i < count; i++) {
			const due = frames;
			frames = [];
			now += ms;
			for (const cb of due) cb(now);
		}
	}

	beforeEach(() => {
		environmentState.familyId = 'adversarial';
		environmentState.environmentType = 'manual_tree';
		environmentState.handleGenerate();
		environmentState.selectedAlgorithmId = 'minimax';
	});

	it('advances through the trace instead of stopping on the first frame', () => {
		const id = environmentState.runAlgorithm('autoplay');
		expect(id).not.toBeNull();
		expect(environmentState.runError).toBeNull();

		const total = playbackState.totalSteps;
		expect(total).toBeGreaterThan(4);

		// Nothing is consumed until the first frame, so the step is still 0 here;
		// what matters is that it is `running` and that frames then advance it.
		expect(playbackState.status, 'autoplay did not start').toBe('running');

		advance(12);

		expect(
			playbackState.currentStep,
			`playback stalled at step ${playbackState.currentStep} of ${total}`
		).toBeGreaterThan(1);
	});

	it('keeps the status running across frames', () => {
		environmentState.runAlgorithm('autoplay');
		expect(playbackState.status).toBe('running');

		advance(6);

		// The legitimate end state is `completed`; anything else means the pane was
		// reset or paused by something other than the user.
		expect(['running', 'completed']).toContain(playbackState.status);
	});

	it('is not re-loaded behind its own back', () => {
		environmentState.runAlgorithm('autoplay');
		advance(4);

		// A second load would reset the step without changing the trace, which is
		// what "plays for a moment then jumps back to the start" looks like.
		expect(playbackState.currentStep).toBeGreaterThan(1);
		expect(playbackState.hasLoadedTrace).toBe(true);
	});
});
