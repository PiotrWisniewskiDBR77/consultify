/**
 * Cron: Cleanup Revoked Tokens
 * Removes expired entries from the revoked_tokens table
 */
declare function cleanupRevokedTokens(): void;
declare function startCleanupJob(): void;
declare function stopCleanupJob(): void;
declare const _default: {
    startCleanupJob: typeof startCleanupJob;
    stopCleanupJob: typeof stopCleanupJob;
    cleanupRevokedTokens: typeof cleanupRevokedTokens;
};
export default _default;
//# sourceMappingURL=cleanupRevokedTokens.d.ts.map