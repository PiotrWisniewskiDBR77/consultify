/**
 * Dev-render host for the REAL `<AuditsHub>` "Raporty DRD" tab (flag-gated,
 * 2026-07-26) + the REAL `<DRDAuditReportView>` it opens into.
 *
 * `isDrdReportEnabled()` (`src/utils/drdReportFlag.ts`) is OFF by default —
 * this harness force-enables it via `localStorage['ff.drdReport'] = '1'`
 * (mirrors the flag's own override mechanism) BEFORE mount, per task spec.
 * The query override `?ff_drd_report=1` still wins if present (flag
 * precedence: query > localStorage > env > default).
 *
 * Two variants, switched by `&variant=`:
 *   list (default)  — mounts `AuditsHub`. Base "Audit programs" tab gets a
 *     couple of realistic programs so the underlying `GET /api/audit/programs`
 *     (unrelated backend, always fetched on mount) doesn't error/spin. After
 *     mount, an `AutoOpenDrdTab` wrapper clicks the "Raporty DRD" tab button
 *     (real DOM, real component — no internals touched) so the harness lands
 *     directly on the list of `Api.getAssessmentReports()` — 3 realistic
 *     DRD audit reports.
 *   report — mounts `DRDAuditReportView` directly (`reportId` prop, no
 *     router param plumbing needed) with `Api.getFullReport` mocked: a
 *     3-section DRD report in Polish (streszczenie zarządcze, wynik osi,
 *     rekomendacje).
 *
 * `Api.getAssessmentReports` / `Api.getFullReport` are real methods on the
 * `Api` singleton (not routed through `apiGet`/`apiPost`), so they're patched
 * directly — no `window.fetch` needed for those two. `listPrograms` (Audit
 * Orchestrator, `./auditApi.ts`) goes through `Api.get`, patched below too.
 *
 * ★ Patched at MODULE level (see prezentacje-template-states.tsx /
 * report-builder-library-template.tsx for the full rationale): `AuditsHub`'s
 * `load()` effect fires `Api.get('/audit/programs')` on the very first mount
 * commit, before any wrapper `useEffect` in this file would run.
 *
 * URL: ?screen=audyty-drd-report[&variant=list|report][&theme=light|dark]
 */
import React, { useEffect } from 'react';

import { AuditsHub } from '../../src/components/Audit/AuditsHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { DRDAuditReportView } from '../../src/views/DRDAuditReportView';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();
try {
  window.localStorage.setItem('ff.drdReport', '1');
} catch {
  /* ignore — private mode / storage disabled */
}

const params = new URLSearchParams(window.location.search);
const variant = params.get('variant') || 'list';

const AUDIT_PROGRAMS = [
  {
    id: 'audit-prog-elkomtech-iso',
    organizationId: 'org-dbr77-demo',
    name: 'Przegląd gotowości bezpieczeństwa informacji — Elkomtech',
    description: 'Wywiady przed przeglądem zarządczym, 4 obszary kontrolne.',
    objective: 'Potwierdzić gotowość organizacji do wewnętrznego przeglądu bezpieczeństwa informacji w Q4 2026.',
    status: 'active',
    preset: 'new-company',
    config: {
      templateIds: ['tmpl-secreview-a5', 'tmpl-secreview-a9'],
      assigneeIds: ['user-anna', 'user-marek'],
      surveysGenerated: true,
      generation: { requested: 8, created: 8, failed: 0, at: '2026-07-18T10:00:00Z' },
    },
    createdBy: 'user-piotr-demo',
    createdAt: '2026-07-05T09:00:00Z',
    updatedAt: '2026-07-18T10:00:00Z',
  },
  {
    id: 'audit-prog-nordfarm-drd',
    organizationId: 'org-dbr77-demo',
    name: 'Audyt DRD — NordFarm',
    description: null,
    objective: 'Zebrać dane wejściowe do raportu dojrzałości cyfrowej NordFarm.',
    status: 'draft',
    preset: null,
    config: { templateIds: ['tmpl-drd-core'], assigneeIds: [], surveysGenerated: false },
    createdBy: 'user-piotr-demo',
    createdAt: '2026-07-20T09:00:00Z',
    updatedAt: '2026-07-22T14:00:00Z',
  },
];

const DRD_REPORTS = [
  {
    id: 'rep-drd-elkomtech-2026',
    name: 'Audyt DRD — Elkomtech 2026',
    assessmentName: 'Elkomtech — Audyt DRD 2026',
    status: 'FINAL',
    updatedAt: '2026-07-21T15:40:00Z',
  },
  {
    id: 'rep-drd-nordfarm-q2-2026',
    name: 'Audyt DRD — NordFarm, Q2 2026',
    assessmentName: 'NordFarm — ocena dojrzałości cyfrowej',
    status: 'DRAFT',
    updatedAt: '2026-07-15T09:15:00Z',
  },
  {
    id: 'rep-drd-bielmar-2025-update',
    name: 'Audyt DRD — Bielmar, aktualizacja roczna',
    assessmentName: 'Bielmar — przegląd roczny dojrzałości cyfrowej',
    status: 'FINAL',
    updatedAt: '2026-06-02T08:00:00Z',
  },
];

const FULL_REPORT = {
  id: 'rep-drd-elkomtech-2026',
  name: 'Audyt DRD — Elkomtech 2026',
  status: 'DRAFT' as const,
  assessmentId: 'assess-elkomtech-drd-2026',
  assessmentName: 'Elkomtech — Audyt DRD 2026',
  projectName: 'Elkomtech — transformacja cyfrowa',
  organizationName: 'Elkomtech Sp. z o.o.',
  axisData: {
    strategy: {
      actual: 2.4,
      target: 4.0,
      justification: 'Strategia cyfrowa nieformalna, brak mierzalnych KPI.',
    },
    process: {
      actual: 3.1,
      target: 4.0,
      justification: 'Część procesów zautomatyzowana (ERP), integracje ręczne.',
    },
    data: {
      actual: 2.0,
      target: 3.5,
      justification: 'Dane rozproszone w 5 systemach, brak jednego źródła prawdy.',
    },
    technology: {
      actual: 3.4,
      target: 4.5,
      justification: 'Infrastruktura chmurowa wdrożona, legacy w produkcji.',
    },
    people: {
      actual: 2.7,
      target: 4.0,
      justification: 'Kompetencje cyfrowe skoncentrowane w jednym zespole.',
    },
    customer: {
      actual: 3.0,
      target: 4.0,
      justification: 'Portal klienta działa, brak personalizacji.',
    },
    governance: {
      actual: 2.2,
      target: 3.5,
      justification: 'Brak formalnego komitetu sterującego IT.',
    },
  },
  sections: [
    {
      id: 'sec-exec-summary',
      reportId: 'rep-drd-elkomtech-2026',
      sectionType: 'executive_summary',
      title: 'Streszczenie zarządcze',
      content:
        'Elkomtech osiąga dziś średni wynik dojrzałości cyfrowej 2,7/5 wobec celu 4,0/5 wyznaczonego na koniec 2027. ' +
        'Największa luka dotyczy governance i danych — brak jednego źródła prawdy podnosi ryzyko błędnych decyzji ' +
        'operacyjnych. Rekomendujemy rozpoczęcie od konsolidacji danych i powołania komitetu sterującego IT, zanim ' +
        'firma zainwestuje w kolejne narzędzia automatyzacji.',
      dataSnapshot: {},
      orderIndex: 0,
      isAiGenerated: true,
      version: 2,
      updatedAt: '2026-07-21T15:40:00Z',
    },
    {
      id: 'sec-axis-scores',
      reportId: 'rep-drd-elkomtech-2026',
      sectionType: 'axis_scores',
      title: 'Wynik na 7 osiach dojrzałości',
      content:
        'Najsilniejsza oś to technologia (3,4/5) dzięki wdrożonej infrastrukturze chmurowej. Najsłabsze osie to ' +
        'governance (2,2/5) i dane (2,0/5) — obie wymagają decyzji organizacyjnych, nie tylko technologii.',
      dataSnapshot: {},
      orderIndex: 1,
      isAiGenerated: true,
      version: 1,
      updatedAt: '2026-07-20T11:00:00Z',
    },
    {
      id: 'sec-recommendations',
      reportId: 'rep-drd-elkomtech-2026',
      sectionType: 'recommendations',
      title: 'Rekomendacje i plan 90 dni',
      content:
        '1) Powołać komitet sterujący IT (miesiąc 1). 2) Zaprojektować jedno źródło prawdy dla danych klienckich ' +
        '(miesiące 1-2). 3) Zdefiniować 3 mierzalne KPI strategii cyfrowej i właścicieli (miesiąc 2). ' +
        '4) Pilotaż integracji ERP-CRM na jednym segmencie klientów (miesiąc 3).',
      dataSnapshot: {},
      orderIndex: 2,
      isAiGenerated: false,
      version: 3,
      updatedAt: '2026-07-21T09:30:00Z',
    },
  ],
  templateId: 'tpl-canon-drd-standard-elkomtech',
  createdAt: '2026-07-05T09:00:00Z',
  updatedAt: '2026-07-21T15:40:00Z',
};

function jsonEnvelope<T>(data: T): { data: T } {
  return { data };
}

const g = window as unknown as { __AUDYTY_DRD_FETCH__?: boolean };
const tenEkran = params.get('screen') === 'audyty-drd-report';
if (tenEkran && !g.__AUDYTY_DRD_FETCH__) {
  g.__AUDYTY_DRD_FETCH__ = true;

  Api.getAssessmentReports = (async () => DRD_REPORTS) as typeof Api.getAssessmentReports;
  Api.getFullReport = (async () => FULL_REPORT) as typeof Api.getFullReport;

  const realGet = Api.get.bind(Api);
  Api.get = (async (url: string) => {
    if (String(url).startsWith('/audit/programs')) {
      return jsonEnvelope({
        programs: AUDIT_PROGRAMS,
        total: AUDIT_PROGRAMS.length,
        limit: AUDIT_PROGRAMS.length,
        offset: 0,
      });
    }
    return realGet(url);
  }) as typeof Api.get;

  // Safety net for anything else the hub / heavy providers fire on mount.
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
      return new Response(JSON.stringify({ data: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

/** Clicks the real "Raporty DRD" tab button after mount — same technique as
 * `dev-render/screens/admin-sso-self-service-card.tsx` (`AutoTestWrapper`).
 * No AuditsHub internals touched; this is a DOM click on its own rendered
 * button, landing the harness on the interesting tab by default. */
function AutoOpenDrdTab({ children }: { children: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    const timer = setTimeout(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const tabButton = buttons.find((b) => (b.textContent || '').trim().includes('Raporty DRD'));
      tabButton?.click();
    }, 300);
    return () => clearTimeout(timer);
  }, []);
  return <>{children}</>;
}

export default function AudytyDrdReportScreen(): React.ReactElement {
  if (variant === 'report') {
    return (
      <AppProviders>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
          <DRDAuditReportView reportId={FULL_REPORT.id} />
        </div>
      </AppProviders>
    );
  }

  return (
    <AppProviders>
      <AutoOpenDrdTab>
        <div className="h-screen w-screen overflow-hidden bg-c-bg">
          <AuditsHub />
        </div>
      </AutoOpenDrdTab>
    </AppProviders>
  );
}
