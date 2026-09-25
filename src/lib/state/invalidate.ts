import { comparePlaybackState, playbackState } from './playback.svelte';
import { executionStore } from './execution-store.svelte';

export function invalidatePlaybackIfNeeded(): void {
	executionStore.invalidatePlayback();
	playbackState.invalidate();
	comparePlaybackState.invalidate();
}
