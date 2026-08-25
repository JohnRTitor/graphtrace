import { gridState } from './grid.svelte';
import { playbackState } from './playback.svelte';
import { getAlgorithm } from '../algorithms';

export class SettingsState {
	private _selectedAlgorithmId = $state<string>('bfs');
	private _showCosts = $state<boolean>(true);
	
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
