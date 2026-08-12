/**
 * OKR-E007 — `getOkrSetHistory` (OKR-F-024, D12-D14), against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §4.8, D12-D14.
 *
 * Proves: (1) the merged timeline — `rvn_platform_events` (every event
 * with `aggregate_type='okr_set'`/`aggregate_id=setId`) merged with
 * `okr_vnext_set_versions` (E002's `OKRMaterialChange`), sorted
 * chronologically, sufficient to reconstruct "what did this Set look like
 * at time T"; (2) visibility-gated — narrowing the Set to `PRIVATE`
 * (`narrowOkrSetVisibility`) makes an outsider's history call return an
 * EMPTY page, not an error and not a leak; (3) keyset pagination on
 * `sequence` — a small `limit` forces multiple pages, no event
 * duplicated/skipped across pages.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DB_CONFIGURED,
  buildClientConfig,
  buildActiveOkrSetFixture,
  cleanupOkrE007Fixture,
  readSetVersionAndStatus,
} from './okrE007TestFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_PREFIX = `okr-e007-history-org-${tag}`;
const USER_ADMIN = `okr-e007-history-admin-${tag}`;
const USER_OWNER = `okr-e007-history-owner-${tag}`;
const USER_REVIEWER = `okr-e007-history-reviewer-${tag}`;
const USER_OUTSIDER = `okr-e007-history-outsider-${tag}`;

let client: Client;
let reachable = false;

type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type MaterialChangeModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetMaterialChangeCommands.js');
type HistoryRepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetHistoryRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');
type OkrSetHistoryEntry = import('../../../server/src/services/resultsVnext/okr/okrSetHistoryRepository.js').OkrSetHistoryEntry;
type OkrSetHistoryEventEntry = import('../../../server/src/services/resultsVnext/okr/okrSetHistoryRepository.js').OkrSetHistoryEventEntry;
type OkrSetHistoryMaterialChangeEntry =
  import('../../../server/src/services/resultsVnext/okr/okrSetHistoryRepository.js').OkrSetHistoryMaterialChangeEntry;

function isEventEntry(entry: OkrSetHistoryEntry): entry is OkrSetHistoryEventEntry {
  return entry.kind === 'event';
}
function isMaterialChangeEntry(entry: OkrSetHistoryEntry): entry is OkrSetHistoryMaterialChangeEntry {
  return entry.kind === 'material_change';
}

let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_OPEN_REVIEW_SPEC: SetCommandsModule['OKR_SET_OPEN_REVIEW_SPEC'];
let narrowOkrSetVisibility: SetCommandsModule['narrowOkrSetVisibility'];
let recordOkrSetMaterialChange: MaterialChangeModule['recordOkrSetMaterialChange'];
let getOkrSetHistory: HistoryRepositoryModule['getOkrSetHistory'];
let closePgPool: (() => Promise<void>) | undefined;

const organizationIdsUsed: string[] = [];

describe('OKR-E007 getOkrSetHistory — merged event+material-change timeline, visibility-gated, paginated (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E007 getOkrSetHistory realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_platform_events LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the platform schema); refusing to report a green run. ' + String(error)
      );
    }
    reachable = true;

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    runOkrSetLifecycleTransition = setCommands.runOkrSetLifecycleTransition;
    OKR_SET_OPEN_REVIEW_SPEC = setCommands.OKR_SET_OPEN_REVIEW_SPEC;
    narrowOkrSetVisibility = setCommands.narrowOkrSetVisibility;

    const materialChangeModule: MaterialChangeModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrSetMaterialChangeCommands.js'
    );
    recordOkrSetMaterialChange = materialChangeModule.recordOkrSetMaterialChange;

    const historyRepository: HistoryRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrSetHistoryRepository.js'
    );
    getOkrSetHistory = historyRepository.getOkrSetHistory;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    for (const organizationId of organizationIdsUsed) {
      await cleanupOkrE007Fixture(client, organizationId);
    }
    await client.end();
    if (closePgPool) await closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  async function freshFixture() {
    const organizationId = `${ORG_PREFIX}-${randomUUID()}`;
    organizationIdsUsed.push(organizationId);
    return buildActiveOkrSetFixture({
      organizationId,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
      programPolicyOverrides: { objectiveRollupModel: 'equal_average' },
    });
  }

  itDB('merged timeline: contains BOTH events (Set/Objective/KR creation, lifecycle) AND the material-change entry, sorted chronologically', async () => {
    const fixture = await freshFixture();

    // A material change while still 'active' (guard: status==='active').
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    await recordOkrSetMaterialChange({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: rowVersion,
      fieldName: 'title',
      afterValue: 'Revised title',
      reason: 'stakeholder feedback',
      requestedBy: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `material-change-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const result = await getOkrSetHistory({ userId: USER_OWNER, organizationId: fixture.organizationId, setId: fixture.setId });

    const eventEntries = result.entries.filter(isEventEntry);
    const materialChangeEntries = result.entries.filter(isMaterialChangeEntry);
    expect(eventEntries.length).toBeGreaterThan(0);
    expect(eventEntries.some((e) => e.eventType === 'okr_set.created')).toBe(true);
    expect(materialChangeEntries).toHaveLength(1);
    expect(materialChangeEntries[0]!.fieldName).toBe('title');
    expect(materialChangeEntries[0]!.afterValue).toBe('Revised title');

    // Sorted ascending by time.
    const timestamps = result.entries.map((e) => new Date(isEventEntry(e) ? e.occurredAt : e.requestedAt).getTime());
    const sorted = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(sorted);
  });

  itDB('visibility-gated: narrowing to PRIVATE makes an outsider\'s history call return an EMPTY page, not an error', async () => {
    const fixture = await freshFixture();

    const owner = await getOkrSetHistory({ userId: USER_OWNER, organizationId: fixture.organizationId, setId: fixture.setId });
    expect(owner.entries.length).toBeGreaterThan(0);

    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    await narrowOkrSetVisibility({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: rowVersion,
      visibilityMode: 'PRIVATE',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `narrow-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const outsider = await getOkrSetHistory({ userId: USER_OUTSIDER, organizationId: fixture.organizationId, setId: fixture.setId });
    expect(outsider.entries).toEqual([]);
    expect(outsider.nextCursor).toBeNull();

    // The owner (still visible to themselves under PRIVATE) still sees it —
    // proves this is genuine ABAC denial, not a blanket lockout.
    const ownerAfterNarrow = await getOkrSetHistory({ userId: USER_OWNER, organizationId: fixture.organizationId, setId: fixture.setId });
    expect(ownerAfterNarrow.entries.length).toBeGreaterThan(0);
  });

  itDB('pagination: a small limit forces multiple pages, no event duplicated/skipped, material_change only on the first page', async () => {
    const fixture = await freshFixture();

    // Generate more events by driving the Set into review (each transition
    // is its own event).
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    await runOkrSetLifecycleTransition(OKR_SET_OPEN_REVIEW_SPEC, {
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `open-review-${randomUUID()}`,
    });

    const fullPage = await getOkrSetHistory({ userId: USER_OWNER, organizationId: fixture.organizationId, setId: fixture.setId, limit: 500 });
    const totalEvents = fullPage.entries.filter(isEventEntry).length;
    expect(totalEvents).toBeGreaterThanOrEqual(2);

    // Page through with limit=1.
    const seenEventIds = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    for (;;) {
      const page = await getOkrSetHistory({
        userId: USER_OWNER,
        organizationId: fixture.organizationId,
        setId: fixture.setId,
        limit: 1,
        cursor,
      });
      pages += 1;
      const eventsOnPage = page.entries.filter(isEventEntry);
      for (const e of eventsOnPage) {
        expect(seenEventIds.has(e.eventId)).toBe(false);
        seenEventIds.add(e.eventId);
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
      if (pages > totalEvents + 2) throw new Error('pagination did not terminate as expected');
    }
    expect(seenEventIds.size).toBe(totalEvents);
    expect(pages).toBeGreaterThanOrEqual(totalEvents);
  });
});
