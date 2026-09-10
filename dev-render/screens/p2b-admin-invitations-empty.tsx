/**
 * P2B (DEC-457, 2026-09-10) — REALNY <AdminMembersRolesPanel screen="invitations">
 * z pustą listą zaproszeń (świeża organizacja, nikt jeszcze nie zaproszony).
 *
 * Wzorzec seedu identyczny z `dev-render/screens/admin-team.tsx` (org
 * "Atelier Toys", Piotr jako OWNER) — tu tylko `/admin/invitations` (GET)
 * zwraca pustą tablicę zamiast pięciu przykładowych wierszy, żeby pokazać
 * PRAWDZIWY pusty stan zamiast zawsze-pełnej listy z ekranu macierzystego.
 *
 * Query: &theme=light|dark
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AdminMembersRolesPanel } from '../../src/components/Admin/AdminMembersRolesPanel';
import { useAppStore } from '../../src/store/useAppStore';

const ORG_ID = 'org-atelier-toys-0001';
const PIOTR_ID = 'usr-piotr';

useAppStore.setState({
  currentUser: {
    id: PIOTR_ID,
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr@atelier-toys.pl',
    role: 'OWNER',
    isAuthenticated: true,
  } as any,
  currentOrganization: {
    id: ORG_ID,
    name: 'Atelier Toys Sp. z o.o.',
    plan: 'enterprise',
    status: 'active',
  } as any,
} as any);

const MEMBERS = [
  {
    user_id: PIOTR_ID,
    id: PIOTR_ID,
    first_name: 'Piotr',
    last_name: 'Wiśniewski',
    email: 'piotr@atelier-toys.pl',
    role: 'OWNER',
    status: 'ACTIVE',
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method || 'GET').toUpperCase();
  if (url.includes('/admin/invitations') && method === 'GET') return jsonResponse([]);
  if (url.includes('/members') && !url.includes('/teams') && method === 'GET') {
    return jsonResponse(MEMBERS);
  }
  if (url.includes('/security/roles')) return jsonResponse({ roles: [] });
  return originalFetch(input, init);
};

export default function P2bAdminInvitationsEmptyScreen(): React.ReactElement {
  // Szerokość = szerokość wołacza (naprawa przyrządu 2026-09-02, patrz
  // admin-team.tsx): realny wołacz to AdminSettingsModule.tsx:599
  // `mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-5 lg:p-6`.
  return (
    <div
      className="mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-5 lg:p-6"
      data-testid="p2b-admin-invitations-empty"
    >
      <MemoryRouter initialEntries={['/']}>
        <AdminMembersRolesPanel screen="invitations" />
      </MemoryRouter>
    </div>
  );
}
