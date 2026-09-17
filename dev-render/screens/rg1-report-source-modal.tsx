/**
 * Dev-render host for the REAL `<NewAssessmentReportModal>` — RG-1 / U-25
 * (DEC-572, Wpis 66). Pokazuje dwa stany modalu PO naprawie `reportSourceId`:
 *
 *   variant=twin     (DOMYŚLNY) — sesja Method Core MA legacy bliźniaka
 *     `assessments` (`reportSourceId` = id bliźniaka). Modal wysyła do
 *     `/report-builder` jako `sourceId` id bliźniaka, NIE `method_sessions.id`,
 *     więc „Create draft" jest aktywny.
 *   variant=nosource — sesja Method Core BEZ bliźniaka (`reportSourceId=null`,
 *     stan zmierzony na kopii dumpu stagingu: 0 z 20 sesji ma bliźniaka).
 *     Zamiast mylącego „Assessment not found" z backendu modal blokuje
 *     „Create draft" i pokazuje czytelny komunikat EN „This session has no
 *     report source yet — freeze it first".
 *
 * Komponent jest REALNY (zero re-implementacji UI); mockujemy tylko prop
 * `assessments` — tak samo robi test komponentu
 * `src/components/assessment/__tests__/NewAssessmentReportModal.reportSource.test.tsx`.
 *
 * URL: ?screen=rg1-report-source-modal[&variant=twin|nosource][&theme=light|dark]
 */
import React from 'react';

import { NewAssessmentReportModal } from '../../src/components/assessment/modals/NewAssessmentReportModal';
import i18n from '../../src/i18n';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const variant = params.get('variant') || 'twin';

// Wymuś EN (interfejs i nowe treści po angielsku, DEC-461) — i18next inaczej
// weźmie navigator/localStorage, a zrzut ma być kanonicznie EN.
void i18n.changeLanguage('en');

useAppStore.setState({
  theme: params.get('theme') === 'dark' ? 'dark' : 'light',
} as any);

// `AppProviders` (OrgContext, flagi) strzela do `/api/...` w pierwszym commicie;
// bez backendu byłyby 404 i błąd konsoli (bramka wymaga bledyKonsoli=0), więc
// te dwie ścieżki odpowiadają pustym payloadem — wzorzec z
// `report-builder-library-template.tsx`.
{
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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
  };
}

const TEMPLATE = {
  id: 'tpl-drd-standard',
  name: 'Digital Readiness Diagnosis — standard report',
  description:
    'Executive summary, 7-axis maturity result, gap analysis, recommendations and a 90-day action plan.',
  reportType: 'drd_maturity',
};

const ASSESSMENTS =
  variant === 'nosource'
    ? [
        {
          id: 'sess-drd-northwind-0007',
          name: 'DRD · Northwind Manufacturing (frozen, no legacy twin)',
          status: 'APPROVED',
          type: 'DRD',
          reportSourceId: null,
        },
      ]
    : [
        {
          id: 'sess-drd-northwind-0003',
          name: 'DRD · Northwind Manufacturing 2026',
          status: 'APPROVED',
          type: 'DRD',
          reportSourceId: 'assess-northwind-drd-2026',
        },
      ];

export default function Rg1ReportSourceModalScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ minHeight: '100vh', padding: 24 }}>
        <NewAssessmentReportModal
          isOpen
          assessments={ASSESSMENTS as any}
          onClose={() => {}}
          onCreated={() => {}}
          initialTemplate={TEMPLATE}
          lockTemplate
        />
      </div>
    </AppProviders>
  );
}
