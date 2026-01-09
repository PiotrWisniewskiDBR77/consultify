/**
 * AI Action Executor Unit Tests
 * Tests AI action execution, validation, and error handling
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// AI Action Executor implementation
const createAIActionExecutor = () => {
    const executedActions = [];
    const registeredActions = new Map();
    let counter = 0;

    return {
        registerAction: (name, handler, options = {}) => {
            registeredActions.set(name, {
                handler,
                permissions: options.permissions || [],
                requiresConfirmation: options.requiresConfirmation ?? false,
                timeout: options.timeout || 30000
            });
        },

        execute: async (actionName, params, context = {}) => {
            const action = registeredActions.get(actionName);
            if (!action) {
                throw new Error(`Unknown action: ${actionName}`);
            }

            const executionId = `exec-${Date.now()}-${++counter}`;
            const execution = {
                id: executionId,
                actionName,
                params,
                context,
                status: 'pending',
                startedAt: new Date()
            };

            // Check permissions
            if (action.permissions.length > 0 && context.userPermissions) {
                const hasPermission = action.permissions.some(p =>
                    context.userPermissions.includes(p)
                );
                if (!hasPermission) {
                    execution.status = 'denied';
                    execution.error = 'Insufficient permissions';
                    executedActions.push(execution);
                    return execution;
                }
            }

            // Execute
            try {
                execution.status = 'executing';
                const result = await action.handler(params, context);
                execution.result = result;
                execution.status = 'completed';
            } catch (error) {
                execution.status = 'failed';
                execution.error = error.message;
                execution.recoverable = error.recoverable ?? true;
            }

            execution.completedAt = new Date();
            executedActions.push(execution);
            return execution;
        },

        validate: (actionName, params) => {
            const action = registeredActions.get(actionName);
            if (!action) {
                return { valid: false, error: 'Unknown action' };
            }
            return { valid: true };
        },

        getExecutionHistory: (filters = {}) => {
            let history = [...executedActions];
            if (filters.actionName) {
                history = history.filter(e => e.actionName === filters.actionName);
            }
            if (filters.status) {
                history = history.filter(e => e.status === filters.status);
            }
            return history.sort((a, b) => b.startedAt - a.startedAt);
        },

        retry: async (executionId) => {
            const original = executedActions.find(e => e.id === executionId);
            if (!original) throw new Error('Execution not found');
            if (original.status !== 'failed') throw new Error('Can only retry failed executions');

            return this.execute?.(original.actionName, original.params, original.context);
        }
    };
};

describe('AIActionExecutor', () => {
    let executor;

    beforeEach(() => {
        executor = createAIActionExecutor();
        executor.registerAction('create_task', async (params) => ({ taskId: 'task-123', ...params }));
        executor.registerAction('send_email', async (params) => ({ sent: true, to: params.to }));
        executor.registerAction('admin_action', async () => ({ success: true }), { permissions: ['admin'] });
    });

    describe('Action Execution', () => {
        it('should execute registered action', async () => {
            const result = await executor.execute('create_task', { title: 'Test Task' });

            expect(result.status).toBe('completed');
            expect(result.result.taskId).toBe('task-123');
        });

        it('should track execution ID', async () => {
            const result = await executor.execute('create_task', {});
            expect(result.id).toBeDefined();
        });

        it('should throw for unknown action', async () => {
            await expect(executor.execute('unknown_action', {}))
                .rejects.toThrow('Unknown action');
        });
    });

    describe('Error Handling', () => {
        it('should handle action error', async () => {
            executor.registerAction('failing_action', async () => {
                throw new Error('Action failed');
            });

            const result = await executor.execute('failing_action', {});
            expect(result.status).toBe('failed');
            expect(result.error).toBe('Action failed');
        });

        it('should mark recoverable errors', async () => {
            executor.registerAction('recoverable_fail', async () => {
                const err = new Error('Temporary failure');
                err.recoverable = true;
                throw err;
            });

            const result = await executor.execute('recoverable_fail', {});
            expect(result.recoverable).toBe(true);
        });
    });

    describe('Permission Checking', () => {
        it('should deny action without permission', async () => {
            const result = await executor.execute('admin_action', {}, { userPermissions: ['user'] });
            expect(result.status).toBe('denied');
        });

        it('should allow action with permission', async () => {
            const result = await executor.execute('admin_action', {}, { userPermissions: ['admin'] });
            expect(result.status).toBe('completed');
        });
    });

    describe('Action Validation', () => {
        it('should validate known action', () => {
            const result = executor.validate('create_task', {});
            expect(result.valid).toBe(true);
        });

        it('should reject unknown action', () => {
            const result = executor.validate('unknown', {});
            expect(result.valid).toBe(false);
        });
    });

    describe('Execution History', () => {
        it('should track execution history', async () => {
            await executor.execute('create_task', { title: 'Task 1' });
            await executor.execute('send_email', { to: 'test@test.com' });

            const history = executor.getExecutionHistory();
            expect(history).toHaveLength(2);
        });

        it('should filter by status', async () => {
            await executor.execute('create_task', {});
            executor.registerAction('fail', async () => { throw new Error('fail'); });
            await executor.execute('fail', {});

            const failed = executor.getExecutionHistory({ status: 'failed' });
            expect(failed).toHaveLength(1);
        });
    });
});
