/**
 * Consultify Document Studio — Teresa intent auto-detect (Epic E3, Slice 4.3).
 *
 * The user's spoken contract: "Teresa is our only chat agent. Other agents
 * are not needed in this module." This module implements the heuristic
 * classifier that turns a free-form Teresa chat message (plus the user's
 * current cursor anchor) into a structured editor scope plan that the
 * service layer can dispatch to one of the five `createXxxEditProposal`
 * functions.
 *
 * Design constraints:
 *   - PURE function. No LLM calls. No I/O. No tenancy lookups. Deterministic
 *     and cheap so the UI can render the resolved scope as the user types.
 *   - PL + EN heuristics. Each scope has a curated set of trigger phrases
 *     normalized via NFD-stripped lowercase comparison.
 *   - PRECEDENCE matters: explicit document-wide phrases (`globalnie`,
 *     `across the document`) MUST beat cursor-derived defaults so the user
 *     can ask for a global rewrite even when their cursor is on a single
 *     block. Methodology + source phrases beat global phrases because they
 *     are MORE specific intents.
 *   - SAFE FALLBACK: when nothing matches, prefer the LEAST aggressive
 *     scope consistent with the cursor: block → local, section → section,
 *     nothing → global is too risky → return null and let the UI ask.
 *
 * Output contract: a `TeresaEditorIntent` carrying a scope and the
 * resolved targets, OR null when the heuristic cannot place the request
 * with reasonable confidence (UI must clarify).
 */

import type { DocumentEditorScope, DocumentSchema } from './documentStudioTypes.js';

export interface TeresaIntentInput {
  /** Free-form chat message from the user. */
  message: string;
  /** Document schema; used to validate cursor anchors. */
  schema: DocumentSchema;
  /** Cursor anchor: which section / block the user is currently editing. */
  cursor?: {
    sectionId?: string;
    blockId?: string;
  };
}

export interface TeresaEditorIntent {
  scope: DocumentEditorScope;
  /** Filled when scope is `local` or `section`. */
  sectionId?: string;
  /** Filled when scope is `local`. */
  blockId?: string;
  /**
   * Confidence label for telemetry / UI affordance. `auto` = picked from
   * cursor + phrase match; `phrase` = picked from explicit phrase even
   * without cursor; `cursor` = picked purely from cursor.
   */
  reason: 'phrase' | 'cursor' | 'cursor+phrase';
  /** The matched phrase (or "<cursor anchor>" / null) for transparency. */
  matchedPhrase?: string;
}

// -----------------------------------------------------------------------------
// Phrase lexicons (curated; PL+EN). Order does not matter because we score
// every match and pick the most-specific scope. Lowercased + diacritic-free
// comparisons run against the same-normalized message.
// -----------------------------------------------------------------------------

const SOURCE_PHRASES: ReadonlyArray<string> = [
  'source',
  'sources',
  'cite',
  'citation',
  'citations',
  'reference',
  'references',
  'footnote',
  'footnotes',
  'attribution',
  'evidence',
  'cytat',
  'cytaty',
  'cytowanie',
  'zrodlo',
  'zrodla',
  'przypis',
  'przypisy',
  'referencja',
  'referencje',
  'odnosnik',
  'odnosniki',
  'powolaj sie',
  'powolaj',
  'oprzyj na zrodle',
];

const METHODOLOGY_PHRASES: ReadonlyArray<string> = [
  'methodology',
  'method',
  'methods',
  'approach',
  'scope of work',
  'sow',
  'assumption',
  'assumptions',
  'scenario',
  'scenarios',
  'sensitivity',
  'risk',
  'risks',
  'metodologia',
  'metoda',
  'metody',
  'podejscie',
  'zakres',
  'zalozenie',
  'zalozenia',
  'scenariusz',
  'scenariusze',
  'wrazliwosc',
  'analiza wrazliwosci',
  'ryzyko',
  'ryzyka',
];

const GLOBAL_PHRASES: ReadonlyArray<string> = [
  'globalnie',
  'globally',
  'wszedzie',
  'caly dokument',
  'cala dokumentacja',
  'cala prezentacja',
  'across the document',
  'across the doc',
  'across the deliverable',
  'whole document',
  'entire document',
  'entire doc',
  'all sections',
  'wszystkie sekcje',
  'we wszystkich sekcjach',
  'spojnie w calym',
  'consistent across',
  'consistently across',
];

const SECTION_PHRASES: ReadonlyArray<string> = [
  'this section',
  'whole section',
  'entire section',
  'across this section',
  'ta sekcja',
  'tej sekcji',
  'cala sekcja',
  'cala ta sekcja',
  'ten rozdzial',
  'tego rozdzialu',
  'caly rozdzial',
];

const LOCAL_PHRASES: ReadonlyArray<string> = [
  'this paragraph',
  'this sentence',
  'this block',
  'this bullet',
  'just this',
  'rewrite this',
  'tylko to',
  'ten akapit',
  'ten paragraf',
  'to zdanie',
  'ta linia',
  'ten punkt',
  'tylko ten',
  'tylko ta',
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Polish "ł" does not decompose under NFD; map it explicitly so
    // phrases like "cały dokument" / "całość" survive normalization.
    .replace(/ł/g, 'l')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAnyPhrase(
  message: string,
  phrases: ReadonlyArray<string>
): { hit: true; phrase: string } | { hit: false } {
  if (!message) return { hit: false };
  for (const phrase of phrases) {
    if (message.includes(phrase)) {
      return { hit: true, phrase };
    }
  }
  return { hit: false };
}

function findCursorBlock(
  schema: DocumentSchema,
  sectionId: string | undefined,
  blockId: string | undefined
): {
  section?: DocumentSchema['sections'][number];
  block?: DocumentSchema['sections'][number]['blocks'][number];
} {
  if (!sectionId) return {};
  const section = schema.sections.find((s) => s.sectionId === sectionId);
  if (!section) return {};
  if (!blockId) return { section };
  const block = section.blocks.find((b) => b.blockId === blockId);
  return { section, block };
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

/**
 * Resolve a Teresa chat message + cursor anchor into a structured editor
 * scope. Returns null when the heuristic cannot place the request safely
 * (caller / UI MUST then ask the user to disambiguate).
 *
 * Precedence (highest to lowest specificity):
 *   1. SOURCE phrases       → scope = 'source'
 *   2. METHODOLOGY phrases  → scope = 'methodology'
 *   3. GLOBAL phrases       → scope = 'global'
 *   4. LOCAL phrases + cursor block → scope = 'local'
 *   5. SECTION phrases + cursor section → scope = 'section'
 *   6. Cursor block only    → scope = 'local'
 *   7. Cursor section only  → scope = 'section'
 *   8. Nothing actionable   → null (UI clarifies)
 */
export function detectTeresaEditorIntent(
  input: TeresaIntentInput
): TeresaEditorIntent | null {
  const message = normalize(input.message ?? '');
  const cursor = input.cursor ?? {};
  const { section: cursorSection, block: cursorBlock } = findCursorBlock(
    input.schema,
    cursor.sectionId,
    cursor.blockId
  );

  if (!message) {
    // Empty message — fall back to cursor.
    if (cursorBlock && cursorSection) {
      return {
        scope: 'local',
        sectionId: cursorSection.sectionId,
        blockId: cursorBlock.blockId,
        reason: 'cursor',
      };
    }
    if (cursorSection) {
      return { scope: 'section', sectionId: cursorSection.sectionId, reason: 'cursor' };
    }
    return null;
  }

  // 1. Source-anchored intent (most specific).
  const sourceMatch = matchesAnyPhrase(message, SOURCE_PHRASES);
  if (sourceMatch.hit) {
    return { scope: 'source', reason: 'phrase', matchedPhrase: sourceMatch.phrase };
  }

  // 2. Methodology intent.
  const methodologyMatch = matchesAnyPhrase(message, METHODOLOGY_PHRASES);
  if (methodologyMatch.hit) {
    return {
      scope: 'methodology',
      reason: 'phrase',
      matchedPhrase: methodologyMatch.phrase,
    };
  }

  // 3. Explicit global intent.
  const globalMatch = matchesAnyPhrase(message, GLOBAL_PHRASES);
  if (globalMatch.hit) {
    return { scope: 'global', reason: 'phrase', matchedPhrase: globalMatch.phrase };
  }

  // 4. Explicit local intent + cursor block → local on that block.
  const localMatch = matchesAnyPhrase(message, LOCAL_PHRASES);
  if (localMatch.hit && cursorBlock && cursorSection) {
    return {
      scope: 'local',
      sectionId: cursorSection.sectionId,
      blockId: cursorBlock.blockId,
      reason: 'cursor+phrase',
      matchedPhrase: localMatch.phrase,
    };
  }

  // 5. Explicit section intent + cursor section → section.
  const sectionMatch = matchesAnyPhrase(message, SECTION_PHRASES);
  if (sectionMatch.hit && cursorSection) {
    return {
      scope: 'section',
      sectionId: cursorSection.sectionId,
      reason: 'cursor+phrase',
      matchedPhrase: sectionMatch.phrase,
    };
  }

  // 6/7. Pure cursor fallback. Require a non-trivial message so we don't
  // treat one-word noise as a request.
  const tokenCount = message.split(' ').filter((t) => t.length > 0).length;
  if (tokenCount >= 2) {
    if (cursorBlock && cursorSection) {
      return {
        scope: 'local',
        sectionId: cursorSection.sectionId,
        blockId: cursorBlock.blockId,
        reason: 'cursor',
      };
    }
    if (cursorSection) {
      return { scope: 'section', sectionId: cursorSection.sectionId, reason: 'cursor' };
    }
  }

  // 8. Cannot place safely. UI must clarify.
  return null;
}

// Re-export the phrase lexicons for tests / future i18n. Read-only.
export const TERESA_INTENT_LEXICONS = Object.freeze({
  source: SOURCE_PHRASES,
  methodology: METHODOLOGY_PHRASES,
  global: GLOBAL_PHRASES,
  section: SECTION_PHRASES,
  local: LOCAL_PHRASES,
});
