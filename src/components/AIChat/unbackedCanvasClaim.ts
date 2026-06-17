/**
 * Unbacked canvas/document claim detector (GAP M02 L-03 / M01 L-09 Tryb A).
 *
 * Problem this guards against
 * ---------------------------
 * When a chat message does NOT match any creation-intent regex, no handoff
 * fires and nothing is actually written to the Canvas / Outputs / a document.
 * But the LLM (Teresa) may STILL hallucinate a completed-action confirmation in
 * prose — "Dodałem do Canvasa", "Zapisałem dokument", "I've added it to your
 * Canvas", "Done — saved the document" — even though no tool/handoff path ran.
 * That breaks the persona honesty contract encoded in
 * `server/src/ai/persona.ts` ("PROPONUJ, nie udawaj wykonania … Nigdy nie
 * twierdź, że coś zrobiłeś" / "PROPOSE, don't fake execution … Never claim you
 * did something you cannot verify was done").
 *
 * There is NO function-calling yet (that is Fala 2). This module is the
 * strongest *deterministic, testable* guard achievable without it: a pure
 * detector over the finalized assistant string + a predicate that only treats a
 * completion claim as legitimate when a real handoff/tool path actually fired.
 *
 * Design — completed-claim vs proposal
 * ------------------------------------
 * We match COMPLETED-ACTION claims (past-tense / done-state assertions) against
 * a canvas/document/deliverable TARGET, and we explicitly EXEMPT proposals,
 * offers and questions ("mogę dodać", "chcesz, żebym dodał", "I can add",
 * "would you like me to add", "shall I save"). Precision over recall: a missed
 * exotic phrasing is far cheaper than flagging an honest proposal as a lie.
 *
 * Diacritics: JS `\b` does NOT treat ę/ł/ó/ą/ś/ż/ź/ć/ń as word chars, so we
 * never place `\b` immediately after a Polish stem — we match stems open-ended
 * to also cover inflected forms (dodałem/dodałam/dodaliśmy, zapisałem/…).
 */

// ---------------------------------------------------------------------------
// 1. Proposal / offer / question guard (these are ALLOWED — never flagged).
//    Checked FIRST: if a message reads as an offer to act, it is honest even if
//    it also contains a completed-action verb stem somewhere.
// ---------------------------------------------------------------------------
const PROPOSAL_MARKERS: RegExp[] = [
  // PL — modal / conditional / offer-to-act.
  // NOTE (diacritics): JS `\b` does NOT treat ę/ł/ó/ą/ś/ż/ź/ć/ń as word chars,
  // so a trailing `\b` right after a Polish-diacritic stem (e.g. "mogę") never
  // matches. We therefore omit the trailing `\b` after such stems.
  /\bmog[ęe]/i, //  "mogę dodać", "mogę zapisać"
  /\bchcesz,?\s+(żeby|abym|bym|żebym)/i, //  "chcesz, żebym dodał"
  /\bczy\s+(chcesz|mam|chciałby[śs])/i, //  "czy chcesz, żebym…", "czy mam dodać"
  /\bmam\s+(to\s+)?(dodać|zapisać|utworzyć|stworzyć|wygenerować|przygotować|umieścić)/i,
  /\bje[śs]li\s+chcesz/i, //  "jeśli chcesz, dodam…"
  /\bdaj\s+zna[ćc]/i, //  "daj znać, a dodam"
  /\bprzygotowa[ćc]\s+dla\s+ciebie/i,
  /\b(dodam|zapisz[ęe]|utworz[ęe]|stworz[ęe]|wygeneruj[ęe]|przygotuj[ęe]|umieszcz[ęe])/i, // future tense PL = offer, not done
  /\bproponuj[ęe]/i,
  // EN — modal / conditional / offer-to-act
  /\bi\s+can\b/i, //  "I can add"
  /\bwould\s+you\s+like\s+me\s+to\b/i,
  /\bshall\s+i\b/i,
  /\bdo\s+you\s+want\s+me\s+to\b/i,
  /\bif\s+you\s+(want|'?d\s+like|wish)\b/i,
  /\bi\s+(could|will|'?ll|can)\s+(add|save|create|put|generate|prepare|place|write)\b/i,
  /\b(let\s+me\s+know|just\s+say)\b/i,
  /\bi\s+(propose|suggest|recommend)\b/i,
];

// ---------------------------------------------------------------------------
// 2. Completed-action verbs (past-tense / done-state) — PL + EN.
//    Diacritic-safe: PL stems are open-ended (no trailing \b after ł/ę/…).
// ---------------------------------------------------------------------------
const COMPLETED_ACTION_VERB =
  /\b(doda[łl]\w*|zapisa[łl]\w*|utworzy[łl]\w*|stworzy[łl]\w*|wygenerowa[łl]\w*|umie[śs]ci[łl]\w*|wstawi[łl]\w*|przygotowa[łl]\w*|zaktualizowa[łl]\w*|wpisa[łl]\w*|dopisa[łl]\w*|opracowa[łl]\w*|gotowe|got[óo]w|zrobione|added|saved|created|generated|inserted|placed|put|wrote|written|updated|prepared|drafted|done)\b/i;

// "got[óo]w" / "gotowe" / "done" are done-state adjectives; only count them
// when paired with a canvas/document target (handled by requiring a TARGET).

// ---------------------------------------------------------------------------
// 3. Canvas / document / deliverable target nouns — PL + EN.
// ---------------------------------------------------------------------------
const CANVAS_TARGET =
  /\b(canvas\w*|kanw\w*|dokument\w*|document\w*|\bdoc\b|raport\w*|report\w*|prezentacj\w*|presentation\w*|deck\b|slajd\w*|slides?\b|tabel\w*|table\b|notatk\w*|note\b|outputs?\b|deliverable\w*|artefakt\w*|artifact\w*|szkic\w*|draft\b|plik\w*|\bfile\b|memo\b|analiz\w*|analysis\b)/i;

// ---------------------------------------------------------------------------
// 4. Explicit "completed claim" phrasings that should match even if the
//    verb/target proximity heuristic is conservative. These are high-confidence
//    done-confirmations. Diacritic-safe.
// ---------------------------------------------------------------------------
const EXPLICIT_DONE_CLAIM: RegExp[] = [
  // PL
  /\bdoda[łl]\w*\s+(to\s+|je\s+|ten\s+|t[ęe]\s+|go\s+)?(do\s+)?(canvas\w*|kanw\w*|dokument\w*|outputs?|tabel\w*|notatk\w*)/i,
  /\bzapisa[łl]\w*\s+(to\s+|ten\s+|t[ęe]\s+|go\s+|jako\s+)?(dokument\w*|raport\w*|plik\w*|notatk\w*|w\s+outputs?|w\s+canvas\w*)/i,
  /\b(utworzy[łl]\w*|stworzy[łl]\w*|wygenerowa[łl]\w*)\s+(dla\s+ciebie\s+)?(ten\s+|nowy\s+|now[ąa]\s+)?(dokument\w*|raport\w*|prezentacj\w*|tabel\w*|deck\b)/i,
  /\b(gotowe|zrobione)\b[^.!?]{0,40}\b(canvas\w*|kanw\w*|dokument\w*|raport\w*|outputs?)/i,
  /\b(canvas\w*|dokument\w*|raport\w*)\b[^.!?]{0,40}\b(gotowe|zapisan\w*|utworzon\w*|dodan\w*)/i,
  // EN
  /\b(i\s+(have\s+|'?ve\s+)?|i\s+)?(added|saved|created|inserted|placed|put|generated|wrote|written)\b[^.!?]{0,40}\b(to\s+(the\s+|your\s+)?)?(canvas|document|doc|report|outputs?|table|note|deck|presentation|file)/i,
  /\b(it'?s|it\s+is|that'?s|the\s+(document|report|canvas|table|deck))\b[^.!?]{0,30}\b(done|ready|saved|added|created)\b/i,
  /\b(done|all\s+set)\b[^.!?]{0,30}\b(canvas|document|report|outputs?|table|deck)/i,
];

/**
 * True when `assistantText` reads like an OFFER / PROPOSAL / QUESTION to act,
 * which is honest (allowed) and must never be flagged as a fabricated claim.
 */
export function looksLikeProposal(assistantText: string): boolean {
  const text = String(assistantText || '');
  if (!text.trim()) return false;
  return PROPOSAL_MARKERS.some((re) => re.test(text));
}

/**
 * Pure, deterministic. True when the assistant message ASSERTS a COMPLETED
 * canvas / document / deliverable action ("dodałem do Canvasa", "I've saved the
 * document", …) — and is NOT phrased as a proposal/offer/question.
 *
 * This is a *content* signal only. It does NOT know whether a handoff actually
 * fired — that is the job of `isHallucinatedCanvasConfirmation`.
 */
export function claimsCompletedCanvasAction(assistantText: string): boolean {
  const text = String(assistantText || '');
  if (!text.trim()) return false;

  // Proposals / offers / questions are honest — exempt them outright.
  if (looksLikeProposal(text)) return false;

  // High-confidence explicit done-claims.
  if (EXPLICIT_DONE_CLAIM.some((re) => re.test(text))) return true;

  // Generic heuristic: a completed-action verb AND a canvas/document target
  // both present in the message. Conservative: requires BOTH signals so plain
  // chat that merely mentions "raport" or "added value" is not flagged.
  return COMPLETED_ACTION_VERB.test(text) && CANVAS_TARGET.test(text);
}

export interface HandoffState {
  /**
   * Whether a real handoff / module-redirect / tool path actually fired for
   * THIS assistant turn (document intent, presentation intent, canvas write,
   * table redirect, deep-thinking dispatch, etc.). When true, a completion
   * claim is legitimate; when false, the claim is unbacked.
   */
  handoffOccurred: boolean;
}

/**
 * The contract predicate (GAP M02 L-03 / M01 L-09 Tryb A).
 *
 * Returns `true` ONLY when the assistant text claims a COMPLETED canvas/
 * document/deliverable action AND no real handoff fired this turn — i.e. the
 * claim is a hallucinated confirmation with no backing action.
 *
 * - claim + handoffOccurred=false → true  (unbacked → violates honesty contract)
 * - claim + handoffOccurred=true  → false (legitimate — a path actually ran)
 * - no claim                      → false (nothing asserted)
 */
export function isHallucinatedCanvasConfirmation(
  assistantText: string,
  { handoffOccurred }: HandoffState
): boolean {
  if (handoffOccurred) return false;
  return claimsCompletedCanvasAction(assistantText);
}
