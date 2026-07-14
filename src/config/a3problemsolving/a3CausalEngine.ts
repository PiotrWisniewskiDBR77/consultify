/**
 * A3 Problem Solving — deterministic causal-chain engine (OXFORD O3).
 *
 * The A3 analogue of src/config/swot/swotTensionEngine.ts and
 * src/config/porter/porterSynthesisEngine.ts. Where SWOT derives SO/WO/ST/WT
 * TENSIONS and Porter derives force INTENSITY, A3 derives the 5-Why CAUSAL CHAIN
 * and — the audit-critical distinction — separates a SYMPTOM from a ROOT CAUSE.
 *
 * The chain is computed DETERMINISTICALLY from accepted "why" links, NOT narrated
 * by the LLM. An LLM inventing a plausible five-step chain is the exact failure an
 * A3 must prevent (fixing a cause the data never confirmed). So:
 *
 * 1. buildCausalChain walks parent links to order the whys and detects cycles /
 *    orphans / multiple roots — structure the model cannot fake.
 * 2. classifyCauseRole labels each link ROOT only when it is terminal (no deeper
 *    why), carries a classified dimension (process/tools/skills/incentives) AND
 *    is evidenced; everything with a deeper cause, or unevidenced, stays SYMPTOM.
 * 3. The W2 validator (ported 1:1 from porterSynthesisEngine.validatePorterMove)
 *    gates every countermeasure on rationale + trade-off + rejected alternative,
 *    linked to a real cause id — a recommendation without a trade-off is a list,
 *    not a decision.
 *
 * Pure and testable: it defines its OWN lightweight input types (like the Porter
 * ladder-answer type) so it never depends on store shape.
 */

/** The four root dimensions — each demands a different countermeasure type. */
export type A3RootDimension = 'process' | 'tools' | 'skills' | 'incentives';

/** A single link in the 5-Why chain, as accepted in the session. */
export interface A3CausalLink {
  id: string;
  /** The "why" statement at this link. */
  statement: string;
  /** The link this one answers ("why does THAT happen?"). null = top of chain (closest to symptom). */
  parentId: string | null;
  /** Evidence refs (signal/data ids). Empty = declared, unconfirmed. */
  evidenceRefs?: string[];
  /** Dimension classification, set once the team decides where the root lives. */
  dimension?: A3RootDimension;
  /**
   * Share of the problem gap (0..1) this link is judged to explain. Used to reject
   * a "root" that only explains a cosmetic slice of the gap.
   */
  gapShare?: number;
}

export type A3CauseRole = 'symptom' | 'candidate-root' | 'root';

export interface A3ClassifiedCause {
  id: string;
  statement: string;
  /** Depth in the chain: 0 = closest to the symptom, increasing as we dig. */
  depth: number;
  role: A3CauseRole;
  dimension?: A3RootDimension;
  evidenced: boolean;
  gapShare?: number;
  /** Human-facing why this role was assigned (the "insight staircase — skąd wniosek"). */
  reasonEn: string;
  reasonPl: string;
}

export interface A3CausalChainIssue {
  code: 'cycle' | 'orphan-parent' | 'multiple-heads' | 'empty';
  detail: string;
}

export interface A3CausalChain {
  /** Ordered links from symptom-side (depth 0) to the deepest cause. */
  ordered: A3ClassifiedCause[];
  /** The single confirmed root cause, if exactly one qualifies. */
  root: A3ClassifiedCause | null;
  /** Deepest links that are terminal but do not yet qualify as a confirmed root. */
  candidateRoots: A3ClassifiedCause[];
  /** Structural problems (cycle, orphan parent, more than one chain head). */
  issues: A3CausalChainIssue[];
}

const MIN_ROOT_GAP_SHARE = 0.5;

const isEvidenced = (link: A3CausalLink): boolean =>
  Boolean(link.evidenceRefs && link.evidenceRefs.length > 0);

/**
 * Classify one link's role given whether a deeper cause exists.
 * ROOT only when: terminal (nothing deeper) AND classified into a dimension AND
 * evidenced AND (gapShare undefined OR >= MIN_ROOT_GAP_SHARE). A terminal link
 * missing any of those is a CANDIDATE-ROOT (dig / confirm before acting). A link
 * with a deeper cause is, by definition, still a SYMPTOM on the way down.
 */
function classifyCauseRole(
  link: A3CausalLink,
  hasDeeperCause: boolean,
  depth: number
): A3ClassifiedCause {
  const evidenced = isEvidenced(link);
  const base = {
    id: link.id,
    statement: link.statement,
    depth,
    dimension: link.dimension,
    evidenced,
    gapShare: link.gapShare,
  };

  if (hasDeeperCause) {
    return {
      ...base,
      role: 'symptom',
      reasonEn: 'A deeper "why" exists — this is a symptom on the way to the root, not the root.',
      reasonPl: 'Istnieje głębsze „dlaczego" — to objaw w drodze do korzenia, nie korzeń.',
    };
  }

  // Terminal link: is it a confirmed root or only a candidate?
  const gapOk = link.gapShare === undefined || link.gapShare >= MIN_ROOT_GAP_SHARE;
  if (link.dimension && evidenced && gapOk) {
    return {
      ...base,
      role: 'root',
      reasonEn: `Terminal, evidenced and classified as a ${link.dimension} root${
        link.gapShare !== undefined
          ? ` explaining ${Math.round(link.gapShare * 100)}% of the gap`
          : ''
      } — act here.`,
      reasonPl: `Terminalny, udowodniony i sklasyfikowany jako korzeń typu ${link.dimension}${
        link.gapShare !== undefined ? `, tłumaczący ${Math.round(link.gapShare * 100)}% luki` : ''
      } — działaj tutaj.`,
    };
  }

  const missing: string[] = [];
  const missingPl: string[] = [];
  if (!link.dimension) {
    missing.push('no dimension classified');
    missingPl.push('brak klasyfikacji wymiaru');
  }
  if (!evidenced) {
    missing.push('no evidence');
    missingPl.push('brak dowodu');
  }
  if (!gapOk) {
    missing.push('explains a minority of the gap');
    missingPl.push('tłumaczy mniejszość luki');
  }
  return {
    ...base,
    role: 'candidate-root',
    reasonEn: `Terminal but not yet a confirmed root (${missing.join(', ')}) — confirm before building a countermeasure.`,
    reasonPl: `Terminalny, ale jeszcze nie potwierdzony korzeń (${missingPl.join(', ')}) — potwierdź, zanim zbudujesz przeciwśrodek.`,
  };
}

/**
 * Build the ordered causal chain from accepted links, deterministically.
 * Detects cycles, orphan parent references and multiple chain heads (a link
 * whose parent is null when another head already exists) so the structure is
 * auditable — the LLM cannot smuggle in a fabricated chain.
 */
export function buildCausalChain(links: A3CausalLink[]): A3CausalChain {
  const issues: A3CausalChainIssue[] = [];
  if (links.length === 0) {
    return {
      ordered: [],
      root: null,
      candidateRoots: [],
      issues: [{ code: 'empty', detail: 'no causal links' }],
    };
  }

  const byId = new Map(links.map((l) => [l.id, l]));
  const childrenOf = new Map<string, A3CausalLink[]>();
  const heads: A3CausalLink[] = [];

  links.forEach((l) => {
    if (l.parentId === null) {
      heads.push(l);
      return;
    }
    if (!byId.has(l.parentId)) {
      issues.push({ code: 'orphan-parent', detail: `${l.id} -> missing parent ${l.parentId}` });
      // Treat an orphan as a head so it still gets classified.
      heads.push(l);
      return;
    }
    const siblings = childrenOf.get(l.parentId) || [];
    siblings.push(l);
    childrenOf.set(l.parentId, siblings);
  });

  if (heads.length === 0) {
    // No head means every link points at a parent — a cycle.
    issues.push({ code: 'cycle', detail: 'no chain head; links form a cycle' });
    return { ordered: [], root: null, candidateRoots: [], issues };
  }
  if (heads.length > 1) {
    issues.push({
      code: 'multiple-heads',
      detail: `${heads.length} chain heads: ${heads.map((h) => h.id).join(', ')}`,
    });
  }

  // Walk from the (first) head downward, following the deepening cause each step.
  const ordered: A3ClassifiedCause[] = [];
  const seen = new Set<string>();
  let cursor: A3CausalLink | undefined = heads[0];
  let depth = 0;
  while (cursor) {
    if (seen.has(cursor.id)) {
      issues.push({ code: 'cycle', detail: `cycle detected at ${cursor.id}` });
      break;
    }
    seen.add(cursor.id);
    const children: A3CausalLink[] = childrenOf.get(cursor.id) || [];
    ordered.push(classifyCauseRole(cursor, children.length > 0, depth));
    // Deterministic: follow the deepest single child; if the chain branches,
    // follow the first child by id order and record the branch as a candidate.
    cursor = children
      .slice()
      .sort((a: A3CausalLink, b: A3CausalLink) => a.id.localeCompare(b.id))[0];
    depth += 1;
  }

  const roots = ordered.filter((c) => c.role === 'root');
  const candidateRoots = ordered.filter((c) => c.role === 'candidate-root');
  const root = roots.length === 1 ? roots[0] : null;

  return { ordered, root, candidateRoots, issues };
}

/**
 * Convenience verdict: does the session have a signable root cause?
 * Signable = a single confirmed root, no structural issues.
 */
export interface A3RootVerdict {
  hasConfirmedRoot: boolean;
  root: A3ClassifiedCause | null;
  verdictEn: string;
  verdictPl: string;
}

export function assessRootCause(links: A3CausalLink[]): A3RootVerdict {
  const chain = buildCausalChain(links);
  const structuralOk = chain.issues.every((i) => i.code === 'multiple-heads');

  if (chain.root && structuralOk) {
    return {
      hasConfirmedRoot: true,
      root: chain.root,
      verdictEn: `Confirmed root cause: "${chain.root.statement}" (${chain.root.dimension}). Countermeasures may target it.`,
      verdictPl: `Potwierdzona przyczyna źródłowa: „${chain.root.statement}" (${chain.root.dimension}). Przeciwśrodki mogą w nią celować.`,
    };
  }

  const deepest = chain.candidateRoots[chain.candidateRoots.length - 1] || null;
  return {
    hasConfirmedRoot: false,
    root: null,
    verdictEn: deepest
      ? `No confirmed root yet — deepest link "${deepest.statement}" is only a candidate (${deepest.reasonEn}).`
      : 'No confirmed root cause yet — run an evidenced 5-Why before proposing countermeasures.',
    verdictPl: deepest
      ? `Brak potwierdzonego korzenia — najgłębsze ogniwo „${deepest.statement}" to tylko kandydat (${deepest.reasonPl}).`
      : 'Brak potwierdzonej przyczyny źródłowej — przeprowadź udowodnione 5×Why przed proponowaniem przeciwśrodków.',
  };
}

// ---------------------------------------------------------------------------
// W2 countermeasure validation — rationale + trade-off + rejected alternative
// (ported 1:1 from porterSynthesisEngine.validatePorterMove; here the link is to
//  a confirmed root cause id instead of a Porter force id)
// ---------------------------------------------------------------------------

export interface A3CountermeasureTradeoff {
  /** What we choose to do. */
  chosen: string;
  /** What we defer/give up by choosing it. */
  deferred: string;
  /** At what cost (the price of the deferral, named). */
  cost: string;
}

export interface A3CountermeasureRejectedAlternative {
  option: string;
  reason: string;
}

export interface A3CountermeasureInput {
  rationale?: string;
  /** Cause ids this countermeasure removes — must reference confirmed session causes. */
  linkedCauseIds?: string[];
  tradeoff?: A3CountermeasureTradeoff;
  rejectedAlternative?: A3CountermeasureRejectedAlternative;
}

export interface A3CountermeasureIssue {
  code:
    | 'missing-rationale'
    | 'unlinked-rationale'
    | 'dangling-links'
    | 'missing-tradeoff'
    | 'incomplete-tradeoff'
    | 'missing-rejected-alternative';
  messageEn: string;
  messagePl: string;
}

/**
 * CONCLUSION_LAYER W2 gate for a countermeasure:
 * 1. rationale present AND anchored in existing session cause ids,
 * 2. mandatory trade-off with all three parts (chosen / deferred / cost),
 * 3. a rejected alternative with a reason ("no decision was made" otherwise).
 */
export function validateCountermeasure(
  move: A3CountermeasureInput,
  session: { causeIds: Set<string> }
): A3CountermeasureIssue[] {
  const issues: A3CountermeasureIssue[] = [];

  if (!move.rationale?.trim()) {
    issues.push({
      code: 'missing-rationale',
      messageEn: 'Countermeasure has no rationale — which root cause justifies it?',
      messagePl: 'Przeciwśrodek nie ma uzasadnienia — która przyczyna źródłowa go uzasadnia?',
    });
  }

  const links = move.linkedCauseIds || [];
  if (links.length === 0) {
    issues.push({
      code: 'unlinked-rationale',
      messageEn:
        'Countermeasure is linked to no root cause — it masks a symptom instead of removing a cause.',
      messagePl:
        'Przeciwśrodek nie jest powiązany z żadną przyczyną źródłową — maskuje objaw zamiast usuwać przyczynę.',
    });
  } else {
    const dangling = links.filter((id) => !session.causeIds.has(id));
    if (dangling.length > 0) {
      issues.push({
        code: 'dangling-links',
        messageEn: `Countermeasure references causes that do not exist in the session: ${dangling.join(', ')}.`,
        messagePl: `Przeciwśrodek odwołuje się do przyczyn, których nie ma w sesji: ${dangling.join(', ')}.`,
      });
    }
  }

  if (!move.tradeoff) {
    issues.push({
      code: 'missing-tradeoff',
      messageEn:
        'Countermeasure has no trade-off — a recommendation without a trade-off is a list, not a decision (W2).',
      messagePl:
        'Przeciwśrodek nie ma trade-offu — rekomendacja bez trade-offu to lista, nie decyzja (W2).',
    });
  } else if (
    !move.tradeoff.chosen?.trim() ||
    !move.tradeoff.deferred?.trim() ||
    !move.tradeoff.cost?.trim()
  ) {
    issues.push({
      code: 'incomplete-tradeoff',
      messageEn:
        'Trade-off is incomplete — it must name what is chosen, what is deferred, and at what cost.',
      messagePl:
        'Trade-off jest niekompletny — musi nazywać co wybieramy, co odkładamy i kosztem czego.',
    });
  }

  if (
    !move.rejectedAlternative ||
    !move.rejectedAlternative.option?.trim() ||
    !move.rejectedAlternative.reason?.trim()
  ) {
    issues.push({
      code: 'missing-rejected-alternative',
      messageEn:
        'Countermeasure names no rejected alternative — which option was considered and why was it dropped?',
      messagePl:
        'Przeciwśrodek nie wskazuje odrzuconego wariantu — jaka opcja była rozważana i dlaczego odpadła?',
    });
  }

  return issues;
}

export interface A3CountermeasureSetVerdict {
  ok: boolean;
  perMove: { title: string; issues: A3CountermeasureIssue[] }[];
}

/** Validate all accepted/pending countermeasures of a session in one pass (review gate input). */
export function validateCountermeasureSet(
  moves: (A3CountermeasureInput & { title: string; proposalStatus?: string })[],
  causeIds: string[]
): A3CountermeasureSetVerdict {
  const session = { causeIds: new Set(causeIds) };
  const relevant = moves.filter(
    (m) => m.proposalStatus !== 'rejected' && m.proposalStatus !== 'rethinking'
  );
  const perMove = relevant.map((move) => ({
    title: move.title,
    issues: validateCountermeasure(move, session),
  }));
  return { ok: perMove.every((m) => m.issues.length === 0), perMove };
}

/** Prompt block teaching the model the W2 countermeasure contract (PL/EN aware). */
export function buildCountermeasureConclusionPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDY przeciwśrodek realizuje wariant W2 CONCLUSION_LAYER_STANDARD:
- "rationale": dlaczego ten przeciwśrodek — z odwołaniem do KONKRETNEJ przyczyny źródłowej; "linkedCauseIds" musi wskazywać istniejące id przyczyny (nie objawu).
- "tradeoff": {"chosen":"co wybieramy","deferred":"co odkładamy","cost":"kosztem czego"} — OBOWIĄZKOWY; rekomendacja bez trade-offu to lista, nie decyzja.
- "rejectedAlternative": {"option":"rozważany wariant","reason":"dlaczego odrzucony"} — OBOWIĄZKOWY.
- "firstStep": czasownik + artefakt + rola odpowiedzialna (nie „organizacja powinna").
- Kolejność: powstrzymaj → usuń potwierdzony korzeń → ustandaryzuj; żaden przeciwśrodek bez wskazanej przyczyny.`;
  }
  return `EVERY countermeasure implements variant W2 of CONCLUSION_LAYER_STANDARD:
- "rationale": why this countermeasure — referencing a SPECIFIC root cause; "linkedCauseIds" must point at existing cause ids (not a symptom).
- "tradeoff": {"chosen":"what we choose","deferred":"what we defer","cost":"at what cost"} — MANDATORY; a recommendation without a trade-off is a list, not a decision.
- "rejectedAlternative": {"option":"considered option","reason":"why rejected"} — MANDATORY.
- "firstStep": verb + artifact + accountable role (never "the organization should").
- Sequence: contain → eliminate the confirmed root → standardize; no countermeasure without a named cause.`;
}
