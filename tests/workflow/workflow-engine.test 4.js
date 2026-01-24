/**
 * Workflow Engine Tests
 * Tests for workflow orchestration and automation
 *
 * @module tests/workflow/workflow-engine.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Workflow step types
const STEP_TYPES = ['action', 'condition', 'parallel', 'loop', 'delay', 'wait'];

// Workflow builder
const createWorkflowBuilder = () => {
  const steps = [];
  let currentId = 0;

  const generateId = () => `step-${++currentId}`;

  const builder = {
    action: (name, handler, options = {}) => {
      steps.push({
        id: generateId(),
        type: 'action',
        name,
        handler,
        options,
      });
      return builder;
    },

    condition: (name, condition, thenSteps, elseSteps = []) => {
      steps.push({
        id: generateId(),
        type: 'condition',
        name,
        condition,
        then: thenSteps,
        else: elseSteps,
      });
      return builder;
    },

    parallel: (name, parallelSteps) => {
      steps.push({
        id: generateId(),
        type: 'parallel',
        name,
        steps: parallelSteps,
      });
      return builder;
    },

    loop: (name, items, handler) => {
      steps.push({
        id: generateId(),
        type: 'loop',
        name,
        items,
        handler,
      });
      return builder;
    },

    delay: (ms) => {
      steps.push({
        id: generateId(),
        type: 'delay',
        duration: ms,
      });
      return builder;
    },

    wait: (name, condition, timeout = 30000) => {
      steps.push({
        id: generateId(),
        type: 'wait',
        name,
        condition,
        timeout,
      });
      return builder;
    },

    build: () => [...steps],

    clear: () => {
      steps.length = 0;
      currentId = 0;
      return builder;
    },
  };

  return builder;
};

// Workflow executor
const createWorkflowExecutor = () => {
  const runningWorkflows = new Map();

  const executeStep = async (step, context) => {
    switch (step.type) {
      case 'action':
        return step.handler(context);

      case 'condition':
        const result = await step.condition(context);
        const branch = result ? step.then : step.else;
        for (const s of branch) {
          await executeStep(s, context);
        }
        return result;

      case 'parallel':
        return Promise.all(step.steps.map((s) => executeStep(s, context)));

      case 'loop':
        const items = typeof step.items === 'function' ? await step.items(context) : step.items;
        const results = [];
        for (const item of items) {
          results.push(await step.handler(item, context));
        }
        return results;

      case 'delay':
        return new Promise((resolve) => setTimeout(resolve, step.duration));

      case 'wait':
        const start = Date.now();
        while (Date.now() - start < step.timeout) {
          if (await step.condition(context)) {
            return true;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error(`Wait timeout: ${step.name}`);

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  };

  return {
    execute: async (workflowId, steps, initialContext = {}) => {
      const execution = {
        id: crypto.randomUUID(),
        workflowId,
        status: 'running',
        startedAt: Date.now(),
        context: { ...initialContext },
        completedSteps: [],
        error: null,
      };

      runningWorkflows.set(execution.id, execution);

      try {
        for (const step of steps) {
          await executeStep(step, execution.context);
          execution.completedSteps.push(step.id);
        }

        execution.status = 'completed';
        execution.completedAt = Date.now();
      } catch (error) {
        execution.status = 'failed';
        execution.error = error.message;
        execution.failedAt = Date.now();
      }

      return execution;
    },

    getExecution: (executionId) => runningWorkflows.get(executionId),

    cancelExecution: (executionId) => {
      const execution = runningWorkflows.get(executionId);
      if (execution && execution.status === 'running') {
        execution.status = 'cancelled';
        execution.cancelledAt = Date.now();
        return true;
      }
      return false;
    },

    getRunningWorkflows: () => {
      return [...runningWorkflows.values()].filter((w) => w.status === 'running');
    },
  };
};

// Workflow scheduler
const createWorkflowScheduler = () => {
  const schedules = new Map();
  const timers = new Map();

  return {
    schedule: (id, config) => {
      schedules.set(id, {
        id,
        workflowId: config.workflowId,
        cron: config.cron,
        nextRun: config.nextRun || Date.now(),
        enabled: true,
        lastRun: null,
        runCount: 0,
      });
    },

    unschedule: (id) => {
      const timer = timers.get(id);
      if (timer) {
        clearInterval(timer);
        timers.delete(id);
      }
      return schedules.delete(id);
    },

    enable: (id) => {
      const schedule = schedules.get(id);
      if (schedule) {
        schedule.enabled = true;
      }
    },

    disable: (id) => {
      const schedule = schedules.get(id);
      if (schedule) {
        schedule.enabled = false;
      }
    },

    markRun: (id) => {
      const schedule = schedules.get(id);
      if (schedule) {
        schedule.lastRun = Date.now();
        schedule.runCount++;
      }
    },

    getDueSchedules: () => {
      const now = Date.now();
      return [...schedules.values()].filter((s) => s.enabled && s.nextRun <= now);
    },

    getSchedule: (id) => schedules.get(id),

    getAllSchedules: () => [...schedules.values()],
  };
};

// State machine
const createStateMachine = (config) => {
  let currentState = config.initial;
  const history = [];
  const listeners = [];

  const emit = (event, data) => {
    listeners.forEach((fn) => fn(event, data));
  };

  return {
    getState: () => currentState,

    can: (event) => {
      const stateConfig = config.states[currentState];
      return stateConfig?.on?.[event] !== undefined;
    },

    send: (event, data = {}) => {
      const stateConfig = config.states[currentState];
      const transition = stateConfig?.on?.[event];

      if (!transition) {
        return { success: false, error: 'Invalid transition' };
      }

      const target = typeof transition === 'string' ? transition : transition.target;
      const guard = typeof transition === 'object' ? transition.guard : null;

      if (guard && !guard(data)) {
        return { success: false, error: 'Guard rejected transition' };
      }

      const previousState = currentState;
      currentState = target;

      history.push({
        from: previousState,
        to: currentState,
        event,
        data,
        timestamp: Date.now(),
      });

      // Execute onEnter action if defined
      const targetConfig = config.states[target];
      if (targetConfig?.onEnter) {
        targetConfig.onEnter(data);
      }

      emit('transition', { from: previousState, to: currentState, event });

      return { success: true, state: currentState };
    },

    getHistory: () => [...history],

    onTransition: (listener) => {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    reset: () => {
      currentState = config.initial;
      history.length = 0;
    },

    matches: (state) => currentState === state,
  };
};

describe('Workflow Builder Tests', () => {
  let builder;

  beforeEach(() => {
    builder = createWorkflowBuilder();
  });

  it('should build action steps', () => {
    const handler = vi.fn();
    builder.action('Process', handler);

    const steps = builder.build();
    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe('action');
    expect(steps[0].name).toBe('Process');
  });

  it('should build condition steps', () => {
    builder.condition(
      'Check',
      () => true,
      [{ type: 'action', name: 'Then' }],
      [{ type: 'action', name: 'Else' }]
    );

    const steps = builder.build();
    expect(steps[0].type).toBe('condition');
    expect(steps[0].then).toHaveLength(1);
    expect(steps[0].else).toHaveLength(1);
  });

  it('should build parallel steps', () => {
    builder.parallel('Concurrent', [
      { type: 'action', name: 'A' },
      { type: 'action', name: 'B' },
    ]);

    const steps = builder.build();
    expect(steps[0].type).toBe('parallel');
    expect(steps[0].steps).toHaveLength(2);
  });

  it('should build loop steps', () => {
    builder.loop('Process Items', [1, 2, 3], vi.fn());

    const steps = builder.build();
    expect(steps[0].type).toBe('loop');
    expect(steps[0].items).toEqual([1, 2, 3]);
  });

  it('should chain steps', () => {
    builder.action('Step 1', vi.fn()).delay(1000).action('Step 2', vi.fn());

    const steps = builder.build();
    expect(steps).toHaveLength(3);
  });
});

describe('Workflow Executor Tests', () => {
  let executor;

  beforeEach(() => {
    executor = createWorkflowExecutor();
  });

  it('should execute action steps', async () => {
    const handler = vi.fn();
    const steps = [{ id: '1', type: 'action', name: 'Test', handler }];

    const result = await executor.execute('wf-1', steps);

    expect(result.status).toBe('completed');
    expect(handler).toHaveBeenCalled();
  });

  it('should execute condition steps', async () => {
    const thenHandler = vi.fn();
    const elseHandler = vi.fn();

    const steps = [
      {
        id: '1',
        type: 'condition',
        condition: () => true,
        then: [{ id: '2', type: 'action', handler: thenHandler }],
        else: [{ id: '3', type: 'action', handler: elseHandler }],
      },
    ];

    await executor.execute('wf-1', steps);

    expect(thenHandler).toHaveBeenCalled();
    expect(elseHandler).not.toHaveBeenCalled();
  });

  it('should execute parallel steps', async () => {
    const handlers = [vi.fn(), vi.fn(), vi.fn()];

    const steps = [
      {
        id: '1',
        type: 'parallel',
        steps: handlers.map((h, i) => ({ id: `p${i}`, type: 'action', handler: h })),
      },
    ];

    await executor.execute('wf-1', steps);

    handlers.forEach((h) => expect(h).toHaveBeenCalled());
  });

  it('should execute loop steps', async () => {
    const handler = vi.fn();

    const steps = [
      {
        id: '1',
        type: 'loop',
        items: ['a', 'b', 'c'],
        handler,
      },
    ];

    await executor.execute('wf-1', steps);

    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('should handle errors', async () => {
    const steps = [
      {
        id: '1',
        type: 'action',
        handler: () => {
          throw new Error('Step failed');
        },
      },
    ];

    const result = await executor.execute('wf-1', steps);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Step failed');
  });
});

describe('Workflow Scheduler Tests', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = createWorkflowScheduler();
  });

  it('should schedule workflow', () => {
    scheduler.schedule('sched-1', {
      workflowId: 'wf-1',
      cron: '0 * * * *',
      nextRun: Date.now() + 60000,
    });

    const schedule = scheduler.getSchedule('sched-1');
    expect(schedule.workflowId).toBe('wf-1');
  });

  it('should get due schedules', () => {
    scheduler.schedule('due', { workflowId: 'wf-1', nextRun: Date.now() - 1000 });
    scheduler.schedule('future', { workflowId: 'wf-2', nextRun: Date.now() + 60000 });

    const due = scheduler.getDueSchedules();
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe('due');
  });

  it('should disable schedule', () => {
    scheduler.schedule('test', { workflowId: 'wf-1', nextRun: Date.now() });
    scheduler.disable('test');

    const due = scheduler.getDueSchedules();
    expect(due).toHaveLength(0);
  });

  it('should track run count', () => {
    scheduler.schedule('test', { workflowId: 'wf-1' });
    scheduler.markRun('test');
    scheduler.markRun('test');

    const schedule = scheduler.getSchedule('test');
    expect(schedule.runCount).toBe(2);
  });
});

describe('State Machine Tests', () => {
  let machine;

  beforeEach(() => {
    machine = createStateMachine({
      initial: 'idle',
      states: {
        idle: {
          on: { START: 'running' },
        },
        running: {
          on: {
            PAUSE: 'paused',
            COMPLETE: 'completed',
            FAIL: 'failed',
          },
        },
        paused: {
          on: { RESUME: 'running' },
        },
        completed: {},
        failed: {
          on: { RETRY: 'running' },
        },
      },
    });
  });

  it('should start in initial state', () => {
    expect(machine.getState()).toBe('idle');
  });

  it('should transition on valid event', () => {
    const result = machine.send('START');

    expect(result.success).toBe(true);
    expect(machine.getState()).toBe('running');
  });

  it('should reject invalid transition', () => {
    const result = machine.send('PAUSE'); // Invalid from idle

    expect(result.success).toBe(false);
    expect(machine.getState()).toBe('idle');
  });

  it('should check if can transition', () => {
    expect(machine.can('START')).toBe(true);
    expect(machine.can('PAUSE')).toBe(false);
  });

  it('should track history', () => {
    machine.send('START');
    machine.send('PAUSE');
    machine.send('RESUME');

    const history = machine.getHistory();
    expect(history).toHaveLength(3);
  });

  it('should notify on transition', () => {
    const handler = vi.fn();
    machine.onTransition(handler);

    machine.send('START');

    expect(handler).toHaveBeenCalledWith(
      'transition',
      expect.objectContaining({
        from: 'idle',
        to: 'running',
      })
    );
  });

  it('should match state', () => {
    expect(machine.matches('idle')).toBe(true);
    machine.send('START');
    expect(machine.matches('running')).toBe(true);
  });
});
