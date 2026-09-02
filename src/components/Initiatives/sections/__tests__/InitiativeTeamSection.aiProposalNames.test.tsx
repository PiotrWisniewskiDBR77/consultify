/**
 * @vitest-environment jsdom
 *
 * Rodzina "surowy identyfikator zamiast etykiety" (por. Finance base_period_id,
 * dyżur 2026-09-02). AI-owe propozycje zmian w zespole (dodaj/zaktualizuj/usuń)
 * przenoszą wyłącznie `userId` — panel musi pokazać nazwę użytkownika, nie
 * surowy identyfikator, gdy nazwa jest już dostępna po stronie klienta
 * (org directory z `useInitiativeContext().users`).
 *
 * Dowód mutacyjny: dwa rendery z tym samym userId, różną nazwą w źródle danych
 * (`users`) — wyświetlony tekst musi podążać za nazwą, nie zostać stały.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { InitiativeContextValue } from '../InitiativeContext';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(async (path: string) => {
      if (path.includes('/members')) return { members: [] };
      if (path.includes('/consultant-project-access')) return [];
      return {};
    }),
    post: vi.fn(async (path: string, body: any) => {
      if (path.startsWith('/ai/refine-text')) {
        return {
          text: JSON.stringify({
            add: [{ userId: 'usr-42', role: 'editor', reason: 'Domain expert' }],
            update: [],
            remove: [],
          }),
        };
      }
      return {};
    }),
    patch: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
}));

function makeContext(overrides: Partial<InitiativeContextValue>): InitiativeContextValue {
  return {
    initiative: { id: 'init-1', name: 'Test Initiative', projectId: 'proj-1' } as any,
    users: [],
    teamAiRequest: null,
    clearTeamAiRequest: vi.fn(),
    ...overrides,
  } as unknown as InitiativeContextValue;
}

async function renderWithUsers(users: any[]) {
  const { InitiativeContext } = await import('../InitiativeContext');
  const { InitiativeTeamSection } = await import('../InitiativeTeamSection');
  const ctx = makeContext({ users, teamAiRequest: { nonce: 1 } });
  return render(
    <InitiativeContext.Provider value={ctx}>
      <InitiativeTeamSection />
    </InitiativeContext.Provider>
  );
}

describe('InitiativeTeamSection — AI proposal shows names, not raw userId', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the proposed userId to the org-directory name (Anna Kowalska)', async () => {
    await renderWithUsers([
      { id: 'usr-42', firstName: 'Anna', lastName: 'Kowalska', email: 'anna@example.com' },
    ]);

    await waitFor(() => expect(screen.getByText('Anna Kowalska')).toBeTruthy());
    expect(screen.queryByText('usr-42')).toBeNull();
  });

  it('MUTATION: a different name at the same userId changes what is displayed', async () => {
    await renderWithUsers([
      { id: 'usr-42', firstName: 'Jan', lastName: 'Nowak', email: 'jan@example.com' },
    ]);

    await waitFor(() => expect(screen.getByText('Jan Nowak')).toBeTruthy());
    expect(screen.queryByText('Anna Kowalska')).toBeNull();
    expect(screen.queryByText('usr-42')).toBeNull();
  });

  it('falls back to the raw id only when no name is resolvable anywhere', async () => {
    await renderWithUsers([]); // no org directory entry for usr-42

    await waitFor(() => expect(screen.getByText('usr-42')).toBeTruthy());
  });
});
