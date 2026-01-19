/**
 * CSV Parser Tests
 * Tests for CSV parsing and generation
 *
 * @module tests/csv/csv-parser.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// CSV Parser
const createCSVParser = (options = {}) => {
  const { delimiter = ',', quote = '"', newline = '\n', header = true } = options;

  const parseField = (field) => {
    field = field.trim();

    // Remove quotes
    if (field.startsWith(quote) && field.endsWith(quote)) {
      field = field.slice(1, -1).replace(new RegExp(quote + quote, 'g'), quote);
    }

    // Try to convert to number
    if (/^-?\d+(\.\d+)?$/.test(field)) {
      return parseFloat(field);
    }

    // Boolean
    if (field.toLowerCase() === 'true') return true;
    if (field.toLowerCase() === 'false') return false;

    return field;
  };

  const parseLine = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === quote) {
        if (inQuotes && line[i + 1] === quote) {
          current += quote;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        fields.push(parseField(current));
        current = '';
      } else {
        current += char;
      }
    }

    fields.push(parseField(current));
    return fields;
  };

  return {
    parse: (csv) => {
      const lines = csv.split(newline).filter((l) => l.trim());

      if (lines.length === 0) return [];

      if (header) {
        const headers = parseLine(lines[0]);
        return lines.slice(1).map((line) => {
          const values = parseLine(line);
          const obj = {};
          headers.forEach((h, i) => {
            obj[h] = values[i];
          });
          return obj;
        });
      }

      return lines.map(parseLine);
    },

    parseStream: async function* (chunks) {
      let buffer = '';
      let headers = null;

      for await (const chunk of chunks) {
        buffer += chunk;
        const lines = buffer.split(newline);
        buffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;

          if (header && !headers) {
            headers = parseLine(line);
            continue;
          }

          const values = parseLine(line);

          if (header && headers) {
            const obj = {};
            headers.forEach((h, i) => {
              obj[h] = values[i];
            });
            yield obj;
          } else {
            yield values;
          }
        }
      }
    },
  };
};

// CSV Generator
const createCSVGenerator = (options = {}) => {
  const { delimiter = ',', quote = '"', newline = '\n' } = options;

  const escapeField = (value) => {
    if (value === null || value === undefined) return '';

    const str = String(value);

    if (str.includes(quote) || str.includes(delimiter) || str.includes('\n')) {
      return quote + str.replace(new RegExp(quote, 'g'), quote + quote) + quote;
    }

    return str;
  };

  return {
    generate: (data, columns = null) => {
      if (data.length === 0) return '';

      const keys = columns || Object.keys(data[0]);
      const lines = [];

      // Header
      lines.push(keys.map(escapeField).join(delimiter));

      // Data rows
      for (const row of data) {
        lines.push(keys.map((k) => escapeField(row[k])).join(delimiter));
      }

      return lines.join(newline);
    },

    generateRow: (values) => {
      return values.map(escapeField).join(delimiter);
    },

    toBlob: (csv) => {
      return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    },
  };
};

// CSV Validator
const createCSVValidator = () => {
  return {
    validate: (csv, schema) => {
      const errors = [];
      const parser = createCSVParser();
      const data = parser.parse(csv);

      data.forEach((row, rowIndex) => {
        for (const [field, rules] of Object.entries(schema)) {
          const value = row[field];

          if (rules.required && (value === undefined || value === '')) {
            errors.push({ row: rowIndex, field, message: 'Required field missing' });
          }

          if (rules.type && value !== undefined && value !== '') {
            const actualType = typeof value;
            if (actualType !== rules.type) {
              errors.push({
                row: rowIndex,
                field,
                message: `Expected ${rules.type}, got ${actualType}`,
              });
            }
          }

          if (rules.pattern && typeof value === 'string') {
            if (!rules.pattern.test(value)) {
              errors.push({ row: rowIndex, field, message: 'Pattern mismatch' });
            }
          }

          if (rules.enum && !rules.enum.includes(value)) {
            errors.push({
              row: rowIndex,
              field,
              message: `Value must be one of: ${rules.enum.join(', ')}`,
            });
          }
        }
      });

      return { valid: errors.length === 0, errors, rowCount: data.length };
    },
  };
};

describe('CSV Parser Tests', () => {
  let parser;

  beforeEach(() => {
    parser = createCSVParser();
  });

  it('should parse simple CSV', () => {
    const csv = 'name,age\nJohn,30\nJane,25';
    const result = parser.parse(csv);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('John');
    expect(result[0].age).toBe(30);
  });

  it('should handle quoted fields', () => {
    const csv = 'name,description\nTest,"Hello, World"';
    const result = parser.parse(csv);

    expect(result[0].description).toBe('Hello, World');
  });

  it('should handle escaped quotes', () => {
    const csv = 'text\n"He said ""Hello"""';
    const result = parser.parse(csv);

    expect(result[0].text).toBe('He said "Hello"');
  });

  it('should convert types', () => {
    const csv = 'num,bool\n42,true';
    const result = parser.parse(csv);

    expect(result[0].num).toBe(42);
    expect(result[0].bool).toBe(true);
  });

  it('should parse without header', () => {
    const parser = createCSVParser({ header: false });
    const csv = 'John,30\nJane,25';
    const result = parser.parse(csv);

    expect(result[0]).toEqual(['John', 30]);
  });
});

describe('CSV Generator Tests', () => {
  let generator;

  beforeEach(() => {
    generator = createCSVGenerator();
  });

  it('should generate CSV', () => {
    const data = [
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25 },
    ];

    const csv = generator.generate(data);

    expect(csv).toContain('name,age');
    expect(csv).toContain('John,30');
  });

  it('should escape special characters', () => {
    const data = [{ text: 'Hello, World' }];
    const csv = generator.generate(data);

    expect(csv).toContain('"Hello, World"');
  });

  it('should escape quotes', () => {
    const data = [{ text: 'Say "Hi"' }];
    const csv = generator.generate(data);

    expect(csv).toContain('"Say ""Hi"""');
  });

  it('should use specified columns', () => {
    const data = [{ a: 1, b: 2, c: 3 }];
    const csv = generator.generate(data, ['a', 'c']);

    expect(csv).not.toContain('b');
  });
});

describe('CSV Validator Tests', () => {
  let validator;

  beforeEach(() => {
    validator = createCSVValidator();
  });

  it('should validate required fields', () => {
    const csv = 'name,age\n,30';
    const schema = { name: { required: true } };

    const result = validator.validate(csv, schema);

    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('name');
  });

  it('should validate types', () => {
    const csv = 'count\nabc';
    const schema = { count: { type: 'number' } };

    const result = validator.validate(csv, schema);

    expect(result.valid).toBe(false);
  });

  it('should validate enum', () => {
    const csv = 'status\ninvalid';
    const schema = { status: { enum: ['active', 'inactive'] } };

    const result = validator.validate(csv, schema);

    expect(result.valid).toBe(false);
  });

  it('should pass valid data', () => {
    const csv = 'name,status\nJohn,active';
    const schema = {
      name: { required: true, type: 'string' },
      status: { enum: ['active', 'inactive'] },
    };

    const result = validator.validate(csv, schema);

    expect(result.valid).toBe(true);
  });
});
