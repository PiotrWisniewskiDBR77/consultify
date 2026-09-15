import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  renderPmoWeeklyMarkdown,
  renderSponsorOnePagerMarkdown,
  renderSteeringMarkdown,
} from '../programManagementReportsService.js';

const axis = (pct: number | null) => ({ pct, dataQuality: 'ok', flags: [] });
const threeAxis = {
  scope: { level: 'organization' },
  asOf: '2026-09-15',
  program: { rag: 'GREEN', T: axis(80), Z: axis(70), W: axis(60) },
  rows: [],
};

const visiblePolish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|\b(?:brak|stan|zadania|ryzyka|zmiany|obciążenia|właściciel|termin)\b/i;

describe('M6 / DEC-461 — PM report packs are English-first', () => {
  it('renders all three persisted markdown packs without Polish UI prose', () => {
    const sponsor = renderSponsorOnePagerMarkdown({
      threeAxis: threeAxis as never,
      valueSplit: null,
      topAlerts: [],
      pendingDecisions: [],
    });
    const steering = renderSteeringMarkdown({
      threeAxis: threeAxis as never,
      risks: [],
      scopeChanges: null,
    });
    const weekly = renderPmoWeeklyMarkdown({
      taskStats: { doneCount: 0, doneOnTime: 0, openTotal: 0, openLate: 0 },
      capacity: {
        users: [],
        summary: { totalCapacity: 0, totalAllocated: 0, totalBacklog: 0, avgUtilization: 0 },
        windowStart: '',
        windowEnd: '',
      } as never,
      overloads: [],
      cycleTime: [],
    });

    const rendered = [sponsor, steering, weekly]
      .flatMap((sections) => Object.values(sections))
      .join('\n');
    expect(rendered).toContain('Program verdict');
    expect(rendered).toContain('Open risks');
    expect(rendered).toContain('Completed on time');
    expect(rendered).not.toMatch(visiblePolish);
  });

  it('returns the canonical English coded error when criteria miss programId', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'server/src/routes/audits/criteria.routes.ts'),
      'utf8'
    );
    expect(source).toContain("error: 'AUDIT_PROGRAM_ID_REQUIRED'");
    expect(source).not.toContain("error: 'Parametr programId jest wymagany'");
  });
});
