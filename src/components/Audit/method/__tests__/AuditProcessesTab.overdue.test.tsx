/**
 * AuditProcessesTab — overdue "Termin" signal (expert panel gap pack,
 * 2026-08-26, item 4): "na liście sesji trzy z sześciu są po terminie i nic
 * tego nie pokazuje". Behind `ff_auditsScaleAndPolish` (default OFF,
 * fail-closed) — see `src/utils/auditsScaleAndPolishFlag.ts`.
 *
 * Coverage:
 *   * Flag OFF (default) → plain formatted date, no "Po terminie" chip
 *     (byte-identical to before this pack).
 *   * Flag ON → a past-due, non-closed program shows the "Po terminie"
 *     chip; a past-due but `closed` program does NOT (finished work isn't a
 *     risk); a future-due program shows the plain date.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { AuditProcessesTab } from '../tabs/AuditProcessesTab';
import type { AuditProgramSummary } from '../auditsMethodApi';

function makeProgram(overrides: Partial<AuditProgramSummary>): AuditProgramSummary {
  return {
    id: 'prog-1',
    name: 'Q3 Compliance Audit',
    packId: 'pack-1',
    packTitle: null,
    packVersion: null,
    lifecycleState: 'fieldwork',
    applicableCriteria: 10,
    concludedCriteria: 4,
    openFindings: 2,
    leadAuditorId: 'u1',
    leadAuditorName: null,
    plannedStart: '2026-01-01',
    plannedEnd: '2026-02-01',
    updatedAt: '2026-08-05',
    ...overrides,
  };
}

describe('AuditProcessesTab — overdue "Termin" signal (ff_auditsScaleAndPolish)', () => {
  afterEach(() => {
    window.localStorage.removeItem('ff.audits_scale_and_polish');
  });

  it('flag OFF (default): renders the plain date, no "Po terminie" chip', async () => {
    const program = makeProgram({ plannedEnd: '2020-01-01', lifecycleState: 'fieldwork' });
    render(
      <AuditProcessesTab
        programs={[program]}
        loading={false}
        error={null}
        onRetry={() => {}}
        isPolish={true}
        onProgramChanged={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit')).toBeInTheDocument());
    expect(screen.queryByText('Po terminie')).toBeNull();
  });

  it('flag ON: an overdue, non-closed program shows the "Po terminie" chip', async () => {
    window.localStorage.setItem('ff.audits_scale_and_polish', '1');
    const program = makeProgram({ plannedEnd: '2020-01-01', lifecycleState: 'fieldwork' });
    render(
      <AuditProcessesTab
        programs={[program]}
        loading={false}
        error={null}
        onRetry={() => {}}
        isPolish={true}
        onProgramChanged={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit')).toBeInTheDocument());
    expect(screen.getByText('Po terminie')).toBeInTheDocument();
  });

  it('flag ON: an overdue but CLOSED program does not show the chip (finished, not a risk)', async () => {
    window.localStorage.setItem('ff.audits_scale_and_polish', '1');
    const program = makeProgram({ plannedEnd: '2020-01-01', lifecycleState: 'closed' });
    render(
      <AuditProcessesTab
        programs={[program]}
        loading={false}
        error={null}
        onRetry={() => {}}
        isPolish={true}
        onProgramChanged={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit')).toBeInTheDocument());
    expect(screen.queryByText('Po terminie')).toBeNull();
  });

  it('flag ON: a future due date shows the plain date, not the chip', async () => {
    window.localStorage.setItem('ff.audits_scale_and_polish', '1');
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const program = makeProgram({ plannedEnd: farFuture, lifecycleState: 'fieldwork' });
    render(
      <AuditProcessesTab
        programs={[program]}
        loading={false}
        error={null}
        onRetry={() => {}}
        isPolish={true}
        onProgramChanged={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit')).toBeInTheDocument());
    expect(screen.queryByText('Po terminie')).toBeNull();
  });
});
