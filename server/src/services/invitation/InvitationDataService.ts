// @ts-nocheck
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import {
  InvitationEventType,
  InvitationRecord,
  InvitationStatus,
  InvitationType,
  RequestInfo,
} from './InvitationTypes.js';

export interface InvitationDataDependencies {
  db: IDatabase;
  uuidv4: () => string;
}

export class InvitationDataService {
  private deps: InvitationDataDependencies;

  constructor(deps?: Partial<InvitationDataDependencies>) {
    this.deps = {
      db: deps?.db ?? getDatabase(),
      uuidv4: deps?.uuidv4 ?? uuidv4,
    };
  }

  /**
   * Update dependencies after construction (e.g. test DI injecting a mock db).
   * Needed because the parent InvitationServiceClass constructs this sub-service
   * once at instantiation time — without this setter, a later
   * InvitationServiceClass.setDependencies({ db }) call would silently have no
   * effect on the db this instance actually queries.
   */
  setDependencies(newDeps: Partial<InvitationDataDependencies>): void {
    this.deps = { ...this.deps, ...newDeps };
  }

  async getInvitationById(id: string): Promise<InvitationRecord | null> {
    return this.deps.db.get<InvitationRecord>(`SELECT * FROM invitations WHERE id = ?`, [id]);
  }

  async getInvitationByTokenHash(tokenHash: string): Promise<InvitationRecord | null> {
    return this.deps.db.get<InvitationRecord>(
      `SELECT i.*, o.name as organization_name, p.name as project_name
             FROM invitations i
             LEFT JOIN organizations o ON i.organization_id = o.id
             LEFT JOIN projects p ON i.project_id = p.id
             WHERE i.token_hash = ?`,
      [tokenHash]
    );
  }

  async getPendingInvitationByEmail(
    organizationId: string,
    email: string
  ): Promise<InvitationRecord | null> {
    return this.deps.db.get<InvitationRecord>(
      `SELECT * FROM invitations 
             WHERE organization_id = ? AND email = ? AND status = 'pending'`,
      [organizationId, email.toLowerCase()]
    );
  }

  async createInvitation(data: {
    id: string;
    organizationId: string;
    projectId?: string;
    email: string;
    role: string;
    roleToAssign: string;
    tokenHash: string;
    invitedByUserId: string;
    expiresAt: string;
    invitationType: InvitationType;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await this.deps.db.run(
      `INSERT INTO invitations 
             (id, organization_id, project_id, email, role, role_to_assign, token, token_hash, status, invited_by, expires_at, invitation_type, metadata) 
             VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'pending', ?, ?, ?, ?)`,
      [
        data.id,
        data.organizationId,
        data.projectId || null,
        data.email.toLowerCase(),
        data.role,
        data.roleToAssign,
        data.tokenHash,
        data.invitedByUserId,
        data.expiresAt,
        data.invitationType,
        JSON.stringify(data.metadata),
      ]
    );
  }

  async markAsAccepted(id: string, userId: string): Promise<boolean> {
    const result = await this.deps.db.run(
      `UPDATE invitations 
             SET status = 'accepted', accepted_at = datetime('now'), accepted_by_user_id = ?
             WHERE id = ? AND status = 'pending'`,
      [userId, id]
    );
    return (result.changes || 0) > 0;
  }

  async markAsExpired(id: string): Promise<void> {
    await this.deps.db.run(`UPDATE invitations SET status = 'expired' WHERE id = ?`, [id]);
  }

  async markAsRevoked(id: string): Promise<void> {
    await this.deps.db.run(`UPDATE invitations SET status = 'revoked' WHERE id = ?`, [id]);
  }

  async updateForResend(id: string, newTokenHash: string, newExpiresAt: string): Promise<void> {
    await this.deps.db.run(
      `UPDATE invitations 
             SET token_hash = ?, expires_at = ?, status = 'pending', 
                 resend_count = COALESCE(resend_count, 0) + 1,
                 last_resent_at = datetime('now')
             WHERE id = ?`,
      [newTokenHash, newExpiresAt, id]
    );
  }

  async listInvitations(
    organizationId: string,
    options: {
      status?: string;
      invitationType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<InvitationRecord[]> {
    let query = `SELECT * FROM invitations WHERE organization_id = ?`;
    const params: any[] = [organizationId];

    if (options.status) {
      query += ` AND status = ?`;
      params.push(options.status);
    }

    if (options.invitationType) {
      query += ` AND invitation_type = ?`;
      params.push(options.invitationType);
    }

    query += ` ORDER BY created_at DESC`;

    if (options.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }

    return (await this.deps.db.all<InvitationRecord>(query, params)) || [];
  }

  async logEvent(
    invitationId: string,
    eventType: InvitationEventType | string,
    performedByUserId: string | null = null,
    metadata: Record<string, unknown> = {},
    requestInfo: RequestInfo = {}
  ): Promise<{ id: string }> {
    const id = this.deps.uuidv4();
    const { ipAddress, userAgent } = requestInfo;

    // Audit/event log is best-effort: a drifted schema (missing column/table)
    // must NEVER break invitation accept/activation for the end user.
    try {
      await this.deps.db.run(
        `INSERT INTO invitation_events
             (id, invitation_id, event_type, performed_by_user_id, ip_address, user_agent, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          invitationId,
          eventType,
          performedByUserId,
          ipAddress || null,
          userAgent || null,
          JSON.stringify(metadata),
        ]
      );
    } catch (err) {
      console.warn('[InvitationDataService] logEvent failed (non-fatal):', (err as Error)?.message);
    }

    return { id };
  }

  async getInvitationEvents(invitationId: string): Promise<InvitationEventRecord[]> {
    return (
      (await this.deps.db.all<InvitationEventRecord>(
        `SELECT ie.*, u.first_name, u.last_name, u.email 
             FROM invitation_events ie
             LEFT JOIN users u ON ie.performed_by_user_id = u.id
             WHERE ie.invitation_id = ? 
             ORDER BY ie.created_at ASC`,
        [invitationId]
      )) || []
    );
  }
}
