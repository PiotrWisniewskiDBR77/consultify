/**
 * @vitest-environment jsdom
 *
 * AuditTrailPanel — authenticated revision-history fetch, success + error
 * paths, and the legacy-mode hide gate.
 *
 * Regression coverage for M08 audit finding "AuditTrailPanel → 404": the panel
 * must call the real mount (`/api/table-platform/tables/:id/audit`) with an
 * Authorization header (via getHeaders()), not the nonexistent `/api/tables/:id/audit`.
 *
 * Also covers the follow-up decision: `tableId` passed by legacy (non
 * table-platform) idea-tables is the idea id, not a real `tp_tables.id`, so
 * the audit endpoint always 403s for those. Until the caller (IdeaTableTool.tsx)
 * is updated to pass the real platform table id, the panel must stay hidden
 * (`isPlatformTable` defaults to `false`) rather than show a dead affordance.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuditTrailPanel } from '../AuditTrailPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

const getHeadersMock = vi.hoisted(() =>
  vi.fn(() => ({ Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }))
);

vi.mock('@/services/api', () => ({
  getHeaders: () => getHeadersMock(),
}));

const fetchMock = vi.fn();

describe('AuditTrailPanel', () => {
  afterEach(() => {
    fetchMock.mockReset();
    getHeadersMock.mockClear();
  });

  it('fetches the real table-platform audit route with an Authorization header (platform mode)', async () => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'rev-1',
          recordId: 'rec-1',
          userName: 'Ada Lovelace',
          action: 'updated',
          changes: [],
          timestamp: new Date().toISOString(),
        },
      ],
    });

    render(
      <AuditTrailPanel open onClose={vi.fn()} recordId="rec-1" tableId="tbl-123" isPlatformTable />
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    // Must hit the real mount, never the nonexistent bare `/api/tables/:id/audit`.
    expect(url).toBe('/api/table-platform/tables/tbl-123/audit?recordId=rec-1&limit=20&offset=0');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');

    await waitFor(() => expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument());
  });

  it('shows the empty state instead of crashing when the request fails (e.g. 404)', async () => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    render(
      <AuditTrailPanel open onClose={vi.fn()} recordId="rec-1" tableId="tbl-123" isPlatformTable />
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/No revision history/i)).toBeInTheDocument());
  });

  it('shows the select-a-record empty state when no recordId is set (platform mode)', () => {
    global.fetch = fetchMock as unknown as typeof fetch;
    render(
      <AuditTrailPanel open onClose={vi.fn()} recordId={null} tableId="tbl-123" isPlatformTable />
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Select a record/i).length).toBeGreaterThan(0);
  });

  it('renders nothing and never fetches in legacy mode (isPlatformTable defaults to false)', () => {
    global.fetch = fetchMock as unknown as typeof fetch;
    const { container } = render(
      <AuditTrailPanel open onClose={vi.fn()} recordId="rec-1" tableId="idea-123" />
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when isPlatformTable is explicitly false, even if open with a recordId', () => {
    global.fetch = fetchMock as unknown as typeof fetch;
    const { container } = render(
      <AuditTrailPanel
        open
        onClose={vi.fn()}
        recordId="rec-1"
        tableId="idea-123"
        isPlatformTable={false}
      />
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
