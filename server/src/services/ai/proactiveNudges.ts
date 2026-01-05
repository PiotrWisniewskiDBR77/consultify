/**
 * Proactive Nudges Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Stub implementation Replacing broken lazy-loader
 */
import logger from '../../utils/Logger.js';

class ProactiveNudgesService {
    async generateNudges(userId: string) {
        logger.warn(`[ProactiveNudgesService] generateNudges(${userId}) called on stub`);
        return [];
    }

    async dismissNudge(id: string) {
        logger.warn(`[ProactiveNudgesService] dismissNudge(${id}) called on stub`);
        return { dismissed: true };
    }

    async getActiveNudges(userId: string) {
        logger.warn(`[ProactiveNudgesService] getActiveNudges(${userId}) called on stub`);
        return [];
    }
}

export const proactiveNudgesService = new ProactiveNudgesService();
export default proactiveNudgesService;
