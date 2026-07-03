/**
 * Deck render smoke — ALL slide intents (beat-Gamma W15 hardening).
 *
 * Generates one deck exercising every SlideIntent through the live
 * PptxPipelineService (M19) and asserts: a valid OOXML buffer, the expected
 * slide count, and ZERO render warnings. A render warning means a layout/
 * composite threw while drawing an element — this test fails the build if any
 * layout regresses (the visual-quality safety net for the whole deck).
 */
import { describe, expect, it } from 'vitest';

import { PptxPipelineService } from '../../../server/src/services/report/pptx/PptxPipelineService.js';
import type { UnifiedReportJSON, UnifiedSlide } from '../../../server/src/services/report/pptx/types.js';

const meta = {
  client: 'DBR77',
  project: 'AI Readiness',
  date: '2026-06-28',
  author: 'Consultify',
  confidentiality: 'confidential' as const,
  language: 'pl' as const,
  framework: 'AI Readiness Assessment',
  template: 'corporate' as const,
};

const slides: UnifiedSlide[] = [
  { intent: 'cover', key_message: '', content: { type: 'cover', title: 'Tytuł', subtitle: 'Podtytuł', organization: 'DBR77', date: '28.06.2026' } as any },
  { intent: 'executive_summary', key_message: 'Teza wykonawcza slajdu', content: { type: 'executive_summary', headline: 'Nagłówek syntezy', kpis: [{ name: 'A', value: 41, unit: '/100' }, { name: 'B', value: 18, unit: 'm' }], key_findings: ['F1', 'F2', 'F3'], recommendation: 'Rekomendacja' } as any },
  { intent: 'section_intro', key_message: '', content: { type: 'section_intro', section_title: 'Sekcja', section_number: 1, description: 'Opis sekcji' } as any },
  { intent: 'key_messages', key_message: 'Trzy filary', content: { type: 'key_messages', messages: [{ title: 'A', description: 'opis a' }, { title: 'B', description: 'opis b' }, { title: 'C', description: 'opis c' }] } as any },
  { intent: 'performance_overview', key_message: 'Przegląd wyników', content: { type: 'performance_overview', period: 'Q2', kpis: [{ name: 'Infra', value: 68, unit: '/100', trend: 'up' }, { name: 'Dane', value: 32, unit: '/100', trend: 'down' }], context: 'Kontekst' } as any },
  { intent: 'single_insight', key_message: 'Wgląd', content: { type: 'single_insight', chart_type: 'bar', chart_data: { labels: ['24', '25', '26'], series: [{ name: 'Rev', values: [12, 18, 27] }] }, insight_text: 'Insight', source: 'Model' } as any },
  { intent: 'comparison', key_message: 'Porównanie', content: { type: 'comparison', left_label: 'Dziś', right_label: 'Cel', left_items: ['a', 'b'], right_items: ['c', 'd'], verdict: 'Werdykt' } as any },
  { intent: 'assessment', key_message: 'Ocena', content: { type: 'assessment', matrix_type: 'heatmap', axes: [{ axisId: '1', axisName: 'Oś 1', score: 3, maxScore: 5 }, { axisId: '2', axisName: 'Oś 2', score: 4, maxScore: 5 }], scale_max: 5, overall_score: 3.5 } as any },
  { intent: 'root_cause', key_message: 'Przyczyny', content: { type: 'root_cause', problem: 'Problem X', causes: [{ cause: 'C1', impact: 'I1', severity: 'high' }, { cause: 'C2', impact: 'I2', severity: 'medium' }] } as any },
  { intent: 'recommendation_single', key_message: 'Rekomendacja', content: { type: 'recommendation_single', title: 'Tytuł', description: 'Opis', impact: 'Wysoki', effort: 'Średni', priority: 'high', timeline: 'Q3' } as any },
  { intent: 'recommendation_portfolio', key_message: 'Portfel', content: { type: 'recommendation_portfolio', recommendations: [{ title: 'R1', description: 'd1', impact: 'W', priority: 'critical' }, { title: 'R2', description: 'd2', impact: 'Ś', priority: 'high' }] } as any },
  { intent: 'initiative_portfolio', key_message: 'Inicjatywy', content: { type: 'initiative_portfolio', initiatives: [{ name: 'I1', priority: 'high', impact: 4, effort: 2 }, { name: 'I2', priority: 'medium', impact: 3, effort: 3 }] } as any },
  { intent: 'prioritization_matrix', key_message: 'Priorytety', content: { type: 'prioritization_matrix', xAxisLabel: 'Wysiłek', yAxisLabel: 'Wpływ', quadrants: [{ label: 'QW', position: 'top_left', items: [{ name: 'x' }] }, { label: 'BB', position: 'top_right', items: [{ name: 'y' }] }] } as any },
  { intent: 'roadmap', key_message: 'Plan', content: { type: 'roadmap', phases: [{ label: 'Q3', timeframe: 'lip', items: ['a', 'b'], status: 'planned' }, { label: 'Q4', timeframe: 'paź', items: ['c'], status: 'in_progress' }] } as any },
  { intent: 'risk_management', key_message: 'Ryzyka', content: { type: 'risk_management', risks: [{ risk: 'R1', likelihood: 'high', impact: 'high', mitigation: 'M1', owner: 'CDO' }] } as any },
  { intent: 'next_steps', key_message: 'Kolejne kroki', content: { type: 'next_steps', actions: [{ action: 'A1', owner: 'Zarząd', deadline: '15.07' }], closing_message: 'Zamknięcie' } as any },
  { intent: 'appendix', key_message: '', content: { type: 'appendix', title: 'Załącznik', body: 'Treść załącznika', footnotes: ['fn1'] } as any },
];

describe('Deck render smoke — all intents (W15)', () => {
  it('renders every intent with a valid buffer and ZERO render warnings', async () => {
    const report: UnifiedReportJSON = { meta, slides };
    const svc = new PptxPipelineService();
    const res = await svc.generateFromUnifiedJson(report, { language: 'pl', template: 'corporate', skipValidation: true });

    // Valid OOXML zip (PK header).
    expect(res.buffer.length).toBeGreaterThan(20000);
    expect(res.buffer.slice(0, 2).toString('hex')).toBe('504b');

    // Slides = content slides + auto closing slide.
    expect(res.slideCount).toBe(slides.length + 1);

    // Any warning = a layout/composite element threw while rendering → regression.
    if (res.warnings.length) {
      // Surface them in the failure message for fast diagnosis.
      throw new Error(`Render warnings (layout regression):\n- ${res.warnings.join('\n- ')}`);
    }
    expect(res.warnings).toHaveLength(0);
  });
});
