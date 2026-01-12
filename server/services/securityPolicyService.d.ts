export default SecurityPolicyService;
declare namespace SecurityPolicyService {
    /**
     * Get security policy for organization
     * Falls back to global defaults if no org-specific policy
     */
    function getPolicy(organizationId: any): Promise<{
        id: any;
        organizationId: any;
        passwordMinLength: any;
        passwordRequireUppercase: boolean;
        passwordRequireLowercase: boolean;
        passwordRequireNumbers: boolean;
        passwordRequireSpecial: boolean;
        passwordExpiryDays: any;
        passwordHistoryCount: any;
        maxLoginAttempts: any;
        lockoutDurationMinutes: any;
        sessionTimeoutMinutes: any;
        concurrentSessionsLimit: any;
        requireSessionBinding: boolean;
        ipAllowlist: any;
        ipBlocklist: any;
        geoRestrictions: any;
        mfaRequired: boolean;
        mfaMethods: any;
        mfaRememberDeviceDays: any;
        compliancePreset: any;
        createdAt: any;
        updatedAt: any;
    } | {
        ipAllowlist: never[];
        ipBlocklist: never[];
        geoRestrictions: never[];
        mfaMethods: string[];
        password_min_length: number;
        password_require_uppercase: boolean;
        password_require_lowercase: boolean;
        password_require_numbers: boolean;
        password_require_special: boolean;
        password_expiry_days: number;
        mfa_required: boolean;
        session_timeout_minutes: number;
    }>;
    /**
     * Create or update security policy for organization
     */
    function upsertPolicy(organizationId: any, updates: any, updatedBy?: null): Promise<{
        success: boolean;
        message: string;
    } | {
        success: boolean;
        message?: undefined;
    } | {
        id: any;
        success: boolean;
    }>;
    /**
     * Update existing security policy
     */
    function updatePolicy(organizationId: any, updates: any, updatedBy?: null): Promise<{
        success: boolean;
        message: string;
    } | {
        success: boolean;
        message?: undefined;
    }>;
    /**
     * Apply a compliance preset
     */
    function applyPreset(organizationId: any, preset: any, updatedBy?: null): Promise<{
        success: boolean;
        message: string;
    } | {
        success: boolean;
        message?: undefined;
    } | {
        id: any;
        success: boolean;
    }>;
    /**
     * Validate password against policy
     */
    function validatePassword(password: any, organizationId?: null): Promise<{
        isValid: boolean;
        errors: string[];
    }>;
    /**
     * Check if password was recently used
     */
    function checkPasswordHistory(userId: any, passwordHash: any, organizationId?: null): Promise<{
        isReused: boolean;
        message?: undefined;
    } | {
        isReused: boolean;
        message: string;
    }>;
    /**
     * Record password in history
     */
    function recordPasswordHistory(userId: any, passwordHash: any): Promise<void>;
    /**
     * Check IP against policy
     */
    function checkIPPolicy(ip: any, organizationId?: null): Promise<{
        allowed: boolean;
        reason: string;
    } | {
        allowed: boolean;
        reason?: undefined;
    }>;
    /**
     * Record login attempt
     */
    function recordLoginAttempt(data: any): Promise<{
        id: any;
    }>;
    /**
     * Get login attempts for user or organization
     */
    function getLoginAttempts(filters?: {}): Promise<any>;
    /**
     * Check if account is locked
     */
    function isAccountLocked(email: any): Promise<{
        locked: boolean;
        reason: any;
        expiresAt: any;
        lockedAt: any;
    } | {
        locked: boolean;
        reason?: undefined;
        expiresAt?: undefined;
        lockedAt?: undefined;
    }>;
    /**
     * Unlock account
     */
    function unlockAccount(email: any, unlockedBy?: null): Promise<{
        success: boolean;
    }>;
    /**
     * Create a user session
     */
    function createSession(userId: any, sessionData: any): Promise<{
        sessionId: any;
        expiresAt: string;
    }>;
    /**
     * Get active sessions for user
     */
    function getUserSessions(userId: any): Promise<any>;
    /**
     * Terminate session
     */
    function terminateSession(sessionId: any, reason?: string): Promise<void>;
    /**
     * Terminate all sessions for user
     */
    function terminateAllSessions(userId: any, reason?: string, exceptSessionId?: null): Promise<void>;
    function _formatPolicy(row: any): {
        id: any;
        organizationId: any;
        passwordMinLength: any;
        passwordRequireUppercase: boolean;
        passwordRequireLowercase: boolean;
        passwordRequireNumbers: boolean;
        passwordRequireSpecial: boolean;
        passwordExpiryDays: any;
        passwordHistoryCount: any;
        maxLoginAttempts: any;
        lockoutDurationMinutes: any;
        sessionTimeoutMinutes: any;
        concurrentSessionsLimit: any;
        requireSessionBinding: boolean;
        ipAllowlist: any;
        ipBlocklist: any;
        geoRestrictions: any;
        mfaRequired: boolean;
        mfaMethods: any;
        mfaRememberDeviceDays: any;
        compliancePreset: any;
        createdAt: any;
        updatedAt: any;
    };
    function _matchIP(ip: any, pattern: any): boolean;
    function _checkAndLockAccount(email: any, ip: any, organizationId: any): Promise<void>;
}
//# sourceMappingURL=securityPolicyService.d.ts.map