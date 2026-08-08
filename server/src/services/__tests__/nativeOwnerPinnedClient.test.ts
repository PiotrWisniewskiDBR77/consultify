import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PgTransactionClient } from '../../utils/queryHelpers.js';

/**
 * U02 requirement 8 — "no independent commits inside an outer transaction".
 *
 * These contracts prove it without a database: the process-wide DB handle is
 * replaced with one that THROWS on any use, so if a single owner statement
 * escaped the donated `PgTransactionClient` the test would fail loudly instead
 * of silently committing on a second connection.
 */
const escaped: string[] = [];
const explodingDb = {
  get(sql: string, _params?: unknown[], cb?: (e: Error | null, r: unknown) => void) {
    escaped.push(sql);
    const error = new Error('pooled_handle_used_inside_transaction');
    if (cb) cb(error, null);
    return Promise.reject(error);
  },
  all(sql: string, _params?: unknown[], cb?: (e: Error | null, r: unknown[]) => void) {
    escaped.push(sql);
    const error = new Error('pooled_handle_used_inside_transaction');
    if (cb) cb(error, []);
    return Promise.reject(error);
  },
  run(sql: string, _params?: unknown[], cb?: (e: Error | null) => void) {
    escaped.push(sql);
    const error = new Error('pooled_handle_used_inside_transaction');
    if (cb) cb.call({ changes: 0 }, error);
    return Promise.reject(error);
  },
  exec: () => Promise.resolve(undefined),
  serialize: (cb: () => void) => cb(),
  close: () => Promise.resolve(),
};
(globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = explodingDb;
(process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = explodingDb;

const { createNativeReport, setDependencies, withReportBuilderClient } = await import(
  '../reportBuilderService.js'
);
const { createNativeDeck, createNativeDeckVersion, withPresentationOwnerClient } = await import(
  '../presentationGeneratorService.js'
);
const { withArtifactRegistryClient } = await import('../v8/artifactRegistryService.js');

setDependencies({ db: explodingDb as never });

/** Records every statement and answers the few SELECTs the owner code needs. */
function recordingClient() {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const artifacts: Record<string, unknown>[] = [];
  const links: Record<string, unknown>[] = [];

  const client: PgTransactionClient = {
    async query<T = unknown>(sql: string, params: unknown[] = []) {
      statements.push({ sql, params });
      const text = sql.replace(/\s+/g, ' ').trim();

      if (/^INSERT INTO v8_output_artifacts/i.test(text)) {
        artifacts.push({
          artifact_id: params[0],
          organization_id: params[1],
          output_type: params[2],
          artifact_family: params[3],
          delivery_state: params[4],
          title_snapshot: params[5],
          owner_user_id: params[6],
          canonical_home: params[7],
          visibility_scope: params[8],
          project_id: params[9],
          context_snapshot_id: params[10],
          execution_run_id: params[11],
          template_family_ref: params[12],
          source_initiative_id: params[13],
          ai_governance_preset_ref: params[14],
          origin_summary_json: params[15],
          created_by: params[16],
          created_at: params[17],
          last_transition_at: params[18],
        });
        return { rows: [] as T[], rowCount: 1 };
      }
      if (/^INSERT INTO v8_artifact_origin_links/i.test(text)) {
        links.push({
          link_id: params[0],
          artifact_id: params[1],
          organization_id: params[2],
          origin_runtime: params[3],
          origin_record_id: params[4],
          is_primary_origin: params[5],
          created_at: params[6],
        });
        return { rows: [] as T[], rowCount: 1 };
      }
      if (/^SELECT \* FROM v8_artifact_origin_links/i.test(text)) {
        const [org, runtime, record] = params as string[];
        const found = links.find(
          (l) =>
            l.organization_id === org && l.origin_runtime === runtime && l.origin_record_id === record
        );
        return { rows: (found ? [found] : []) as T[], rowCount: found ? 1 : 0 };
      }
      if (/^SELECT \* FROM v8_output_artifacts/i.test(text)) {
        const [artifactId, org] = params as string[];
        const found = artifacts.find(
          (a) => a.artifact_id === artifactId && a.organization_id === org
        );
        return { rows: (found ? [found] : []) as T[], rowCount: found ? 1 : 0 };
      }
      if (/^SELECT id FROM presentation_decks/i.test(text))
        return { rows: [{ id: params[0] }] as T[], rowCount: 1 };

      return { rows: [] as T[], rowCount: 0 };
    },
  };

  return { client, statements, artifacts, links };
}

const unified = {
  meta: {
    client: 'c',
    project: 'p',
    date: '2026-08-08',
    author: 'a',
    confidentiality: 'confidential' as const,
    language: 'pl' as const,
  },
  slides: [
    {
      intent: 'cover' as const,
      key_message: 'k',
      content: { type: 'cover' as const, title: 't', subtitle: 's' },
    },
  ],
};

beforeEach(() => {
  escaped.length = 0;
  vi.restoreAllMocks();
});

describe('U02 owner services under a donated transaction', () => {
  it('routes every native report statement through the donated client', async () => {
    const { client, statements, artifacts, links } = recordingClient();

    const result = await withReportBuilderClient(client, () =>
      withArtifactRegistryClient(client, () =>
        createNativeReport({
          organizationId: 'org-1',
          sourceType: 'TRANSFORMATION_CASE',
          sourceId: 'case-1',
          title: 'Raport końcowy',
          reportType: 'TRANSFORMATION_FINAL_REPORT',
          status: 'APPROVED',
          createdBy: 'user-1',
          createdAt: '2026-08-08T10:00:00.000Z',
          sections: [
            {
              sectionKey: 'section-1',
              sectionType: 'summary',
              title: 'Podsumowanie',
              orderIndex: 0,
              content: 'Treść.',
            },
          ],
        })
      )
    );

    expect(escaped).toEqual([]);
    expect(result.reportId).toBeTruthy();
    expect(result.sectionIds).toHaveLength(1);
    expect(result.registryArtifactId).toBe(artifacts[0].artifact_id);
    expect(links[0].origin_record_id).toBe(result.reportId);
    expect(statements.some((s) => /INSERT INTO report_builder_reports/i.test(s.sql))).toBe(true);
    expect(statements.some((s) => /INSERT INTO report_builder_sections/i.test(s.sql))).toBe(true);
    // Tenant scope is carried on every owner row.
    expect(artifacts[0].organization_id).toBe('org-1');
  });

  it('routes every native deck statement through the donated client', async () => {
    const { client, statements, artifacts } = recordingClient();

    const deck = await withPresentationOwnerClient(client, () =>
      withArtifactRegistryClient(client, () =>
        createNativeDeck({
          organizationId: 'org-1',
          title: 'Deck',
          unifiedJson: unified,
          sourceType: 'transformation_case',
          sourceId: 'case-1',
          createdBy: 'user-1',
          createdAt: '2026-08-08T10:00:00.000Z',
        })
      )
    );
    const version = await withPresentationOwnerClient(client, () =>
      createNativeDeckVersion({
        deckId: deck.deckId,
        organizationId: 'org-1',
        version: 1,
        deck: deck.deck,
        slideCount: deck.slideCount,
        createdBy: 'user-1',
        createdAt: '2026-08-08T10:00:00.000Z',
      })
    );

    expect(escaped).toEqual([]);
    expect(deck.slideCount).toBe(1);
    expect(deck.registryArtifactId).toBe(artifacts[0].artifact_id);
    expect(version.version).toBe(1);
    expect(statements.some((s) => /INSERT INTO presentation_decks/i.test(s.sql))).toBe(true);
    expect(statements.some((s) => /INSERT INTO presentation_deck_versions/i.test(s.sql))).toBe(
      true
    );
  });

  it('propagates owner failures instead of swallowing them, so the caller can roll back', async () => {
    const failing: PgTransactionClient = {
      async query(sql: string) {
        if (/INSERT INTO report_builder_sections/i.test(sql))
          throw new Error('injected_section_failure');
        return { rows: [], rowCount: 1 };
      },
    };

    await expect(
      withReportBuilderClient(failing, () =>
        createNativeReport({
          organizationId: 'org-1',
          sourceType: 'TRANSFORMATION_CASE',
          sourceId: 'case-1',
          title: 'Raport końcowy',
          reportType: 'TRANSFORMATION_FINAL_REPORT',
          status: 'APPROVED',
          createdBy: 'user-1',
          createdAt: '2026-08-08T10:00:00.000Z',
          registerArtifact: false,
          sections: [
            {
              sectionKey: 'section-1',
              sectionType: 'summary',
              title: 'Podsumowanie',
              orderIndex: 0,
              content: 'Treść.',
            },
          ],
        })
      )
    ).rejects.toThrow('injected_section_failure');
    expect(escaped).toEqual([]);
  });

  it('rejects a missing registry receipt rather than returning a half-registered artifact', async () => {
    const noRegistry: PgTransactionClient = {
      // Never returns the inserted artifact row → registration cannot be proven.
      async query() {
        return { rows: [], rowCount: 1 };
      },
    };

    await expect(
      withPresentationOwnerClient(noRegistry, () =>
        withArtifactRegistryClient(noRegistry, () =>
          createNativeDeck({
            organizationId: 'org-1',
            title: 'Deck',
            unifiedJson: unified,
            sourceType: 'transformation_case',
            sourceId: 'case-1',
            createdBy: 'user-1',
            createdAt: '2026-08-08T10:00:00.000Z',
          })
        )
      )
    ).rejects.toThrow('native_deck_artifact_registration_failed');
    expect(escaped).toEqual([]);
  });
});
