/**
 * P1 · RP1b — skaza 2 przejazdu kanonu Z-29: kolumny Status/Częstotliwość
 * pokazywały surowe kody enuma (`PUBLISHED`, `WEEKLY`, `ON_DEMAND`,
 * `APPROVED`). Ten test broni SŁOWNIKA, nie renderu — render broni
 * `InitiativeWorkReportView.kanon.test.tsx`.
 *
 * Mutacja: usunięcie wpisu `PUBLISHED` z mapy `workReportRunStatusLabel`
 * zamienia asercję „Published" na czerwone (fallback dałby „Published" przez
 * `humanizeWorkReportCode`, dlatego sprawdzamy TON — `success` — którego
 * humanizacja nie zna i oddałaby `neutral`).
 */
import { describe, expect, it } from 'vitest';

import {
  failedWorkReportDeliveryCount,
  flattenWorkReportDeliveries,
  humanizeWorkReportCode,
  workReportCadenceLabel,
  workReportRecipientStatusLabel,
  workReportRecipientStatusTone,
  workReportRunStatusLabel,
  workReportRunStatusTone,
} from '../workReportLabels';

const t = ((_key: string, fallback?: string) => fallback ?? _key) as any;

describe('work report labels', () => {
  it('translates every run status the engine can emit', () => {
    const statuses = [
      'DRAFT',
      'VALIDATED',
      'FROZEN',
      'APPROVED',
      'PUBLISHED',
      'FAILED',
      'SUPERSEDED',
    ];
    for (const status of statuses) {
      const label = workReportRunStatusLabel(t, status);
      expect(label).not.toBe(status);
      expect(label).not.toMatch(/[A-Z]{2,}_/);
    }
    expect(workReportRunStatusLabel(t, 'PUBLISHED')).toBe('Published');
    expect(workReportRunStatusLabel(t, 'FROZEN')).toBe('Frozen — awaiting approval');
  });

  it('keeps crimson for the critical state only', () => {
    expect(workReportRunStatusTone('PUBLISHED')).toBe('success');
    expect(workReportRunStatusTone('APPROVED')).toBe('neutral');
    expect(workReportRunStatusTone('FROZEN')).toBe('neutral');
    expect(workReportRunStatusTone('FAILED')).toBe('danger');
    expect(workReportRunStatusTone('SOMETHING_NEW')).toBe('neutral');
  });

  it('translates cadence codes', () => {
    expect(workReportCadenceLabel(t, 'ON_DEMAND')).toBe('On demand');
    expect(workReportCadenceLabel(t, 'WEEKLY')).toBe('Weekly');
    expect(workReportCadenceLabel(t, 'MONTHLY')).toBe('Monthly');
  });

  it('translates recipient delivery status with tones', () => {
    expect(workReportRecipientStatusLabel(t, 'DELIVERED')).toBe('Delivered');
    expect(workReportRecipientStatusTone('DELIVERED')).toBe('success');
    expect(workReportRecipientStatusTone('FAILED')).toBe('danger');
    expect(workReportRecipientStatusTone('PENDING')).toBe('neutral');
  });

  it('humanizes an unknown code instead of showing UPPER_SNAKE', () => {
    expect(humanizeWorkReportCode('WEEKLY_TEAM_UPDATE')).toBe('Weekly team update');
    expect(humanizeWorkReportCode('')).toBe('—');
  });

  it('flattens delivery attempts to one row per recipient, newest attempt winning', () => {
    const run = {
      audience: ['a@x.pl', 'b@x.pl', 'c@x.pl'],
      deliveryAttempts: [
        {
          receiptId: 'r1',
          recipients: [
            {
              address: 'a@x.pl',
              status: 'FAILED',
              attempts: 1,
              lastAttemptAt: '2026-09-12T10:00:00.000Z',
              lastError: 'mailbox full',
            },
            {
              address: 'b@x.pl',
              status: 'DELIVERED',
              attempts: 1,
              lastAttemptAt: '2026-09-12T10:00:00.000Z',
              lastError: null,
            },
          ],
        },
        {
          receiptId: 'r2',
          recipients: [
            {
              address: 'a@x.pl',
              status: 'DELIVERED',
              attempts: 2,
              lastAttemptAt: '2026-09-13T08:00:00.000Z',
              lastError: null,
            },
          ],
        },
      ],
    };
    const rows = flattenWorkReportDeliveries(run);
    expect(rows).toHaveLength(3);
    const a = rows.find((row) => row.address === 'a@x.pl');
    expect(a?.status).toBe('DELIVERED');
    expect(a?.attempts).toBe(2);
    /* Adresat z zamrożonej listy, do którego nie było ŻADNEJ próby. */
    expect(rows.find((row) => row.address === 'c@x.pl')?.status).toBe('PENDING');
    expect(failedWorkReportDeliveryCount(rows)).toBe(0);
  });

  it('counts failed recipients for the retry action', () => {
    const rows = flattenWorkReportDeliveries({
      audience: ['a@x.pl'],
      deliveryAttempts: [
        {
          receiptId: 'r1',
          recipients: [
            {
              address: 'a@x.pl',
              status: 'FAILED',
              attempts: 3,
              lastAttemptAt: '2026-09-12T10:00:00.000Z',
              lastError: '550 rejected',
            },
          ],
        },
      ],
    });
    expect(failedWorkReportDeliveryCount(rows)).toBe(1);
    expect(rows[0].lastError).toBe('550 rejected');
  });

  it('survives a run with no delivery data at all', () => {
    expect(flattenWorkReportDeliveries({})).toEqual([]);
    expect(flattenWorkReportDeliveries(null)).toEqual([]);
  });
});
