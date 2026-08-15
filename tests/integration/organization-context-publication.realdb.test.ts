import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RUN_REAL_DB = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const describeRealDb = RUN_REAL_DB ? describe : describe.skip;
const databaseUrl = String(process.env.DATABASE_URL || '');

describeRealDb('ORG-001 immutable publication on real PostgreSQL', () => {
  const admin = new Client({ connectionString: databaseUrl });

  beforeAll(async () => {
    if (!databaseUrl.startsWith('postgresql://')) {
      throw new Error('ORG-001 realDB test requires an explicit disposable PostgreSQL URL');
    }
    await admin.connect();
    await admin.query(`
      DROP TABLE IF EXISTS organization_context_publications;
      DROP TABLE IF EXISTS organization_context_snapshots;
      DROP TABLE IF EXISTS organization_context_claims;
      DROP TABLE IF EXISTS organization_context_items;
      DROP TABLE IF EXISTS organizations;

      CREATE TABLE organizations (
        id TEXT PRIMARY KEY,
        name TEXT,
        default_language TEXT,
        default_timezone TEXT,
        mfa_required INTEGER,
        mfa_grace_period_days INTEGER
      );
      CREATE TABLE organization_context_items (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        source_type TEXT,
        source_id TEXT,
        author_user_id TEXT,
        channel TEXT,
        source_label TEXT,
        content_json TEXT,
        metadata_json TEXT,
        is_explicit INTEGER DEFAULT 1,
        visibility_scope TEXT DEFAULT 'organization',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE organization_context_claims (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        claim_path TEXT NOT NULL,
        value_json TEXT NOT NULL,
        confidence REAL DEFAULT 1,
        claim_type TEXT DEFAULT 'fact',
        status TEXT DEFAULT 'active',
        review_status TEXT DEFAULT 'proposed',
        supersedes_claim_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE organization_context_snapshots (
        organization_id TEXT PRIMARY KEY,
        schema_version INTEGER,
        snapshot_json TEXT,
        rebuilt_at TIMESTAMP
      );
    `);
    const migration = readFileSync(
      path.join(process.cwd(), 'server', 'migrations', '20260815_org001_context_publications.sql'),
      'utf8'
    );
    await admin.query(migration);
    await admin.query(
      `INSERT INTO organizations (id, name) VALUES ('org-a', 'Org A'), ('org-b', 'Org B')`
    );
    await admin.query(
      `INSERT INTO organization_context_items
       (id, organization_id, source_type, source_id, source_label, content_json, visibility_scope)
       VALUES ('item-a', 'org-a', 'document_extraction', 'doc-a', 'strategy.pdf', '{}', 'organization')`
    );
    await admin.query(
      `INSERT INTO organization_context_claims
       (id, organization_id, item_id, claim_path, value_json, review_status)
       VALUES ('claim-a', 'org-a', 'item-a', 'profile.industry', '"Consulting"', 'proposed')`
    );
  });

  afterAll(async () => {
    await admin.end();
  });

  it('approves, publishes, reads cold, preserves immutable publication after source deletion, and denies cross-tenant read', async () => {
    const { organizationContextService } =
      await import('../../server/src/services/organizationContext/OrganizationContextService.js');
    await organizationContextService.approveClaim({
      organizationId: 'org-a',
      claimId: 'claim-a',
      reviewerId: 'reviewer-a',
    });
    const published = await organizationContextService.publishSnapshot({
      organizationId: 'org-a',
      createdBy: 'reviewer-a',
    });
    expect(published.sourceRefs).toEqual([
      expect.objectContaining({ claimId: 'claim-a', sourceId: 'doc-a' }),
    ]);

    const cold = await organizationContextService.getPublishedSnapshot(
      'org-a',
      published.snapshotId
    );
    expect(cold).toMatchObject({
      snapshotId: published.snapshotId,
      contentHash: published.contentHash,
      createdBy: 'reviewer-a',
    });
    await expect(
      organizationContextService.getPublishedSnapshot('org-b', published.snapshotId)
    ).resolves.toBeNull();

    await admin.query(`DELETE FROM organization_context_items WHERE id = 'item-a'`);
    await expect(
      organizationContextService.getPublishedSnapshot('org-a', published.snapshotId)
    ).resolves.toMatchObject({ snapshotId: published.snapshotId });
    await expect(
      organizationContextService.publishSnapshot({
        organizationId: 'org-a',
        createdBy: 'reviewer-a',
      })
    ).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
  });
});
