/**
 * Integration Diagnostic — wizard step definitions.
 *
 * Six steps mirror the doctrine's method order (Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/
 * integration-diagnostic.md §4): context first, then the raw inventory (systems →
 * integrations → manual bridges), then the candidate move sequence, then the
 * insight-first synthesis. The section ids MUST match what
 * `toIntegrationSession` (src/config/integrationdiagnostic/index.ts) reads off
 * `OperationalToolData.sections`: `systems`, `integrations`, `bridges`, `moves`.
 */

import type { StepDefinition } from '@/store/useToolStore';

export const INTEGRATION_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Mission Context',
    namePl: 'Kontekst misji',
    description:
      'Define the goal, scope and timeframe of the integration diagnosis — why now (new core system, M&A, visible data silos, recurring manual re-keying).',
    descriptionPl:
      'Zdefiniuj cel, zakres i horyzont diagnostyki integracji — dlaczego teraz (nowy system core, fuzja, widoczne silosy danych, powtarzalne ręczne przepisywanie).',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'systems',
    name: 'Application Landscape',
    namePl: 'Mapa systemów',
    description:
      'Map the active systems (core + satellite, SaaS + on-prem) with business/technical owner and API readiness — the raw material every other step depends on.',
    descriptionPl:
      'Zmapuj aktywne systemy (core + satelitarne, SaaS + on-prem) z właścicielem biznesowym/technicznym i gotowością API — surowy materiał, od którego zależą wszystkie kolejne kroki.',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'integrations',
    name: 'Integration Inventory',
    namePl: 'Inwentarz integracji',
    description:
      'For every pair of systems that exchange data: direction, mechanism (API/file/DB/manual), frequency, documentation, criticality and SPOF/MTTR — the point-to-point vs hub topology baseline.',
    descriptionPl:
      'Dla każdej pary systemów wymieniających dane: kierunek, mechanizm (API/plik/baza/ręcznie), częstotliwość, dokumentacja, krytyczność i SPOF/MTTR — baza topologii point-to-point vs hub.',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'bridges',
    name: 'Manual Bridges',
    namePl: 'Ręczne mostki',
    description:
      'Quantify every manual re-keying bridge (people × hours/month × error rate) — a manual bridge is a missing integration, evidenced, not hypothesized.',
    descriptionPl:
      'Skwantyfikuj każdy ręczny mostek re-keyingu (osoby × godziny/miesiąc × stopa błędu) — ręczny mostek to brakująca integracja, dowód, nie hipoteza.',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'moves',
    name: 'Integration Moves',
    namePl: 'Ruchy integracyjne',
    description:
      'Candidate moves per lever (inventory / topology / bridges / API-led), each carrying impact, effort and evidence — feeds the W2 System→Process→Experience sequence.',
    descriptionPl:
      'Kandydaci na ruchy per dźwignia (inwentarz / topologia / mostki / API-led), każdy z impaktem, wysiłkiem i dowodem — zasila sekwencję W2 System→Process→Experience.',
    required: false,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i inicjatywy',
    description:
      'Synthesize the topology/re-keying baseline and lever ranking into an insight-first verdict and a W2-validated initiative sequence.',
    descriptionPl:
      'Zsyntetyzuj bazę topologii/re-keyingu i ranking dźwigni w werdykt insight-first oraz zwalidowaną W2 sekwencję inicjatyw.',
    required: true,
    aiAssisted: true,
  },
];
