/**
 * Vegas-render — dev-render host for the REAL `<InsightViewer>` (archetyp
 * C·Rekord w kanonie SPEC-A, src/components/Interview/InsightViewer.tsx).
 *
 * Cel: pozwolić nadzorcy sesji zrobić zrzut PRAWDZIWEGO ekranu-artefaktu
 * Insight — z powłoką `NModeShell` (Menu 1 + lewy rail sekcji + centrum
 * kart N-mode) i `ArtifactRightPanel` (Akcje·Właściwości·Powiązania·
 * Źródła i założenia·Komentarze·Historia/AI) — ZANIM zobaczy go Piotr
 * (CLAUDE.md #7). Dev-only, nigdy nie wchodzi do bundla produkcyjnego.
 *
 * `InsightViewer` jest komponentem PRODUKCYJNYM — bez re-implementacji.
 * Przyjmuje tylko `{ insightId, onClose, onRegenerate?, onSaved? }` i sam
 * ładuje resztę wewnętrznie. Ma już wbudowany tryb demo (patrz
 * `src/components/Interview/interviewDemoData.ts` — `isInterviewDemoId` /
 * `createInterviewDemoDataset`): dla insightId zaczynającego się od
 * `demo-interview-` komponent NIGDY nie odpytuje sieci (branch
 * `applyDemoInsight` w efekcie `loadInsight`, patrz InsightViewer.tsx:1399),
 * więc harness nie musi mockować `V8InterviewApi.getInsight` w ogóle.
 *
 * Wybrany insight demo: `demo-interview-insight-northstar-summary`
 * ("Executive Summary — NorthStar Digital Readiness") — ma bogate themes/
 * issues/opportunities z `evidence_refs` (= "hipoteza" wspierana dowodami
 * wprost w centrum N-mode: karty Tematy/Problemy/Szanse).
 *
 * Dwie rzeczy komponent i tak odpytuje siecią niezależnie od trybu demo
 * (własny fetch, poza `loadInsight`):
 *   1. `EvidencePanelSection` (prawy panel, sekcja "Źródła i założenia") —
 *      `fetchEvidenceEnvelope('insight', insightId)` → GET
 *      `/api/evidence/insight/<id>`. Fail-open (null → puste), ale tu
 *      podstawiamy realistyczny envelope, żeby sekcja evidence nie była pusta
 *      na zrzucie.
 *   2. `Api.getInitiatives()` — używane w handoff-modalu ("Powiąż z
 *      istniejącą inicjatywą") ORAZ w liście, którą `InitiativeGeneratorModal`
 *      reconciluje przy "Konwertuj na inicjatywę" (Menu 1 primary). Tu
 *      podstawiamy 3 inicjatywy tematycznie związane z opportunities tego
 *      insightu (= "downstream inicjatywy").
 *
 * Wzorzec 1:1 z `dev-render/screens/melscanvas-workspace.tsx`: seed sesji
 * (`seedRealisticSession`) + `AppProviders` (BrowserRouter/V8Provider/
 * OrgProvider/... — realny provider tree, bo `currentUser.id` jest ustawiony)
 * + `FeatureFlagsProvider` + monkey-patch `Api.*` (obiekt, nie ESM named
 * export — można nadpisać właściwość) + fetch safety-net dla reszty
 * wywołań w tle (presence/notifications/knowledge-cards), żeby konsola nie
 * pluła błędami JSON-parse na HTML z dev-servera Vite.
 *
 * URL params: ?screen=insight-artifact &lang=pl|en &theme=light|dark
 * (obsługiwane przez dev-render/main.tsx — patrz RAPORT dla linii do wpięcia).
 */
import React from 'react';

import { InsightViewer } from '../../src/components/Interview/InsightViewer';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import i18n from '../../src/i18n';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

// Demo id recognized natively by InsightViewer's `isInterviewDemoId` /
// `applyDemoInsight` branch — zero network for the core insight payload.
const DEMO_INSIGHT_ID = 'demo-interview-insight-northstar-summary';

// ── Downstream initiatives (Api.getInitiatives) ─────────────────────────────
// Tematycznie powiązane z "Opportunities" insightu NorthStar — pokazywane w
// handoff-modalu ("Powiąż z istniejącą") i w InitiativeGeneratorModal przy
// "Konwertuj na inicjatywę" (Menu 1 primary action tego artefaktu).
const MOCK_DOWNSTREAM_INITIATIVES = [
  {
    id: 'init-northstar-governance-redesign',
    title: 'Redesign zarządzania wydaniami (jedna ścieżka zatwierdzeń)',
    name: 'Redesign zarządzania wydaniami (jedna ścieżka zatwierdzeń)',
    status: 'in_progress',
  },
  {
    id: 'init-northstar-benefits-scorecard',
    title: 'Portfelowy scorecard korzyści (wspólne metryki)',
    name: 'Portfelowy scorecard korzyści (wspólne metryki)',
    status: 'planned',
  },
  {
    id: 'init-northstar-exception-handling',
    title: 'Redesign obsługi wyjątków klienckich (pierwszy dowód)',
    name: 'Redesign obsługi wyjątków klienckich (pierwszy dowód)',
    status: 'planned',
  },
];

Api.getInitiatives = (async () => MOCK_DOWNSTREAM_INITIATIVES) as typeof Api.getInitiatives;

// ── Evidence envelope (ArtifactRightPanel → "Źródła i założenia") ──────────
const nowIso = new Date().toISOString();
const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const MOCK_EVIDENCE_ENVELOPE = {
  envelope: {
    id: 'evidence-envelope-northstar-summary',
    organizationId: 'org-dbr77-demo',
    artifactType: 'insight',
    artifactId: DEMO_INSIGHT_ID,
    sources: [
      {
        type: 'interview',
        ref: 'demo-interview-session-northstar',
        snippet: '"We have good projects, but not yet a good portfolio story." — CIO, NorthStar',
      },
      {
        type: 'document',
        ref: 'NorthStar_Release_Governance_Playbook_v3.pdf',
        snippet:
          'Serial sign-off Product → Data → Security → Branch Ops dodaje ok. 11 tygodni do czasu realizacji wydania.',
      },
      {
        type: 'benchmark',
        ref: 'DBR77 Digital Portfolio Benchmark 2025',
        snippet:
          'Portfele górnego kwartyla stosują równoległe bramki zatwierdzeń; mediana czasu realizacji 4-5 tygodni.',
      },
    ],
    assumptions: [
      {
        key: 'release_lead_time_weeks',
        value: 11,
        source_type: 'imported',
        rationale: 'Z sesji wywiadu z liderem Operacji + log zatwierdzeń w systemie release.',
        confidence: 0.82,
      },
      {
        key: 'benefits_scorecard_adoption',
        value: 'brak wspólnego formatu między inicjatywami',
        source_type: 'ai_assumed',
        rationale: 'Wnioskowane z rozbieżnych narracji 4 właścicieli inicjatyw cyfrowych.',
        confidence: 0.6,
      },
    ],
    confidence: 0.78,
    confidenceLabel: 'high',
    toVerify: [
      {
        claim: 'Rzeczywisty czas realizacji od pomysłu do wydania wynosi ok. 11 tygodni.',
        why: 'Dane pochodzą z jednej sesji wywiadu — brak potwierdzenia z logów systemowych.',
        suggested_check: 'Zweryfikuj w logu release (Jira/ServiceNow) za ostatnie 2 kwartały.',
      },
    ],
    computedBy: { service: 'insightEvidenceAggregator', version: 'v1', at: daysAgoIso(23) },
    createdBy: 'user-piotr-demo',
    createdAt: daysAgoIso(23),
    updatedAt: nowIso,
  },
};

// Safety net: wszystko inne, co ten ciężki komponent (+ provider tree:
// presence/notifications/knowledge-cards) odpali w tle, dostaje neutralną
// odpowiedź zamiast trafiać do dev-server Vite i wywalać JSON-parse w
// konsoli. `/locales/**` i `/evidence/insight/` przechodzą do realnej
// obsługi (i18n) / mocka evidence zdefiniowanego wyżej.
//
// `dev-render/main.tsx` importuje WSZYSTKIE ekrany statycznie (rejestr
// `SCREENS`), więc top-level side-effecty KAŻDEGO ekranu (np.
// `melscanvas-workspace.tsx`, `zwornik-projects.tsx` — też patchują
// `window.fetch`) wykonują się przy KAŻDYM ładowaniu strony, niezależnie od
// wybranego `?screen=`. Instalacja w kolejności importów (alfabetycznej)
// oznacza, że patch zainstalowany później (np. `zwornik-projects`, litera
// Z) owija ten zainstalowany wcześniej — a szerokie dopasowanie innego
// ekranu (`/api/` catch-all w melscanvas) potrafi połknąć nasze żądanie
// `/api/evidence/insight/...` ZANIM dotrze do naszego bardziej
// specyficznego warunku. Instalacja odroczona o jeden tick (`setTimeout`)
// gwarantuje, że NASZ patch zostanie zainstalowany jako OSTATNI (a więc
// najbardziej zewnętrzny) — jego specyficzne dopasowania widzą żądanie
// jako pierwsze, zanim jakikolwiek szerszy fallback innego ekranu zdąży je
// przechwycić. Ten mechanizm żyje WYŁĄCZNIE w tym pliku — main.tsx i inne
// ekrany pozostają nietknięte.
const g = window as unknown as { __INSIGHT_ARTIFACT_FETCH__?: boolean };
if (!g.__INSIGHT_ARTIFACT_FETCH__) {
  g.__INSIGHT_ARTIFACT_FETCH__ = true;
  setTimeout(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
      if (url.includes('/evidence/insight/')) {
        return new Response(JSON.stringify(MOCK_EVIDENCE_ENVELOPE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // OrgContext expects `{ organizations: [...] }` (or a bare array) — the
      // generic `{ data: [], items: [] }` fallback below makes its
      // `orgs.find(...)` throw a TypeError (harmless — caught, just noisy).
      if (url.includes('/organizations/current')) {
        return new Response(JSON.stringify({ organizations: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/') || url.includes('/interview/') || url.includes('/my-work/')) {
        return new Response(JSON.stringify({ data: [], items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return realFetch(input as RequestInfo, init);
    };
  }, 0);
}

// ── i18n readiness gate ──────────────────────────────────────────────────
// InsightViewer's ArtifactRightPanel formats dates via
// `d.toLocaleDateString(t('interview.insightViewer.enUs'), {...})` — it
// expects `t()` to already resolve to a real BCP-47 tag ('pl-PL'/'en-US').
// In the real app this is safe because i18n has long finished loading by
// the time a user opens an Insight. In this standalone harness the first
// paint can race the async HttpBackend fetch of `/locales/**`, so `t()`
// still returns the raw key — an invalid language tag — and
// `toLocaleDateString` throws, tripping the app's real `<ErrorBoundary>`.
// Gate the mount on the translation bundle actually being loaded (harness
// concern only — no change to InsightViewer.tsx itself).
function useI18nReady(): boolean {
  const [ready, setReady] = React.useState(() =>
    i18n.hasResourceBundle(i18n.language, 'translation')
  );
  React.useEffect(() => {
    if (ready) return;
    const check = () => {
      if (i18n.hasResourceBundle(i18n.language, 'translation')) setReady(true);
    };
    i18n.on('loaded', check);
    i18n.on('languageChanged', check);
    check();
    return () => {
      i18n.off('loaded', check);
      i18n.off('languageChanged', check);
    };
  }, [ready]);
  return ready;
}

export function InsightArtifactScreen(): React.ReactElement {
  const i18nReady = useI18nReady();
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
          {i18nReady ? (
            <InsightViewer
              key={`insight-artifact-${DEMO_INSIGHT_ID}`}
              insightId={DEMO_INSIGHT_ID}
              onClose={() => {}}
              onRegenerate={async () => {}}
              onSaved={() => {}}
            />
          ) : null}
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default InsightArtifactScreen;
