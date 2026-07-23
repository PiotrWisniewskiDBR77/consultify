/**
 * Domyślny schemat generatora procesu — KLASYCZNY 5-fazowy konsulting
 * (Kubr/ILO), decyzja Piotra 2026-07-22 ("weź klasyczny konsulting jako
 * pierwszy test" — SPEC §4 Partia 2, Harvard/wdrozenie-100/_SPEC_AGENT_VAULT_2026-07-22.md).
 *
 * To jest ścieżka ① ("AI proponuje") — ładuje się jako punkt startu, user
 * go przestawia (AgentPlanCanvas.tsx). Ścieżka ② startuje z pustej tablicy.
 *
 * Uniwersalny, rozpoznawalny, zbieżny z McKinsey/BCG. DRD (4-krokowy) to
 * WARIANT tego samego szkieletu — biblioteka wariantów jest robotą AGT-006
 * (backend generator), nie tego pliku.
 */
import { makeBlockId, type PlanSchemaBlock } from '@/components/AIChat/AgentPlanCanvas';

/** Fabryka — nowe id przy każdym wywołaniu (unikamy współdzielenia referencji między instancjami canvas). */
export function buildClassicFivePhaseSchema(): PlanSchemaBlock[] {
  return [
    {
      id: makeBlockId(),
      kind: 'etap-modul',
      name: 'Wejście / Kontraktowanie',
      moduleType: 'Chat · My Work',
    },
    {
      id: makeBlockId(),
      kind: 'etap-modul',
      name: 'Diagnoza',
      moduleType: 'Interview · Assessment',
    },
    {
      id: makeBlockId(),
      kind: 'etap-modul',
      name: 'Rekomendacje',
      moduleType: 'Initiatives · Finance',
    },
    {
      id: makeBlockId(),
      kind: 'etap-modul',
      name: 'Wdrożenie',
      moduleType: 'Execution',
    },
    {
      id: makeBlockId(),
      kind: 'etap-modul',
      name: 'Zamknięcie',
      moduleType: 'Results · Materials',
    },
  ];
}
