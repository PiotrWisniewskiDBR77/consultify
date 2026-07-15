/**
 * Dev-render host for the REAL `<AdminSsoSelfServiceCard />` (HP-24: org-admin
 * configures their OWN organization's SAML/OIDC IdP metadata, without
 * superadmin involvement — src/components/Admin/AdminSsoSelfServiceCard.tsx,
 * freshly tokenized to c-* this session, behind `ssoSelfServiceFlag`,
 * default OFF).
 *
 * State photographed: an already-CONFIGURED SAML setup (2 mapped domains,
 * certificate "on file") + a completed "Test connection" result panel, so
 * both the steady-state form AND the test-result banner are visible in one
 * screenshot.
 *
 * No re-implementation: the component calls `Api.getAdminSsoSelfConfig() /
 * updateAdminSsoSelfConfig() / validateAdminSsoSelfConfig()` (services/api.ts
 * → `fetch('/api/admin/sso-self...')`), so we stub `window.fetch` with the
 * real `{organizationId, config}` / `{valid, errors}` response shapes
 * (server/src/routes/adminP32.routes.ts:2715-2768). Stub is narrow (scoped to
 * `/admin/sso-self` substrings), not a `/api/*` catch-all — see
 * i18n-fala1-smoke.tsx header comment for the trap this avoids.
 *
 * KNOWN ISSUE (not fixed here — component, not story; task scope is
 * screenshots only): the header icon uses `text-primary-500`
 * (AdminSsoSelfServiceCard.tsx:208) — tailwind `primary` = crimson #85182F
 * (CLAUDE.md pułapka #1). Visible as a small red shield icon in the zrzut.
 */
import React from 'react';

import { AdminSsoSelfServiceCard } from '../../src/components/Admin/AdminSsoSelfServiceCard';

const SSO_CONFIG = {
  organizationId: 'org-atelier-toys-0001',
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

const VALIDATION_RESULT = { valid: true, errors: [] as string[] };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Idempotent across HMR; scoped by `/admin/sso-self` URL substring only.
const g = window as unknown as { __ADMIN_SSO_SELF_FETCH__?: boolean };
if (!g.__ADMIN_SSO_SELF_FETCH__) {
  g.__ADMIN_SSO_SELF_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      if (url.includes('/admin/sso-self/validate')) {
        return jsonResponse(VALIDATION_RESULT);
      }
      if (url.includes('/admin/sso-self')) {
        if (method === 'PUT') {
          return jsonResponse({ success: true, config: SSO_CONFIG });
        }
        return jsonResponse({ organizationId: SSO_CONFIG.organizationId, config: SSO_CONFIG });
      }
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

// The screen mounts with a "Test connection" already run (matches the task's
// requested state: configured card + test-result panel), so we click it once
// on mount rather than requiring a manual interaction before the screenshot.
// Matched by position (first button in the bottom action row), not by label
// text — the label is i18n'd (`?lang=pl` renders "Testuj połączenie", not
// "Test connection").
function AutoTestWrapper(): React.ReactElement {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const actionRow = document.querySelector('.justify-end.gap-3');
      const btn = actionRow?.querySelector('button');
      (btn as HTMLButtonElement | null)?.click();
    }, 300);
    return () => clearTimeout(timer);
  }, []);
  return <AdminSsoSelfServiceCard />;
}

export default function AdminSsoSelfServiceCardScreen(): React.ReactElement {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <DebugBoundary>
        <AutoTestWrapper />
      </DebugBoundary>
    </div>
  );
}
