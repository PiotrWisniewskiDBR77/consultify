import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { type ParsedIntent, parseIntent } from '../intentParser.js';

describe('IntentParser', () => {
  it('"Create a new table for leads" → create_table, confidence ≥ 0.9', () => {
    const result = parseIntent('Create a new table for leads');
    expect(result.intent).toBe('create_table');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"Add a column status" → add_field, confidence ≥ 0.9', () => {
    const result = parseIntent('Add a column status');
    expect(result.intent).toBe('add_field');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"Build a CRM with leads and contacts" → create_tables', () => {
    const result = parseIntent('Build a CRM with leads and contacts');
    expect(result.intent).toBe('create_tables');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"Delete a field email" → remove_field', () => {
    const result = parseIntent('Delete a field email');
    expect(result.intent).toBe('remove_field');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"Describe the table" → describe_schema', () => {
    const result = parseIntent('Describe the table');
    expect(result.intent).toBe('describe_schema');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('"Add some sample data" → seed_records', () => {
    const result = parseIntent('Add some sample data');
    expect(result.intent).toBe('seed_records');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('unknown input → fallback with lower confidence', () => {
    const result = parseIntent('xyzzy foobar baz');
    expect(result.confidence).toBeLessThan(0.9);
  });

  it('extracts table name entity from "Create a table called Leads"', () => {
    const result = parseIntent('Create a table called Leads');
    expect(result.entities.tableName).toBeDefined();
    expect(result.entities.tableName).toContain('Leads');
  });

  it('extracts field name entity from "Add a field called email"', () => {
    const result = parseIntent('Add a field called email');
    expect(result.entities.fieldName).toBeDefined();
  });

  it('empty input returns low-confidence describe_schema', () => {
    const result = parseIntent('');
    expect(result.intent).toBe('describe_schema');
    expect(result.confidence).toBeLessThanOrEqual(0.3);
  });

  it('preserves rawInput', () => {
    const msg = 'Create a new table for leads';
    const result = parseIntent(msg);
    expect(result.rawInput).toBe(msg);
  });

  it('"Modify a field type" → modify_field', () => {
    const result = parseIntent('Modify a field type');
    expect(result.intent).toBe('modify_field');
  });

  it('"Add a new kanban view" → create_view', () => {
    const result = parseIntent('Add a new kanban view');
    expect(result.intent).toBe('create_view');
  });

  it('"Suggest improvements" → suggest_improvement', () => {
    const result = parseIntent('Suggest improvements to my table');
    expect(result.intent).toBe('suggest_improvement');
  });

  it('fuzzy fallback with tableId context prefers add_field for "kolumna"', () => {
    const result = parseIntent('potrzebuję nową kolumnę', { tableId: 'tbl-1' });
    expect(result.intent).toBe('add_field');
  });
});
