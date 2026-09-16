/**
 * Dev-render: K-21 (zgłoszenie testera #61, Tomek) — „Brak możliwości
 * tworzenia organizacji".
 *
 * PO CO (CLAUDE.md §7): nadzorca robi zrzut REALNEGO ekranu zanim właściciel
 * cokolwiek zobaczy. Mountowany jest PRAWDZIWY `<OrganizationSettings>` z
 * jedną organizacją na transporcie — czyli dokładnie stan, w którym tester
 * nie miał żadnego wejścia do tworzenia kolejnej.
 *
 * Atrapa transportu: `Api.getUserOrganizations` oddaje jedną organizację,
 * `getOrganization`/`getOrganizationMembers` deterministyczną treść. Bez
 * backendu, bez logowania.
 *
 * URL: ?screen=feedback-k21-organizacja[&lang=en|pl][&theme=light|dark][&role=ADMIN|CONSULTANT]
 */
import React from 'react';

import { OrganizationSettings } from '../../src/components/settings/OrganizationSettings';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import type { User } from '../../src/types';

const params = new URLSearchParams(window.location.search);
const rola = params.get('role') === 'CONSULTANT' ? 'CONSULTANT' : 'ADMIN';

const uzytkownik = {
  id: 'k21-user',
  email: 'tomasz.jankowski@k21.local',
  firstName: 'Tomasz',
  lastName: 'Jankowski',
  language: 'en',
  role: rola,
  organizationId: 'k21-org',
  isAuthenticated: true,
} as User;

useAppStore.setState({ currentUser: uzytkownik });

const ORG = {
  id: 'k21-org',
  name: 'Northwind Manufacturing',
  billing_status: 'TRIAL',
  organization_type: 'TRIAL',
  token_balance: 120_000,
  created_at: '2026-09-01T09:00:00.000Z',
};

const CZLONKOWIE = [
  {
    user_id: 'k21-user',
    email: 'tomasz.jankowski@k21.local',
    first_name: 'Tomasz',
    last_name: 'Jankowski',
    role: 'OWNER',
    created_at: '2026-09-01T09:00:00.000Z',
  },
  {
    user_id: 'k21-user-2',
    email: 'katarzyna.szwarocka@k21.local',
    first_name: 'Katarzyna',
    last_name: 'Szwarocka',
    role: 'MEMBER',
    created_at: '2026-09-04T11:20:00.000Z',
  },
];

(Api as any).getUserOrganizations = async () => [ORG];
(Api as any).getOrganization = async () => ORG;
(Api as any).getOrganizationMembers = async () => CZLONKOWIE;
(Api as any).getOrgTokenBalance = async () => null;
(Api as any).getOrgTokenLedger = async () => [];

export default function FeedbackK21OrganizacjaScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ minHeight: '100vh' }} className="bg-c-bg p-8">
        <OrganizationSettings currentUser={uzytkownik} />
      </div>
    </AppProviders>
  );
}
