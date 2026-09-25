import { comparePlaybackStates, playbackState } from './playback.svelte';
import { executionStore } from './execution-store.svelte';

export function invalidatePlaybackIfNeeded(): void {
	executionStore.invalidatePlayback();
	playbackState.invalidate();
	// Every comparison pane is invalidated, not just the first: an environment
	// edit invalidates all mounted executions, and leaving a stale pane mounted
	// would render a trace over a tree that no longer exists.
	for (const pane of comparePlaybackStates) pane.invalidate();
}
