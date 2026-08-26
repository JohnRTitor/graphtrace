export type EnvironmentType = 'perfect_maze' | 'braided_maze' | 'random_obstacles' | 'blank';

export type GeneratorOptions = {
	seed: number;
	loopDensity?: number; // 0-100, for Braided Maze
	obstacleDensity?: number; // 0-100, for Random Obstacles
	weighted?: boolean; // whether to add weights (for random obstacles)
};
