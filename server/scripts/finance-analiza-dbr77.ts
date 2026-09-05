/**
 * F-P4/F-P5 — analiza historyczna DBR77 z istniejącego pakietu sprawozdań.
 *
 * Robi DOKŁADNIE to, co robi UI (te same serwisy kanoniczne, zero surowego SQL-a zapisującego):
 *   `artifactVersionService.createArtifact` → `lineageService.insertEdge` (`STATEMENT_TO_ANALYSIS`)
 *   → `analysisDefinitionService.createAnalysisDefinitionWithSelection` (F-P4)
 *   → `kpiComputeService.computeAnalysisKpis`.
 *
 * Użycie:
 *   DATABASE_URL=… npx tsx server/scripts/finance-analiza-dbr77.ts --dry-run
 *   DATABASE_URL=… npx tsx server/scripts/finance-analiza-dbr77.ts --apply --pack=<businessVersionId>
 *
 * Opcje: `--org=<id|fragment nazwy>` (domyślnie `DBR77`), `--pack=<businessVersionId>`,
 *        `--name="…"`, `--dry-run` (domyślne), `--apply`.
 *
 * `--dry-run` NIC nie zapisuje: czyta pakiety organizacji, liczy okresy/jednostki/linie i mówi,
 * ile wierszy wskaźników POWSTAŁOBY (|katalog| × |okresy| × |jednostki|) albo co blokuje.
 * Na stagingu wolno uruchamiać WYŁĄCZNIE `--dry-run`; `--apply` odpala nadzorca.
 */
import {
  createArtifact,
  getBusinessVersion,
} from '../src/services/finance/canonical/artifactVersionService.js';
import { createAnalysisDefinitionWithSelection } from '../src/services/finance/canonical/analysisDefinitionService.js';
import { computeAnalysisKpis } from '../src/services/finance/canonical/kpiComputeService.js';
import { insertEdge } from '../src/services/finance/canonical/lineageService.js';
import { withPgTransaction } from '../src/utils/queryHelpers.js';
import { withPinnedPostgresTransaction } from '../src/database/PostgresDatabase.js';

interface PackRow {
  business_version_id: string;
  artifact_id: string;
  natural_key: string | null;
  status: string;
  created_at: string;
  entity_count: number;
  period_count: number;
  line_count: number;
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf('=');
  return eq === -1 ? '' : hit.slice(eq + 1);
}

async function resolveOrganization(needle: string): Promise<{ id: string; name: string } | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM organizations
        WHERE id = ? OR name ILIKE ?
        ORDER BY (id = ?) DESC, length(name)
        LIMIT 1`,
      [needle, `%${needle}%`, needle]
    )
  );
}

async function loadPacks(organizationId: string): Promise<PackRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<PackRow>(
      `SELECT bv.business_version_id, bv.artifact_id, a.natural_key, bv.status,
              bv.created_at::text AS created_at,
              (SELECT count(*)::int FROM finance_stmt_entities e
                WHERE e.business_version_id = bv.business_version_id) AS entity_count,
              (SELECT count(DISTINCT l.period_id)::int FROM finance_stmt_lines l
                WHERE l.business_version_id = bv.business_version_id) AS period_count,
              (SELECT count(*)::int FROM finance_stmt_lines l
                WHERE l.business_version_id = bv.business_version_id) AS line_count
         FROM finance_business_versions bv
         JOIN finance_artifacts a
           ON a.artifact_id = bv.artifact_id AND a.organization_id = bv.organization_id
        WHERE bv.organization_id = ? AND a.artifact_type = 'STATEMENT_PACK'
        ORDER BY bv.created_at DESC`,
      [organizationId]
    )
  );
}

async function loadCatalogCount(organizationId: string): Promise<number> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ count: string }>(
      `SELECT count(*) AS count FROM finance_analysis_kpi_catalog
        WHERE status = 'ACTIVE'
          AND ((tier = 'UNIVERSAL' AND organization_id IS NULL)
               OR (tier = 'ORG_CUSTOM' AND organization_id = ?))`,
      [organizationId]
    )
  );
  return Number(row?.count ?? 0);
}

async function resolveActor(organizationId: string): Promise<string> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ user_id: string }>(
      `SELECT user_id FROM organization_members
        WHERE organization_id = ? AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
        ORDER BY CASE UPPER(role) WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END
        LIMIT 1`,
      [organizationId]
    )
  );
  return row?.user_id ?? 'script:finance-analiza-dbr77';
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const orgNeedle = arg('org') || 'DBR77';
  const packArg = arg('pack');
  const nameArg = arg('name');

  const dbHost = (() => {
    try {
      return new URL(String(process.env.DATABASE_URL || '')).host;
    } catch {
      return '(brak DATABASE_URL)';
    }
  })();
  console.log(`# Tryb: ${apply ? 'APPLY (ZAPIS)' : 'DRY-RUN (tylko odczyt)'}   baza: ${dbHost}`);

  const org = await resolveOrganization(orgNeedle);
  if (!org) {
    console.error(`BŁĄD: nie znaleziono organizacji dla "${orgNeedle}".`);
    process.exitCode = 1;
    return;
  }
  console.log(`# Organizacja: ${org.name} (${org.id})`);

  const packs = await loadPacks(org.id);
  const catalogCount = await loadCatalogCount(org.id);
  console.log(`# Aktywny katalog wskaźników: ${catalogCount}`);
  console.log(`# Pakiety sprawozdań (STATEMENT_PACK): ${packs.length}`);
  for (const pack of packs) {
    console.log(
      `  - ${pack.business_version_id} | ${pack.status} | jednostki=${pack.entity_count} ` +
        `okresy=${pack.period_count} linie=${pack.line_count} | ${pack.natural_key ?? '(bez nazwy)'} | ${pack.created_at}`
    );
  }

  const usable = packs.filter((p) => p.entity_count > 0 && p.period_count > 0);
  const chosen = packArg
    ? packs.find((p) => p.business_version_id === packArg)
    : usable.sort((a, b) => {
        const rank = (s: string) => (s === 'APPROVED' ? 0 : s === 'READY_FOR_REVIEW' ? 1 : 2);
        return rank(a.status) - rank(b.status) || (a.created_at < b.created_at ? 1 : -1);
      })[0];

  if (!chosen) {
    console.log('');
    console.log('WYNIK: BLOKADA — nie ma pakietu, z którego da się zrobić analizę.');
    console.log(
      'Przyczyna: żaden pakiet nie ma jednostek sprawozdawczych i okresów z danymi ' +
        '(`finance_stmt_entities` / `finance_stmt_lines`). Producent tych wierszy to ogniwo F-M5 ' +
        '(import zakłada kalendarz i okresy) — dopóki nie jest scalone, analiza nie ma czego liczyć.'
    );
    process.exitCode = 2;
    return;
  }

  const expectedRows = catalogCount * chosen.period_count * chosen.entity_count;
  console.log('');
  console.log(`# Wybrany pakiet: ${chosen.business_version_id} (${chosen.status})`);
  console.log(
    `# Powstałoby wierszy wskaźników: ${catalogCount} × ${chosen.period_count} okresów × ` +
      `${chosen.entity_count} jednostek = ${expectedRows}`
  );

  if (!apply) {
    console.log('');
    console.log('DRY-RUN: nic nie zapisano. Komenda zapisu dla nadzorcy:');
    console.log(
      `  DATABASE_URL=… npx tsx server/scripts/finance-analiza-dbr77.ts --apply --org=${org.id} --pack=${chosen.business_version_id}`
    );
    return;
  }

  const actorId = await resolveActor(org.id);
  const analysisName = nameArg || `Analiza: ${chosen.natural_key ?? 'pakiet sprawozdań'}`;

  // IDEMPOTENCJA (poprawka F-M5). `finance_artifacts` ma `uq_finance_artifacts_org_natural_key`,
  // a `createArtifact` nie ma `ON CONFLICT` — powtórny `--apply` na tym samym pakiecie padał
  // z „duplicate key value violates unique constraint uq_finance_artifacts_org_natural_key"
  // (zmierzone). Jeśli analiza o tym kluczu już istnieje, wchodzimy w tryb POWTÓRKI: nie
  // tworzymy drugiego artefaktu, tylko dokładamy brakujące wiersze selekcji i przeliczamy je.
  const analysisNaturalKey = `derived-analysis:script:${chosen.business_version_id}`;
  const existingAnalysis = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ artifact_id: string; business_version_id: string }>(
      `SELECT a.artifact_id, bv.business_version_id
         FROM finance_artifacts a
         JOIN finance_business_versions bv
           ON bv.artifact_id = a.artifact_id AND bv.organization_id = a.organization_id
        WHERE a.organization_id = ? AND a.natural_key = ?
        ORDER BY bv.version_no DESC LIMIT 1`,
      [org.id, analysisNaturalKey]
    )
  );

  const created = existingAnalysis
    ? await (async () => {
        console.log(
          `# Analiza o tym kluczu już istnieje: ${existingAnalysis.business_version_id} — tryb POWTÓRKI.`
        );
        const selection = await createAnalysisDefinitionWithSelection({
          organizationId: org.id,
          analysisBusinessVersionId: existingAnalysis.business_version_id,
          sourceStatementPackVersionId: chosen.business_version_id,
          createdBy: await resolveActor(org.id),
          analysisName: nameArg || `Analiza: ${chosen.natural_key ?? 'pakiet sprawozdań'}`,
        });
        if (!selection.ok) throw new Error(`${selection.code}: ${selection.message}`);
        return {
          analysisBvId: existingAnalysis.business_version_id,
          artifactId: existingAnalysis.artifact_id,
          selection: selection.summary,
        };
      })()
    : await withPgTransaction(async () => {
    const artifact = await createArtifact({
      organizationId: org.id,
      artifactType: 'HISTORICAL_ANALYSIS',
      naturalKey: analysisNaturalKey,
      createdBy: actorId,
    });
    const analysisBvId = artifact.businessVersion.business_version_id;
    const edge = await insertEdge({
      organizationId: org.id,
      sourceVersionId: chosen.business_version_id,
      sourceArtifactType: 'STATEMENT_PACK',
      targetVersionId: analysisBvId,
      targetArtifactType: 'HISTORICAL_ANALYSIS',
      edgeType: 'STATEMENT_TO_ANALYSIS',
      transformationKind: 'MANUAL_LINK',
      authorId: actorId,
    });
    if (!edge.ok) throw new Error(`krawędź rodowodu odrzucona: ${edge.code}`);
    const selection = await createAnalysisDefinitionWithSelection({
      organizationId: org.id,
      analysisBusinessVersionId: analysisBvId,
      sourceStatementPackVersionId: chosen.business_version_id,
      createdBy: actorId,
      analysisName,
    });
    if (!selection.ok) throw new Error(`${selection.code}: ${selection.message}`);
    return { analysisBvId, artifactId: artifact.artifact.artifact_id, selection: selection.summary };
  });

  console.log(`# Utworzono analizę ${created.analysisBvId} (artefakt ${created.artifactId})`);
  console.log(`# Wiersze selekcji: ${created.selection.selectionRowsTotal}`);

  const computed = await computeAnalysisKpis({
    organizationId: org.id,
    businessVersionId: created.analysisBvId,
    requestedByUserId: actorId,
  });
  if (!computed.ok) {
    console.error(`BŁĄD compute: ${computed.code} — ${computed.message}`);
    process.exitCode = 3;
    return;
  }
  console.log(`# Przeliczono wskaźników: ${computed.results.length}`);

  const filled = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ count: string }>(
      `SELECT count(*) AS count FROM finance_analysis_kpi_values
        WHERE business_version_id = ? AND value_decimal IS NOT NULL`,
      [created.analysisBvId]
    )
  );
  console.log(`# Komórek z realną wartością (odczyt na zimno): ${Number(filled?.count ?? 0)}`);

  const bv = await getBusinessVersion(org.id, created.analysisBvId);
  console.log(`# Status analizy: ${bv?.status ?? '(nieznany)'}`);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error('BŁĄD:', error?.message || error);
    process.exit(1);
  });
