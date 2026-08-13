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
  finalizedBy: 'u1',
  finalizedByName: 'Ada Lovelace',
  finalizedAt: '2026-08-01',
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
});
