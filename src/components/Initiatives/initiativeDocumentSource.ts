/**
 * PRZEJŚCIE NA ŻYWO 2026-09-05 — ROZJAZD LISTA↔KARTA INICJATYWY.
 *
 * Zmierzone na REALNYM koncie właściciela (staging, org a3e05d4a…):
 *   GET /api/initiatives/runtime-v1/initiatives            → 200, realne wiersze
 *       (id `demo-story-20260826-initiative-*`, sourceType DEMO_STORY, demoSeed
 *        2026-08-26 — to FAKT O DANYCH w bazie, nie fikstura klienta)
 *   GET /api/v8/planning/initiatives/<to samo id>           → 404 Initiative not found
 *   GET /api/initiatives/<to samo id>                       → 404 INITIATIVE_NOT_FOUND
 *   GET /api/initiatives?source=interview_insight           → 200, ale bez tego id
 *   GET /api/initiatives/runtime-v1/initiatives/<to samo id>→ 200 (pełny rekord!)
 *
 * Czyli: rekord ISTNIEJE i jest osiągalny dokładnie tą samą trasą, z której
 * pochodzi wiersz listy — a karta (`InitiativeDocumentView.fetchAll`) tej trasy
 * NIGDY nie wołała. Stąd czerwony błąd „Nie udało się załadować karty
 * inicjatywy" na KAŻDYM realnym rekordzie rejestru.
 *
 * Ten moduł jest jednym miejscem rozstrzygania „skąd karta bierze rekord",
 * z wstrzykiwanymi czytnikami — żeby dało się to zmierzyć testem bez UI.
 */
import type { RegisteredInitiativeReadModel } from '@/services/initiatives-execution/runtimeApi';

import { toCanonicalInitiativeRegisterItem } from './initiativeRegisterProjection';

export type InitiativeDocumentActor = { id?: string | null; displayName?: string | null };

/** Znacznik trasy, z której faktycznie przyszedł rekord (do raportów/diagnostyki). */
export type InitiativeDocumentOrigin =
  | 'showcase'
  | 'v8-planning'
  | 'legacy-initiatives'
  | 'initiatives-runtime-v1'
  | 'interview-insight';

/**
 * Rejestracyjny read model runtime-v1 → kształt, którego oczekuje karta.
 * Reużywa kanonicznego adaptera rejestru (`toCanonicalInitiativeRegisterItem`),
 * żeby wiersz listy i karta NIE rozjechały się po raz drugi.
 */
export const toInitiativeDocumentFromRegistration = (
  record: RegisteredInitiativeReadModel,
  actor?: InitiativeDocumentActor
): Record<string, any> => {
  const row = toCanonicalInitiativeRegisterItem(record, actor) as Record<string, any>;
  const problem = String(record.initiative.problem || '').trim();
  return {
    ...row,
    id: record.initiative.initiativeId,
    title: record.initiative.title,
    name: record.initiative.title,
    summary: problem || row.summary || '',
    description: problem || row.description || '',
    problemDefinition: problem ? { symptom: problem } : undefined,
    expectedOutcome: record.initiative.proposedOutcome || undefined,
    canonicalVersion: record.version,
    documentOrigin: 'initiatives-runtime-v1' as InitiativeDocumentOrigin,
  };
};

export interface InitiativeDocumentSourceReaders {
  /** GET /api/v8/planning/initiatives/:id */
  readPlanningInitiative: (initiativeId: string) => Promise<any>;
  /** GET /api/initiatives/:id */
  readLegacyInitiative: (initiativeId: string) => Promise<any>;
  /** GET /api/initiatives/runtime-v1/initiatives/:id */
  readRegisteredInitiative: (initiativeId: string) => Promise<RegisteredInitiativeReadModel>;
  /** GET /api/initiatives?source=interview_insight (lista, przeszukiwana po id) */
  readInterviewInitiatives: () => Promise<any[]>;
  actor?: InitiativeDocumentActor;
  /** Komunikat błędu, gdy ŻADNA trasa nie zna rekordu. */
  notFoundMessage?: string;
}

/**
 * Kolejność jest addytywna względem stanu sprzed naprawy: v8 → legacy pozostają
 * bez zmian (rekordy, które tam są, ładują się bogatszym kształtem), a dopiero
 * potem pytamy rejestr runtime-v1 — tę samą trasę, z której pochodzi lista.
 * Skan `interview_insight` zostaje jako ostatnia deska ratunku.
 */
export async function resolveInitiativeDocumentRecord(
  initiativeId: string,
  readers: InitiativeDocumentSourceReaders
): Promise<Record<string, any>> {
  const notFoundMessage = readers.notFoundMessage || 'Initiative not found';

  try {
    return await readers.readPlanningInitiative(initiativeId);
  } catch {
    /* trasa v8 nie zna rekordu — pytamy dalej */
  }

  try {
    return await readers.readLegacyInitiative(initiativeId);
  } catch {
    /* trasa legacy nie zna rekordu — pytamy dalej */
  }

  try {
    const registration = await readers.readRegisteredInitiative(initiativeId);
    if (registration?.initiative?.initiativeId) {
      return toInitiativeDocumentFromRegistration(registration, readers.actor);
    }
  } catch {
    /* rejestr runtime-v1 nie zna rekordu — pytamy dalej */
  }

  const interviewInitiatives = await readers.readInterviewInitiatives();
  const interviewInitiative = (Array.isArray(interviewInitiatives) ? interviewInitiatives : []).find(
    (item: any) => String(item?.id) === String(initiativeId)
  );
  if (!interviewInitiative) {
    throw new Error(notFoundMessage);
  }
  return interviewInitiative;
}
