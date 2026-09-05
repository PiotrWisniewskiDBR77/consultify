import type { V8PlanningGateReadinessCheck } from '@/services/api/v8/planning';

/**
 * A20 (uwaga właściciela 2026-09-05): „brak przycisku AI w górnym pasku do
 * wypełnienia karty".
 *
 * ZMIERZONE, nie założone (przebieg sieciowy karty realnego rekordu,
 * `evidence/inicjatywy-tabela-20260905/`): przyciski „Wypełnij z AI" i
 * „Analizuj z AI" ISTNIEJĄ w Menu 2 karty inicjatywy — są jednak trwale
 * `disabled`, razem z „Zapytaj Teresę o tę inicjatywę". Powód:
 *
 *   404 /api/v8/planning/initiatives/<id>/gate-readiness-check
 *   404 /api/initiatives/<id>/gate-readiness-check
 *
 * Karta ładuje się dziś z rejestru `runtime-v1` (naprawa 2026-09-05,
 * `initiativeDocumentSource.ts`), ale ta naprawa objęła TREŚĆ karty, a nie
 * ZDOLNOŚCI. Obie trasy gate-readiness znają wyłącznie stary magazyn v8, więc
 * dla każdego realnego rekordu `gateReadiness` zostawało `null`,
 * a `canUseAi = !!undefined` → przycisk AI wyglądał na nieistniejący.
 *
 * To nie jest obejście uprawnień: gdy serwer ODPOWIADA, jego kontrakt
 * (`source: 'backend'`) wygrywa i nic się nie zmienia. Fallback wchodzi
 * WYŁĄCZNIE tam, gdzie serwer nie ma zdania (404/błąd sieci), i odtwarza tę
 * samą regułę co macierz serwera (`initiativeCapabilityMatrix.ts:201`):
 * `canUseAi = !isTerminal`. Zapis i tak przechodzi przez serwer, który
 * uprawnienia egzekwuje po swojej stronie.
 */
export const INITIATIVE_TERMINAL_STATUSES = new Set(['CANCELLED', 'ARCHIVED']);

/** Znacznik pozwalający odróżnić zdolności wyliczone lokalnie od kontraktu serwera. */
export const GATE_READINESS_FALLBACK_SOURCE = 'client-fallback' as const;

export function buildFallbackGateReadiness(
  status: string | null | undefined
): Partial<V8PlanningGateReadinessCheck> {
  const normalized = String(status || '').toUpperCase();
  const isTerminal = INITIATIVE_TERMINAL_STATUSES.has(normalized);
  const canEdit = !isTerminal;

  return {
    readiness: [],
    userRoles: [],
    capabilities: {
      version: 1,
      source: GATE_READINESS_FALLBACK_SOURCE,
      topBar: {
        canEditPriority: canEdit,
        canEditOwner: canEdit,
        canEditTargetDate: canEdit,
      },
      cards: {
        canEditCards: canEdit,
        reasonCode: canEdit ? null : 'NO_EDIT_PERMISSION_FOR_STATUS_OR_ROLE',
      },
      ctaBar: {
        workflowActions: [],
        contextCreateActions: [],
        canUseAi: canEdit,
        aiAllowedSectionKeys: canEdit ? ['*'] : [],
      },
    },
  } as Partial<V8PlanningGateReadinessCheck>;
}
