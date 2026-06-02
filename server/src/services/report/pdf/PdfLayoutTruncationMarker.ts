/**
 * PDF Layout Truncation / Review Marker (Sprint S16).
 *
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *   - WP-06 carry / R-S15-1.
 *
 * Closes R-S15-1: PDF parity for the renderer-side honest truncation
 * marker. The PPTX renderer (S15) already attaches an inline review
 * marker to slides whose outline entry triggered a layout-audit flag.
 * Before S16, the PDF export of the same deck rendered no marker, so
 * a reviewer who only saw the PDF artifact had no signal that the
 * audit fired — an honesty gap relative to PPTX reviewers.
 *
 * S16 closes that gap by:
 *   1. Persisting `auditFlags` from `UnifiedSlide` onto
 *      `DeckDocumentCard.audit_flags` during the unified→card
 *      conversion (in `presentationDeckDocumentService`), so the
 *      PDF route can read the flags from the card without re-running
 *      the audit.
 *   2. Rendering an equivalent marker in the PDF export route via
 *      this module — same color tiering, same `⚠ <count>` label, same
 *      drift-guarded recognized-flag set.
 *
 * The decision logic is shared with the PPTX marker via
 * `report/audit/layoutAuditFlagPriority.decideLayoutAuditMarker`.
 *
 * Pure helper: returns a description object (not pdfkit calls) so
 * tests can assert against the description without a live `PDFDocument`.
 * The route's `applyPdfLayoutTruncationMarker` consumes that
 * description and issues actual pdfkit calls.
 */

import {
  decideLayoutAuditMarker,
  type LayoutAuditMarkerDecision,
} from '../audit/layoutAuditFlagPriority.js';

// ---------------------------------------------------------------------------
// Color palette — fixed semantic colors, like the PPTX marker. We
// derive hex codes locally (rather than from any theme object) so an
// amber warning still reads as amber on a brand-tinted PDF.
// ---------------------------------------------------------------------------

const PDF_MARKER_COLORS = {
  amberFill: '#D97706', // tailwind amber-600
  amberText: '#FFFBEB', // tailwind amber-50
  roseFill: '#BE123C', // tailwind rose-700
  roseText: '#FFF1F2', // tailwind rose-50
} as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PdfMarkerGeometry {
  /**
   * X coordinate of the marker's left edge, in PDF points, measured
   * from the page's top-left corner. Positive values are right of the
   * left edge.
   */
  x: number;
  /** Y coordinate of the marker's top edge, in PDF points. */
  y: number;
  /** Marker width, in PDF points. */
  w: number;
  /** Marker height, in PDF points. */
  h: number;
  /** Corner radius for the rounded rect, in PDF points. */
  r: number;
}

export interface PdfMarkerInstruction {
  geometry: PdfMarkerGeometry;
  /** Hex color for the rounded rect fill (`#RRGGBB`). */
  fillColor: string;
  /** Hex color for the label text (`#RRGGBB`). */
  textColor: string;
  /** Label string — `⚠ <count>`. */
  label: string;
  /** Font size for the label, in PDF points. */
  fontSize: number;
  /** Underlying audit decision the instruction was derived from. */
  decision: LayoutAuditMarkerDecision;
}

export interface PdfPageDimensions {
  /** Page width in PDF points (e.g. 595 for A4 portrait, 842 for A4 landscape). */
  width: number;
  /** Page height in PDF points. */
  height: number;
  /**
   * Page margin in PDF points. The marker is positioned `margin` away
   * from the right edge horizontally and `margin / 2` from the top
   * vertically, mirroring the PPTX top-right placement.
   */
  margin: number;
}

// ---------------------------------------------------------------------------
// Pure helper
// ---------------------------------------------------------------------------

/**
 * Build the PDF marker instruction for a card, or `null` when the
 * card does not warrant a marker. Pure — returns a description object
 * the route then translates into pdfkit calls.
 */
export function buildPdfLayoutTruncationMarker(
  cardAuditFlags: ReadonlyArray<string> | null | undefined,
  page: PdfPageDimensions
): PdfMarkerInstruction | null {
  const decision = decideLayoutAuditMarker(cardAuditFlags);
  if (!decision.shouldRender) return null;

  const fillColor =
    decision.priority === 'high' ? PDF_MARKER_COLORS.roseFill : PDF_MARKER_COLORS.amberFill;
  const textColor =
    decision.priority === 'high' ? PDF_MARKER_COLORS.roseText : PDF_MARKER_COLORS.amberText;
  const label = `⚠ ${decision.recognizedFlagCount}`;

  // Marker is sized in PDF points. We size it so the badge reads
  // legibly at the standard A4 export zoom (~100%) without crowding a
  // long page title. Width grows mildly when the count is multi-digit.
  const baseWidth = 56;
  const extraPerDigit = 6;
  const digits = String(decision.recognizedFlagCount).length;
  const w = baseWidth + Math.max(0, digits - 1) * extraPerDigit;
  const h = 18;
  const r = 4;

  // Position: top-right corner of the page, inside the margin band.
  // We deliberately sit ABOVE the title text (which the route renders
  // at `doc.fontSize(22).text(...)` immediately after the page-margin
  // bound). With margin=48, the title baseline lands around y=48–80;
  // putting the marker at y = margin / 2 = 24 places it well above
  // the title without overlapping the page-edge.
  const x = page.width - page.margin - w;
  const y = Math.max(8, Math.floor(page.margin / 2));

  return {
    geometry: { x, y, w, h, r },
    fillColor,
    textColor,
    label,
    fontSize: 10,
    decision,
  };
}

// ---------------------------------------------------------------------------
// pdfkit-shaped applier
//
// The route imports this and calls it with a live `PDFDocument`. The
// applier is intentionally typed against a structural subset of the
// pdfkit `PDFDocument` API so tests can pass a mock implementation
// without depending on the real pdfkit binding.
// ---------------------------------------------------------------------------

export interface PdfDocumentLike {
  save(): unknown;
  restore(): unknown;
  roundedRect(x: number, y: number, w: number, h: number, r: number): unknown;
  fillColor(color: string): unknown;
  fill(): unknown;
  fontSize(size: number): unknown;
  text(text: string, x: number, y: number, options?: Record<string, unknown>): unknown;
}

/**
 * Apply a marker instruction to a live (or mocked) pdfkit document.
 * The function `save()`s and `restore()`s graphics state so it can
 * never leak fill colors / fonts back into the route's caller code.
 *
 * If `instruction` is null, the function is a no-op — callers can
 * pass the result of `buildPdfLayoutTruncationMarker` directly.
 */
export function applyPdfLayoutTruncationMarker(
  doc: PdfDocumentLike,
  instruction: PdfMarkerInstruction | null
): void {
  if (!instruction) return;

  doc.save();
  try {
    // Background fill.
    doc.fillColor(instruction.fillColor);
    doc.roundedRect(
      instruction.geometry.x,
      instruction.geometry.y,
      instruction.geometry.w,
      instruction.geometry.h,
      instruction.geometry.r
    );
    doc.fill();

    // Label centered inside the badge. We add a small vertical offset
    // so the icon glyph + numeral sit visually centered for a 10pt
    // font in an 18pt-tall badge.
    doc.fillColor(instruction.textColor);
    doc.fontSize(instruction.fontSize);
    doc.text(instruction.label, instruction.geometry.x, instruction.geometry.y + 4, {
      width: instruction.geometry.w,
      align: 'center',
      lineBreak: false,
    });
  } finally {
    doc.restore();
  }
}

// ---------------------------------------------------------------------------
// Test-only helpers
// ---------------------------------------------------------------------------

export function _markerColorsForTests(): typeof PDF_MARKER_COLORS {
  return PDF_MARKER_COLORS;
}
