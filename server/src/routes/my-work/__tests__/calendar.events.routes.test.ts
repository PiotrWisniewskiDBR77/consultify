import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'server/src/routes/my-work/calendar.routes.ts'),
  'utf8'
);

describe('calendar event route security contract', () => {
  it('scopes event reads by tenant and overlap, and redacts foreign busy titles server-side', () => {
    expect(source).toContain('e.organization_id = ?');
    expect(source).toContain('e.start_at < ? AND e.end_at >= ?');
    expect(source).toContain("foreignBusy ? 'Zajęte' : row.title");
  });

  it('takes owner and organization from authenticated context, never the request body', () => {
    expect(source).toContain('const userId = req.userId!');
    expect(source).toContain('const orgId = req.organizationId!');
    expect(source).not.toContain('req.body.organizationId');
    expect(source).not.toContain('req.body.ownerId');
  });

  it('validates duration and same-organization attendees', () => {
    expect(source).toContain('endAt must be later than startAt');
    expect(source).toContain('Every attendee must belong to this organization');
  });

  it('keeps recurrence columns null on event creation', () => {
    expect(source).toContain('recurrence_parent_id, created_by');
    expect(source).toContain('?, ?, NULL, NULL, ?, ${nowSql()}');
  });

  it('uses owner and tenant guards for update, soft delete, and reschedule', () => {
    expect(
      source.match(/WHERE id = \? AND organization_id = \? AND owner_id = \?/g)?.length
    ).toBeGreaterThanOrEqual(3);
    expect(source).toContain("SET status = 'cancelled'");
    expect(source).toContain("eventId.startsWith('event-')");
  });

  it('keeps task creation and removes the event 501 path', () => {
    expect(source).toContain("if (source === 'task')");
    expect(source).toContain("if (source === 'event')");
    expect(source.indexOf("if (source === 'event')")).toBeLessThan(
      source.indexOf('Creating ${source} events from calendar is not yet supported')
    );
  });
});
