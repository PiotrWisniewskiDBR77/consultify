/**
 * Document Studio — render blocks (R3) public surface.
 *
 * R1 / Claude wires these into TipTap NodeViews and `renderSectionPreview`.
 * Contract: narrow opaque `node.attrs.content` with the `narrow*` helpers,
 * then render the matching block — e.g.
 *
 *   const c = narrowChartContent(node.attrs.content);
 *   return c ? <DocChartBlock content={c} /> : <pre>{JSON.stringify(...)}</pre>;
 */

export {
  narrowChartContent,
  type NarrowedKpiContent,
  type NarrowedKpiItem,
  type NarrowedTableContent,
  narrowKpiContent,
  narrowTableContent,
} from './docBlockContent';
export { DocChartBlock, type DocChartBlockProps } from './DocChartBlock';
export {
  clampPalette,
  colorAt,
  HARVARD_CHART_PALETTE,
  MAX_PIE_SLICES,
  MAX_SERIES,
  PALETTE_CAP,
  PRIMARY_COLOR,
} from './docChartPalette';
export { DocKpiStrip, type DocKpiStripProps } from './DocKpiStrip';
export { DocTableBlock, type DocTableBlockProps } from './DocTableBlock';
