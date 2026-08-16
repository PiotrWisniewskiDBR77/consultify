import { createHash } from 'node:crypto';

import {
  canonicalSourceHash,
  completeExportReceipt,
  type ExportArtifactKind,
  type ExportReceipt,
  failExportReceipt,
  HandoffSpineError,
  recordExportReceipt,
} from '../artifactHandoff/handoffSpineService.js';

export type GovernedMaterialKind = Extract<ExportArtifactKind, 'document' | 'workbook'>;

const PROVIDERS: Record<GovernedMaterialKind, Record<string, string>> = {
  document: {
    markdown: 'native:utf8-markdown',
    docx: 'native:docx',
    pdf: 'native:pdfkit',
  },
  workbook: { xlsx: 'native:exceljs' },
};

export function hashExportBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function deriveMaterialExportIdempotencyKey(input: {
  artifactKind: GovernedMaterialKind;
  sourceRecordId: string;
  sourceVersion: number;
  outputFormat: string;
  requestKey?: string | null;
}): string {
  const scope = `${input.artifactKind}:${input.sourceRecordId}:${input.outputFormat}`;
  const requestKey = String(input.requestKey || '').trim();
  return requestKey ? `${scope}:req:${requestKey}` : `${scope}:v${input.sourceVersion}`;
}

export interface BeginMaterialExportInput {
  organizationId: string;
  artifactKind: GovernedMaterialKind;
  sourceRecordId: string;
  sourceVersion: number;
  sourceContent: unknown;
  outputFormat: string;
  createdBy: string;
  requestKey?: string | null;
}

export interface BegunMaterialExport {
  receipt: ExportReceipt;
  replayed: boolean;
  sourceContentHash: string;
  idempotencyKey: string;
}

export async function beginMaterialExport(
  input: BeginMaterialExportInput
): Promise<BegunMaterialExport> {
  const providerKey = PROVIDERS[input.artifactKind][input.outputFormat];
  if (!providerKey) {
    throw new HandoffSpineError('unsupported governed material export format', 'INVALID_ARGUMENT');
  }
  const sourceContentHash = canonicalSourceHash(input.sourceContent);
  const idempotencyKey = deriveMaterialExportIdempotencyKey({
    ...input,
    requestKey: input.requestKey,
  });
  const result = await recordExportReceipt({
    organizationId: input.organizationId,
    artifactKind: input.artifactKind,
    sourceRecordId: input.sourceRecordId,
    sourceVersion: input.sourceVersion,
    sourceContentHash,
    outputFormat: input.outputFormat,
    providerKey,
    providerJobId: `native-job:${idempotencyKey}`,
    createdBy: input.createdBy,
    idempotencyKey,
  });

  const replay = result.receipt;
  if (
    replay.artifactKind !== input.artifactKind ||
    replay.sourceRecordId !== input.sourceRecordId ||
    replay.sourceVersion !== input.sourceVersion ||
    replay.sourceContentHash !== sourceContentHash ||
    replay.outputFormat !== input.outputFormat ||
    replay.providerKey !== providerKey
  ) {
    throw new HandoffSpineError(
      'idempotency key is already bound to a different immutable export source',
      'IDEMPOTENCY_CONFLICT'
    );
  }
  if (replay.status === 'failed' || replay.status === 'unavailable') {
    throw new HandoffSpineError(
      `idempotent export already ended with ${replay.status}`,
      'TERMINAL_EXPORT_REPLAY'
    );
  }
  return { ...result, sourceContentHash, idempotencyKey };
}

export async function completeMaterialExport(input: {
  begun: BegunMaterialExport;
  organizationId: string;
  bytes: Buffer;
}): Promise<ExportReceipt> {
  const outputContentHash = hashExportBytes(input.bytes);
  if (input.begun.receipt.status === 'succeeded') {
    if (
      input.begun.receipt.outputContentHash !== outputContentHash ||
      input.begun.receipt.outputByteSize !== input.bytes.length
    ) {
      throw new HandoffSpineError(
        'idempotent provider output differs from the immutable completed receipt',
        'OUTPUT_HASH_CONFLICT'
      );
    }
    return input.begun.receipt;
  }
  return completeExportReceipt({
    organizationId: input.organizationId,
    exportReceiptId: input.begun.receipt.exportReceiptId,
    outputContentHash,
    outputByteSize: input.bytes.length,
  });
}

export async function failMaterialExport(input: {
  begun: BegunMaterialExport;
  organizationId: string;
  failureCode: string;
}): Promise<ExportReceipt> {
  if (input.begun.receipt.status !== 'pending') return input.begun.receipt;
  return failExportReceipt({
    organizationId: input.organizationId,
    exportReceiptId: input.begun.receipt.exportReceiptId,
    failureCode: input.failureCode,
  });
}

