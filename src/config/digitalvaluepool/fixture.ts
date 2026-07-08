/**
 * Digital Value Pool — worked-example fixture.
 *
 * Grounds the deterministic engine (valuePoolEngine.ts) and the conclusion
 * prompt builder (conclusionPrompts.ts) in a runnable example so the tool can
 * be self-tested and previewed without a live session. Lifted from the
 * doctrine's own worked example (§7, Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/
 * digital-value-pool.md): a mid-size B2B services firm (DBR77-like profile,
 * 200M PLN revenue) deciding where to point its 2027 digital/AI transformation
 * budget (5M PLN) across 8 value-chain functions.
 *
 * The 8 functions reproduce the doctrine's top-down value-at-stake table
 * (base × industry benchmark share); the 4 "remaining functions <0.5M PLN"
 * from the doctrine become 4 immaterial functions here (each below the
 * engine's 2%-of-pool materiality threshold). The 3 use-cases reproduce the
 * doctrine's impact×feasibility walk-through as the tool's three canonical
 * archetypes:
 *   - Auto-draft deliverables  -> quick-win (high impact, high feasibility, no gate blockers)
 *   - AI-lead scoring (key accounts, narrow pilot) -> fill-in (low impact, high feasibility)
 *   - Knowledge base           -> pilot-without-scale (high impact, technically feasible,
 *                                 but blocked on all 4 scale-gate signals — no owner)
 * Finance/administration is deliberately left with zero use-cases despite a
 * material value-at-stake, so the engine's dead-field detector surfaces it.
 *
 * Field convention (see index.ts `toValuePoolSession` adapter doc-comment):
 *   - `functions` section: OperationalItem + side (cost/revenue)/base/benchmarkShare/measured
 *   - `useCases` section:  OperationalItem + functionId/phase/feasibility/bottomUpValue/
 *                          dataReady/hasOwner/scalable/businessMetric
 * These are additive fields the strict `OperationalItem` interface does not
 * declare (it is intentionally generic across all 22 operational tools), so
 * each section below is typed as `OperationalItem & {...extras}` locally and
 * assigned by reference into `sections` — this satisfies structural typing
 * without widening or touching the shared store types.
 */

import type { OperationalItem, OperationalToolData } from '@/store/useToolStore';
import { createConsultingMissionContext } from '@/config/consultingToolsStandard';

type ValueFunctionItemFixture = OperationalItem & {
  side?: 'cost' | 'revenue';
  base?: number;
  benchmarkShare?: number;
  measured?: boolean;
};

type UseCaseItemFixture = OperationalItem & {
  functionId?: string;
  phase?: 'decompose' | 'size' | 'prioritize' | 'sequence';
  feasibility?: 'high' | 'medium' | 'low';
  bottomUpValue?: number;
  dataReady?: boolean;
  hasOwner?: boolean;
  scalable?: boolean;
  businessMetric?: boolean;
};

// ---------------------------------------------------------------------------
// Functions — 8-node value-chain decomposition. Base and value-at-stake in
// mln PLN. 4 material functions (>=2% of the mapped pool) carry the doctrine's
// headline numbers; 4 "remaining" functions stay below the materiality
// threshold, exactly as the doctrine describes ("<0.5M PLN each").
// ---------------------------------------------------------------------------

const functionItems: ValueFunctionItemFixture[] = [
  {
    id: 'fn-delivery',
    title: 'Dostawa usługi / realizacja projektów',
    description:
      '60 mln PLN kosztu bezpośredniego; benchmark 15-20% redukcji przez automatyzację raportowania i AI-draft deliverables.',
    impact: 'high',
    effort: 'medium',
    side: 'cost',
    base: 60,
    benchmarkShare: 0.18,
    measured: true,
  },
  {
    id: 'fn-sales',
    title: 'Sprzedaż',
    description: '30 mln PLN bazy przychodowej lejka; benchmark 10% wzrostu konwersji przez AI-lead scoring.',
    impact: 'medium',
    effort: 'medium',
    side: 'revenue',
    base: 30,
    benchmarkShare: 0.1,
    measured: true,
  },
  {
    id: 'fn-knowledge',
    title: 'Zarządzanie wiedzą',
    description:
      'Brak wydzielonego budżetu — 8 mln PLN "utopionego" czasu konsultantów na szukanie/odtwarzanie wiedzy; benchmark 20-30% redukcji.',
    impact: 'high',
    effort: 'high',
    side: 'cost',
    base: 8,
    benchmarkShare: 0.28,
    measured: false,
  },
  {
    id: 'fn-finance',
    title: 'Finanse / administracja',
    description: '5 mln PLN kosztu; benchmark 25% automatyzacji księgowań i raportów.',
    impact: 'medium',
    effort: 'low',
    side: 'cost',
    base: 5,
    benchmarkShare: 0.25,
    measured: true,
  },
  {
    id: 'fn-marketing',
    title: 'Marketing',
    description: 'Poniżej progu istotności — brak ustrukturyzowanej bazy powyżej szumu.',
    impact: 'low',
    effort: 'low',
    side: 'revenue',
    base: 6,
    benchmarkShare: 0.05,
    measured: true,
  },
  {
    id: 'fn-customer-service',
    title: 'Obsługa klienta',
    description: 'Poniżej progu istotności — mały wolumen zgłoszeń względem pozostałych funkcji.',
    impact: 'low',
    effort: 'low',
    side: 'cost',
    base: 4,
    benchmarkShare: 0.08,
    measured: true,
  },
  {
    id: 'fn-hr',
    title: 'HR',
    description: 'Poniżej progu istotności — baza kosztowa marginalna wobec Dostawy i Sprzedaży.',
    impact: 'low',
    effort: 'low',
    side: 'cost',
    base: 3,
    benchmarkShare: 0.08,
    measured: false,
  },
  {
    id: 'fn-it-ops',
    title: 'IT / operacje wewnętrzne',
    description: 'Poniżej progu istotności — koszt wewnętrzny bez zidentyfikowanego use-case’u.',
    impact: 'low',
    effort: 'low',
    side: 'cost',
    base: 3.5,
    benchmarkShare: 0.08,
    measured: true,
  },
];

// ---------------------------------------------------------------------------
// Use-cases — the doctrine's 3-case impact×feasibility walk-through, mapped
// onto the engine's three archetypes (quick-win / fill-in / pilot-without-
// scale). Finance/administration is deliberately left with zero use-cases so
// the dead-field detector surfaces it despite its material value-at-stake.
// ---------------------------------------------------------------------------

const useCaseItems: UseCaseItemFixture[] = [
  {
    id: 'uc-auto-draft-deliverables',
    title: 'Auto-draft deliverables (Word/Deck/Sheet z danych projektu)',
    description:
      'Zgłoszony przez 6/8 liderów projektów; dane projektowe już strukturalne w systemie — szacunek 4 mln PLN/rok oszczędności.',
    impact: 'high',
    effort: 'low',
    functionId: 'fn-delivery',
    phase: 'prioritize',
    feasibility: 'high',
    bottomUpValue: 4,
    dataReady: true,
    hasOwner: true,
    scalable: true,
    businessMetric: true,
  },
  {
    id: 'uc-lead-scoring-key-accounts',
    title: 'AI-lead scoring — pilotaż na segmencie key accounts',
    description:
      'Zgłoszony przez szefa sprzedaży; ograniczony do segmentu z kompletnymi danymi CRM (10% leadów) — szacunek 0,3 mln PLN/rok, mały wolumen.',
    impact: 'low',
    effort: 'low',
    functionId: 'fn-sales',
    phase: 'prioritize',
    feasibility: 'high',
    bottomUpValue: 0.3,
    dataReady: true,
    hasOwner: true,
    scalable: true,
    businessMetric: true,
  },
  {
    id: 'uc-knowledge-base-semantic-search',
    title: 'Baza wiedzy z semantycznym wyszukiwaniem',
    description:
      'Zgłoszona przez 2 konsultantów juniorskich; brak strukturyzacji dokumentów, brak wyznaczonego właściciela procesu, brak szacunku finansowego — nieskwantyfikowana.',
    impact: 'high',
    effort: 'high',
    functionId: 'fn-knowledge',
    phase: 'size',
    feasibility: 'medium',
    dataReady: false,
    hasOwner: false,
    scalable: false,
    businessMetric: false,
  },
];

// ---------------------------------------------------------------------------
// Fixture — assembled OperationalToolData
// ---------------------------------------------------------------------------

export const VALUE_POOL_FIXTURE: OperationalToolData = {
  context: createConsultingMissionContext({
    goal:
      'Zdecydować, gdzie skierować budżet transformacji cyfrowej/AI na 2027 (5 mln PLN) — z 8 funkcji łańcucha wartości, nie punktowo.',
    scope:
      'Firma usługowa B2B, przychód 200 mln PLN rocznie; 8 funkcji łańcucha wartości: Dostawa usługi, Sprzedaż, Zarządzanie wiedzą, Finanse/administracja, Marketing, Obsługa klienta, HR, IT/operacje wewnętrzne.',
    timeframe: 'medium',
    successSignal:
      'Budżet transformacji 2027 realokowany zgodnie z koncentracją zmapowanej puli — nie rozłożony równo po widocznych inicjatywach; pilotaż bazy wiedzy nie startuje bez wyznaczonego właściciela.',
    assumptions:
      'Zarząd domyślnie skłania się do równego rozłożenia budżetu po "widocznych" inicjatywach (AI sprzedażowe, chatbot obsługi) zamiast tam, gdzie faktycznie leży największa pula.',
    constraints:
      'Budżet transformacji 2027 zamknięty na 5 mln PLN; zero dużego budżetu na pilotaże bez wyznaczonego właściciela procesu i danych źródłowych.',
    kpiTarget:
      '≥70% budżetu transformacji 2027 skierowane do funkcji trzymających razem ~85%+ zmapowanej wartości cyfrowej (Dostawa usługi + Sprzedaż + Zarządzanie wiedzą).',
  }),
  sections: {
    functions: functionItems,
    useCases: useCaseItems,
  },
};
