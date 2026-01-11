/**
 * Analytics and Event Tracking Tests
 * Tests for analytics, metrics, and event tracking
 *
 * @module tests/analytics/event-tracker.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Event tracker
const createEventTracker = (options = {}) => {
  const { batchSize = 10, flushInterval = 5000 } = options;
  const events = [];
  const queue = [];
  const listeners = [];
  let flushTimer = null;
  let userId = null;
  let sessionId = null;
  const properties = {};

  const emit = (event) => {
    listeners.forEach((fn) => fn(event));
  };

  const flush = async () => {
    if (queue.length === 0) return [];

    const batch = [...queue];
    queue.length = 0;

    // In real implementation, send to analytics endpoint
    events.push(...batch);

    return batch;
  };

  return {
    identify: (id, traits = {}) => {
      userId = id;
      Object.assign(properties, traits);
    },

    startSession: () => {
      sessionId = crypto.randomUUID();
      return sessionId;
    },

    endSession: () => {
      const id = sessionId;
      sessionId = null;
      return id;
    },

    setProperty: (key, value) => {
      properties[key] = value;
    },

    track: (eventName, eventProperties = {}) => {
      const event = {
        id: crypto.randomUUID(),
        name: eventName,
        userId,
        sessionId,
        properties: { ...properties, ...eventProperties },
        timestamp: Date.now(),
      };

      queue.push(event);
      emit(event);

      if (queue.length >= batchSize) {
        flush();
      }

      return event;
    },

    page: (pageName, pageProperties = {}) => {
      return this.track('page_view', {
        page: pageName,
        ...pageProperties,
      });
    },

    flush,

    startAutoFlush: () => {
      flushTimer = setInterval(flush, flushInterval);
    },

    stopAutoFlush: () => {
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
    },

    onEvent: (listener) => {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    getEvents: () => [...events],
    getQueuedEvents: () => [...queue],
    getQueueSize: () => queue.length,
    getUserId: () => userId,
    getSessionId: () => sessionId,

    reset: () => {
      userId = null;
      sessionId = null;
      Object.keys(properties).forEach((k) => delete properties[k]);
      queue.length = 0;
    },
  };
};

// Funnel tracker
const createFunnelTracker = () => {
  const funnels = new Map();

  return {
    defineFunnel: (name, steps) => {
      funnels.set(name, {
        name,
        steps,
        entries: [],
      });
    },

    trackStep: (funnelName, stepName, userId, metadata = {}) => {
      const funnel = funnels.get(funnelName);
      if (!funnel) return null;

      const stepIndex = funnel.steps.indexOf(stepName);
      if (stepIndex === -1) return null;

      funnel.entries.push({
        userId,
        step: stepName,
        stepIndex,
        timestamp: Date.now(),
        metadata,
      });

      return { funnelName, stepName, stepIndex };
    },

    getConversionRate: (funnelName, fromStep, toStep) => {
      const funnel = funnels.get(funnelName);
      if (!funnel) return null;

      const fromIndex = funnel.steps.indexOf(fromStep);
      const toIndex = funnel.steps.indexOf(toStep);

      const usersAtFrom = new Set(
        funnel.entries.filter((e) => e.stepIndex === fromIndex).map((e) => e.userId)
      );

      const usersAtTo = new Set(
        funnel.entries.filter((e) => e.stepIndex === toIndex).map((e) => e.userId)
      );

      const converted = [...usersAtFrom].filter((u) => usersAtTo.has(u));

      return usersAtFrom.size > 0 ? converted.length / usersAtFrom.size : 0;
    },

    getFunnelStats: (funnelName) => {
      const funnel = funnels.get(funnelName);
      if (!funnel) return null;

      const stats = funnel.steps.map((step, index) => {
        const users = new Set(
          funnel.entries.filter((e) => e.stepIndex === index).map((e) => e.userId)
        );
        return { step, count: users.size };
      });

      return stats;
    },

    clearFunnel: (funnelName) => {
      const funnel = funnels.get(funnelName);
      if (funnel) {
        funnel.entries = [];
      }
    },
  };
};

// A/B Testing tracker
const createABTracker = () => {
  const experiments = new Map();
  const assignments = new Map();

  return {
    defineExperiment: (name, variants, weights = null) => {
      const totalWeight = weights ? weights.reduce((a, b) => a + b, 0) : variants.length;

      experiments.set(name, {
        name,
        variants,
        weights: weights || variants.map(() => 1),
        totalWeight,
        results: new Map(),
      });
    },

    assignVariant: (experimentName, userId) => {
      const key = `${experimentName}:${userId}`;

      if (assignments.has(key)) {
        return assignments.get(key);
      }

      const experiment = experiments.get(experimentName);
      if (!experiment) return null;

      // Deterministic assignment based on hash
      const hash = Array.from(key).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
      const normalized = Math.abs(hash) / 2147483647;

      let cumulative = 0;
      let selectedVariant = experiment.variants[0];

      for (let i = 0; i < experiment.variants.length; i++) {
        cumulative += experiment.weights[i] / experiment.totalWeight;
        if (normalized < cumulative) {
          selectedVariant = experiment.variants[i];
          break;
        }
      }

      assignments.set(key, selectedVariant);
      return selectedVariant;
    },

    trackConversion: (experimentName, userId, value = 1) => {
      const variant = this.assignVariant(experimentName, userId);
      const experiment = experiments.get(experimentName);

      if (!experiment || !variant) return false;

      const results = experiment.results.get(variant) || { conversions: 0, total: 0 };
      results.conversions += value;
      results.total++;
      experiment.results.set(variant, results);

      return true;
    },

    getResults: (experimentName) => {
      const experiment = experiments.get(experimentName);
      if (!experiment) return null;

      return {
        name: experimentName,
        variants: experiment.variants.map((v) => ({
          name: v,
          ...(experiment.results.get(v) || { conversions: 0, total: 0 }),
        })),
      };
    },

    calculateSignificance: (experimentName) => {
      // Simplified statistical significance (mock)
      const results = this.getResults(experimentName);
      if (!results || results.variants.length < 2) return null;

      const [control, treatment] = results.variants;
      const controlRate = control.total > 0 ? control.conversions / control.total : 0;
      const treatmentRate = treatment.total > 0 ? treatment.conversions / treatment.total : 0;

      return {
        controlRate,
        treatmentRate,
        lift: controlRate > 0 ? (treatmentRate - controlRate) / controlRate : 0,
        isSignificant:
          Math.abs(treatmentRate - controlRate) > 0.05 &&
          control.total >= 100 &&
          treatment.total >= 100,
      };
    },
  };
};

// Metric aggregator
const createMetricAggregator = () => {
  const metrics = new Map();

  return {
    record: (name, value, tags = {}) => {
      const key = name;

      if (!metrics.has(key)) {
        metrics.set(key, {
          name,
          values: [],
          sum: 0,
          count: 0,
          min: Infinity,
          max: -Infinity,
          tags: new Set(),
        });
      }

      const metric = metrics.get(key);
      metric.values.push(value);
      metric.sum += value;
      metric.count++;
      metric.min = Math.min(metric.min, value);
      metric.max = Math.max(metric.max, value);
      Object.keys(tags).forEach((t) => metric.tags.add(t));
    },

    getStats: (name) => {
      const metric = metrics.get(name);
      if (!metric) return null;

      const sorted = [...metric.values].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      return {
        name,
        count: metric.count,
        sum: metric.sum,
        avg: metric.sum / metric.count,
        min: metric.min,
        max: metric.max,
        p50,
        p95,
        p99,
      };
    },

    getAllMetrics: () => [...metrics.keys()],

    reset: (name) => {
      if (name) {
        metrics.delete(name);
      } else {
        metrics.clear();
      }
    },
  };
};

describe('Event Tracker Tests', () => {
  let tracker;

  beforeEach(() => {
    tracker = createEventTracker({ batchSize: 5 });
  });

  it('should track events', () => {
    tracker.track('button_click', { button: 'submit' });

    expect(tracker.getQueueSize()).toBe(1);
  });

  it('should identify user', () => {
    tracker.identify('user-123', { plan: 'pro' });
    tracker.track('event');

    const events = tracker.getQueuedEvents();
    expect(events[0].userId).toBe('user-123');
  });

  it('should track sessions', () => {
    const sessionId = tracker.startSession();
    tracker.track('event');

    expect(tracker.getSessionId()).toBe(sessionId);
  });

  it('should flush when batch size reached', async () => {
    for (let i = 0; i < 5; i++) {
      tracker.track(`event_${i}`);
    }

    expect(tracker.getEvents().length).toBe(5);
    expect(tracker.getQueueSize()).toBe(0);
  });

  it('should track page views', () => {
    tracker.page('home', { referrer: 'google.com' });

    const events = tracker.getQueuedEvents();
    expect(events[0].name).toBe('page_view');
    expect(events[0].properties.page).toBe('home');
  });

  it('should notify listeners', () => {
    const handler = vi.fn();
    tracker.onEvent(handler);

    tracker.track('test');

    expect(handler).toHaveBeenCalled();
  });
});

describe('Funnel Tracker Tests', () => {
  let funnels;

  beforeEach(() => {
    funnels = createFunnelTracker();
    funnels.defineFunnel('signup', ['view_page', 'start_signup', 'complete_signup']);
  });

  it('should track funnel steps', () => {
    funnels.trackStep('signup', 'view_page', 'user-1');
    funnels.trackStep('signup', 'start_signup', 'user-1');

    const stats = funnels.getFunnelStats('signup');
    expect(stats[0].count).toBe(1);
    expect(stats[1].count).toBe(1);
  });

  it('should calculate conversion rate', () => {
    funnels.trackStep('signup', 'view_page', 'user-1');
    funnels.trackStep('signup', 'view_page', 'user-2');
    funnels.trackStep('signup', 'complete_signup', 'user-1');

    const rate = funnels.getConversionRate('signup', 'view_page', 'complete_signup');
    expect(rate).toBe(0.5);
  });

  it('should track multiple users', () => {
    for (let i = 0; i < 10; i++) {
      funnels.trackStep('signup', 'view_page', `user-${i}`);
    }
    for (let i = 0; i < 5; i++) {
      funnels.trackStep('signup', 'complete_signup', `user-${i}`);
    }

    const stats = funnels.getFunnelStats('signup');
    expect(stats[0].count).toBe(10);
    expect(stats[2].count).toBe(5);
  });
});

describe('A/B Tracker Tests', () => {
  let ab;

  beforeEach(() => {
    ab = createABTracker();
    ab.defineExperiment('button_color', ['red', 'blue']);
  });

  it('should assign variant deterministically', () => {
    const v1 = ab.assignVariant('button_color', 'user-1');
    const v2 = ab.assignVariant('button_color', 'user-1');

    expect(v1).toBe(v2);
  });

  it('should distribute variants', () => {
    const counts = { red: 0, blue: 0 };

    for (let i = 0; i < 100; i++) {
      const variant = ab.assignVariant('button_color', `user-${i}`);
      counts[variant]++;
    }

    // Should have some distribution (not all one variant)
    expect(counts.red).toBeGreaterThan(0);
    expect(counts.blue).toBeGreaterThan(0);
  });

  it('should track conversions', () => {
    ab.assignVariant('button_color', 'user-1');
    ab.trackConversion('button_color', 'user-1');

    const results = ab.getResults('button_color');
    const totalConversions = results.variants.reduce((s, v) => s + v.conversions, 0);
    expect(totalConversions).toBe(1);
  });

  it('should calculate lift', () => {
    // Assign and convert some users
    for (let i = 0; i < 200; i++) {
      ab.assignVariant('button_color', `user-${i}`);
      if (Math.random() > 0.3) {
        ab.trackConversion('button_color', `user-${i}`);
      }
    }

    const sig = ab.calculateSignificance('button_color');
    expect(sig).not.toBeNull();
    expect(sig.lift).toBeDefined();
  });
});

describe('Metric Aggregator Tests', () => {
  let metrics;

  beforeEach(() => {
    metrics = createMetricAggregator();
  });

  it('should record metrics', () => {
    metrics.record('response_time', 100);
    metrics.record('response_time', 150);
    metrics.record('response_time', 200);

    const stats = metrics.getStats('response_time');
    expect(stats.count).toBe(3);
    expect(stats.avg).toBe(150);
  });

  it('should calculate min/max', () => {
    metrics.record('latency', 50);
    metrics.record('latency', 100);
    metrics.record('latency', 25);

    const stats = metrics.getStats('latency');
    expect(stats.min).toBe(25);
    expect(stats.max).toBe(100);
  });

  it('should calculate percentiles', () => {
    for (let i = 1; i <= 100; i++) {
      metrics.record('values', i);
    }

    const stats = metrics.getStats('values');
    expect(stats.p50).toBe(50);
    expect(stats.p95).toBe(95);
    expect(stats.p99).toBe(99);
  });

  it('should list all metrics', () => {
    metrics.record('metric_a', 1);
    metrics.record('metric_b', 2);

    const all = metrics.getAllMetrics();
    expect(all).toContain('metric_a');
    expect(all).toContain('metric_b');
  });
});
