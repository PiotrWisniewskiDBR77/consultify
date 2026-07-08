/**
 * Data Inventory — step definitions.
 *
 * Five-step flow matching the tool's `sections` keys read by the adapter
 * (src/config/datainventory/dataInventoryEngine.ts → toDataInventorySession):
 *   - context    : ConsultingMissionContext (goal/scope/timeframe) — not a section array
 *   - assets      -> sections['assets']  (data-asset registry: domain/owner/steward/
 *                    sensitive/darkData/consumers — orphan & dark-data detection)
 *   - domains     -> sections['domains'] (per-domain DAMA quality profile + Gartner
 *                    governance maturity + AI-readiness dimensions)
 *   - useCase     -> sections['useCase'] (the planned AI use-case + the domains it
 *                    requires — gates AI readiness by the weakest critical domain)
 *   - summary     : four diagnoses (inventory/quality/governance/AI readiness) + W2
 *                    governance sequence + recommended initiatives
 *
 * Mirrors the Inventory Autopilot / Control Tower step shape (context → capture →
 * capture → capture → summary), specialized to the four data-governance levers
 * (inventory / quality / governance / aiReadiness) from deepeningLadder.ts.
 */

import type { StepDefinition } from '@/store/useToolStore';

export const DATA_INVENTORY_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Data Inventory Context',
    namePl: 'Kontekst Inwentaryzacji Danych',
    description: 'Define scope, business function and the AI/governance ambition behind the inventory',
    descriptionPl: 'Zdefiniuj zakres, funkcję biznesową i ambicję AI/governance stojącą za inwentaryzacją',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'assets',
    name: 'Data Assets',
    namePl: 'Aktywa Danych',
    description:
      'Catalog data assets (systems, warehouses, "living" sheets, SaaS) with domain, owner, steward and sensitivity — surface orphans and dark data',
    descriptionPl:
      'Skataloguj aktywa danych (systemy, hurtownie, „żyjące" arkusze, SaaS) z domeną, właścicielem, stewardem i wrażliwością — ujawnij sieroce zbiory i dark data',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'domains',
    name: 'Domain Quality & Governance',
    namePl: 'Jakość i Governance Domen',
    description:
      'Score each domain across the 8 DAMA quality dimensions, its Gartner governance maturity level, and AI-readiness dimensions',
    descriptionPl:
      'Oceń każdą domenę po 8 wymiarach jakości DAMA, poziomie dojrzałości governance (Gartner) i wymiarach gotowości AI',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'useCase',
    name: 'AI Use Case',
    namePl: 'Przypadek Użycia AI',
    description: 'Define the planned AI use-case and the data domains it stands on',
    descriptionPl: 'Zdefiniuj planowany przypadek użycia AI i domeny danych, na których ma stanąć',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description:
      'Summarize the inventory, quality profile, governance spread and AI readiness, and generate the W2 governance sequence as initiatives',
    descriptionPl:
      'Podsumuj inwentarz, profil jakości, rozjazd governance i gotowość AI oraz wygeneruj sekwencję governance W2 jako inicjatywy',
    required: true,
    aiAssisted: true,
  },
];
