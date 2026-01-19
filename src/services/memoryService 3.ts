/**
 * Memory Service
 *
 * Manages AI memory for user preferences and organization instructions.
 * Memory persists across conversations and improves AI personalization.
 *
 * Memory Types:
 * - User Memory: Personal preferences, communication style, expertise
 * - Organization Memory: Business context, terminology, procedures
 *
 * @version 1.0.0
 */

import { Api } from './api';

// ============================================================================
// Types
// ============================================================================

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  category: MemoryCategory;
  source: 'explicit' | 'inferred' | 'feedback';
  confidence: number; // 0.0 - 1.0
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export type MemoryCategory =
  | 'preference' // User preferences (language, verbosity, etc.)
  | 'expertise' // User's knowledge areas
  | 'style' // Communication style
  | 'context' // Business context
  | 'terminology' // Organization-specific terms
  | 'procedure' // Standard procedures
  | 'constraint'; // Constraints and rules

export interface UserMemory {
  userId: string;
  entries: MemoryEntry[];
  lastUpdated: Date;
}

export interface OrganizationMemory {
  organizationId: string;
  entries: MemoryEntry[];
  lastUpdated: Date;
}

export interface MemoryUpdatePayload {
  key: string;
  value: string;
  category: MemoryCategory;
  source?: 'explicit' | 'inferred' | 'feedback';
}

export interface MemorySummary {
  totalEntries: number;
  byCategory: Record<MemoryCategory, number>;
  lastUpdated: Date;
}

// ============================================================================
// Memory Service Class
// ============================================================================

class MemoryServiceClass {
  private userMemoryCache: UserMemory | null = null;
  private orgMemoryCache: OrganizationMemory | null = null;
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastFetch: { user: number; org: number } = { user: 0, org: 0 };

  // ========================================================================
  // User Memory
  // ========================================================================

  /**
   * Fetch user memory entries
   */
  async getUserMemory(forceRefresh = false): Promise<UserMemory> {
    const now = Date.now();

    if (!forceRefresh && this.userMemoryCache && now - this.lastFetch.user < this.cacheExpiry) {
      return this.userMemoryCache;
    }

    try {
      const response = await Api.getUserMemory();
      this.userMemoryCache = {
        userId: response.userId,
        entries: response.entries.map(mapApiMemoryEntry),
        lastUpdated: new Date(response.lastUpdated),
      };
      this.lastFetch.user = now;
      return this.userMemoryCache;
    } catch (err: any) {
      console.error('[MemoryService] Failed to fetch user memory:', err);
      // Return cached or empty
      return this.userMemoryCache || { userId: '', entries: [], lastUpdated: new Date() };
    }
  }

  /**
   * Update user memory entry
   */
  async updateUserMemory(payload: MemoryUpdatePayload): Promise<MemoryEntry> {
    try {
      const response = await Api.updateUserMemory({
        key: payload.key,
        value: payload.value,
        category: payload.category,
        source: payload.source || 'explicit',
      });

      const entry = mapApiMemoryEntry(response);

      // Update cache
      if (this.userMemoryCache) {
        const existingIndex = this.userMemoryCache.entries.findIndex((e) => e.key === payload.key);
        if (existingIndex >= 0) {
          this.userMemoryCache.entries[existingIndex] = entry;
        } else {
          this.userMemoryCache.entries.push(entry);
        }
        this.userMemoryCache.lastUpdated = new Date();
      }

      return entry;
    } catch (err: any) {
      console.error('[MemoryService] Failed to update user memory:', err);
      throw err;
    }
  }

  /**
   * Delete user memory entry
   */
  async deleteUserMemory(key: string): Promise<void> {
    try {
      await Api.deleteUserMemory(key);

      // Update cache
      if (this.userMemoryCache) {
        this.userMemoryCache.entries = this.userMemoryCache.entries.filter((e) => e.key !== key);
        this.userMemoryCache.lastUpdated = new Date();
      }
    } catch (err: any) {
      console.error('[MemoryService] Failed to delete user memory:', err);
      throw err;
    }
  }

  // ========================================================================
  // Organization Memory
  // ========================================================================

  /**
   * Fetch organization memory entries
   */
  async getOrganizationMemory(forceRefresh = false): Promise<OrganizationMemory> {
    const now = Date.now();

    if (!forceRefresh && this.orgMemoryCache && now - this.lastFetch.org < this.cacheExpiry) {
      return this.orgMemoryCache;
    }

    try {
      const response = await Api.getOrganizationMemory();
      this.orgMemoryCache = {
        organizationId: response.organizationId,
        entries: response.entries.map(mapApiMemoryEntry),
        lastUpdated: new Date(response.lastUpdated),
      };
      this.lastFetch.org = now;
      return this.orgMemoryCache;
    } catch (err: any) {
      console.error('[MemoryService] Failed to fetch organization memory:', err);
      return this.orgMemoryCache || { organizationId: '', entries: [], lastUpdated: new Date() };
    }
  }

  /**
   * Update organization memory entry (requires admin)
   */
  async updateOrganizationMemory(payload: MemoryUpdatePayload): Promise<MemoryEntry> {
    try {
      const response = await Api.updateOrganizationMemory({
        key: payload.key,
        value: payload.value,
        category: payload.category,
        source: payload.source || 'explicit',
      });

      const entry = mapApiMemoryEntry(response);

      // Update cache
      if (this.orgMemoryCache) {
        const existingIndex = this.orgMemoryCache.entries.findIndex((e) => e.key === payload.key);
        if (existingIndex >= 0) {
          this.orgMemoryCache.entries[existingIndex] = entry;
        } else {
          this.orgMemoryCache.entries.push(entry);
        }
        this.orgMemoryCache.lastUpdated = new Date();
      }

      return entry;
    } catch (err: any) {
      console.error('[MemoryService] Failed to update organization memory:', err);
      throw err;
    }
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  /**
   * Get memory summary for display
   */
  async getMemorySummary(): Promise<{ user: MemorySummary; org: MemorySummary }> {
    const [userMemory, orgMemory] = await Promise.all([
      this.getUserMemory(),
      this.getOrganizationMemory(),
    ]);

    return {
      user: this.calculateSummary(userMemory.entries, userMemory.lastUpdated),
      org: this.calculateSummary(orgMemory.entries, orgMemory.lastUpdated),
    };
  }

  private calculateSummary(entries: MemoryEntry[], lastUpdated: Date): MemorySummary {
    const byCategory: Record<MemoryCategory, number> = {
      preference: 0,
      expertise: 0,
      style: 0,
      context: 0,
      terminology: 0,
      procedure: 0,
      constraint: 0,
    };

    for (const entry of entries) {
      byCategory[entry.category]++;
    }

    return {
      totalEntries: entries.length,
      byCategory,
      lastUpdated,
    };
  }

  /**
   * Build memory context string for AI prompts
   */
  async buildMemoryContext(): Promise<string> {
    const [userMemory, orgMemory] = await Promise.all([
      this.getUserMemory(),
      this.getOrganizationMemory(),
    ]);

    const sections: string[] = [];

    // User preferences
    const userPrefs = userMemory.entries.filter(
      (e) => e.category === 'preference' || e.category === 'style'
    );
    if (userPrefs.length > 0) {
      sections.push(
        '## User Preferences\n' + userPrefs.map((e) => `- ${e.key}: ${e.value}`).join('\n')
      );
    }

    // User expertise
    const userExpertise = userMemory.entries.filter((e) => e.category === 'expertise');
    if (userExpertise.length > 0) {
      sections.push(
        '## User Expertise\n' + userExpertise.map((e) => `- ${e.key}: ${e.value}`).join('\n')
      );
    }

    // Organization context
    const orgContext = orgMemory.entries.filter(
      (e) => e.category === 'context' || e.category === 'terminology'
    );
    if (orgContext.length > 0) {
      sections.push(
        '## Organization Context\n' + orgContext.map((e) => `- ${e.key}: ${e.value}`).join('\n')
      );
    }

    // Organization procedures
    const orgProcedures = orgMemory.entries.filter(
      (e) => e.category === 'procedure' || e.category === 'constraint'
    );
    if (orgProcedures.length > 0) {
      sections.push(
        '## Organization Procedures\n' +
          orgProcedures.map((e) => `- ${e.key}: ${e.value}`).join('\n')
      );
    }

    return sections.join('\n\n');
  }

  /**
   * Clear cache (useful for logout)
   */
  clearCache(): void {
    this.userMemoryCache = null;
    this.orgMemoryCache = null;
    this.lastFetch = { user: 0, org: 0 };
  }

  /**
   * Learn from feedback (called after positive/negative feedback)
   */
  async learnFromFeedback(feedback: {
    helpful: boolean;
    lengthPreference?: 'shorter' | 'longer' | 'just-right';
    detailPreference?: 'more-detail' | 'less-detail' | 'just-right';
    stylePreference?: string;
  }): Promise<void> {
    try {
      // Update length preference
      if (feedback.lengthPreference && feedback.lengthPreference !== 'just-right') {
        await this.updateUserMemory({
          key: 'response_length',
          value: feedback.lengthPreference === 'shorter' ? 'concise' : 'detailed',
          category: 'preference',
          source: 'feedback',
        });
      }

      // Update detail preference
      if (feedback.detailPreference && feedback.detailPreference !== 'just-right') {
        await this.updateUserMemory({
          key: 'detail_level',
          value: feedback.detailPreference === 'more-detail' ? 'high' : 'low',
          category: 'preference',
          source: 'feedback',
        });
      }

      // Update style preference
      if (feedback.stylePreference) {
        await this.updateUserMemory({
          key: 'preferred_style',
          value: feedback.stylePreference,
          category: 'style',
          source: 'feedback',
        });
      }
    } catch (err: any) {
      console.error('[MemoryService] Failed to learn from feedback:', err);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapApiMemoryEntry(api: any): MemoryEntry {
  return {
    id: api.id,
    key: api.key,
    value: api.value,
    category: api.category,
    source: api.source || 'explicit',
    confidence: api.confidence || 1.0,
    createdAt: new Date(api.created_at || api.createdAt),
    updatedAt: new Date(api.updated_at || api.updatedAt),
    expiresAt: api.expires_at ? new Date(api.expires_at) : undefined,
  };
}

// ============================================================================
// Export Singleton
// ============================================================================

export const MemoryService = new MemoryServiceClass();
export default MemoryService;
