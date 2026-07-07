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
