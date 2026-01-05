import logger from '../utils/Logger.js';
import { sessionCache } from './redis/CacheService.js';

export interface UserSession {
    userId: string;
    token: string;
    expiresAt: number;
    metadata?: Record<string, any>;
}

class UserSessionService {
    private readonly TTL = 86400; // 24 hours

    async createSession(userId: string, token: string, metadata: Record<string, any> = {}): Promise<void> {
        const session: UserSession = {
            userId,
            token,
            expiresAt: Date.now() + this.TTL * 1000,
            metadata,
        };
        await sessionCache.set(userId, session, this.TTL);
        logger.info(`[Session] Created session for ${userId}`);
    }

    async getSession(userId: string): Promise<UserSession | null> {
        return sessionCache.get<UserSession>(userId);
    }

    async isValidSession(userId: string, token: string): Promise<boolean> {
        const session = await this.getSession(userId);
        if (!session || session.token !== token) return false;
        return Date.now() <= session.expiresAt;
    }

    async invalidateSession(userId: string): Promise<void> {
        await sessionCache.del(userId);
    }
}

export const userSessionService = new UserSessionService();
export default userSessionService;
