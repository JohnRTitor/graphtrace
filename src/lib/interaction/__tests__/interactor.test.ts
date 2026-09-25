import { describe, it, expect, vi } from 'vitest';
import { Interactor } from '../interactor';
import type { EnvCommand } from '../../domain/command';

describe('Interactor', () => {
	it('commits exactly 1 command for a grid paint drag with multiple samples', () => {
		const commands: EnvCommand[] = [];
		const commitCommand = (cmd: EnvCommand) => commands.push(cmd);
		
		const interactor = new Interactor(commitCommand);
		
		// Simulate pointer down (begin drag)
		interactor.beginGridDrag(null, null);
		
		// Simulate 20 samples
		for (let i = 0; i < 20; i++) {
			interactor.recordGridEdit(`0,${i}`, true, false, 1, 1);
		}
		
		// Pointer up
		interactor.commitGridDrag();
		
		expect(commands.length).toBe(1);
		const cmd = commands[0];
		expect(cmd.type).toBe('grid');
		if (cmd.type === 'grid' && cmd.cmd.type === 'paint-cells') {
			expect(cmd.cmd.edits.length).toBe(20);
			expect(cmd.cmd.edits[0].id).toBe('0,0');
			expect(cmd.cmd.edits[19].id).toBe('0,19');
		}
	});

	it('commits exactly 1 command for a graph node move with multiple samples', () => {
		const commands: EnvCommand[] = [];
		const commitCommand = (cmd: EnvCommand) => commands.push(cmd);
		
		const interactor = new Interactor(commitCommand);
		
		interactor.beginGraphMove('node-1', 0, 0);
		
		// Move to intermediate points (visually handled by environmentState normally)
		// ...
		
		// Pointer up at final destination
		interactor.commitGraphMove('node-1', 100, 200);
		
		expect(commands.length).toBe(1);
		const cmd = commands[0];
		expect(cmd.type).toBe('graph');
		if (cmd.type === 'graph') {
			expect(cmd.cmd.type).toBe('move-node');
			if (cmd.cmd.type === 'move-node') {
				expect(cmd.cmd.from).toEqual({ x: 0, y: 0 });
				expect(cmd.cmd.to).toEqual({ x: 100, y: 200 });
			}
		}
	});

	it('commits nothing if graph node move did not change position', () => {
		const commands: EnvCommand[] = [];
		const commitCommand = (cmd: EnvCommand) => commands.push(cmd);
		
		const interactor = new Interactor(commitCommand);
		interactor.beginGraphMove('node-1', 50, 50);
		interactor.commitGraphMove('node-1', 50, 50);
		
		expect(commands.length).toBe(0);
	});

	it('rolls back an uncommitted grid batch when canceled', () => {
		const rollback = vi.fn();
		const interactor = new Interactor(() => {}, rollback);
		interactor.beginGridDrag(null, null);
		interactor.recordGridEdit('0,0', true, false, 1, 1);

		interactor.cancelGridDrag();

		expect(rollback).toHaveBeenCalledOnce();
		expect(rollback.mock.calls[0][0]).toMatchObject({
			type: 'paint-cells',
			edits: [{ id: '0,0', oldWalkable: true, newWalkable: false }]
		});
	});
});
