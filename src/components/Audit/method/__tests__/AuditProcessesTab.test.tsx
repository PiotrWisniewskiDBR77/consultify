/**
 * AuditProcessesTab — proves the `packTitleById`/`userNameById` name
 * resolution fix (DEC-2026-08-25-66, point 3 — "tables have too few
 * columns"). `GET /audits/programs` never sends `packTitle`/`leadAuditorName`
 * (`programService.ts` mapping only has `pack_id`/`lead_auditor_id`), so
 * those two columns silently rendered "—" for every row before this fix.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { AuditProcessesTab } from '../tabs/AuditProcessesTab';
import type { AuditProgramSummary } from '../auditsMethodApi';

const program: AuditProgramSummary = {
  id: 'prog-1',
  name: 'Q3 Compliance Audit',
  packId: 'pack-1',
  // Backend never actually fills these two — real API shape has them `null`.
  packTitle: null,
  packVersion: null,
  lifecycleState: 'fieldwork',
  applicableCriteria: 10,
  concludedCriteria: 4,
  openFindings: 2,
  leadAuditorId: 'u1',
  leadAuditorName: null,
  plannedStart: '2026-08-01',
  plannedEnd: '2026-09-01',
  updatedAt: '2026-08-05',
};

describe('AuditProcessesTab — pack/lead-auditor name resolution', () => {
  it('resolves the Pack and Lead auditor columns from the Hub-provided maps, not the always-null API fields', async () => {
    render(
      <AuditProcessesTab
        programs={[program]}
        loading={false}
        error={null}
        onRetry={() => {}}
        isPolish={false}
        onProgramChanged={() => {}}
        packTitleById={new Map([['pack-1', 'ISO 19011 Audit Pack v2']])}
        userNameById={new Map([['u1', 'Ada Lovelace']])}
      />
    );

    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit')).toBeInTheDocument());
    expect(screen.getByText('ISO 19011 Audit Pack v2')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('falls back to "—" (never crashes) when neither the map nor the API field has a value', async () => {
    render(
      <AuditProcessesTab
        programs={[program]}
        loading={false}
        error={null}
        onRetry={() => {}}
        isPolish={false}
        onProgramChanged={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit')).toBeInTheDocument());
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
