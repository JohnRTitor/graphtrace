export type EnvironmentType = 'perfect_maze' | 'braided_maze' | 'random_obstacles' | 'blank' | 'graph';

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
