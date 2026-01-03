import { describe, it, expect } from 'vitest';
import { CommandBus } from '../CommandBus.js';

class SpyCommand {
    constructor(public readonly payload: string) {}
}

describe('CommandBus', () => {
    it('executes registered handler', async () => {
        const bus = new CommandBus();
        bus.register(SpyCommand, {
            execute: async (cmd: SpyCommand) => cmd.payload.toUpperCase()
        });

        const result = await bus.execute(new SpyCommand('pay'));
        expect(result).toBe('PAY');
    });
});
