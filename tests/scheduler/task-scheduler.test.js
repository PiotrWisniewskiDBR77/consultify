/**
 * Task Scheduler Tests
 * Tests for job scheduling patterns
 *
 * @module tests/scheduler/task-scheduler.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Cron-like scheduler
const createScheduler = () => {
  const jobs = new Map();
  const intervals = new Map();
  let isRunning = false;

  const parseCronExpression = (expr) => {
    // Simplified: supports "* * * * *" or specific values
    const [minute, hour, dayOfMonth, month, dayOfWeek] = expr.split(' ');

    return {
      matches: (date) => {
        const checks = [
          minute === '*' || parseInt(minute) === date.getMinutes(),
          hour === '*' || parseInt(hour) === date.getHours(),
          dayOfMonth === '*' || parseInt(dayOfMonth) === date.getDate(),
          month === '*' || parseInt(month) === date.getMonth() + 1,
          dayOfWeek === '*' || parseInt(dayOfWeek) === date.getDay(),
        ];
        return checks.every(Boolean);
      },
    };
  };

  return {
    schedule: (name, cronExpr, handler) => {
      jobs.set(name, {
        cron: parseCronExpression(cronExpr),
        handler,
        lastRun: null,
        nextRun: null,
        runCount: 0,
      });
    },

    scheduleAt: (name, date, handler) => {
      jobs.set(name, {
        runAt: date,
        handler,
        once: true,
      });
    },

    scheduleInterval: (name, ms, handler) => {
      const intervalId = setInterval(async () => {
        const job = jobs.get(name);
        if (job) {
          job.runCount = (job.runCount || 0) + 1;
          job.lastRun = new Date();
          await handler();
        }
      }, ms);

      intervals.set(name, intervalId);
      jobs.set(name, { intervalMs: ms, handler, runCount: 0 });
    },

    cancel: (name) => {
      jobs.delete(name);
      const intervalId = intervals.get(name);
      if (intervalId) {
        clearInterval(intervalId);
        intervals.delete(name);
      }
    },

    cancelAll: () => {
      for (const intervalId of intervals.values()) {
        clearInterval(intervalId);
      }
      intervals.clear();
      jobs.clear();
    },

    tick: async (date = new Date()) => {
      for (const [name, job] of jobs) {
        if (job.cron?.matches(date)) {
          job.runCount++;
          job.lastRun = date;
          await job.handler();
        }

        if (job.runAt && date >= job.runAt && !job.executed) {
          job.executed = true;
          await job.handler();
          if (job.once) {
            jobs.delete(name);
          }
        }
      }
    },

    getJob: (name) => jobs.get(name),

    getJobNames: () => [...jobs.keys()],

    isScheduled: (name) => jobs.has(name),
  };
};

// Task queue with priorities
const createTaskQueue = () => {
  const queues = {
    high: [],
    normal: [],
    low: [],
  };

  let isProcessing = false;
  let concurrency = 1;
  let activeCount = 0;

  const getNextTask = () => {
    for (const priority of ['high', 'normal', 'low']) {
      if (queues[priority].length > 0) {
        return queues[priority].shift();
      }
    }
    return null;
  };

  const processQueue = async () => {
    if (isProcessing) return;
    isProcessing = true;

    while (activeCount < concurrency) {
      const task = getNextTask();
      if (!task) break;

      activeCount++;
      task
        .handler()
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
          activeCount--;
          processQueue();
        });
    }

    isProcessing = false;
  };

  return {
    add: (handler, priority = 'normal') => {
      return new Promise((resolve, reject) => {
        queues[priority].push({ handler, resolve, reject });
        processQueue();
      });
    },

    setConcurrency: (n) => {
      concurrency = n;
    },

    getQueueLength: (priority = null) => {
      if (priority) {
        return queues[priority].length;
      }
      return queues.high.length + queues.normal.length + queues.low.length;
    },

    getActiveCount: () => activeCount,

    clear: () => {
      queues.high.length = 0;
      queues.normal.length = 0;
      queues.low.length = 0;
    },
  };
};

// Delayed task executor
const createDelayedExecutor = () => {
  const pending = new Map();

  return {
    delay: (name, ms, handler) => {
      // Cancel existing
      if (pending.has(name)) {
        clearTimeout(pending.get(name).timeoutId);
      }

      const timeoutId = setTimeout(async () => {
        pending.delete(name);
        await handler();
      }, ms);

      pending.set(name, {
        timeoutId,
        scheduledAt: Date.now(),
        executeAt: Date.now() + ms,
      });
    },

    cancel: (name) => {
      const task = pending.get(name);
      if (task) {
        clearTimeout(task.timeoutId);
        pending.delete(name);
      }
    },

    cancelAll: () => {
      for (const task of pending.values()) {
        clearTimeout(task.timeoutId);
      }
      pending.clear();
    },

    getRemainingTime: (name) => {
      const task = pending.get(name);
      if (!task) return null;
      return Math.max(0, task.executeAt - Date.now());
    },

    isPending: (name) => pending.has(name),

    getPendingCount: () => pending.size,
  };
};

// Retry scheduler
const createRetryScheduler = (options = {}) => {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 30000, backoffFactor = 2 } = options;

  return {
    execute: async (task, onRetry = null) => {
      let attempts = 0;
      let delay = baseDelay;

      while (attempts <= maxRetries) {
        try {
          return await task();
        } catch (error) {
          attempts++;

          if (attempts > maxRetries) {
            throw error;
          }

          onRetry?.({ attempt: attempts, error, nextDelay: delay });

          await new Promise((r) => setTimeout(r, delay));
          delay = Math.min(delay * backoffFactor, maxDelay);
        }
      }
    },

    calculateDelay: (attempt) => {
      return Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
    },
  };
};

describe('Scheduler Tests', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = createScheduler();
  });

  afterEach(() => {
    scheduler.cancelAll();
  });

  it('should schedule cron job', () => {
    scheduler.schedule('job1', '* * * * *', vi.fn());

    expect(scheduler.isScheduled('job1')).toBe(true);
  });

  it('should tick and run matching jobs', async () => {
    const handler = vi.fn();
    scheduler.schedule('job1', '30 * * * *', handler);

    const date = new Date();
    date.setMinutes(30);

    await scheduler.tick(date);

    expect(handler).toHaveBeenCalled();
  });

  it('should schedule one-time job', async () => {
    const handler = vi.fn();
    const runAt = new Date(Date.now() - 1000); // Past

    scheduler.scheduleAt('once', runAt, handler);
    await scheduler.tick(new Date());

    expect(handler).toHaveBeenCalled();
    expect(scheduler.isScheduled('once')).toBe(false);
  });

  it('should cancel job', () => {
    scheduler.schedule('job1', '* * * * *', vi.fn());
    scheduler.cancel('job1');

    expect(scheduler.isScheduled('job1')).toBe(false);
  });
});

describe('Task Queue Tests', () => {
  let queue;

  beforeEach(() => {
    queue = createTaskQueue();
  });

  it('should add and process task', async () => {
    const result = await queue.add(() => Promise.resolve('done'));

    expect(result).toBe('done');
  });

  it('should process by priority', async () => {
    const order = [];

    queue.add(
      () =>
        new Promise((r) =>
          setTimeout(() => {
            order.push('normal');
            r();
          }, 50)
        )
    );
    queue.add(() => {
      order.push('high');
      return Promise.resolve();
    }, 'high');

    await new Promise((r) => setTimeout(r, 100));

    expect(order[0]).toBe('high');
  });

  it('should track queue length', () => {
    queue.add(() => new Promise((r) => setTimeout(r, 100)));
    queue.add(() => new Promise((r) => setTimeout(r, 100)));

    expect(queue.getQueueLength()).toBeGreaterThan(0);
  });
});

describe('Delayed Executor Tests', () => {
  let executor;

  beforeEach(() => {
    vi.useFakeTimers();
    executor = createDelayedExecutor();
  });

  afterEach(() => {
    vi.useRealTimers();
    executor.cancelAll();
  });

  it('should delay execution', () => {
    const handler = vi.fn();
    executor.delay('task1', 1000, handler);

    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(handler).toHaveBeenCalled();
  });

  it('should cancel delayed task', () => {
    const handler = vi.fn();
    executor.delay('task1', 1000, handler);
    executor.cancel('task1');

    vi.advanceTimersByTime(1000);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should replace existing delay', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    executor.delay('task1', 500, handler1);
    executor.delay('task1', 1000, handler2);

    vi.advanceTimersByTime(600);
    expect(handler1).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(handler2).toHaveBeenCalled();
  });
});

describe('Retry Scheduler Tests', () => {
  let retryScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    retryScheduler = createRetryScheduler({ maxRetries: 3, baseDelay: 100 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first try', async () => {
    const task = vi.fn().mockResolvedValue('success');

    const promise = retryScheduler.execute(task);
    vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

    const promise = retryScheduler.execute(task);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('should calculate exponential delay', () => {
    expect(retryScheduler.calculateDelay(1)).toBe(100);
    expect(retryScheduler.calculateDelay(2)).toBe(200);
    expect(retryScheduler.calculateDelay(3)).toBe(400);
  });
});
