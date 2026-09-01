import {
  type LayoutCapacityDensityKey,
  resolveSlotCapacity,
} from '../../presentationStudioLayoutCapacityRegistryService.js';

export type DeckOverflowReason = 'tytul' | 'tresc' | 'kafel' | 'liczba' | 'lista';

export interface DeckOverflowWarning {
  slideIndex: number;
  slideTitle: string;
  powod: DeckOverflowReason;
  zmierzone: number;
  budzet: number;
  pewnosc: 'wysoka' | 'niska';
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

// FIX-230 F1: keys that never carry audience-visible copy, even when the
// value happens to be a string or number. This is the SAME suffix rule
// `deckTextSanitizer.ts` (SKIP_KEY_PATTERN) already uses to decide which
// CardBlock keys must never be rewritten as display prose — that file is
// the product's own existing boundary between "content" and "metadata"
// for a block, so reusing it here keeps the two readings of "visible
// text" from drifting apart instead of inventing a second, competing
// definition.
const METADATA_KEY_PATTERN = /(?:url|uri|path|src|href|color|id|icon|kind|type|trend|position)$/i;

// FIX-230 F1 — ROOT CAUSE of ODBIOR_230's 5/5 false alarms: the previous
// `textLength` ran `Object.values()` over the WHOLE block object, so
// `block_id` ("block-<deck-uuid>-4-1", ~48 chars) and `card_id`
// ("card-<deck-uuid>-4", ~45 chars) — pure bookkeeping written by
// `deckData.ts` pushBlock on every block — were summed as if they were
// slide copy. Two blocks of envelope alone were ~200 chars of noise
// against a 240-char budget. Only `block.content` may hold text a viewer
// will ever see; block_id/card_id/type/position/geometry/style_overrides/
// group_id/source_ref/is_refreshable/ai_editable are never counted.
function textLengthOfContent(value: unknown, key?: string): number {
  if (key && METADATA_KEY_PATTERN.test(key)) return 0;
  if (typeof value === 'string') return value.trim().length;
  if (typeof value === 'number') return String(value).length;
  if (Array.isArray(value)) {
    return value.reduce((sum: number, item) => sum + textLengthOfContent(item), 0);
  }
  if (!value || typeof value !== 'object') return 0;
  return Object.entries(value as UnknownRecord).reduce(
    (sum, [k, v]) => sum + textLengthOfContent(v, k),
    0
  );
}

function textLengthOfBlock(rawBlock: unknown): number {
  if (typeof rawBlock === 'string') return rawBlock.trim().length;
  if (typeof rawBlock === 'number') return String(rawBlock).length;
  const block = asRecord(rawBlock);
  if ('content' in block) {
    // Real persisted CardBlock (deckData.ts pushBlock shape): count ONLY
    // the content payload, never the envelope around it.
    return textLengthOfContent(block.content);
  }
  // Fallback shape (e.g. an outline's suggestedBlocks summaries that are
  // plain objects with no `content` wrapper): still strip metadata-looking
  // keys via the same suffix rule rather than trusting Object.values().
  return textLengthOfContent(block);
}

function textLength(blocks: unknown): number {
  if (!Array.isArray(blocks)) return 0;
  return blocks.reduce((sum: number, rawBlock) => sum + textLengthOfBlock(rawBlock), 0);
}

function densityFor(slide: UnknownRecord): LayoutCapacityDensityKey {
  const explicit = String(slide.density || slide.content_density || '').toLowerCase();
  if (explicit === 'visual' || explicit === 'document') return explicit;
  return 'balanced';
}

function warning(
  slideIndex: number,
  slideTitle: string,
  powod: DeckOverflowReason,
  zmierzone: number,
  budzet: number
): DeckOverflowWarning {
  return {
    slideIndex,
    slideTitle,
    powod,
    zmierzone,
    budzet,
    pewnosc: zmierzone >= budzet * 1.5 ? 'wysoka' : 'niska',
  };
}

/**
 * Conservative pre-export detector. It deliberately reports uncertainty:
 * Consultify has character budgets, not font metrics from the target renderer.
 * At most one warning is emitted per slide, in title/content/list priority.
 *
 * FIX-230 F5 (documented, not changed here): `budget` below comes from
 * `presentationStudioLayoutCapacityRegistryService` — those numbers are
 * AUTHORIAL density targets from the layout-audit contract, not a
 * measured renderer breakage point. ODBIOR_230 measured real pptxgenjs /
 * LibreOffice overflow starting only above ~369 chars, ≥129 chars more
 * forgiving than the 240-char `balanced.keyMessageMaxChars` budget this
 * function alarms on. Do not read a warning here as "this will visibly
 * break in the exported file" — read it as "this is denser than the
 * design target for this slide's density mode."
 */
export function wykryjPrzepelnienie(
  deck: unknown,
  organizationId?: string | null
): DeckOverflowWarning[] {
  const root = asRecord(deck);
  const rawSlides = Array.isArray(root.slides)
    ? root.slides
    : Array.isArray(root.cards)
      ? root.cards
      : [];
  const templateFamily = String(root.templateFamily || root.template_id || '') || null;

  return rawSlides.flatMap((rawSlide, index) => {
    const slide = asRecord(rawSlide);

    // FIX-230 F3: a slide explicitly marked disabled never reaches the
    // exported file — mirrors `presentationStudioLayoutAuditService.ts`'s
    // own `item.enabled === false` skip. Warning about content that will
    // never ship is pure noise.
    if (slide.enabled === false) return [];

    const content = asRecord(slide.content);
    const title = String(slide.title || content.title || content.section_title || '').trim();
    const keyMessage = String(
      slide.key_message || slide.keyMessage || content.headline || content.insight_text || ''
    ).trim();
    const blocks = Array.isArray(slide.blocks)
      ? slide.blocks
      : Array.isArray(slide.suggestedBlocks)
        ? slide.suggestedBlocks
        : [];
    const budget = resolveSlotCapacity(densityFor(slide), templateFamily, organizationId);
    const slideIndex = index + 1;

    if (title.length > budget.titleMaxChars) {
      return [warning(slideIndex, title, 'tytul', title.length, budget.titleMaxChars)];
    }
    // FIX-230 F2: SUM key_message + blocks, never short-circuit. The old
    // `keyMessage.length || textLength(blocks)` meant ANY non-empty
    // key_message (even 1 char) skipped counting blocks entirely — a
    // slide could carry 2000 real chars across 5 full blocks and stay
    // silent as long as key_message wasn't empty (the false negative half
    // of ODBIOR_230, mirroring the false positive half fixed by F1).
    const measuredContent = keyMessage.length + textLength(blocks);
    if (measuredContent > budget.keyMessageMaxChars) {
      return [warning(slideIndex, title, 'tresc', measuredContent, budget.keyMessageMaxChars)];
    }
    if (blocks.length > budget.blocksMax) {
      return [warning(slideIndex, title, 'lista', blocks.length, budget.blocksMax)];
    }
    return [];
  });
}
