/**
 * Distributed Tracing Tests
 * Tests for request tracing and span management
 *
 * @module tests/tracing/distributed-tracing.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Span
const createSpan = (name, options = {}) => {
  const { traceId, parentId, spanId = crypto.randomUUID() } = options;

  const startTime = Date.now();
  let endTime = null;
  const events = [];
  const attributes = {};
  let status = 'UNSET';

  return {
    name,
    traceId,
    spanId,
    parentId,

    setStatus: (s) => {
      status = s;
    },

    setAttribute: (key, value) => {
      attributes[key] = value;
    },

    setAttributes: (attrs) => {
      Object.assign(attributes, attrs);
    },

    addEvent: (eventName, attrs = {}) => {
      events.push({
        name: eventName,
        timestamp: Date.now(),
        attributes: attrs,
      });
    },

    end: () => {
      endTime = Date.now();
    },

    getDuration: () => (endTime ? endTime - startTime : Date.now() - startTime),

    isEnded: () => endTime !== null,

    toJSON: () => ({
      name,
      traceId,
      spanId,
      parentId,
      startTime,
      endTime,
      duration: endTime ? endTime - startTime : null,
      status,
      attributes,
      events,
    }),
  };
};

// Tracer
const createTracer = (serviceName) => {
  const spans = [];
  const activeSpans = new Map();

  return {
    serviceName,

    startSpan: (name, options = {}) => {
      const traceId = options.traceId || crypto.randomUUID();
      const parentSpan = options.parent;

      const span = createSpan(name, {
        traceId: parentSpan?.traceId || traceId,
        parentId: parentSpan?.spanId,
      });

      spans.push(span);
      activeSpans.set(span.spanId, span);

      return span;
    },

    endSpan: (span) => {
      span.end();
      activeSpans.delete(span.spanId);
    },

    getActiveSpans: () => [...activeSpans.values()],

    getAllSpans: () => [...spans],

    withSpan: async (name, fn, options = {}) => {
      const span = this.startSpan(name, options);

      try {
        const result = await fn(span);
        span.setStatus('OK');
        return result;
      } catch (error) {
        span.setStatus('ERROR');
        span.addEvent('exception', {
          message: error.message,
          stack: error.stack,
        });
        throw error;
      } finally {
        span.end();
        activeSpans.delete(span.spanId);
      }
    },

    clear: () => {
      spans.length = 0;
      activeSpans.clear();
    },
  };
};

// Trace context propagation
const createContextPropagator = () => {
  const W3C_HEADER = 'traceparent';

  return {
    inject: (span) => {
      // W3C Trace Context format: version-traceId-spanId-flags
      return {
        [W3C_HEADER]: `00-${span.traceId}-${span.spanId}-01`,
      };
    },

    extract: (headers) => {
      const traceparent = headers[W3C_HEADER] || headers['traceparent'];

      if (!traceparent) return null;

      const parts = traceparent.split('-');
      if (parts.length !== 4) return null;

      return {
        traceId: parts[1],
        spanId: parts[2],
        sampled: parts[3] === '01',
      };
    },

    link: (parentContext, span) => {
      if (parentContext) {
        return {
          ...span.toJSON(),
          parentTraceId: parentContext.traceId,
          parentSpanId: parentContext.spanId,
        };
      }
      return span.toJSON();
    },
  };
};

// Span exporter
const createSpanExporter = (options = {}) => {
  const { batchSize = 100, flushInterval = 5000 } = options;

  const buffer = [];
  let exportFn = null;
  let flushTimer = null;

  const flush = async () => {
    if (buffer.length === 0 || !exportFn) return;

    const batch = buffer.splice(0, buffer.length);
    await exportFn(batch);
  };

  return {
    onExport: (fn) => {
      exportFn = fn;
    },

    add: (span) => {
      buffer.push(span.toJSON());

      if (buffer.length >= batchSize) {
        flush();
      }
    },

    start: () => {
      flushTimer = setInterval(flush, flushInterval);
    },

    stop: async () => {
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
      await flush();
    },

    flush,

    getPendingCount: () => buffer.length,
  };
};

// Sampler
const createSampler = (options = {}) => {
  const { rate = 1.0, alwaysSample = [] } = options;

  return {
    shouldSample: (spanName, attributes = {}) => {
      // Always sample certain spans
      if (alwaysSample.includes(spanName)) {
        return true;
      }

      // Always sample errors
      if (attributes.error) {
        return true;
      }

      // Rate-based sampling
      return Math.random() < rate;
    },

    getRate: () => rate,
  };
};

describe('Span Tests', () => {
  it('should create span', () => {
    const span = createSpan('test-span', {
      traceId: 'trace-1',
    });

    expect(span.name).toBe('test-span');
    expect(span.traceId).toBe('trace-1');
    expect(span.spanId).toBeDefined();
  });

  it('should set attributes', () => {
    const span = createSpan('test');
    span.setAttribute('http.method', 'GET');
    span.setAttributes({ 'http.status_code': 200 });

    const json = span.toJSON();
    expect(json.attributes['http.method']).toBe('GET');
    expect(json.attributes['http.status_code']).toBe(200);
  });

  it('should add events', () => {
    const span = createSpan('test');
    span.addEvent('request_started');
    span.addEvent('response_received', { bytes: 1024 });

    const json = span.toJSON();
    expect(json.events).toHaveLength(2);
  });

  it('should track duration', async () => {
    const span = createSpan('test');

    await new Promise((r) => setTimeout(r, 50));
    span.end();

    expect(span.getDuration()).toBeGreaterThanOrEqual(50);
    expect(span.isEnded()).toBe(true);
  });
});

describe('Tracer Tests', () => {
  let tracer;

  beforeEach(() => {
    tracer = createTracer('test-service');
  });

  it('should start span', () => {
    const span = tracer.startSpan('test-operation');

    expect(span.name).toBe('test-operation');
    expect(tracer.getActiveSpans()).toHaveLength(1);
  });

  it('should create child span', () => {
    const parent = tracer.startSpan('parent');
    const child = tracer.startSpan('child', { parent });

    expect(child.parentId).toBe(parent.spanId);
    expect(child.traceId).toBe(parent.traceId);
  });

  it('should run with span', async () => {
    const result = await tracer.withSpan('operation', async (span) => {
      span.setAttribute('key', 'value');
      return 'done';
    });

    expect(result).toBe('done');
    expect(tracer.getAllSpans()[0].isEnded()).toBe(true);
  });

  it('should handle errors in withSpan', async () => {
    await expect(
      tracer.withSpan('fail', async () => {
        throw new Error('Oops');
      })
    ).rejects.toThrow('Oops');

    const span = tracer.getAllSpans()[0];
    expect(span.toJSON().status).toBe('ERROR');
  });
});

describe('Context Propagator Tests', () => {
  let propagator;

  beforeEach(() => {
    propagator = createContextPropagator();
  });

  it('should inject context', () => {
    const span = createSpan('test', {
      traceId: 'abc123',
      spanId: 'span456',
    });
    span.spanId = 'span456'; // Override for test

    const headers = propagator.inject(span);

    expect(headers.traceparent).toContain('abc123');
  });

  it('should extract context', () => {
    const headers = {
      traceparent: '00-trace123-span456-01',
    };

    const context = propagator.extract(headers);

    expect(context.traceId).toBe('trace123');
    expect(context.spanId).toBe('span456');
    expect(context.sampled).toBe(true);
  });

  it('should return null for invalid header', () => {
    const context = propagator.extract({});

    expect(context).toBeNull();
  });
});

describe('Span Exporter Tests', () => {
  let exporter;

  beforeEach(() => {
    exporter = createSpanExporter({ batchSize: 3 });
  });

  it('should buffer spans', () => {
    const span = createSpan('test');
    exporter.add(span);

    expect(exporter.getPendingCount()).toBe(1);
  });

  it('should flush on batch size', async () => {
    const exportFn = vi.fn();
    exporter.onExport(exportFn);

    exporter.add(createSpan('1'));
    exporter.add(createSpan('2'));
    exporter.add(createSpan('3'));

    await new Promise((r) => setTimeout(r, 10));

    expect(exportFn).toHaveBeenCalled();
  });

  it('should flush manually', async () => {
    const exportFn = vi.fn();
    exporter.onExport(exportFn);

    exporter.add(createSpan('test'));
    await exporter.flush();

    expect(exportFn).toHaveBeenCalled();
    expect(exporter.getPendingCount()).toBe(0);
  });
});

describe('Sampler Tests', () => {
  it('should always sample listed spans', () => {
    const sampler = createSampler({
      rate: 0,
      alwaysSample: ['important-operation'],
    });

    expect(sampler.shouldSample('important-operation')).toBe(true);
  });

  it('should always sample errors', () => {
    const sampler = createSampler({ rate: 0 });

    expect(sampler.shouldSample('any', { error: true })).toBe(true);
  });

  it('should respect rate', () => {
    const sampler = createSampler({ rate: 0.5 });

    // With random, roughly half should be sampled over many trials
    let sampled = 0;
    for (let i = 0; i < 100; i++) {
      if (sampler.shouldSample('test')) sampled++;
    }

    expect(sampled).toBeGreaterThan(20);
    expect(sampled).toBeLessThan(80);
  });
});
