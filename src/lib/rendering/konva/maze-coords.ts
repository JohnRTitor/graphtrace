import type Konva from 'konva';
import type { NodeId } from '$lib/graph/types';

/**
 * Pure coordinate resolver: given a point already expressed in grid-local
 * (unscaled, unpanned) pixel space, returns the cell id it falls in, or
 * `null` if it falls outside the grid bounds.
 *
 * This is intentionally decoupled from Konva so it can be unit tested
 * without a canvas/DOM environment.
 */
export function resolveCellId(
	localX: number,
	localY: number,
	cellSize: number,
	rows: number,
	cols: number
): NodeId | null {
	const col = Math.floor(localX / cellSize);
	const row = Math.floor(localY / cellSize);

	if (row < 0 || row >= rows || col < 0 || col >= cols) return null;

	return `${row},${col}`;
}

/**
 * Authoritative screen -> grid-local transform, shared by every consumer
 * that needs to know "which cell is the pointer over" (painting, hover
 * highlight, context menu). Do not duplicate this transform elsewhere.
 */
export function stageToLocalPoint(stage: Konva.Stage): { x: number; y: number } | null {
	const pointerPosition = stage.getPointerPosition();
	if (!pointerPosition) return null;

	const transform = stage.getAbsoluteTransform().copy();
	transform.invert();
	return transform.point(pointerPosition);
}

/**
 * Resolves the cell currently under the stage's pointer, or `null` if the
 * pointer is outside the stage or outside grid bounds.
 */
export function stageToCellId(
	stage: Konva.Stage,
	cellSize: number,
	rows: number,
	cols: number
): NodeId | null {
	const local = stageToLocalPoint(stage);
	if (!local) return null;
	return resolveCellId(local.x, local.y, cellSize, rows, cols);
}

/**
 * Same transform as {@link stageToCellId} but without bounds checking -
 * matches the historical behavior of the paint interaction, which relies on
 * downstream `Grid` lookups (`getNode`) to no-op on out-of-range ids.
 */
export function stageToCellIdUnchecked(stage: Konva.Stage, cellSize: number): NodeId | null {
	const local = stageToLocalPoint(stage);
	if (!local) return null;
	const col = Math.floor(local.x / cellSize);
	const row = Math.floor(local.y / cellSize);
	return `${row},${col}`;
}
