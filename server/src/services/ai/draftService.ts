/**
 * Draft Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Stub implementation Replacing broken lazy-loader
 */
import logger from '../../utils/Logger.js';

class DraftService {
  async createDraft(data: any) {
    logger.warn('[DraftService] createDraft called on stub');
    return { id: 'stub-draft-id', ...data };
  }

  async getDraft(id: string) {
    logger.warn(`[DraftService] getDraft(${id}) called on stub`);
    return null;
  }

  async updateDraft(id: string, data: any) {
    logger.warn(`[DraftService] updateDraft(${id}) called on stub`);
    return { id, ...data };
  }

  async deleteDraft(id: string) {
    logger.warn(`[DraftService] deleteDraft(${id}) called on stub`);
    return { deleted: true };
  }

  async getDrafts(filter: any) {
    logger.warn('[DraftService] getDrafts called on stub');
    return [];
  }
}

export const draftService = new DraftService();
export default draftService;
