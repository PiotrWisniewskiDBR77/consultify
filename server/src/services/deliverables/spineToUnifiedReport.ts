/**
 * spineToUnifiedReport (W7.6) — most SPINE → UnifiedReportJSON (M19 PptxPipelineService).
 *
 * Zamiast minimalnego bundlePptxRuntime (tytuł + key-message) komponujemy DOJRZAŁY
 * silnik M19 (17 intencji, BCG-grade layouty, master slides, branding). Każdy slajd
 * dostaje WŁAŚCIWY typ content per intencja — wszystko UGRUNTOWANE w realnych danych
 * SPINE (heroNumbers, pnl, market, valuation, assumptions). Zero fabrykacji liczb.
 *
 * Czysta funkcja, deterministyczna — testowalna bez I/O.
 */
import type {
  KpiData,
  UnifiedReportJSON,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../report/pptx/types.js';
import type { BusinessPlanSpine } from './businessPlanSpine.js';

/** Mapuje themeRegistry-style id → template M19 (corporate/minimal/modern). */
function resolveTemplate(themeId?: string): 'corporate' | 'minimal' | 'modern' {
  switch (themeId) {
    case 'modern':
    case 'clean':
      return 'modern';
    case 'minimal':
      return 'minimal';
    default:
      return 'corporate';
  }
}

/** hero formatted po kluczu (lub '' gdy brak). */
function heroFmt(spine: BusinessPlanSpine, key: string): string {
  return (spine.heroNumbers ?? []).find((h) => h.key === key)?.formatted ?? '';
}

/** hero → KpiData (name=label, value=formatted string — renderer pokaże jak jest). */
function heroKpi(spine: BusinessPlanSpine, key: string): KpiData | null {
  const h = (spine.heroNumbers ?? []).find((x) => x.key === key);
  if (!h) return null;
  return { name: h.label, value: h.formatted };
}

function heroKpis(spine: BusinessPlanSpine, keys: string[]): KpiData[] {
  return keys.map((k) => heroKpi(spine, k)).filter((x): x is KpiData => x !== null);
}

/** action-title sekcji po id (lub '' gdy brak). */
function sectionTitle(spine: BusinessPlanSpine, id: string): string {
  return (spine.sections ?? []).find((s) => s.id === id)?.actionTitle ?? '';
}

/**
 * SPINE → UnifiedReportJSON dla M19 PptxPipelineService.
 * Buduje bogaty, ugruntowany deck: cover → exec → problem/solution → market →
 * model → wykresy finansowe → unit econ → ryzyka → roadmap → ask → appendix.
 */
export function spineToUnifiedReport(
  spine: BusinessPlanSpine,
  opts: { themeId?: string; brandColor?: string; date?: string } = {}
): UnifiedReportJSON {
  const lang: 'en' | 'pl' = spine.meta.language === 'EN' ? 'en' : 'pl';
  const isPl = lang === 'pl';
  const company = spine.meta.company;
  const pnl = spine.financials?.pnl ?? [];
  const arrBridge = spine.financials?.arrBridge ?? [];
  const kpis = spine.financials?.kpis ?? { nrr: 100, ruleOf40: 0 };
  const val = spine.financials?.valuation ?? null;

  const meta: UnifiedReportMeta = {
    client: company,
    project: isPl ? 'Biznesplan inwestorski' : 'Investment business plan',
    date: opts.date ?? '',
    author: 'Consultify',
    confidentiality: 'confidential',
    language: lang,
    brandColor: opts.brandColor,
    template: resolveTemplate(opts.themeId),
    sourceType: 'business_plan',
  };

  const slides: UnifiedSlide[] = [];

  // 1 — COVER
  slides.push({
    intent: 'cover',
    key_message: spine.meta.thesis,
    content: {
      type: 'cover',
      title: company,
      subtitle: meta.project,
      organization: company,
      date: meta.date,
    },
  });

  // 2 — EXECUTIVE SUMMARY (KPIs + findings)
  const execKpis = heroKpis(spine, ['revenue_last', 'ebitda_last', 'arr_last', 'ask']);
  // Headline board-grade = PUNCHY (≤2 linie); długa teza ucinała 3. linię na KPI.
  const clampHeadline = (s: string, max = 130): string => {
    const t = (s || '').trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  };
  slides.push({
    intent: 'executive_summary',
    key_message: spine.meta.thesis,
    content: {
      type: 'executive_summary',
      headline: clampHeadline(spine.meta.thesis),
      kpis: execKpis.length ? execKpis : undefined,
      key_findings: [
        sectionTitle(spine, 'problem'),
        sectionTitle(spine, 'solution'),
        sectionTitle(spine, 'market'),
      ].filter(Boolean),
      recommendation: spine.meta.ask,
    },
  });

  // 3 — PROBLEM & SOLUTION (key_messages)
  const probSol = [
    { title: isPl ? 'Problem' : 'Problem', description: sectionTitle(spine, 'problem') },
    { title: isPl ? 'Rozwiązanie' : 'Solution', description: sectionTitle(spine, 'solution') },
  ].filter((m) => m.description);
  if (probSol.length) {
    slides.push({
      intent: 'key_messages',
      key_message: sectionTitle(spine, 'solution') || sectionTitle(spine, 'problem'),
      content: { type: 'key_messages', messages: probSol },
    });
  }

  // 4 — MARKET (performance_overview: TAM/SAM/SOM)
  const marketKpis = heroKpis(spine, ['tam', 'sam', 'som']);
  if (marketKpis.length) {
    slides.push({
      intent: 'performance_overview',
      key_message: `${isPl ? 'Rynek' : 'Market'}: TAM ${heroFmt(spine, 'tam')} · SOM ${heroFmt(spine, 'som')}`,
      content: {
        type: 'performance_overview',
        kpis: marketKpis,
        context: spine.market?.bottomUp?.formula,
      },
    });
  }

  // 5 — MODEL & GTM & COMPETITION (key_messages)
  const modelMsgs = [
    {
      title: isPl ? 'Model biznesowy' : 'Business model',
      description: sectionTitle(spine, 'business_model'),
    },
    { title: 'Go-to-market', description: sectionTitle(spine, 'gtm') },
    { title: isPl ? 'Przewaga' : 'Moat', description: sectionTitle(spine, 'competition') },
  ].filter((m) => m.description);
  if (modelMsgs.length) {
    slides.push({
      intent: 'key_messages',
      key_message: sectionTitle(spine, 'business_model'),
      content: { type: 'key_messages', messages: modelMsgs },
    });
  }

  // 6 — FINANCIALS (single_insight: bar chart revenue + ebitda) — REAL pnl
  if (pnl.length) {
    slides.push({
      intent: 'single_insight',
      key_message: `${isPl ? 'Przychód' : 'Revenue'} ${heroFmt(spine, 'revenue_last')}, EBITDA ${heroFmt(spine, 'ebitda_last')}`,
      content: {
        type: 'single_insight',
        chart_type: 'bar',
        chart_data: {
          labels: pnl.map((p) => p.period),
          series: [
            { name: isPl ? 'Przychód' : 'Revenue', values: pnl.map((p) => Math.round(p.revenue)) },
            { name: 'EBITDA', values: pnl.map((p) => Math.round(p.ebitda)) },
          ],
        },
        insight_text:
          sectionTitle(spine, 'financial_plan') ||
          `${isPl ? 'Trajektoria do rentowności' : 'Path to profitability'}.`,
        source: isPl ? 'Model finansowy (driver-based)' : 'Driver-based financial model',
      },
    });
  }

  // 7 — TRACTION (single_insight: line chart ARR) — REAL arrBridge
  if (arrBridge.length) {
    slides.push({
      intent: 'single_insight',
      key_message: `ARR ${heroFmt(spine, 'arr_last')}`,
      content: {
        type: 'single_insight',
        chart_type: 'line',
        chart_data: {
          labels: arrBridge.map((a) => a.period),
          series: [{ name: 'ARR', values: arrBridge.map((a) => Math.round(a.ending)) }],
        },
        insight_text:
          sectionTitle(spine, 'traction') ||
          (isPl ? 'ARR rośnie w horyzoncie planu.' : 'ARR grows across the plan horizon.'),
      },
    });
  }

  // 8 — UNIT ECONOMICS (performance_overview KPIs) — REAL
  const ueKpis = heroKpis(spine, ['ltv_cac', 'cac_payback']);
  ueKpis.push({ name: 'NRR', value: `${Math.round(kpis.nrr)}%` });
  ueKpis.push({ name: 'Rule of 40', value: Math.round(kpis.ruleOf40) });
  if (ueKpis.length) {
    slides.push({
      intent: 'performance_overview',
      key_message: `LTV/CAC ${heroFmt(spine, 'ltv_cac')}, ${isPl ? 'payback' : 'payback'} ${heroFmt(spine, 'cac_payback')}`,
      content: {
        type: 'performance_overview',
        kpis: ueKpis,
        context: sectionTitle(spine, 'unit_economics') || undefined,
      },
    });
  }

  // 9 — RISKS (risk_management z top-założeń wg sensitivityRank) — REAL ranks
  const topAssumptions = (spine.assumptions ?? [])
    .slice()
    .sort((a, b) => b.sensitivityRank - a.sensitivityRank)
    .slice(0, 5);
  if (topAssumptions.length) {
    const sev = (rank: number, idx: number): 'high' | 'medium' | 'low' =>
      idx === 0 ? 'high' : idx <= 2 ? 'medium' : 'low';
    slides.push({
      intent: 'risk_management',
      key_message: isPl ? 'Kluczowe założenia = kluczowe ryzyka' : 'Key assumptions = key risks',
      content: {
        type: 'risk_management',
        risks: topAssumptions.map((a, i) => ({
          risk: `${a.label} (${a.base}${a.unit})`,
          likelihood: sev(a.sensitivityRank, i),
          impact: sev(a.sensitivityRank, i),
          mitigation: `${isPl ? 'Zakres' : 'Range'} ${a.range[0]}–${a.range[1]}${a.unit}; ${isPl ? 'źródło' : 'source'}: ${a.provenance.source}`,
        })),
      },
    });
  }

  // 10 — ROADMAP (z lat pnl — REAL revenue targets per rok)
  if (pnl.length) {
    slides.push({
      intent: 'roadmap',
      key_message: isPl ? 'Roadmapa do celu finansowego' : 'Roadmap to financial target',
      content: {
        type: 'roadmap',
        phases: pnl.map((p, i) => ({
          label: p.period,
          timeframe: '', // NIE duplikuj p.period (label już je niesie — było „Rok 1 (2023)" 2×)
          items: [
            `${isPl ? 'Przychód' : 'Revenue'}: ${Math.round(p.revenue).toLocaleString(isPl ? 'pl-PL' : 'en-US')}`,
            `EBITDA: ${Math.round(p.ebitda).toLocaleString(isPl ? 'pl-PL' : 'en-US')}`,
          ],
          status: (i === 0 ? 'in_progress' : 'planned') as 'in_progress' | 'planned',
        })),
      },
    });
  }

  // 11 — ASK (recommendation_single + wycena W12.2) — REAL valuation
  slides.push({
    intent: 'recommendation_single',
    key_message: spine.meta.ask,
    content: {
      type: 'recommendation_single',
      title: isPl ? 'Ask inwestorski' : 'Investment ask',
      description: spine.meta.ask,
      // Krótko, by zmieścić się w boxie (wcześniej przelewało się przez kartę).
      impact: val
        ? `${isPl ? 'Wycena' : 'Valuation'} ${heroFmt(spine, 'valuation_low')}–${heroFmt(spine, 'valuation_high')}`
        : isPl
          ? 'Zwrot z inwestycji w horyzoncie planu'
          : 'Return on investment within the plan horizon',
      effort: heroFmt(spine, 'ask') || spine.meta.ask,
      priority: 'critical',
    },
  });

  // 12 — APPENDIX (obronność założeń — tabela) — REAL
  const defRows = topAssumptions.map((a) => [
    a.label,
    `${a.base}${a.unit}`,
    `${a.range[0]}–${a.range[1]}`,
    a.provenance.source,
  ]);
  if (defRows.length) {
    slides.push({
      intent: 'appendix',
      key_message: isPl ? 'Obronność założeń' : 'Assumption defensibility',
      content: {
        type: 'appendix',
        title: isPl ? 'Załącznik: obronność założeń' : 'Appendix: assumption defensibility',
        body: isPl
          ? 'Kluczowe założenia z wartością bazową, zakresem i źródłem (posortowane wg wpływu na wynik).'
          : 'Key assumptions with base value, range and source (sorted by impact on the outcome).',
        tables: [
          {
            headers: isPl
              ? ['Założenie', 'Wartość', 'Zakres', 'Źródło']
              : ['Assumption', 'Value', 'Range', 'Source'],
            rows: defRows,
          },
        ],
      },
    });
  }

  return { meta, slides };
}
