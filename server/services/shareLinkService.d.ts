export default ShareLinkService;
declare namespace ShareLinkService {
    namespace ENTITY_TYPES {
        let ORG_REPORT: string;
        let INITIATIVE_REPORT: string;
    }
    /**
     * Hash a token for secure storage
     * @param {string} token - Raw token
     * @returns {string} SHA-256 hash
     */
    function hashToken(token: string): string;
    /**
     * Generate a secure, URL-safe token (256-bit)
     * @returns {string}
     */
    function generateToken(): string;
    /**
     * Make a public-safe snapshot by stripping PII
     * @param {Object} report - Full report data
     * @returns {Object} Sanitized snapshot
     */
    function makePublicSafeSnapshot(report: Object): Object;
    /**
     * Check and increment trial share link counter
     * @param {string} organizationId
     * @returns {Promise<{allowed: boolean, used: number, limit: number}>}
     */
    function checkTrialLimit(organizationId: string): Promise<{
        allowed: boolean;
        used: number;
        limit: number;
    }>;
    /**
     * Increment trial share link counter
     * @param {string} organizationId
     */
    function incrementTrialCounter(organizationId: string): Promise<void>;
    /**
     * Create a share link with a hashed token and sanitized snapshot
     * @param {Object} params
     * @param {string} params.organizationId
     * @param {string} params.userId - Creator of the share link
     * @param {string} params.entityType - ORG_REPORT | INITIATIVE_REPORT
     * @param {string} [params.entityId] - Initiative ID (if INITIATIVE_REPORT)
     * @param {Object} params.snapshotData - The data to store (will be sanitized)
     * @param {number} [params.expiresInHours=168] - Default 7 days
     * @returns {Promise<Object>}
     */
    function createShareLink({ organizationId, userId, entityType, entityId, snapshotData, expiresInHours }: {
        organizationId: string;
        userId: string;
        entityType: string;
        entityId?: string | undefined;
        snapshotData: Object;
        expiresInHours?: number | undefined;
    }): Promise<Object>;
    /**
     * Get a share link by token (for public access)
     * Uses token hash for lookup
     * @param {string} token - Raw token from URL
     * @returns {Promise<Object|null>}
     */
    function getShareLinkByToken(token: string): Promise<Object | null>;
    /**
     * List share links for an organization (org-scoped)
     * @param {string} organizationId
     * @returns {Promise<Array>}
     */
    function listShareLinks(organizationId: string): Promise<any[]>;
    /**
     * Revoke a share link (soft delete via status)
     * @param {string} id
     * @param {string} organizationId - For org-scoped verification
     * @returns {Promise<boolean>}
     */
    function revokeShareLink(id: string, organizationId: string): Promise<boolean>;
    /**
     * Hard delete a share link (use revokeShareLink for normal operations)
     * @param {string} id
     * @param {string} organizationId - For verification
     * @returns {Promise<boolean>}
     */
    function deleteShareLink(id: string, organizationId: string): Promise<boolean>;
    /**
     * Revoke all share links for an organization
     * @param {string} organizationId
     * @returns {Promise<number>} Number of revoked links
     */
    function revokeAllForOrg(organizationId: string): Promise<number>;
    /**
     * Cleanup expired share links (can be called by cron)
     * @returns {Promise<number>} Number of deleted links
     */
    function cleanupExpiredLinks(): Promise<number>;
    /**
     * Check export limit for trial orgs
     * @param {string} organizationId
     * @returns {Promise<{allowed: boolean, used: number, limit: number}>}
     */
    function checkExportLimit(organizationId: string): Promise<{
        allowed: boolean;
        used: number;
        limit: number;
    }>;
    /**
     * Increment export counter
     * @param {string} organizationId
     */
    function incrementExportCounter(organizationId: string): Promise<void>;
}
//# sourceMappingURL=shareLinkService.d.ts.map