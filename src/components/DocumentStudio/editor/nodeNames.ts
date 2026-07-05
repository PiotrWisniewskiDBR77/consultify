/**
 * Document Studio editor — shared TipTap node names (R1).
 *
 * Centralized so the converters (`schemaToTipTap` / `tipTapToSchema`), the
 * NodeView extensions, and the inline-AI wiring (R2) all agree on one set of
 * string identifiers without a circular import through the extension modules.
 */

export const DOC_SECTION_NODE_NAME = 'docSection';
export const KPI_STRIP_NODE_NAME = 'docKpiStrip';
export const CHART_NODE_NAME = 'docChart';
export const QUOTE_NODE_NAME = 'docQuote';
export const DOC_IMAGE_NODE_NAME = 'docImage';

/** Every atom NodeView name (those carrying a `payloadJson` attr). */
export const ATOM_PAYLOAD_NODE_NAMES = [
  KPI_STRIP_NODE_NAME,
  CHART_NODE_NAME,
  QUOTE_NODE_NAME,
  DOC_IMAGE_NODE_NAME,
] as const;
