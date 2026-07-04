/**
 * @vitest-environment jsdom
 *
 * ActivityFeed — authenticated audit fetch, success + error paths, and the
 * legacy-mode hide gate.
 *
 * Regression coverage for M08 audit finding "ActivityFeed → 401": the component
 * must use the shared `Api` client (which attaches the Authorization header via
 * getHeaders()) rather than a bare `fetch`, and must degrade gracefully (empty
 * state, no throw) when the request fails.
 *
 * Also covers the follow-up decision: `tableId` passed by legacy (non
 * table-platform) idea-tables is the idea id, not a real `tp_tables.id`, so
 * the audit endpoint always 403s for those. Until the caller (IdeaTableTool.tsx)
 * is updated to pass the real platform table id, the panel must stay hidden
 * (`isPlatformTable` defaults to `false`) rather than show a dead affordance.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ActivityFeed } from '../ActivityFeed';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

const apiGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  Api: { get: (...args: unknown[]) => apiGetMock(...args) },
}));

describe('ActivityFeed', () => {
  it('fetches via the authenticated Api client against the real table-platform audit route (platform mode)', async () => {
    apiGetMock.mockResolvedValueOnce({
      events: [
        {
          id: 'ev-1',
          event_type: 'create',
          entity_type: 'record',
          entity_id: 'rec-1',
          actor_name: 'Ada',
          metadata: {},
          created_at: new Date().toISOString(),
          time_group: 'today',
        },
      ],
    });

    render(<ActivityFeed open onClose={vi.fn()} tableId="tbl-123" isPlatformTable />);

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    const path = String(apiGetMock.mock.calls[0]?.[0] ?? '');
    // Must hit the real mount (`/api/table-platform/tables/:id/audit`), never the
    // nonexistent bare `/api/tables/:id/audit`.
    expect(path).toBe('/table-platform/tables/tbl-123/audit?limit=50');

    await waitFor(() => expect(screen.getByText(/Ada/)).toBeInTheDocument());
  });

  it('shows the empty state instead of crashing when the request fails (e.g. 401/403)', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('401 Unauthorized'));

    render(<ActivityFeed open onClose={vi.fn()} tableId="tbl-123" isPlatformTable />);

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/No activity yet/i)).toBeInTheDocument());
  });

  it('does not fetch when closed', () => {
    render(<ActivityFeed open={false} onClose={vi.fn()} tableId="tbl-123" isPlatformTable />);
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it('renders nothing and never fetches in legacy mode (isPlatformTable defaults to false)', () => {
    const { container } = render(<ActivityFeed open onClose={vi.fn()} tableId="idea-123" />);
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when isPlatformTable is explicitly false, even if open', () => {
    const { container } = render(
      <ActivityFeed open onClose={vi.fn()} tableId="idea-123" isPlatformTable={false} />
    );
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
