import type { NodeId } from '../graph/types';

/** The single thing a maze context menu can be about: one grid cell. */
export type MazeContextTarget = {
	type: 'cell';
	cellId: NodeId;
};

/**
 * The thing a manual-graph context menu is about. The context-clicked
 * object is always the source of truth for the target - it is resolved
 * directly from SvelteFlow's onnodecontextmenu / onedgecontextmenu /
 * onpanecontextmenu events, never from ambient selection state, so a
 * right-click on node B can never accidentally operate on a
 * previously-selected node A.
 */
export type GraphContextTarget =
	| { type: 'background'; flowX: number; flowY: number }
	| { type: 'node'; nodeId: NodeId }
	| { type: 'edge'; edgeId: string };
