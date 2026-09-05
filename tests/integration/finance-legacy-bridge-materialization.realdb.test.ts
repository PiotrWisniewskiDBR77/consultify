/**
 * Finance v3 — ID BRIDGE, strona ZAPISU (naprawa 2026-09-05).
 *
 * CO DOWODZI: rekord Finansów założony PRZED wejściem serwisów rejestrujących
 * (czyli każdy rekord zastany na stagingu) dostaje tożsamość kanoniczną i most
 * rozwiązuje się BEZ żadnego kroku operatorskiego — a jednocześnie żadna z
 * czterech blokad nie zniknęła: nieistniejące id, cudza organizacja i alias z
 * kwarantanny dalej NIE dostają tożsamości.
 *
 * DOWÓD MUTACYJNY (wykonany w tej sesji, transkrypt w raporcie dyżuru):
 *  - usunięcie wywołania `ensureLegacyFinanceArtifactIdentity` z hooka/serwisu
 *    → test 1 („most rozwiązuje się bez wiersza mostu") CZERWONY.
 *  - usunięcie `readLegacyRow` (fail-closed) → testy 4 i 5 CZERWONE
 *    (tożsamość powstawałaby dla zmyślonego id i dla cudzej organizacji).
 *  - usunięcie `UPDATE ... current_business_version_id` → test 6 CZERWONY
 *    (to jest przyczyna 409 `LEGACY_IDENTITY_UNMAPPED` na ekranie Wyceny).
 *  - usunięcie `ON CONFLICT DO NOTHING` + advisory locka → test 3
 *    (idempotencja backfillu) CZERWONY.
 */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres';

const databaseUrl = process.env.DATABASE_URL || '';

const ORG = `org-fingate-${randomUUID().slice(0, 8)}`;
const OTHER_ORG = `org-fingate-other-${randomUUID().slice(0, 8)}`;
const USER = `user-fingate-${randomUUID().slice(0, 8)}`;

describe('Finance ID BRIDGE — materializacja tożsamości (realDB)', { retry: 0 }, () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });

  let ensureLegacyFinanceArtifactIdentity: typeof import('../../server/src/services/finance/canonical/legacyIdentityMaterializationService').ensureLegacyFinanceArtifactIdentity;
  let resolveLegacyFinanceArtifact: typeof import('../../server/src/services/finance/canonical/legacyIdBridgeService').resolveLegacyFinanceArtifact;
  let runFinanceBridgeBackfill: typeof import('../../server/scripts/finance-bridge-backfill').runFinanceBridgeBackfill;

  const modelId = `fingate-model-${randomUUID()}`;
  const valuationId = `fingate-val-${randomUUID()}`;
  const analysisId = `fingate-analysis-${randomUUID()}`;
  const foreignModelId = `fingate-foreign-model-${randomUUID()}`;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    ({ ensureLegacyFinanceArtifactIdentity } = await import(
      '../../server/src/services/finance/canonical/legacyIdentityMaterializationService'
    ));
    ({ resolveLegacyFinanceArtifact } = await import(
      '../../server/src/services/finance/canonical/legacyIdBridgeService'
    ));
    ({ runFinanceBridgeBackfill } = await import(
      '../../server/scripts/finance-bridge-backfill'
    ));

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2), ($3, $4)`, [
      ORG,
      'Finance Gate Org',
      OTHER_ORG,
      'Finance Gate Other Org',
    ]);
    await pool.query(
      `INSERT INTO users (id, email, password, first_name, last_name, role, organization_id)
       VALUES ($1, $2, 'x', 'Fin', 'Gate', 'ADMIN', $3)`,
      [USER, `${USER}@test.invalid`, ORG]
    );
    // Rekordy legacy DOKŁADNIE takie, jakie leżą na stagingu: bez aliasu,
    // bez artefaktu kanonicznego, założone „przed" mostem.
    await pool.query(
      `INSERT INTO financial_models (id, organization_id, name, start_date, created_by)
       VALUES ($1, $2, 'Model bazowy 2026', CURRENT_DATE, $3)`,
      [modelId, ORG, USER]
    );
    await pool.query(
      `INSERT INTO financial_models (id, organization_id, name, start_date, created_by)
       VALUES ($1, $2, 'Model obcej organizacji', CURRENT_DATE, $3)`,
      [foreignModelId, OTHER_ORG, USER]
    );
    await pool.query(
      `INSERT INTO valuations (id, organization_id, title, source_type, created_by)
       VALUES ($1, $2, 'Wycena spolki', 'manual', $3)`,
      [valuationId, ORG, USER]
    );
    await pool.query(
      `INSERT INTO financial_analyses (id, organization_id, title, created_by)
       VALUES ($1, $2, 'Analiza historyczna', $3)`,
      [analysisId, ORG, USER]
    );
  }, 120000);

  afterAll(async () => {
    for (const org of [ORG, OTHER_ORG]) {
      await pool.query(`DELETE FROM finance_artifact_aliases WHERE organization_id = $1`, [org]);
      await pool.query(
        `UPDATE finance_artifacts SET current_business_version_id = NULL WHERE organization_id = $1`,
        [org]
      );
      await pool.query(
        `UPDATE finance_business_versions SET source_working_revision_id = NULL WHERE organization_id = $1`,
        [org]
      );
      // `artifact_lifecycle_events` jest append-only (trigger
      // `trg_artifact_lifecycle_events_deny_delete`). Sprzątanie fixtury musi
      // ten trigger na moment wyłączyć — inaczej zostawiłoby wiersze, przez
      // które nie da się usunąć artefaktów ani organizacji, i „probe" nie
      // sprzątnąłby po sobie. Trigger wraca natychmiast po DELETE.
      await pool.query(
        `ALTER TABLE artifact_lifecycle_events DISABLE TRIGGER trg_artifact_lifecycle_events_deny_delete`
      );
      try {
        await pool.query(`DELETE FROM artifact_lifecycle_events WHERE organization_id = $1`, [org]);
      } finally {
        await pool.query(
          `ALTER TABLE artifact_lifecycle_events ENABLE TRIGGER trg_artifact_lifecycle_events_deny_delete`
        );
      }
      await pool.query(`DELETE FROM finance_working_revisions WHERE organization_id = $1`, [org]);
      await pool.query(`DELETE FROM finance_business_versions WHERE organization_id = $1`, [org]);
      await pool.query(`DELETE FROM finance_artifacts WHERE organization_id = $1`, [org]);
      await pool.query(`DELETE FROM financial_models WHERE organization_id = $1`, [org]);
      await pool.query(`DELETE FROM valuations WHERE organization_id = $1`, [org]);
      await pool.query(`DELETE FROM financial_analyses WHERE organization_id = $1`, [org]);
    }
    await pool.query(`DELETE FROM users WHERE id = $1`, [USER]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG, OTHER_ORG]]);
    await pool.end();
  }, 120000);

  it('0) STAN SPRZED NAPRAWY: sam odczyt mostu zwraca NOT_MIGRATED dla realnego rekordu bez wiersza mostu', async () => {
    const before = await resolveLegacyFinanceArtifact(ORG, 'financial_analyses', analysisId);
    expect(before).toEqual({ status: 'NOT_MIGRATED' });
    const aliases = await pool.query(
      `SELECT count(*)::int AS c FROM finance_artifact_aliases WHERE organization_id = $1`,
      [ORG]
    );
    expect(aliases.rows[0].c).toBe(0);
  });

  it('1) most rozwiązuje się bez wiersza mostu — materializacja zakłada tożsamość i odczyt ją widzi', async () => {
    const ensured = await ensureLegacyFinanceArtifactIdentity({
      organizationId: ORG,
      userId: USER,
      legacyTable: 'financial_analyses',
      legacyId: analysisId,
      expectedArtifactType: 'HISTORICAL_ANALYSIS',
    });
    expect(ensured.status).toBe('RESOLVED');
    if (ensured.status !== 'RESOLVED') return;
    expect(ensured.artifactType).toBe('HISTORICAL_ANALYSIS');
    expect(ensured.businessVersionId).toBeTruthy();
    expect(ensured.created).toBe(true);

    // Ta sama odpowiedź musi teraz przyjść ze strony ODCZYTU — to jest to, co
    // czyta bramka na ekranie.
    const resolved = await resolveLegacyFinanceArtifact(ORG, 'financial_analyses', analysisId, {
      expectedArtifactType: 'HISTORICAL_ANALYSIS',
    });
    expect(resolved).toMatchObject({
      status: 'RESOLVED',
      artifactId: ensured.artifactId,
      artifactType: 'HISTORICAL_ANALYSIS',
    });
  });

  it('2) powtórzone otwarcie tego samego rekordu nie tworzy drugiego artefaktu', async () => {
    const first = await ensureLegacyFinanceArtifactIdentity({
      organizationId: ORG,
      userId: USER,
      legacyTable: 'valuations',
      legacyId: valuationId,
      expectedArtifactType: 'VALUATION_CASE',
    });
    const second = await ensureLegacyFinanceArtifactIdentity({
      organizationId: ORG,
      userId: USER,
      legacyTable: 'valuations',
      legacyId: valuationId,
      expectedArtifactType: 'VALUATION_CASE',
    });
    expect(first.status).toBe('RESOLVED');
    expect(second.status).toBe('RESOLVED');
    if (first.status !== 'RESOLVED' || second.status !== 'RESOLVED') return;
    expect(second.artifactId).toBe(first.artifactId);
    expect(second.created).toBe(false);

    const artifacts = await pool.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM finance_artifacts
        WHERE organization_id = $1 AND artifact_type = 'VALUATION_CASE' AND artifact_id = $2`,
      [ORG, first.artifactId]
    );
    expect(artifacts.rows[0].c).toBe(1);
    // Nazwa artefaktu to NAZWA rekordu widziana przez właściciela, nie ciąg
    // `valuations:<uuid>` — `natural_key` jest w tym kodzie tytułem (pasek
    // tożsamości zapisuje właśnie ją przy zmianie nazwy).
    const named = await pool.query<{ natural_key: string | null }>(
      `SELECT natural_key FROM finance_artifacts WHERE artifact_id = $1`,
      [first.artifactId]
    );
    expect(named.rows[0].natural_key).toBe('Wycena spolki');
    const aliases = await pool.query(
      `SELECT count(*)::int AS c FROM finance_artifact_aliases
        WHERE organization_id = $1 AND legacy_table = 'valuations' AND legacy_id = $2`,
      [ORG, valuationId]
    );
    expect(aliases.rows[0].c).toBe(1);
  });

  it('3) backfill jest idempotentny — drugi przebieg nie tworzy ani jednego wiersza', async () => {
    const first = await runFinanceBridgeBackfill({
      client: pool,
      organizationId: ORG,
      write: true,
    });
    const artifactsAfterFirst = await pool.query(
      `SELECT count(*)::int AS c FROM finance_artifacts WHERE organization_id = $1`,
      [ORG]
    );
    const aliasesAfterFirst = await pool.query(
      `SELECT count(*)::int AS c FROM finance_artifact_aliases WHERE organization_id = $1`,
      [ORG]
    );

    const second = await runFinanceBridgeBackfill({
      client: pool,
      organizationId: ORG,
      write: true,
    });
    const artifactsAfterSecond = await pool.query(
      `SELECT count(*)::int AS c FROM finance_artifacts WHERE organization_id = $1`,
      [ORG]
    );
    const aliasesAfterSecond = await pool.query(
      `SELECT count(*)::int AS c FROM finance_artifact_aliases WHERE organization_id = $1`,
      [ORG]
    );

    expect(first.total.failed).toBe(0);
    expect(second.total.failed).toBe(0);
    // Drugi przebieg nie ma już nawet kandydatów (alias istnieje dla każdego wiersza).
    expect(second.total.candidates).toBe(0);
    expect(second.total.created).toBe(0);
    expect(artifactsAfterSecond.rows[0].c).toBe(artifactsAfterFirst.rows[0].c);
    expect(aliasesAfterSecond.rows[0].c).toBe(aliasesAfterFirst.rows[0].c);
  });

  it('4) fail-closed: zmyślone id nigdy nie dostaje tożsamości', async () => {
    const ghost = randomUUID();
    const result = await ensureLegacyFinanceArtifactIdentity({
      organizationId: ORG,
      userId: USER,
      legacyTable: 'financial_models',
      legacyId: ghost,
      expectedArtifactType: 'BASELINE_MODEL',
    });
    expect(result).toEqual({ status: 'NOT_MIGRATED' });
    const rows = await pool.query(
      `SELECT count(*)::int AS c FROM finance_artifact_aliases WHERE legacy_id = $1`,
      [ghost]
    );
    expect(rows.rows[0].c).toBe(0);
  });

  it('5) fail-closed: rekord cudzej organizacji nie dostaje tożsamości w mojej', async () => {
    const result = await ensureLegacyFinanceArtifactIdentity({
      organizationId: ORG,
      userId: USER,
      legacyTable: 'financial_models',
      legacyId: foreignModelId,
      expectedArtifactType: 'BASELINE_MODEL',
    });
    expect(result).toEqual({ status: 'NOT_MIGRATED' });
    const rows = await pool.query(
      `SELECT count(*)::int AS c FROM finance_artifact_aliases
        WHERE legacy_id = $1 AND organization_id = $2`,
      [foreignModelId, ORG]
    );
    expect(rows.rows[0].c).toBe(0);
  });

  it('6) Wycena: artefakt ma ustawione current_business_version_id (przyczyna 409 LEGACY_IDENTITY_UNMAPPED)', async () => {
    const resolved = await resolveLegacyFinanceArtifact(ORG, 'valuations', valuationId, {
      expectedArtifactType: 'VALUATION_CASE',
    });
    expect(resolved.status).toBe('RESOLVED');
    if (resolved.status !== 'RESOLVED') return;
    const row = await pool.query<{ current_business_version_id: string | null }>(
      `SELECT current_business_version_id FROM finance_artifacts
        WHERE artifact_id = $1 AND organization_id = $2`,
      [resolved.artifactId, ORG]
    );
    expect(row.rows[0].current_business_version_id).toBe(resolved.businessVersionId);
  });

  it('7) jeden wiersz financial_models karmi DWA warsztaty — Baseline i Predykcja dostają rozłączne tożsamości', async () => {
    const baseline = await ensureLegacyFinanceArtifactIdentity({
      organizationId: ORG,
      userId: USER,
      legacyTable: 'financial_models',
      legacyId: modelId,
      expectedArtifactType: 'BASELINE_MODEL',
    });
    const prediction = await ensureLegacyFinanceArtifactIdentity({
      organizationId: ORG,
      userId: USER,
      legacyTable: 'financial_models',
      legacyId: modelId,
      expectedArtifactType: 'PREDICTION_SCENARIO',
    });
    expect(baseline.status).toBe('RESOLVED');
    expect(prediction.status).toBe('RESOLVED');
    if (baseline.status !== 'RESOLVED' || prediction.status !== 'RESOLVED') return;
    expect(prediction.artifactId).not.toBe(baseline.artifactId);

    // Strona odczytu musi oddać KAŻDEMU warsztatowi jego własny artefakt,
    // inaczej ekran zgłasza IDENTITY_MISMATCH zamiast się pokazać.
    await expect(
      resolveLegacyFinanceArtifact(ORG, 'financial_models', modelId, {
        expectedArtifactType: 'BASELINE_MODEL',
      })
    ).resolves.toMatchObject({ artifactId: baseline.artifactId, artifactType: 'BASELINE_MODEL' });
    await expect(
      resolveLegacyFinanceArtifact(ORG, 'financial_models', modelId, {
        expectedArtifactType: 'PREDICTION_SCENARIO',
      })
    ).resolves.toMatchObject({
      artifactId: prediction.artifactId,
      artifactType: 'PREDICTION_SCENARIO',
    });
  });

  it('9) KAŻDY nowy artefakt kanoniczny (także z rejestracji Wyceny) ma od razu wskaźnik bieżącej wersji', async () => {
    // Do 2026-09-05 nic w kodzie produkcyjnym nie ustawiało tej kolumny — a
    // `valuationLegacySuccessorService.pinnedIdentity` jej WYMAGA, więc nawet
    // poprawnie zarejestrowana wycena odpowiadała 409 LEGACY_IDENTITY_UNMAPPED.
    const { createArtifact } = await import(
      '../../server/src/services/finance/canonical/artifactVersionService'
    );
    const created = await createArtifact({
      organizationId: ORG,
      artifactType: 'VALUATION_CASE',
      naturalKey: `valuations:probe-${randomUUID()}`,
      createdBy: USER,
    });
    const row = await pool.query<{ current_business_version_id: string | null }>(
      `SELECT current_business_version_id FROM finance_artifacts WHERE artifact_id = $1`,
      [created.artifact.artifact_id]
    );
    expect(row.rows[0].current_business_version_id).toBe(
      created.businessVersion.business_version_id
    );
  });

  it('8) kwarantanna nie jest obchodzona — świadomie wykluczony rekord zostaje wykluczony', async () => {
    const quarantinedId = `fingate-quarantined-${randomUUID()}`;
    await pool.query(
      `INSERT INTO financial_analyses (id, organization_id, title, created_by)
       VALUES ($1, $2, 'Analiza w kwarantannie', $3)`,
      [quarantinedId, ORG, USER]
    );
    const seed = await ensureLegacyFinanceArtifactIdentity({
      organizationId: ORG,
      userId: USER,
      legacyTable: 'financial_analyses',
      legacyId: quarantinedId,
      expectedArtifactType: 'HISTORICAL_ANALYSIS',
    });
    expect(seed.status).toBe('RESOLVED');
    await pool.query(
      `UPDATE finance_artifact_aliases
          SET mapping_confidence = 'QUARANTINE', mapping_reason = 'approved_without_snapshot'
        WHERE organization_id = $1 AND legacy_table = 'financial_analyses' AND legacy_id = $2`,
      [ORG, quarantinedId]
    );

    const again = await ensureLegacyFinanceArtifactIdentity({
      organizationId: ORG,
      userId: USER,
      legacyTable: 'financial_analyses',
      legacyId: quarantinedId,
      expectedArtifactType: 'HISTORICAL_ANALYSIS',
    });
    expect(again).toMatchObject({
      status: 'QUARANTINED',
      mappingConfidence: 'QUARANTINE',
      reason: 'approved_without_snapshot',
    });
  });
});
