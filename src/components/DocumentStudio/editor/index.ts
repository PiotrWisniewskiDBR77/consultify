/**
 * Document Studio editor (R1) — public surface.
 */

export { getDocumentEditorExtensions } from './documentEditorExtensions';
export {
  type DocumentAutosaveStatus,
  DocumentTipTapEditor,
  type DocumentTipTapEditorProps,
} from './DocumentTipTapEditor';
export {
  CHART_NODE_NAME,
  DOC_IMAGE_NODE_NAME,
  DOC_SECTION_NODE_NAME,
  KPI_STRIP_NODE_NAME,
  QUOTE_NODE_NAME,
} from './nodeNames';
export { type PMDoc, type PMNode, schemaToProseMirror } from './schemaToTipTap';
export { pmNodeToBlock, proseMirrorToSchema } from './tipTapToSchema';
