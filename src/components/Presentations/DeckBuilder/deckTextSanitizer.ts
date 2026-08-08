/**
 * Display-time safeguard for deck card text (thin layer).
 *
 * The PRIMARY fix for leaked internal tokens lives server-side
 * (presentationGeneratorService.polishDeckText) — generated slide content is
 * stored clean. This module exists for decks already persisted in the DB
 * before that fix: their blocks may still carry raw `##` markdown heading
 * markers, `[Fact: <label>]` Narrative Engine provenance tokens, `**bold**`
 * markers and `Data gap:` internal placeholders. Slide blocks render as plain
 * text, so we strip those at render time.
 *
 * Keep transformations conservative and language-neutral — this runs on every
 * block of every rendered card.
 */

import type { CardBlock } from '../wizard/types';

/** Keys whose string values must never be rewritten (assets, ids, colors). */
const SKIP_KEY_PATTERN = /(?:url|uri|path|src|href|color|id|icon|kind|type|trend|position)$/i;

export function sanitizeDeckDisplayText(text: string): string {
  let out = String(text ?? '');
  if (!out) return out;
  // `## Title` markdown heading markers → keep the title text only.
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  // `[Fact: fact_kp_3]` internal citation markers → drop id labels, keep
  // wrapped prose if the bracket carries real text.
  out = out.replace(/\s*\[Fact:\s*([^\]]*)\]/gi, (_match, inner: string) => {
    const trimmed = String(inner || '').trim();
    if (!trimmed || /^[\w.-]+$/.test(trimmed)) return '';
    return ` ${trimmed}`;
  });
  // Bold / inline-code markers read as noise in plain-text blocks.
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  out = out.replace(/`([^`\n]+)`/g, '$1');
  // `Data gap: X requires additional evidence` → drop the internal prefix;
  // the rest of the sentence carries the meaning in either language.
  out = out.replace(/^(\s*)Data gap:\s*/gim, '$1');
  // Provenance lives in notes/metadata and source chips, never in audience copy.
  out = out.replace(/^\s*(?:Source|Sources|Źródło|Źródła)\s*:\s*.*$/gim, '');
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    if (key && SKIP_KEY_PATTERN.test(key)) return value;
    return sanitizeDeckDisplayText(value);
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      output[k] = sanitizeValue(v, k);
    }
    return output;
  }
  return value;
}

/** Returns a copy of the block with all displayable strings sanitized. */
export function sanitizeDeckBlock(block: CardBlock): CardBlock {
  return {
    ...block,
    content: sanitizeValue(block.content) as Record<string, unknown>,
  };
}
