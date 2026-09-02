/**
 * Dev-render host for Admin → domena "Zespół i dostęp" (team), komplet 8
 * ekranów z `src/components/Admin/adminNavigation.ts` (ADMIN_DOMAINS → id
 * 'team'). Runda odbioru grafiki 146-admin-team (decyzja właściciela
 * 2026-08-31: cały panel Administracji wchodzi do rundy). Siostrzany plik do
 * dev-render/screens/admin-billing.tsx — ta sama organizacja fikcyjna
 * "Atelier Toys" (org-atelier-toys-0001) dla spójności zrzutów w jednej
 * rundzie.
 *
 * Mapowanie ekran→komponent skopiowane 1:1 z realnego routingu w
 * `src/views/admin/AdminSettingsModule.tsx` (case 'team', linie ~421-432):
 *   members            → <AdminMembersRolesPanel screen="members" />
 *   invitations        → <AdminMembersRolesPanel screen="invitations" />
 *   roles-permissions  → <AdminRolesPermissionsPanel />
 *   teams              → <AdminTeamsPanel />
 *   guests-external    → <AdminGuestsPanel />
 *   access-requests    → <AdminAccessRequestsPanel />                 (STATYCZNY placeholder — brak wołań API)
 *   access-reviews     → <AdminAccessReviewsPanel />
 *   ownership          → <AdminMembersRolesPanel screen="ownership" /> (renderuje <OwnershipManagementView /> wewnątrz)
 *
 * Żadnej reimplementacji: montujemy REALNE komponenty. members/invitations/
 * ownership wołają `Api.*` (services/api.ts) pod
 * `/api/organizations/:orgId/members|admin/invitations|ownership*` — orgId
 * bierzemy z `useAppStore().currentOrganization.id`, więc seedujemy store
 * (currentOrganization + currentUser, Piotr jako OWNER) zamiast tylko
 * stubować fetch. roles-permissions/teams/guests-external/access-reviews
 * wołają dedykowane klienty (adminRolesApi.ts, teams.api.ts,
 * adminGuestsApi.ts, adminAccessReviewsApi.ts) → też `window.fetch`. Stub
 * jest scoped po substringach URL-i realnie używanych przez te ekrany — NIE
 * catch-all `/api/*` (pułapka opisana w i18n-fala1-smoke.tsx).
 *
 * Dane demo: fikcyjna organizacja „Atelier Toys" (spójna z admin-billing /
 * admin-command-center-panel), polskie osoby, PL treść.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AdminAccessRequestsPanel } from '../../src/components/Admin/AdminAccessRequestsPanel';
import { AdminAccessReviewsPanel } from '../../src/components/Admin/AdminAccessReviewsPanel';
import { AdminGuestsPanel } from '../../src/components/Admin/AdminGuestsPanel';
import { AdminMembersRolesPanel } from '../../src/components/Admin/AdminMembersRolesPanel';
import { AdminRolesPermissionsPanel } from '../../src/components/Admin/AdminRolesPermissionsPanel';
import { AdminTeamsPanel } from '../../src/components/Admin/AdminTeamsPanel';
import { useAppStore } from '../../src/store/useAppStore';

export type AdminTeamScreenId =
  | 'members'
  | 'invitations'
  | 'roles-permissions'
  | 'teams'
  | 'guests-external'
  | 'access-requests'
  | 'access-reviews'
  | 'ownership';

const ORG_ID = 'org-atelier-toys-0001';
const PIOTR_ID = 'usr-piotr';

// --- Store seed: orgId + zalogowany OWNER (Piotr), tak by canManageTeam=true
// w AdminMembersRolesPanel i isOwner=true w OwnershipManagementView. Nie
// używamy dev-render/mocks/seedStore.ts (inny orgId/userId — org-dbr77-demo)
// żeby zostać spójnym z resztą rodziny admin-* (org-atelier-toys-0001).
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

// --- Members (GET /organizations/:orgId/members) ---------------------------
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
  {
    user_id: 'usr-anna',
    id: 'usr-anna',
    first_name: 'Anna',
    last_name: 'Kowalska',
    email: 'anna@atelier-toys.pl',
    role: 'ADMIN',
    status: 'ACTIVE',
  },
  {
    user_id: 'usr-marek',
    id: 'usr-marek',
    first_name: 'Marek',
    last_name: 'Zieliński',
    email: 'marek@atelier-toys.pl',
    role: 'MEMBER',
    status: 'ACTIVE',
  },
  {
    user_id: 'usr-ewa',
    id: 'usr-ewa',
    first_name: 'Ewa',
    last_name: 'Nowak',
    email: 'ewa@atelier-toys.pl',
    role: 'MEMBER',
    status: 'ACTIVE',
  },
  {
    user_id: 'usr-tomasz',
    id: 'usr-tomasz',
    first_name: 'Tomasz',
    last_name: 'Wójcik',
    email: 'tomasz@atelier-toys.pl',
    role: 'MEMBER',
    status: 'SUSPENDED',
  },
  {
    user_id: 'usr-kasia',
    id: 'usr-kasia',
    first_name: 'Katarzyna',
    last_name: 'Lis',
    email: 'katarzyna@atelier-toys.pl',
    role: 'GUEST',
    status: 'ACTIVE',
  },
];

// --- Invitations (GET /organizations/:orgId/admin/invitations) -------------
const INVITATIONS = [
  {
    id: 'inv-1',
    email: 'julia.dabrowska@klient.pl',
    role_to_assign: 'MEMBER',
    status: 'pending',
    delivery: 'SENT',
    expires_at: '2026-09-10T12:00:00Z',
  },
  {
    id: 'inv-2',
    email: 'piotr.malinowski@atelier-toys.pl',
    role_to_assign: 'ADMIN',
    status: 'pending',
    delivery: 'FAILED',
    expires_at: '2026-09-05T12:00:00Z',
  },
  {
    id: 'inv-3',
    email: 'stazysta.lato@atelier-toys.pl',
    role_to_assign: 'MEMBER',
    status: 'expired',
    delivery: 'SENT',
    expires_at: '2026-07-01T12:00:00Z',
  },
  {
    id: 'inv-4',
    email: 'odwolany.dostep@partnerfirma.pl',
    role_to_assign: 'GUEST',
    status: 'revoked',
    delivery: 'SENT',
    expires_at: '2026-08-20T12:00:00Z',
  },
  {
    id: 'inv-5',
    email: 'nowy.konsultant@atelier-toys.pl',
    role_to_assign: 'MEMBER',
    status: 'accepted',
    delivery: 'SENT',
    expires_at: '2026-08-15T12:00:00Z',
  },
];

// --- Roles & permissions (GET /security/roles → {roles}) -------------------
const ROLES = [
  {
    id: 'role-1',
    name: 'Konsultant Senior',
    permissions: ['projects:read', 'projects:write', 'reports:publish'],
    updated_at: '2026-08-12T09:00:00Z',
  },
  {
    id: 'role-2',
    name: 'Analityk Finansowy',
    permissions: ['finance:read', 'finance:export'],
    updated_at: '2026-07-28T14:30:00Z',
  },
  {
    id: 'role-3',
    name: 'Tylko podgląd',
    permissions: ['read-only'],
    updated_at: '2026-06-02T08:15:00Z',
  },
];

// --- Teams (GET /teams) ------------------------------------------------------
const TEAMS = [
  {
    id: 'team-1',
    name: 'Zespół Doradztwa Strategicznego',
    description: 'Projekty strategiczne dla klientów Enterprise',
    organizationId: ORG_ID,
    lead: { id: 'usr-anna', firstName: 'Anna', lastName: 'Kowalska' },
    members: [
      { userId: PIOTR_ID, role: 'lead', user: { firstName: 'Piotr', lastName: 'Wiśniewski', email: 'piotr@atelier-toys.pl' } },
      { userId: 'usr-anna', role: 'member', user: { firstName: 'Anna', lastName: 'Kowalska', email: 'anna@atelier-toys.pl' } },
      { userId: 'usr-marek', role: 'member', user: { firstName: 'Marek', lastName: 'Zieliński', email: 'marek@atelier-toys.pl' } },
    ],
    memberCount: 3,
    teamType: 'consulting',
    isActive: true,
    createdAt: '2026-02-01T09:00:00Z',
  },
  {
    id: 'team-2',
    name: 'Zespół Analiz Finansowych',
    description: 'Modelowanie finansowe i wyceny',
    organizationId: ORG_ID,
    lead: { id: 'usr-marek', firstName: 'Marek', lastName: 'Zieliński' },
    members: [
      { userId: 'usr-marek', role: 'lead', user: { firstName: 'Marek', lastName: 'Zieliński', email: 'marek@atelier-toys.pl' } },
      { userId: 'usr-ewa', role: 'member', user: { firstName: 'Ewa', lastName: 'Nowak', email: 'ewa@atelier-toys.pl' } },
    ],
    memberCount: 2,
    teamType: 'finance',
    isActive: true,
    createdAt: '2026-03-15T09:00:00Z',
  },
  {
    id: 'team-3',
    name: 'Zespół Wsparcia Klienta',
    description: 'Onboarding i wsparcie bieżące',
    organizationId: ORG_ID,
    lead: null,
    members: [],
    memberCount: 0,
    teamType: 'support',
    isActive: false,
    createdAt: '2026-01-10T09:00:00Z',
  },
];

// --- Guests (GET /admin/guests → {guests}) ----------------------------------
const GUESTS = [
  {
    user_id: 'guest-1',
    email: 'r.kaczmarek@partnerfirma.pl',
    first_name: 'Robert',
    last_name: 'Kaczmarek',
    granted_at: '2026-08-01T10:00:00Z',
    status: 'active',
    scope_type: 'project',
    project_id: 'proj-123',
    expires_at: '2026-09-30T10:00:00Z',
  },
  {
    user_id: 'guest-2',
    email: 'audytor@bigfirma.pl',
    first_name: 'Magdalena',
    last_name: 'Sikora',
    granted_at: '2026-05-01T10:00:00Z',
    status: 'active',
    scope_type: 'organization',
    project_id: null,
    expires_at: '2026-07-01T10:00:00Z',
  },
  {
    user_id: 'guest-3',
    email: 'it.wsparcie@vendor.pl',
    first_name: 'Adam',
    last_name: 'Wysocki',
    granted_at: '2026-06-10T10:00:00Z',
    status: 'revoked',
    scope_type: 'project',
    project_id: 'proj-77',
    expires_at: null,
  },
];

// --- Access reviews (GET /admin/iam/policy, GET /admin/people) -------------
const IAM_POLICY = { accessReviewsEnabled: true, accessReviewCadenceDays: 90 };
const PEOPLE = [
  { userId: PIOTR_ID, email: 'piotr@atelier-toys.pl', firstName: 'Piotr', lastName: 'Wiśniewski', role: 'OWNER', status: 'ACTIVE' },
  { userId: 'usr-anna', email: 'anna@atelier-toys.pl', firstName: 'Anna', lastName: 'Kowalska', role: 'ADMIN', status: 'ACTIVE' },
  { userId: 'usr-tomasz', email: 'tomasz@atelier-toys.pl', firstName: 'Tomasz', lastName: 'Wójcik', role: 'ADMIN', status: 'SUSPENDED' },
  { userId: 'usr-marek', email: 'marek@atelier-toys.pl', firstName: 'Marek', lastName: 'Zieliński', role: 'MEMBER', status: 'ACTIVE' },
];

// --- Ownership (GET /organizations/:orgId/ownership|/admins|/ownership/pending-transfer) --
const OWNERSHIP = { ownerUserId: PIOTR_ID, createdAt: '2025-01-15T09:00:00Z' };
const OWNER_USER = { id: PIOTR_ID, firstName: 'Piotr', lastName: 'Wiśniewski', email: 'piotr@atelier-toys.pl' };
const ORG_ADMINS = [{ id: 'usr-anna', firstName: 'Anna', lastName: 'Kowalska', email: 'anna@atelier-toys.pl' }];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Instalacja stuba `window.fetch` raz (idempotentnie na HMR), scoped po
// substringach URL-i realnie wołanych przez ekrany domeny 'team' — NIE
// catch-all `/api/*` (patrz komentarz w admin-billing.tsx / i18n-fala1-smoke.tsx).
const g = window as unknown as { __ADMIN_TEAM_FETCH__?: boolean };
if (!g.__ADMIN_TEAM_FETCH__) {
  g.__ADMIN_TEAM_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      // Members role/revoke commands (mutations not driven by default render,
      // guarded here only so a stray click during manual QA doesn't 404).
      if (url.includes('/admin/members/') && url.includes('/role')) return jsonResponse(MEMBERS);
      if (url.includes('/admin/members/') && url.includes('/revoke')) return jsonResponse(MEMBERS);
      // Invitations
      if (url.includes('/admin/invitations/') && url.includes('/resend'))
        return jsonResponse({ ...INVITATIONS[0], delivery: 'SENT' });
      if (url.includes('/admin/invitations/') && url.includes('/revoke'))
        return jsonResponse({ ...INVITATIONS[0], status: 'revoked' });
      if (url.includes('/admin/invitations') && method === 'GET') return jsonResponse(INVITATIONS);
      if (url.includes('/admin/invitations') && method === 'POST')
        return jsonResponse({ invitation: INVITATIONS[0] });
      // Members collection (organizations/:id/members)
      if (url.includes('/members') && !url.includes('/teams') && method === 'GET')
        return jsonResponse(MEMBERS);
      // Roles & permissions
      if (url.includes('/security/roles')) {
        if (method === 'GET') return jsonResponse({ roles: ROLES });
        return jsonResponse({ roles: ROLES });
      }
      // Teams
      if (url.includes('/teams/') && url.includes('/members')) return jsonResponse({ success: true });
      if (url.includes('/teams/')) {
        const id = url.split('/teams/')[1]?.split(/[/?]/)[0];
        const team = TEAMS.find((t) => t.id === id) || TEAMS[0];
        return jsonResponse(team);
      }
      if (url.includes('/teams') && method === 'GET') return jsonResponse(TEAMS);
      // Guests
      if (url.includes('/admin/guests')) return jsonResponse({ guests: GUESTS });
      // Access reviews
      if (url.includes('/admin/iam/policy')) return jsonResponse({ policy: IAM_POLICY });
      if (url.includes('/admin/people')) return jsonResponse({ members: PEOPLE });
      // Ownership (order matters — most specific substring first)
      if (url.includes('/ownership/pending-transfer')) return jsonResponse({ pendingTransfer: null });
      if (url.includes('/ownership/transfer')) return jsonResponse({ success: true });
      if (url.includes('/ownership/cancel-transfer')) return jsonResponse({ success: true });
      if (url.includes('/ownership/accept-transfer')) return jsonResponse({ success: true });
      if (url.includes('/ownership')) return jsonResponse({ ownership: OWNERSHIP, owner: OWNER_USER });
      if (url.includes('/admins')) return jsonResponse(ORG_ADMINS);
    } catch {
      /* fall through to real fetch (np. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

class DebugBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ padding: 16, color: 'red', whiteSpace: 'pre-wrap' }}>
          {this.state.error.stack || this.state.error.message}
        </pre>
      );
    }
    return this.props.children;
  }
}

// Ekran "teams": klika pierwszy wiersz po zamontowaniu, żeby zrzut pokazywał
// realny panel członków zespołu (selectedId), nie tylko samą tabelę.
function TeamsAutoSelectWrapper(): React.ReactElement {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const row = document.querySelector('tbody tr');
      (row as HTMLElement | null)?.click();
    }, 400);
    return () => clearTimeout(timer);
  }, []);
  return <AdminTeamsPanel />;
}

// Mapowanie 1:1 z AdminSettingsModule.tsx case 'team'.
function renderTeamScreen(adminScreen: AdminTeamScreenId): React.ReactElement {
  if (adminScreen === 'roles-permissions') return <AdminRolesPermissionsPanel />;
  if (adminScreen === 'teams') return <TeamsAutoSelectWrapper />;
  if (adminScreen === 'guests-external') return <AdminGuestsPanel />;
  if (adminScreen === 'access-requests') return <AdminAccessRequestsPanel />;
  if (adminScreen === 'access-reviews') return <AdminAccessReviewsPanel />;
  return (
    <AdminMembersRolesPanel screen={adminScreen as 'members' | 'invitations' | 'ownership'} />
  );
}

export default function AdminTeamScreen(props: {
  adminScreen: AdminTeamScreenId;
}): React.ReactElement {
  // `&ekran=` w URL nadpisuje prop domyślny (konwencja z admin-billing.tsx).
  const requested = new URLSearchParams(window.location.search).get(
    'ekran'
  ) as AdminTeamScreenId | null;
  const adminScreen = requested || props.adminScreen;
  return (
    /*
      SZEROKOSC = SZEROKOSC WOLACZA (naprawa przyrzadu 2026-09-02).
      Zgloszenie wlasciciela na `admin-command-attention-queue`: "to nie jest
      szerokosc strony". Stal tu wlasny inline `maxWidth: 1200` - liczba,
      ktorej NIE MA u zadnego wolacza produkcyjnego. Realny wolacz kazdego
      z tych paneli to `src/views/admin/AdminSettingsModule.tsx:599`:
      `mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-5 lg:p-6`. Harness
      zwezal produkt o 80 px i gubil responsywny padding - defekt PRZYRZADU,
      nie produktu (ta sama klasa co Z-32b: `max-w-3xl` wklejony w harnessie
      Finansow). Bramka R3 tego nie zlapala, bo szuka klas `max-w-*`, a to
      byl inline `style`.
    */
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-5 lg:p-6">
      <DebugBoundary>
        <MemoryRouter initialEntries={['/']}>{renderTeamScreen(adminScreen)}</MemoryRouter>
      </DebugBoundary>
    </div>
  );
}
