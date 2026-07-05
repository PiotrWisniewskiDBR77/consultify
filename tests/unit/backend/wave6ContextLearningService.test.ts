import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  snapshots: new Map<string, Row>(),
  ledger: new Map<string, Row>(),
  candidates: new Map<string, Row>(),
  decisions: [] as Row[],
  memories: new Map<string, Row>(),
  uuidCounter: 0,
}));

function nextUuid() {
  db.uuidCounter += 1;
  return `wave6-id-${db.uuidCounter}`;
}

vi.mock('uuid', () => ({
  v4: () => nextUuid(),
}));

vi.mock('../../../server/src/services/ai/userPrivacyService.js', () => ({
  getUserPrivacySettings: vi.fn().mockResolvedValue({
    memoryEnabled: true,
    memoryWriteEnabled: true,
    privateModeDefault: false,
    retentionMode: 'session',
  }),
  canWriteMemory: vi.fn((_settings, isPrivateMode) => !isPrivateMode),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('CREATE INDEX')) {
      return { changes: 0 };
    }
    if (normalized.startsWith('INSERT INTO wave6_context_snapshots')) {
      const [
        snapshotId,
        organizationId,
        projectId,
        userId,
        snapshotType,
        factsJson,
        sourceRefsJson,
        permissionsJson,
        freshnessAt,
        privateMode,
        expiresAt,
      ] = params;
      db.snapshots.set(snapshotId, {
        snapshot_id: snapshotId,
        organization_id: organizationId,
        project_id: projectId,
        user_id: userId,
        snapshot_type: snapshotType,
        facts_json: factsJson,
        source_refs_json: sourceRefsJson,
        permissions_json: permissionsJson,
        freshness_at: freshnessAt,
        private_mode: privateMode,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave6_context_ledger')) {
      const [
        ledgerId,
        organizationId,
        projectId,
        userId,
        sourceType,
        sourceId,
        sourceTitle,
        sourceUrl,
        freshnessAt,
        permissionScope,
      ] = params;
      db.ledger.set(ledgerId, {
        ledger_id: ledgerId,
        organization_id: organizationId,
        project_id: projectId,
        user_id: userId,
        source_type: sourceType,
        source_id: sourceId,
        source_title: sourceTitle,
        source_url: sourceUrl,
        freshness_at: freshnessAt,
        permission_scope: permissionScope,
        forgotten_at: null,
        created_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave6_memory_candidates')) {
      const [
        candidateId,
        organizationId,
        projectId,
        userId,
        assistantScope,
        memoryScope,
        key,
        value,
        sourceLabel,
        sourceRefsJson,
        retentionUntil,
      ] = params;
      db.candidates.set(candidateId, {
        candidate_id: candidateId,
        organization_id: organizationId,
        project_id: projectId,
        user_id: userId,
        assistant_scope: assistantScope,
        memory_scope: memoryScope,
        status: 'candidate',
        memory_key: key,
        memory_value: value,
        source_label: sourceLabel,
        source_refs_json: sourceRefsJson,
        consent_required: 1,
        private_mode: 0,
        retention_until: retentionUntil,
        decision_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('UPDATE wave6_memory_candidates')) {
      const [status, reason, candidateId] = params;
      Object.assign(db.candidates.get(candidateId), {
        status,
        decision_reason: reason,
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave6_memory_stewardship_decisions')) {
      const [decisionId, candidateId, organizationId, actorUserId, decision, reason] = params;
      db.decisions.push({
        decision_id: decisionId,
        candidate_id: candidateId,
        organization_id: organizationId,
        actor_user_id: actorUserId,
        decision,
        reason,
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO ai_user_memory')) {
      const [id, userId, organizationId, key, value, context] = params;
      db.memories.set(`${userId}:${key}`, {
        id,
        user_id: userId,
        organization_id: organizationId,
        key,
        value,
        source: 'wave6_stewardship',
        confidence: 1,
        context,
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('UPDATE wave6_context_ledger')) {
      const [ledgerId] = params;
      Object.assign(db.ledger.get(ledgerId), { forgotten_at: new Date().toISOString() });
      return { changes: 1 };
    }
    throw new Error(`Unhandled dbRun SQL: ${normalized}`);
  },
  get: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM wave6_context_snapshots')) return db.snapshots.get(params[0]) || null;
    if (normalized.includes('FROM wave6_context_ledger')) return db.ledger.get(params[0]) || null;
    if (normalized.includes('FROM wave6_memory_candidates')) {
      const row = db.candidates.get(params[0]) || null;
      if (params[1] && row?.organization_id !== params[1]) return null;
      return row;
    }
    throw new Error(`Unhandled dbGet SQL: ${normalized}`);
  },
  all: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const [organizationId, userId] = params;
    const hasProjectScope = normalized.includes('project_id IS NULL OR project_id = ?');
    const hasAssistantScope = normalized.includes('assistant_scope = ?');
    const projectId = hasProjectScope ? params[2] : null;
    const assistantScope = hasAssistantScope ? params[hasProjectScope ? 3 : 2] : null;
    const isUnexpired = (row: Row) => {
      if (!row.retention_until) return true;
      return Date.parse(String(row.retention_until)) > Date.now();
    };
    const matchesScopedUserRows = (row: Row) =>
      row.organization_id === organizationId &&
      row.user_id === userId &&
      (projectId ? row.project_id == null || row.project_id === projectId : row.project_id == null) &&
      (!assistantScope || row.assistant_scope === assistantScope);
    if (normalized.includes('FROM wave6_context_snapshots')) {
      const projectUserId = params[2];
      const snapshotProjectId = params[3];
      return Array.from(db.snapshots.values()).filter((row) => {
        if (row.organization_id !== organizationId) return false;
        if (row.snapshot_type === 'org' && row.project_id == null) return true;
        if (row.user_id === userId && row.snapshot_type === 'user' && row.project_id == null) {
          return true;
        }
        return (
          snapshotProjectId &&
          row.user_id === projectUserId &&
          row.snapshot_type === 'project' &&
          row.project_id === snapshotProjectId
        );
      });
    }
    if (normalized.includes('FROM wave6_context_ledger')) {
      return Array.from(db.ledger.values()).filter(
        (row) => matchesScopedUserRows(row) && !row.forgotten_at
      );
    }
    if (normalized.includes('FROM wave6_memory_candidates')) {
      return Array.from(db.candidates.values()).filter(
        (row) => matchesScopedUserRows(row) && isUnexpired(row)
      );
    }
    throw new Error(`Unhandled dbAll SQL: ${normalized}`);
  },
}));

describe('Wave 6 context and controlled learning runtime', () => {
  beforeEach(() => {
    db.snapshots.clear();
    db.ledger.clear();
    db.candidates.clear();
    db.decisions = [];
    db.memories.clear();
    db.uuidCounter = 0;
    vi.resetModules();
  });

  it('captures context snapshots and exposes what AI knows with project separation', async () => {
    const {
      captureWave6ContextSnapshot,
      listWave6ContextPanel,
      recordWave6ContextLedgerEntry,
      forgetWave6ContextLedgerEntry,
    } = await import('../../../server/src/services/wave6ContextLearningService.js');

    await captureWave6ContextSnapshot({
      organizationId: 'org-1',
      userId: 'admin-1',
      snapshotType: 'org',
      projectId: 'ignored-project',
      facts: { decision: 'Use org-wide governance model' },
      sourceRefs: [{ sourceTitle: 'Operating model' }],
      permissions: { scope: 'org' },
    });
    await captureWave6ContextSnapshot({
      organizationId: 'org-1',
      userId: 'user-1',
      snapshotType: 'project',
      projectId: 'project-a',
      facts: { decision: 'Use project A roadmap' },
      sourceRefs: [{ sourceTitle: 'Steering memo' }],
      permissions: { scope: 'project' },
    });
    await captureWave6ContextSnapshot({
      organizationId: 'org-1',
      userId: 'user-1',
      snapshotType: 'project',
      projectId: 'project-b',
      facts: { decision: 'Use project B roadmap' },
    });
    const ledger = await recordWave6ContextLedgerEntry({
      organizationId: 'org-1',
      userId: 'user-1',
      projectId: 'project-a',
      sourceType: 'document',
      sourceTitle: 'Project A source',
      permissionScope: 'project',
    });

    const panelA = await listWave6ContextPanel({
      organizationId: 'org-1',
      userId: 'user-1',
      projectId: 'project-a',
    });
    expect(panelA.snapshots).toHaveLength(2);
    expect(panelA.snapshots.map((snapshot: Row) => snapshot.facts.decision)).toEqual(
      expect.arrayContaining(['Use org-wide governance model', 'Use project A roadmap'])
    );
    expect(panelA.ledger[0].sourceTitle).toBe('Project A source');

    const panelWithoutProject = await listWave6ContextPanel({
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(panelWithoutProject.snapshots.map((snapshot: Row) => snapshot.facts.decision)).toEqual([
      'Use org-wide governance model',
    ]);

    await forgetWave6ContextLedgerEntry({
      organizationId: 'org-1',
      userId: 'user-1',
      ledgerId: ledger.ledgerId,
    });
    const panelAfterForget = await listWave6ContextPanel({
      organizationId: 'org-1',
      userId: 'user-1',
      projectId: 'project-a',
    });
    expect(panelAfterForget.ledger).toHaveLength(0);
  });

  it('requires stewardship before memory is retained and blocks private mode learning', async () => {
    const {
      buildWave6UserWorkProfile,
      buildWave6UserWorkProfilePrompt,
      captureWave6MemoryCandidate,
      decideWave6MemoryCandidate,
    } = await import('../../../server/src/services/wave6ContextLearningService.js');

    const blocked = await captureWave6MemoryCandidate({
      organizationId: 'org-1',
      userId: 'user-1',
      assistantScope: 'teresa_tenant',
      memoryScope: 'user',
      key: 'communication_style',
      value: 'Use concise board-ready answers',
      privateMode: true,
    });
    expect(blocked).toEqual(
      expect.objectContaining({ blocked: true, reason: 'private_mode_blocks_learning' })
    );
    expect(db.candidates.size).toBe(0);

    const created = await captureWave6MemoryCandidate({
      organizationId: 'org-1',
      userId: 'user-1',
      assistantScope: 'teresa_tenant',
      memoryScope: 'user',
      key: 'communication_style',
      value: 'Use concise board-ready answers',
    });
    expect(created.candidate.status).toBe('candidate');

    const retained = await decideWave6MemoryCandidate({
      organizationId: 'org-1',
      userId: 'user-1',
      candidateId: created.candidate.candidateId,
      decision: 'approve',
      reason: 'User approved',
    });
    expect(retained.status).toBe('retained');
    expect(db.memories.get('user-1:communication_style')?.source).toBe('wave6_stewardship');
    expect(db.decisions[0]).toEqual(expect.objectContaining({ decision: 'approve' }));

    const profile = await buildWave6UserWorkProfile({
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(profile.preferences[0]).toEqual(
      expect.objectContaining({
        key: 'communication_style',
        sourceLabel: 'user_requested_memory',
      })
    );
    expect(buildWave6UserWorkProfilePrompt(profile)).toContain('Wave 6 approved memory');
  });

  it('keeps Anna public learning separated from Teresa tenant memory', async () => {
    const {
      buildWave6UserWorkProfile,
      captureWave6MemoryCandidate,
      decideWave6MemoryCandidate,
    } = await import('../../../server/src/services/wave6ContextLearningService.js');

    const annaTenantAttempt = await captureWave6MemoryCandidate({
      organizationId: 'org-1',
      userId: 'user-1',
      assistantScope: 'anna_public',
      memoryScope: 'tenant',
      key: 'client_strategy',
      value: 'Secret tenant context',
    });
    expect(annaTenantAttempt.reason).toBe('anna_cannot_learn_tenant_or_user_data');

    const annaPublic = await captureWave6MemoryCandidate({
      organizationId: 'org-1',
      userId: 'user-1',
      assistantScope: 'anna_public',
      memoryScope: 'public_product',
      key: 'faq_hint',
      value: 'Explain product pricing neutrally',
    });
    expect(annaPublic.blocked).toBe(false);

    const retainedPublic = await decideWave6MemoryCandidate({
      organizationId: 'org-1',
      userId: 'user-1',
      candidateId: annaPublic.candidate.candidateId,
      decision: 'approve',
      reason: 'Public product learning approved',
    });
    expect(retainedPublic.status).toBe('retained');
    expect(db.memories.size).toBe(0);

    const teresaOrg = await captureWave6MemoryCandidate({
      organizationId: 'org-1',
      userId: 'user-1',
      assistantScope: 'teresa_tenant',
      memoryScope: 'org',
      key: 'governance_style',
      value: 'Use tenant governance language',
    });
    expect(teresaOrg.blocked).toBe(false);

    await decideWave6MemoryCandidate({
      organizationId: 'org-1',
      userId: 'user-1',
      candidateId: teresaOrg.candidate.candidateId,
      decision: 'approve',
      reason: 'Tenant learning approved',
    });
    const teresaProfile = await buildWave6UserWorkProfile({
      organizationId: 'org-1',
      userId: 'user-1',
      assistantScope: 'teresa_tenant',
    });
    const annaProfile = await buildWave6UserWorkProfile({
      organizationId: 'org-1',
      userId: 'user-1',
      assistantScope: 'anna_public',
    });
    expect(teresaProfile.preferences.map((memory) => memory.key)).toContain('governance_style');
    expect(annaProfile.preferences).toHaveLength(0);
  });

  it('enforces project scope, organization ACL, and retention on retained memory', async () => {
    const {
      buildWave6UserWorkProfile,
      captureWave6MemoryCandidate,
      decideWave6MemoryCandidate,
    } = await import('../../../server/src/services/wave6ContextLearningService.js');

    const missingProject = await captureWave6MemoryCandidate({
      organizationId: 'org-1',
      userId: 'user-1',
      assistantScope: 'teresa_tenant',
      memoryScope: 'project',
      key: 'project_style',
      value: 'Use project-only language',
    });
    expect(missingProject.reason).toBe('project_memory_requires_project_scope');

    const retained = await captureWave6MemoryCandidate({
      organizationId: 'org-1',
      userId: 'user-1',
      assistantScope: 'teresa_tenant',
      memoryScope: 'project',
      projectId: 'project-a',
      key: 'project_style',
      value: 'Use project-only language',
      retentionDays: 1,
    });
    expect(retained.candidate.retentionUntil).toEqual(expect.any(String));

    await expect(
      decideWave6MemoryCandidate({
        organizationId: 'org-2',
        userId: 'user-1',
        candidateId: retained.candidate.candidateId,
        decision: 'approve',
      })
    ).rejects.toThrow('Memory candidate not found');

    await decideWave6MemoryCandidate({
      organizationId: 'org-1',
      userId: 'user-1',
      candidateId: retained.candidate.candidateId,
      decision: 'approve',
    });
    db.candidates.get(retained.candidate.candidateId)!.retention_until = '2000-01-01T00:00:00.000Z';

    const expiredProfile = await buildWave6UserWorkProfile({
      organizationId: 'org-1',
      userId: 'user-1',
      projectId: 'project-a',
      assistantScope: 'teresa_tenant',
    });
    expect(expiredProfile.preferences).toHaveLength(0);
  });

  it('exposes Wave 6 API and UI contract', () => {
    const gateway = readFileSync('server/src/Gateway.ts', 'utf8');
    const routes = readFileSync('server/src/routes/wave6-context.routes.ts', 'utf8');
    const aiIndex = readFileSync('server/src/routes/ai/index.ts', 'utf8');
    const api = readFileSync('src/services/api.ts', 'utf8');
    const panel = readFileSync('src/components/AIChat/Wave6ContextLearningPanel.tsx', 'utf8');
    const chat = readFileSync('src/components/AIChat/UnifiedChatPanel.tsx', 'utf8');
    const streamHook = readFileSync('src/hooks/useAIStream.ts', 'utf8');
    const appRoutes = readFileSync('src/routes/AppRoutes.tsx', 'utf8');
    const aiRoutes = readFileSync('server/src/routes/ai.routes.ts', 'utf8');
    const migration = readFileSync(
      'server/migrations/20260425_wave6_context_learning.sql',
      'utf8'
    );
    const legacyMemoryController = readFileSync(
      'server/src/controllers/ai/AIMemoryController.ts',
      'utf8'
    );

    expect(gateway).toContain('/api/ai-context');
    expect(routes).toContain('/memory/candidates/:candidateId/decision');
    expect(routes).not.toContain('default-org');
    expect(routes).toContain('normalizeWave6AssistantScope');
    expect(aiIndex).not.toContain("router.use('/memory-v2'");
    expect(api).toContain('captureWave6MemoryCandidate');
    expect(panel).toContain('organizationSnapshot');
    expect(panel).toContain('memoryStewardshipQueue');
    expect(panel).toContain('visible in the stewardship queue');
    expect(panel).not.toContain('JSON.stringify(snapshot.facts');
    expect(streamHook).toContain("evt.type === 'memory_candidate'");
    expect(chat).toContain('Memory candidate created');
    expect(chat).not.toContain('<PendingActionsIndicator');
    expect(appRoutes).toContain('path={ROUTES.AI_OS.CONTEXT}');
    expect(aiRoutes).toContain('captureWave6ContextSnapshot');
    expect(aiRoutes).toContain('recordWave6ContextLedgerEntry');
    expect(aiRoutes).toContain('memory_candidate');
    expect(aiRoutes).toContain('buildWave6UserWorkProfilePrompt');
    expect(aiRoutes).toContain("assistantScope === 'teresa_tenant'");
    expect(migration).toContain('wave6_context_snapshots');
    expect(migration).toContain('wave6_context_ledger');
    expect(migration).toContain('wave6_memory_candidates');
    expect(migration).toContain('wave6_memory_stewardship_decisions');
    expect(legacyMemoryController).toContain('MEMORY_REQUIRES_STEWARDSHIP');
    expect(legacyMemoryController).toContain('MEMORY_WRITE_DISABLED');
    expect(legacyMemoryController).toContain('canReadMemory');
    expect(legacyMemoryController).toContain('memoryReadBlocked');
  });
});
