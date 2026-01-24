/**
 * Memory Manager (5-layer memory system)
 * JS implementation used by tests and runtime.
 */

import { projectMemoryStore } from './projectMemoryStore.js';
import { organizationMemoryStore } from './organizationMemoryStore.js';
import { embeddingService } from './embeddingService.js';
import { aiLogger } from './logger.js';

export const LAYER_CONFIG = {
  session: { weight: 1.0, enabled: true, ttlMinutes: 120 },
  project: { weight: 0.9, enabled: true },
  organization: { weight: 0.8, enabled: true },
  knowledge: { weight: 0.7, enabled: true },
  external: { weight: 0.6, enabled: false },
};

export class SessionMemoryStore {
  constructor({ ttlMinutes = LAYER_CONFIG.session.ttlMinutes } = {}) {
    this.ttlMinutes = ttlMinutes;
    this.sessions = new Map();
  }

  _getExpiry() {
    return Date.now() + this.ttlMinutes * 60 * 1000;
  }

  async addMessage(userId, message) {
    const now = new Date().toISOString();
    const session = this.sessions.get(userId) || {
      messages: [],
      expiresAt: this._getExpiry(),
    };
    const normalized = {
      role: message.role || 'user',
      content: message.content || '',
      timestamp: message.timestamp || now,
    };
    session.messages.push(normalized);
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }
    session.expiresAt = this._getExpiry();
    this.sessions.set(userId, session);
  }

  async getRecentContext(userId, limit = 20) {
    const session = this.sessions.get(userId);
    if (!session) return [];
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(userId);
      return [];
    }
    const recent = session.messages.slice(-limit);
    return recent.map((msg) => ({
      content: msg.content,
      source: 'session',
      relevance: 1.0,
      metadata: {
        role: msg.role,
        timestamp: msg.timestamp,
      },
    }));
  }

  async clearSession(userId) {
    this.sessions.delete(userId);
  }

  cleanup() {
    const now = Date.now();
    for (const [userId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(userId);
      }
    }
  }
}

export class MemoryManager {
  constructor() {
    this.sessionStore = new SessionMemoryStore();
    this.projectStore = projectMemoryStore;
    this.organizationStore = organizationMemoryStore;
    this.embeddingService = embeddingService;
  }

  async retrieve({
    userId,
    organizationId,
    projectId,
    queryText,
    includeExternal = false,
    maxTokens = 1200,
  }) {
    const start = Date.now();
    const results = [];

    try {
      if (userId && LAYER_CONFIG.session.enabled) {
        const chunks = await this.sessionStore.getRecentContext(userId);
        results.push({ layer: 'session', chunks });
      }
    } catch (error) {
      aiLogger?.warn?.('[MemoryManager] Session layer failed', error);
      results.push({ layer: 'session', chunks: [], error: String(error) });
    }

    try {
      if (projectId && LAYER_CONFIG.project.enabled && this.projectStore?.getProjectContext) {
        const context = await this.projectStore.getProjectContext(projectId, queryText);
        const content = context?.context || context?.content || '';
        if (content) {
          results.push({
            layer: 'project',
            chunks: [{ content, relevance: 0.9, source: 'project' }],
          });
        } else {
          results.push({ layer: 'project', chunks: [] });
        }
      } else {
        results.push({ layer: 'project', chunks: [] });
      }
    } catch (error) {
      aiLogger?.warn?.('[MemoryManager] Project layer failed', error);
      results.push({ layer: 'project', chunks: [], error: String(error) });
    }

    try {
      if (
        organizationId &&
        LAYER_CONFIG.organization.enabled &&
        this.organizationStore?.searchPatterns
      ) {
        const patterns = await this.organizationStore.searchPatterns(organizationId, queryText);
        const chunks = (patterns || []).map((p) => ({
          content: p.content || p.pattern || '',
          relevance: p.relevance ?? 0.7,
          source: 'organization',
        }));
        results.push({ layer: 'organization', chunks });
      } else {
        results.push({ layer: 'organization', chunks: [] });
      }
    } catch (error) {
      aiLogger?.warn?.('[MemoryManager] Organization layer failed', error);
      results.push({ layer: 'organization', chunks: [], error: String(error) });
    }

    try {
      if (queryText && LAYER_CONFIG.knowledge.enabled && this.embeddingService?.search) {
        const kb = await this.embeddingService.search(queryText, { limit: 5 });
        const chunks = (kb || []).map((item) => ({
          content: item.content || item.text || '',
          relevance: item.relevance ?? 0.6,
          source: 'knowledge',
        }));
        results.push({ layer: 'knowledge', chunks });
      } else {
        results.push({ layer: 'knowledge', chunks: [] });
      }
    } catch (error) {
      aiLogger?.warn?.('[MemoryManager] Knowledge layer failed', error);
      results.push({ layer: 'knowledge', chunks: [], error: String(error) });
    }

    if (includeExternal) {
      results.push({ layer: 'external', chunks: [] });
    } else {
      results.push({ layer: 'external', chunks: [] });
    }

    const merged = this._mergeAndRank(results, maxTokens);
    const totalTokens = this._estimateTokens(merged);
    const latency = Date.now() - start;

    return {
      query: queryText,
      chunks: merged,
      sources: this._summarizeSources(results),
      totalTokens,
      latency,
    };
  }

  async recordIfSignificant({ userId, organizationId, projectId, type, content, significance }) {
    const threshold = 0.6;
    await this.sessionStore.addMessage(userId, { role: 'user', content });

    if (significance < threshold) {
      return { recorded: false, reason: 'Below significance threshold' };
    }

    if (projectId && this.projectStore?.addMemory) {
      await this.projectStore.addMemory(projectId, {
        type,
        content,
        significance,
        userId,
        organizationId,
      });
    }

    return { recorded: true };
  }

  async recordDecision(projectId, decision) {
    if (this.projectStore?.recordDecision) {
      await this.projectStore.recordDecision(projectId, decision);
    }
  }

  async recordLearning(projectId, learning) {
    if (this.projectStore?.recordLearning) {
      await this.projectStore.recordLearning(projectId, learning);
    }
  }

  serializeForPrompt(result) {
    if (!result || !result.chunks || result.chunks.length === 0) return '';

    const sections = [];
    const layerMap = {
      session: '## Session Memory',
      project: '## Project Context',
      organization: '## Organization Patterns',
      knowledge: '## Knowledge Base',
      external: '## External Research',
    };

    for (const layer of Object.keys(layerMap)) {
      const items = result.chunks.filter((c) => c.layer === layer || c.source === layer);
      if (items.length === 0) continue;
      sections.push(layerMap[layer]);
      sections.push(items.map((c) => `- ${c.content}`).join('\n'));
      sections.push('');
    }

    return sections.join('\n').trim();
  }

  async getStats(organizationId, projectId) {
    return {
      session: { available: true, ttlMinutes: LAYER_CONFIG.session.ttlMinutes },
      project: { available: Boolean(projectId) },
      organization: { available: Boolean(organizationId) },
      knowledge: { available: true },
      external: { available: false },
    };
  }

  _estimateTokens(chunks) {
    if (!chunks || chunks.length === 0) return 0;
    return chunks.reduce((sum, chunk) => {
      if (!chunk || !chunk.content) return sum;
      return sum + Math.ceil(String(chunk.content).length / 4);
    }, 0);
  }

  _mergeAndRank(results, maxTokens) {
    const all = [];
    for (const result of results) {
      const weight = LAYER_CONFIG[result.layer]?.weight ?? 0.5;
      for (const chunk of result.chunks || []) {
        const relevance = chunk.relevance ?? 0.5;
        all.push({
          ...chunk,
          layer: result.layer,
          relevance,
          weightedScore: relevance * weight,
        });
      }
    }

    all.sort((a, b) => b.weightedScore - a.weightedScore);

    const selected = [];
    let tokens = 0;
    for (const chunk of all) {
      const chunkTokens = this._estimateTokens([chunk]);
      if (tokens + chunkTokens > maxTokens) break;
      tokens += chunkTokens;
      selected.push(chunk);
    }
    return selected;
  }

  _summarizeSources(results) {
    const summary = {
      session: { count: 0 },
      project: { count: 0 },
      organization: { count: 0 },
      knowledge: { count: 0 },
      external: { count: 0 },
    };

    for (const result of results) {
      if (!summary[result.layer]) summary[result.layer] = { count: 0 };
      summary[result.layer].count = (result.chunks || []).length;
      if (result.error) summary[result.layer].error = result.error;
    }
    return summary;
  }
}

const memoryManager = new MemoryManager();
export default memoryManager;
