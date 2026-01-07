/**
 * Saga Pattern Tests
 * Tests for distributed transaction patterns
 * 
 * @module tests/saga/saga-orchestrator.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Saga step builder
const createSagaStep = (name, execute, compensate) => {
    return {
        name,
        execute,
        compensate,
    };
};

// Saga orchestrator
const createSagaOrchestrator = () => {
    const sagas = new Map();
    const executions = new Map();

    return {
        defineSaga: (name, steps) => {
            sagas.set(name, { name, steps });
        },

        execute: async (sagaName, context = {}) => {
            const saga = sagas.get(sagaName);
            if (!saga) throw new Error(`Saga not found: ${sagaName}`);

            const executionId = crypto.randomUUID();
            const execution = {
                id: executionId,
                sagaName,
                context: { ...context },
                completedSteps: [],
                status: 'running',
                startedAt: Date.now(),
            };

            executions.set(executionId, execution);

            try {
                for (const step of saga.steps) {
                    execution.context = await step.execute(execution.context);
                    execution.completedSteps.push(step.name);
                }

                execution.status = 'completed';
                execution.completedAt = Date.now();

            } catch (error) {
                execution.status = 'compensating';
                execution.error = error.message;

                // Execute compensations in reverse order
                const reversedSteps = [...saga.steps]
                    .filter(s => execution.completedSteps.includes(s.name))
                    .reverse();

                for (const step of reversedSteps) {
                    if (step.compensate) {
                        try {
                            await step.compensate(execution.context);
                        } catch (compError) {
                            execution.compensationErrors = execution.compensationErrors || [];
                            execution.compensationErrors.push({
                                step: step.name,
                                error: compError.message,
                            });
                        }
                    }
                }

                execution.status = 'failed';
                execution.failedAt = Date.now();
            }

            return execution;
        },

        getExecution: (id) => executions.get(id),

        getExecutions: (sagaName) => {
            return [...executions.values()]
                .filter(e => !sagaName || e.sagaName === sagaName);
        },
    };
};

// Event sourcing for saga
const createSagaEventStore = () => {
    const events = [];

    return {
        append: (executionId, eventType, data) => {
            events.push({
                id: crypto.randomUUID(),
                executionId,
                eventType,
                data,
                timestamp: Date.now(),
            });
        },

        getByExecution: (executionId) => {
            return events.filter(e => e.executionId === executionId);
        },

        getByType: (eventType) => {
            return events.filter(e => e.eventType === eventType);
        },

        replay: (executionId, handler) => {
            const executionEvents = this.getByExecution(executionId);
            for (const event of executionEvents) {
                handler(event);
            }
        },

        count: () => events.length,
    };
};

// Transaction coordinator
const createTransactionCoordinator = () => {
    const participants = new Map();
    const transactions = new Map();

    return {
        registerParticipant: (name, participant) => {
            participants.set(name, participant);
        },

        beginTransaction: () => {
            const txId = crypto.randomUUID();
            transactions.set(txId, {
                id: txId,
                status: 'pending',
                votes: new Map(),
                startedAt: Date.now(),
            });
            return txId;
        },

        prepare: async (txId) => {
            const tx = transactions.get(txId);
            if (!tx) throw new Error('Transaction not found');

            tx.status = 'preparing';

            // Ask all participants to prepare
            for (const [name, participant] of participants) {
                try {
                    const vote = await participant.prepare(txId);
                    tx.votes.set(name, vote);
                } catch {
                    tx.votes.set(name, false);
                }
            }

            // Check if all voted yes
            const allReady = [...tx.votes.values()].every(v => v === true);
            tx.status = allReady ? 'prepared' : 'aborted';

            return allReady;
        },

        commit: async (txId) => {
            const tx = transactions.get(txId);
            if (!tx || tx.status !== 'prepared') return false;

            tx.status = 'committing';

            for (const [, participant] of participants) {
                await participant.commit(txId);
            }

            tx.status = 'committed';
            tx.committedAt = Date.now();
            return true;
        },

        rollback: async (txId) => {
            const tx = transactions.get(txId);
            if (!tx) return false;

            tx.status = 'rolling_back';

            for (const [, participant] of participants) {
                await participant.rollback(txId);
            }

            tx.status = 'rolled_back';
            return true;
        },

        getTransaction: (txId) => transactions.get(txId),
    };
};

describe('Saga Orchestrator Tests', () => {
    let orchestrator;

    beforeEach(() => {
        orchestrator = createSagaOrchestrator();
    });

    it('should execute saga successfully', async () => {
        const steps = [
            createSagaStep('step1', async (ctx) => ({ ...ctx, step1: true })),
            createSagaStep('step2', async (ctx) => ({ ...ctx, step2: true })),
        ];

        orchestrator.defineSaga('test', steps);
        const execution = await orchestrator.execute('test', {});

        expect(execution.status).toBe('completed');
        expect(execution.completedSteps).toContain('step1');
        expect(execution.completedSteps).toContain('step2');
    });

    it('should compensate on failure', async () => {
        const compensate1 = vi.fn();
        const compensate2 = vi.fn();

        const steps = [
            createSagaStep('step1', async (ctx) => ({ ...ctx, step1: true }), compensate1),
            createSagaStep('step2', async () => { throw new Error('Failed'); }, compensate2),
        ];

        orchestrator.defineSaga('failing', steps);
        const execution = await orchestrator.execute('failing', {});

        expect(execution.status).toBe('failed');
        expect(compensate1).toHaveBeenCalled();
        expect(compensate2).not.toHaveBeenCalled(); // Step2 didn't complete
    });

    it('should pass context between steps', async () => {
        const steps = [
            createSagaStep('step1', async (ctx) => ({ ...ctx, orderId: '123' })),
            createSagaStep('step2', async (ctx) => ({ ...ctx, paymentId: `pay-${ctx.orderId}` })),
        ];

        orchestrator.defineSaga('order', steps);
        const execution = await orchestrator.execute('order', { userId: 'user1' });

        expect(execution.context.orderId).toBe('123');
        expect(execution.context.paymentId).toBe('pay-123');
    });
});

describe('Saga Event Store Tests', () => {
    let store;

    beforeEach(() => {
        store = createSagaEventStore();
    });

    it('should append events', () => {
        store.append('exec-1', 'STEP_STARTED', { step: 'step1' });
        store.append('exec-1', 'STEP_COMPLETED', { step: 'step1' });

        expect(store.count()).toBe(2);
    });

    it('should get by execution', () => {
        store.append('exec-1', 'EVENT_A', {});
        store.append('exec-2', 'EVENT_B', {});
        store.append('exec-1', 'EVENT_C', {});

        const events = store.getByExecution('exec-1');

        expect(events).toHaveLength(2);
    });

    it('should replay events', () => {
        store.append('exec-1', 'A', { value: 1 });
        store.append('exec-1', 'B', { value: 2 });

        const values = [];
        store.replay('exec-1', (event) => {
            values.push(event.data.value);
        });

        expect(values).toEqual([1, 2]);
    });
});

describe('Transaction Coordinator Tests', () => {
    let coordinator;

    beforeEach(() => {
        coordinator = createTransactionCoordinator();

        coordinator.registerParticipant('db', {
            prepare: vi.fn(async () => true),
            commit: vi.fn(async () => { }),
            rollback: vi.fn(async () => { }),
        });

        coordinator.registerParticipant('cache', {
            prepare: vi.fn(async () => true),
            commit: vi.fn(async () => { }),
            rollback: vi.fn(async () => { }),
        });
    });

    it('should begin transaction', () => {
        const txId = coordinator.beginTransaction();

        expect(txId).toBeTruthy();
        expect(coordinator.getTransaction(txId).status).toBe('pending');
    });

    it('should prepare and commit', async () => {
        const txId = coordinator.beginTransaction();
        const prepared = await coordinator.prepare(txId);

        expect(prepared).toBe(true);
        expect(coordinator.getTransaction(txId).status).toBe('prepared');

        await coordinator.commit(txId);

        expect(coordinator.getTransaction(txId).status).toBe('committed');
    });

    it('should abort if any participant fails', async () => {
        coordinator.registerParticipant('failing', {
            prepare: vi.fn(async () => false),
            commit: vi.fn(),
            rollback: vi.fn(),
        });

        const txId = coordinator.beginTransaction();
        const prepared = await coordinator.prepare(txId);

        expect(prepared).toBe(false);
        expect(coordinator.getTransaction(txId).status).toBe('aborted');
    });

    it('should rollback', async () => {
        const txId = coordinator.beginTransaction();
        await coordinator.rollback(txId);

        expect(coordinator.getTransaction(txId).status).toBe('rolled_back');
    });
});
