/**
 * Realtime Platform Service
 *
 * V4-ENT-06: WebSocket gateway, presence, CRDT store
 * V4-IDEA-03: CRDT (Yjs/Automerge) for mindmap/whiteboard/process flow
 * V4-TOOL-04: Facilitation layer (timer, voting, roles, outcomes)
 * V4-TOOL-05: Realtime presence + multi-user editing for tool sessions
 */

import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';

// ============================================================
// Service
// ============================================================

class RealtimePlatformService {
  // ── V4-ENT-06: Channels & Presence ──

  async createChannel(
    orgId: string,
    data: {
      channelType: string;
      resourceType: string;
      resourceId: string;
    }
  ) {
    const id = uuidv4();
    const result = await queryHelpers.queryRun(
      `INSERT INTO realtime_channels (id, organization_id, channel_type, resource_type, resource_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organization_id, resource_type, resource_id) DO NOTHING`,
      [id, orgId, data.channelType, data.resourceType, data.resourceId]
    );
    if (result.changes > 0) return { id };
    const existing = await this.getChannel(orgId, data.resourceType, data.resourceId);
    return { id: (existing as any)?.id ?? id };
  }

  async getChannel(orgId: string, resourceType: string, resourceId: string) {
    return queryHelpers.queryFirst(
      `SELECT * FROM realtime_channels WHERE organization_id=$1 AND resource_type=$2 AND resource_id=$3`,
      [orgId, resourceType, resourceId]
    );
  }

  async listChannels(orgId: string, resourceType?: string) {
    const sql = resourceType
      ? `SELECT * FROM realtime_channels WHERE organization_id=$1 AND resource_type=$2 ORDER BY created_at DESC`
      : `SELECT * FROM realtime_channels WHERE organization_id=$1 ORDER BY created_at DESC`;
    const params = resourceType ? [orgId, resourceType] : [orgId];
    return queryHelpers.queryAll(sql, params);
  }

  async deleteChannel(orgId: string, channelId: string) {
    await queryHelpers.queryRun(
      `DELETE FROM realtime_channels WHERE id=$1 AND organization_id=$2`,
      [channelId, orgId]
    );
    return { deleted: true };
  }

  async upsertPresence(
    channelId: string,
    data: {
      userId: string;
      userName?: string;
      userColor?: string;
      cursorState?: object;
      activeElement?: string;
    }
  ) {
    const cursorJson = data.cursorState ? JSON.stringify(data.cursorState) : '{}';
    const existing = await queryHelpers.queryFirst<{ id: string }>(
      `SELECT id FROM realtime_presence
       WHERE channel_id=$1 AND user_id=$2 AND is_connected=1
       ORDER BY connected_at DESC LIMIT 1`,
      [channelId, data.userId]
    );
    if (existing?.id) {
      await queryHelpers.queryRun(
        `UPDATE realtime_presence
         SET user_name=$1, user_color=$2, cursor_state=$3, active_element=$4,
             last_heartbeat_at=CURRENT_TIMESTAMP
         WHERE id=$5`,
        [
          data.userName ?? null,
          data.userColor ?? null,
          cursorJson,
          data.activeElement ?? null,
          existing.id,
        ]
      );
      return { id: existing.id, reused: true };
    }

    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO realtime_presence (id, channel_id, user_id, user_name, user_color, cursor_state, active_element, is_connected, last_heartbeat_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1,CURRENT_TIMESTAMP)`,
      [
        id,
        channelId,
        data.userId,
        data.userName ?? null,
        data.userColor ?? null,
        cursorJson,
        data.activeElement ?? null,
      ]
    );
    return { id, reused: false };
  }

  async heartbeatPresence(channelId: string, userId: string) {
    await queryHelpers.queryRun(
      `UPDATE realtime_presence SET last_heartbeat_at=CURRENT_TIMESTAMP WHERE channel_id=$1 AND user_id=$2 AND is_connected=1`,
      [channelId, userId]
    );
    return { ok: true };
  }

  async disconnectPresence(channelId: string, userId: string) {
    await queryHelpers.queryRun(
      `UPDATE realtime_presence SET is_connected=0, disconnected_at=CURRENT_TIMESTAMP WHERE channel_id=$1 AND user_id=$2 AND is_connected=1`,
      [channelId, userId]
    );
    return { ok: true };
  }

  async listPresence(channelId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM realtime_presence WHERE channel_id=$1 AND is_connected=1 AND last_heartbeat_at > NOW() - INTERVAL '30 seconds' ORDER BY connected_at`,
      [channelId]
    );
  }

  async cleanStalePresence(staleMinutes: number = 5) {
    await queryHelpers.queryRun(
      `UPDATE realtime_presence SET is_connected=0, disconnected_at=CURRENT_TIMESTAMP
       WHERE is_connected=1 AND last_heartbeat_at < NOW() - ($1 * INTERVAL '1 minute')`,
      [staleMinutes]
    );
    return { ok: true };
  }

  // ── V4-IDEA-03: CRDT Documents ──

  async createCrdtDocument(
    orgId: string,
    data: {
      resourceType: string;
      resourceId: string;
      crdtType?: string;
    }
  ) {
    const id = uuidv4();
    const result = await queryHelpers.queryRun(
      `INSERT INTO crdt_documents (id, organization_id, resource_type, resource_id, crdt_type)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organization_id, resource_type, resource_id) DO NOTHING`,
      [id, orgId, data.resourceType, data.resourceId, data.crdtType ?? 'yjs']
    );
    if (result.changes > 0) return { id };
    const existing = await this.getCrdtDocument(orgId, data.resourceType, data.resourceId);
    return { id: (existing as any)?.id ?? id };
  }

  async getCrdtDocument(orgId: string, resourceType: string, resourceId: string) {
    return queryHelpers.queryFirst(
      `SELECT * FROM crdt_documents WHERE organization_id=$1 AND resource_type=$2 AND resource_id=$3`,
      [orgId, resourceType, resourceId]
    );
  }

  async saveCrdtSnapshot(
    docId: string,
    data: {
      stateVector: string;
      snapshotData: string;
      userId: string;
    }
  ) {
    await queryHelpers.queryRun(
      `UPDATE crdt_documents SET state_vector=$1, snapshot_data=$2, version=version+1,
       last_updated_by=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4`,
      [data.stateVector, data.snapshotData, data.userId, docId]
    );
    return { ok: true };
  }

  async appendCrdtUpdate(
    docId: string,
    data: {
      updateData: string;
      originUserId: string;
      originClientId?: string;
    }
  ) {
    const id = uuidv4();
    const seqRow = await queryHelpers.queryFirst<{ next_seq: number }>(
      `SELECT COALESCE(MAX(sequence_number),0)+1 as next_seq FROM crdt_updates WHERE document_id=$1`,
      [docId]
    );
    const seq = seqRow?.next_seq ?? 1;
    await queryHelpers.queryRun(
      `INSERT INTO crdt_updates (id, document_id, update_data, origin_user_id, origin_client_id, sequence_number)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, docId, data.updateData, data.originUserId, data.originClientId ?? null, seq]
    );
    return { id, sequenceNumber: seq };
  }

  async getCrdtUpdates(docId: string, afterSequence: number = 0) {
    return queryHelpers.queryAll(
      `SELECT * FROM crdt_updates WHERE document_id=$1 AND sequence_number>$2 ORDER BY sequence_number`,
      [docId, afterSequence]
    );
  }

  async deleteCrdtDocument(orgId: string, docId: string) {
    await queryHelpers.queryRun(`DELETE FROM crdt_documents WHERE id=$1 AND organization_id=$2`, [
      docId,
      orgId,
    ]);
    return { deleted: true };
  }

  // ── V4-TOOL-04: Facilitation Layer ──

  async createFacilitationSession(
    orgId: string,
    data: {
      toolSessionId: string;
      facilitatorId: string;
      settings?: object;
    }
  ) {
    // M09 L-04: facilitation sessions are SHARED per (org, tool_session_id) so a 2nd
    // participant joining the same board resolves to the SAME session (shared timer,
    // phase, voting, roles) instead of spawning a private one. The first creator stays
    // the facilitator (facilitator_id); later joiners reuse the row and become
    // participants. Idempotent: return the existing active session if present.
    const existing = await queryHelpers.queryFirst<{ id: string }>(
      `SELECT id FROM tool_facilitation_sessions
        WHERE organization_id=$1 AND tool_session_id=$2 AND status <> 'ended'
        ORDER BY created_at ASC LIMIT 1`,
      [orgId, data.toolSessionId]
    );
    if (existing?.id) return { id: existing.id };

    const id = uuidv4();
    const settingsJson = data.settings ? JSON.stringify(data.settings) : '{}';
    await queryHelpers.queryRun(
      `INSERT INTO tool_facilitation_sessions (id, organization_id, tool_session_id, facilitator_id, settings)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, orgId, data.toolSessionId, data.facilitatorId, settingsJson]
    );
    return { id };
  }

  async getFacilitationSession(orgId: string, sessionId: string) {
    return queryHelpers.queryFirst(
      `SELECT * FROM tool_facilitation_sessions WHERE id=$1 AND organization_id=$2`,
      [sessionId, orgId]
    );
  }

  // B1 (M09): read-only lookup of the ACTIVE shared session for a (org, tool_session_id),
  // WITHOUT creating one. Lets a client resolve its facilitation role on board-open to
  // enforce observer read-only, while keeping facilitation lazy (no row is spawned just
  // by opening the board). Returns null when no active session exists.
  async getActiveFacilitationSessionByTool(orgId: string, toolSessionId: string) {
    return queryHelpers.queryFirst(
      `SELECT * FROM tool_facilitation_sessions
        WHERE organization_id=$1 AND tool_session_id=$2 AND status <> 'ended'
        ORDER BY created_at ASC LIMIT 1`,
      [orgId, toolSessionId]
    );
  }

  async updateTimerState(sessionId: string, timerState: object) {
    await queryHelpers.queryRun(
      `UPDATE tool_facilitation_sessions SET timer_state=$1 WHERE id=$2`,
      [JSON.stringify(timerState), sessionId]
    );
    return { ok: true };
  }

  async updatePhase(sessionId: string, phase: string) {
    await queryHelpers.queryRun(
      `UPDATE tool_facilitation_sessions SET current_phase=$1 WHERE id=$2`,
      [phase, sessionId]
    );
    return { ok: true };
  }

  async endFacilitationSession(sessionId: string) {
    await queryHelpers.queryRun(
      `UPDATE tool_facilitation_sessions SET status='ended', ended_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [sessionId]
    );
    return { ok: true };
  }

  async castVote(
    sessionId: string,
    data: {
      voterId: string;
      voterName?: string;
      voteTargetId: string;
      voteType?: string;
      voteValue?: number;
      comment?: string;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO tool_facilitation_votes (id, facilitation_session_id, voter_id, voter_name, vote_target_id, vote_type, vote_value, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (facilitation_session_id, voter_id, vote_target_id, vote_type)
       DO UPDATE SET vote_value=$7, comment=$8`,
      [
        id,
        sessionId,
        data.voterId,
        data.voterName ?? null,
        data.voteTargetId,
        data.voteType ?? 'upvote',
        data.voteValue ?? 1,
        data.comment ?? null,
      ]
    );
    return { id };
  }

  async getVotes(orgId: string, sessionId: string, targetId?: string) {
    // Defense-in-depth: only return votes for a session owned by this org.
    const sql = targetId
      ? `SELECT * FROM tool_facilitation_votes
         WHERE facilitation_session_id=$1 AND vote_target_id=$2
           AND facilitation_session_id IN (SELECT id FROM tool_facilitation_sessions WHERE id=$1 AND organization_id=$3)
         ORDER BY created_at`
      : `SELECT * FROM tool_facilitation_votes
         WHERE facilitation_session_id=$1
           AND facilitation_session_id IN (SELECT id FROM tool_facilitation_sessions WHERE id=$1 AND organization_id=$2)
         ORDER BY created_at`;
    const params = targetId ? [sessionId, targetId, orgId] : [sessionId, orgId];
    return queryHelpers.queryAll(sql, params);
  }

  async getVoteSummary(orgId: string, sessionId: string) {
    // Defense-in-depth: only summarize votes for a session owned by this org.
    return queryHelpers.queryAll(
      `SELECT vote_target_id, vote_type, COUNT(*) as count, SUM(vote_value) as total
       FROM tool_facilitation_votes WHERE facilitation_session_id=$1
         AND facilitation_session_id IN (SELECT id FROM tool_facilitation_sessions WHERE id=$1 AND organization_id=$2)
       GROUP BY vote_target_id, vote_type ORDER BY total DESC`,
      [sessionId, orgId]
    );
  }

  async assignRole(
    sessionId: string,
    data: {
      userId: string;
      roleName: string;
      permissions?: string[];
    }
  ) {
    const id = uuidv4();
    const permsJson = data.permissions ? JSON.stringify(data.permissions) : '[]';
    await queryHelpers.queryRun(
      `INSERT INTO tool_facilitation_roles (id, facilitation_session_id, user_id, role_name, permissions)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (facilitation_session_id, user_id)
       DO UPDATE SET role_name=$4, permissions=$5`,
      [id, sessionId, data.userId, data.roleName, permsJson]
    );
    return { id };
  }

  async getRoles(orgId: string, sessionId: string) {
    // Defense-in-depth: only return roles for a session owned by this org.
    return queryHelpers.queryAll(
      `SELECT * FROM tool_facilitation_roles WHERE facilitation_session_id=$1
         AND facilitation_session_id IN (SELECT id FROM tool_facilitation_sessions WHERE id=$1 AND organization_id=$2)
       ORDER BY assigned_at`,
      [sessionId, orgId]
    );
  }

  async createOutcome(
    sessionId: string,
    data: {
      outcomeType?: string;
      title: string;
      description?: string;
      voteSummary?: object;
      exportedToType?: string;
      exportedToId?: string;
    }
  ) {
    const id = uuidv4();
    const summaryJson = data.voteSummary ? JSON.stringify(data.voteSummary) : '{}';
    await queryHelpers.queryRun(
      `INSERT INTO tool_facilitation_outcomes (id, facilitation_session_id, outcome_type, title, description, vote_summary, exported_to_type, exported_to_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        sessionId,
        data.outcomeType ?? 'decision',
        data.title,
        data.description ?? null,
        summaryJson,
        data.exportedToType ?? null,
        data.exportedToId ?? null,
      ]
    );
    return { id };
  }

  async getOutcomes(orgId: string, sessionId: string) {
    // Defense-in-depth: only return outcomes for a session owned by this org.
    return queryHelpers.queryAll(
      `SELECT * FROM tool_facilitation_outcomes WHERE facilitation_session_id=$1
         AND facilitation_session_id IN (SELECT id FROM tool_facilitation_sessions WHERE id=$1 AND organization_id=$2)
       ORDER BY created_at`,
      [sessionId, orgId]
    );
  }

  async getOutcomeWithSession(orgId: string, outcomeId: string) {
    return queryHelpers.queryFirst(
      `SELECT o.id FROM tool_facilitation_outcomes o
       JOIN tool_facilitation_sessions s ON s.id = o.facilitation_session_id
       WHERE o.id=$1 AND s.organization_id=$2`,
      [outcomeId, orgId]
    );
  }

  async exportOutcome(outcomeId: string, exportType: string, exportId: string) {
    await queryHelpers.queryRun(
      `UPDATE tool_facilitation_outcomes SET exported_to_type=$1, exported_to_id=$2 WHERE id=$3`,
      [exportType, exportId, outcomeId]
    );
    return { ok: true };
  }

  // ── V4-TOOL-05: Tool Session Presence & Editing ──

  async upsertToolPresence(
    orgId: string,
    data: {
      toolSessionId: string;
      userId: string;
      userName?: string;
      userColor?: string;
      cursorState?: object;
      activeBlockId?: string;
      editingField?: string;
    }
  ) {
    const cursorJson = data.cursorState ? JSON.stringify(data.cursorState) : '{}';
    const existing = await queryHelpers.queryFirst<{ id: string }>(
      `SELECT id FROM tool_session_presence
       WHERE organization_id=$1 AND tool_session_id=$2 AND user_id=$3 AND is_connected=1
       ORDER BY connected_at DESC LIMIT 1`,
      [orgId, data.toolSessionId, data.userId]
    );
    if (existing?.id) {
      await queryHelpers.queryRun(
        `UPDATE tool_session_presence
         SET user_name=$1, user_color=$2, cursor_state=$3, active_block_id=$4, editing_field=$5,
             last_heartbeat_at=CURRENT_TIMESTAMP
         WHERE id=$6`,
        [
          data.userName ?? null,
          data.userColor ?? null,
          cursorJson,
          data.activeBlockId ?? null,
          data.editingField ?? null,
          existing.id,
        ]
      );
      return { id: existing.id, reused: true };
    }

    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO tool_session_presence (id, organization_id, tool_session_id, user_id, user_name, user_color, cursor_state, active_block_id, editing_field, is_connected, last_heartbeat_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,CURRENT_TIMESTAMP)`,
      [
        id,
        orgId,
        data.toolSessionId,
        data.userId,
        data.userName ?? null,
        data.userColor ?? null,
        cursorJson,
        data.activeBlockId ?? null,
        data.editingField ?? null,
      ]
    );
    return { id, reused: false };
  }

  async heartbeatToolPresence(
    orgId: string,
    toolSessionId: string,
    userId: string,
    cursorState?: object
  ) {
    const cursorJson = cursorState ? JSON.stringify(cursorState) : undefined;
    const sql = cursorJson
      ? `UPDATE tool_session_presence SET last_heartbeat_at=CURRENT_TIMESTAMP, cursor_state=$1 WHERE organization_id=$2 AND tool_session_id=$3 AND user_id=$4 AND is_connected=1`
      : `UPDATE tool_session_presence SET last_heartbeat_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND tool_session_id=$2 AND user_id=$3 AND is_connected=1`;
    const params = cursorJson
      ? [cursorJson, orgId, toolSessionId, userId]
      : [orgId, toolSessionId, userId];
    await queryHelpers.queryRun(sql, params);
    return { ok: true };
  }

  async disconnectToolPresence(orgId: string, toolSessionId: string, userId: string) {
    await queryHelpers.queryRun(
      `UPDATE tool_session_presence SET is_connected=0, disconnected_at=CURRENT_TIMESTAMP
       WHERE organization_id=$1 AND tool_session_id=$2 AND user_id=$3 AND is_connected=1`,
      [orgId, toolSessionId, userId]
    );
    return { ok: true };
  }

  async listToolPresence(orgId: string, toolSessionId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM tool_session_presence WHERE organization_id=$1 AND tool_session_id=$2 AND is_connected=1 AND last_heartbeat_at > NOW() - INTERVAL '30 seconds' ORDER BY connected_at`,
      [orgId, toolSessionId]
    );
  }

  async acquireEditLock(
    orgId: string,
    data: {
      toolSessionId: string;
      blockId: string;
      lockedBy: string;
      ttlMinutes?: number;
    }
  ) {
    const id = uuidv4();
    const ttl = data.ttlMinutes ?? 5;
    await queryHelpers.queryRun(
      `DELETE FROM tool_session_edit_locks
       WHERE organization_id=$1 AND tool_session_id=$2 AND block_id=$3
         AND expires_at < CURRENT_TIMESTAMP`,
      [orgId, data.toolSessionId, data.blockId]
    );
    try {
      await queryHelpers.queryRun(
        `INSERT INTO tool_session_edit_locks (id, organization_id, tool_session_id, block_id, locked_by, expires_at)
         VALUES ($1,$2,$3,$4,$5, NOW() + ($6 * INTERVAL '1 minute'))`,
        [id, orgId, data.toolSessionId, data.blockId, data.lockedBy, ttl]
      );
      return { id, acquired: true };
    } catch {
      const existing = await queryHelpers.queryFirst<{ locked_by: string }>(
        `SELECT locked_by FROM tool_session_edit_locks WHERE organization_id=$1 AND tool_session_id=$2 AND block_id=$3`,
        [orgId, data.toolSessionId, data.blockId]
      );
      return { acquired: false, lockedBy: existing?.locked_by };
    }
  }

  async releaseEditLock(orgId: string, toolSessionId: string, blockId: string, userId: string) {
    await queryHelpers.queryRun(
      `DELETE FROM tool_session_edit_locks WHERE organization_id=$1 AND tool_session_id=$2 AND block_id=$3 AND locked_by=$4`,
      [orgId, toolSessionId, blockId, userId]
    );
    return { released: true };
  }

  async listEditLocks(orgId: string, toolSessionId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM tool_session_edit_locks WHERE organization_id=$1 AND tool_session_id=$2 ORDER BY locked_at`,
      [orgId, toolSessionId]
    );
  }
}

export const realtimePlatformService = new RealtimePlatformService();
export default realtimePlatformService;
