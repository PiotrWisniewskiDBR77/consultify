/** GENERATED MIRROR — run scripts/cleanup/sync-server-runtime-mirrors.mjs; do not edit directly. */
/**
 * Cykl życia Outputu narzędzia.
 *
 * Odwzorowuje maszynę stanów kernela: zatwierdzony snapshot NIGDY nie jest
 * edytowany w miejscu. `reopen` tworzy NOWĄ rewizję, a poprzednia zostaje
 * oznaczona `superseded` i przechowana jako dowód — dokładnie tak, jak
 * `frozen → active` w kontrakcie wspólnym.
 */

import { contentHash } from './contentHash.js';
import type {
  OutputConclusion,
  ToolOutput,
  ToolOutputStatus,
} from './types.js';

export class ImmutableOutputError extends Error {
  constructor(id: string) {
    super(`Output ${id} jest zatwierdzony i niezmienny. Popraw przez reopen(), który tworzy nową rewizję.`);
    this.name = 'ImmutableOutputError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(from: ToolOutputStatus, to: ToolOutputStatus) {
    super(`Niedozwolone przejście Outputu: ${from} → ${to}.`);
    this.name = 'InvalidTransitionError';
  }
}

/** Dozwolone przejścia. Zatwierdzenie wymaga przejścia przez przegląd. */
const ALLOWED: Record<ToolOutputStatus, ToolOutputStatus[]> = {
  draft: ['in_review'],
  // send back wraca do draft; approve idzie dalej
  in_review: ['approved', 'draft'],
  // zatwierdzony może już tylko zostać zastąpiony nową rewizją
  approved: ['superseded'],
  superseded: [],
};

export function canTransitionOutput(from: ToolOutputStatus, to: ToolOutputStatus): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

/** Przelicza hash z treści merytorycznej (bez pól statusowych i czasów). */
export function computeOutputHash(
  output: Pick<ToolOutput, 'toolType' | 'methodPackVersion' | 'items' | 'tensions' | 'conclusions'>
): string {
  return contentHash({
    toolType: output.toolType,
    methodPackVersion: output.methodPackVersion,
    items: output.items,
    tensions: output.tensions,
    conclusions: output.conclusions,
  });
}

/** Zgłasza Output do przeglądu. */
export function submitForReview(output: ToolOutput): ToolOutput {
  if (!canTransitionOutput(output.status, 'in_review')) {
    throw new InvalidTransitionError(output.status, 'in_review');
  }
  return { ...output, status: 'in_review' };
}

/** Odsyła do poprawy (send back). */
export function sendBack(output: ToolOutput): ToolOutput {
  if (!canTransitionOutput(output.status, 'draft')) {
    throw new InvalidTransitionError(output.status, 'draft');
  }
  return { ...output, status: 'draft' };
}

/**
 * Zatwierdza Output. Od tej chwili rekord jest tylko do odczytu.
 * Teresa nigdy nie jest zatwierdzającym — kontrakt wspólny wymienia
 * zatwierdzanie w `TERESA_FORBIDDEN_EFFECTS`.
 */
export function approve(output: ToolOutput, approvedBy: string, approvedAt: string): ToolOutput {
  if (!canTransitionOutput(output.status, 'approved')) {
    throw new InvalidTransitionError(output.status, 'approved');
  }
  if (!approvedBy) {
    throw new Error('Zatwierdzenie wymaga wskazania człowieka zatwierdzającego.');
  }
  return {
    ...output,
    status: 'approved',
    approvedBy,
    approvedAt,
    contentHash: computeOutputHash(output),
  };
}

/**
 * Otwiera zatwierdzony Output do poprawy, tworząc NOWĄ rewizję.
 * Zwraca parę: zastąpiony oryginał i nową wersję roboczą.
 * Oryginał zostaje nietknięty poza zmianą statusu na `superseded`.
 */
export function reopen(
  approved: ToolOutput,
  newId: string,
  createdAt: string
): { superseded: ToolOutput; revision: ToolOutput } {
  if (approved.status !== 'approved') {
    throw new InvalidTransitionError(approved.status, 'superseded');
  }
  return {
    superseded: { ...approved, status: 'superseded' },
    revision: {
      ...approved,
      id: newId,
      version: approved.version + 1,
      supersedesId: approved.id,
      status: 'draft',
      createdAt,
      approvedBy: undefined,
      approvedAt: undefined,
    },
  };
}

/** Blokuje mutację zatwierdzonego Outputu w miejscu. */
export function mutateConclusions(output: ToolOutput, conclusions: OutputConclusion[]): ToolOutput {
  if (output.status === 'approved' || output.status === 'superseded') {
    throw new ImmutableOutputError(output.id);
  }
  const next = { ...output, conclusions };
  return { ...next, contentHash: computeOutputHash(next) };
}

/**
 * Wyprowadza propozycje inicjatyw z zatwierdzonego Outputu.
 * Każda propozycja wskazuje wniosek źródłowy — to jest traceability.
 * Człowiek zatwierdza przekazanie; funkcja niczego nie rejestruje.
 */
export interface InitiativeProposal {
  sourceConclusionId: string;
  proposedTitle: string;
  rationale: string;
  status: 'proposed';
}

export function proposeInitiatives(output: ToolOutput): InitiativeProposal[] {
  if (output.status !== 'approved') {
    throw new Error('Inicjatywy wyprowadzamy wyłącznie z zatwierdzonego Outputu.');
  }
  return output.conclusions.map((c) => ({
    sourceConclusionId: c.id,
    // Pierwsza akcja K3 jest propozycją tytułu — to rekomendacja, nie fakt.
    proposedTitle: c.k3Actions[0] ?? c.k1Fact,
    rationale: c.k2Meaning,
    status: 'proposed' as const,
  }));
}
