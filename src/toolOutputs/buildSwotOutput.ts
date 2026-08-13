/**
 * Most sesja Dynamic SWOT → niezmienny Output.
 *
 * To jest miejsce, w którym vertical slice przestaje być atrapą: czytamy
 * REALNE struktury sesji (`SWOTItem`, `SWOTTension`, `SWOTMove`) i REALNE
 * reguły silnika (`isAcceptedSwotItem`, `TENSION_TYPE_TO_POSTURE`,
 * `validateRecommendedMove`), a nie własną, równoległą interpretację metody.
 *
 * Twarde reguły przeniesione z kanonu:
 *  - do Outputu wchodzą WYŁĄCZNIE pozycje zaakceptowane;
 *  - K1 pochodzi z silnika, nigdy z modelu językowego;
 *  - ruch bez trade-offu i odrzuconej alternatywy nie przechodzi bramki W2.
 */

import {
  isAcceptedSwotItem,
  validateRecommendedMove,
} from '@/config/swot/swotTensionEngine';
import type { SWOTItem, SWOTMove, SWOTTension } from '@/store/useToolStore';

import { computeOutputHash } from './outputLifecycle';
import type {
  EvidenceKind,
  OutputConclusion,
  OutputEvidenceItem,
  OutputTension,
  ToolOutput,
} from './types';

/** Waga wpływu — ta sama skala, której używa silnik napięć. */
const IMPACT_WEIGHT: Record<SWOTItem['impact'], number> = { high: 3, medium: 2, low: 1 };

/**
 * Mapuje status dowodu pozycji na wspólny język evidence.
 * `confirmed` → fakt; `declared-unconfirmed` → hipoteza. Brak stempla
 * traktujemy jako obserwację — nigdy jako fakt, bo brak pomiaru to nie pomiar.
 */
function toEvidenceKind(item: SWOTItem): EvidenceKind {
  const status = String(item.evidenceStatus ?? '');
  if (status === 'confirmed') return 'fact';
  if (status.startsWith('declared')) return 'hypothesis';
  return 'observation';
}

export interface BuildSwotOutputInput {
  id: string;
  organizationId: string;
  toolSessionId: string;
  methodPackVersion: string;
  title: string;
  createdAt: string;
  items: SWOTItem[];
  tensions: SWOTTension[];
  moves: SWOTMove[];
}

export interface BuildSwotOutputResult {
  output: ToolOutput;
  /** Ruchy odrzucone przez bramkę W2 wraz z powodem — nie trafiają do Outputu. */
  rejectedMoves: Array<{ moveId: string; reasons: string[] }>;
  /** Napięcia pominięte, bo wskazywały pozycje niezaakceptowane. */
  droppedTensionIds: string[];
}

/**
 * Buduje Output z bieżącego stanu sesji.
 * Wynik jest zawsze w statusie `draft` — zatwierdza człowiek, osobnym krokiem.
 */
export function buildSwotOutput(input: BuildSwotOutputInput): BuildSwotOutputResult {
  // 1. Tylko pozycje zaakceptowane. To jest reguła silnika, nie nasza.
  const accepted = input.items.filter((i) => isAcceptedSwotItem(i));
  const acceptedIds = new Set(accepted.map((i) => i.id));

  const items: OutputEvidenceItem[] = accepted.map((i) => ({
    id: i.id,
    label: i.text,
    bucket: i.quadrant,
    evidenceKind: toEvidenceKind(i),
    impact: i.impact,
  }));

  // 2. Napięcia muszą opierać się na pozycjach, które przetrwały akceptację.
  const droppedTensionIds: string[] = [];
  const tensions: OutputTension[] = [];

  input.tensions.forEach((t) => {
    const linked = (t.linkedItemIds ?? []).filter((id) => acceptedIds.has(id));
    if (linked.length < 2) {
      droppedTensionIds.push(t.id);
      return;
    }
    const [a, b] = linked;
    const weightOf = (id: string) =>
      IMPACT_WEIGHT[accepted.find((i) => i.id === id)?.impact ?? 'medium'];

    tensions.push({
      id: t.id,
      posture: t.type,
      title: t.title,
      sourceItemIds: [a, b],
      // Waga liczona deterministycznie z wpływu obu pozycji — to jest K1.
      priority: weightOf(a) + weightOf(b),
    });
  });

  const tensionIds = new Set(tensions.map((t) => t.id));

  // 3. Ruchy przechodzą bramkę W2 silnika. Odrzucone NIE wchodzą do Outputu.
  const rejectedMoves: BuildSwotOutputResult['rejectedMoves'] = [];
  const conclusions: OutputConclusion[] = [];

  // Bramka W2 silnika potrzebuje zbiorów id sesji, żeby wykryć wiszące linki.
  const sessionRefs = { itemIds: acceptedIds, tensionIds };

  input.moves.forEach((move) => {
    const issues = validateRecommendedMove(move, sessionRefs);
    if (issues.length > 0) {
      // Komunikaty po polsku — to jest język odbioru u właściciela.
      rejectedMoves.push({ moveId: move.id, reasons: issues.map((i) => i.messagePl) });
      return;
    }

    const sourceTensionIds = (move.linkedTensionIds ?? []).filter((id) => tensionIds.has(id));
    const tradeoff = move.tradeoff;
    const rejected = move.rejectedAlternative;

    conclusions.push({
      id: move.id,
      // K1 — fakt zbudowany z policzalnych własności sesji, nie z narracji.
      k1Fact: buildK1(move, sourceTensionIds, tensions),
      k2Meaning: move.rationale,
      k3Actions: [move.firstStep, move.title].filter((x): x is string => Boolean(x)).slice(0, 3),
      // Brak pola expectedEffect na SWOTMove — efekt składamy z wpływu
      // i roli odpowiedzialnej. K4 musi mieć adresata, nie „organizację".
      k4Effect: move.ownerRole
        ? `Oczekiwany wpływ: ${move.expectedImpact}. Odpowiedzialna rola: ${move.ownerRole}.`
        : `Oczekiwany wpływ: ${move.expectedImpact}.`,
      tradeoff: {
        chosen: tradeoff?.chosen ?? move.title,
        // W2 rozróżnia „co odroczone" (tradeoff.deferred) od „co odrzucone"
        // (rejectedAlternative.option). Do Outputu bierzemy odrzuconą opcję.
        rejected: rejected?.option ?? tradeoff?.deferred ?? '',
        why: rejected?.reason ?? tradeoff?.cost ?? '',
      },
      sourceTensionIds,
    });
  });

  const draft = {
    id: input.id,
    organizationId: input.organizationId,
    toolSessionId: input.toolSessionId,
    toolType: 'dynamic-swot',
    methodPackVersion: input.methodPackVersion,
    version: 1,
    title: input.title,
    status: 'draft' as const,
    items,
    tensions,
    conclusions,
    createdAt: input.createdAt,
  };

  return {
    output: { ...draft, contentHash: computeOutputHash(draft) },
    rejectedMoves,
    droppedTensionIds,
  };
}

/** K1: fakt policzony z sesji — liczba napięć i ich waga, nie opinia. */
function buildK1(
  move: SWOTMove,
  sourceTensionIds: string[],
  tensions: OutputTension[]
): string {
  const linked = tensions.filter((t) => sourceTensionIds.includes(t.id));
  if (linked.length === 0) {
    return `Ruch "${move.title}" nie ma napięcia źródłowego w zaakceptowanym materiale.`;
  }
  const weight = linked.reduce((n, t) => n + t.priority, 0);
  const postures = [...new Set(linked.map((t) => t.posture))].join(', ');
  return `Ruch wynika z ${linked.length} napięć o łącznej wadze ${weight} (postawa: ${postures}).`;
}
