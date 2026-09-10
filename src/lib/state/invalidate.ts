import { playbackState } from './playback.svelte';

/**
 * Resets playback if an algorithm run is in progress or already completed.
 *
 * `editorState.onPointerDown` already does this for paint-drag edits. The
 * context menu is a second, parallel entry point into the same grid/graph
 * mutations, so every context-menu command handler must call this before
 * invoking a mutating domain command - otherwise a stale algorithm result
 * could keep being displayed as if it still belonged to the current graph.
 */
export function invalidatePlaybackIfNeeded(): void {
	if (!playbackState.isIdle) {
		playbackState.reset();
	}
}
