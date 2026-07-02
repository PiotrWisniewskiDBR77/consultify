/**
 * Document Studio editor (R1) — public surface.
 */

export { DocumentTipTapEditor, type DocumentTipTapEditorProps } from './DocumentTipTapEditor';
export { getDocumentEditorExtensions } from './documentEditorExtensions';
export { schemaToProseMirror, type PMDoc, type PMNode } from './schemaToTipTap';
export { proseMirrorToSchema, pmNodeToBlock } from './tipTapToSchema';
export {
  DOC_SECTION_NODE_NAME,
  KPI_STRIP_NODE_NAME,
  CHART_NODE_NAME,
  QUOTE_NODE_NAME,
  DOC_IMAGE_NODE_NAME,
} from './nodeNames';
