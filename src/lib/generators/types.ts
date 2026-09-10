export type EnvironmentType = 'perfect_maze' | 'braided_maze' | 'random_obstacles' | 'blank' | 'graph';

export type RandomGraphOptions = {
	nodeCount: number;
	density: 'sparse' | 'balanced' | 'dense';
	directed: boolean;
	weighted: boolean;
	ensurePath: boolean;
	seed: number;
};

export type GeneratorOptions = {
	seed: number;
	loopDensity?: number; // 0-100, for Braided Maze
	obstacleDensity?: number; // 0-100, for Random Obstacles
	weighted?: boolean; // whether to add weights (for random obstacles)
	randomGraph?: RandomGraphOptions;
};
