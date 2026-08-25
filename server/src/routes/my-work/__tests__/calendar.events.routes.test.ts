import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// FIX-5 (Day 3 acceptance): process.cwd() ties this test to whatever directory the
// runner was invoked from — it breaks when vitest runs from a worktree root that
// differs from the repo checkout layout. __dirname is stable regardless of cwd.
const source = fs.readFileSync(path.resolve(__dirname, '../calendar.routes.ts'), 'utf8');

describe('calendar event route security contract', () => {
  it('scopes event reads by tenant and overlap, and redacts foreign busy titles server-side', () => {
    expect(source).toContain('e.organization_id = ?');
    expect(source).toContain('e.start_at < ? AND e.end_at >= ?');
    // FIX-1 (Day 3 acceptance): the inline 'Zajęte' literal is now a
    // documented constant (server has no i18n mechanism — see the comment
    // above FOREIGN_BUSY_EVENT_TITLE in calendar.routes.ts).
    expect(source).toContain('const FOREIGN_BUSY_EVENT_TITLE = ');
    expect(source).toContain('foreignBusy ? FOREIGN_BUSY_EVENT_TITLE : row.title');
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
