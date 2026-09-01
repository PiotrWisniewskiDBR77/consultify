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

function textLength(value: unknown): number {
  if (typeof value === 'string') return value.trim().length;
  if (typeof value === 'number') return String(value).length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + textLength(item), 0);
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value as UnknownRecord).reduce((sum, item) => sum + textLength(item), 0);
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
 */
export function wykryjPrzepelnienie(deck: unknown): DeckOverflowWarning[] {
  const root = asRecord(deck);
  const rawSlides = Array.isArray(root.slides)
    ? root.slides
    : Array.isArray(root.cards)
      ? root.cards
      : [];
  const templateFamily = String(root.templateFamily || root.template_id || '') || null;

  return rawSlides.flatMap((rawSlide, index) => {
    const slide = asRecord(rawSlide);
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
    const budget = resolveSlotCapacity(densityFor(slide), templateFamily);
    const slideIndex = index + 1;

    if (title.length > budget.titleMaxChars) {
      return [warning(slideIndex, title, 'tytul', title.length, budget.titleMaxChars)];
    }
    const measuredContent = keyMessage.length || textLength(blocks);
    if (measuredContent > budget.keyMessageMaxChars) {
      return [warning(slideIndex, title, 'tresc', measuredContent, budget.keyMessageMaxChars)];
    }
    if (blocks.length > budget.blocksMax) {
      return [warning(slideIndex, title, 'lista', blocks.length, budget.blocksMax)];
    }
    return [];
  });
}
