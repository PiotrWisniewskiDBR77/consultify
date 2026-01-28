/**
 * Decision Delegation Service
 * Manages delegation, handoff, and input requests for decisions
 * 
 * Features:
 * - Full delegation (transfer decision ownership)
 * - Request input/review from others
 * - Accept/reject delegation
 * - Co-decision (require multiple approvers)
 * - RACI stakeholder management
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import notificationService from './notificationService.js';

// ==========================================
// TYPES
// ==========================================

export type DelegationType = 'full' | 'review' | 'input' | 'co_decide';
export type DelegationStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'expired';
export type StakeholderRole = 'responsible' | 'accountable' | 'consulted' | 'informed';
export type OpinionRecommendation = 'approve' | 'reject' | 'defer' | 'need_more_info';

export interface Delegation {
  id: string;
  decisionId: string;
  organizationId?: string;
  fromUserId: string;
  toUserId: string;
  delegationType: DelegationType;
  reason?: string;
  comment?: string;
  status: DelegationStatus;
  responseComment?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  completedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  fromUserName?: string;
  toUserName?: string;
  decisionTitle?: string;
}

export interface ConsultedOpinion {
  id: string;
  decisionId: string;
  delegationId?: string;
  userId: string;
  userName?: string;
  opinion: string;
  recommendation?: OpinionRecommendation;
  confidenceLevel?: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface Stakeholder {
  id: string;
  decisionId: string;
  userId: string;
  userName?: string;
  role: StakeholderRole;
  notifyOnCreate: boolean;
  notifyOnUpdate: boolean;
  notifyOnDecision: boolean;
  notifyOnEscalation: boolean;
  notifiedAt?: string;
  acknowledgedAt?: string;
}

// ==========================================
// SERVICE CLASS
// ==========================================

export class DecisionDelegationService {

  // ==========================================
  // DELEGATION
  // ==========================================

  /**
   * Delegate a decision to another user
   */
  static async delegate(
    decisionId: string,
    fromUserId: string,
    toUserId: string,
    delegationType: DelegationType,
    options: {
      reason?: string;
      comment?: string;
      expiresAt?: string;
    } = {}
  ): Promise<Delegation> {
    const id = uuidv4();
    const nowIso = new Date().toISOString();

    // Get decision info
    const decision = await queryHelpers.queryOne<{ organization_id: string; title: string }>(
      `SELECT organization_id, title FROM decisions WHERE id = ?`,
      [decisionId]
    );

    if (!decision) {
      throw new Error('Decision not found');
    }

    // For full delegation, check if user is current decider
    if (delegationType === 'full') {
      const isDecider = await queryHelpers.queryOne(
        `SELECT 1 FROM decisions WHERE id = ? AND (decider_id = ? OR decision_maker_id = ?)`,
        [decisionId, fromUserId, fromUserId]
      );
      if (!isDecider) {
        throw new Error('Only the current decider can fully delegate a decision');
      }
    }

    // Create delegation record
    await queryHelpers.queryRun(
      `INSERT INTO decision_delegations (
        id, decision_id, organization_id,
        from_user_id, to_user_id, delegation_type,
        reason, comment, status, expires_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        id,
        decisionId,
        decision.organization_id,
        fromUserId,
        toUserId,
        delegationType,
        options.reason || null,
        options.comment || null,
        options.expiresAt || null,
        nowIso,
        nowIso,
      ]
    );

    // Send notification
    await this.notifyDelegation(id, decision.title, delegationType);

    logger.info(`[DecisionDelegationService] Created ${delegationType} delegation ${id} from ${fromUserId} to ${toUserId}`);

    return this.getDelegation(id) as Promise<Delegation>;
  }

  /**
   * Accept a delegation
   */
  static async acceptDelegation(
    delegationId: string,
    userId: string,
    responseComment?: string
  ): Promise<Delegation> {
    const delegation = await this.getDelegation(delegationId);
    
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.toUserId !== userId) {
      throw new Error('You are not the recipient of this delegation');
    }

    if (delegation.status !== 'pending') {
      throw new Error(`Cannot accept delegation in status: ${delegation.status}`);
    }

    const nowIso = new Date().toISOString();

    // Update delegation
    await queryHelpers.queryRun(
      `UPDATE decision_delegations SET 
        status = 'accepted',
        response_comment = ?,
        accepted_at = ?,
        updated_at = ?
       WHERE id = ?`,
      [responseComment || null, nowIso, nowIso, delegationId]
    );

    // For full delegation, transfer decision ownership
    if (delegation.delegationType === 'full') {
      await queryHelpers.queryRun(
        `UPDATE decisions SET 
          original_decider_id = COALESCE(original_decider_id, decider_id, decision_maker_id),
          decider_id = ?,
          decision_maker_id = ?,
          delegation_count = COALESCE(delegation_count, 0) + 1,
          updated_at = ?
         WHERE id = ?`,
        [userId, userId, nowIso, delegation.decisionId]
      );
    }

    // Notify the original user
    await this.notifyDelegationResponse(delegationId, 'accepted');

    logger.info(`[DecisionDelegationService] Delegation ${delegationId} accepted by ${userId}`);

    return this.getDelegation(delegationId) as Promise<Delegation>;
  }

  /**
   * Reject a delegation
   */
  static async rejectDelegation(
    delegationId: string,
    userId: string,
    rejectionReason?: string
  ): Promise<Delegation> {
    const delegation = await this.getDelegation(delegationId);
    
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.toUserId !== userId) {
      throw new Error('You are not the recipient of this delegation');
    }

    if (delegation.status !== 'pending') {
      throw new Error(`Cannot reject delegation in status: ${delegation.status}`);
    }

    const nowIso = new Date().toISOString();

    await queryHelpers.queryRun(
      `UPDATE decision_delegations SET 
        status = 'rejected',
        rejected_at = ?,
        rejection_reason = ?,
        updated_at = ?
       WHERE id = ?`,
      [nowIso, rejectionReason || null, nowIso, delegationId]
    );

    // Notify the original user
    await this.notifyDelegationResponse(delegationId, 'rejected');

    logger.info(`[DecisionDelegationService] Delegation ${delegationId} rejected by ${userId}`);

    return this.getDelegation(delegationId) as Promise<Delegation>;
  }

  /**
   * Request input from multiple users
   */
  static async requestInput(
    decisionId: string,
    fromUserId: string,
    toUserIds: string[],
    comment?: string
  ): Promise<Delegation[]> {
    const delegations: Delegation[] = [];

    for (const toUserId of toUserIds) {
      const delegation = await this.delegate(decisionId, fromUserId, toUserId, 'input', {
        comment,
        reason: 'Input requested',
      });
      delegations.push(delegation);

      // Also add as consulted stakeholder
      await this.addStakeholder(decisionId, toUserId, 'consulted', fromUserId);
    }

    return delegations;
  }

  /**
   * Submit input/opinion for a delegation
   */
  static async submitInput(
    delegationId: string,
    userId: string,
    opinion: string,
    options: {
      recommendation?: OpinionRecommendation;
      confidenceLevel?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<ConsultedOpinion> {
    const delegation = await this.getDelegation(delegationId);
    
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.toUserId !== userId) {
      throw new Error('You are not the recipient of this delegation');
    }

    if (delegation.delegationType !== 'input' && delegation.delegationType !== 'review') {
      throw new Error('This delegation does not accept input');
    }

    const nowIso = new Date().toISOString();
    const opinionId = uuidv4();

    // Get user name
    const user = await queryHelpers.queryOne<{ first_name: string; last_name: string }>(
      `SELECT first_name, last_name FROM users WHERE id = ?`,
      [userId]
    );

    // Create opinion
    await queryHelpers.queryRun(
      `INSERT INTO decision_consulted_opinions (
        id, decision_id, delegation_id, organization_id,
        user_id, user_name, opinion, recommendation, confidence_level,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        opinionId,
        delegation.decisionId,
        delegationId,
        delegation.organizationId || null,
        userId,
        user ? `${user.first_name} ${user.last_name}` : null,
        opinion,
        options.recommendation || null,
        options.confidenceLevel || null,
        nowIso,
      ]
    );

    // Mark delegation as completed
    await queryHelpers.queryRun(
      `UPDATE decision_delegations SET 
        status = 'completed',
        completed_at = ?,
        updated_at = ?
       WHERE id = ?`,
      [nowIso, nowIso, delegationId]
    );

    // Notify requester
    await this.notifyInputReceived(delegation, opinion);

    logger.info(`[DecisionDelegationService] Input submitted for delegation ${delegationId}`);

    return {
      id: opinionId,
      decisionId: delegation.decisionId,
      delegationId,
      userId,
      userName: user ? `${user.first_name} ${user.last_name}` : undefined,
      opinion,
      recommendation: options.recommendation,
      confidenceLevel: options.confidenceLevel,
      createdAt: nowIso,
    };
  }

  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get delegation by ID
   */
  static async getDelegation(delegationId: string): Promise<Delegation | null> {
    const row = await queryHelpers.queryOne<any>(
      `SELECT 
        d.*,
        uf.first_name || ' ' || uf.last_name as from_user_name,
        ut.first_name || ' ' || ut.last_name as to_user_name,
        dec.title as decision_title
       FROM decision_delegations d
       LEFT JOIN users uf ON d.from_user_id = uf.id
       LEFT JOIN users ut ON d.to_user_id = ut.id
       LEFT JOIN decisions dec ON d.decision_id = dec.id
       WHERE d.id = ?`,
      [delegationId]
    );

    if (!row) return null;

    return this.mapDelegation(row);
  }

  /**
   * Get pending delegations for a user
   */
  static async getPendingDelegations(userId: string): Promise<Delegation[]> {
    const rows = await queryHelpers.queryAll<any>(
      `SELECT 
        d.*,
        uf.first_name || ' ' || uf.last_name as from_user_name,
        ut.first_name || ' ' || ut.last_name as to_user_name,
        dec.title as decision_title
       FROM decision_delegations d
       LEFT JOIN users uf ON d.from_user_id = uf.id
       LEFT JOIN users ut ON d.to_user_id = ut.id
       LEFT JOIN decisions dec ON d.decision_id = dec.id
       WHERE d.to_user_id = ? AND d.status = 'pending'
       ORDER BY d.created_at DESC`,
      [userId]
    );

    return (rows || []).map(this.mapDelegation);
  }

  /**
   * Get delegation history for a decision
   */
  static async getDelegationHistory(decisionId: string): Promise<Delegation[]> {
    const rows = await queryHelpers.queryAll<any>(
      `SELECT 
        d.*,
        uf.first_name || ' ' || uf.last_name as from_user_name,
        ut.first_name || ' ' || ut.last_name as to_user_name
       FROM decision_delegations d
       LEFT JOIN users uf ON d.from_user_id = uf.id
       LEFT JOIN users ut ON d.to_user_id = ut.id
       WHERE d.decision_id = ?
       ORDER BY d.created_at ASC`,
      [decisionId]
    );

    return (rows || []).map(this.mapDelegation);
  }

  /**
   * Get consulted opinions for a decision
   */
  static async getConsultedOpinions(decisionId: string): Promise<ConsultedOpinion[]> {
    const rows = await queryHelpers.queryAll<any>(
      `SELECT * FROM decision_consulted_opinions 
       WHERE decision_id = ?
       ORDER BY created_at ASC`,
      [decisionId]
    );

    return (rows || []).map((row) => ({
      id: row.id,
      decisionId: row.decision_id,
      delegationId: row.delegation_id,
      userId: row.user_id,
      userName: row.user_name,
      opinion: row.opinion,
      recommendation: row.recommendation,
      confidenceLevel: row.confidence_level,
      createdAt: row.created_at,
    }));
  }

  // ==========================================
  // STAKEHOLDERS (RACI)
  // ==========================================

  /**
   * Add stakeholder to decision
   */
  static async addStakeholder(
    decisionId: string,
    userId: string,
    role: StakeholderRole,
    addedBy: string
  ): Promise<Stakeholder> {
    const id = uuidv4();
    const nowIso = new Date().toISOString();

    // Get decision and user info
    const decision = await queryHelpers.queryOne<{ organization_id: string }>(
      `SELECT organization_id FROM decisions WHERE id = ?`,
      [decisionId]
    );

    const user = await queryHelpers.queryOne<{ first_name: string; last_name: string }>(
      `SELECT first_name, last_name FROM users WHERE id = ?`,
      [userId]
    );

    // Check if already exists
    const existing = await queryHelpers.queryOne(
      `SELECT id FROM decision_stakeholders WHERE decision_id = ? AND user_id = ?`,
      [decisionId, userId]
    );

    if (existing) {
      // Update role
      await queryHelpers.queryRun(
        `UPDATE decision_stakeholders SET role = ?, created_at = ? WHERE decision_id = ? AND user_id = ?`,
        [role, nowIso, decisionId, userId]
      );
      return this.getStakeholder(decisionId, userId) as Promise<Stakeholder>;
    }

    await queryHelpers.queryRun(
      `INSERT INTO decision_stakeholders (
        id, decision_id, organization_id, user_id, user_name, role,
        notify_on_create, notify_on_update, notify_on_decision, notify_on_escalation,
        created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1, 1, ?, ?)`,
      [
        id,
        decisionId,
        decision?.organization_id || null,
        userId,
        user ? `${user.first_name} ${user.last_name}` : null,
        role,
        nowIso,
        addedBy,
      ]
    );

    return this.getStakeholder(decisionId, userId) as Promise<Stakeholder>;
  }

  /**
   * Get stakeholder
   */
  static async getStakeholder(decisionId: string, userId: string): Promise<Stakeholder | null> {
    const row = await queryHelpers.queryOne<any>(
      `SELECT * FROM decision_stakeholders WHERE decision_id = ? AND user_id = ?`,
      [decisionId, userId]
    );

    if (!row) return null;

    return this.mapStakeholder(row);
  }

  /**
   * Get all stakeholders for a decision
   */
  static async getStakeholders(decisionId: string): Promise<Stakeholder[]> {
    const rows = await queryHelpers.queryAll<any>(
      `SELECT * FROM decision_stakeholders WHERE decision_id = ? ORDER BY role, created_at`,
      [decisionId]
    );

    return (rows || []).map(this.mapStakeholder);
  }

  /**
   * Remove stakeholder
   */
  static async removeStakeholder(decisionId: string, userId: string): Promise<void> {
    await queryHelpers.queryRun(
      `DELETE FROM decision_stakeholders WHERE decision_id = ? AND user_id = ?`,
      [decisionId, userId]
    );
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  /**
   * Notify about new delegation
   */
  private static async notifyDelegation(
    delegationId: string,
    decisionTitle: string,
    delegationType: DelegationType
  ): Promise<void> {
    const delegation = await this.getDelegation(delegationId);
    if (!delegation) return;

    const typeLabels: Record<DelegationType, string> = {
      full: 'Decision Delegated to You',
      review: 'Review Requested',
      input: 'Your Input Requested',
      co_decide: 'Co-Decision Required',
    };

    const typeMessages: Record<DelegationType, string> = {
      full: `You have been assigned as the new decider for "${decisionTitle}"`,
      review: `Please review the decision "${decisionTitle}" before it's made`,
      input: `Your input is requested on "${decisionTitle}"`,
      co_decide: `Your approval is required for "${decisionTitle}"`,
    };

    try {
      await notificationService.send({
        userId: delegation.toUserId,
        organizationId: delegation.organizationId,
        type: `decision_${delegationType}`,
        title: typeLabels[delegationType],
        body: delegation.comment || typeMessages[delegationType],
        entityType: 'decision',
        entityId: delegation.decisionId,
        actionUrl: `/my-work?decision=${delegation.decisionId}`,
        priority: delegationType === 'full' || delegationType === 'co_decide' ? 'high' : 'normal',
      });
    } catch (err: any) {
      logger.warn(`[DecisionDelegationService] Failed to send delegation notification:`, err.message);
    }
  }

  /**
   * Notify about delegation response
   */
  private static async notifyDelegationResponse(
    delegationId: string,
    response: 'accepted' | 'rejected'
  ): Promise<void> {
    const delegation = await this.getDelegation(delegationId);
    if (!delegation) return;

    try {
      await notificationService.send({
        userId: delegation.fromUserId,
        organizationId: delegation.organizationId,
        type: `delegation_${response}`,
        title: response === 'accepted' ? 'Delegation Accepted' : 'Delegation Rejected',
        body: response === 'accepted'
          ? `${delegation.toUserName || 'User'} accepted your delegation request for "${delegation.decisionTitle}"`
          : `${delegation.toUserName || 'User'} rejected your delegation request for "${delegation.decisionTitle}"${delegation.rejectionReason ? `: ${delegation.rejectionReason}` : ''}`,
        entityType: 'decision',
        entityId: delegation.decisionId,
        actionUrl: `/my-work?decision=${delegation.decisionId}`,
        priority: response === 'rejected' ? 'high' : 'normal',
      });
    } catch (err: any) {
      logger.warn(`[DecisionDelegationService] Failed to send response notification:`, err.message);
    }
  }

  /**
   * Notify that input was received
   */
  private static async notifyInputReceived(delegation: Delegation, opinion: string): Promise<void> {
    try {
      await notificationService.send({
        userId: delegation.fromUserId,
        organizationId: delegation.organizationId,
        type: 'decision_input_received',
        title: 'Input Received',
        body: `${delegation.toUserName || 'User'} provided input on "${delegation.decisionTitle}"`,
        entityType: 'decision',
        entityId: delegation.decisionId,
        actionUrl: `/my-work?decision=${delegation.decisionId}`,
        priority: 'normal',
      });
    } catch (err: any) {
      logger.warn(`[DecisionDelegationService] Failed to send input received notification:`, err.message);
    }
  }

  // ==========================================
  // MAPPERS
  // ==========================================

  private static mapDelegation(row: any): Delegation {
    return {
      id: row.id,
      decisionId: row.decision_id,
      organizationId: row.organization_id,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      delegationType: row.delegation_type,
      reason: row.reason,
      comment: row.comment,
      status: row.status,
      responseComment: row.response_comment,
      acceptedAt: row.accepted_at,
      rejectedAt: row.rejected_at,
      rejectionReason: row.rejection_reason,
      completedAt: row.completed_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      fromUserName: row.from_user_name,
      toUserName: row.to_user_name,
      decisionTitle: row.decision_title,
    };
  }

  private static mapStakeholder(row: any): Stakeholder {
    return {
      id: row.id,
      decisionId: row.decision_id,
      userId: row.user_id,
      userName: row.user_name,
      role: row.role,
      notifyOnCreate: !!row.notify_on_create,
      notifyOnUpdate: !!row.notify_on_update,
      notifyOnDecision: !!row.notify_on_decision,
      notifyOnEscalation: !!row.notify_on_escalation,
      notifiedAt: row.notified_at,
      acknowledgedAt: row.acknowledged_at,
    };
  }
}

export default DecisionDelegationService;
