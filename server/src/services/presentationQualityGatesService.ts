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

import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type DeckGateSeverity = 'error' | 'warning' | 'info';
export type DeckGateCategory = 'structure' | 'content' | 'brand' | 'traceability' | 'quality';

export interface DeckQualityGateResult {
  id: string;
  gateType: string;
  severity: DeckGateSeverity;
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
  checkedAt: string;
}

interface DeckCard {
  card_id?: string;
  intent?: string;
  title?: string;
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

export async function checkDeckQualityGates(
  organizationId: string,
  deckId: string
): Promise<DeckQualityReport> {
  const gates: DeckQualityGateResult[] = [];

  const deck = (await dbGet(
    `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`,
    [deckId, organizationId]
  )) as any;

  if (!deck) {
    return {
      deckId,
      canExport: false,
      canShare: false,
      gates: [{ id: 'qg-no-deck', gateType: 'DECK_NOT_FOUND', severity: 'error', message: 'Deck not found', category: 'structure' }],
      score: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  let deckData: { cards?: DeckCard[]; theme?: any } = {};
  try {
    deckData = JSON.parse(deck.deck_json || '{}');
  } catch { /* */ }

  const cards: DeckCard[] = deckData.cards || [];
  const presentationMode: string = deck.presentation_mode || 'briefing';

  // Gate 1: Empty deck
  if (cards.length === 0) {
    gates.push({
      id: 'qg-empty-deck',
      gateType: 'EMPTY_DECK',
      severity: 'error',
      message: 'Deck has no cards. Add at least one card to proceed.',
      category: 'structure',
    });
  }

  // Gate 2: Missing cover
  const hasCover = cards.some((c) => c.intent === 'cover');
  if (!hasCover && cards.length > 0) {
    gates.push({
      id: 'qg-no-cover',
      gateType: 'MISSING_COVER',
      severity: 'warning',
      message: 'Deck is missing a cover slide. Consider adding one for a professional look.',
      category: 'structure',
    });
  }

  // Gate 3: Card count bounds
  if (cards.length > 0 && cards.length < 2) {
    gates.push({
      id: 'qg-too-few-cards',
      gateType: 'TOO_FEW_CARDS',
      severity: 'error',
      message: 'Deck needs at least 2 cards (cover + content).',
      category: 'structure',
    });
  }
  if (cards.length > 30) {
    gates.push({
      id: 'qg-too-many-cards',
      gateType: 'TOO_MANY_CARDS',
      severity: 'warning',
      message: `Deck has ${cards.length} cards (recommended max: 30). Consider splitting into two presentations.`,
      category: 'structure',
    });
  } else if (cards.length > 20) {
    gates.push({
      id: 'qg-many-cards',
      gateType: 'MANY_CARDS',
      severity: 'info',
      message: `Deck has ${cards.length} cards. Presentations above 20 cards may lose audience attention.`,
      category: 'structure',
    });
  }

  // Gate 4: Empty content cards
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const hasContent = (card.blocks || []).some((b) => b.content != null);
    if (!hasContent && card.intent !== 'cover') {
      gates.push({
        id: `qg-empty-card-${i}`,
        gateType: 'EMPTY_CARD',
        severity: 'warning',
        message: `Card ${i + 1} "${card.title || card.intent}" has no content blocks.`,
        cardIndex: i,
        category: 'content',
      });
    }
  }

  // Gate 5: Brand consistency
  const brandKit = await dbGet(
    `SELECT id FROM brand_kits WHERE organization_id = ?`,
    [organizationId]
  );
  if (!brandKit && cards.length > 0) {
    gates.push({
      id: 'qg-no-brand-kit',
      gateType: 'NO_BRAND_KIT',
      severity: 'info',
      message: 'No Brand Kit configured. Set up your brand colors, logo, and fonts for professional consistency.',
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
      gates.push({
        id: 'qg-low-traceability',
        gateType: 'LOW_TRACEABILITY',
        severity: 'warning',
        message: `Only ${Math.round(coverage * 100)}% of cards have source references. Traceability improves trust.`,
        category: 'traceability',
      });
    }
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
    gates.push({
      id: 'qg-stale-data',
      gateType: 'STALE_DATA',
      severity: 'warning',
      message: `${staleBlockCount} data block(s) may be outdated (>24h since last refresh).`,
      category: 'quality',
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
      gates.push({
        id: 'qg-low-variety',
        gateType: 'LOW_LAYOUT_VARIETY',
        severity: 'info',
        message: `${consecutive} consecutive cards share the same intent. Consider varying layouts for visual interest.`,
        category: 'quality',
      });
    }
  }

  // Gate 9: Speaker notes coverage
  if (cards.length >= 5 && presentationMode === 'show') {
    const withNotes = cards.filter((c) => c.speaker_notes && c.speaker_notes.trim().length > 10).length;
    if (withNotes < cards.length * 0.5) {
      gates.push({
        id: 'qg-missing-notes',
        gateType: 'MISSING_SPEAKER_NOTES',
        severity: 'info',
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
      gates.push({
        id: `qg-dense-card-${i}`,
        gateType: 'CARD_TOO_DENSE',
        severity: 'warning',
        message: `Card ${i + 1} "${card.title || card.intent}" has ~${wc} words. ${presentationMode.toUpperCase()} mode recommends max ${wordLimits.max} per card.`,
        cardIndex: i,
        category: 'content',
      });
    }
  }

  // Score
  const errors = gates.filter((g) => g.severity === 'error').length;
  const warnings = gates.filter((g) => g.severity === 'warning').length;
  const score = Math.max(0, 100 - errors * 20 - warnings * 5);

  const canExport = errors === 0;
  const canShare = errors === 0 && warnings <= 2;

  logger.info('[DeckQualityGates] Check complete', {
    deckId,
    gates: gates.length,
    errors,
    warnings,
    score,
  });

  return {
    deckId,
    canExport,
    canShare,
    gates,
    score,
    checkedAt: new Date().toISOString(),
  };
}
