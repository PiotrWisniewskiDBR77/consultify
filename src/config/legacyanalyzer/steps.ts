/**
 * Legacy Analyzer — wizard step definitions.
 *
 * Four steps mirror the doctrine's method order (Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/
 * legacy-analyzer.md §4): context first, then the raw inventory (applications →
 * dependency graph), then the insight-first synthesis. The section ids MUST
 * match what `toLegacySession` (src/config/legacyanalyzer/index.ts) reads off
 * `OperationalToolData.sections`: `apps` (or `applications`/`systems`),
 * `dependencies` (or `edges`/`integrations`).
 */

import type { StepDefinition } from '@/store/useToolStore';

export const LEGACY_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Mission Context',
    namePl: 'Kontekst misji',
    description:
      'Define the goal, scope and timeframe of the legacy portfolio review — why now (modernization program, rising run cost, security/support risk, M&A due diligence).',
    descriptionPl:
      'Zdefiniuj cel, zakres i horyzont przeglądu portfela legacy — dlaczego teraz (program modernizacji, rosnący koszt utrzymania, ryzyko bezpieczeństwa/wsparcia, due diligence M&A).',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'apps',
    name: 'Application Portfolio',
    namePl: 'Portfel aplikacji',
    description:
      'Score every application on the two TIME axes (business value, technical health) plus the risk facts (support status, bus factor, CVEs, compliance) and TCO — the raw material the matrix and 6R strategy depend on.',
    descriptionPl:
      'Oceń każdą aplikację na dwóch osiach TIME (wartość biznesowa, kondycja techniczna) oraz faktach ryzyka (status wsparcia, bus factor, CVE, compliance) i TCO — surowy materiał, od którego zależą macierz i strategia 6R.',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'dependencies',
    name: 'Dependency Graph',
    namePl: 'Mapa zależności',
    description:
      'Map cross-system integrations (who depends on whom, documented or hidden) — a critical integration node cannot be eliminated without a replacement, this graph governs the override and the roadmap sequence.',
    descriptionPl:
      'Zmapuj zależności międzysystemowe (kto od kogo zależy, udokumentowane czy ukryte) — węzła krytycznego dla integracji nie da się wygasić bez zastępstwa, ten graf steruje nadpisaniem decyzji i kolejnością roadmapy.',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Roadmap',
    namePl: 'Podsumowanie i roadmapa',
    description:
      'Synthesize the TIME/6R verdicts, tech-debt score and dependency-sequenced roadmap into an insight-first verdict and a modernization initiative sequence.',
    descriptionPl:
      'Zsyntetyzuj werdykty TIME/6R, wskaźnik długu technicznego i roadmapę sekwencjonowaną zależnościami w werdykt insight-first oraz sekwencję inicjatyw modernizacyjnych.',
    required: true,
    aiAssisted: true,
  },
];
