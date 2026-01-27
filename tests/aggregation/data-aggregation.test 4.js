/**
 * Data Aggregation Tests
 * Tests for data aggregation and reporting
 *
 * @module tests/aggregation/data-aggregation.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Aggregation pipeline
const createAggregationPipeline = () => {
  const stages = [];

  return {
    match: (predicate) => {
      stages.push({ type: 'match', predicate });
      return this;
    },

    group: (keyFn, aggregations) => {
      stages.push({ type: 'group', keyFn, aggregations });
      return this;
    },

    sort: (compareFn) => {
      stages.push({ type: 'sort', compareFn });
      return this;
    },

    limit: (n) => {
      stages.push({ type: 'limit', n });
      return this;
    },

    skip: (n) => {
      stages.push({ type: 'skip', n });
      return this;
    },

    project: (fields) => {
      stages.push({ type: 'project', fields });
      return this;
    },

    execute: (data) => {
      let result = [...data];

      for (const stage of stages) {
        switch (stage.type) {
          case 'match':
            result = result.filter(stage.predicate);
            break;

          case 'group': {
            const groups = new Map();
            for (const item of result) {
              const key = stage.keyFn(item);
              if (!groups.has(key)) {
                groups.set(key, []);
              }
              groups.get(key).push(item);
            }

            result = [...groups.entries()].map(([key, items]) => {
              const aggregated = { _id: key };
              for (const [name, fn] of Object.entries(stage.aggregations)) {
                aggregated[name] = fn(items);
              }
              return aggregated;
            });
            break;
          }

          case 'sort':
            result.sort(stage.compareFn);
            break;

          case 'limit':
            result = result.slice(0, stage.n);
            break;

          case 'skip':
            result = result.slice(stage.n);
            break;

          case 'project':
            result = result.map((item) => {
              const projected = {};
              for (const field of stage.fields) {
                if (typeof field === 'string') {
                  projected[field] = item[field];
                } else {
                  const [name, fn] = Object.entries(field)[0];
                  projected[name] = fn(item);
                }
              }
              return projected;
            });
            break;
        }
      }

      return result;
    },

    clear: () => {
      stages.length = 0;
      return this;
    },
  };
};

// Aggregation functions
const Aggregations = {
  sum: (field) => (items) => items.reduce((s, i) => s + (i[field] || 0), 0),
  avg: (field) => (items) => (items.length ? Aggregations.sum(field)(items) / items.length : 0),
  min: (field) => (items) => Math.min(...items.map((i) => i[field])),
  max: (field) => (items) => Math.max(...items.map((i) => i[field])),
  count: () => (items) => items.length,
  first: (field) => (items) => items[0]?.[field],
  last: (field) => (items) => items[items.length - 1]?.[field],
  list: (field) => (items) => items.map((i) => i[field]),
  distinct: (field) => (items) => [...new Set(items.map((i) => i[field]))],
};

// Time series aggregation
const createTimeSeriesAggregator = () => {
  return {
    aggregate: (data, options = {}) => {
      const {
        timeField = 'timestamp',
        valueField = 'value',
        interval = 'hour', // minute, hour, day, week, month
        aggregation = 'sum',
      } = options;

      const getIntervalKey = (timestamp) => {
        const date = new Date(timestamp);
        switch (interval) {
          case 'minute':
            return new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate(),
              date.getHours(),
              date.getMinutes()
            ).getTime();
          case 'hour':
            return new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate(),
              date.getHours()
            ).getTime();
          case 'day':
            return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
          case 'week': {
            const day = date.getDay();
            const diff = date.getDate() - day;
            return new Date(date.getFullYear(), date.getMonth(), diff).getTime();
          }
          case 'month':
            return new Date(date.getFullYear(), date.getMonth()).getTime();
          default:
            return timestamp;
        }
      };

      const buckets = new Map();
      for (const item of data) {
        const key = getIntervalKey(item[timeField]);
        if (!buckets.has(key)) {
          buckets.set(key, []);
        }
        buckets.get(key).push(item[valueField]);
      }

      const aggregate = (values) => {
        switch (aggregation) {
          case 'sum':
            return values.reduce((a, b) => a + b, 0);
          case 'avg':
            return values.reduce((a, b) => a + b, 0) / values.length;
          case 'min':
            return Math.min(...values);
          case 'max':
            return Math.max(...values);
          case 'count':
            return values.length;
          default:
            return values[0];
        }
      };

      return [...buckets.entries()]
        .map(([timestamp, values]) => ({
          timestamp,
          value: aggregate(values),
          count: values.length,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    },

    fillGaps: (data, interval, defaultValue = 0) => {
      if (data.length < 2) return data;

      const result = [];
      const intervalMs =
        {
          minute: 60 * 1000,
          hour: 60 * 60 * 1000,
          day: 24 * 60 * 60 * 1000,
        }[interval] || 60 * 60 * 1000;

      let current = data[0].timestamp;
      const end = data[data.length - 1].timestamp;
      let dataIndex = 0;

      while (current <= end) {
        if (data[dataIndex]?.timestamp === current) {
          result.push(data[dataIndex]);
          dataIndex++;
        } else {
          result.push({ timestamp: current, value: defaultValue });
        }
        current += intervalMs;
      }

      return result;
    },
  };
};

// Rolling window aggregation
const createRollingWindow = (windowSize = 5) => {
  const window = [];

  return {
    add: (value) => {
      window.push(value);
      if (window.length > windowSize) {
        window.shift();
      }
    },

    getSum: () => window.reduce((a, b) => a + b, 0),
    getAvg: () => (window.length ? this.getSum() / window.length : 0),
    getMin: () => Math.min(...window),
    getMax: () => Math.max(...window),
    getValues: () => [...window],
    isFull: () => window.length === windowSize,
    clear: () => {
      window.length = 0;
    },
  };
};

describe('Aggregation Pipeline Tests', () => {
  let pipeline;
  let data;

  beforeEach(() => {
    pipeline = createAggregationPipeline();
    data = [
      { category: 'A', value: 10, status: 'active' },
      { category: 'B', value: 20, status: 'active' },
      { category: 'A', value: 30, status: 'inactive' },
      { category: 'B', value: 40, status: 'active' },
      { category: 'A', value: 50, status: 'active' },
    ];
  });

  it('should match filter', () => {
    const result = pipeline.match((item) => item.status === 'active').execute(data);

    expect(result).toHaveLength(4);
  });

  it('should group and aggregate', () => {
    const result = pipeline
      .group((item) => item.category, {
        total: Aggregations.sum('value'),
        count: Aggregations.count(),
      })
      .execute(data);

    expect(result).toHaveLength(2);
    const groupA = result.find((r) => r._id === 'A');
    expect(groupA.total).toBe(90);
    expect(groupA.count).toBe(3);
  });

  it('should sort results', () => {
    const result = pipeline
      .sort((a, b) => b.value - a.value)
      .limit(3)
      .execute(data);

    expect(result[0].value).toBe(50);
    expect(result).toHaveLength(3);
  });

  it('should project fields', () => {
    const result = pipeline
      .project(['category', { doubled: (item) => item.value * 2 }])
      .execute(data);

    expect(result[0]).toHaveProperty('category');
    expect(result[0]).toHaveProperty('doubled');
    expect(result[0]).not.toHaveProperty('status');
  });
});

describe('Aggregation Functions Tests', () => {
  const items = [{ value: 10 }, { value: 20 }, { value: 30 }, { value: 20 }];

  it('should calculate sum', () => {
    expect(Aggregations.sum('value')(items)).toBe(80);
  });

  it('should calculate avg', () => {
    expect(Aggregations.avg('value')(items)).toBe(20);
  });

  it('should calculate min/max', () => {
    expect(Aggregations.min('value')(items)).toBe(10);
    expect(Aggregations.max('value')(items)).toBe(30);
  });

  it('should get distinct values', () => {
    expect(Aggregations.distinct('value')(items)).toEqual([10, 20, 30]);
  });
});

describe('Time Series Aggregator Tests', () => {
  let aggregator;

  beforeEach(() => {
    aggregator = createTimeSeriesAggregator();
  });

  it('should aggregate by hour', () => {
    const data = [
      { timestamp: new Date('2024-01-01T10:15:00').getTime(), value: 10 },
      { timestamp: new Date('2024-01-01T10:30:00').getTime(), value: 20 },
      { timestamp: new Date('2024-01-01T11:15:00').getTime(), value: 30 },
    ];

    const result = aggregator.aggregate(data, { interval: 'hour', aggregation: 'sum' });

    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(30); // 10:00 hour
    expect(result[1].value).toBe(30); // 11:00 hour
  });

  it('should aggregate by day', () => {
    const data = [
      { timestamp: new Date('2024-01-01T10:00:00').getTime(), value: 10 },
      { timestamp: new Date('2024-01-01T20:00:00').getTime(), value: 20 },
      { timestamp: new Date('2024-01-02T10:00:00').getTime(), value: 30 },
    ];

    const result = aggregator.aggregate(data, { interval: 'day', aggregation: 'sum' });

    expect(result).toHaveLength(2);
  });
});

describe('Rolling Window Tests', () => {
  let window;

  beforeEach(() => {
    window = createRollingWindow(3);
  });

  it('should maintain window size', () => {
    window.add(1);
    window.add(2);
    window.add(3);
    window.add(4);

    expect(window.getValues()).toEqual([2, 3, 4]);
  });

  it('should calculate rolling average', () => {
    window.add(10);
    window.add(20);
    window.add(30);

    expect(window.getAvg()).toBe(20);
  });

  it('should report if full', () => {
    window.add(1);
    expect(window.isFull()).toBe(false);

    window.add(2);
    window.add(3);
    expect(window.isFull()).toBe(true);
  });
});
