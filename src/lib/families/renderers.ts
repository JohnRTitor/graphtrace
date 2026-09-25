import type { Component } from 'svelte';
import PathfindingCanvas from '../rendering/pathfinding/PathfindingCanvas.svelte';
import GameTreeCanvas from '../rendering/game-tree/GameTreeCanvas.svelte';
import type { PlaybackState } from '../state/playback.svelte';
import type { RendererComponent } from './types';

/**
 * Runtime family -> canvas component map.
 *
 * Kept out of `registry.ts` deliberately. The registry is pure TypeScript so the
 * test suite (which imports `environment.svelte.ts`, which reads the registry)
 * never pulls application component compilation, `$app/environment` or
 * `mode-watcher` into a Node test process. Family modules still declare the
 * prompt's `renderer` field; this map is what fills it in at mount time.
 *
 * The two maps differ in specificity on purpose: the registry field is widened
 * to `RendererProps` so a family file can name it without importing state, and
 * this map keeps the precise `PlaybackState` prop so the mount site is checked.
 */
export const familyRenderers: Record<string, Component<{ playback?: PlaybackState }> | undefined> = {
	pathfinding: PathfindingCanvas,
	adversarial: GameTreeCanvas
};

export function rendererFor(familyId: string): RendererComponent | undefined {
	return familyRenderers[familyId] as RendererComponent | undefined;
}
