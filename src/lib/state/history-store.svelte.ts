export class HistoryStore<TCommand> {
	private _undoStack = $state<TCommand[]>([]);
	private _redoStack = $state<TCommand[]>([]);

	constructor(
		private apply: (cmd: TCommand, isRedo: boolean) => void,
		private invert: (cmd: TCommand) => void
	) {}

	execute(cmd: TCommand, skipApply = false) {
		if (!skipApply) {
			this.apply(cmd, false);
		}
		this._undoStack.push(cmd);
		this._redoStack = [];
	}

	undo() {
		const cmd = this._undoStack.pop();
		if (!cmd) return;
		this.invert(cmd);
		this._redoStack.push(cmd);
	}

	redo() {
		const cmd = this._redoStack.pop();
		if (!cmd) return;
		this.apply(cmd, true);
		this._undoStack.push(cmd);
	}

	get canUndo() {
		return this._undoStack.length > 0;
	}

	get canRedo() {
		return this._redoStack.length > 0;
	}

	clear() {
		this._undoStack = [];
		this._redoStack = [];
	}
}
