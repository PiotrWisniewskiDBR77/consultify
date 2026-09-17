import { createHash } from 'node:crypto';

import {
  type DocumentPdfRenderOptions,
  renderDocumentSchemaToPdfBuffer,
} from '../../documentStudio/documentPdfRenderer.js';
import type { DocumentSchema } from '../../documentStudio/documentStudioTypes.js';

export const CANONICAL_PDF_ENGINE = 'document-schema-pdf-v1' as const;

export type CanonicalPdfSource = 'assessment_drd' | 'audit_report';

export interface CanonicalPdfExportReceipt {
  engine: typeof CANONICAL_PDF_ENGINE;
  source: CanonicalPdfSource;
  documentId: string;
  artifactId: string;
  templateId: string | null;
  templateVersion: string | null;
  sectionCount: number;
  byteLength: number;
  sha256: string;
}

export interface CanonicalPdfExportResult {
  buffer: Buffer;
  receipt: CanonicalPdfExportReceipt;
}

function requireCanonicalSchema(schema: DocumentSchema): void {
  if (!schema.documentId || !schema.artifactId || !schema.title.trim()) {
    throw new Error('PDF_EXPORT_E_SCHEMA_IDENTITY');
  }
  if (!Array.isArray(schema.sections) || schema.sections.length === 0) {
    throw new Error('PDF_EXPORT_E_SCHEMA_SECTIONS');
  }
}

/**
 * The single PDF boundary for governed report exports. Callers own their
 * domain-to-DocumentSchema adapter; this service owns renderer selection and
 * the verifiable receipt returned with the bytes.
 */
export async function exportCanonicalDocumentPdf(
  schema: DocumentSchema,
  source: CanonicalPdfSource,
  options: DocumentPdfRenderOptions = {}
): Promise<CanonicalPdfExportResult> {
  requireCanonicalSchema(schema);
  const buffer = await renderDocumentSchemaToPdfBuffer(schema, options);
  if (
    buffer.subarray(0, 5).toString('ascii') !== '%PDF-' ||
    !buffer.includes(Buffer.from('%%EOF'))
  ) {
    throw new Error('PDF_EXPORT_E_RENDER');
  }

  return {
    buffer,
    receipt: {
      engine: CANONICAL_PDF_ENGINE,
      source,
      documentId: schema.documentId,
      artifactId: schema.artifactId,
      templateId: schema.templateRef?.templateId ?? null,
      templateVersion: schema.templateRef?.templateVersion ?? null,
      sectionCount: schema.sections.length,
      byteLength: buffer.byteLength,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    },
  };
}
