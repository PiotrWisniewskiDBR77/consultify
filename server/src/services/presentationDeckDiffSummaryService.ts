/**
 * Presentation Deck Diff Summary Service
 *
 * Builds a summary diff between two deck JSON snapshots, returning both
 * legacy aggregate counters (preserved for backwards compatibility with
 * persisted `diff_json` payloads) and a structured per-slide list used by
 * the AgentPanel UI to render added/removed/modified slides.
 */

export type DeckDiffSlideAction = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DeckDiffSlideEntry {
  index: number;
  action: DeckDiffSlideAction;
  titleBefore: string | null;
  titleAfter: string | null;
  bulletsAdded: string[];
  bulletsRemoved: string[];
  layoutBefore: string | null;
  layoutAfter: string | null;
}

export interface DeckDiffSummary {
  cardsBefore: number;
  cardsAfter: number;
  cardsAdded: number;
  cardsRemoved: number;
  changedCards: number;
  slides: DeckDiffSlideEntry[];
}

function extractSlideTitle(card: unknown): string | null {
  if (!card || typeof card !== 'object') return null;
  const c = card as Record<string, unknown>;
  const candidates = [c.title, c.heading, c.headline, c.name];
  for (const cand of candidates) {
    if (typeof cand === 'string' && cand.trim()) return cand.trim();
  }
  return null;
}

function extractSlideLayout(card: unknown): string | null {
  if (!card || typeof card !== 'object') return null;
  const c = card as Record<string, unknown>;
  const candidates = [c.layout, c.layoutHint, c.template, c.kind];
  for (const cand of candidates) {
    if (typeof cand === 'string' && cand.trim()) return cand.trim();
  }
  return null;
}

function extractSlideBullets(card: unknown): string[] {
  if (!card || typeof card !== 'object') return [];
  const c = card as Record<string, unknown>;
  const direct = Array.isArray(c.bullets) ? (c.bullets as unknown[]) : null;
  if (direct) {
    return direct
      .map((b) => {
        if (typeof b === 'string') return b;
        if (b && typeof b === 'object' && typeof (b as Record<string, unknown>).text === 'string') {
          return (b as Record<string, unknown>).text as string;
        }
        return '';
      })
      .filter((s): s is string => Boolean(s));
  }
  const blocks = Array.isArray(c.blocks) ? (c.blocks as unknown[]) : [];
  const out: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    const items = Array.isArray(b.items) ? (b.items as unknown[]) : null;
    if (items) {
      for (const it of items) {
        if (typeof it === 'string') out.push(it);
        else if (it && typeof it === 'object' && typeof (it as Record<string, unknown>).text === 'string') {
          out.push((it as Record<string, unknown>).text as string);
        }
      }
    }
    if (typeof b.text === 'string') out.push(b.text);
  }
  return out.filter((s): s is string => Boolean(s));
}

export function buildDeckDiffSummary(originalDeck: unknown, proposedDeck: unknown): DeckDiffSummary {
  const beforeCards = Array.isArray((originalDeck as Record<string, unknown> | null)?.cards)
    ? ((originalDeck as Record<string, unknown>).cards as unknown[])
    : [];
  const afterCards = Array.isArray((proposedDeck as Record<string, unknown> | null)?.cards)
    ? ((proposedDeck as Record<string, unknown>).cards as unknown[])
    : [];
  const max = Math.max(beforeCards.length, afterCards.length);
  const slides: DeckDiffSlideEntry[] = [];

  for (let i = 0; i < max; i++) {
    const before = beforeCards[i];
    const after = afterCards[i];
    if (before && !after) {
      slides.push({
        index: i,
        action: 'removed',
        titleBefore: extractSlideTitle(before),
        titleAfter: null,
        bulletsAdded: [],
        bulletsRemoved: extractSlideBullets(before),
        layoutBefore: extractSlideLayout(before),
        layoutAfter: null,
      });
      continue;
    }
    if (!before && after) {
      slides.push({
        index: i,
        action: 'added',
        titleBefore: null,
        titleAfter: extractSlideTitle(after),
        bulletsAdded: extractSlideBullets(after),
        bulletsRemoved: [],
        layoutBefore: null,
        layoutAfter: extractSlideLayout(after),
      });
      continue;
    }
    if (before && after) {
      const beforeBullets = extractSlideBullets(before);
      const afterBullets = extractSlideBullets(after);
      const beforeSet = new Set(beforeBullets);
      const afterSet = new Set(afterBullets);
      const bulletsAdded = afterBullets.filter((b) => !beforeSet.has(b));
      const bulletsRemoved = beforeBullets.filter((b) => !afterSet.has(b));
      const titleBefore = extractSlideTitle(before);
      const titleAfter = extractSlideTitle(after);
      const layoutBefore = extractSlideLayout(before);
      const layoutAfter = extractSlideLayout(after);
      const changed =
        titleBefore !== titleAfter ||
        layoutBefore !== layoutAfter ||
        bulletsAdded.length > 0 ||
        bulletsRemoved.length > 0 ||
        JSON.stringify(before) !== JSON.stringify(after);
      slides.push({
        index: i,
        action: changed ? 'modified' : 'unchanged',
        titleBefore,
        titleAfter,
        bulletsAdded,
        bulletsRemoved,
        layoutBefore,
        layoutAfter,
      });
    }
  }

  return {
    cardsBefore: beforeCards.length,
    cardsAfter: afterCards.length,
    cardsAdded: Math.max(0, afterCards.length - beforeCards.length),
    cardsRemoved: Math.max(0, beforeCards.length - afterCards.length),
    changedCards: slides.filter((s) => s.action === 'modified').length,
    slides,
  };
}
