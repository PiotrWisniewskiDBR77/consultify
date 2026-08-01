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
    if (
      normalized.startsWith('CREATE TABLE') ||
      normalized.startsWith('CREATE INDEX') ||
      normalized.startsWith('ALTER TABLE')
    ) {
      return { changes: 0 };
    }
    if (normalized.startsWith('INSERT INTO wave5_artifacts')) {
      const [
        artifactId,
        organizationId,
        artifactType,
        title,
        content,
        canonicalFormat,
        contentMd,
        contentJsonNative,
        contentSchemaVersion,
        markdownProjectionStatus,
        _markdownProjectedAt,
        _projectionError,
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
      if (db.artifacts.has(artifactId)) throw new Error('duplicate key');
      db.artifacts.set(artifactId, {
        artifact_id: artifactId,
        organization_id: organizationId,
        artifact_type: artifactType,
        status: 'draft',
        title,
        content,
        canonical_format: canonicalFormat,
        content_md: contentMd,
        content_json_native: contentJsonNative,
        content_schema_version: contentSchemaVersion,
        markdown_projection_status: markdownProjectionStatus,
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
      if (params.length >= 15) {
        const [
          versionId,
          artifactId,
          organizationId,
          version,
          content,
          _canonicalFormat,
          _contentMd,
          _contentJsonNative,
          _contentSchemaVersion,
          _markdownProjectionStatus,
          _markdownProjectedAt,
          _projectionError,
          mutationId,
          provenanceJson,
          createdBy,
        ] = params;
        db.versions.push({
          version_id: versionId,
          artifact_id: artifactId,
          organization_id: organizationId,
          version,
          content,
          mutation_id: mutationId,
          provenance_json: provenanceJson,
          created_by: createdBy,
          created_at: new Date().toISOString(),
        });
      } else {
        const [
          versionId,
          artifactId,
          organizationId,
          version,
          content,
          mutationId,
          provenanceJson,
          createdBy,
        ] = params;
        db.versions.push({
          version_id: versionId,
          artifact_id: artifactId,
          organization_id: organizationId,
          version,
          content,
          mutation_id: mutationId,
          provenance_json: provenanceJson,
          created_by: createdBy,
          created_at: new Date().toISOString(),
        });
      }
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
    if (normalized.includes('SET provenance_json = ?')) {
      const [provenanceJson, artifactId, organizationId] = params;
      const artifact = db.artifacts.get(artifactId);
      if (artifact?.organization_id === organizationId) artifact.provenance_json = provenanceJson;
      return { changes: artifact?.organization_id === organizationId ? 1 : 0 };
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
      const artifact = db.artifacts.get(params[0]);
      return artifact?.organization_id === params[1] ? artifact : null;
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
    expect(mirrored.sourceRefs.at(-1)).toEqual(
      expect.objectContaining({
        sourceClass: 'legacy_artifact',
        originRecordId: 'deck-1',
      })
    );
    expect(mirrored.contentMd).toBe('');
    expect(mirrored.markdownProjectionStatus).toBe('missing');
    expect(mirrored.provenance.metadata).toMatchObject({
      contentAuthority: 'origin_runtime', quarantineStatus: 'legacy_mirror', canonicalContent: false,
    });

    const duplicate = await mirrorLegacyArtifactIntoWave5({
      organizationId: 'org-1',
      userId: 'user-1',
      legacyArtifactId: 'v8-artifact-1',
      outputType: 'presentation',
      title: 'Board deck duplicate',
    });
    expect(duplicate.artifactId).toBe('v8-artifact-1');
    expect(db.artifacts.size).toBe(1);

    db.artifacts.set('historic-mirror', {
      artifact_id: 'historic-mirror', organization_id: 'org-1', artifact_type: 'report',
      content: '# Old\nLegacy report artifact mirrored into Wave 5 runtime.', content_md: 'old placeholder',
      source_refs_json: JSON.stringify([{ sourceClass: 'legacy_artifact', originRuntime: 'report', originRecordId: 'report-old' }]),
      provenance_json: JSON.stringify({ metadata: { mirroredFrom: 'v8_output_artifacts' } }), current_version: 1,
    });
    const historic = await mirrorLegacyArtifactIntoWave5({
      organizationId: 'org-1', userId: 'user-1', legacyArtifactId: 'historic-mirror',
      outputType: 'report', title: 'Old', originRuntime: 'report', originRecordId: 'report-old',
    });
    expect(historic.content).toContain('Legacy report artifact mirrored');
    expect(historic.provenance.metadata).toMatchObject({ contentAuthority: 'origin_runtime', quarantineStatus: 'legacy_mirror' });
    await expect(mirrorLegacyArtifactIntoWave5({
      organizationId: 'foreign', userId: 'user-1', legacyArtifactId: 'historic-mirror',
      outputType: 'report', title: 'Foreign', originRuntime: 'report', originRecordId: 'report-old',
    })).rejects.toBeTruthy();
  });

  it('generates report, deck and table as first-class structured artifacts', async () => {
    const { generateWave5StructuredArtifact, buildWave5ExportManifest } = await import(
      '../../../server/src/services/wave5ArtifactRuntimeService.js'
    );

    const report = await generateWave5StructuredArtifact({
      organizationId: 'org-1',
      userId: 'user-1',
      outputKind: 'executive_report',
      prompt: 'Assess transformation portfolio',
      title: 'Transformation report',
    });
    const deck = await generateWave5StructuredArtifact({
      organizationId: 'org-1',
      userId: 'user-1',
      outputKind: 'board_deck',
      prompt: 'Prepare board decision deck',
      title: 'Board deck',
    });
    const table = await generateWave5StructuredArtifact({
      organizationId: 'org-1',
      userId: 'user-1',
      outputKind: 'kpi_table',
      prompt: 'Track value delivery',
      title: 'KPI table',
    });

    expect(report.artifactType).toBe('report');
    expect(report.content).toContain('## Executive Summary');
    expect(deck.artifactType).toBe('slide_deck');
    expect(deck.content).toContain('"slides"');
    expect(table.artifactType).toBe('spreadsheet');
    expect(table.content).toContain('KPI,Baseline,Target');

    const tableManifest = await buildWave5ExportManifest(table.artifactId, 'org-1');
    expect(tableManifest).toEqual(
      expect.objectContaining({
        checksumSha256: expect.any(String),
        formats: expect.arrayContaining(['csv', 'xlsx_ready_json']),
      })
    );
  });

  it('exposes the Wave 5 API and UI contract', () => {
    const routes = readFileSync('server/src/routes/artifacts.routes.ts', 'utf8');
    const api = readFileSync('src/services/api.ts', 'utf8');
    const appRoutes = readFileSync('src/routes/AppRoutes.tsx', 'utf8');
    const panel = readFileSync('src/components/AIChat/Wave5ArtifactRuntimePanel.tsx', 'utf8');
    const chat = readFileSync('src/components/AIChat/UnifiedChatPanel.tsx', 'utf8');
    const artifactStore = readFileSync('src/store/useArtifactsStore.ts', 'utf8');
    const streamHook = readFileSync('src/hooks/useAIStream.ts', 'utf8');
    const menu = readFileSync('src/components/navigation/Sidebar/menuConfig.ts', 'utf8');

    expect(routes).toContain('/wave5/:artifactId/mutations');
    expect(routes).toContain('/wave5/fill-template');
    expect(routes).toContain('/wave5/generate');
    expect(routes).toContain('/wave5/:artifactId/export-manifest');
    expect(routes).toContain('/wave5/mutations/:mutationId/commit');
    expect(api).toContain('createWave5Artifact');
    expect(api).toContain('approveWave5ArtifactMutation');
    expect(api).toContain('commitWave5ArtifactMutation');
    expect(api).toContain('generateWave5StructuredArtifact');
    expect(appRoutes).toContain('path={ROUTES.AI_OS.ARTIFACTS}');
    expect(menu).toContain('AI_OS_ARTIFACTS');
    expect(menu).toContain('AI_OS_RESEARCH');
    expect(panel).toContain('createMutationProposal');
    expect(panel).toContain('commitMutation');
    expect(panel).toContain('missingFieldsReturnQuestionsNotGuesses');
    expect(panel).toContain('generateOutput');
    expect(chat).toContain('Api.createWave5Artifact');
    expect(chat).toContain('mapChatArtifactToWave5Type');
    expect(chat).toContain('trustBundleId');
    expect(chat).toContain('citations: Array.isArray');
    expect(chat).toContain('Artifact was kept as a local draft');
    expect(artifactStore).toContain('requiresMutationProposal');
    expect(streamHook).toContain('if (options.onArtifactDetected)');
    expect(streamHook).toContain('artifactMeta');
    expect(readFileSync('server/src/services/v8/artifactRegistryService.ts', 'utf8')).toContain(
      'mirrorLegacyArtifactIntoWave5'
    );
    expect(readFileSync('server/src/services/v8/artifactRegistryService.ts', 'utf8')).toContain(
      'buildWave5LineDiffForPreview'
    );
  });
});
