/**
 * Unit tests for the PDF layout-audit marker (Sprint S16).
 * Asserts the pure builder + the pdfkit-shaped applier in isolation,
 * with no live `PDFDocument`.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  _markerColorsForTests,
  applyPdfLayoutTruncationMarker,
  buildPdfLayoutTruncationMarker,
  type PdfDocumentLike,
  type PdfPageDimensions,
} from '../PdfLayoutTruncationMarker.js';

const A4_PORTRAIT: PdfPageDimensions = { width: 595, height: 842, margin: 48 };

function makeMockDoc(): PdfDocumentLike & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    save: vi.fn(() => {
      calls.push('save');
    }),
    restore: vi.fn(() => {
      calls.push('restore');
    }),
    roundedRect: vi.fn((x: number, y: number, w: number, h: number, r: number) => {
      calls.push(`roundedRect(${x},${y},${w},${h},${r})`);
    }),
    fillColor: vi.fn((color: string) => {
      calls.push(`fillColor(${color})`);
    }),
    fill: vi.fn(() => {
      calls.push('fill');
    }),
    fontSize: vi.fn((size: number) => {
      calls.push(`fontSize(${size})`);
    }),
    text: vi.fn((text: string, x: number, y: number) => {
      calls.push(`text(${text},${x},${y})`);
    }),
  };
}

describe('PdfLayoutTruncationMarker — buildPdfLayoutTruncationMarker', () => {
  it('returns null when the card has no audit flags', () => {
    expect(buildPdfLayoutTruncationMarker(undefined, A4_PORTRAIT)).toBeNull();
    expect(buildPdfLayoutTruncationMarker(null, A4_PORTRAIT)).toBeNull();
    expect(buildPdfLayoutTruncationMarker([], A4_PORTRAIT)).toBeNull();
  });

  it('returns null when only unrecognized flags are present', () => {
    expect(buildPdfLayoutTruncationMarker(['totally_made_up'], A4_PORTRAIT)).toBeNull();
  });

  it('returns an amber instruction for advisory-only flags', () => {
    const colors = _markerColorsForTests();
    const instr = buildPdfLayoutTruncationMarker(['layout_overflow_title'], A4_PORTRAIT);
    expect(instr).not.toBeNull();
    expect(instr!.fillColor).toBe(colors.amberFill);
    expect(instr!.textColor).toBe(colors.amberText);
    expect(instr!.label).toBe('⚠ 1');
    expect(instr!.decision.priority).toBe('advisory');
  });

  it('returns a rose instruction when ANY high-priority flag is present', () => {
    const colors = _markerColorsForTests();
    const instr = buildPdfLayoutTruncationMarker(
      ['layout_overflow_title', 'missing_source_for_evidence_intent'],
      A4_PORTRAIT
    );
    expect(instr!.fillColor).toBe(colors.roseFill);
    expect(instr!.textColor).toBe(colors.roseText);
    expect(instr!.label).toBe('⚠ 2');
    expect(instr!.decision.priority).toBe('high');
  });

  it('positions the marker inside the top-right corner of the page', () => {
    const instr = buildPdfLayoutTruncationMarker(['layout_overflow_title'], A4_PORTRAIT);
    expect(instr!.geometry.x).toBeGreaterThan(A4_PORTRAIT.width / 2);
    expect(instr!.geometry.x + instr!.geometry.w).toBeLessThanOrEqual(
      A4_PORTRAIT.width - A4_PORTRAIT.margin
    );
    expect(instr!.geometry.y).toBeGreaterThanOrEqual(8);
    expect(instr!.geometry.y).toBeLessThan(A4_PORTRAIT.margin);
  });

  it('keeps width unchanged for single-digit counts (real-world cap = 6 known flags)', () => {
    const single = buildPdfLayoutTruncationMarker(['layout_overflow_title'], A4_PORTRAIT)!;
    const triple = buildPdfLayoutTruncationMarker(
      ['layout_overflow_title', 'layout_overflow_key_message', 'layout_overflow_blocks'],
      A4_PORTRAIT
    )!;
    // Both 1 and 3 are single-digit, so the same base width is used.
    // The width formula only adds extra points per ADDITIONAL digit.
    expect(triple.geometry.w).toBe(single.geometry.w);
    expect(triple.label).toBe('⚠ 3');
    // Sanity: width should still leave room for the icon + numeral at 10pt font.
    expect(single.geometry.w).toBeGreaterThanOrEqual(40);
  });

  it('uses the page width when computing the right edge — landscape vs portrait', () => {
    const portrait = buildPdfLayoutTruncationMarker(['layout_overflow_title'], A4_PORTRAIT)!;
    const landscape = buildPdfLayoutTruncationMarker(['layout_overflow_title'], {
      width: 842,
      height: 595,
      margin: 48,
    })!;
    expect(landscape.geometry.x).toBeGreaterThan(portrait.geometry.x);
  });
});

describe('PdfLayoutTruncationMarker — applyPdfLayoutTruncationMarker', () => {
  it('is a no-op when instruction is null', () => {
    const doc = makeMockDoc();
    applyPdfLayoutTruncationMarker(doc, null);
    expect(doc.calls).toEqual([]);
  });

  it('emits save/roundedRect/fill/text/restore in order', () => {
    const doc = makeMockDoc();
    const instr = buildPdfLayoutTruncationMarker(['layout_overflow_title'], A4_PORTRAIT)!;
    applyPdfLayoutTruncationMarker(doc, instr);

    expect(doc.calls[0]).toBe('save');
    expect(doc.calls[doc.calls.length - 1]).toBe('restore');

    expect(doc.calls.some((c) => c.startsWith('roundedRect('))).toBe(true);
    expect(doc.calls).toContain('fill');
    expect(doc.calls.some((c) => c.startsWith(`fillColor(${instr.fillColor})`))).toBe(true);
    expect(doc.calls.some((c) => c.startsWith(`fillColor(${instr.textColor})`))).toBe(true);
    expect(doc.calls.some((c) => c.startsWith(`fontSize(${instr.fontSize})`))).toBe(true);
    expect(doc.calls.some((c) => c.startsWith(`text(${instr.label}`))).toBe(true);
  });

  it('still calls restore() when text() throws (graphics state never leaks)', () => {
    const doc = makeMockDoc();
    doc.text = vi.fn(() => {
      throw new Error('boom');
    });
    const instr = buildPdfLayoutTruncationMarker(['layout_overflow_title'], A4_PORTRAIT)!;
    expect(() => applyPdfLayoutTruncationMarker(doc, instr)).toThrow('boom');
    expect(doc.restore).toHaveBeenCalledTimes(1);
  });
});
