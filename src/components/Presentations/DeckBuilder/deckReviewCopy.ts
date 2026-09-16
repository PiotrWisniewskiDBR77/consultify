/**
 * deckReviewCopy — human-readable copy for deck review findings (U-43 / DEC-543).
 *
 * The server (`presentationQualityGatesService`) speaks engineer: gate types,
 * P0/P1/P2 priorities, "exporter-safe header/footer metadata", "cards have
 * source references". A consultant reading the left rail must see a sentence
 * they can act on, so this module is the ONLY place where a gate type becomes
 * a human sentence. UI codes (BLOCKED_P1 / P0 / P1 / P2) never reach the screen.
 *
 * Grouping rule (DEC-543 — a review is a WARNING, never a blocker):
 *   severity 'error'  → "Needs attention"
 *   everything else   → "Suggestions"
 * Priority strings are deliberately NOT used for grouping: they carry the
 * "blocker" vocabulary the owner rejected.
 */

export type DeckReviewSeverity = 'error' | 'warning' | 'info';

export interface DeckReviewFinding {
  id: string;
  gateType: string;
  severity: DeckReviewSeverity;
  message: string;
  cardIndex?: number;
  category?: string;
}

export type DeckReviewGroup = 'attention' | 'suggestion';

export function reviewGroupOf(finding: { severity?: string }): DeckReviewGroup {
  return finding.severity === 'error' ? 'attention' : 'suggestion';
}

/**
 * gateType → i18n key + English sentence. Keys live under
 * `presentations.review.finding.*` in public/locales/{en,pl}.
 * An unknown gate type falls back to the server message (honest: we show what
 * we got rather than inventing a label for a rule we do not know).
 */
const FINDING_COPY: Record<string, string> = {
  DECK_NOT_FOUND: 'This presentation could not be loaded.',
  EMPTY_DECK: 'The presentation has no slides yet — add the first slide.',
  MISSING_COVER: 'There is no cover slide — add a title slide with the client and the date.',
  TOO_FEW_CARDS: 'The presentation is very short — add a cover and at least one content slide.',
  TOO_MANY_CARDS: 'The presentation is very long — consider splitting it into two.',
  MANY_CARDS: 'The presentation is long — audiences lose attention past about 20 slides.',
  EMPTY_CARD: 'This slide has no content yet.',
  LOW_INFORMATION_SLIDES: 'This slide has only a heading — add evidence or a visual.',
  LAYOUT_EVIDENCE_MISSING:
    'This slide promises evidence (a number, chart or list) that is not there yet.',
  NO_BRAND_KIT: 'No brand kit is set — the deck uses default colours and fonts.',
  MISSING_HEADER_FOOTER: 'Most slides have no header or footer, so exports look unbranded.',
  LOW_TRACEABILITY: 'Few slides say where the data came from — add sources so the client can check.',
  RAW_INTERNALS: 'This slide shows raw technical data — remove it before sharing.',
  PLACEHOLDER_CONTENT: 'This slide still contains placeholder text.',
  ENCODING_ARTEFACTS: 'This slide contains broken characters.',
  MISSING_SLIDE_THESIS: 'This slide has no clear key message.',
  TEMPLATE_INVENTORY_LEAK:
    'Template names ended up in the slide content — replace them with real findings.',
  EMPTY_DECISION_SECTIONS: 'A recommendations, risks or roadmap slide has no content.',
  NO_DECISION_SECTIONS:
    'The presentation has no recommendations or next steps — end with a call to action.',
  STALE_DATA: 'Some data on the slides has not been refreshed for over a day.',
  DECISION_MISSING_TRACEABILITY: 'Decision slides do not say where their evidence came from.',
  DECISION_LOW_CONFIDENCE: 'Some decision slides rely on weak sources.',
  DECISION_STALE_EVIDENCE: 'Some decision slides rely on evidence older than 30 days.',
  LOW_LAYOUT_VARIETY: 'Several slides in a row use the same layout — vary them.',
  MISSING_SPEAKER_NOTES: 'Most slides have no speaker notes.',
  CARD_TOO_DENSE: 'This slide carries a lot of text — cut it down for the audience.',
};

export function findingCopyKey(gateType: string): string | null {
  return FINDING_COPY[gateType] ? `presentations.review.finding.${gateType}` : null;
}

export function findingFallback(gateType: string): string | null {
  return FINDING_COPY[gateType] ?? null;
}

/**
 * Resolve the sentence shown for one finding. `translate` is i18next `t`
 * (key, fallback) so PL comes from the catalogue and EN from the fallback.
 */
export function describeFinding(
  finding: DeckReviewFinding,
  translate: (key: string, fallback: string) => string
): string {
  const key = findingCopyKey(finding.gateType);
  const fallback = findingFallback(finding.gateType);
  if (key && fallback) return translate(key, fallback);
  return finding.message;
}

/**
 * "4 of 6 slides ready" — a slide counts as NOT ready when a "Needs attention"
 * finding points at it. Deck-level findings (no slide number) never make a
 * slide unready: they are about the deck, and pretending otherwise would make
 * the number a second, hidden score.
 */
export function countReadySlides(findings: DeckReviewFinding[], totalSlides: number): number {
  if (!Number.isFinite(totalSlides) || totalSlides <= 0) return 0;
  const unready = new Set<number>();
  for (const finding of findings) {
    if (reviewGroupOf(finding) !== 'attention') continue;
    if (typeof finding.cardIndex === 'number' && finding.cardIndex >= 0) {
      unready.add(finding.cardIndex);
    }
  }
  return Math.max(0, totalSlides - unready.size);
}
