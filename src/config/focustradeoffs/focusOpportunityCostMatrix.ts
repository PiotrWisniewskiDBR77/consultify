/**
 * Focus & Trade-offs — opportunity-cost matrix + anti-focus detector (OXFORD O3).
 *
 * Pattern mirror of src/config/portfolio/portfolioMatrixEngine.ts. Where the
 * Portfolio engine classifies elements into a 2x2 and sequences funding under
 * a budget cap, this engine builds a CHOICE x OPPORTUNITY-COST matrix: for
 * every active priority it names the specific alternative that loses capacity
 * because this one wins, and the SIZE of that cost (derived from the score gap,
 * never free-floating AI prose).
 *
 * The second job of this file is the doctrine's defining anti-pattern check:
 * "Focus & Trade-offs" fails its own purpose the moment NOTHING is rejected.
 * detectAntiFocus() flags a session where every (or nearly every) priority is
 * marked "pursue" and none is deferred or dropped — Porter's "strategy is
 * choosing what NOT to do" turned upside down into "we will do everything",
 * which is not a strategy, it is a wishlist with an executive summary.
 */

import type { FocusPriority, FocusTradeoffData } from '@/store/useToolStore';

import { rankPriorities } from './moveValidator';

type Bilingual = { pl: string; en: string };

const isActive = (p: FocusPriority) =>
  p.proposalStatus !== 'rejected' && p.proposalStatus !== 'rethinking';

// ---------------------------------------------------------------------------
// Choice x opportunity-cost matrix
// ---------------------------------------------------------------------------

export type OpportunityCostMagnitude = 'high' | 'medium' | 'low';

export interface OpportunityCostRow {
  /** The priority making the case for scarce attention. */
  priorityId: string;
  title: string;
  lane: 'pursue' | 'defer' | 'drop';
  score: number;
  /** The specific alternative priority this choice costs — never "everything". */
  opportunityCostId?: string;
  opportunityCostTitle?: string;
  /** Size of the cost, derived from the score gap between this and the alternative. */
  magnitude: OpportunityCostMagnitude;
  narrative: Bilingual;
}

const magnitudeFromGap = (gap: number): OpportunityCostMagnitude => {
  if (gap >= 4) return 'high';
  if (gap >= 1.5) return 'medium';
  return 'low';
};

/**
 * Build the choice x opportunity-cost matrix: one row per active priority,
 * each paired against the single best alternative it displaces (the
 * next-best-ranked active priority it is not funding by winning attention).
 * Deterministic — the pairing and magnitude come from the engine's ranking,
 * never from unaudited AI prose.
 */
export function buildOpportunityCostMatrix(data: FocusTradeoffData): OpportunityCostRow[] {
  const { scores, ordered } = rankPriorities(data);
  if (ordered.length === 0) return [];

  const scoreOf = (id: string) => scores.find((s) => s.id === id)!;

  return ordered.map((id, index) => {
    const current = scoreOf(id);
    // Pair against the adjacent lower-ranked priority (the one it directly
    // outranks for the next slice of scarce attention); the top priority
    // pairs against the immediate runner-up instead (what it wins over).
    const partnerId = index === 0 ? ordered[1] : ordered[index - 1];
    const partner = partnerId ? scoreOf(partnerId) : undefined;
    const gap = partner ? Math.abs(current.score - partner.score) : 0;
    const magnitude = magnitudeFromGap(gap);

    const narrative: Bilingual = partner
      ? {
          pl: `„${current.title}" (fokus ${current.score}/9) zabiera uwagę i zasób przed „${partner.title}" (${partner.score}/9) — różnica ${gap.toFixed(1)} pkt.`,
          en: `"${current.title}" (focus ${current.score}/9) takes attention and resource ahead of "${partner.title}" (${partner.score}/9) — a gap of ${gap.toFixed(1)} pts.`,
        }
      : {
          pl: `„${current.title}" (fokus ${current.score}/9) nie ma jeszcze konkurenta na liście — koszt alternatywny jest niewidoczny, dopóki nie dojdzie druga opcja.`,
          en: `"${current.title}" (focus ${current.score}/9) has no competitor on the list yet — the opportunity cost stays invisible until a second option is added.`,
        };

    return {
      priorityId: current.id,
      title: current.title,
      lane: current.lane,
      score: current.score,
      opportunityCostId: partner?.id,
      opportunityCostTitle: partner?.title,
      magnitude,
      narrative,
    };
  });
}

/** Prompt block serializing the matrix — used by the conclusion prompt. */
export function buildOpportunityCostPromptBlock(
  data: FocusTradeoffData,
  isPolish: boolean
): string {
  const rows = buildOpportunityCostMatrix(data);
  if (rows.length === 0) {
    return isPolish
      ? '(brak priorytetów — macierz koszt-alternatywny pusta)'
      : '(no priorities yet — opportunity-cost matrix empty)';
  }
  return rows
    .map((r) => {
      const text = isPolish ? r.narrative.pl : r.narrative.en;
      return `- [${r.priorityId}] "${r.title}" (${r.lane}, ${r.score}/9) opportunity cost: ${r.opportunityCostTitle || '—'} (${r.magnitude}) — ${text}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Anti-focus detector — "wszystko-priorytet" flag
// ---------------------------------------------------------------------------

export type AntiFocusReason = 'no-priorities' | 'nothing-rejected' | 'everything-pursue';

export interface AntiFocusVerdict {
  /** true = the session shows no evidence of a real focus decision. */
  flagged: boolean;
  reason?: AntiFocusReason;
  totalCount: number;
  pursueCount: number;
  deferCount: number;
  dropCount: number;
  pursueRatio: number;
  message: Bilingual;
}

/**
 * The doctrine's core anti-pattern check: if a session has 2+ active priorities
 * and NONE is deferred or dropped, "focus" never actually happened — everything
 * is a priority, which by definition means nothing is. Also flags the milder
 * case of an overwhelming pursue-ratio (>=80%) with zero drops, which is the
 * same failure mode wearing a thin disguise of "we deferred one thing".
 */
export function detectAntiFocus(data: FocusTradeoffData): AntiFocusVerdict {
  const active = (data.priorities || []).filter(isActive);
  const totalCount = active.length;
  const pursueCount = active.filter((p) => p.recommendation === 'pursue').length;
  const deferCount = active.filter((p) => p.recommendation === 'defer').length;
  const dropCount = active.filter((p) => p.recommendation === 'drop').length;
  const pursueRatio = totalCount > 0 ? pursueCount / totalCount : 0;

  if (totalCount === 0) {
    return {
      flagged: false,
      reason: 'no-priorities',
      totalCount,
      pursueCount,
      deferCount,
      dropCount,
      pursueRatio,
      message: {
        pl: 'Brak priorytetów w sesji — nie ma jeszcze czego oceniać pod kątem anty-fokusu.',
        en: 'No priorities in the session yet — nothing to evaluate for anti-focus.',
      },
    };
  }

  // Single-priority sessions cannot show a rejection pattern yet — not a flag.
  if (totalCount === 1) {
    return {
      flagged: false,
      totalCount,
      pursueCount,
      deferCount,
      dropCount,
      pursueRatio,
      message: {
        pl: 'Tylko jeden priorytet w sesji — dodajcie konkurujące opcje, żeby test anty-fokusu miał sens.',
        en: 'Only one priority in the session — add competing options for the anti-focus check to be meaningful.',
      },
    };
  }

  const nothingRejected = deferCount === 0 && dropCount === 0;
  if (nothingRejected) {
    return {
      flagged: true,
      reason: 'nothing-rejected',
      totalCount,
      pursueCount,
      deferCount,
      dropCount,
      pursueRatio,
      message: {
        pl: `Flaga braku strategii: ${pursueCount}/${totalCount} priorytetów oznaczono „pursue", ZERO odłożono lub porzucono. „Wszystko jest priorytetem" oznacza, że nic nim nie jest — brak realnej decyzji o fokusie.`,
        en: `No-strategy flag: ${pursueCount}/${totalCount} priorities are marked "pursue", ZERO deferred or dropped. "Everything is a priority" means nothing is — no real focus decision was made.`,
      },
    };
  }

  if (pursueRatio >= 0.8 && dropCount === 0) {
    return {
      flagged: true,
      reason: 'everything-pursue',
      totalCount,
      pursueCount,
      deferCount,
      dropCount,
      pursueRatio,
      message: {
        pl: `Flaga słabego fokusu: ${Math.round(pursueRatio * 100)}% priorytetów to „pursue" i ani jeden nie został porzucony (tylko odłożony) — to rozproszenie ubrane w harmonogram, nie decyzja o cięciu.`,
        en: `Weak-focus flag: ${Math.round(pursueRatio * 100)}% of priorities are "pursue" and not a single one was dropped (only deferred) — that is dilution dressed as a schedule, not a cutting decision.`,
      },
    };
  }

  return {
    flagged: false,
    totalCount,
    pursueCount,
    deferCount,
    dropCount,
    pursueRatio,
    message: {
      pl: `Fokus wykazany: ${dropCount} porzucone, ${deferCount} odłożone, ${pursueCount} w realizacji z ${totalCount}.`,
      en: `Focus demonstrated: ${dropCount} dropped, ${deferCount} deferred, ${pursueCount} pursued out of ${totalCount}.`,
    },
  };
}

/** Prompt block teaching the model the anti-focus contract (PL/EN aware). */
export function buildAntiFocusPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `ANTY-FOKUS (bramka nadrzędna nad W2): jeśli WSZYSTKIE priorytety mają rekomendację "pursue" i ŻADEN nie jest "defer" ani "drop", sesja jest niepoprawna — to wzorzec „wszystko-priorytet", czyli brak strategii. Werdykt MUSI zawierać co najmniej jedno jawne odrzucenie lub odłożenie z powodem; jeśli silnik zgłasza flagę anty-fokusu, "summary.verdict" MUSI nazwać to wprost i wskazać, co należy porzucić lub odłożyć jako pierwsze.`;
  }
  return `ANTI-FOCUS (a gate ABOVE the W2 gate): if ALL priorities are recommended "pursue" and NONE is "defer" or "drop", the session is invalid — this is the "everything-is-a-priority" anti-pattern, i.e. no strategy. The verdict MUST contain at least one explicit rejection or deferral with a reason; if the engine reports an anti-focus flag, "summary.verdict" MUST name it explicitly and state what to drop or defer first.`;
}
