/**
 * Dev-render: REALNY <ExecutionHub> montowany na wskazanej zakładce.
 *
 * Rejestr grafiki (docs/program/grafika/status.json, moduł 07-realizacja)
 * pokrywał dotąd tylko zakładkę "Raporty" (via execution-report-day11 /
 * inne ekrany report-intelligence). ExecutionHub ma 8 zakładek
 * (list/reports/work/resources/control/rollout/summary/people_change) —
 * ten plik montuje pozostałe 7 (main.tsx rejestruje je jako
 * execution-tab-<nazwa>, każdy wpis podaje `tab` na sztywno w kodzie).
 *
 * DLACZEGO `tab` jest propsem `initialTab`, nie parametrem URL `&tab=`:
 * ExecutionHub ma WŁASNĄ logikę deep-linku (ExecutionHub.tsx ok. linii 950-980),
 * która rozpoznaje `?tab=` tylko dla list/work/resources/control/reports/rollout.
 * `summary` i `people_change` NIE są w tej liście — są to zakładki
 * "chromeless" (bez chrome StandardModuleBar dokumentów), osiągane w produkcie
 * przez klik z action center (np. `setActiveTab('people_change')` przy
 * "KPI deviation without plan", ExecutionHub.tsx:4134), nie przez URL. Gdyby
 * ten ekran polegał na `&tab=summary` w adresie, ExecutionHub po prostu by go
 * zignorował i wylądował na domyślnym 'list'. Ustawiając `initialTab` wprost
 * w propsie (który zasila `useState<ModuleTab>(initialTab)`, ExecutionHub.tsx:755)
 * omijamy tę asymetrię i montujemy WSZYSTKIE 7 zakładek tą samą, spójną drogą.
 *
 * DANE: `seedRealisticSession()` ustawia isDemoMode:true. ExecutionHub sam
 * nie jest mockowany — w środowisku dev-render (DEV, brak backendu) realne
 * wywołania sieciowe kończą się błędem, a produkt ma WŁASNE ścieżki
 * degradacji na demo-dane:
 *   - 'list' (Portfolio): loadInitiatives() catch → executionDemoData.initiatives
 *     (isDemoSample:true + widoczny banner "Sample data — source unavailable").
 *   - 'work'/'resources'/'control'/'reports': ExecutionWorkSurface/
 *     ExecutionResourcesSurface/ExecutionControlSurface/ExecutionReportsSurface
 *     mają executionLocalReviewEnabled (DEV && MODE!=='test') → po nieudanym
 *     fetchu spadają na executionReviewCases/getExecutionReviewWork/... z
 *     ./executionLocalReviewData.ts (realne polskie dane, 2 executionCase'y:
 *     Supply Chain Optimization, Procurement AI Copilot).
 *   - 'rollout': RolloutTab pokazuje derivedKpis/derivedRisks/derivedClosures
 *     wyliczone z `initiatives` (demo-fallback z listy) gdy /rollout/* jest puste.
 *   - 'summary': ExecutionSummaryOneLook jest czysto props-driven (zero fetch) —
 *     dane liczone w ExecutionHub z tego samego demo-fallbacku portfela.
 *     Flaga `summaryOneLook` domyślnie ON poza public-prod (isPublicProductionHost),
 *     więc na localhost renderuje się bez dodatkowego przełącznika — mimo
 *     komentarza w kodzie "Default OFF do akceptu Piotra" (patrz ZGŁASZAM w
 *     raporcie sesji: sprzeczność flagi, ta sama rodzina co DEC-317).
 *   - 'people_change': ExecutionManagementView czyta managerLaneCounts
 *     (V8ExecutionControlApi.getManagerProblems per lane) — przy nieudanym
 *     fetchu liczniki zerują się per-lane (Promise.allSettled), więc ten
 *     ekran może pokazać uboższą treść niż pozostałe; patrz ZGŁASZAM.
 */
import React from 'react';

import { ExecutionHub } from '../../src/components/Execution/ExecutionHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

/**
 * ZGŁASZAM (znalezione przy budowie tego ekranu, nie naprawiam — kod produktu):
 * `RolloutTab.tsx:987` — `if (error) return <HubWorkAreaLoadError .../>` gasi
 * WSZYSTKO, zanim kod w ogóle dotrze do `showDerivedKpis`/`showDerivedRisks`/
 * `showDerivedClosures` (linie 401-403, 1053, 1108, 1217) — czyli do gałęzi,
 * która ma pokazać "Derived from your initiatives" zamiast pustki. Backend
 * `/rollout/kpis|risks|changes|closures` jest realnie zaimplementowany
 * (server/src/routes/rollout.routes.ts), więc na produkcji z działającym API
 * to nieszkodliwe — ale KAŻDY prawdziwy błąd sieci (nie tylko brak backendu
 * jak tu w dev-render) blokuje całą zakładkę pełnoekranowym błędem zamiast
 * pokazać przygotowaną ścieżkę degradacji. Tu w harnessie mockujemy te 4
 * trasy, żeby zrzut pokazywał TREŚĆ (rejestr Rollout), nie ten błąd.
 */
/**
 * ZGŁASZAM #2: `ExecutionManagementView.tsx` (zakładka people_change) renderuje
 * banner "V8 is not enabled on this environment" PO ANGIELSKU na w pełni
 * polskim ekranie (execution.hub jest spolszczony wszędzie indziej) — brak
 * `t(...)` na tym komunikacie. Bez mocka `/api/v8/execution-control/manager/
 * lanes/*\/problems` wszystkie 6 torów pokazuje same zera (managerLaneCounts
 * zeruje się przy Promise.allSettled na nieudanym fetchu, ExecutionHub.tsx
 * ok. linii 1451-1484) — mockujemy więc te trasy tak samo jak /rollout/*,
 * plus `/benefits-register/benefits` (BenefitsRegisterPanel.tsx:59), żeby
 * ta zakładka też pokazywała treść, nie pustą tabelę + błąd uprawnień.
 */
let executionFetchMockInstalled = false;
function installExecutionFetchMock(): void {
  if (executionFetchMockInstalled) return;
  executionFetchMockInstalled = true;
  const realFetch = globalThis.fetch.bind(globalThis);
  const json = (value: unknown) =>
    new Response(JSON.stringify(value), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/rollout/kpis/') && url.includes('/history')) {
      const points = [58, 61, 65, 67, 71, 74];
      return json({ history: points.map((value) => ({ value })) });
    }
    if (url.includes('/rollout/kpis')) {
      return json({
        kpis: [
          {
            id: 'kpi-lead-time',
            name: 'Czas realizacji zamówienia (dni)',
            baseline: 12,
            target: 6,
            current_value: 8,
            unit: 'dni',
          },
          {
            id: 'kpi-forecast-accuracy',
            name: 'Dokładność prognozy popytu',
            baseline: 62,
            target: 90,
            current_value: 74,
            unit: '%',
          },
          {
            id: 'kpi-copilot-adoption',
            name: 'Adopcja AI Copilot wśród kupców',
            baseline: 0,
            target: 80,
            current_value: 35,
            unit: '%',
          },
        ],
      });
    }
    if (url.includes('/rollout/risks')) {
      return json({
        risks: [
          {
            id: 'risk-supplier-data',
            title: 'Niekompletne dane 20 kluczowych dostawców opóźniają model popytu',
            probability: 'medium',
            impact: 'high',
            mitigation: 'Równoległa walidacja dwóch źródeł danych',
            status: 'OPEN',
          },
          {
            id: 'risk-capacity',
            title: 'Przeciążenie zespołu Data Science w tygodniu 35',
            probability: 'high',
            impact: 'medium',
            mitigation: 'Przesunięcie 10h na zastępstwo',
            status: 'MITIGATED',
          },
          {
            id: 'risk-copilot-guardrails',
            title: 'Guardraile odpowiedzi zakupowych niezatwierdzone przed pilotażem',
            probability: 'low',
            impact: 'high',
            mitigation: null,
            status: 'OPEN',
          },
        ],
      });
    }
    if (url.includes('/rollout/changes')) {
      return json({
        changes: [
          {
            id: 'change-scope-supply',
            title: 'Rozszerzenie pilotażu o 2 dodatkowe magazyny',
            type: 'SCOPE',
            status: 'APPROVED',
            impact: '+3 dni do harmonogramu',
          },
          {
            id: 'change-copilot-categories',
            title: 'Ograniczenie pilotażu Copilota do dwóch kategorii zakupowych',
            type: 'SCOPE',
            status: 'IMPLEMENTED',
            impact: 'Zmniejszone ryzyko, bez wpływu na termin',
          },
          {
            id: 'change-budget-capex',
            title: 'Dodatkowy budżet CAPEX na linię pakowania',
            type: 'BUDGET',
            status: 'PROPOSED',
            impact: 'Oczekuje na akcept sponsora',
          },
        ],
      });
    }
    if (url.includes('/rollout/closures')) {
      return json({
        closures: [
          {
            id: 'closure-handover-doc',
            title: 'Dokumentacja przekazania właścicielowi operacyjnemu',
            category: 'Dokumentacja',
            status: 'DONE',
          },
          {
            id: 'closure-lessons-learned',
            title: 'Retrospektywa fali 1 (lessons learned)',
            category: 'Retrospektywa',
            status: 'OPEN',
          },
          {
            id: 'closure-signoff',
            title: 'Podpis sponsora — zamknięcie fazy pilotażu',
            category: 'Akcept',
            status: 'OPEN',
          },
        ],
      });
    }
    if (url.includes('/execution-control/manager/lanes/action-queue/problems')) {
      return json({
        data: {
          count: 2,
          problems: [
            {
              id: 'problem-decision-forecast',
              severity: 'critical',
              problemType: 'OVERDUE_DECISION',
              title: 'Decyzja o źródle prognozy popytu przeterminowana',
              rootCause: 'Dwa źródła danych podają rozbieżne wielkości o 14%',
              sourceEntityType: 'DECISION',
              sourceEntityId: 'decision-forecast-source',
              sourceEntityName: 'Wybór kanonicznego źródła prognozy popytu',
              ownerId: 'piotr-wisniewski',
              ownerName: 'Piotr Wiśniewski',
              daysOverdue: 6,
              impactCount: 2,
              affectedEntities: [],
              actions: [],
              meta: {},
            },
            {
              id: 'problem-task-demand-blocked',
              severity: 'warning',
              problemType: 'BLOCKED_TASK',
              title: 'Kalibracja modelu popytu zablokowana',
              rootCause: 'Czeka na decyzję o źródle prognozy',
              sourceEntityType: 'TASK',
              sourceEntityId: 'task-demand-model',
              sourceEntityName: 'Skalibrować model prognozowania popytu',
              ownerId: 'marek-nowak',
              ownerName: 'Marek Nowak',
              daysOverdue: 3,
              impactCount: 1,
              affectedEntities: [],
              actions: [],
              meta: {},
            },
          ],
        },
      });
    }
    if (url.includes('/execution-control/manager/lanes/blockers/problems')) {
      return json({
        data: {
          count: 1,
          problems: [
            {
              id: 'problem-master-data-blocked',
              severity: 'critical',
              problemType: 'BLOCKED_INITIATIVE',
              title: 'Master Data Foundation zablokowana',
              rootCause: 'Brak akceptu budżetu CAPEX na linię pakowania',
              sourceEntityType: 'INITIATIVE',
              sourceEntityId: 'demo-init-master-data',
              sourceEntityName: 'Master Data Foundation',
              ownerId: 'omar-haddad',
              ownerName: 'Omar Haddad',
              daysOverdue: null,
              impactCount: 3,
              affectedEntities: [],
              actions: [],
              meta: {},
            },
          ],
        },
      });
    }
    if (url.includes('/execution-control/manager/lanes/workload/problems')) {
      return json({
        data: {
          count: 1,
          problems: [
            {
              id: 'problem-marek-overload',
              severity: 'warning',
              problemType: 'CAPACITY_CONFLICT',
              title: 'Marek Nowak przeciążony w tygodniu 35',
              rootCause: 'Zapotrzebowanie 38h przy dostępności 28h',
              sourceEntityType: 'PERSON',
              sourceEntityId: 'marek-nowak',
              sourceEntityName: 'Marek Nowak',
              ownerId: 'marek-nowak',
              ownerName: 'Marek Nowak',
              daysOverdue: null,
              impactCount: 1,
              affectedEntities: [],
              actions: [],
              meta: {},
            },
          ],
        },
      });
    }
    if (url.includes('/execution-control/manager/lanes/') && url.includes('/problems')) {
      // decisions / risk / people-change: brak dodatkowego kompletu w tym
      // mocku — realny (pusty) kształt odpowiedzi, nie błąd.
      return json({ data: { count: 0, problems: [] } });
    }
    if (url.includes('/benefits-register/benefits')) {
      return json({
        benefits: [
          {
            id: 'benefit-lead-time',
            name: 'Skrócenie czasu realizacji zamówienia',
            kpi_name: 'Czas realizacji (dni)',
            owner_id: 'omar-haddad',
            baseline_value: 12,
            target_value: 6,
            current_value: 8,
            cadence: 'monthly',
            status: 'tracking',
            source: 'M14_CLOSURE_HANDOFF',
            initiative_id: 'demo-init-supply-chain',
          },
          {
            id: 'benefit-copilot-time-saved',
            name: 'Czas zaoszczędzony na przygotowaniu briefów zakupowych',
            kpi_name: 'Godziny / tydzień',
            owner_id: 'lena-meyer',
            baseline_value: 0,
            target_value: 20,
            current_value: 9,
            cadence: 'weekly',
            status: 'at_risk',
            source: null,
            initiative_id: 'demo-init-ai-copilot',
          },
        ],
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

export default function ExecutionTabScreen({ tab }: { tab: string }) {
  if (tab === 'rollout' || tab === 'people_change') installExecutionFetchMock();
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <ExecutionHub initialTab={tab as any} />
      </div>
    </AppProviders>
  );
}
