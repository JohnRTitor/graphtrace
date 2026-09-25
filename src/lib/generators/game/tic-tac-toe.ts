import { buildGameTree, type TreeSpecNode } from '../../graph/game-tree-builder';
import type { GameTree } from '../../graph/game-tree';
import { PRNG } from '../../utils/random';

export const TTT_EMPTY = '.........';

export type TicTacToeMove = { cell: number; mark: 'X' | 'O' };

/**
 * The fixed opening every generated Tic-Tac-Toe tree starts from.
 *
 * Fixing the opening is what makes the environment usable: the full game tree
 * from the empty board is ~550k nodes, which no canvas can draw, while a
 * position after `1.X centre, 1.O corner` is ~6.8k nodes - small enough to
 * render, explore and scrub, and still large enough that alpha-beta's saving is
 * unmistakable. The seed still varies move *order*, which changes how much
 * pruning happens without changing the position or the correct value.
 */
export const TTT_DEFAULT_OPENING: TicTacToeMove[] = [
	{ cell: 4, mark: 'X' },
	{ cell: 0, mark: 'O' }
];

export type TicTacToeOptions = {
	seed: number;
	/**
	 * 0 plays the game out to a terminal position. A positive value truncates the
	 * tree to that many plies below the root, which is how a real engine bounds
	 * its search: nodes at the cut are scored with a heuristic instead of a true
	 * terminal utility.
	 */
	maxDepth?: number;
	opening?: TicTacToeMove[];
};

const WIN_LINES = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	[0, 4, 8],
	[2, 4, 6]
];

export function winnerOf(board: string): 'X' | 'O' | null {
	for (const [a, b, c] of WIN_LINES) {
		if (board[a] === 'X' && board[b] === 'X' && board[c] === 'X') return 'X';
		if (board[a] === 'O' && board[b] === 'O' && board[c] === 'O') return 'O';
	}
	return null;
}

export function isBoardFull(board: string): boolean {
	return !board.includes('.');
}

function placeMark(board: string, cell: number, mark: 'X' | 'O'): string {
	const next = board.split('');
	if (next[cell] !== '.') return board;
	next[cell] = mark;
	return next.join('');
}

/**
 * Heuristic evaluation used at a depth-limited cut: a score for the player to
 * move built from open lines, so a truncated search still prefers winning and
 * blocking positions. It stays on the same +1 / 0 / -1 scale as true terminal
 * utilities, which is what lets a truncated and an untruncated tree be compared.
 */
function heuristic(board: string, playerToMove: 'X' | 'O'): number {
	const opponent = playerToMove === 'X' ? 'O' : 'X';
	const sign = playerToMove === 'X' ? 1 : -1;
	let score = 0;
	for (const [a, b, c] of WIN_LINES) {
		const cells = [board[a], board[b], board[c]];
		const mine = cells.filter((cell) => cell === playerToMove).length;
		const theirs = cells.filter((cell) => cell === opponent).length;
		if (mine > 0 && theirs > 0) continue;
		if (mine === 2) score += 5;
		else if (mine === 1) score += 1;
		if (theirs === 2) score -= 5;
		else if (theirs === 1) score -= 1;
	}
	return sign * score;
}

function positionAfter(opening: TicTacToeMove[]): string {
	let board = TTT_EMPTY;
	for (const move of opening) board = placeMark(board, move.cell, move.mark);
	return board;
}

function turnAfter(opening: TicTacToeMove[]): 'X' | 'O' {
	return opening.length % 2 === 0 ? 'X' : 'O';
}

/**
 * Generates a Tic-Tac-Toe game tree rooted at a MAX node for the player to move
 * in the position after `opening`. Terminal utilities are always from X's
 * perspective: +1 X wins, 0 draw, -1 O wins.
 */
export function generateTicTacToe(options: TicTacToeOptions): GameTree {
	const maxDepth = Math.max(0, Math.min(9, Math.trunc(options.maxDepth ?? 0)));
	const opening = options.opening ?? TTT_DEFAULT_OPENING;
	const prng = new PRNG(options.seed);
	const board = positionAfter(opening);

	return buildGameTree(expandNode(board, turnAfter(opening), 0, maxDepth, prng), 'ttt');
}

/**
 * Expands one position into a spec node.
 *
 * A terminal position expands to a *childless* node carrying its utility. It
 * must not expand to a terminal child: the position is already terminal, so there
 * is no move to play, and wrapping it in a child would both invent a phantom ply
 * and show the position one move behind where it really is.
 */
function expandNode(
	board: string,
	turnToMove: 'X' | 'O',
	pliesUsed: number,
	maxDepth: number,
	prng: PRNG
): TreeSpecNode {
	const winner = winnerOf(board);
	const full = isBoardFull(board);
	const truncated = maxDepth > 0 && pliesUsed >= maxDepth;

	if (winner !== null || full || truncated) {
		const utility =
			winner !== null
				? winner === 'X'
					? 1
					: -1
				: truncated
					? heuristic(board, turnToMove)
					: 0;
		return { player: 'terminal', utility, state: board };
	}

	const empty: number[] = [];
	for (let cell = 0; cell < 9; cell++) {
		if (board[cell] === '.') empty.push(cell);
	}
	const opponent = turnToMove === 'X' ? 'O' : 'X';

	// The seed reshuffles sibling order. That changes how aggressively the
	// cut-offs fire, so the same position yields visibly different pruning
	// without ever changing the value minimax must return.
	return {
		player: turnToMove === 'X' ? 'max' : 'min',
		state: board,
		children: prng.shuffle(empty).map((cell) => ({
			...expandNode(placeMark(board, cell, turnToMove), opponent, pliesUsed + 1, maxDepth, prng),
			moveLabel: `${turnToMove}${cell}`
		}))
	};
}
