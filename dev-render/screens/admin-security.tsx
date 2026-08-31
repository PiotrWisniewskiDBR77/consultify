/**
 * Dev-render host for Admin → domena "Bezpieczeństwo i tożsamość" (security),
 * komplet 10 ekranów z `src/components/Admin/adminNavigation.ts`
 * (ADMIN_DOMAINS → id 'security'). Runda odbioru grafiki 146-admin-security
 * (decyzja właściciela 2026-08-31: cały panel Administracji wchodzi do rundy).
 * Wzorzec 1:1 z `dev-render/screens/admin-billing.tsx` (ten sam odbiór, domena
 * "billing") — jeden plik story, jeden komponent per nav-slot montowany przez
 * `?ekran=`/prop, bez re-implementacji.
 *
 * Mapowanie ekran→komponent skopiowane 1:1 z realnego routingu w
 * `src/views/admin/AdminSettingsModule.tsx` (case 'security', linie ~477-487
 * + SECURITY_TAB_BY_SCREEN linie ~215-220):
 *   security-policy → <AdminSecurityIdentityPanel initialTab={undefined} /> (domyślna zakładka 'policy')
 *   sso             → <AdminSecurityIdentityPanel initialTab="policy" />   (ALIAS security-policy — SSO posture żyje w tej samej karcie, patrz komentarz przy AdminSecurityIdentityPanel.tsx:24-29)
 *   scim-lifecycle  → <AdminSecurityIdentityPanel initialTab="scim" />
 *   sessions        → <AdminSessionsPanel />                               (osobny komponent, StandardTable)
 *   api-access      → <AdminSecurityIdentityPanel initialTab="api-access" />
 *   domains         → <AdminDomainsPanel />                                (osobny komponent, StandardTable)
 *   service-accounts→ <AdminServiceAccountsPanel />                        (osobny komponent, StandardTable)
 *   security-alerts → <AdminSecurityAlertsPanel />                         (osobny komponent, StandardTable)
 *   break-glass     → <AdminBreakGlassPanel />                             (osobny komponent, StandardTable)
 *   risk-summary    → <AdminSecurityIdentityPanel initialTab="risk" />
 *
 * security-policy≡sso is NOT a harness bug — it is the real WIRE_ONLY shortcut
 * in the product (comment at AdminSecurityIdentityPanel.tsx:24-29 says so
 * explicitly: "SSO lives inside the `policy` tab via AdminSsoSelfServiceCard").
 * Both are photographed anyway, byte-identical, exactly as Piotr would see
 * them clicking either nav-slot.
 *
 * `AdminSecurityIdentityPanel` renders its OWN internal horizontal pill-nav
 * (role="tablist", 6 tabs: policy/collaboration/api-access/iam/scim/risk) —
 * unlike the sibling `AdminCommandCenterPanel`/`AdminBillingFinOpsPanel`
 * domains, this one was NOT migrated off that pattern (ADM-OWN-001, see
 * DEC night-fixes-b-20260826 for the Command Center precedent). This harness
 * mounts the real component as-is; the ZGŁASZAM section of the review flags
 * this.
 *
 * No re-implementation of data: every panel below self-fetches through the
 * typed `services/adminSessionsApi.ts` / `adminDomainsApi.ts` /
 * `adminServiceAccountsApi.ts` / `adminSecurityAlertsApi.ts` /
 * `adminBreakGlassApi.ts` clients or the `Api.*` methods in `services/api.ts`
 * — thin wrappers over `fetch('/api/admin/...')`. We stub `window.fetch`,
 * keyed by URL substring, scoped to this domain's own paths — never a bare
 * `/api/*` catch-all (see i18n-fala1-smoke.tsx header comment for the trap
 * that shape causes with other eagerly-imported stories).
 *
 * `security-policy`'s panel (`AdminSecurityPolicyPanel`) also conditionally
 * mounts `AdminSsoSelfServiceCard` (flag `ff.sso_self_service`, default ON)
 * and `AdminScimGroupSyncCard` (flag `ff.scim_group_sync`, default ON) — both
 * already accepted by Piotr (gallery fala7 / 07-16). Their mock shapes are
 * copied 1:1 from the already-existing
 * dev-render/screens/admin-sso-self-service-card.tsx story so this harness
 * shows the SAME accepted state, not a fresh guess.
 *
 * Dane demo: fikcyjna organizacja "Atelier Toys" (ten sam org-id co inne
 * harnesse Admina, dla spójności).
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AdminBreakGlassPanel } from '../../src/components/Admin/AdminBreakGlassPanel';
import { AdminDomainsPanel } from '../../src/components/Admin/AdminDomainsPanel';
import {
  AdminSecurityIdentityPanel,
  type AdminSecurityIdentityTabId,
} from '../../src/components/Admin/AdminSecurityIdentityPanel';
import { AdminSecurityAlertsPanel } from '../../src/components/Admin/AdminSecurityAlertsPanel';
import { AdminServiceAccountsPanel } from '../../src/components/Admin/AdminServiceAccountsPanel';
import { AdminSessionsPanel } from '../../src/components/Admin/AdminSessionsPanel';
import { seedRealisticSession } from '../mocks/seedStore';

// `ApiKeysManagementView` (api-access screen) gates its own fetch on
// `useAppStore().currentOrganization?.id` (ApiKeysManagementView.tsx:122-127)
// — without a seeded org it silently shows an empty "No API Keys" state
// instead of the mocked keys below. Same shared seed as admin-billing.tsx /
// the decision-record.tsx family of stories.
seedRealisticSession();

export type AdminSecurityScreenId =
  | 'security-policy'
  | 'sso'
  | 'scim-lifecycle'
  | 'sessions'
  | 'api-access'
  | 'domains'
  | 'service-accounts'
  | 'security-alerts'
  | 'break-glass'
  | 'risk-summary';

const ORG_ID = 'org-atelier-toys-0001';

const SECURITY_POLICY = {
  policy: {
    mfaRequired: true,
    mfaGracePeriodDays: 7,
    ssoEnabled: true,
    ssoEnforced: false,
    allowPasswordLogin: true,
    ssoProvider: 'Okta',
    ssoProviderType: 'okta',
    ssoProtocol: 'saml' as const,
    sessionTimeoutMinutes: 60,
    passwordPolicy: 'strong',
  },
};

// Copied 1:1 from dev-render/screens/admin-sso-self-service-card.tsx —
// already Piotr-accepted state (configured SAML, 2 domains).
const SSO_SELF_CONFIG = {
  organizationId: ORG_ID,
  configured: true,
  isEnabled: true,
  protocol: 'saml' as const,
  providerName: 'Okta',
  providerType: 'okta',
  domains: ['atelier-toys.com', 'atelier-toys.io'],
  saml: {
    entityId: 'urn:idp:atelier-toys-okta',
    ssoUrl: 'https://atelier-toys.okta.com/app/atelier/sso/saml',
    sloUrl: 'https://atelier-toys.okta.com/app/atelier/slo/saml',
    nameIdFormat: 'emailAddress',
    certificateSet: true,
  },
  oidc: {
    issuer: '',
    clientId: '',
    clientSecretSet: false,
    authorizationUrl: '',
    tokenUrl: '',
    userinfoUrl: '',
    scopes: 'openid profile email',
  },
  updatedAt: '2026-07-14T16:20:00Z',
};
const SSO_VALIDATION_RESULT = { valid: true, errors: [] as string[] };

const SCIM_SUMMARY = {
  summary: {
    tokens: [
      { id: 'tok-1', name: 'Tenant SCIM Token', token_prefix: 'scim_8f2a', usage_count: 412 },
      { id: 'tok-2', name: 'Okta provisioning', token_prefix: 'scim_1c9d', usage_count: 58 },
    ],
    groupMappings: [
      {
        id: 'map-1',
        external_group_id: 'grp-eng',
        external_group_name: 'Engineering (Entra)',
        internal_role: 'member',
        project_id: null,
        project_name: null,
        is_active: true,
        member_count: 14,
      },
      {
        id: 'map-2',
        external_group_id: 'grp-billing',
        external_group_name: 'Billing Admins (Entra)',
        internal_role: 'billing_admin',
        project_id: 'proj-1',
        project_name: 'Atelier Toys — Growth',
        is_active: true,
        member_count: 3,
      },
    ],
    conflicts: [{ id: 'conf-1', external_group_id: 'grp-legacy-sales', resolution: null }],
  },
};

const PROJECTS = [
  { id: 'proj-1', name: 'Atelier Toys — Growth' },
  { id: 'proj-2', name: 'Atelier Toys — Ops' },
];

const SESSIONS = {
  sessions: [
    {
      id: 'sess-1',
      user_id: 'user-piotr-demo',
      user_email: 'piotr.wisniewski@dbr77.com',
      first_name: 'Piotr',
      last_name: 'Wiśniewski',
      device_info: 'Chrome 128 · macOS',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ip_address: '81.190.44.12',
      location: 'Warszawa, PL',
      last_activity: '2026-08-31T08:12:00Z',
      expires_at: '2026-09-07T08:12:00Z',
    },
    {
      id: 'sess-2',
      user_id: 'user-anna',
      user_email: 'anna.kowalska@dbr77.com',
      first_name: 'Anna',
      last_name: 'Kowalska',
      device_info: 'Safari 17 · iOS',
      user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
      ip_address: '46.29.201.5',
      location: 'Kraków, PL',
      last_activity: '2026-08-30T19:44:00Z',
      expires_at: '2026-09-06T19:44:00Z',
    },
    {
      id: 'sess-3',
      user_id: 'user-marek',
      user_email: 'marek.zielinski@dbr77.com',
      first_name: 'Marek',
      last_name: 'Zieliński',
      device_info: undefined,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) okta-provision-agent/2.1',
      ip_address: '193.0.96.77',
      location: undefined,
      last_activity: '2026-08-29T07:02:00Z',
      expires_at: '2026-09-05T07:02:00Z',
    },
  ],
};

const API_KEYS = {
  keys: [
    {
      id: 'key-1',
      name: 'Zapier — Initiatives sync',
      description: 'Push initiative status changes to Zapier webhook',
      keyPrefix: 'csk_live_7f2a',
      permissions: ['read:projects', 'read:tasks'],
      expiresAt: '2027-01-15T00:00:00Z',
      lastUsedAt: '2026-08-30T22:10:00Z',
      createdBy: 'Piotr Wiśniewski',
      createdAt: '2026-01-15T09:00:00Z',
    },
    {
      id: 'key-2',
      name: 'DRD export cron',
      description: 'Nightly export job — reads report data',
      keyPrefix: 'csk_live_9b41',
      scopes: ['read:reports', 'write:reports'],
      expiresAt: null,
      lastUsedAt: '2026-08-31T02:00:00Z',
      createdBy: 'Anna Kowalska',
      createdAt: '2026-03-02T11:20:00Z',
    },
    {
      id: 'key-3',
      name: 'Legacy webhook (revoked)',
      description: 'Old CRM integration, revoked after migration',
      keyPrefix: 'csk_live_1c0e',
      permissions: ['webhooks:manage'],
      expiresAt: '2026-06-01T00:00:00Z',
      lastUsedAt: '2026-05-20T14:00:00Z',
      createdBy: 'Piotr Wiśniewski',
      createdAt: '2025-11-01T10:00:00Z',
      status: 'revoked',
      updatedAt: '2026-06-01T00:00:00Z',
    },
  ],
};

const DOMAINS = {
  success: true as const,
  domains: [
    {
      id: 'dom-1',
      domain: 'atelier-toys.com',
      autoJoin: true,
      verified: true,
      verifiedAt: '2026-02-10T09:30:00Z',
      verificationMethod: 'dns_txt',
      verificationToken: 'cvt_9f21ab',
      addedAt: '2026-02-08T12:00:00Z',
    },
    {
      id: 'dom-2',
      domain: 'atelier-toys.io',
      autoJoin: false,
      verified: false,
      verifiedAt: null,
      verificationMethod: 'dns_txt',
      verificationToken: 'cvt_4d88ce',
      addedAt: '2026-08-20T15:45:00Z',
    },
  ],
};

const SERVICE_ACCOUNTS = {
  success: true as const,
  data: [
    {
      id: 'svc-1',
      name: 'DRD pipeline worker',
      description: 'Reads/writes report records for the automated DRD pipeline',
      token_prefix: 'sa_7c21',
      scopes: ['records:read', 'records:write', 'metadata:read'],
      last_used_at: '2026-08-31T04:00:00Z',
      expires_at: null,
      created_at: '2026-04-11T10:00:00Z',
    },
    {
      id: 'svc-2',
      name: 'Nightly backup exporter',
      description: null,
      token_prefix: 'sa_a190',
      scopes: ['records:read'],
      last_used_at: null,
      expires_at: '2026-12-31T00:00:00Z',
      created_at: '2026-07-01T08:00:00Z',
    },
  ],
};

const SECURITY_ALERTS = {
  alerts: [
    {
      id: 'alert-1',
      event_type: 'impossible_travel',
      severity: 'critical',
      user_email: 'marek.zielinski@dbr77.com',
      ip_address: '193.0.96.77',
      details: 'Login from Warszawa then Singapur within 12 minutes',
      resolved: 0,
      created_at: '2026-08-31T06:40:00Z',
    },
    {
      id: 'alert-2',
      event_type: 'repeated_failed_login',
      severity: 'high',
      user_email: 'anna.kowalska@dbr77.com',
      ip_address: '46.29.201.5',
      details: '6 failed attempts in 5 minutes',
      resolved: 0,
      created_at: '2026-08-30T21:05:00Z',
    },
    {
      id: 'alert-3',
      event_type: 'new_device_login',
      severity: 'low',
      user_email: 'piotr.wisniewski@dbr77.com',
      ip_address: '81.190.44.12',
      details: 'First login from this device fingerprint',
      resolved: 1,
      created_at: '2026-08-28T08:15:00Z',
    },
  ],
};

const BREAK_GLASS = {
  sessions: [
    {
      id: 'bg-1',
      adminId: 'Piotr Wiśniewski',
      expiresAt: '2026-08-31T18:00:00Z',
      breakGlassReason: 'Rollback awaryjny po nieudanej migracji uprawnień ról',
      approvedBy: 'Anna Kowalska',
      sessionType: 'emergency_admin',
    },
  ],
  policy: {
    breakGlassEnabled: true,
    breakGlassApprovers: ['user-anna', 'user-marek'],
  },
  approvers: [
    {
      id: 'user-anna',
      email: 'anna.kowalska@dbr77.com',
      first_name: 'Anna',
      last_name: 'Kowalska',
    },
    {
      id: 'user-marek',
      email: 'marek.zielinski@dbr77.com',
      first_name: 'Marek',
      last_name: 'Zieliński',
    },
  ],
};

const RISK_SUMMARY = {
  summary: {
    audit: {
      totalLogs: 18420,
      unresolvedCount: 7,
      highRiskCount: 3,
    },
    incidents: [
      {
        id: 'inc-1',
        provider: 'Anthropic',
        status: 'resolved',
        severity: 'medium',
        startedAt: '2026-08-27T10:00:00Z',
      },
      {
        id: 'inc-2',
        provider: 'OpenAI (fallback)',
        status: 'monitoring',
        severity: 'low',
        startedAt: '2026-08-30T14:30:00Z',
      },
    ],
  },
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Idempotent across HMR; every branch below is scoped to a specific
// `/admin/security|sessions|domains|service-accounts|security-alerts|
// break-glass|identity/scim|sso-self|risk` path or `/api/api-keys` /
// `/api/projects` substring — never a bare `/api/*` catch-all.
const g = window as unknown as { __ADMIN_SECURITY_FETCH__?: boolean };
if (!g.__ADMIN_SECURITY_FETCH__) {
  g.__ADMIN_SECURITY_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      if (url.includes('/admin/sso-self/validate')) return jsonResponse(SSO_VALIDATION_RESULT);
      if (url.includes('/admin/sso-self')) {
        if (method === 'PUT') return jsonResponse({ success: true, config: SSO_SELF_CONFIG });
        return jsonResponse({
          organizationId: SSO_SELF_CONFIG.organizationId,
          config: SSO_SELF_CONFIG,
        });
      }
      if (url.includes('/admin/security') && !url.includes('/security-alerts')) {
        return jsonResponse(SECURITY_POLICY);
      }
      if (url.includes('/admin/identity/scim/tokens')) {
        return jsonResponse({ success: true, token: { tokenPrefix: 'scim_new1' } });
      }
      if (url.includes('/admin/identity/scim/group-mappings')) {
        return jsonResponse({ success: true });
      }
      if (url.includes('/admin/identity/scim')) return jsonResponse(SCIM_SUMMARY);
      if (url.includes('/api/projects')) return jsonResponse(PROJECTS);
      if (url.includes('/admin/sessions')) return jsonResponse(SESSIONS);
      if (url.includes('/api/api-keys')) {
        if (method === 'POST')
          return jsonResponse({
            key: API_KEYS.keys[0],
            secret: 'csk_live_demo_secret_do_not_use',
          });
        if (method === 'DELETE') return jsonResponse({ success: true });
        return jsonResponse(API_KEYS);
      }
      if (url.includes('/admin/domains')) {
        if (url.includes('/verify')) {
          return jsonResponse({
            success: true,
            outcome: {
              status: 'verified',
              checkedNames: ['_consultify-verification.atelier-toys.io'],
              foundRecordCount: 1,
              checkedAt: new Date().toISOString(),
            },
          });
        }
        if (method === 'POST') {
          return jsonResponse({
            success: true,
            domain: DOMAINS.domains[1],
            instruction: {
              name: '_consultify-verification.atelier-toys.io',
              type: 'TXT',
              value: 'consultify-domain-verification=cvt_4d88ce',
            },
          });
        }
        if (method === 'PUT' || method === 'DELETE') return jsonResponse({ success: true });
        return jsonResponse(DOMAINS);
      }
      if (url.includes('/admin/service-accounts')) {
        if (method === 'POST') {
          return jsonResponse({
            success: true,
            data: { account: SERVICE_ACCOUNTS.data[0], token: 'sa_demo_secret_do_not_use' },
          });
        }
        if (method === 'DELETE') return jsonResponse({ success: true });
        return jsonResponse(SERVICE_ACCOUNTS);
      }
      if (url.includes('/admin/security-alerts')) return jsonResponse(SECURITY_ALERTS);
      if (url.includes('/admin/break-glass/sessions')) {
        if (method === 'POST' || method === 'DELETE') return jsonResponse(BREAK_GLASS);
        return jsonResponse(BREAK_GLASS);
      }
      if (url.includes('/admin/risk/summary')) return jsonResponse(RISK_SUMMARY);
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
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

const SECURITY_TAB_BY_SCREEN: Partial<Record<AdminSecurityScreenId, AdminSecurityIdentityTabId>> =
  {
    sso: 'policy',
    'scim-lifecycle': 'scim',
    'api-access': 'api-access',
    'risk-summary': 'risk',
  };

// Mapowanie 1:1 z AdminSettingsModule.tsx case 'security'.
function renderSecurityScreen(adminScreen: AdminSecurityScreenId): React.ReactElement {
  if (adminScreen === 'domains') return <AdminDomainsPanel />;
  if (adminScreen === 'service-accounts') return <AdminServiceAccountsPanel />;
  if (adminScreen === 'security-alerts') return <AdminSecurityAlertsPanel />;
  if (adminScreen === 'sessions') return <AdminSessionsPanel />;
  if (adminScreen === 'break-glass') return <AdminBreakGlassPanel />;
  return <AdminSecurityIdentityPanel initialTab={SECURITY_TAB_BY_SCREEN[adminScreen]} />;
}

export default function AdminSecurityScreen(props: {
  adminScreen: AdminSecurityScreenId;
}): React.ReactElement {
  // `&ekran=` w URL nadpisuje prop domyślny — pozwala odpalić dowolny z 10
  // ekranów spod jednego wpisu w main.tsx, gdyby był potrzebny ad-hoc
  // podgląd bez dodawania nowego klucza rejestru.
  const requested = new URLSearchParams(window.location.search).get(
    'ekran'
  ) as AdminSecurityScreenId | null;
  const adminScreen = requested || props.adminScreen;
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <DebugBoundary>
        <MemoryRouter initialEntries={['/']}>{renderSecurityScreen(adminScreen)}</MemoryRouter>
      </DebugBoundary>
    </div>
  );
}
