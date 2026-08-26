/**
 * AuditOutputsTab — Outputs surface.
 *
 * C6 (audyt jakości list, 2026-08-13): `contentHash` NIE jest informacją
 * pierwszego rzutu oka — musi żyć w panelu podglądu, nie w kolumnie głównej
 * tabeli. Ten test dowodzi obu połówek: hash nieobecny w tabeli głównej,
 * obecny dopiero po otwarciu podglądu wiersza (klik).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return { ...actual, listOutputs: vi.fn() };
});

import { AuditOutputsTab } from '../tabs/AuditOutputsTab';
import { listOutputs, type AuditOutputSummary } from '../auditsMethodApi';

const mockedListOutputs = vi.mocked(listOutputs);

const output: AuditOutputSummary = {
  id: 'out-1',
  programId: 'prog-1',
  programName: 'Q3 Compliance Audit',
  version: 1,
  title: 'Q3 Compliance Audit — Output v1',
  packVersion: 2,
  finalizedBy: 'u1',
  finalizedByName: 'Ada Lovelace',
  finalizedAt: '2026-08-01',
  supersededBy: null,
  supersededAt: null,
  contentHash: 'sha256:deadbeefcafef00d',
};

describe('AuditOutputsTab', () => {
  it('keeps contentHash out of the main table, and shows it only in the row preview', async () => {
    mockedListOutputs.mockResolvedValue({ items: [output], total: 1 });
    render(<AuditOutputsTab isPolish={false} />);

    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit — Output v1')).toBeInTheDocument());
    // Hash absent from the first-glance table.
    expect(screen.queryByText(output.contentHash!)).toBeNull();

    fireEvent.click(screen.getByText('Q3 Compliance Audit — Output v1'));

    // Hash appears once the preview panel is open.
    await waitFor(() => expect(screen.getByText(output.contentHash!)).toBeInTheDocument());
  });

  // DEC-2026-08-25-66, point 3 (too few columns / niczym się nie różniło od
  // Tools). `packVersion`/`supersededBy` are real fields `/api/audits/outputs`
  // already sends (`outputService.ts`) but the table never surfaced them.
  it('adds a real Pack version column and a Current/Superseded status column', async () => {
    mockedListOutputs.mockResolvedValue({ items: [output], total: 1 });
    render(<AuditOutputsTab isPolish={false} />);
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit — Output v1')).toBeInTheDocument());
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('marks a superseded Output distinctly instead of leaving it looking current', async () => {
    mockedListOutputs.mockResolvedValue({
      items: [{ ...output, supersededBy: 'out-2', supersededAt: '2026-08-15' }],
      total: 1,
    });
    render(<AuditOutputsTab isPolish={false} />);
    await waitFor(() => expect(screen.getByText('Superseded')).toBeInTheDocument());
  });

  it('resolves programName/finalizedByName from the Hub-provided maps when the API field is null', async () => {
    mockedListOutputs.mockResolvedValue({
      items: [{ ...output, programName: null, finalizedByName: null }],
      total: 1,
    });
    render(
      <AuditOutputsTab
        isPolish={false}
        programNameById={new Map([['prog-1', 'Q3 Compliance Audit (resolved)']])}
        userNameById={new Map([['u1', 'Ada Lovelace (resolved)']])}
      />
    );
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit (resolved)')).toBeInTheDocument());
    expect(screen.getByText('Ada Lovelace (resolved)')).toBeInTheDocument();
  });
});
