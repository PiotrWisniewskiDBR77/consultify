import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'server/migrations/20260827_calendar_events.sql'),
  'utf8'
);

describe('calendar_events migration contract', () => {
  it('is additive and idempotent by construction', () => {
    expect(source).toContain('CREATE TABLE IF NOT EXISTS calendar_events');
    expect(source.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(3);
    expect(source).not.toMatch(/\b(DROP|ALTER|INSERT|UPDATE|DELETE)\b/i);
  });

  it('keeps all 19 model columns including the reserved recurrence columns', () => {
    for (const column of [
      'id',
      'organization_id',
      'owner_id',
      'title',
      'description',
      'location',
      'start_at',
      'end_at',
      'all_day',
      'attendees_json',
      'visibility',
      'status',
      'related_type',
      'related_id',
      'recurrence_rule',
      'recurrence_parent_id',
      'created_by',
      'created_at',
      'updated_at',
    ])
      expect(source).toMatch(new RegExp(`\\b${column}\\b`));
  });
});
