import type { NodeId } from '../graph/types';
import type { GraphCommand } from '../graph/manual';
import type { GridCommand } from '../graph/commands';

export type EnvCommand = 
	| { type: 'graph'; cmd: GraphCommand }
	| { type: 'grid'; cmd: GridCommand };
