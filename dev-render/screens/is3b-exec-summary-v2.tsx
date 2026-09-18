/**
 * dev-render — host dla PRAWDZIWEJ karty `<InsightViewer>` w wariancie
 * IS-3b v2 (Wpis 123 pkt 1 + pkt 3, DEC-510/U-08): Executive Summary jako
 * TRZY nazwane sekcje prozy („What we heard" / „What it means" / „What to do")
 * oraz jawny stan pusty z akcją Regenerate.
 *
 * Ekran wymaga flagi `VITE_INTERVIEW_EXEC_SUMMARY_PROSE=true` (patrz nagłówek
 * zadania: zrzut ON). Bez flagi sekcja wraca do Callouta (stan OFF).
 *
 * `?variant=sections` (domyślnie) — model-response shape: trzy nazwane sekcje
 *   rozdzielone pustą linią (`\n\n`), dokładnie jak zwraca generator po zmianie
 *   promptu. `?variant=empty` — `executiveSummary` i `content` puste → sekcja
 *   renderuje jawny stan pusty „Summary not generated yet." + przycisk Regenerate.
 *
 * URL: ?screen=is3b-exec-summary-v2[&variant=sections|empty][&lang=en|pl][&theme=light|dark]
 *
 * Wzorzec hosta (fetch-net, bramka i18n, patch singletona V8InterviewApi)
 * przepisany z `dev-render/screens/karta-insight.tsx` — ten plik niczego poza
 * sobą i rejestrem w main.tsx nie dotyka.
 */
import React from 'react';

import { InsightViewer } from '../../src/components/Interview/InsightViewer';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import i18n from '../../src/i18n';
import { AppProviders } from '../../src/providers/AppProviders';
import { V8InterviewApi } from '../../src/services/api/v8/interview';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
useAppStore.setState({
  theme: params.get('theme') === 'dark' ? 'dark' : 'light',
} as any);

const VARIANT = params.get('variant') === 'empty' ? 'empty' : 'sections';

const INSIGHT_ID = 'insight-is3b-v2-exec-summary';
const ORG_ID = 'org-dbr77-demo';
const SESSION_IDS = ['session-is3b-v2-a', 'session-is3b-v2-b'];

// Model-response shape po zmianie promptu (Wpis 123 pkt 1): trzy nazwane
// sekcje, każda zaczęta nagłówkiem w języku użytkownika, rozdzielone `\n\n`.
const NAMED_SECTIONS_EN = [
  'What we heard',
  'Six respondents across production, maintenance and planning independently described the same approval bottleneck: operational decisions are made on yesterday\u2019s data because the failure signal only reaches the planner at the morning stand-up, roughly sixteen hours late.',
  'What it means',
  'The constraint is not the machines \u2014 it is the information flow between functions. Changeovers already run 2.4x the standard and 62% of maintenance work stays reactive, so a fourth line would scale the same loss rather than add capacity.',
  'What to do',
  'Fund the two no-CAPEX moves first: one shared availability metric owned by a single person, and real-time failure notification from CMMS to the planner. Re-measure OEE for 90 days before committing to the fourth line. Confidence: medium, pending CMMS logs.',
].join('\n\n');

const NAMED_SECTIONS_PL = [
  'Co us\u0142yszeli\u015bmy',
  'Sze\u015bciu rozm\u00f3wc\u00f3w z produkcji, utrzymania ruchu i planowania niezale\u017cnie opisa\u0142o to samo w\u0105skie gard\u0142o decyzyjne: decyzje operacyjne zapadaj\u0105 na danych z wczoraj, bo sygna\u0142 o awarii dociera do planisty dopiero na porannej odprawie, oko\u0142o szesnastu godzin po zdarzeniu.',
  'Co to znaczy',
  'Ograniczeniem nie s\u0105 maszyny, lecz obieg informacji mi\u0119dzy funkcjami. Przezbrojenie ju\u017c trwa 2,4 raza d\u0142u\u017cej od standardu, a 62% prac serwisowych to reakcja na awari\u0119, wi\u0119c czwarta linia przeskaluje t\u0119 sam\u0105 strat\u0119 zamiast doda\u0107 zdolno\u015bci.',
  'Co zrobi\u0107',
  'Sfinansuj najpierw dwa dzia\u0142ania bez nak\u0142ad\u00f3w inwestycyjnych: jeden wsp\u00f3lny wska\u017anik dost\u0119pno\u015bci z jedn\u0105 osob\u0105 w\u0142a\u015bcicielsk\u0105 oraz powiadomienie o awarii z CMMS do planisty w czasie rzeczywistym. Zmierz OEE przez 90 dni przed decyzj\u0105 o czwartej linii. Pewno\u015b\u0107: \u015brednia, do potwierdzenia w logach CMMS.',
].join('\n\n');

function buildInsight() {
  const isEn = (i18n.language || 'en').toLowerCase().startsWith('en');
  const sections = isEn ? NAMED_SECTIONS_EN : NAMED_SECTIONS_PL;
  const empty = VARIANT === 'empty';
  return {
    id: INSIGHT_ID,
    organizationId: ORG_ID,
    title: isEn
      ? 'Executive summary \u2014 operational readiness (IS-3b v2)'
      : 'Podsumowanie wykonawcze \u2014 gotowo\u015b\u0107 operacyjna (IS-3b v2)',
    promptType: 'summary',
    sourceSessionIds: SESSION_IDS,
    status: 'completed',
    reviewStatus: 'in_review',
    sourceSessionCount: SESSION_IDS.length,
    tokensUsed: 18_420,
    generationTimeMs: 41_300,
    confidence: 'medium',
    createdBy: 'user-piotr-demo',
    createdAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    // pkt 1: trzy nazwane sekcje. pkt 3 (variant=empty): puste → stan pusty.
    executiveSummary: empty ? '' : sections,
    content: empty ? '' : `${sections}\n\n## Memo\n\nDecision memo body.`,
    generationContext: {
      sourceMaterial: {
        requestedSessionCount: 2,
        includedSessionCount: 2,
        excludedSessionCount: 0,
        includedAnswerCount: 6,
        includedSessionIds: SESSION_IDS,
        appliedFilters: { respondents: [], roles: [], departments: [], templates: [] },
      },
    },
    themes: [],
    issues: [],
    opportunities: [],
    signals: [],
    evidenceMap: [],
    missingData: [],
  };
}

V8InterviewApi.getInsight = (async () => ({
  insight: buildInsight(),
})) as unknown as typeof V8InterviewApi.getInsight;

V8InterviewApi.getSession = (async (id: string) => ({
  session: { id, name: `Interview session ${id}`, completedAt: new Date().toISOString() },
})) as unknown as typeof V8InterviewApi.getSession;

V8InterviewApi.getSessionSummary = (async () => ({
  facts: [],
  gaps: [],
  constraints: [],
  painPoints: [],
})) as unknown as typeof V8InterviewApi.getSessionSummary;

V8InterviewApi.getInsightActivity = (async () => ({
  activity: [],
})) as unknown as typeof V8InterviewApi.getInsightActivity;

V8InterviewApi.getInsightComments = (async () => ({
  comments: [],
})) as unknown as typeof V8InterviewApi.getInsightComments;

V8InterviewApi.getSourcePack = (async () => ({
  sourcePack: {
    insightId: INSIGHT_ID,
    sourceSessionIds: SESSION_IDS,
    entries: [],
    degraded: false,
    degradedReasons: [] as string[],
    activePointerCount: 0,
  },
  insightId: INSIGHT_ID,
})) as unknown as typeof V8InterviewApi.getSourcePack;

V8InterviewApi.listFindings = (async () => ({
  findings: [],
  insightId: INSIGHT_ID,
})) as unknown as typeof V8InterviewApi.listFindings;

// Regenerate (pkt 3) — harness nie ma backendu; akcja ma tylko nie wywraca\u0107 karty.
V8InterviewApi.regenerateInsight = (async () => ({
  insight: buildInsight(),
})) as unknown as typeof V8InterviewApi.regenerateInsight;

// ── Siatka bezpiecze\u0144stwa dla fetch (tylko gdy TEN ekran wybrany) ──────────
const g = window as unknown as { __IS3B_V2_FETCH__?: boolean };
const __tenEkran = params.get('screen') === 'is3b-exec-summary-v2';
if (__tenEkran && !g.__IS3B_V2_FETCH__) {
  g.__IS3B_V2_FETCH__ = true;
  setTimeout(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
      if (url.includes('/evidence/insight/')) {
        return new Response(
          JSON.stringify({
            envelope: {
              id: 'evidence-is3b-v2',
              organizationId: ORG_ID,
              artifactType: 'insight',
              artifactId: INSIGHT_ID,
              sources: [],
              assumptions: [],
              confidence: 0.64,
              confidenceLabel: 'medium',
              toVerify: [],
              computedBy: { service: 'insightEvidenceAggregator', version: 'v1' },
              createdBy: 'user-piotr-demo',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
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

export function Is3bExecSummaryV2Screen(): React.ReactElement {
  const i18nReady = useI18nReady();
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
          {i18nReady ? (
            <InsightViewer
              key={`is3b-v2-${VARIANT}-${i18n.language}`}
              insightId={INSIGHT_ID}
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

export default Is3bExecSummaryV2Screen;
