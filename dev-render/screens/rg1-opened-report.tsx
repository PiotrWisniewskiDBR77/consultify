/**
 * Dev-render host for the REAL `<ReportBuilderView>` → `<ReportEditor>` —
 * RG-1 v2 / U-25 (DEC-572, Wpis 72). Pokazuje RAPORT OTWARTY (nie modal) po
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
 * sesji Northwind (`63aa51e1…`, name „Northwind 2027 — Digital Readiness
 * Diagnosis · Q3 re-assessment") i 14 sekcjami z blueprintu szablonu
 * `tpl-drd-full-diagnostic-v2` (zmierzone z dumpu).
 *
 * URL: ?screen=rg1-opened-report&reportId=rb-drd-northwind-proof[&theme=light|dark]
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

const BODY: Record<string, string> = {
  executive_summary:
    'Northwind Manufacturing completed its Q3 re-assessment across all seven digital-readiness axes. Overall maturity stands at Level 2.4 (Developing), up from 2.1 in Q1. The strongest gains are in Digital Processes and Data & Analytics; the widest gaps remain in AI & Machine Learning and Cybersecurity risk management. This report was generated from a frozen Method Core session whose legacy assessment source was materialized on demand.',
  methodology:
    'The diagnosis follows the DRD 2027 framework: 7 axes, 42 capability areas, scored 0–4 with evidence-based acceptance. Scores aggregate to an axis maturity level and an overall readiness index. Sources: facilitated workshop outputs, system exports, and accepted evidence attached during the frozen session.',
  overall_maturity:
    'Overall readiness index 2.4 / 4.0. Axis spread: Processes 3.0, Products 2.6, Business Models 2.2, Data 2.8, Culture 2.1, Security 1.8, AI 1.6.',
  gap_analysis:
    'Priority gaps (target − current): AI & ML (3.0 − 1.6 = 1.4), Cybersecurity (3.0 − 1.8 = 1.2), Culture (3.0 − 2.1 = 0.9). These three axes carry the highest transformation leverage for the 2027 roadmap.',
  roadmap:
    '90-day horizon: (1) stand up an AI readiness pilot on one production line; (2) close the two critical security findings; (3) launch a data-literacy program. Owners and KPIs are tracked as initiatives generated from this report.',
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
      BODY[key] ||
      `${title} — generated section for the Northwind 2027 Digital Readiness Diagnosis (Q3 re-assessment). Content synthesised from the frozen session outputs and accepted evidence.`,
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
    title: 'Report - Northwind 2027 — Digital Readiness Diagnosis · Q3 re-assessment',
    sourceType: 'ASSESSMENT',
    sourceId: '63aa51e1-8270-42f0-8f57-12742a66566e--assessment--drd-twin',
    sourceName: 'Northwind 2027 — Digital Readiness Diagnosis · Q3 re-assessment',
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
