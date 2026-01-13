/**
 * Export and Import Tests
 * Tests for data export and import utilities
 *
 * @module tests/export/export-import.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// CSV exporter
const createCSVExporter = () => {
  const escape = (value) => {
    if (typeof value !== 'string') value = String(value ?? '');
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  return {
    export: (data, options = {}) => {
      if (!Array.isArray(data) || data.length === 0) {
        return '';
      }

      const columns = options.columns || Object.keys(data[0]);
      const delimiter = options.delimiter || ',';
      const includeHeader = options.includeHeader !== false;

      const rows = [];

      if (includeHeader) {
        rows.push(columns.join(delimiter));
      }

      for (const row of data) {
        const values = columns.map((col) => escape(row[col]));
        rows.push(values.join(delimiter));
      }

      return rows.join('\n');
    },

    exportAsync: async (data, options = {}) => {
      return this.export(data, options);
    },
  };
};

// CSV importer
const createCSVImporter = () => {
  const parseRow = (line, delimiter = ',') => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  };

  return {
    import: (csv, options = {}) => {
      const lines = csv.split('\n').filter((l) => l.trim());
      if (lines.length === 0) return [];

      const delimiter = options.delimiter || ',';
      const hasHeader = options.hasHeader !== false;

      const headers = hasHeader ? parseRow(lines[0], delimiter) : options.headers || [];

      const startIndex = hasHeader ? 1 : 0;
      const data = [];

      for (let i = startIndex; i < lines.length; i++) {
        const values = parseRow(lines[i], delimiter);
        const row = {};

        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = values[j] || '';
        }

        data.push(row);
      }

      return data;
    },

    validate: (csv) => {
      const lines = csv.split('\n').filter((l) => l.trim());
      if (lines.length === 0) {
        return { valid: false, error: 'Empty CSV' };
      }

      const headerCount = lines[0].split(',').length;

      for (let i = 1; i < lines.length; i++) {
        const count = lines[i].split(',').length;
        if (count !== headerCount) {
          return {
            valid: false,
            error: `Row ${i + 1} has ${count} columns, expected ${headerCount}`,
          };
        }
      }

      return { valid: true };
    },
  };
};

// JSON exporter
const createJSONExporter = () => {
  return {
    export: (data, options = {}) => {
      const indent = options.pretty ? 2 : 0;
      return JSON.stringify(data, options.replacer || null, indent);
    },

    exportNDJSON: (data) => {
      return data.map((item) => JSON.stringify(item)).join('\n');
    },
  };
};

// JSON importer
const createJSONImporter = () => {
  return {
    import: (json) => {
      return JSON.parse(json);
    },

    importNDJSON: (ndjson) => {
      return ndjson
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    },

    validate: (json) => {
      try {
        JSON.parse(json);
        return { valid: true };
      } catch (error) {
        return { valid: false, error: error.message };
      }
    },
  };
};

// Export queue for large datasets
const createExportQueue = () => {
  const jobs = new Map();
  let processing = false;

  const processJob = async (job) => {
    job.status = 'processing';
    job.startedAt = Date.now();

    try {
      const result = await job.exporter(job.data, job.options);
      job.result = result;
      job.status = 'completed';
      job.completedAt = Date.now();
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
    }
  };

  const processQueue = async () => {
    if (processing) return;
    processing = true;

    for (const job of jobs.values()) {
      if (job.status === 'pending') {
        await processJob(job);
      }
    }

    processing = false;
  };

  return {
    enqueue: (exporter, data, options = {}) => {
      const job = {
        id: crypto.randomUUID(),
        status: 'pending',
        exporter,
        data,
        options,
        createdAt: Date.now(),
      };

      jobs.set(job.id, job);
      processQueue();

      return job.id;
    },

    getJob: (jobId) => jobs.get(jobId),

    getResult: (jobId) => {
      const job = jobs.get(jobId);
      return job?.result || null;
    },

    cancel: (jobId) => {
      const job = jobs.get(jobId);
      if (job && job.status === 'pending') {
        job.status = 'cancelled';
        return true;
      }
      return false;
    },

    getJobs: () => [...jobs.values()],
  };
};

// Data transformer
const createDataTransformer = () => {
  return {
    flatten: (data, prefix = '') => {
      const result = {};

      for (const [key, value] of Object.entries(data)) {
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(result, this.flatten(value, newKey));
        } else {
          result[newKey] = value;
        }
      }

      return result;
    },

    unflatten: (data) => {
      const result = {};

      for (const [key, value] of Object.entries(data)) {
        const parts = key.split('.');
        let current = result;

        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;
      }

      return result;
    },

    pick: (data, keys) => {
      const result = {};
      for (const key of keys) {
        if (key in data) {
          result[key] = data[key];
        }
      }
      return result;
    },

    omit: (data, keys) => {
      const keysSet = new Set(keys);
      const result = {};
      for (const [key, value] of Object.entries(data)) {
        if (!keysSet.has(key)) {
          result[key] = value;
        }
      }
      return result;
    },

    rename: (data, mapping) => {
      const result = {};
      for (const [key, value] of Object.entries(data)) {
        const newKey = mapping[key] || key;
        result[newKey] = value;
      }
      return result;
    },
  };
};

describe('CSV Exporter Tests', () => {
  let exporter;

  beforeEach(() => {
    exporter = createCSVExporter();
  });

  it('should export basic data', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];

    const csv = exporter.export(data);

    expect(csv).toContain('name,age');
    expect(csv).toContain('Alice,30');
  });

  it('should escape special characters', () => {
    const data = [{ text: 'Hello, "World"' }];

    const csv = exporter.export(data);

    expect(csv).toContain('"Hello, ""World"""');
  });

  it('should use custom columns', () => {
    const data = [{ a: 1, b: 2, c: 3 }];

    const csv = exporter.export(data, { columns: ['a', 'c'] });

    expect(csv).toBe('a,c\n1,3');
  });
});

describe('CSV Importer Tests', () => {
  let importer;

  beforeEach(() => {
    importer = createCSVImporter();
  });

  it('should import basic CSV', () => {
    const csv = 'name,age\nAlice,30\nBob,25';

    const data = importer.import(csv);

    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Alice');
    expect(data[0].age).toBe('30');
  });

  it('should handle quoted values', () => {
    const csv = 'text\n"Hello, World"';

    const data = importer.import(csv);

    expect(data[0].text).toBe('Hello, World');
  });

  it('should validate CSV', () => {
    const invalid = 'a,b,c\n1,2';
    const result = importer.validate(invalid);

    expect(result.valid).toBe(false);
  });
});

describe('JSON Exporter/Importer Tests', () => {
  it('should export JSON', () => {
    const exporter = createJSONExporter();
    const data = { name: 'Test', value: 42 };

    const json = exporter.export(data);

    expect(JSON.parse(json)).toEqual(data);
  });

  it('should export NDJSON', () => {
    const exporter = createJSONExporter();
    const data = [{ a: 1 }, { a: 2 }];

    const ndjson = exporter.exportNDJSON(data);

    expect(ndjson.split('\n')).toHaveLength(2);
  });

  it('should import NDJSON', () => {
    const importer = createJSONImporter();
    const ndjson = '{"a":1}\n{"a":2}';

    const data = importer.importNDJSON(ndjson);

    expect(data).toHaveLength(2);
  });
});

describe('Data Transformer Tests', () => {
  let transformer;

  beforeEach(() => {
    transformer = createDataTransformer();
  });

  it('should flatten nested objects', () => {
    const data = { user: { name: 'Alice', address: { city: 'NYC' } } };

    const flat = transformer.flatten(data);

    expect(flat['user.name']).toBe('Alice');
    expect(flat['user.address.city']).toBe('NYC');
  });

  it('should unflatten objects', () => {
    const flat = { 'a.b.c': 1, 'a.d': 2 };

    const nested = transformer.unflatten(flat);

    expect(nested.a.b.c).toBe(1);
    expect(nested.a.d).toBe(2);
  });

  it('should pick keys', () => {
    const data = { a: 1, b: 2, c: 3 };

    const picked = transformer.pick(data, ['a', 'c']);

    expect(picked).toEqual({ a: 1, c: 3 });
  });

  it('should omit keys', () => {
    const data = { a: 1, b: 2, c: 3 };

    const omitted = transformer.omit(data, ['b']);

    expect(omitted).toEqual({ a: 1, c: 3 });
  });

  it('should rename keys', () => {
    const data = { firstName: 'John' };

    const renamed = transformer.rename(data, { firstName: 'name' });

    expect(renamed.name).toBe('John');
  });
});
