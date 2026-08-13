/**
 * @vitest-environment jsdom
 *
 * DrdRolesPanel — component-level coverage (agent S2, CEL 3, 2026-08-13).
 * Mocks `@/method-core/api/methodCoreRolesApi` (unit-level; the real HTTP
 * path is proven server-side by
 * `server/src/method-core/__tests__/MethodSessionRoleService.http.integration.test.ts`
 * against real PostgreSQL). Covers:
 *  1. loading -> ready renders fetched roles/history/approval-trail.
 *  2. empty state text shows when a section has zero rows.
 *  3. error state shows the section's error message, not a blank table.
 *  4. client-side guard: granting 'approver' to yourself shows an inline
 *     error and never calls the API (server-side refusal is proven by the
 *     integration suite's hard rule #1 — this only checks the UI shortcut).
 *  5. send-back without a comment shows an inline error and never calls the API.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  listRoles: vi.fn(),
  roleHistory: vi.fn(),
  approvalTrail: vi.fn(),
  assignRole: vi.fn(),
  revokeRole: vi.fn(),
  sendBack: vi.fn(),
}));

vi.mock('@/method-core/api/methodCoreRolesApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreRolesApi')>(
    '@/method-core/api/methodCoreRolesApi'
  );
  return {
    ...actual,
    listRoles: hoisted.listRoles,
    roleHistory: hoisted.roleHistory,
    approvalTrail: hoisted.approvalTrail,
    assignRole: hoisted.assignRole,
    revokeRole: hoisted.revokeRole,
    sendBack: hoisted.sendBack,
  };
});

import { DrdRolesPanel } from '../DrdRolesPanel';

const SESSION_ID = 'session-1';
const CURRENT_USER = 'user-current';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.listRoles.mockResolvedValue([]);
  hoisted.roleHistory.mockResolvedValue([]);
  hoisted.approvalTrail.mockResolvedValue([]);
});

describe('DrdRolesPanel', () => {
  it('renders fetched roles, history and approval trail once loaded', async () => {
    hoisted.listRoles.mockResolvedValue([
      { sessionId: SESSION_ID, userId: 'user-owner', role: 'owner', createdAt: '2026-08-13T10:00:00Z' },
    ]);
    hoisted.roleHistory.mockResolvedValue([
      {
        id: 'ev-1',
        sessionId: SESSION_ID,
        userId: 'user-owner',
        role: 'owner',
        eventType: 'granted',
        actorUserId: 'user-owner',
        occurredAt: '2026-08-13T10:00:00Z',
      },
    ]);
    hoisted.approvalTrail.mockResolvedValue([
      {
        eventId: 'evt-1',
        sessionId: SESSION_ID,
        version: 3,
        type: 'DECISION_APPROVED',
        actorUserId: 'user-approver',
        occurredAt: '2026-08-13T12:00:00Z',
        rationale: 'Zatwierdzam.',
      },
    ]);

    render(<DrdRolesPanel sessionId={SESSION_ID} currentUserId={CURRENT_USER} />);

    await waitFor(() => expect(hoisted.listRoles).toHaveBeenCalledWith(SESSION_ID));
    // 'user-owner' legitimately appears twice (roles table + history table)
    // — assert presence, not uniqueness.
    await waitFor(() => expect(screen.getAllByText('user-owner').length).toBeGreaterThan(0));
    expect(screen.getByText('Zatwierdzono')).toBeInTheDocument();
    expect(screen.getByText('Zatwierdzam.')).toBeInTheDocument();
  });

  it('shows the empty state when there are no roles yet', async () => {
    render(<DrdRolesPanel sessionId={SESSION_ID} currentUserId={CURRENT_USER} />);
    await waitFor(() => expect(screen.getByText('Brak ról w tej sesji')).toBeInTheDocument());
  });

  it('shows an error state instead of a blank table when a fetch fails', async () => {
    hoisted.listRoles.mockRejectedValue(new Error('boom'));
    render(<DrdRolesPanel sessionId={SESSION_ID} currentUserId={CURRENT_USER} />);
    // All three StandardTable instances (roles/history/approval-trail) share
    // the same `error` state and each render their own error surface.
    await waitFor(() => expect(screen.getAllByText(/nie udało się wczytać/i).length).toBe(3));
  });

  it('refuses (client-side) to grant approver to yourself, without calling the API', async () => {
    render(<DrdRolesPanel sessionId={SESSION_ID} currentUserId={CURRENT_USER} />);
    await waitFor(() => expect(hoisted.listRoles).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Użytkownik (id)'), { target: { value: CURRENT_USER } });
    fireEvent.change(screen.getByLabelText('Rola'), { target: { value: 'approver' } });
    fireEvent.click(screen.getByText('Nadaj rolę'));

    await waitFor(() => expect(screen.getByText(/nie możesz nadać roli/i)).toBeInTheDocument());
    expect(hoisted.assignRole).not.toHaveBeenCalled();
  });

  it('refuses (client-side) to send back without a comment, without calling the API', async () => {
    render(<DrdRolesPanel sessionId={SESSION_ID} currentUserId={CURRENT_USER} />);
    await waitFor(() => expect(hoisted.listRoles).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Odeślij'));

    await waitFor(() => expect(screen.getByText(/komentarz jest wymagany/i)).toBeInTheDocument());
    expect(hoisted.sendBack).not.toHaveBeenCalled();
  });
});
