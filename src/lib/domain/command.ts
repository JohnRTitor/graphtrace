import type { GraphCommand } from '../graph/manual';
import type { GridCommand } from '../graph/commands';
import type { GameTreeCommand } from '../graph/game-tree';

/**
 * An environment edit, tagged with the history scope it belongs to.
 *
 * The scope is what lets a single undo stack span a family switch: changing
 * scope clears the stack rather than trying to replay a grid edit against a game
 * tree.
 */
export type EnvCommand =
	| { type: 'graph'; cmd: GraphCommand }
	| { type: 'grid'; cmd: GridCommand }
	| { type: 'game-tree'; cmd: GameTreeCommand };
