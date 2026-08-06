/**
 * Presentation Quality Gates Service
 *
 * Validates deck readiness for export/sharing:
 *  - Gate 1: Empty deck (no cards)
 *  - Gate 2: Missing cover slide
 *  - Gate 3: Card count bounds (min 2, max 30)
 *  - Gate 4: Empty content cards
 *  - Gate 5: Brand consistency (Brand Kit applied)
 *  - Gate 6: Source traceability coverage
 *  - Gate 7: Data freshness (stale refreshable blocks)
 *  - Gate 8: Visual consistency (image density, layout variety)
 *  - Gate 9: Speaker notes coverage
 *  - Gate 10: Text density per presentation mode
 */

import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { contentLeaksTemplateInventory } from './deliverableContentGuard.js';
import { normalizeDeckDocument } from './presentationDeckDocumentService.js';

export type DeckGateSeverity = 'error' | 'warning' | 'info';
export type DeckGateCategory = 'structure' | 'content' | 'brand' | 'traceability' | 'quality';
export type DeckGatePriority = 'P0' | 'P1' | 'P2';

export interface DeckQualityGateResult {
  id: string;
  gateType: string;
  severity: DeckGateSeverity;
  priority: DeckGatePriority;
  message: string;
  cardIndex?: number;
  category: DeckGateCategory;
}

export interface DeckQualityReport {
  deckId: string;
  canExport: boolean;
  canShare: boolean;
  gates: DeckQualityGateResult[];
  score: number;
  result: 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1' | 'INCONCLUSIVE';
  scorecard: {
    p0: number;
    p1: number;
    p2: number;
    passVocabulary: 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1' | 'INCONCLUSIVE';
  };
  checkedAt: string;
}

interface DeckCard {
  card_id?: string;
  intent?: string;
  title?: string;
  key_message?: string;
  blocks?: DeckBlock[];
  source_refs?: any[];
  speaker_notes?: string;
  background?: any;
}

interface DeckBlock {
  block_id?: string;
  type?: string;
  content?: any;
  source_ref?: any;
  is_refreshable?: boolean;
  last_data_refresh?: string;
}

const MODE_WORD_LIMITS: Record<string, { min: number; max: number }> = {
  show: { min: 10, max: 30 },
  briefing: { min: 20, max: 60 },
  document: { min: 40, max: 150 },
  workshop: { min: 5, max: 40 },
};

// Evidence on every slide is covered by the deck-wide traceability gate. This
// narrower set is intentionally reserved for slides that themselves ask for a
// choice/approval; summaries, status, risks and roadmaps are not decisions just
// because they may inform one.
const DECISION_INTENTS = new Set([
  'decision',
  'decision_request',
  'recommendation_portfolio',
  'recommendation_single',
  'prioritization_matrix',
]);

const PLACEHOLDER_TOKENS = [
  'tbd',
  'to be populated',
  'do uzupelnienia',
  'do uzupełnienia',
  'placeholder',
  '[object object]',
];

const ENCODING_ARTEFACTS = ['&amp;', '&nbsp;', 'â€™', 'â€“', '�'];

function estimateWordCount(card: DeckCard): number {
  let count = 0;
  if (card.title) count += card.title.split(/\s+/).length;
  for (const block of card.blocks || []) {
    const content = block.content;
    if (!content) continue;
    if (typeof content === 'string') {
      count += content.split(/\s+/).length;
    } else if (typeof content === 'object') {
      const text = JSON.stringify(content);
      count += Math.floor(text.length / 6);
    }
  }
  return count;
}

function textContainsAny(text: string, needles: string[]): boolean {
  const normalized = String(text || '').toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function inferFreshnessDays(ref: any): number | null {
  if (!ref || typeof ref !== 'object') return null;
  if (typeof ref.freshness_days === 'number') return ref.freshness_days;
  if (typeof ref.freshnessDays === 'number') return ref.freshnessDays;
  const freshness = ref.freshness;
  if (typeof freshness === 'number') return freshness;
  if (freshness && typeof freshness === 'object') {
    if (typeof freshness.days === 'number') return freshness.days;
    if (typeof freshness.age_days === 'number') return freshness.age_days;
  }
  if (typeof ref.captured_at === 'string') {
    const capturedAt = new Date(ref.captured_at).getTime();
    if (!Number.isNaN(capturedAt))
      return Math.floor((Date.now() - capturedAt) / (24 * 60 * 60 * 1000));
  }
  return null;
}

/**
 * Load the org's deliverable-template display names so the validator can detect a deck
 * that pasted the template catalogue verbatim as content (BUG C). Best-effort: on any
 * failure returns [] and the leak gate falls back to structural markers only.
 */
async function loadOrgTemplateNames(organizationId: string): Promise<string[]> {
  try {
    const rows = await dbAll<{ origin_summary_json: string | null; output_type: string }>(
      `SELECT output_type, origin_summary_json FROM v8_output_artifacts
       WHERE organization_id = ? AND artifact_family = 'template'
       ORDER BY last_transition_at DESC LIMIT 40`,
      [organizationId],
      { fallback: true }
    );
    if (!rows || rows.length === 0) return [];
    const names: string[] = [];
    for (const r of rows) {
      let summary: any = null;
      try {
        summary = r.origin_summary_json ? JSON.parse(r.origin_summary_json) : null;
      } catch {
        /* ignore */
      }
      const tpl = summary?.template;
      const title = tpl?.metadata?.resolvedTitle || tpl?.description || r.output_type;
      if (title) names.push(String(title));
    }
    return names;
  } catch {
    return [];
  }
}

/** Decision intents that MUST carry substantive content when present in a deck. */
const REQUIRED_DECISION_CONTENT_INTENTS = new Set([
  'recommendation_portfolio',
  'recommendation_single',
  'risk_management',
  'roadmap',
  'next_steps',
]);

const LAYOUT_EVIDENCE_BLOCKS: Record<string, Set<string>> = {
  executive_summary: new Set(['callout', 'metric_strip', 'smart_layout', 'bullet_list']),
  performance_overview: new Set(['metric_strip', 'kpi_widget', 'chart']),
  comparison: new Set(['smart_layout', 'table', 'chart']),
  roadmap: new Set(['timeline_block', 'smart_diagram']),
  risk_management: new Set(['table', 'chart', 'smart_layout']),
  recommendation_single: new Set(['callout', 'bullet_list', 'smart_layout']),
  recommendation_portfolio: new Set(['callout', 'bullet_list', 'smart_layout']),
  next_steps: new Set(['numbered_list', 'bullet_list', 'timeline_block', 'callout']),
};

function substantiveBlockTypes(card: DeckCard): string[] {
  return (card.blocks || [])
    .map((block) => String(block.type || '').trim())
    .filter((type) => type && type !== 'heading' && type !== 'divider');
}

function cardAggregateText(card: DeckCard): string {
  return [
    String(card.title || ''),
    String(card.key_message || ''),
    ...(card.blocks || []).map((block) => {
      if (typeof block.content === 'string') return block.content;
      if (block.content && typeof block.content.text === 'string') return block.content.text;
      return JSON.stringify(block.content || {});
    }),
  ]
    .filter(Boolean)
    .join(' ');
}

export async function checkDeckQualityGates(
  organizationId: string,
  deckId: string
): Promise<DeckQualityReport> {
  const gates: DeckQualityGateResult[] = [];
  const pushGate = (gate: DeckQualityGateResult) => {
    gates.push(gate);
  };

  const deck = (await dbGet(
    `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
    [deckId, organizationId]
  )) as any;

  if (!deck) {
    return {
      deckId,
      canExport: false,
      canShare: false,
      gates: [
        {
          id: 'qg-no-deck',
          gateType: 'DECK_NOT_FOUND',
          severity: 'error',
          priority: 'P1',
          message: 'Deck not found',
          category: 'structure',
        },
      ],
      score: 0,
      result: 'BLOCKED_P1',
      scorecard: { p0: 0, p1: 1, p2: 0, passVocabulary: 'BLOCKED_P1' },
      checkedAt: new Date().toISOString(),
    };
  }

  const canonicalDeck = normalizeDeckDocument(deck);
  const deckData: { cards?: DeckCard[]; theme?: any; delivery?: any; traceability?: any } =
    canonicalDeck || {};

  const cards: DeckCard[] = deckData.cards || [];
  const presentationMode: string =
    canonicalDeck?.presentation_mode || deck.presentation_mode || 'briefing';

  // Gate 1: Empty deck
  if (cards.length === 0) {
    pushGate({
      id: 'qg-empty-deck',
      gateType: 'EMPTY_DECK',
      severity: 'error',
      priority: 'P1',
      message: 'Deck has no cards. Add at least one card to proceed.',
      category: 'structure',
    });
  }

  // Gate 2: Missing cover
  const hasCover = cards.some((c) => c.intent === 'cover');
  if (!hasCover && cards.length > 0) {
    pushGate({
      id: 'qg-no-cover',
      gateType: 'MISSING_COVER',
      severity: 'warning',
      priority: 'P2',
      message: 'Deck is missing a cover slide. Consider adding one for a professional look.',
      category: 'structure',
    });
  }

  // Gate 3: Card count bounds
  if (cards.length > 0 && cards.length < 2) {
    pushGate({
      id: 'qg-too-few-cards',
      gateType: 'TOO_FEW_CARDS',
      severity: 'error',
      priority: 'P1',
      message: 'Deck needs at least 2 cards (cover + content).',
      category: 'structure',
    });
  }
  if (cards.length > 30) {
    pushGate({
      id: 'qg-too-many-cards',
      gateType: 'TOO_MANY_CARDS',
      severity: 'warning',
      priority: 'P2',
      message: `Deck has ${cards.length} cards (recommended max: 30). Consider splitting into two presentations.`,
      category: 'structure',
    });
  } else if (cards.length > 20) {
    pushGate({
      id: 'qg-many-cards',
      gateType: 'MANY_CARDS',
      severity: 'info',
      priority: 'P2',
      message: `Deck has ${cards.length} cards. Presentations above 20 cards may lose audience attention.`,
      category: 'structure',
    });
  }

  // Gate 4: Empty content cards
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const hasContent = (card.blocks || []).some((b) => b.content != null);
    if (!hasContent && card.intent !== 'cover') {
      pushGate({
        id: `qg-empty-card-${i}`,
        gateType: 'EMPTY_CARD',
        severity: 'warning',
        priority: 'P2',
        message: `Card ${i + 1} "${card.title || card.intent}" has no content blocks.`,
        cardIndex: i,
        category: 'content',
      });
    }
  }

  // Gate 4b: visual information sufficiency. A title plus one thesis sentence
  // is technically non-empty but still produces the blank, unpresentable canvas
  // that this gate exists to stop. Decision layouts must also carry native
  // evidence blocks (KPI/chart/scenarios/timeline/risks/actions) appropriate to
  // their declared intent; the intent label alone is not evidence.
  const sparseCards: number[] = [];
  const layoutEvidenceMissing: number[] = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const intent = String(card.intent || 'content');
    if (intent === 'cover' || intent === 'section_divider') continue;
    const bodyBlocks = substantiveBlockTypes(card);
    const aggregateWords = cardAggregateText(card)
      .replace(String(card.title || ''), '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    if (bodyBlocks.length < 2 || aggregateWords < 8) sparseCards.push(i);

    const expected = LAYOUT_EVIDENCE_BLOCKS[intent];
    if (expected && !bodyBlocks.some((type) => expected.has(type))) {
      layoutEvidenceMissing.push(i);
    }
  }
  if (sparseCards.length > 0) {
    pushGate({
      id: 'qg-low-information-slides',
      gateType: 'LOW_INFORMATION_SLIDES',
      severity: 'error',
      priority: 'P1',
      message: `${sparseCards.length} slide(s) contain only a heading or a single low-information statement. Add audience-ready evidence and visual structure.`,
      cardIndex: sparseCards[0],
      category: 'content',
    });
  }
  if (layoutEvidenceMissing.length > 0) {
    pushGate({
      id: 'qg-layout-evidence-missing',
      gateType: 'LAYOUT_EVIDENCE_MISSING',
      severity: 'error',
      priority: 'P1',
      message: `${layoutEvidenceMissing.length} slide(s) are missing layout-specific evidence blocks (KPI/chart/scenarios/steps/risks/actions).`,
      cardIndex: layoutEvidenceMissing[0],
      category: 'quality',
    });
  }

  // Gate 5: Brand consistency
  const brandKit = await dbGet(`SELECT id FROM brand_kits WHERE organization_id = ?`, [
    organizationId,
  ]);
  const hasBrandLayout = Boolean((deckData as any)?.delivery?.brandLayoutSystem);
  if (!brandKit && !hasBrandLayout && cards.length > 0) {
    pushGate({
      id: 'qg-no-brand-kit',
      gateType: 'NO_BRAND_KIT',
      severity: 'info',
      priority: 'P2',
      message:
        'No Brand Kit configured. Set up your brand colors, logo, and fonts for professional consistency.',
      category: 'brand',
    });
  }

  const missingHeaderFooter = cards
    .slice(1)
    .filter(
      (card: any) => !card.header_footer && canonicalDeck?.meta?.confidentiality !== 'public'
    );
  if (cards.length > 2 && missingHeaderFooter.length > cards.length * 0.5) {
    pushGate({
      id: 'qg-missing-header-footer',
      gateType: 'MISSING_HEADER_FOOTER',
      severity: 'warning',
      priority: 'P2',
      message: 'Most slides are missing exporter-safe header/footer metadata.',
      category: 'brand',
    });
  }

  // Gate 6: Source traceability
  if (cards.length > 0) {
    let tracedCards = 0;
    for (const card of cards) {
      if (card.source_refs && Array.isArray(card.source_refs) && card.source_refs.length > 0) {
        tracedCards++;
      }
    }
    const coverage = tracedCards / cards.length;
    if (coverage < 0.3) {
      pushGate({
        id: 'qg-low-traceability',
        gateType: 'LOW_TRACEABILITY',
        severity: 'error',
        priority: 'P1',
        message: `Only ${Math.round(coverage * 100)}% of cards have source references. Traceability improves trust.`,
        category: 'traceability',
      });
    }
  }

  const rawJsonBlocks = cards.flatMap((card, cardIndex) =>
    (card.blocks || [])
      .filter((block) => {
        const content = block.content || {};
        const text =
          typeof content === 'string'
            ? content
            : typeof content.text === 'string'
              ? content.text
              : '';
        return (
          text.trim().startsWith('{') ||
          text.includes('_narrative_enrichment') ||
          text.includes('_agent_refreshed_at') ||
          JSON.stringify(content).includes('"__')
        );
      })
      .map(() => cardIndex)
  );
  if (rawJsonBlocks.length > 0) {
    pushGate({
      id: 'qg-raw-internals',
      gateType: 'RAW_INTERNALS',
      severity: 'error',
      priority: 'P0',
      message: `Potential raw internals detected on ${rawJsonBlocks.length} block(s). Remove JSON/debug fields before export.`,
      cardIndex: rawJsonBlocks[0],
      category: 'content',
    });
  }

  // Gate 6b: Placeholder / encoding hard gate (P0)
  const placeholderCards: number[] = [];
  const encodingCards: number[] = [];
  const thesisMissingCards: number[] = [];
  cards.forEach((card, index) => {
    const aggregate = [
      String(card.title || ''),
      String(card.key_message || ''),
      ...(card.blocks || []).map((block) => {
        if (typeof block.content === 'string') return block.content;
        if (block.content && typeof block.content.text === 'string') return block.content.text;
        return JSON.stringify(block.content || {});
      }),
    ]
      .filter(Boolean)
      .join(' ');
    if (textContainsAny(aggregate, PLACEHOLDER_TOKENS)) placeholderCards.push(index);
    if (textContainsAny(aggregate, ENCODING_ARTEFACTS)) encodingCards.push(index);
    if (DECISION_INTENTS.has(String(card.intent || ''))) {
      const thesis = String(card.key_message || card.title || '').trim();
      if (thesis.length < 12) thesisMissingCards.push(index);
    }
  });
  if (placeholderCards.length > 0) {
    pushGate({
      id: 'qg-placeholder-content',
      gateType: 'PLACEHOLDER_CONTENT',
      severity: 'error',
      priority: 'P0',
      message: `Placeholder content detected on ${placeholderCards.length} decision-critical slide(s).`,
      cardIndex: placeholderCards[0],
      category: 'content',
    });
  }
  if (encodingCards.length > 0) {
    pushGate({
      id: 'qg-encoding-artifacts',
      gateType: 'ENCODING_ARTEFACTS',
      severity: 'error',
      priority: 'P0',
      message: `Encoding artefacts detected on ${encodingCards.length} slide(s).`,
      cardIndex: encodingCards[0],
      category: 'content',
    });
  }
  if (thesisMissingCards.length > 0) {
    pushGate({
      id: 'qg-missing-thesis',
      gateType: 'MISSING_SLIDE_THESIS',
      severity: 'warning',
      priority: 'P2',
      message: `${thesisMissingCards.length} slide(s) have weak thesis/key message.`,
      cardIndex: thesisMissingCards[0],
      category: 'content',
    });
  }

  // Gate 6c: Template-inventory leak (P0) — BUG C.
  // A slide that contains the template catalogue ("Available templates (20): ...") or
  // multiple template names pasted as content is a hard FAIL, not "clean". This is the
  // exact failure the adversarial judge caught (score 6/100) that QA marked clean.
  const templateNames = await loadOrgTemplateNames(organizationId);
  const leakCards: number[] = [];
  cards.forEach((card, index) => {
    if (contentLeaksTemplateInventory(cardAggregateText(card), templateNames)) {
      leakCards.push(index);
    }
  });
  if (leakCards.length > 0) {
    pushGate({
      id: 'qg-template-inventory-leak',
      gateType: 'TEMPLATE_INVENTORY_LEAK',
      severity: 'error',
      priority: 'P0',
      message: `Template/layout inventory leaked into slide content on ${leakCards.length} slide(s). Template names must never appear as findings/messages.`,
      cardIndex: leakCards[0],
      category: 'content',
    });
  }

  // Gate 6d: Empty decision sections (P1) — BUG C.
  // The judge's deck had recommendations=[], risks=[], roadmap=[] yet passed. If a deck
  // has decision-section slides but their content is empty, that is a FAIL. We also flag a
  // deck that has NO recommendation/next-steps slide at all when it has enough content cards.
  const contentCards = cards.filter((c) => c.intent !== 'cover' && c.intent !== 'section_divider');
  const emptyDecisionCards: number[] = [];
  let hasAnyDecisionSection = false;
  cards.forEach((card, index) => {
    if (!REQUIRED_DECISION_CONTENT_INTENTS.has(String(card.intent || ''))) return;
    hasAnyDecisionSection = true;
    const text = cardAggregateText(card)
      .replace(/[{}[\]"',:]/g, ' ')
      .trim();
    // Strip the title/key_message so we measure BODY substance, not just a heading.
    const body = text
      .replace(String(card.title || ''), '')
      .replace(String(card.key_message || ''), '')
      .trim();
    if (body.length < 15) emptyDecisionCards.push(index);
  });
  if (emptyDecisionCards.length > 0) {
    pushGate({
      id: 'qg-empty-decision-sections',
      gateType: 'EMPTY_DECISION_SECTIONS',
      severity: 'error',
      priority: 'P1',
      message: `${emptyDecisionCards.length} decision slide(s) (recommendations/risks/roadmap/next steps) have empty content.`,
      cardIndex: emptyDecisionCards[0],
      category: 'content',
    });
  }
  if (!hasAnyDecisionSection && contentCards.length >= 4) {
    pushGate({
      id: 'qg-no-decision-sections',
      gateType: 'NO_DECISION_SECTIONS',
      severity: 'warning',
      priority: 'P2',
      message:
        'Deck has no recommendation/next-steps/roadmap slide. A decision deck should end with a call to action.',
      category: 'content',
    });
  }

  // Gate 7: Data freshness
  const now = Date.now();
  const staleThreshold = 24 * 60 * 60 * 1000; // 24h
  let staleBlockCount = 0;
  for (const card of cards) {
    for (const block of card.blocks || []) {
      if (block.is_refreshable && block.last_data_refresh) {
        const refreshTime = new Date(block.last_data_refresh).getTime();
        if (now - refreshTime > staleThreshold) staleBlockCount++;
      }
    }
  }
  if (staleBlockCount > 0) {
    pushGate({
      id: 'qg-stale-data',
      gateType: 'STALE_DATA',
      severity: 'warning',
      priority: 'P2',
      message: `${staleBlockCount} data block(s) may be outdated (>24h since last refresh).`,
      category: 'quality',
    });
  }

  // Gate 7b: Decision-slide evidence discipline (P1)
  let decisionMissingTraceability = 0;
  let decisionLowConfidence = 0;
  let decisionStaleEvidence = 0;
  cards.forEach((card) => {
    if (!DECISION_INTENTS.has(String(card.intent || ''))) return;
    const refs = Array.isArray(card.source_refs) ? card.source_refs : [];
    if (refs.length === 0) {
      decisionMissingTraceability++;
      return;
    }
    const hasLowConfidence = refs.some((ref: any) => {
      const confidence = Number(ref?.confidence);
      return Number.isFinite(confidence) && confidence < 0.6;
    });
    if (hasLowConfidence) decisionLowConfidence++;
    const hasStaleEvidence = refs.some((ref: any) => {
      const freshnessDays = inferFreshnessDays(ref);
      return typeof freshnessDays === 'number' && freshnessDays > 30;
    });
    if (hasStaleEvidence) decisionStaleEvidence++;
  });
  if (decisionMissingTraceability > 0) {
    pushGate({
      id: 'qg-decision-missing-traceability',
      gateType: 'DECISION_MISSING_TRACEABILITY',
      severity: 'error',
      priority: 'P1',
      message: `${decisionMissingTraceability} decision slide(s) are missing source references.`,
      category: 'traceability',
    });
  }
  if (decisionLowConfidence > 0) {
    pushGate({
      id: 'qg-decision-low-confidence',
      gateType: 'DECISION_LOW_CONFIDENCE',
      severity: 'warning',
      priority: 'P2',
      message: `${decisionLowConfidence} decision slide(s) have source confidence below 0.6.`,
      category: 'traceability',
    });
  }
  if (decisionStaleEvidence > 0) {
    pushGate({
      id: 'qg-decision-stale-evidence',
      gateType: 'DECISION_STALE_EVIDENCE',
      severity: 'warning',
      priority: 'P2',
      message: `${decisionStaleEvidence} decision slide(s) rely on stale evidence (>30 days).`,
      category: 'traceability',
    });
  }

  // Gate 8: Visual consistency — check layout variety
  if (cards.length >= 4) {
    const intents = cards.map((c) => c.intent || 'content');
    let consecutive = 0;
    for (let i = 1; i < intents.length; i++) {
      if (intents[i] === intents[i - 1] && intents[i] !== 'content') {
        consecutive++;
      }
    }
    if (consecutive >= 3) {
      pushGate({
        id: 'qg-low-variety',
        gateType: 'LOW_LAYOUT_VARIETY',
        severity: 'info',
        priority: 'P2',
        message: `${consecutive} consecutive cards share the same intent. Consider varying layouts for visual interest.`,
        category: 'quality',
      });
    }
  }

  // Gate 9: Speaker notes coverage
  if (cards.length >= 5 && presentationMode === 'show') {
    const withNotes = cards.filter(
      (c) => c.speaker_notes && c.speaker_notes.trim().length > 10
    ).length;
    if (withNotes < cards.length * 0.5) {
      pushGate({
        id: 'qg-missing-notes',
        gateType: 'MISSING_SPEAKER_NOTES',
        severity: 'info',
        priority: 'P2',
        message: `Only ${withNotes}/${cards.length} cards have speaker notes. SHOW mode benefits from notes for the presenter.`,
        category: 'content',
      });
    }
  }

  // Gate 10: Text density per mode
  const wordLimits = MODE_WORD_LIMITS[presentationMode] || MODE_WORD_LIMITS.briefing;
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card.intent === 'cover' || card.intent === 'section_divider') continue;
    const wc = estimateWordCount(card);
    if (wc > wordLimits.max * 1.5) {
      pushGate({
        id: `qg-dense-card-${i}`,
        gateType: 'CARD_TOO_DENSE',
        severity: 'warning',
        priority: 'P2',
        message: `Card ${i + 1} "${card.title || card.intent}" has ~${wc} words. ${presentationMode.toUpperCase()} mode recommends max ${wordLimits.max} per card.`,
        cardIndex: i,
        category: 'content',
      });
    }
  }

  // Score
  const errors = gates.filter((g) => g.severity === 'error').length;
  const warnings = gates.filter((g) => g.severity === 'warning').length;
  const p0 = gates.filter((g) => g.priority === 'P0').length;
  const p1 = gates.filter((g) => g.priority === 'P1').length;
  const p2 = gates.filter((g) => g.priority === 'P2').length;
  const score = Math.max(0, 100 - errors * 20 - warnings * 5);

  const canExport = errors === 0;
  const canShare = errors === 0 && warnings <= 2;
  const result =
    p0 > 0 || p1 > 0 || errors > 0
      ? 'BLOCKED_P1'
      : warnings > 0
        ? 'PASS_WITH_P2'
        : score >= 95
          ? 'PASS'
          : cards.length === 0
            ? 'INCONCLUSIVE'
            : 'PASS';

  logger.info('[DeckQualityGates] Check complete', {
    deckId,
    gates: gates.length,
    errors,
    warnings,
    score,
    p0,
    p1,
    p2,
  });

  return {
    deckId,
    canExport,
    canShare,
    gates,
    score,
    result,
    scorecard: {
      p0,
      p1,
      p2,
      passVocabulary: result,
    },
    checkedAt: new Date().toISOString(),
  };
}
