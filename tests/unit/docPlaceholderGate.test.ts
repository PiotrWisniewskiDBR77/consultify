/**
 * naprawa-r2Narr · Problem 2 — dokument bez placeholderów udających treść.
 *
 * Live bug (sędzia BCG): po ~45 s dokument zawierał same nagłówki + placeholdery,
 * np. sekcja Ryzyka = `*Substantive section "Risks" relevant to the document
 * goal.*` (purpose sekcji z planera narracji, renderowany jako proza) + stopka
 * „Teresa pisze treść…". Async-fill padał po cichu i szkielet zostawał jako
 * „gotowa" treść.
 *
 * Dwie bramki bronią przed tym:
 *  (1) isPlaceholderDocumentProse — wykrywa placeholder planera narracji, więc
 *      bramka anty-placeholder w startDoc rzuca UCZCIWY błąd zamiast wysyłać go
 *      jako finalną treść.
 *  (2) polishMarkdownForCanvas — usuwa notki `_Purpose: …_` (scaffolding) z
 *      widoku użytkownika.
 */
import { describe, it, expect } from 'vitest';
import { isPlaceholderDocumentProse } from '../../server/src/services/documentStudio/documentContentGenerator.js';
import { polishMarkdownForCanvas } from '../../server/src/services/deliverables/docGenerationRuntime.js';

describe('isPlaceholderDocumentProse — anti-placeholder gate', () => {
  it('detects the narrative-planner placeholder (the exact live-bug string)', () => {
    expect(
      isPlaceholderDocumentProse('Substantive section "Risks" relevant to the document goal.')
    ).toBe(true);
  });

  it('detects the generic purpose-hint tail "relevant to the document goal"', () => {
    expect(
      isPlaceholderDocumentProse('Background and operating environment relevant to the document goal.')
    ).toBe(true);
  });

  it('still detects the deterministic-engine stubs (regression guard)', () => {
    expect(isPlaceholderDocumentProse('This section is awaiting content — "X".')).toBe(true);
    expect(isPlaceholderDocumentProse('MVP-1 structured placeholder')).toBe(true);
  });

  it('does NOT flag real, grounded prose', () => {
    expect(
      isPlaceholderDocumentProse(
        'Koszt migracji wyniesie 1,2 mln PLN w roku 1, z ROI 18 miesięcy przy założeniu redukcji 3 etatów.'
      )
    ).toBe(false);
  });
});

describe('polishMarkdownForCanvas — strips scaffolding purpose notes', () => {
  it('removes the _Purpose: …_ note (incl. the Substantive-section placeholder)', () => {
    const raw = [
      '## Risks',
      '',
      '_Purpose: Substantive section "Risks" relevant to the document goal._',
      '',
      'Realna treść ryzyk: ...',
    ].join('\n');
    const out = polishMarkdownForCanvas(raw, 'pl');
    expect(out).not.toContain('_Purpose:');
    expect(out).not.toContain('Substantive section');
    expect(out).toContain('Realna treść ryzyk');
  });
});

describe('gate-vs-polish ORDER (2026-07-08 regression) — real content + a non-hinted section title', () => {
  // documentSchemaRenderer.renderSection appends a `_Purpose: …_` scaffolding
  // note to EVERY section whose title has no documentNarrativePlanner
  // PURPOSE_HINTS entry (most real outlines — "Project Context", "KPIs",
  // "Appendix", ...) — regardless of how good the LLM-written body is. The
  // anti-placeholder gate MUST run on the polished (scaffolding-stripped)
  // markdown, not the raw render, or every real document with such a section
  // title fails with "LLM niedostępny" even though generation succeeded.
  const realDocumentWithUnhintedSectionTitle = [
    '## Executive Summary',
    '',
    'Rekomendujemy wejście na rynek DACH w Q1 przy budżecie 1,2 mln PLN.',
    '',
    '## Project Context',
    '',
    '_Purpose: Substantive section "Project Context" relevant to the document goal._',
    '',
    'DBR77 obsługuje 40 klientów przemysłowych w regionie; konkurencja rośnie o 12% rocznie.',
  ].join('\n');

  it('raw render (pre-polish) DOES look like a placeholder — this is why the gate must not run on it', () => {
    expect(isPlaceholderDocumentProse(realDocumentWithUnhintedSectionTitle)).toBe(true);
  });

  it('polished render (post-polish) correctly passes the gate — real prose is not a placeholder', () => {
    const polished = polishMarkdownForCanvas(realDocumentWithUnhintedSectionTitle, 'pl');
    expect(isPlaceholderDocumentProse(polished)).toBe(false);
    expect(polished).toContain('Rekomendujemy wejście na rynek DACH');
    expect(polished).toContain('DBR77 obsługuje 40 klientów');
  });
});
