/**
 * Organization Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Full TypeScript migration of organizationService.js
 * Handles core organization logic:
 * - Member management (RBAC source of truth)
 * - Billing status & Token balance management
 * - Organization details
 */

import type { IDatabase, RunResult } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface Organization {
    id: string;
    name: string;
    status: string;
    billing_status: string;
    token_balance: number;
    created_at: string;
    ai_assertiveness_level?: string;
    ai_autonomy_level?: string;
    attribution_data?: string;
}

export interface OrganizationMember {
    id: string;
    user_id: string;
    role: string;
    status: string;
    created_at: string;
    first_name?: string;
    last_name?: string;
    email?: string;
}

export interface CreateOrganizationParams {
    userId: string;
    name: string;
    email?: string;
    attribution?: { type: string; id: string } | null;
}

export interface AddMemberParams {
    organizationId: string;
    userId: string;
    role: string;
    invitedBy?: string;
}

export interface UpdateMemberRoleParams {
    organizationId: string;
    userId: string;
    role: string;
}

export interface RemoveMemberParams {
    organizationId: string;
    userId: string;
}

export interface AISettings {
    ai_assertiveness_level?: string;
    ai_autonomy_level?: string;
}

export interface ServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class OrganizationServiceClass {
    // Dependency injection container (for deterministic unit tests)
    private deps: ServiceDependencies;

    // Role Constants
    readonly ROLES = {
        OWNER: 'OWNER',
        ADMIN: 'ADMIN',
        MEMBER: 'MEMBER',
        CONSULTANT: 'CONSULTANT'
    } as const;

    constructor(deps?: Partial<ServiceDependencies>) {
        this.deps = {
            db: deps?.db || getDatabase(),
            uuidv4: deps?.uuidv4 || uuidv4
        };
    }

    /**
     * For testing: allow overriding dependencies
     */
    setDependencies(newDeps: Partial<ServiceDependencies>): void {
        Object.assign(this.deps, newDeps);
    }

    /**
     * Create a new organization with an initial OWNER
     */
    async createOrganization({
        userId,
        name,
        email,
        attribution = null
    }: CreateOrganizationParams): Promise<{ id: string; name: string; role: string }> {
        const orgId = this.deps.uuidv4();
        const now = new Date().toISOString();
        const attributionJson = attribution ? JSON.stringify(attribution) : null;

        return new Promise((resolve, reject) => {
            this.deps.db.serialize(() => {
                this.deps.db.run('BEGIN TRANSACTION');

                // 1. Create Organization
                this.deps.db.run(
                    `INSERT INTO organizations (
                        id, name, status, billing_status, token_balance, created_by_user_id, created_at, is_active,
                        ai_assertiveness_level, ai_autonomy_level, attribution_data
                    )
                     VALUES (?, ?, 'active', 'TRIAL', 0, ?, ?, 1, 'MEDIUM', 'SUGGEST_ONLY', ?)`,
                    [orgId, name, userId, now, attributionJson],
                    (err: Error | null) => {
                        if (err) {
                            this.deps.db.run('ROLLBACK');
                            return reject(err);
                        }
                    }
                );

                // 2. Add Creator as OWNER
                this.deps.db.run(
                    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
                     VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
                    [this.deps.uuidv4(), orgId, userId, 'OWNER', now],
                    (err: Error | null) => {
                        if (err) {
                            this.deps.db.run('ROLLBACK');
                            return reject(err);
                        }

                        this.deps.db.run('COMMIT', (commitErr: Error | null) => {
                            if (commitErr) return reject(commitErr);
                            resolve({ id: orgId, name, role: 'OWNER' });
                        });
                    }
                );
            });
        });
    }

    /**
     * Get organization details including billing and tokens
     */
    async getOrganization(orgId: string): Promise<Organization> {
        return new Promise((resolve, reject) => {
            this.deps.db.get<Organization>(
                `SELECT id, name, status, billing_status, token_balance, created_at 
                 FROM organizations WHERE id = ?`,
                [orgId],
                (err: Error | null, row: Organization | null) => {
                    if (err) return reject(err);
                    if (!row) return reject(new Error('Organization not found'));
                    resolve(row);
                }
            );
        });
    }

    /**
     * Add a member to the organization
     */
    async addMember({
        organizationId,
        userId,
        role,
        invitedBy
    }: AddMemberParams): Promise<{ id: string; organizationId: string; userId: string; role: string }> {
        if (!Object.values(this.ROLES).includes(role as any)) {
            throw new Error('Invalid role');
        }

        const id = this.deps.uuidv4();
        return new Promise((resolve, reject) => {
            this.deps.db.run(
                `INSERT INTO organization_members (id, organization_id, user_id, role, status, invited_by_user_id)
                 VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
                [id, organizationId, userId, role, invitedBy],
                function (this: RunResult, err: Error | null) {
                    if (err) {
                        // Check for unique constraint violation
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return reject(new Error('User is already a member of this organization'));
                        }
                        return reject(err);
                    }
                    resolve({ id, organizationId, userId, role });
                }
            );
        });
    }

    /**
     * Get members of an organization
     */
    async getMembers(orgId: string): Promise<OrganizationMember[]> {
        return new Promise((resolve, reject) => {
            this.deps.db.all<OrganizationMember>(
                `SELECT m.id, m.user_id, m.role, m.status, m.created_at, u.first_name, u.last_name, u.email
                 FROM organization_members m
                 JOIN users u ON m.user_id = u.id
                 WHERE m.organization_id = ?`,
                [orgId],
                (err: Error | null, rows: OrganizationMember[]) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    /**
     * Get organizations for a user
     */
    async getUserOrganizations(userId: string): Promise<Array<{ id: string; name: string; billing_status: string; role: string }>> {
        return new Promise((resolve, reject) => {
            this.deps.db.all(
                `SELECT o.id, o.name, o.billing_status, m.role
                 FROM organizations o
                 JOIN organization_members m ON o.id = m.organization_id
                 WHERE m.user_id = ?`,
                [userId],
                (err: Error | null, rows: unknown[]) => {
                    if (err) return reject(err);
                    resolve((rows || []) as Array<{ id: string; name: string; billing_status: string; role: string }>);
                }
            );
        });
    }

    /**
     * Activate billing for an organization
     * Sets billing_status = ACTIVE, organization_type = PAID, and grants initial tokens
     */
    async activateBilling(orgId: string): Promise<{
        success: boolean;
        billingStatus: string;
        organizationType: string;
        tokensAdded: number;
    }> {
        const INITIAL_TOKENS = 100000; // Configurable initial pack

        return new Promise((resolve, reject) => {
            this.deps.db.serialize(() => {
                this.deps.db.run('BEGIN TRANSACTION');

                // Update Organization
                this.deps.db.run(
                    `UPDATE organizations 
                     SET billing_status = 'ACTIVE', 
                         organization_type = 'PAID',
                         status = 'active',
                         token_balance = IFNULL(token_balance, 0) + ? 
                     WHERE id = ?`,
                    [INITIAL_TOKENS, orgId],
                    function (this: RunResult, err: Error | null) {
                        if (err) {
                            this.deps.db.run('ROLLBACK');
                            return reject(err);
                        }
                        if (this.changes === 0) {
                            this.deps.db.run('ROLLBACK');
                            return reject(new Error('Organization not found'));
                        }
                    }
                );

                // Update Billing Table
                this.deps.db.run(
                    `INSERT OR REPLACE INTO organization_billing (organization_id, status, updated_at)
                     VALUES (?, 'ACTIVE', CURRENT_TIMESTAMP)`,
                    [orgId],
                    (err: Error | null) => {
                        if (err) {
                            this.deps.db.run('ROLLBACK');
                            return reject(err);
                        }

                        this.deps.db.run('COMMIT', async (commitErr: Error | null) => {
                            if (commitErr) return reject(commitErr);

                            // Log the event (post-commit)
                            try {
                                // Dynamic import to avoid circular dependencies
                                const OrganizationEventService = await import('./organizationEventService.js');
                                const eventService = OrganizationEventService.default || OrganizationEventService;
                                await (eventService as any).logEvent(orgId, 'BILLING_ACTIVATED', null, { initialTokens: INITIAL_TOKENS });

                                resolve({
                                    success: true,
                                    billingStatus: 'ACTIVE',
                                    organizationType: 'PAID',
                                    tokensAdded: INITIAL_TOKENS
                                });
                            } catch (e) {
                                // Event logging failed, but billing is active. Acceptable.
                                logger.error('Post-billing activation error', { error: e });
                                resolve({
                                    success: true,
                                    billingStatus: 'ACTIVE',
                                    organizationType: 'PAID',
                                    tokensAdded: INITIAL_TOKENS
                                });
                            }
                        });
                    }
                );
            });
        });
    }

    /**
     * Update AI settings for an organization
     */
    async updateAISettings(orgId: string, settings: AISettings): Promise<void> {
        const updates: string[] = [];
        const params: unknown[] = [];

        if (settings.ai_assertiveness_level) {
            updates.push('ai_assertiveness_level = ?');
            params.push(settings.ai_assertiveness_level);
        }
        if (settings.ai_autonomy_level) {
            updates.push('ai_autonomy_level = ?');
            params.push(settings.ai_autonomy_level);
        }

        if (updates.length === 0) return Promise.resolve();

        params.push(orgId);

        return new Promise((resolve, reject) => {
            this.deps.db.run(
                `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`,
                params,
                (err: Error | null) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    /**
     * Get AI settings for an organization
     */
    async getAISettings(orgId: string): Promise<AISettings> {
        return new Promise((resolve, reject) => {
            this.deps.db.get<AISettings>(
                `SELECT ai_assertiveness_level, ai_autonomy_level 
                FROM organizations WHERE id = ?`,
                [orgId],
                (err: Error | null, row: AISettings | null) => {
                    if (err) return reject(err);
                    resolve(row || {
                        ai_assertiveness_level: 'MEDIUM',
                        ai_autonomy_level: 'SUGGEST_ONLY'
                    });
                }
            );
        });
    }

    /**
     * Remove a member from the organization
     */
    async removeMember({ organizationId, userId }: RemoveMemberParams): Promise<void> {
        return new Promise((resolve, reject) => {
            this.deps.db.run(
                `DELETE FROM organization_members 
                 WHERE organization_id = ? AND user_id = ?`,
                [organizationId, userId],
                function (this: RunResult, err: Error | null) {
                    if (err) return reject(err);
                    if (this.changes === 0) {
                        return reject(new Error('Member not found'));
                    }
                    resolve();
                }
            );
        });
    }

    /**
     * Update a member's role in the organization
     */
    async updateMemberRole({
        organizationId,
        userId,
        role
    }: UpdateMemberRoleParams): Promise<{ organizationId: string; userId: string; role: string }> {
        if (!Object.values(this.ROLES).includes(role as any)) {
            throw new Error('Invalid role');
        }

        return new Promise((resolve, reject) => {
            this.deps.db.run(
                `UPDATE organization_members 
                 SET role = ? 
                 WHERE organization_id = ? AND user_id = ?`,
                [role, organizationId, userId],
                function (this: RunResult, err: Error | null) {
                    if (err) return reject(err);
                    if (this.changes === 0) {
                        return reject(new Error('Member not found'));
                    }
                    resolve({ organizationId, userId, role });
                }
            );
        });
    }

    /**
     * Get a member's role in the organization
     */
    async getMemberRole(organizationId: string, userId: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            this.deps.db.get<{ role: string }>(
                `SELECT role FROM organization_members 
                 WHERE organization_id = ? AND user_id = ?`,
                [organizationId, userId],
                (err: Error | null, row: { role: string } | null) => {
                    if (err) return reject(err);
                    resolve(row ? row.role : null);
                }
            );
        });
    }
}

// Create singleton instance
const organizationService = new OrganizationServiceClass();

// Export singleton instance (for backward compatibility)
export default organizationService;

// Export class for testing
export { OrganizationServiceClass };
