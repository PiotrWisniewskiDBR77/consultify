/**
 * Dev-render host for the REAL `<ReportBuilderView>` → `<ReportEditor>` —
 * RG-1 v2→v3 / U-25 (DEC-572, Wpis 72 + Wpis 89). Pokazuje RAPORT OTWARTY (nie modal) po
 * „Create draft" dla ZAMROŻONEJ sesji Method Core BEZ legacy bliźniaka: modal
 * materializuje bliźniaka `assessments` (idempotentnie) i POSTuje
 * `/report-builder` z jego id, a ten ekran渲染 wynik — raport DRD z 14 sekcjami.
 *
 * Dlaczego harness (nie full-stack): ogon generowania AI jest niedostępny lokalnie
 * w `NODE_ENV=test` (udokumentowane w Wpis 66), więc PRAWDZIWY end-to-end
 * (PRZED brak bliźniaka → „Assessment not found" → PO: report.id + title + 14
 * sekcji) jest dowiedziony na kopii dumpu stagingu w
 * `evidence/wpis72-rg1v2-20260917/dump-proof.log`. Ten ekran渲染 REALNY komponent
 * `ReportEditor` na payloadzie o kształcie z `loadReport`
 * (`ReportEditor.tsx:1011-1099`), z tytułem/źródłem pochodzącymi z bliźniaka
 * sesji Northwind (`a9c8f477-8d8f-4d31-804d-a39700de4b0a`, name „Northwind 2027
 * — Digital Readiness Diagnosis") i 14 sekcjami z blueprintu szablonu
 * `tpl-drd-full-diagnostic-v2` (zmierzone z dumpu).
 *
 * URL: ?screen=rg1-opened-report&reportId=rb-drd-northwind-proof[&theme=light|dark]
 *
 * ★ RG-1 v3 (Wpis 89): liczby NIE SĄ już wymyślone. Wersja v2 tego harnessa
 * zawierała fabularny tekst („Level 2.4 (Developing)", „42 capability areas",
 * „scored 0–4", „Axis spread: Processes 3.0 …") — skasowany, bo nie pochodził
 * z żadnego pomiaru. Teraz `overall_maturity` renderuje DOKŁADNIE ten JSON
 * (`{type:'assessment_matrix', scaleMax:7, axes[…]}`), który
 * `reportGenerationService.generateSectionContent` zapisał w
 * `report_builder_sections.generated_content` dla bliźniaka sesji Northwind
 * `a9c8f477-8d8f-4d31-804d-a39700de4b0a` na kopii dumpu stagingu
 * (kontener `qoder-b-pg-89`, `consultify_dump`): 39 obszarów, skala 1–7,
 * oś 1 = 3.1, oś 7 = 2.0, overallScore 2.6. Teksty sekcji cytują te same
 * zmierzone wartości (`SCORE_SUMMARY` poniżej = `assessments.score_summary`
 * bliźniaka po naprawie snapshotu).
 */
import React from 'react';

import { AppProviders } from '../../src/providers/AppProviders';
import { ReportBuilderView } from '../../src/views/ReportBuilderView';
import i18n from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const REPORT_ID = params.get('reportId') || 'rb-drd-northwind-proof';

void i18n.changeLanguage('en');
useAppStore.setState({
  theme: params.get('theme') === 'dark' ? 'dark' : 'light',
} as any);

// 14 sekcji — blueprint `tpl-drd-full-diagnostic-v2` (key/type/title/order z dumpu).
const BLUEPRINT: Array<[string, string, string]> = [
  ['cover', 'cover', 'Cover Page'],
  ['executive_summary', 'summary', 'Executive Summary'],
  ['methodology', 'methodology', 'Assessment Methodology'],
  ['overall_maturity', 'matrix', 'Overall Maturity Overview'],
  ['axis_1_processes', 'axis_analysis', 'Axis 1: Digital Processes'],
  ['axis_2_products', 'axis_analysis', 'Axis 2: Digital Products & Services'],
  ['axis_3_business_models', 'axis_analysis', 'Axis 3: Digital Business Models'],
  ['axis_4_data', 'axis_analysis', 'Axis 4: Data & Analytics'],
  ['axis_5_culture', 'axis_analysis', 'Axis 5: Organizational Culture & Competencies'],
  ['axis_6_security', 'axis_analysis', 'Axis 6: Cybersecurity & Risk Management'],
  ['axis_7_ai', 'axis_analysis', 'Axis 7: AI & Machine Learning'],
  ['gap_analysis', 'recommendations', 'Strategic Gap Analysis & Priorities'],
  ['roadmap', 'action_plan', 'Transformation Roadmap'],
  ['appendix', 'appendix', 'Appendix: Detailed Scores & Data'],
];

// Wszystkie liczby poniżej = pomiar z kopii dumpu stagingu (kontener
// `qoder-b-pg-89`, sesja `a9c8f477…`, 39 obszarów DRD, skala 1–7):
// `assessments.answers_json` + `score_summary` bliźniaka po naprawie snapshotu
// oraz `report_builder_sections.generated_content` sekcji matrix.
const SCORE_SUMMARY = {
  axes: [
    { axisId: '1', axisName: 'Digital Processes', score: 3.1, maxScore: 7, target: 4.4, gap: 1.3, fullMark: 7 },
    { axisId: '2', axisName: 'Digital Products & Services', score: 2.4, maxScore: 7, target: 3.6, gap: 1.2, fullMark: 7 },
    { axisId: '3', axisName: 'Digital Business Models', score: 2.2, maxScore: 7, target: 3.6, gap: 1.4, fullMark: 7 },
    { axisId: '4', axisName: 'Data & Analytics', score: 3, maxScore: 7, target: 4.4, gap: 1.4, fullMark: 7 },
    { axisId: '5', axisName: 'Organizational Culture', score: 2.8, maxScore: 7, target: 4, gap: 1.2, fullMark: 7 },
    { axisId: '6', axisName: 'Cybersecurity & Risk', score: 2.8, maxScore: 7, target: 4.6, gap: 1.8, fullMark: 7 },
    { axisId: '7', axisName: 'AI & Machine Learning', score: 2, maxScore: 7, target: 3.4, gap: 1.4, fullMark: 7 },
  ],
  overallScore: 2.6,
  maxScore: 7,
  assessmentType: 'DRD',
};

// Dokładny `generated_content` sekcji `overall_maturity` (branch deterministyczny
// `reportGenerationService.ts:1429-1478`) — renderowany przez
// `ReportEditor` → `visuals/AssessmentMatrix.tsx`.
const MATRIX_CONTENT = JSON.stringify({
  type: 'assessment_matrix',
  scaleMax: 7,
  axes: SCORE_SUMMARY.axes.map((a) => ({
    axisId: a.axisId,
    axisName: a.axisName,
    score: a.score,
    maxScore: a.maxScore,
    gap: a.gap,
  })),
});

const AREA_COUNT = 39;

const BODY: Record<string, string> = {
  executive_summary: `Northwind 2027 — Digital Readiness Diagnosis was scored across all seven axes and ${AREA_COUNT} capability areas on a 1–7 scale, from a frozen Method Core session whose legacy assessment twin was materialized on demand. Overall readiness stands at ${SCORE_SUMMARY.overallScore} of ${SCORE_SUMMARY.maxScore}. The strongest axis is Digital Processes (${SCORE_SUMMARY.axes[0].score}); the weakest is AI & Machine Learning (${SCORE_SUMMARY.axes[6].score}). The widest gap to target is Cybersecurity & Risk (${SCORE_SUMMARY.axes[5].gap}).`,
  methodology: `The diagnosis follows the DRD framework: 7 axes, ${AREA_COUNT} capability areas, each scored 1–7 for an achieved level and a target level, with evidence-based acceptance during the frozen session. Axis scores are the mean of the achieved levels of their areas, rounded to one decimal; the overall readiness index is the mean of the seven axis scores. Sources: facilitated workshop outputs, system exports, and accepted evidence attached before the freeze.`,
  gap_analysis: `Priority gaps (target − achieved): ${SCORE_SUMMARY.axes
    .slice()
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)
    .map((a) => `${a.axisName} (${a.target} − ${a.score} = ${a.gap})`)
    .join(', ')}. These three axes carry the highest transformation leverage for the roadmap.`,
  roadmap: `90-day horizon, ordered by measured gap: (1) close the Cybersecurity & Risk gap of ${SCORE_SUMMARY.axes[5].gap}; (2) lift AI & Machine Learning from ${SCORE_SUMMARY.axes[6].score} toward ${SCORE_SUMMARY.axes[6].target}; (3) raise Digital Business Models from ${SCORE_SUMMARY.axes[2].score}. Owners and KPIs are tracked as initiatives generated from this report.`,
  appendix: `Detailed scores (${AREA_COUNT} areas aggregated into 7 axes, scale 1–7). ${SCORE_SUMMARY.axes
    .map((a) => `Axis ${a.axisId} ${a.axisName}: achieved ${a.score}, target ${a.target}, gap ${a.gap}`)
    .join('. ')}. Overall readiness index ${SCORE_SUMMARY.overallScore} / ${SCORE_SUMMARY.maxScore}.`,
};

function sectionPayload() {
  return BLUEPRINT.map(([key, type, title], i) => ({
    sectionKey: key,
    sectionType: type,
    blockTypeId: type,
    title,
    length: key === 'cover' ? 'short' : 'medium',
    renderKind: type === 'matrix' ? 'matrix' : 'text',
    enabled: true,
    orderIndex: i,
    generatedContent:
      type === 'matrix'
        ? MATRIX_CONTENT
        : BODY[key] ||
          `${title} — generated section for the Northwind 2027 Digital Readiness Diagnosis. Content synthesised from the frozen session outputs (${AREA_COUNT} scored areas) and accepted evidence.`,
    editedContent: null,
    customPrompt: null,
    rag: type === 'axis_analysis' ? (i % 3 === 0 ? 'red' : i % 3 === 1 ? 'amber' : 'green') : undefined,
    chapterKey: undefined,
    chapterTitle: undefined,
  }));
}

const REPORT = {
  report: {
    id: REPORT_ID,
    title: 'Report - Northwind 2027 — Digital Readiness Diagnosis',
    sourceType: 'ASSESSMENT',
    sourceId: 'a9c8f477-8d8f-4d31-804d-a39700de4b0a--assessment--drd-twin',
    sourceName: 'Northwind 2027 — Digital Readiness Diagnosis',
    templateId: 'tpl-drd-full-diagnostic-v2',
    status: 'draft',
    config: { intent: { audience: 'executive', goal: 'decision' } },
  },
  sections: sectionPayload(),
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

    // Główny load raportu: GET /api/report-builder/:id (bez pod-ścieżek).
    if (
      url.includes(`/api/report-builder/${REPORT_ID}`) &&
      !/\/(versions|comments|share|exports|generate|sections|config|finalize|approve|duplicate|export)\b/.test(
        url.split(`/api/report-builder/${REPORT_ID}`)[1] || ''
      )
    ) {
      return jsonResponse(REPORT);
    }

    if (url.includes('/api/')) {
      return jsonResponse({
        data: [],
        items: [],
        backlinks: [],
        links: [],
        versions: [],
        comments: [],
        summary: { total: 0, resolved: 0, open: 0 },
      });
    }

    return realFetch(input as RequestInfo, init);
  };
}

export default function Rg1OpenedReportScreen(): React.ReactElement {
  return (
    <AppProviders>
      <ReportBuilderView />
    </AppProviders>
  );
}
