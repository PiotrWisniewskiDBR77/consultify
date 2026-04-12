/**
 * Multimodal Chunker Service
 *
 * Extends the ingestion pipeline to handle:
 * - PDF table extraction (structured data from documents)
 * - Image understanding (diagrams, process flows, layouts)
 * - Chart/graph interpretation
 *
 * Integrates with vision-capable models (GPT-4o, Gemini) for
 * visual content analysis during document ingestion.
 */
import { randomUUID } from 'node:crypto';

import { run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface MultimodalChunk {
  id: string;
  documentId: string;
  chunkType: 'text' | 'table' | 'image' | 'chart' | 'diagram';
  content: string;
  metadata: {
    pageNumber?: number;
    tableHeaders?: string[];
    tableRowCount?: number;
    imageDescription?: string;
    diagramType?: string;
    confidence: number;
  };
  embedding?: number[];
}

export interface ExtractionResult {
  documentId: string;
  chunks: MultimodalChunk[];
  stats: {
    totalChunks: number;
    textChunks: number;
    tableChunks: number;
    imageChunks: number;
    chartChunks: number;
  };
}

const TABLE_PATTERNS = [
  /\|[^|]+\|[^|]+\|/gm,
  /(?:^|\n)\s*[\w\s]+\t[\w\s]+(?:\t[\w\s]+)+/gm,
];

const DIAGRAM_KEYWORDS = [
  'process flow', 'workflow', 'architecture', 'diagram', 'flowchart',
  'schemat', 'proces', 'architektura', 'przepływ',
];

class MultimodalChunkerService {
  private visionClient: any = null;

  setVisionClient(client: any): void {
    this.visionClient = client;
  }

  async processDocument(input: {
    documentId: string;
    textContent: string;
    images?: Array<{ pageNumber: number; base64: string; mimeType: string }>;
    organizationId: string;
  }): Promise<ExtractionResult> {
    const chunks: MultimodalChunk[] = [];

    const textChunks = this.extractTextChunks(input.documentId, input.textContent);
    chunks.push(...textChunks);

    const tableChunks = this.extractTables(input.documentId, input.textContent);
    chunks.push(...tableChunks);

    if (input.images?.length && this.visionClient) {
      for (const image of input.images) {
        try {
          const imageChunks = await this.processImage(input.documentId, image);
          chunks.push(...imageChunks);
        } catch (err: any) {
          logger.warn(`[MultimodalChunker] Image processing failed for page ${image.pageNumber}: ${err?.message}`);
        }
      }
    }

    for (const chunk of chunks) {
      await this.persistChunk(chunk, input.organizationId).catch((err) =>
        logger.debug(`[MultimodalChunker] Chunk persist skipped: ${err?.message}`)
      );
    }

    const stats = {
      totalChunks: chunks.length,
      textChunks: chunks.filter((c) => c.chunkType === 'text').length,
      tableChunks: chunks.filter((c) => c.chunkType === 'table').length,
      imageChunks: chunks.filter((c) => c.chunkType === 'image' || c.chunkType === 'diagram').length,
      chartChunks: chunks.filter((c) => c.chunkType === 'chart').length,
    };

    logger.info(`[MultimodalChunker] Processed document ${input.documentId}: ${JSON.stringify(stats)}`);

    return { documentId: input.documentId, chunks, stats };
  }

  private extractTextChunks(documentId: string, text: string): MultimodalChunk[] {
    const chunks: MultimodalChunk[] = [];
    const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 50);

    let currentChunk = '';
    let chunkStart = 0;
    const MAX_CHUNK_SIZE = 1500;
    const OVERLAP = 200;

    for (const para of paragraphs) {
      if (currentChunk.length + para.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push({
          id: randomUUID(),
          documentId,
          chunkType: 'text',
          content: currentChunk.trim(),
          metadata: { confidence: 1.0 },
        });
        const overlap = currentChunk.slice(-OVERLAP);
        currentChunk = overlap + '\n\n' + para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: randomUUID(),
        documentId,
        chunkType: 'text',
        content: currentChunk.trim(),
        metadata: { confidence: 1.0 },
      });
    }

    return chunks;
  }

  private extractTables(documentId: string, text: string): MultimodalChunk[] {
    const chunks: MultimodalChunk[] = [];

    for (const pattern of TABLE_PATTERNS) {
      const matches = text.match(pattern);
      if (!matches) continue;

      let tableContent = '';
      let headers: string[] = [];

      for (const match of matches) {
        if (!tableContent) {
          const cells = match.split(/[|\t]/).map((c) => c.trim()).filter(Boolean);
          if (cells.length >= 2) {
            headers = cells;
          }
        }
        tableContent += match + '\n';
      }

      if (tableContent.trim() && headers.length > 0) {
        const rowCount = tableContent.split('\n').filter((l) => l.trim()).length;
        chunks.push({
          id: randomUUID(),
          documentId,
          chunkType: 'table',
          content: tableContent.trim(),
          metadata: {
            tableHeaders: headers,
            tableRowCount: rowCount,
            confidence: 0.85,
          },
        });
      }
    }

    return chunks;
  }

  private async processImage(
    documentId: string,
    image: { pageNumber: number; base64: string; mimeType: string }
  ): Promise<MultimodalChunk[]> {
    if (!this.visionClient) return [];

    try {
      const response = await this.visionClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image from a business document. Describe: 1) What type of visual is this (chart, diagram, table, photo)? 2) Key information and data points. 3) Any text content visible. Respond in the same language as any visible text.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      const description = response.choices?.[0]?.message?.content || '';
      if (!description.trim()) return [];

      const isDiagram = DIAGRAM_KEYWORDS.some((kw) => description.toLowerCase().includes(kw));
      const isChart = /\b(chart|graph|wykres|trend|bar|pie|line)\b/i.test(description);

      return [
        {
          id: randomUUID(),
          documentId,
          chunkType: isDiagram ? 'diagram' : isChart ? 'chart' : 'image',
          content: description,
          metadata: {
            pageNumber: image.pageNumber,
            imageDescription: description.slice(0, 200),
            diagramType: isDiagram ? 'process_flow' : undefined,
            confidence: 0.75,
          },
        },
      ];
    } catch (err: any) {
      logger.warn(`[MultimodalChunker] Vision API error: ${err?.message}`);
      return [];
    }
  }

  private async persistChunk(chunk: MultimodalChunk, orgId: string): Promise<void> {
    await dbRun(
      `INSERT INTO knowledge_chunks (id, document_id, organization_id, chunk_type, content, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO NOTHING`,
      [
        chunk.id,
        chunk.documentId,
        orgId,
        chunk.chunkType,
        chunk.content,
        JSON.stringify(chunk.metadata),
      ]
    );
  }
}

export const multimodalChunker = new MultimodalChunkerService();
export default multimodalChunker;
