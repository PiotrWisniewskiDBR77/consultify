/**
 * DocIndexer Service
 * Indexes and searches documentation for AI context retrieval
 */

import fs from 'fs';
import path from 'path';

export class DocIndexer {
  constructor() {
    this.indexedDocs = new Map();
    this.projectRoot = process.cwd();
  }

  /**
   * Chunk content into smaller pieces for indexing
   * @param {string} content - Content to chunk
   * @param {number} maxChunkSize - Maximum size of each chunk
   * @returns {string[]} Array of content chunks
   */
  chunkContent(content, maxChunkSize = 1000) {
    const chunks = [];
    const minChunkSize = 50; // Filter out very small chunks

    // Split by paragraphs (double newline)
    const paragraphs = content.split(/\n\n+/);

    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      // If adding this paragraph would exceed max size, save current chunk
      if (currentChunk && currentChunk.length + trimmed.length > maxChunkSize) {
        if (currentChunk.length >= minChunkSize) {
          chunks.push(currentChunk);
        }
        currentChunk = trimmed;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
      }
    }

    // Add the last chunk if it's large enough
    if (currentChunk && currentChunk.length >= minChunkSize) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Index a document
   * @param {Object} docConfig - Document configuration
   * @param {string} docConfig.path - Path to the document
   * @param {string} docConfig.category - Category of the document
   * @param {number} docConfig.priority - Priority of the document
   */
  async indexDocument({ path: docPath, category, priority }) {
    const absolutePath = path.isAbsolute(docPath) ? docPath : path.join(this.projectRoot, docPath);

    if (!fs.existsSync(absolutePath)) {
      console.warn(`[DocIndexer] Document not found: ${absolutePath}`);
      return;
    }

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const chunks = this.chunkContent(content);

      this.indexedDocs.set(docPath, {
        path: docPath,
        category,
        priority,
        content,
        chunks,
        indexedAt: new Date().toISOString(),
      });

      console.log(`[DocIndexer] Indexed: ${docPath} (${chunks.length} chunks)`);
    } catch (error) {
      console.error(`[DocIndexer] Error indexing ${docPath}:`, error);
    }
  }

  /**
   * Search indexed documents
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {string} options.category - Filter by category
   * @param {number} options.limit - Maximum number of results
   * @returns {Array} Search results
   */
  search(query, options = {}) {
    const { category, limit } = options;
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, doc] of this.indexedDocs) {
      // Filter by category if specified
      if (category && doc.category !== category) {
        continue;
      }

      // Calculate relevance score
      const contentLower = doc.content.toLowerCase();
      const occurrences = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;

      if (occurrences > 0) {
        results.push({
          path: doc.path,
          category: doc.category,
          priority: doc.priority,
          score: occurrences,
          chunks: doc.chunks,
        });
      }
    }

    // Sort by score (descending) and priority (descending)
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.priority - a.priority;
    });

    // Apply limit if specified
    if (limit && results.length > limit) {
      return results.slice(0, limit);
    }

    return results;
  }

  /**
   * Get context for a specific topic
   * @param {string} topic - Topic to get context for
   * @returns {string} Relevant context
   */
  getContextForTopic(topic) {
    const results = this.search(topic, { limit: 5 });

    if (results.length === 0) {
      return '';
    }

    // Combine chunks from top results
    const context = results
      .flatMap((r) => r.chunks)
      .slice(0, 10)
      .join('\n\n---\n\n');

    return context;
  }

  /**
   * Get prompt engineering knowledge base
   * @returns {Array} Prompt engineering KB entries
   */
  getPromptEngineeringKB() {
    return PROMPT_ENGINEERING_KB;
  }

  /**
   * Get metadata for all indexed documents
   * @returns {Array} Document metadata
   */
  getIndexedDocuments() {
    const docs = [];

    for (const [, doc] of this.indexedDocs) {
      docs.push({
        path: doc.path,
        category: doc.category,
        priority: doc.priority,
        chunkCount: doc.chunks.length,
        indexedAt: doc.indexedAt,
      });
    }

    return docs;
  }

  /**
   * Get statistics about indexed documents
   * @returns {Object} Statistics
   */
  getStats() {
    let totalChunks = 0;
    let totalCharacters = 0;
    const categoryCounts = {};

    for (const [, doc] of this.indexedDocs) {
      totalChunks += doc.chunks.length;
      totalCharacters += doc.content.length;
      categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
    }

    return {
      documentCount: this.indexedDocs.size,
      totalChunks,
      totalCharacters,
      categoryCounts,
    };
  }
}

/**
 * Prompt Engineering Knowledge Base
 * Best practices and patterns for AI prompting
 */
export const PROMPT_ENGINEERING_KB = [
  {
    category: 'principles',
    title: 'Language Independence',
    content: 'Design prompts that work across multiple languages and cultural contexts.',
  },
  {
    category: 'principles',
    title: 'Clarity and Specificity',
    content: 'Be explicit about what you want. Vague prompts lead to vague responses.',
  },
  {
    category: 'patterns',
    title: 'Chain of Thought',
    content: 'Ask the AI to think step-by-step to improve reasoning quality.',
  },
  {
    category: 'patterns',
    title: 'Few-Shot Learning',
    content: 'Provide examples of the desired input-output pattern.',
  },
  {
    category: 'best-practices',
    title: 'Context Management',
    content: 'Provide relevant context upfront to improve response quality.',
  },
];

// Export default instance
export default new DocIndexer();
