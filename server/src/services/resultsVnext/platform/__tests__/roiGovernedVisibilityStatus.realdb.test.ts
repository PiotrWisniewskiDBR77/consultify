/**
 * AMD-FLOW-ROI-VISIBILITY-002 — ODCZYT stanu polityki widoczności ROI,
 * przeciw REALNEMU Postgresowi (dodane 2026-09-05).
 *
 * DLACZEGO TEN PLIK ISTNIEJE. Odbiór na żywo 05.09
 * (`evidence/odbior-zywo-20260905/RUNDA2_RAPORT.md`) zmierzył blokadę
 * strukturalną: właściciel organizacji DBR77 widzi pusty rejestr ROI, bo
 * `GET /cases` przy odmowie zwraca zero wierszy (nigdy 403), a
 * `POST /cases` odmawia z `ROI_CASE_CREATION_NOT_AUTHORIZED`. Przyczyna nie
 * jest w uprawnieniach użytkownika — jest w tym, że organizacja NIGDY nie
 * opublikowała polityki `ROI_GOVERNED`, a jedyny endpoint, który to robi,
 * nie miał wołacza w interfejsie. Trzy ekrany Wyników naraz.
 *
 * `getRoiGovernedVisibilityPolicyStatus` jest brakującym odczytem, z którego
 * ekran buduje uczciwy komunikat i przycisk. Ten plik sprawdza cztery rzeczy,
 * których nie da się sprawdzić bez realnej bazy:
 *  1. przed publikacją: OWNER i ADMIN dostają `canPublish: true`;
 *  2. przed publikacją: zwykły MEMBER, członek nieaktywny i użytkownik bez
 *     wiersza członkostwa dostają `canPublish: false` z konkretnym powodem;
 *  3. po publikacji przez OWNER: `published: true`, `canPublish: false`,
 *     `blocker: 'ALREADY_PUBLISHED'`, a `publication.publishedBy` wskazuje
 *     realnego autora;
 *  4. NAJWAŻNIEJSZE — że publikacja faktycznie ZDEJMUJE blokadę: ta sama
 *     organizacja, która przed publikacją dostaje z `resolveRoiGovernedVisibility`
 *     odmowę `NO_GOVERNED_POLICY` (dokładnie ta, którą `createRoiCase`
 *     zamienia na 403 `ROI_CASE_CREATION_NOT_AUTHORIZED`), po publikacji
 *     dostaje zgodę `OWNER`.
 *
 * SKIP POLICY: jak każdy `*.realdb.test.ts` w tym programie — cichy no-op bez
 * skonfigurowanej bazy, `beforeAll` rzuca, gdy baza jest skonfigurowana, ale
 * nieosiągalna. Bieg bez bazy NIE JEST dowodem.
 *
 * Uruchomienie (z katalogu roboczego gałęzi):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://.../<baza>" \
 *   npx vitest run server/src/services/resultsVnext/platform/__tests__/roiGovernedVisibilityStatus.realdb.test.ts
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-status-org-${tag}`;
const USER_OWNER = `roi-status-owner-${tag}`;
const USER_ADMIN = `roi-status-admin-${tag}`;
const USER_MEMBER = `roi-status-member-${tag}`;
const USER_REVOKED = `roi-status-revoked-${tag}`;
const USER_GHOST = `roi-status-ghost-${tag}`; // celowo BEZ wiersza członkostwa

type VisibilityResolverModule =
  typeof import('../../../../services/resultsVnext/platform/visibilityResolver.js');

let getRoiGovernedVisibilityPolicyStatus: VisibilityResolverModule['getRoiGovernedVisibilityPolicyStatus'];
let publishRoiGovernedVisibilityPolicy: VisibilityResolverModule['publishRoiGovernedVisibilityPolicy'];
let resolveRoiGovernedVisibility: VisibilityResolverModule['resolveRoiGovernedVisibility'];
let ROI_GOVERNED_VISIBILITY_POLICY: VisibilityResolverModule['ROI_GOVERNED_VISIBILITY_POLICY'];

let client: Client;
let reachable = false;

async function insertUserAndMembership(
  userId: string,
  organizationId: string,
  role: string,
  status = 'ACTIVE'
): Promise<void> {
  await client.query(
    `INSERT INTO users (id, email, organization_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@roi-status.local`, organizationId]
  );
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status`,
    [`${userId}-membership`, organizationId, userId, role, status]
  );
}

describe('getRoiGovernedVisibilityPolicyStatus (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] Brak skonfigurowanej bazy — roiGovernedVisibilityStatus realdb NIE BIEGŁ. Ten bieg nie jest dowodem.'
      );
      return;
    }
    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1 FROM rvn_roi_visibility_governance LIMIT 0');
    } catch (error) {
      throw new Error(
        'Baza jest skonfigurowana, ale nieosiągalna albo brak jej 20261020_roi_governed_visibility_policy.sql; ' +
          'odmawiam zameldowania zielonego biegu. ' +
          String(error)
      );
    }
    reachable = true;

    const mod: VisibilityResolverModule = await import(
      '../../../../services/resultsVnext/platform/visibilityResolver.js'
    );
    getRoiGovernedVisibilityPolicyStatus = mod.getRoiGovernedVisibilityPolicyStatus;
    publishRoiGovernedVisibilityPolicy = mod.publishRoiGovernedVisibilityPolicy;
    resolveRoiGovernedVisibility = mod.resolveRoiGovernedVisibility;
    ROI_GOVERNED_VISIBILITY_POLICY = mod.ROI_GOVERNED_VISIBILITY_POLICY;

    await client.query(
      `INSERT INTO organizations (id, name, plan, status)
       VALUES ($1, 'ROI status realdb org', 'enterprise', 'active') ON CONFLICT (id) DO NOTHING`,
      [ORG_ID]
    );
    await insertUserAndMembership(USER_OWNER, ORG_ID, 'OWNER');
    await insertUserAndMembership(USER_ADMIN, ORG_ID, 'ADMIN');
    await insertUserAndMembership(USER_MEMBER, ORG_ID, 'MEMBER');
    await insertUserAndMembership(USER_REVOKED, ORG_ID, 'OWNER', 'REVOKED');
    await client.query(
      `INSERT INTO users (id, email, organization_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [USER_GHOST, `${USER_GHOST}@roi-status.local`, ORG_ID]
    );
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM users WHERE organization_id = $1`, [ORG_ID]);
    // `rvn_roi_visibility_governance` jest append-only (trigger BEFORE
    // DELETE), więc wiersz publikacji i sama organizacja zostają — mierzymy
    // ten osad, zamiast pisać zero, którego nie da się osiągnąć.
    const residue = await client.query<{ governance_rows: string }>(
      `SELECT (SELECT count(*)::text FROM rvn_roi_visibility_governance WHERE organization_id = $1) governance_rows`,
      [ORG_ID]
    );
    expect(residue.rows[0].governance_rows).toBe('1');
    await client.end();
  }, 30_000);

  it.runIf(DB_CONFIGURED)(
    'przed publikacją: OWNER i ADMIN mogą opublikować, MEMBER/nieaktywny/bez-członkostwa nie',
    async () => {
      const owner = await getRoiGovernedVisibilityPolicyStatus({
        organizationId: ORG_ID,
        userId: USER_OWNER,
      });
      expect(owner).toEqual({
        published: false,
        publication: null,
        canPublish: true,
        blocker: null,
      });

      const admin = await getRoiGovernedVisibilityPolicyStatus({
        organizationId: ORG_ID,
        userId: USER_ADMIN,
      });
      expect(admin.canPublish).toBe(true);

      const member = await getRoiGovernedVisibilityPolicyStatus({
        organizationId: ORG_ID,
        userId: USER_MEMBER,
      });
      expect(member.canPublish).toBe(false);
      expect(member.blocker).toBe('ORDINARY_MEMBER_DENIED');

      // Odebrane członkostwo z rolą OWNER — status, nie rola, decyduje.
      const revoked = await getRoiGovernedVisibilityPolicyStatus({
        organizationId: ORG_ID,
        userId: USER_REVOKED,
      });
      expect(revoked.canPublish).toBe(false);
      expect(revoked.blocker).toBe('NOT_ACTIVE_MEMBER');

      const ghost = await getRoiGovernedVisibilityPolicyStatus({
        organizationId: ORG_ID,
        userId: USER_GHOST,
      });
      expect(ghost.canPublish).toBe(false);
      expect(ghost.blocker).toBe('NOT_ACTIVE_MEMBER');
    },
    30_000
  );

  it.runIf(DB_CONFIGURED)(
    'publikacja zdejmuje blokadę: NO_GOVERNED_POLICY przed, zgoda OWNER po — i status to odzwierciedla',
    async () => {
      // PRZED: dokładnie ta odmowa, którą createRoiCase zamienia na 403
      // ROI_CASE_CREATION_NOT_AUTHORIZED — czyli zmierzona blokada odbioru.
      const before = await resolveRoiGovernedVisibility({
        userId: USER_OWNER,
        organizationId: ORG_ID,
      });
      expect(before).toEqual({ allow: false, reason: 'NO_GOVERNED_POLICY' });

      const outcome = await publishRoiGovernedVisibilityPolicy({
        organizationId: ORG_ID,
        actorUserId: USER_OWNER,
        policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
        policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
        idempotencyKey: `roi-status-${tag}`,
      });
      expect(outcome.outcome).toBe('applied');

      // PO: ta sama organizacja, ten sam aktor — zgoda.
      const after = await resolveRoiGovernedVisibility({
        userId: USER_OWNER,
        organizationId: ORG_ID,
      });
      expect(after).toEqual({ allow: true, reason: 'OWNER' });

      const status = await getRoiGovernedVisibilityPolicyStatus({
        organizationId: ORG_ID,
        userId: USER_OWNER,
      });
      expect(status.published).toBe(true);
      expect(status.canPublish).toBe(false);
      expect(status.blocker).toBe('ALREADY_PUBLISHED');
      expect(status.publication?.publishedBy).toBe(USER_OWNER);
      expect(status.publication?.policyKey).toBe(ROI_GOVERNED_VISIBILITY_POLICY.key);

      // Zwykły członek po publikacji też widzi „już opublikowane" (a nie
      // „możesz opublikować") — status nie może sugerować akcji, której
      // serwer i tak odmówi.
      const memberAfter = await getRoiGovernedVisibilityPolicyStatus({
        organizationId: ORG_ID,
        userId: USER_MEMBER,
      });
      expect(memberAfter.published).toBe(true);
      expect(memberAfter.canPublish).toBe(false);
      expect(memberAfter.blocker).toBe('ALREADY_PUBLISHED');
    },
    30_000
  );
});
