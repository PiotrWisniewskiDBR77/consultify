const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
};

function decodePresentationEntities(value: string): string {
  return value.replace(
    /&(?:amp|nbsp|quot|#39|lt|gt);/g,
    (entity) => HTML_ENTITIES[entity] ?? entity
  );
}

function decodeNestedValue(value: unknown): unknown {
  if (typeof value === 'string') return decodePresentationEntities(value);
  if (Array.isArray(value)) return value.map(decodeNestedValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        decodeNestedValue(nested),
      ])
    );
  }
  return value;
}

/**
 * Autosave boundary invariant for both current and legacy presentation decks.
 * The audience-visible first heading is the canonical card title. Entity
 * escaping introduced by older template materializers is decoded throughout
 * the document so quality gates and exporters inspect the same clean model the
 * editor renders.
 */
export function canonicalizePresentationAutosaveDeck(input: unknown): Record<string, unknown> {
  const decoded = decodeNestedValue(input);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return {};

  const deck = decoded as Record<string, unknown>;
  if (!Array.isArray(deck.cards)) return deck;

  return {
    ...deck,
    cards: deck.cards.map((rawCard) => {
      if (!rawCard || typeof rawCard !== 'object' || Array.isArray(rawCard)) return rawCard;
      const card = rawCard as Record<string, unknown>;
      const blocks = Array.isArray(card.blocks) ? card.blocks : [];
      const heading = blocks.find((rawBlock) => {
        if (!rawBlock || typeof rawBlock !== 'object' || Array.isArray(rawBlock)) return false;
        const type = String((rawBlock as Record<string, unknown>).type || '');
        return type === 'heading' || type === 'title';
      }) as Record<string, unknown> | undefined;
      const headingContent = heading?.content as Record<string, unknown> | undefined;
      const headingText = String(headingContent?.text || '').trim();
      if (!headingText) return card;

      const currentTitle = String(card.title || '').trim();
      const currentKeyMessage = String(card.key_message || '').trim();
      return {
        ...card,
        title: headingText,
        ...(currentKeyMessage && currentKeyMessage === currentTitle
          ? { key_message: headingText }
          : {}),
      };
    }),
  };
}
