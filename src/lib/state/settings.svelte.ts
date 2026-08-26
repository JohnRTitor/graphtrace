import { gridState } from './grid.svelte';
import { playbackState } from './playback.svelte';
import { getAlgorithm } from '../algorithms';
import type { EnvironmentType } from '../generators/types';

export class SettingsState {
	private _selectedAlgorithmId = $state<string>('bfs');
	private _showCosts = $state<boolean>(true);
	
	// Environment State
	private _environmentType = $state<EnvironmentType>('perfect_maze');
	private _environmentSeed = $state<number>(Date.now());
	private _loopDensity = $state<number>(10);
	private _obstacleDensity = $state<number>(30);
	
	get selectedAlgorithmId() { return this._selectedAlgorithmId; }
	set selectedAlgorithmId(id: string) {
		this._selectedAlgorithmId = id;
		playbackState.reset();
	}
	
	get currentAlgorithm() {
		return getAlgorithm(this._selectedAlgorithmId);
	}

	get showCosts() { return this._showCosts; }
	set showCosts(val: boolean) { this._showCosts = val; }

	// Environment getters/setters
	get environmentType() { return this._environmentType; }
	set environmentType(val: EnvironmentType) { this._environmentType = val; }
	
	get environmentSeed() { return this._environmentSeed; }
	set environmentSeed(val: number) { this._environmentSeed = val; }
	
	get loopDensity() { return this._loopDensity; }
	set loopDensity(val: number) { this._loopDensity = Math.max(0, Math.min(100, val)); }
	
	get obstacleDensity() { return this._obstacleDensity; }
	set obstacleDensity(val: number) { this._obstacleDensity = Math.max(0, Math.min(100, val)); }

	// Run the algorithm and load the results into the playback engine
	runAlgorithm() {
		const algo = this.currentAlgorithm;
		if (!algo) return;
		
		const { grid, start, goal } = gridState;
		
		if (!start || !goal) {
			console.warn("Start or goal node not set");
			return;
		}

		// Calculate
		const result = algo.run(grid, start, goal);
		
		// Load and play
		playbackState.loadEvents(result.events, result.metrics);
		playbackState.play();
	}
}

export const settingsState = new SettingsState();
