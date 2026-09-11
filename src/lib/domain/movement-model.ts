export type MovementType = 'fourWay' | 'eightWay';

export type MovementModel = {
	type: MovementType;
	diagonalCostMultiplier?: number;
	blockCornerCutting?: boolean;
};

export const defaultMovementModel: MovementModel = {
	type: 'fourWay'
};

const DIRECTIONS_4 = [
	[-1, 0], // Up
	[0, 1],  // Right
	[1, 0],  // Down
	[0, -1]  // Left
];

const DIRECTIONS_8 = [
	[-1, 0], // Up
	[-1, 1], // Up-Right
	[0, 1],  // Right
	[1, 1],  // Down-Right
	[1, 0],  // Down
	[1, -1], // Down-Left
	[0, -1], // Left
	[-1, -1] // Up-Left
];

export function getMovementOffsets(model?: MovementModel): number[][] {
	const type = model?.type ?? 'fourWay';
	return type === 'eightWay' ? DIRECTIONS_8 : DIRECTIONS_4;
}
