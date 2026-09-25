export class HistoryStore<TCommand> {
	private _undoStack = $state<TCommand[]>([]);
	private _redoStack = $state<TCommand[]>([]);

	/**
	 * How many commands to retain.
	 *
	 * Structural edits carry whole-snapshot payloads: regenerating or resizing a
	 * 100x100 grid stores two full copies of it, roughly 20,000 cell objects per
	 * command. An unbounded stack turned a session of repeated regeneration into
	 * megabytes of retained snapshots that nothing could reach, and a slow drift in
	 * every snapshot operation. A bounded stack is also what undo is expected to
	 * do; 100 steps is far more than anyone undoes interactively.
	 */
	static readonly LIMIT = 100;

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
		if (this._undoStack.length > HistoryStore.LIMIT) {
			this._undoStack.splice(0, this._undoStack.length - HistoryStore.LIMIT);
		}
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

	/** Exposed for the retention regression test. */
	get size() {
		return { undo: this._undoStack.length, redo: this._redoStack.length };
	}

	clear() {
		this._undoStack = [];
		this._redoStack = [];
	}
}
