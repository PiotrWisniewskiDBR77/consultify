import { externalRagProvider } from './ai/externalRagProvider.js';

function chunkDocumentText(text: string, chunkSize = 1600, overlap = 250): string[] {
  const normalized = String(text || '')
    .replace(/\r/g, '')
    .trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';
  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length <= chunkSize) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
      const tail = buffer.slice(Math.max(0, buffer.length - overlap)).trim();
      buffer = tail ? `${tail}\n\n${paragraph}` : paragraph;
      continue;
    }

    for (let index = 0; index < paragraph.length; index += Math.max(1, chunkSize - overlap)) {
      const slice = paragraph.slice(index, index + chunkSize).trim();
      if (slice) chunks.push(slice);
    }
    buffer = '';
  }

  if (buffer) chunks.push(buffer);
  return chunks;
}

export async function upsertStatementDocumentIntelligence(params: {
  statementId: string;
  ingestRunId?: string | null;
  organizationId: string;
  title?: string | null;
  text: string;
  statementType?: string | null;
  documentClass?: string | null;
  templateFamily?: string | null;
}): Promise<{ docKey: string; chunkCount: number } | null> {
  const text = String(params.text || '').trim();
  if (!text) return null;

  const chunks = chunkDocumentText(text).map((content, chunkIndex) => ({
    chunkIndex,
    content,
    metadata: {
      statementId: params.statementId,
      ingestRunId: params.ingestRunId || null,
      statementType: params.statementType || null,
      documentClass: params.documentClass || null,
      templateFamily: params.templateFamily || null,
      authoritativeForNumbers: false,
      sourceType: 'financial_statement_document_intelligence',
    },
  }));

  const docKey = `statement:${params.statementId}`;
  await externalRagProvider.upsertDocument({
    docKey,
    title: params.title || `Statement ${params.statementId}`,
    organizationId: params.organizationId,
    chunks,
  });

  return {
    docKey,
    chunkCount: chunks.length,
  };
}

export async function searchStatementDocumentIntelligence(params: {
  statementId: string;
  organizationId: string;
  query: string;
  limit?: number;
}): Promise<Array<{ chunkText: string; score: number; metadata?: Record<string, unknown> }>> {
  const matches = await externalRagProvider.search(params.query, {
    organizationId: params.organizationId,
    limit: params.limit ?? 5,
  });

  return matches
    .filter((match) => String(match.docKey || '') === `statement:${params.statementId}`)
    .map((match) => ({
      chunkText: match.chunkText,
      score: match.score,
      metadata: match.metadata,
    }));
}
