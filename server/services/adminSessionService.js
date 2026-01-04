/**
 * Admin Session Management Service
 * 
 * Manages SuperAdmin sessions with MFA tracking, IP logging,
 * and session revocation capabilities.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();



// Dependency injection for testing
const deps = {
    db,
    uuidv4,
};

/**
 * Set dependencies for testing
 */
const setDependencies = (newDeps) => {
    Object.assign(deps, newDeps);
};

/**
 * Generate a secure session token
 */
const generateSessionToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Create a new admin session
 * @param {Object} params - Session parameters
 * @param {string} params.adminId - Admin user ID
 * @param {string} params.ipAddress - Client IP address
 * @param {string} params.userAgent - Client user agent
 * @param {boolean} params.mfaVerified - Whether MFA was verified
 * @param {number} params.expiresInHours - Session expiration in hours (default: 24)
 * @returns {Promise<Object>} Created session
 */
const createSession = async ({ adminId, ipAddress, userAgent, mfaVerified = false, expiresInHours = 24 }) => {
    const id = deps.uuidv4();
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    const sql = `
        INSERT INTO admin_sessions (id, admin_id, session_token, ip_address, user_agent, mfa_verified, expires_at, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `;

    await deps.db.run(sql, [id, adminId, sessionToken, ipAddress, userAgent, mfaVerified ? 1 : 0, expiresAt]);

    return {
        id,
        adminId,
        sessionToken,
        ipAddress,
        userAgent,
        mfaVerified,
        expiresAt,
        isActive: true,
        createdAt: new Date().toISOString()
    };
};

/**
 * Get session by token
 * @param {string} sessionToken - Session token
 * @returns {Promise<Object|null>} Session or null
 */
const getSession = async (sessionToken) => {
    const sql = `
        SELECT 
            s.id, s.admin_id, s.session_token, s.ip_address, s.user_agent,
            s.mfa_verified, s.created_at, s.expires_at, s.is_active,
            u.email as admin_email, u.first_name, u.last_name
        FROM admin_sessions s
        LEFT JOIN users u ON s.admin_id = u.id
        WHERE s.session_token = ?
    `;

    const session = await deps.db.get(sql, [sessionToken]);

    if (!session) return null;

    return {
        id: session.id,
        adminId: session.admin_id,
        sessionToken: session.session_token,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        mfaVerified: session.mfa_verified === 1,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
        isActive: session.is_active === 1,
        admin: {
            email: session.admin_email,
            firstName: session.first_name,
            lastName: session.last_name
        }
    };
};

/**
 * Verify session validity
 * @param {string} sessionToken - Session token
 * @returns {Promise<Object>} Verification result
 */
const verifySession = async (sessionToken) => {
    const session = await getSession(sessionToken);

    if (!session) {
        return { valid: false, reason: 'Session not found' };
    }

    if (!session.isActive) {
        return { valid: false, reason: 'Session has been revoked' };
    }

    const now = new Date();
    const expiresAt = new Date(session.expiresAt);

    if (now > expiresAt) {
        // Auto-deactivate expired session
        await revokeSession(session.id);
        return { valid: false, reason: 'Session has expired' };
    }

    return { valid: true, session };
};

/**
 * Revoke a specific session
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Success status
 */
const revokeSession = async (sessionId) => {
    const sql = `UPDATE admin_sessions SET is_active = 0 WHERE id = ?`;
    const result = await deps.db.run(sql, [sessionId]);
    return result.changes > 0;
};

/**
 * Get all active sessions for an admin
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Array>} List of active sessions
 */
const getActiveSessions = async (adminId = null) => {
    let sql = `
        SELECT 
            s.id, s.admin_id, s.ip_address, s.user_agent,
            s.mfa_verified, s.created_at, s.expires_at, s.is_active,
            u.email as admin_email, u.first_name, u.last_name
        FROM admin_sessions s
        LEFT JOIN users u ON s.admin_id = u.id
        WHERE s.is_active = 1 AND s.expires_at > datetime('now')
    `;

    const params = [];
    if (adminId) {
        sql += ' AND s.admin_id = ?';
        params.push(adminId);
    }

    sql += ' ORDER BY s.created_at DESC';

    const sessions = await deps.db.all(sql, params);

    return sessions.map(s => ({
        id: s.id,
        adminId: s.admin_id,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        mfaVerified: s.mfa_verified === 1,
        createdAt: s.created_at,
        expiresAt: s.expires_at,
        isActive: s.is_active === 1,
        admin: {
            email: s.admin_email,
            firstName: s.first_name,
            lastName: s.last_name
        }
    }));
};

/**
 * Revoke all sessions for an admin (except current)
 * @param {string} adminId - Admin user ID
 * @param {string} exceptSessionId - Session ID to exclude (current session)
 * @returns {Promise<number>} Number of revoked sessions
 */
const revokeAllSessions = async (adminId, exceptSessionId = null) => {
    let sql = `UPDATE admin_sessions SET is_active = 0 WHERE admin_id = ?`;
    const params = [adminId];

    if (exceptSessionId) {
        sql += ' AND id != ?';
        params.push(exceptSessionId);
    }

    const result = await deps.db.run(sql, params);
    return result.changes;
};

/**
 * Get session statistics
 * @returns {Promise<Object>} Session statistics
 */
const getSessionStats = async () => {
    const sql = `
        SELECT 
            COUNT(*) as total_sessions,
            SUM(CASE WHEN is_active = 1 AND expires_at > datetime('now') THEN 1 ELSE 0 END) as active_sessions,
            SUM(CASE WHEN mfa_verified = 1 THEN 1 ELSE 0 END) as mfa_verified_sessions,
            COUNT(DISTINCT admin_id) as unique_admins
        FROM admin_sessions
    `;

    const stats = await deps.db.get(sql);

    return {
        totalSessions: stats?.total_sessions || 0,
        activeSessions: stats?.active_sessions || 0,
        mfaVerifiedSessions: stats?.mfa_verified_sessions || 0,
        uniqueAdmins: stats?.unique_admins || 0
    };
};

/**
 * Clean up expired sessions (for background job)
 * @returns {Promise<number>} Number of cleaned sessions
 */
const cleanupExpiredSessions = async () => {
    const sql = `DELETE FROM admin_sessions WHERE expires_at < datetime('now')`;
    const result = await deps.db.run(sql);
    return result.changes;
};

/**
 * Update MFA verification status
 * @param {string} sessionId - Session ID
 * @param {boolean} mfaVerified - MFA verification status
 * @returns {Promise<boolean>} Success status
 */
const updateMfaStatus = async (sessionId, mfaVerified) => {
    const sql = `UPDATE admin_sessions SET mfa_verified = ? WHERE id = ?`;
    const result = await deps.db.run(sql, [mfaVerified ? 1 : 0, sessionId]);
    return result.changes > 0;
};

export {
    setDependencies,
    createSession,
    getSession,
    verifySession,
    revokeSession,
    getActiveSessions,
    revokeAllSessions,
    getSessionStats,
    cleanupExpiredSessions,
    updateMfaStatus
};

export default {
    setDependencies,
    createSession,
    getSession,
    verifySession,
    revokeSession,
    getActiveSessions,
    revokeAllSessions,
    getSessionStats,
    cleanupExpiredSessions,
    updateMfaStatus
};





