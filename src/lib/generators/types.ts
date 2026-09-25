/** Environment types owned by the pathfinding family. */
export type PathfindingEnvironmentType =
	| 'perfect_maze'
	| 'braided_maze'
	| 'random_obstacles'
	| 'blank'
	| 'graph';

/** Environment types owned by the adversarial family. */
export type AdversarialEnvironmentType =
	| 'manual_tree'
	| 'tic_tac_toe'
	| 'tic_tac_toe_limited'
	| 'nim'
	| 'random_tree';

export type EnvironmentType = PathfindingEnvironmentType | AdversarialEnvironmentType;

export const pathfindingEnvironmentTypes: PathfindingEnvironmentType[] = [
	'perfect_maze',
	'braided_maze',
	'random_obstacles',
	'blank',
	'graph'
];

export const adversarialEnvironmentTypes: AdversarialEnvironmentType[] = [
	'manual_tree',
	'tic_tac_toe',
	'tic_tac_toe_limited',
	'nim',
	'random_tree'
];

export const allEnvironmentTypes: EnvironmentType[] = [
	...pathfindingEnvironmentTypes,
	...adversarialEnvironmentTypes
];

export type RandomGraphOptions = {
	nodeCount: number;
	edgeMultiplier: number;
	weighted: boolean;
	ensurePath: boolean;
	directed: boolean;
	seed: number;
};

export type GeneratorOptions = {
	seed: number;
	loopDensity?: number; // 0-100, for Braided Maze
	obstacleDensity?: number; // 0-100, for Random Obstacles
	weighted?: boolean; // whether to add weights (for random obstacles)
	randomGraph?: RandomGraphOptions;
};

/** Generator settings owned by the adversarial family. */
export type GameTreeGeneratorOptions = {
	/** 0-9 plies; 0 plays the game to a terminal position. */
	tttDepth: number;
	nimHeapCount: number;
	nimMaxStones: number;
	randomBranching: number;
	randomDepth: number;
	randomMinUtility: number;
	randomMaxUtility: number;
};

export const defaultGameTreeGeneratorOptions: GameTreeGeneratorOptions = {
	tttDepth: 0,
	nimHeapCount: 3,
	nimMaxStones: 3,
	randomBranching: 3,
	randomDepth: 3,
	randomMinUtility: -10,
	randomMaxUtility: 10
};
