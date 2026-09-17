/**
 * Dev-render host for the REAL `<NewAuditReportModal>` — RG-1 v2 / U-31
 * (DEC-572, Wpis 72). Pokazuje SAM MOMENT „New report → Generate" w module
 * Audyty z rolą OWNER (platform owner), czyli to, czego brakowało w zrzucie
 * Wpisu 66 (pokazywał tylko listę Reports).
 *
 * U-31 (Wpis 66) dał OWNER-owi platformy capability `report.draft`
 * (`permissions.ts`), więc OWNER bez wpisu w `audit_program_members` MOŻE
 * wytworzyć szkic raportu audytu — ten ekran pokazuje frontowy moment tego
 * kliknięcia: modal otwarty, wybrany wynik audytu (source), przycisk
 * „Generate" AKTYWNY. Dowód capability (RealPG, OWNER bez członkostwa
 * przechodzi bramkę `report.draft`, approve/publish odmówione) jest w teście
 * `platformOwnerReportDraft.realdb.test.ts` (Wpis 66).
 *
 * Komponent REALNY; mockujemy tylko `Api.get('/audits/outputs')` i
 * `Api.post('/audits/reports/generate')` podwójną kopertą
 * `{ data: { success:true, data } }` (kontrakt `auditsMethodApi.ts`, wzorzec
 * `audyty-piec-powierzchni.tsx`). Wybór wyniku robi klik `--click='[role="option"]'`
 * w shot.mjs, więc „Generate" jest aktywny na zrzucie.
 *
 * URL: ?screen=rg1-audits-generate-owner[&theme=light|dark]
 */
import React from 'react';

import { NewAuditReportModal } from '../../src/components/Audit/method/NewAuditReportModal';
import i18n from '../../src/i18n';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

void i18n.changeLanguage('en');
useAppStore.setState({
  theme: window.location.search.includes('theme=dark') ? 'dark' : 'light',
} as any);
// Rola OWNER (platform owner) — to jego moment „Generate" (U-31 / report.draft).
useAppStore.setState({
  user: {
    ...(useAppStore.getState().user as object),
    id: 'user-platform-owner',
    role: 'OWNER',
    platformRole: 'owner',
  },
} as any);

function envelope<T>(data: T): { data: { success: true; data: T } } {
  return { data: { success: true, data } };
}

const OUTPUTS = {
  items: [
    {
      id: 'out-northwind-audit-2026-q3',
      programId: 'prog-northwind-iso27001',
      programName: 'Northwind — ISO 27001 audit programme',
      title: 'Q3 2026 surveillance audit — finalized result',
      version: 2,
      finalizedAt: '2026-09-10T09:30:00.000Z',
      supersededBy: null,
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

{
  const originalGet = Api.get.bind(Api);
  const originalPost = Api.post.bind(Api);
  Api.get = (async (url: string, ...rest: unknown[]) => {
    if (url.startsWith('/audits/outputs')) return envelope(OUTPUTS);
    if (url.startsWith('/audits/')) return envelope({ items: [], total: 0 });
    return (originalGet as any)(url, ...rest);
  }) as typeof Api.get;
  Api.post = (async (url: string, ...rest: unknown[]) => {
    if (url.startsWith('/audits/')) {
      return envelope({
        id: 'audit-report-owner-draft',
        programId: 'prog-northwind-iso27001',
        status: 'draft',
        title: 'Q3 2026 surveillance audit — report',
      });
    }
    return (originalPost as any)(url, ...rest);
  }) as typeof Api.post;

  // OrgContext/UserProfileMenu/flags sięgają po surowe `window.fetch` (nie po
  // singleton `Api`) — bez tej zapadki harness loguje 404 na
  // `/api/organizations/current` i `/api/v8/admin/flags` (bledyKonsoli≠0).
  // Przepuszczamy `/locales/`, resztę `/api/` gasimy benigniczną kopertą.
  const realFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/')) {
      return new Response(JSON.stringify({ data: [], items: [], organizations: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof window.fetch;
}

export default function Rg1AuditsGenerateOwnerScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ minHeight: '100vh', padding: 24 }}>
        <NewAuditReportModal
          open
          onClose={() => {}}
          isPolish={false}
          onFinalizeSession={() => {}}
          onGenerated={() => {}}
        />
      </div>
    </AppProviders>
  );
}
