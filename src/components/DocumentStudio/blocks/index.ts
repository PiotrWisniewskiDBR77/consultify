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
  narrowTableContent,
  narrowKpiContent,
  type NarrowedTableContent,
  type NarrowedKpiContent,
  type NarrowedKpiItem,
} from './docBlockContent';

export {
  HARVARD_CHART_PALETTE,
  PALETTE_CAP,
  MAX_SERIES,
  MAX_PIE_SLICES,
  PRIMARY_COLOR,
  clampPalette,
  colorAt,
} from './docChartPalette';

export { DocChartBlock, type DocChartBlockProps } from './DocChartBlock';
export { DocTableBlock, type DocTableBlockProps } from './DocTableBlock';
export { DocKpiStrip, type DocKpiStripProps } from './DocKpiStrip';
