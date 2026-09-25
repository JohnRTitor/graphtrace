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
	if (
		!Number.isFinite(localX) ||
		!Number.isFinite(localY) ||
		!Number.isFinite(cellSize) ||
		cellSize <= 0 ||
		!Number.isFinite(rows) ||
		!Number.isFinite(cols) ||
		rows <= 0 ||
		cols <= 0
	) return null;

	const col = Math.floor(localX / cellSize);
	const row = Math.floor(localY / cellSize);

	if (row < 0 || row >= rows || col < 0 || col >= cols) return null;

	return `${row},${col}`;
}

/**
 * The rectangle, expressed in a child of the stage's own local coordinates,
 * that covers the entire visible viewport under the stage's current scale and
 * pan.
 *
 * Children of the stage inherit its transform, so a rectangle sized in screen
 * pixels is *not* a screen-sized rectangle once the stage is zoomed: `fitToView`
 * scales the stage down to fit the maze, and a rect left at the origin with the
 * stage's pixel dimensions ends up covering only a corner of the canvas. Anything
 * that has to span the viewport regardless of zoom - the background, and the
 * transparent `hitRect` that receives pointer events - must be placed with this.
 */
export function viewportCoverRect(
	stageX: number,
	stageY: number,
	scaleX: number,
	scaleY: number,
	width: number,
	height: number
): { x: number; y: number; width: number; height: number } {
	const sx = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
	const sy = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1;
	const px = Number.isFinite(stageX) ? stageX : 0;
	const py = Number.isFinite(stageY) ? stageY : 0;
	const w = Math.max(0, Number.isFinite(width) ? width : 0);
	const h = Math.max(0, Number.isFinite(height) ? height : 0);

	// A local point `p` lands at `p * s + offset` on screen, so the screen span
	// [0, size] inverts to [-offset / s, (size - offset) / s] locally.
	return {
		x: -px / sx,
		y: -py / sy,
		width: w / sx,
		height: h / sy
	};
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
