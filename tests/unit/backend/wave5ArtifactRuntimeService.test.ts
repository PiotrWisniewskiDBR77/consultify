import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  artifacts: new Map<string, Row>(),
  versions: [] as Row[],
  mutations: new Map<string, Row>(),
  uuidCounter: 0,
}));

function nextUuid() {
  db.uuidCounter += 1;
  return `wave5-id-${db.uuidCounter}`;
}

vi.mock('uuid', () => ({
  v4: () => nextUuid(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('CREATE INDEX')) {
      return { changes: 0 };
    }
    if (normalized.startsWith('INSERT INTO wave5_artifacts')) {
      const [
        artifactId,
        organizationId,
        artifactType,
        title,
        content,
        projectId,
        conversationId,
        researchSessionId,
        aiRunId,
        trustBundleId,
        citationsJson,
        sourceRefsJson,
        provenanceJson,
        createdBy,
      ] = params;
      db.artifacts.set(artifactId, {
        artifact_id: artifactId,
        organization_id: organizationId,
        artifact_type: artifactType,
        status: 'draft',
        title,
        content,
        current_version: 1,
        project_id: projectId,
        conversation_id: conversationId,
        research_session_id: researchSessionId,
        ai_run_id: aiRunId,
        trust_bundle_id: trustBundleId,
        citations_json: citationsJson,
        source_refs_json: sourceRefsJson,
        provenance_json: provenanceJson,
        created_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        committed_at: null,
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave5_artifact_versions')) {
      const [versionId, artifactId, organizationId, versionOrContent, contentOrProvenance, mutationIdOrCreatedBy, provenanceJson, createdBy] =
        params;
      const hasMutation = params.length === 8;
      db.versions.push({
        version_id: versionId,
        artifact_id: artifactId,
        organization_id: organizationId,
        version: hasMutation ? versionOrContent : 1,
        content: hasMutation ? contentOrProvenance : versionOrContent,
        mutation_id: hasMutation ? mutationIdOrCreatedBy : null,
        provenance_json: hasMutation ? provenanceJson : contentOrProvenance,
        created_by: hasMutation ? createdBy : mutationIdOrCreatedBy,
        created_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave5_mutation_proposals')) {
      const [
        mutationId,
        artifactId,
        organizationId,
        mutationType,
        summary,
        beforeContent,
        proposedContent,
        diffJson,
        metadataJson,
        createdBy,
      ] = params;
      db.mutations.set(mutationId, {
        mutation_id: mutationId,
        artifact_id: artifactId,
        organization_id: organizationId,
        status: 'proposed',
        mutation_type: mutationType,
        summary,
        before_content: beforeContent,
        proposed_content: proposedContent,
        diff_json: diffJson,
        metadata_json: metadataJson,
        created_by: createdBy,
        reviewed_by: null,
        created_at: new Date().toISOString(),
        reviewed_at: null,
        committed_at: null,
      });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'proposed'")) {
      const [artifactId] = params;
      Object.assign(db.artifacts.get(artifactId), { status: 'proposed' });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'approved'")) {
      if (normalized.includes('wave5_mutation_proposals')) {
        const [reviewedBy, mutationId] = params;
        Object.assign(db.mutations.get(mutationId), {
          status: 'approved',
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
        });
      } else {
        const [artifactId] = params;
        Object.assign(db.artifacts.get(artifactId), { status: 'approved' });
      }
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'rejected'")) {
      const [reviewedBy, mutationId] = params;
      Object.assign(db.mutations.get(mutationId), {
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'draft'")) {
      const [artifactId] = params;
      Object.assign(db.artifacts.get(artifactId), { status: 'draft' });
      return { changes: 1 };
    }
    if (normalized.includes('SET content = ?')) {
      const [content, version, provenanceJson, artifactId] = params;
      Object.assign(db.artifacts.get(artifactId), {
        content,
        current_version: version,
        status: 'committed',
        provenance_json: provenanceJson,
        committed_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'committed'")) {
      const [reviewedBy, mutationId] = params;
      Object.assign(db.mutations.get(mutationId), {
        status: 'committed',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        committed_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.includes("SET status = 'exported'")) {
      const [artifactId] = params;
      Object.assign(db.artifacts.get(artifactId), { status: 'exported' });
      return { changes: 1 };
    }
    throw new Error(`Unhandled dbRun SQL: ${normalized}`);
  },
  get: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM wave5_artifacts')) {
      return db.artifacts.get(params[0]) || null;
    }
    if (normalized.includes('FROM wave5_mutation_proposals')) {
      return db.mutations.get(params[0]) || null;
    }
    throw new Error(`Unhandled dbGet SQL: ${normalized}`);
  },
  all: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM wave5_artifact_versions')) {
      return db.versions.filter((row) => row.artifact_id === params[0] && row.organization_id === params[1]);
    }
    if (normalized.includes('FROM wave5_mutation_proposals')) {
      return [...db.mutations.values()].filter(
        (row) => row.artifact_id === params[0] && row.organization_id === params[1]
      );
    }
    if (normalized.includes('FROM wave5_artifacts')) {
      return [...db.artifacts.values()];
    }
    throw new Error(`Unhandled dbAll SQL: ${normalized}`);
  },
}));

describe('Wave 5 artifact runtime', () => {
  beforeEach(() => {
    db.artifacts.clear();
    db.versions.length = 0;
    db.mutations.clear();
    db.uuidCounter = 0;
  });

  it('creates a unified artifact with provenance, then commits a reviewed mutation as a new version', async () => {
    const {
      createWave5Artifact,
      proposeWave5Mutation,
      approveWave5Mutation,
      commitWave5Mutation,
      buildWave5ExportManifest,
    } = await import('../../../server/src/services/wave5ArtifactRuntimeService.js');

    const artifact = await createWave5Artifact({
      organizationId: 'org-1',
      userId: 'user-1',
      artifactType: 'report',
      title: 'Executive report',
      content: '# Report\nOld section',
      citations: [{ id: 'c1' }],
      sourceRefs: [{ sourceClass: 'research_session', sourceId: 'rs-1' }],
      researchSessionId: 'rs-1',
      aiRunId: 'run-1',
      trustBundleId: 'trust-1',
    });

    expect(artifact.status).toBe('draft');
    expect(artifact.content).toContain('Consultify Artifact Provenance');
    expect(artifact.versions).toHaveLength(1);

    const mutation = await proposeWave5Mutation({
      organizationId: 'org-1',
      userId: 'user-1',
      artifactId: artifact.artifactId,
      proposedContent: '# Report\nNew section',
      summary: 'Update report body',
    });
    expect(mutation.status).toBe('proposed');
    expect(mutation.diff.some((line: any) => line.type === 'changed')).toBe(true);

    await expect(
      proposeWave5Mutation({
        organizationId: 'org-1',
        userId: 'user-1',
        artifactId: artifact.artifactId,
        proposedContent: '# Report\nConflicting section',
      })
    ).rejects.toThrow(/active mutation/);

    const approved = await approveWave5Mutation({
      mutationId: mutation.mutationId,
      organizationId: 'org-1',
      userId: 'reviewer-1',
    });
    expect(approved.status).toBe('approved');

    const committed = await commitWave5Mutation({
      mutationId: mutation.mutationId,
      organizationId: 'org-1',
      userId: 'reviewer-1',
    });
    expect(committed.status).toBe('committed');
    expect(committed.version).toBe(2);
    expect(committed.versions).toHaveLength(2);
    expect(committed.content).toContain('New section');

    const manifest = await buildWave5ExportManifest(committed.artifactId, 'org-1');
    expect(db.artifacts.get(committed.artifactId)?.status).toBe('committed');
    expect(manifest).toEqual(
      expect.objectContaining({
        artifactId: committed.artifactId,
        artifactType: 'report',
        version: 2,
      })
    );
  });

  it('asks for missing document fields instead of hallucinating, then creates a filled artifact', async () => {
    const { fillWave5DocumentTemplate } = await import(
      '../../../server/src/services/wave5ArtifactRuntimeService.js'
    );

    const needsInput = await fillWave5DocumentTemplate({
      organizationId: 'org-1',
      userId: 'user-1',
      artifactType: 'report',
      title: 'Business case',
      template: 'Business case for {{initiative}} in {{quarter}}',
      fields: { initiative: 'ERP' },
    });
    expect(needsInput.needsInput).toBe(true);
    expect(needsInput.missingFields).toEqual(['quarter']);

    const filled = await fillWave5DocumentTemplate({
      organizationId: 'org-1',
      userId: 'user-1',
      artifactType: 'report',
      title: 'Business case',
      template: 'Business case for {{initiative}} in {{quarter}}',
      fields: { initiative: 'ERP', quarter: 'Q3' },
    });
    expect(filled.needsInput).toBe(false);
    expect(filled.artifact.content).toContain('Business case for ERP in Q3');
  });

  it('mirrors legacy V8 artifacts into the unified Wave 5 runtime', async () => {
    const { mirrorLegacyArtifactIntoWave5 } = await import(
      '../../../server/src/services/wave5ArtifactRuntimeService.js'
    );

    const mirrored = await mirrorLegacyArtifactIntoWave5({
      organizationId: 'org-1',
      userId: 'user-1',
      legacyArtifactId: 'v8-artifact-1',
      outputType: 'presentation',
      title: 'Board deck',
      originRuntime: 'presentation',
      originRecordId: 'deck-1',
      executionRunId: 'exec-1',
      contextSnapshotId: 'ctx-1',
    });

    expect(mirrored.artifactId).toBe('v8-artifact-1');
    expect(mirrored.artifactType).toBe('slide_deck');
    expect(mirrored.sourceRefs[0]).toEqual(
      expect.objectContaining({
        sourceClass: 'legacy_artifact',
        originRecordId: 'deck-1',
      })
    );

    const duplicate = await mirrorLegacyArtifactIntoWave5({
      organizationId: 'org-1',
      userId: 'user-1',
      legacyArtifactId: 'v8-artifact-1',
      outputType: 'presentation',
      title: 'Board deck duplicate',
    });
    expect(duplicate.artifactId).toBe('v8-artifact-1');
    expect(db.artifacts.size).toBe(1);
  });

  it('exposes the Wave 5 API and UI contract', () => {
    const routes = readFileSync('server/src/routes/artifacts.routes.ts', 'utf8');
    const api = readFileSync('src/services/api.ts', 'utf8');
    const appRoutes = readFileSync('src/routes/AppRoutes.tsx', 'utf8');
    const panel = readFileSync('src/components/AIChat/Wave5ArtifactRuntimePanel.tsx', 'utf8');
    const chat = readFileSync('src/components/AIChat/UnifiedChatPanel.tsx', 'utf8');
    const artifactStore = readFileSync('src/store/useArtifactsStore.ts', 'utf8');
    const streamHook = readFileSync('src/hooks/useAIStream.ts', 'utf8');

    expect(routes).toContain('/wave5/:artifactId/mutations');
    expect(routes).toContain('/wave5/fill-template');
    expect(routes).toContain('/wave5/:artifactId/export-manifest');
    expect(routes).toContain('/wave5/mutations/:mutationId/commit');
    expect(api).toContain('createWave5Artifact');
    expect(api).toContain('approveWave5ArtifactMutation');
    expect(api).toContain('commitWave5ArtifactMutation');
    expect(appRoutes).toContain('/ai/artifacts');
    expect(panel).toContain('Create mutation proposal');
    expect(panel).toContain('commitMutation');
    expect(panel).toContain('Missing fields return questions');
    expect(chat).toContain('Api.createWave5Artifact');
    expect(chat).toContain('mapChatArtifactToWave5Type');
    expect(artifactStore).toContain('requiresMutationProposal');
    expect(streamHook).toContain('if (options.onArtifactDetected)');
    expect(readFileSync('server/src/services/v8/artifactRegistryService.ts', 'utf8')).toContain(
      'mirrorLegacyArtifactIntoWave5'
    );
    expect(readFileSync('server/src/services/v8/artifactRegistryService.ts', 'utf8')).toContain(
      'buildWave5LineDiffForPreview'
    );
  });
});
