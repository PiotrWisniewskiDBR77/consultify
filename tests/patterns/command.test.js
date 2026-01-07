/**
 * Command Pattern Tests
 * Tests for command pattern implementations
 * 
 * @module tests/patterns/command.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Command interface
const createCommand = (execute, undo = null, metadata = {}) => ({
    execute,
    undo,
    canUndo: () => undo !== null,
    getMetadata: () => metadata,
});

// Command invoker
const createInvoker = () => {
    const history = [];
    const undoneStack = [];
    let maxHistorySize = Infinity;

    return {
        execute: async (command) => {
            const result = await command.execute();

            if (command.canUndo()) {
                history.push(command);
                undoneStack.length = 0; // Clear redo stack

                // Trim history if needed
                while (history.length > maxHistorySize) {
                    history.shift();
                }
            }

            return result;
        },

        undo: async () => {
            if (history.length === 0) {
                throw new Error('Nothing to undo');
            }

            const command = history.pop();
            await command.undo();
            undoneStack.push(command);

            return command;
        },

        redo: async () => {
            if (undoneStack.length === 0) {
                throw new Error('Nothing to redo');
            }

            const command = undoneStack.pop();
            await command.execute();
            history.push(command);

            return command;
        },

        canUndo: () => history.length > 0,
        canRedo: () => undoneStack.length > 0,

        getHistory: () => [...history],
        getHistorySize: () => history.length,

        setMaxHistory: (size) => {
            maxHistorySize = size;
        },

        clear: () => {
            history.length = 0;
            undoneStack.length = 0;
        },
    };
};

// Command queue (sequential execution)
const createCommandQueue = () => {
    const queue = [];
    let isProcessing = false;

    const process = async () => {
        if (isProcessing || queue.length === 0) return;

        isProcessing = true;

        while (queue.length > 0) {
            const { command, resolve, reject } = queue.shift();

            try {
                const result = await command.execute();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }

        isProcessing = false;
    };

    return {
        add: (command) => {
            return new Promise((resolve, reject) => {
                queue.push({ command, resolve, reject });
                process();
            });
        },

        getQueueSize: () => queue.length,
        isProcessing: () => isProcessing,
    };
};

// Macro command (composite)
const createMacroCommand = (commands = []) => ({
    commands: [...commands],

    add: function (command) {
        this.commands.push(command);
        return this;
    },

    execute: async function () {
        const results = [];
        for (const cmd of this.commands) {
            results.push(await cmd.execute());
        }
        return results;
    },

    undo: async function () {
        // Undo in reverse order
        for (let i = this.commands.length - 1; i >= 0; i--) {
            if (this.commands[i].canUndo()) {
                await this.commands[i].undo();
            }
        }
    },

    canUndo: function () {
        return this.commands.some(cmd => cmd.canUndo());
    },

    getMetadata: function () {
        return { type: 'macro', count: this.commands.length };
    },
});

// Transactional command
const createTransactionalCommand = (commands) => {
    const executedCommands = [];

    return {
        execute: async () => {
            try {
                for (const cmd of commands) {
                    await cmd.execute();
                    executedCommands.push(cmd);
                }
                return true;
            } catch (error) {
                // Rollback
                for (let i = executedCommands.length - 1; i >= 0; i--) {
                    if (executedCommands[i].canUndo()) {
                        await executedCommands[i].undo();
                    }
                }
                executedCommands.length = 0;
                throw error;
            }
        },

        undo: async () => {
            for (let i = executedCommands.length - 1; i >= 0; i--) {
                if (executedCommands[i].canUndo()) {
                    await executedCommands[i].undo();
                }
            }
            executedCommands.length = 0;
        },

        canUndo: () => executedCommands.length > 0,
        getMetadata: () => ({ type: 'transaction' }),
    };
};

describe('Command Pattern Tests', () => {
    // ═══════════════════════════════════════════════════════════════════
    // BASIC COMMAND
    // ═══════════════════════════════════════════════════════════════════

    describe('Basic Command', () => {
        it('should create and execute command', async () => {
            let value = 0;
            const command = createCommand(
                () => { value = 10; return value; }
            );

            const result = await command.execute();

            expect(result).toBe(10);
            expect(value).toBe(10);
        });

        it('should support undo', async () => {
            let value = 0;
            const command = createCommand(
                () => { value = 10; },
                () => { value = 0; }
            );

            await command.execute();
            expect(value).toBe(10);

            await command.undo();
            expect(value).toBe(0);
        });

        it('should check if undoable', () => {
            const undoable = createCommand(() => { }, () => { });
            const notUndoable = createCommand(() => { });

            expect(undoable.canUndo()).toBe(true);
            expect(notUndoable.canUndo()).toBe(false);
        });

        it('should have metadata', () => {
            const command = createCommand(
                () => { },
                null,
                { type: 'save', timestamp: Date.now() }
            );

            expect(command.getMetadata().type).toBe('save');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // INVOKER
    // ═══════════════════════════════════════════════════════════════════

    describe('Invoker', () => {
        let invoker;
        let state;

        beforeEach(() => {
            invoker = createInvoker();
            state = { value: 0 };
        });

        it('should execute command', async () => {
            const command = createCommand(
                () => { state.value = 5; },
                () => { state.value = 0; }
            );

            await invoker.execute(command);

            expect(state.value).toBe(5);
        });

        it('should undo command', async () => {
            const command = createCommand(
                () => { state.value = 5; },
                () => { state.value = 0; }
            );

            await invoker.execute(command);
            await invoker.undo();

            expect(state.value).toBe(0);
        });

        it('should redo command', async () => {
            const command = createCommand(
                () => { state.value = 5; },
                () => { state.value = 0; }
            );

            await invoker.execute(command);
            await invoker.undo();
            await invoker.redo();

            expect(state.value).toBe(5);
        });

        it('should track history', async () => {
            await invoker.execute(createCommand(() => { }, () => { }));
            await invoker.execute(createCommand(() => { }, () => { }));

            expect(invoker.getHistorySize()).toBe(2);
        });

        it('should limit history size', async () => {
            invoker.setMaxHistory(2);

            await invoker.execute(createCommand(() => { }, () => { }));
            await invoker.execute(createCommand(() => { }, () => { }));
            await invoker.execute(createCommand(() => { }, () => { }));

            expect(invoker.getHistorySize()).toBe(2);
        });

        it('should check canUndo/canRedo', async () => {
            expect(invoker.canUndo()).toBe(false);
            expect(invoker.canRedo()).toBe(false);

            await invoker.execute(createCommand(() => { }, () => { }));
            expect(invoker.canUndo()).toBe(true);

            await invoker.undo();
            expect(invoker.canRedo()).toBe(true);
        });

        it('should throw when nothing to undo', async () => {
            await expect(invoker.undo()).rejects.toThrow('Nothing to undo');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // COMMAND QUEUE
    // ═══════════════════════════════════════════════════════════════════

    describe('Command Queue', () => {
        let queue;

        beforeEach(() => {
            queue = createCommandQueue();
        });

        it('should execute commands in order', async () => {
            const results = [];

            const promises = [
                queue.add(createCommand(async () => {
                    await new Promise(r => setTimeout(r, 30));
                    results.push(1);
                })),
                queue.add(createCommand(async () => {
                    await new Promise(r => setTimeout(r, 10));
                    results.push(2);
                })),
                queue.add(createCommand(() => results.push(3))),
            ];

            await Promise.all(promises);

            expect(results).toEqual([1, 2, 3]);
        });

        it('should handle errors', async () => {
            const failingCommand = createCommand(() => {
                throw new Error('Failed');
            });

            await expect(queue.add(failingCommand)).rejects.toThrow('Failed');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MACRO COMMAND
    // ═══════════════════════════════════════════════════════════════════

    describe('Macro Command', () => {
        it('should execute all commands', async () => {
            const state = { a: 0, b: 0 };

            const macro = createMacroCommand([
                createCommand(() => { state.a = 1; }),
                createCommand(() => { state.b = 2; }),
            ]);

            await macro.execute();

            expect(state.a).toBe(1);
            expect(state.b).toBe(2);
        });

        it('should undo in reverse order', async () => {
            const order = [];

            const macro = createMacroCommand([
                createCommand(
                    () => order.push('exec-a'),
                    () => order.push('undo-a')
                ),
                createCommand(
                    () => order.push('exec-b'),
                    () => order.push('undo-b')
                ),
            ]);

            await macro.execute();
            await macro.undo();

            expect(order).toEqual(['exec-a', 'exec-b', 'undo-b', 'undo-a']);
        });

        it('should add commands fluently', () => {
            const macro = createMacroCommand()
                .add(createCommand(() => 1))
                .add(createCommand(() => 2));

            expect(macro.commands.length).toBe(2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TRANSACTIONAL COMMAND
    // ═══════════════════════════════════════════════════════════════════

    describe('Transactional Command', () => {
        it('should execute all or none', async () => {
            const state = { a: 0, b: 0 };

            const transaction = createTransactionalCommand([
                createCommand(
                    () => { state.a = 1; },
                    () => { state.a = 0; }
                ),
                createCommand(() => { throw new Error('Fail'); }),
            ]);

            await expect(transaction.execute()).rejects.toThrow('Fail');
            expect(state.a).toBe(0); // Rolled back
        });

        it('should succeed when all commands succeed', async () => {
            const state = { a: 0, b: 0 };

            const transaction = createTransactionalCommand([
                createCommand(
                    () => { state.a = 1; },
                    () => { state.a = 0; }
                ),
                createCommand(
                    () => { state.b = 2; },
                    () => { state.b = 0; }
                ),
            ]);

            await transaction.execute();

            expect(state.a).toBe(1);
            expect(state.b).toBe(2);
        });
    });
});
