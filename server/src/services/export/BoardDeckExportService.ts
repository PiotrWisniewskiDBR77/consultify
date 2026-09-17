import { unifiedExportService } from './UnifiedExportService.js';

export type CanvasDeckSection = {
  title: string;
  body: string;
};

export type CanvasBoardDeckInput = {
  title: string;
  organizationName: string;
  sourceId: string;
  lifecycle: string;
  updatedAt: string;
  sections: CanvasDeckSection[];
};

export type PartnerBoardDeckInput = {
  language: 'en' | 'pl';
};

export type PresentationBoardDeckInput = {
  organizationName?: string;
  deck: {
    title?: string;
    organization_id?: string;
    cards?: Array<{
      intent?: string;
      title?: string;
      key_message?: string;
      blocks?: Array<{ type?: string; content?: Record<string, unknown> }>;
      source_refs?: Array<{ artifact_name?: string }>;
    }>;
    meta?: { language?: string | null; confidentiality?: string | null };
    lifecycle?: { updatedAt?: string | null };
  };
};

const NON_CONTENT_KEYS = new Set([
  'id',
  'block_id',
  'card_id',
  'deck_id',
  'type',
  'enabled',
  'visible',
  'count',
  'order',
  'order_index',
  'index',
  'layout',
  'layout_id',
  'layout_type',
  'style',
  'style_overrides',
  'color',
  'background',
  'source_ref',
  'source_refs',
  'is_refreshable',
  'ai_editable',
]);

const NUMERIC_CONTENT_KEYS = new Set([
  'value',
  'actual',
  'target',
  'amount',
  'percentage',
  'score',
]);

function normalizeContentKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** Extract user-authored content while excluding block/runtime metadata. */
export function contentStringsFrom(value: unknown, parentKey = ''): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (typeof value === 'number' && NUMERIC_CONTENT_KEYS.has(normalizeContentKey(parentKey))) {
    return [String(value)];
  }
  if (Array.isArray(value)) return value.flatMap((item) => contentStringsFrom(item, parentKey));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const normalizedKey = normalizeContentKey(key);
    if (
      NON_CONTENT_KEYS.has(normalizedKey) ||
      normalizedKey.endsWith('_id') ||
      normalizedKey.startsWith('is_')
    ) {
      return [];
    }
    return contentStringsFrom(nested, key);
  });
}

function tableFromBlocks(
  blocks: Array<{ type?: string; content?: Record<string, unknown> }>
): { headers: string[]; rows: Array<Array<string | number>> } | null {
  const table = blocks.find((block) => block.type === 'table')?.content;
  if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) return null;
  const headers = table.headers.map((value) => String(value ?? ''));
  const rows = table.rows
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((value) => (typeof value === 'number' ? value : String(value ?? ''))));
  return headers.length > 0 ? { headers, rows } : null;
}

class BoardDeckExportService {
  async exportPresentationDeck(input: PresentationBoardDeckInput): Promise<Buffer> {
    const deck = input.deck;
    const cards = Array.isArray(deck.cards) ? deck.cards : [];
    return unifiedExportService.exportBoardDeckPptx({
      title: deck.title || 'Presentation',
      organizationName: input.organizationName?.trim() || 'Consultify',
      date: (deck.lifecycle?.updatedAt || new Date().toISOString()).slice(0, 10),
      confidentiality: deck.meta?.confidentiality || 'Internal',
      language: deck.meta?.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en',
      author: 'Consultify Deck Builder',
      slides: cards.map((card, index) => {
        const intent = String(card.intent || '').toLowerCase();
        const table = tableFromBlocks(card.blocks || []);
        const role =
          index === 0 || intent.includes('cover')
            ? ('cover' as const)
            : intent.includes('agenda')
              ? ('agenda' as const)
              : intent.includes('section')
                ? ('section' as const)
                : intent.includes('decision') || intent.includes('recommend')
                  ? ('decision' as const)
                  : table
                    ? ('table' as const)
                    : ('content-one' as const);
        const blockText = (card.blocks || []).flatMap((block) => contentStringsFrom(block.content));
        const body = blockText.join('\n');
        const renderedTitle = String(card.title || '').trim();
        const nonTableBody = (card.blocks || [])
          .filter((block) => block.type !== 'table')
          .flatMap((block) => contentStringsFrom(block.content))
          .filter((text) => text !== renderedTitle)
          .join('\n');
        const source = (card.source_refs || [])
          .map((ref) => ref.artifact_name)
          .filter((name): name is string => Boolean(name))
          .join(' · ');

        if (role === 'agenda') {
          return {
            role,
            kicker: 'Agenda',
            title: card.title || 'Contents',
            agenda: blockText.slice(0, 8).map((title, itemIndex) => ({
              number: String(itemIndex + 1).padStart(2, '0'),
              title,
            })),
            source,
          };
        }
        if (role === 'decision') {
          return {
            role,
            kicker: 'Decision',
            title: card.title || `Slide ${index + 1}`,
            keyMessage: card.key_message,
            recommendation: body || card.key_message || 'Decision details are pending.',
            source,
          };
        }
        if (role === 'table') {
          return {
            role,
            kicker: 'Deck Builder',
            title: card.title || `Slide ${index + 1}`,
            keyMessage: card.key_message,
            body: nonTableBody || undefined,
            table: table || undefined,
            source,
          };
        }
        return {
          role,
          kicker: role === 'cover' ? 'BOARD DECK' : 'Deck Builder',
          title: card.title || `Slide ${index + 1}`,
          subtitle: role === 'cover' ? card.key_message || body : undefined,
          keyMessage: role === 'cover' ? undefined : card.key_message,
          body: role === 'cover' ? undefined : body,
          source,
        };
      }),
    });
  }

  async exportCanvasDeck(input: CanvasBoardDeckInput): Promise<Buffer> {
    const sections = input.sections.length
      ? input.sections
      : [{ title: input.title, body: 'No slide body available.' }];

    return unifiedExportService.exportBoardDeckPptx({
      title: input.title,
      organizationName: input.organizationName,
      date: input.updatedAt.slice(0, 10),
      confidentiality: input.lifecycle,
      author: 'Business Work Canvas',
      slides: [
        {
          role: 'cover',
          kicker: 'WORK CANVAS',
          title: input.title,
          subtitle: input.organizationName,
        },
        {
          role: 'agenda',
          kicker: 'Agenda',
          title: 'Contents',
          agenda: sections.map((section, index) => ({
            number: String(index + 1).padStart(2, '0'),
            title: section.title,
          })),
        },
        ...sections.map((section) => ({
          role: 'content-one' as const,
          kicker: 'Canvas output',
          title: section.title,
          body: section.body,
          source: `Work Canvas ${input.sourceId}`,
        })),
      ],
    });
  }

  async exportPartnerSalesDeck(input: PartnerBoardDeckInput): Promise<Buffer> {
    const pl = input.language === 'pl';
    const title = pl ? 'Consultify — Deck partnerski' : 'Consultify — Partner Sales Deck';
    const subtitle = pl
      ? 'Bezpieczne obietnice, uporządkowane discovery i decyzje oparte na dowodach'
      : 'Safe claims, structured discovery and evidence-backed decisions';
    const bullets = pl
      ? [
          'Prowadzi uporządkowane discovery i uzgodnienia w programach transformacji.',
          'Łączy fakty, niewiadome, insighty i decyzje w jeden ślad pracy.',
          'Wspiera governance bez obietnic automatyzacji, których nie potwierdzają dowody.',
        ]
      : [
          'Runs structured discovery and alignment in transformation programs.',
          'Connects facts, unknowns, insights and decisions in one work trail.',
          'Supports governance without automation claims that exceed the evidence.',
        ];

    return unifiedExportService.exportBoardDeckPptx({
      title,
      organizationName: 'Partner',
      date: new Date().toISOString().slice(0, 10),
      confidentiality: pl ? 'Materiał partnerski' : 'Partner material',
      language: input.language,
      slides: [
        {
          role: 'cover',
          kicker: pl ? 'MATERIAŁ PARTNERSKI' : 'PARTNER MATERIAL',
          title,
          subtitle,
        },
        {
          role: 'content-one',
          kicker: 'Consultify',
          title: pl ? 'Czym jest Consultify?' : 'What is Consultify?',
          bullets,
        },
      ],
    });
  }
}

export const boardDeckExportService = new BoardDeckExportService();
export type { BoardDeckExportService };
