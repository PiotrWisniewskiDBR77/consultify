/**
 * MVP audit 05/06.09.2026 (evidence/audyt-mvp-20260906/B2/RAPORT_B2.md,
 * BLOKER #1+#2): a brand-new presentation created via "+ Nowa prezentacja"
 * → "Czysto" showed an English placeholder "Heading" as its first slide
 * title, and every other block type inserted manually from the toolbar
 * (paragraph/list/table/chart/KPI/callout/timeline/image) carried a
 * hardcoded English default ("Enter text here...", "Item 1", "Chart",
 * "Metric", "Important note", "Start/Mid/End"...) with zero i18n.
 *
 * `getDefaultContent()` in DeckBuilder.tsx is the single factory behind
 * every one of those defaults. This test drives it with the REAL i18next
 * instance (not an identity stub) set to 'pl', for every block type the
 * toolbar can insert, and asserts none of the known English literals from
 * the audit survive.
 *
 * Mutation check: reverting the `heading` case back to
 * `{ text: 'New Heading', level: 2 }` (or any other case back to its old
 * English literal) makes this test fail.
 */
import { describe, expect, it } from 'vitest';

import i18n from '../../../src/i18n';
import { getDefaultContent } from '../../../src/components/Presentations/DeckBuilder/DeckBuilder';

const BLOCK_TYPES = [
  'heading',
  'paragraph',
  'bullet_list',
  'numbered_list',
  'table',
  'chart',
  'kpi_widget',
  'metric_strip',
  'callout',
  'smart_layout',
  'smart_diagram',
  'timeline_block',
  'divider',
  'image',
];

// The exact English literals the audit report caught, verbatim.
const BANNED_ENGLISH_LITERALS = [
  'New Heading',
  'Enter text here...',
  'Item 1',
  'Item 2',
  'Item 3',
  'Step 1',
  'Step 2',
  'Step 3',
  'Chart',
  'Metric',
  'Important note',
  'Start',
  'Mid',
  'End',
  'Image',
  'Heading',
];

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
  return out;
}

describe('DeckBuilder getDefaultContent — locale pl carries no English placeholder', () => {
  it('resolves i18n to pl for this test run', async () => {
    if (!i18n.isInitialized) {
      await i18n.init();
    }
    await i18n.changeLanguage('pl');
    expect(i18n.language).toBe('pl');
  });

  it.each(BLOCK_TYPES)('block type "%s" contains no banned English literal', async (blockType) => {
    if (i18n.language !== 'pl') {
      await i18n.changeLanguage('pl');
    }
    const content = getDefaultContent(blockType, i18n.t.bind(i18n) as (key: string, def?: string) => string);
    const strings = collectStrings(content);
    for (const banned of BANNED_ENGLISH_LITERALS) {
      expect(strings, `block "${blockType}" content: ${JSON.stringify(content)}`).not.toContain(banned);
    }
  });

  it('heading block default text is the Polish "Nagłówek", not the English fallback', async () => {
    await i18n.changeLanguage('pl');
    const content = getDefaultContent('heading', i18n.t.bind(i18n) as (key: string, def?: string) => string);
    expect(content.text).toBe('Nagłówek');
  });
});
