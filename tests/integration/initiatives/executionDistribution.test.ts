/**
 * M14/F6 (6.2) — executionDistributionService (real email-worker).
 *
 * Verifies that processReportDistributions:
 *   1. sends one email per undelivered distribution row,
 *   2. settles each row (delivered_at set, delivery_status = 'sent'),
 *   3. is fail-safe: a single send failure does not stop the rest of the batch.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

// ------------------------------------------------------------------
// Mock in-memory DB state (hoisted so vi.mock factories can see it)
// ------------------------------------------------------------------
const state = vi.hoisted(() => ({
  rows: [] as Row[], // joined report_distributions + status_reports rows
  emails: [] as Array<{ to: string; subject: string; html?: string }>,
  // recipient_email -> true means emailService.send should throw for that addr
  failFor: new Set<string>(),
}));

// ------------------------------------------------------------------
// Mock emailService
// ------------------------------------------------------------------
vi.mock('../../../server/src/services/emailService.js', () => {
  const send = vi.fn(async (opts: { to: string; subject: string; html?: string }) => {
    if (state.failFor.has(opts.to)) {
      throw new Error(`SMTP refused for ${opts.to}`);
    }
    state.emails.push(opts);
    return true;
  });
  return { default: { send }, send };
});

// ------------------------------------------------------------------
// Mock DbPromise — only the SQL shapes this service uses
// ------------------------------------------------------------------
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM report_distributions')) {
      const orgId = params[0];
      return state.rows.filter((r) => r.organization_id === orgId && r.delivered_at == null);
    }
    return [];
  },
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('UPDATE report_distributions')) {
      const [status, distributionId, orgId] = params;
      const row = state.rows.find((r) => r.id === distributionId && r.organization_id === orgId);
      if (row) {
        row.delivered_at = '2026-06-23T00:00:00Z';
        row.delivery_status = status;
        row.sent_at = '2026-06-23T00:00:00Z';
      }
      return { success: true, changes: row ? 1 : 0 };
    }
    return { success: true, changes: 0 };
  },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ------------------------------------------------------------------

import { processReportDistributions } from '../../../server/src/services/executionDistributionService.js';

const ORG = 'org-1';

function seedRow(id: string, email: string | null, overrides: Row = {}): Row {
  return {
    id,
    report_id: `report-${id}`,
    recipient_email: email,
    organization_id: ORG,
    period_label: 'Week 52',
    period_type: 'WEEKLY',
    overall_status: 'GREEN',
    executive_summary: 'All good.',
    initiative_id: 'init-1',
    delivered_at: null,
    delivery_status: null,
    created_at: '2026-06-20T00:00:00Z',
    ...overrides,
  };
}

describe('executionDistributionService.processReportDistributions', () => {
  beforeEach(() => {
    state.rows = [];
    state.emails = [];
    state.failFor = new Set();
    vi.clearAllMocks();
  });

  it('sends an email for every undelivered distribution and settles each row', async () => {
    state.rows = [
      seedRow('d1', 'a@example.com'),
      seedRow('d2', 'b@example.com'),
      seedRow('d3', 'c@example.com'),
    ];

    const result = await processReportDistributions(ORG);

    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.processed).toBe(3);

    // one email per recipient
    expect(state.emails.map((e) => e.to).sort()).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com',
    ]);

    // every row settled
    for (const r of state.rows) {
      expect(r.delivered_at).not.toBeNull();
      expect(r.delivery_status).toBe('sent');
    }
  });

  it('is fail-safe: one failed send does not block the rest of the batch', async () => {
    state.failFor.add('boom@example.com');
    state.rows = [
      seedRow('d1', 'ok1@example.com'),
      seedRow('d2', 'boom@example.com'),
      seedRow('d3', 'ok2@example.com'),
    ];

    const result = await processReportDistributions(ORG);

    expect(result.processed).toBe(3);
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(1);

    // the two healthy recipients still got their email
    expect(state.emails.map((e) => e.to).sort()).toEqual(['ok1@example.com', 'ok2@example.com']);

    const d2 = state.rows.find((r) => r.id === 'd2')!;
    expect(d2.delivery_status).toBe('failed');
    expect(d2.delivered_at).not.toBeNull();

    const d1 = state.rows.find((r) => r.id === 'd1')!;
    expect(d1.delivery_status).toBe('sent');
  });

  it('skips rows without a recipient email and settles them as failed', async () => {
    state.rows = [seedRow('d1', null), seedRow('d2', 'ok@example.com')];

    const result = await processReportDistributions(ORG);

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(1);
    expect(state.emails).toHaveLength(1);

    const d1 = state.rows.find((r) => r.id === 'd1')!;
    expect(d1.delivery_status).toBe('failed');
  });

  it('only processes the requested organization and undelivered rows', async () => {
    state.rows = [
      seedRow('d1', 'a@example.com'),
      seedRow('d2', 'b@example.com', { organization_id: 'org-2' }),
      seedRow('d3', 'c@example.com', { delivered_at: '2026-06-22T00:00:00Z' }),
    ];

    const result = await processReportDistributions(ORG);

    expect(result.processed).toBe(1);
    expect(state.emails.map((e) => e.to)).toEqual(['a@example.com']);
  });
});
