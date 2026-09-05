/**
 * F-M5 — backfill kanoniczny DBR77: z toru legacy (`financial_statements` +
 * `financial_statement_values`) buduje JEDEN pakiet kanoniczny z kalendarzem, okresami,
 * jednostką i liniami (`finance_stmt_lines`), po czym analiza (F-P4/F-P5) ma na czym stanąć.
 *
 * DLACZEGO ISTNIEJE. Pomiar stagingu 05.09.2026: DBR77 ma 5 pakietów kanonicznych DRAFT
 * z 0 okresów / 0 jednostek / 0 linii, a realne dane P&L/BS/CF 2023-2025 leżą WYŁĄCZNIE
 * w torze legacy. Ogniwo 1 (F-M5) naprawia PRZYSZŁE importy; ten skrypt przenosi to,
 * co już zaimportowano, bez proszenia właściciela o powtórzenie ładowania plików.
 *
 * TE SAME SERWISY, CO IMPORT Z UI — zero surowego SQL-a zapisującego dane merytoryczne:
 *   `artifactVersionService.createArtifact`            (tożsamość kanoniczna)
 *   `financeCalendarService.ensureStatementPackTemporalContext`  (kalendarz + okresy + jednostka)
 *   `statementMappingService.mapStatementLines`        (mapper importu: etykieta → linia kanoniczna)
 *   `lineageService.insertEdge`                         (krawędź LEGACY_MIGRATION do pakietu)
 * Reguły mapowania NIE są wymyślane: powstają z decyzji, które ktoś już podjął w torze legacy
 * (`financial_statement_values.canonical_line_id`). Pozycja bez tej decyzji trafia do mappera
 * BEZ reguły, więc wraca jako `UNMAPPED` i ląduje na liście „niemapowane" — nigdy nie jest
 * zgadywana ani po cichu pomijana.
 *
 * UŻYCIE:
 *   DATABASE_URL=… npx tsx server/scripts/finance-backfill-dbr77.ts --dry-run --org=<id>
 *   DATABASE_URL=… npx tsx server/scripts/finance-backfill-dbr77.ts --apply   --org=<id>
 *   DATABASE_URL=… npx tsx server/scripts/finance-backfill-dbr77.ts --rollback --org=<id> [--cascade]
 * Opcje: `--org=<id|fragment nazwy>` (domyślnie DBR77), `--entity=<fragment entity_name>`
 *        (domyślnie ten sam fragment co `--org`; jedna organizacja bywa workiem na kilka firm —
 *        na stagingu obok DBR77 leżą sprawozdania CD PROJEKT i Tesli), `--years=2023,2024,2025`,
 *        `--tag=<klucz naturalny>`.
 *
 * IDEMPOTENCJA. Klucz naturalny artefaktu = `<tag>:<organizationId>:<entityCode>`
 * (domyślny tag `seed:finance-backfill-dbr77-20260905`). Powtórny `--apply` znajduje ten sam
 * artefakt, `ensureStatementPackTemporalContext` nie zakłada drugiego kompletu okresów, a mapper
 * pisze `ON CONFLICT ON CONSTRAINT uq_finance_stmt_lines_cell DO UPDATE` w tę samą komórkę —
 * czyli 0 NOWYCH wierszy.
 *
 * CZEGO NIE ROBI. Nie kasuje 5 pustych pakietów DRAFT DBR77 (wypisuje ich id — decyzja o ich
 * losie należy do właściciela). Nie zmienia toru legacy. Nie zatwierdza wersji (APPROVED to
 * ogniwo 2, F-M6). Na stagingu wolno uruchamiać wyłącznie `--dry-run`; `--apply` odpala nadzorca.
 */
import {
  createArtifact,
  type CreateArtifactResult,
} from '../src/services/finance/canonical/artifactVersionService.js';
import {
  ensureStatementPackTemporalContext,
  entityCodeFromName,
  type EnsuredPeriod,
} from '../src/services/finance/canonical/financeCalendarService.js';
import {
  mapStatementLines,
  type FinanceUnit,
  type MappedRowResult,
  type MappingRule,
  type RawStatementLine,
  type StatementType,
} from '../src/services/finance/canonical/statementMappingService.js';
import { withPinnedPostgresTransaction } from '../src/database/PostgresDatabase.js';
import { withPgTransaction } from '../src/utils/queryHelpers.js';

const DEFAULT_TAG = 'seed:finance-backfill-dbr77-20260905';

interface LegacyStatement {
  id: string;
  entity_name: string | null;
  statement_type: StatementType;
  period_start: string;
  period_end: string;
  period_label: string | null;
  currency: string | null;
  scaling: string | null;
  status: string | null;
  created_at: string;
  value_count: number;
  mapped_value_count: number;
}

interface LegacyValue {
  id: string;
  original_label: string | null;
  value: number | null;
  canonical_line_id: string | null;
  line_code: string | null;
  line_statement_type: StatementType | null;
  source_page: number | null;
  source_row: number | null;
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf('=');
  return eq === -1 ? '' : hit.slice(eq + 1);
}

function unitFromScaling(scaling: string | null | undefined): FinanceUnit {
  switch (String(scaling || '').toLowerCase()) {
    case 'thousands':
      return 'THOUSANDS';
    case 'millions':
      return 'MILLIONS';
    case 'billions':
      return 'BILLIONS';
    default:
      return 'UNITS';
  }
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
  return row?.user_id ?? 'script:finance-backfill-dbr77';
}

async function loadLegacyStatements(organizationId: string): Promise<LegacyStatement[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<LegacyStatement>(
      `SELECT fs.id, fs.entity_name, fs.statement_type,
              fs.period_start::text AS period_start, fs.period_end::text AS period_end,
              fs.period_label, fs.currency, fs.scaling, fs.status,
              fs.created_at::text AS created_at,
              (SELECT count(*)::int FROM financial_statement_values v WHERE v.statement_id = fs.id) AS value_count,
              (SELECT count(*)::int FROM financial_statement_values v
                WHERE v.statement_id = fs.id AND v.canonical_line_id IS NOT NULL) AS mapped_value_count
         FROM financial_statements fs
        WHERE fs.organization_id = ?
          AND COALESCE(fs.status, 'draft') <> 'archived'
          AND fs.period_start IS NOT NULL AND fs.period_end IS NOT NULL
        ORDER BY fs.period_start, fs.statement_type, fs.created_at DESC`,
      [organizationId]
    )
  );
}

async function loadValues(statementId: string): Promise<LegacyValue[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<LegacyValue>(
      `SELECT v.id, v.original_label, v.value, v.canonical_line_id,
              csl.line_code, csl.statement_type AS line_statement_type,
              v.source_page, v.source_row
         FROM financial_statement_values v
         LEFT JOIN financial_statement_lines csl ON csl.id = v.canonical_line_id
        WHERE v.statement_id = ?
        ORDER BY v.source_row NULLS LAST, v.id`,
      [statementId]
    )
  );
}

/** Pakiety kanoniczne organizacji z licznikami — do raportu „czego NIE ruszam". */
async function loadCanonicalPacks(organizationId: string) {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{
      business_version_id: string;
      natural_key: string | null;
      status: string;
      entity_count: number;
      period_count: number;
      line_count: number;
    }>(
      `SELECT bv.business_version_id, a.natural_key, bv.status,
              (SELECT count(*)::int FROM finance_stmt_entities e
                WHERE e.business_version_id = bv.business_version_id) AS entity_count,
              (SELECT count(DISTINCT l.period_id)::int FROM finance_stmt_lines l
                WHERE l.business_version_id = bv.business_version_id) AS period_count,
              (SELECT count(*)::int FROM finance_stmt_lines l
                WHERE l.business_version_id = bv.business_version_id) AS line_count
         FROM finance_business_versions bv
         JOIN finance_artifacts a ON a.artifact_id = bv.artifact_id
        WHERE bv.organization_id = ? AND a.artifact_type = 'STATEMENT_PACK'
        ORDER BY bv.created_at`,
      [organizationId]
    )
  );
}

async function findExistingPack(
  organizationId: string,
  naturalKey: string
): Promise<{ artifactId: string; businessVersionId: string } | null> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ artifact_id: string; business_version_id: string }>(
      `SELECT a.artifact_id, bv.business_version_id
         FROM finance_artifacts a
         JOIN finance_business_versions bv
           ON bv.artifact_id = a.artifact_id AND bv.organization_id = a.organization_id
        WHERE a.organization_id = ? AND a.natural_key = ?
        ORDER BY bv.version_no DESC
        LIMIT 1`,
      [organizationId, naturalKey]
    )
  );
  return row ? { artifactId: row.artifact_id, businessVersionId: row.business_version_id } : null;
}

/** Deduplikacja: jeden (typ sprawozdania × okres) = jedno sprawozdanie, najnowsze wygrywa. */
function pickStatements(statements: LegacyStatement[]): LegacyStatement[] {
  const byKey = new Map<string, LegacyStatement>();
  for (const statement of statements) {
    const key = `${statement.statement_type}::${statement.period_start}::${statement.period_end}`;
    const current = byKey.get(key);
    if (!current || statement.created_at > current.created_at) byKey.set(key, statement);
  }
  return Array.from(byKey.values()).sort(
    (a, b) =>
      a.period_start.localeCompare(b.period_start) ||
      a.statement_type.localeCompare(b.statement_type)
  );
}

interface StatementPlan {
  statement: LegacyStatement;
  values: LegacyValue[];
  rules: MappingRule[];
  rawLines: RawStatementLine[];
  /** Pozycje bez decyzji mapowania w torze legacy — pójdą do mappera jako UNMAPPED. */
  unmappedLabels: string[];
  /** Ta sama etykieta wskazuje dwie różne linie kanoniczne — reguła jest niejednoznaczna. */
  labelCollisions: string[];
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function planStatement(statement: LegacyStatement): Promise<StatementPlan> {
  const values = await loadValues(statement.id);
  const rulesByLabel = new Map<string, MappingRule>();
  const rawLines: RawStatementLine[] = [];
  const unmappedLabels: string[] = [];
  const labelCollisions: string[] = [];

  for (const value of values) {
    const label =
      String(value.original_label || '').trim() ||
      String(value.line_code || '').trim() ||
      `poz. ${value.source_row ?? value.id}`;
    rawLines.push({
      lineItem: label,
      periodId: '', // wypełniane po założeniu okresów
      entityCode: '', // j.w.
      currency: String(statement.currency || 'PLN').toUpperCase(),
      value: value.value === null || value.value === undefined ? null : Number(value.value),
      sourceRef: {
        source_document_ref: `financial_statements:${statement.id}`,
        legacy_value_id: value.id,
        page: value.source_page,
        row: value.source_row,
        raw_label: value.original_label,
      },
    });
    if (!value.canonical_line_id || !value.line_code || !value.line_statement_type) {
      unmappedLabels.push(label);
      continue;
    }
    const key = normalizeLabel(label);
    const existing = rulesByLabel.get(key);
    if (existing && existing.lineCode !== value.line_code) {
      labelCollisions.push(`${label} → ${existing.lineCode} / ${value.line_code}`);
      continue;
    }
    rulesByLabel.set(key, {
      sourceLabel: label,
      statementType: value.line_statement_type,
      lineCode: value.line_code,
      action: 'MAP',
      consolidationScope: 'CONSOLIDATED',
      signConvention: 'NATURAL',
      accountingPolicy: 'IFRS',
    });
  }

  return {
    statement,
    values,
    rules: Array.from(rulesByLabel.values()),
    rawLines,
    unmappedLabels,
    labelCollisions,
  };
}

function bucketCounts(results: MappedRowResult[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const result of results) counts[result.bucket] = (counts[result.bucket] || 0) + 1;
  return counts;
}

/**
 * Cofnięcie backfillu. GRANICA, KTÓREJ NIE PRZEKRACZAM: `finance_lineage_edges` jest
 * APPEND-ONLY na poziomie bazy (trigger odmawia `DELETE`: „finance_lineage_edges is append-only" —
 * zmierzone, nie założone). Dlatego rollback kasuje DANE, które ten skrypt zapisał (linie,
 * jednostkę, osierocone okresy i kalendarz), a tożsamość kanoniczną (artefakt + wersję) usuwa
 * TYLKO wtedy, gdy nie wisi na niej ani jedna krawędź rodowodu. Gdy wisi — zostaje pusta skorupa
 * i jest to powiedziane wprost, zamiast udawać czyste cofnięcie.
 */
async function rollback(
  organizationId: string,
  naturalKey: string,
  cascade: boolean
): Promise<void> {
  const existing = await findExistingPack(organizationId, naturalKey);
  if (!existing) {
    console.log(`# Nie ma czego cofać — brak artefaktu o kluczu ${naturalKey}.`);
    return;
  }

  // Zależności w dół grafu: analiza trzyma FK na JEDNOSTKĘ pakietu
  // (`finance_analysis_kpi_values.entity_id`), więc bezwarunkowy rollback wywróciłby się na FK
  // albo — gorzej — cicho usunął cudzą pracę. Domyślnie ODMAWIAM i mówię, co blokuje.
  const dependents = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ business_version_id: string; rows: string }>(
      `SELECT k.business_version_id, count(*)::text AS rows
         FROM finance_analysis_kpi_values k
        WHERE k.entity_id IN (SELECT id FROM finance_stmt_entities WHERE business_version_id = ?)
        GROUP BY k.business_version_id`,
      [existing.businessVersionId]
    )
  );
  if (dependents.length > 0) {
    console.log(`# Analizy zbudowane na tym pakiecie: ${dependents.length}`);
    for (const dependent of dependents) {
      console.log(`  - ${dependent.business_version_id} (${dependent.rows} wierszy wskaźników)`);
    }
    if (!cascade) {
      console.error(
        'ODMOWA: pakiet ma zależne analizy. Rollback skasowałby cudzą pracę po cichu. ' +
          'Świadome cofnięcie razem z ich wynikami: dopisz --cascade.'
      );
      process.exitCode = 3;
      return;
    }
    await withPgTransaction(async (tx) => {
      for (const dependent of dependents) {
        await tx.query(`DELETE FROM finance_analysis_kpi_values WHERE business_version_id = ?`, [
          dependent.business_version_id,
        ]);
        await tx.query(`DELETE FROM finance_analysis_definitions WHERE business_version_id = ?`, [
          dependent.business_version_id,
        ]);
      }
    });
    console.log(
      `# Wyczyszczono wyniki ${dependents.length} analiz (--cascade). ` +
        'Artefakty analiz ZOSTAJĄ — krawędzie rodowodu są append-only i trzymają ich wersje.'
    );
  }

  await withPgTransaction(async (tx) => {
    await tx.query(`DELETE FROM finance_stmt_lines WHERE business_version_id = ?`, [
      existing.businessVersionId,
    ]);
    await tx.query(`DELETE FROM finance_stmt_entities WHERE business_version_id = ?`, [
      existing.businessVersionId,
    ]);
  });

  // Okresy i kalendarz są WSPÓLNE dla organizacji i addytywne (§8 paczki F-M5, „nie kasować
  // okresów już użytych"). Kasujemy tylko te, których nic nie używa.
  // Pętla, nie jeden przebieg: łańcuch `previous_period_id` sprawia, że okres N trzyma okres N-1,
  // więc pojedynczy DELETE zdejmuje tylko ogon łańcucha. Powtarzamy do nasycenia.
  const orphanCleanup = await withPgTransaction(async (tx) => {
    let removed = 0;
    for (let pass = 0; pass < 50; pass += 1) {
      const step = await tx.query<{ period_id: string }>(
        `DELETE FROM finance_stmt_periods p
        WHERE p.organization_id = ?
          AND NOT EXISTS (SELECT 1 FROM finance_stmt_lines l WHERE l.period_id = p.period_id)
          AND NOT EXISTS (SELECT 1 FROM finance_analysis_kpi_values k WHERE k.period_id = p.period_id)
          AND NOT EXISTS (SELECT 1 FROM finance_baseline_workspace_contexts c
                           WHERE c.opening_balance_sheet_period_id = p.period_id)
          AND NOT EXISTS (SELECT 1 FROM finance_stmt_periods n WHERE n.previous_period_id = p.period_id)
        RETURNING period_id`,
        [organizationId]
      );
      removed += step.rows.length;
      if (step.rows.length === 0) break;
    }
    await tx.query(
      `DELETE FROM finance_stmt_calendars c
        WHERE c.organization_id = ?
          AND NOT EXISTS (SELECT 1 FROM finance_stmt_periods p WHERE p.fiscal_calendar_id = c.fiscal_calendar_id)`,
      [organizationId]
    );
    return removed;
  });

  const edges = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ count: string }>(
      `SELECT count(*) AS count FROM finance_lineage_edges
        WHERE source_version_id = ? OR target_version_id = ?`,
      [existing.businessVersionId, existing.businessVersionId]
    )
  );
  let artifactRemoved = false;
  if (Number(edges?.count ?? 0) === 0) {
    await withPgTransaction(async (tx) => {
      await tx.query(`DELETE FROM finance_artifact_aliases WHERE artifact_id = ?`, [
        existing.artifactId,
      ]);
      await tx.query(`DELETE FROM artifact_lifecycle_events WHERE artifact_id = ?`, [
        existing.artifactId,
      ]);
      await tx.query(`DELETE FROM finance_working_revisions WHERE artifact_id = ?`, [
        existing.artifactId,
      ]);
      await tx.query(`DELETE FROM finance_business_versions WHERE artifact_id = ?`, [
        existing.artifactId,
      ]);
      await tx.query(`DELETE FROM finance_artifacts WHERE artifact_id = ?`, [existing.artifactId]);
    });
    artifactRemoved = true;
  }

  const remaining = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ lines: string; periods: string; entities: string; calendars: string }>(
      `SELECT (SELECT count(*) FROM finance_stmt_lines WHERE organization_id = ?) AS lines,
              (SELECT count(*) FROM finance_stmt_periods WHERE organization_id = ?) AS periods,
              (SELECT count(*) FROM finance_stmt_entities WHERE organization_id = ?) AS entities,
              (SELECT count(*) FROM finance_stmt_calendars WHERE organization_id = ?) AS calendars`,
      [organizationId, organizationId, organizationId, organizationId]
    )
  );
  console.log(`# Usunięto osieroconych okresów: ${orphanCleanup}`);
  console.log(
    artifactRemoved
      ? `# Artefakt ${existing.artifactId} usunięty w całości (zero krawędzi rodowodu).`
      : `# Artefakt ${existing.artifactId} ZOSTAJE jako pusta skorupa — wiszą na nim krawędzie ` +
        `rodowodu (${edges?.count}), a te są append-only. Ponowny --apply napełni go od nowa.`
  );
  console.log(
    `# Po rollbacku (odczyt na zimno, cała organizacja): linie=${remaining?.lines} ` +
      `okresy=${remaining?.periods} jednostki=${remaining?.entities} kalendarze=${remaining?.calendars}`
  );
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const doRollback = process.argv.includes('--rollback');
  const orgNeedle = arg('org') || 'DBR77';
  const entityNeedle = arg('entity') ?? 'DBR77';
  const yearsArg = arg('years');
  const years = yearsArg
    ? new Set(
        yearsArg
          .split(',')
          .map((y) => Number(y.trim()))
          .filter((y) => Number.isFinite(y))
      )
    : null;
  const tag = arg('tag') || DEFAULT_TAG;

  const dbHost = (() => {
    try {
      return new URL(String(process.env.DATABASE_URL || '')).host;
    } catch {
      return '(brak DATABASE_URL)';
    }
  })();
  console.log(
    `# Tryb: ${doRollback ? 'ROLLBACK' : apply ? 'APPLY (ZAPIS)' : 'DRY-RUN (tylko odczyt)'}   baza: ${dbHost}`
  );

  const org = await resolveOrganization(orgNeedle);
  if (!org) {
    console.error(`BŁĄD: nie znaleziono organizacji dla "${orgNeedle}".`);
    process.exitCode = 1;
    return;
  }
  console.log(`# Organizacja: ${org.name} (${org.id})`);

  const allStatements = await loadLegacyStatements(org.id);
  const entityNames = Array.from(
    new Set(allStatements.map((s) => String(s.entity_name || '(bez nazwy)')))
  );
  console.log(`# Sprawozdania legacy (nie-archiwalne, z okresem): ${allStatements.length}`);
  console.log(`# Firmy w tej organizacji: ${entityNames.join(' | ')}`);

  const filtered = allStatements.filter((s) => {
    const nameOk = entityNeedle
      ? String(s.entity_name || '').toLowerCase().includes(entityNeedle.toLowerCase())
      : true;
    const yearOk = years ? years.has(Number(String(s.period_end).slice(0, 4))) : true;
    return nameOk && yearOk;
  });
  if (filtered.length === 0) {
    console.error(
      `BŁĄD: żadne sprawozdanie nie pasuje do filtra --entity="${entityNeedle}"` +
        (yearsArg ? ` --years=${yearsArg}` : '') +
        '. Firmy dostępne wyżej.'
    );
    process.exitCode = 2;
    return;
  }

  const chosen = pickStatements(filtered);
  const entityName = chosen.find((s) => s.entity_name)?.entity_name || org.name;
  const entityCode = entityCodeFromName(entityName);
  const naturalKey = `${tag}:${org.id}:${entityCode}`;

  if (doRollback) {
    await rollback(org.id, naturalKey, process.argv.includes('--cascade'));
    return;
  }

  console.log('');
  console.log(`# Jednostka docelowa: ${entityName} (kod ${entityCode})`);
  console.log(`# Klucz naturalny pakietu: ${naturalKey}`);
  console.log(`# Sprawozdania wzięte do pakietu: ${chosen.length}`);
  const plans: StatementPlan[] = [];
  for (const statement of chosen) {
    const plan = await planStatement(statement);
    plans.push(plan);
    console.log(
      `  - ${statement.id} | ${statement.statement_type} | ${statement.period_start}…${statement.period_end}` +
        ` (${statement.period_label ?? 'bez etykiety'}) | status=${statement.status}` +
        ` | pozycje=${statement.value_count} zmapowane=${statement.mapped_value_count}` +
        ` | reguły=${plan.rules.length}`
    );
  }

  const periodKeys = new Map<string, { start: string; end: string; label: string | null }>();
  for (const statement of chosen) {
    periodKeys.set(`${statement.period_start}..${statement.period_end}`, {
      start: statement.period_start,
      end: statement.period_end,
      label: statement.period_label,
    });
  }
  const totalRawLines = plans.reduce((sum, plan) => sum + plan.rawLines.length, 0);
  const totalMappable = plans.reduce(
    (sum, plan) => sum + plan.rawLines.length - plan.unmappedLabels.length,
    0
  );
  const allUnmapped = plans.flatMap((plan) =>
    plan.unmappedLabels.map((label) => `${plan.statement.statement_type} ${plan.statement.period_label ?? plan.statement.period_end}: ${label}`)
  );
  const allCollisions = plans.flatMap((plan) =>
    plan.labelCollisions.map((c) => `${plan.statement.statement_type} ${plan.statement.period_end}: ${c}`)
  );

  console.log('');
  console.log(`# Okresy do założenia: ${periodKeys.size}`);
  for (const period of periodKeys.values()) {
    console.log(`  - ${period.start}…${period.end} (${period.label ?? 'bez etykiety'})`);
  }
  console.log(
    `# Okresy MONTH domknięcia (kontrakt ogniwa 6): +${
      Array.from(periodKeys.values()).filter((p) => {
        const days =
          (Date.parse(`${p.end}T00:00:00Z`) - Date.parse(`${p.start}T00:00:00Z`)) / 86400000 + 1;
        return days >= 300 && days <= 400;
      }).length
    }`
  );
  console.log(`# Pozycji źródłowych razem: ${totalRawLines}`);
  console.log(`# Z decyzją mapowania w torze legacy (powstaną linie kanoniczne): ${totalMappable}`);
  console.log(`# BEZ decyzji mapowania (pójdą jako UNMAPPED): ${allUnmapped.length}`);
  for (const label of allUnmapped.slice(0, 60)) console.log(`    · ${label}`);
  if (allUnmapped.length > 60) console.log(`    … i ${allUnmapped.length - 60} więcej`);
  if (allCollisions.length > 0) {
    console.log(`# KOLIZJE ETYKIET (ta sama etykieta → dwie linie kanoniczne): ${allCollisions.length}`);
    for (const collision of allCollisions.slice(0, 30)) console.log(`    · ${collision}`);
  }

  const existingPack = await findExistingPack(org.id, naturalKey);
  const canonicalPacks = await loadCanonicalPacks(org.id);
  console.log('');
  console.log(`# Istniejące pakiety kanoniczne (NIE kasuję żadnego): ${canonicalPacks.length}`);
  for (const pack of canonicalPacks) {
    console.log(
      `  - ${pack.business_version_id} | ${pack.status} | jednostki=${pack.entity_count} ` +
        `okresy=${pack.period_count} linie=${pack.line_count} | ${pack.natural_key ?? '(bez klucza)'}`
    );
  }
  if (existingPack) {
    console.log(`# Pakiet backfillu JUŻ ISTNIEJE: ${existingPack.businessVersionId} — apply będzie idempotentny.`);
  }

  if (!apply) {
    console.log('');
    console.log('DRY-RUN: nic nie zapisano. Komendy zapisu dla nadzorcy:');
    console.log(
      `  DATABASE_URL=… npx tsx server/scripts/finance-backfill-dbr77.ts --apply --org=${org.id}`
    );
    console.log(
      `  DATABASE_URL=… npx tsx server/scripts/finance-analiza-dbr77.ts --apply --org=${org.id} --pack=<businessVersionId z linii wyżej>`
    );
    return;
  }

  const actorId = await resolveActor(org.id);
  let pack: { artifactId: string; businessVersionId: string };
  if (existingPack) {
    pack = existingPack;
  } else {
    const created: CreateArtifactResult = await createArtifact({
      organizationId: org.id,
      artifactType: 'STATEMENT_PACK',
      naturalKey,
      createdBy: actorId,
    });
    pack = {
      artifactId: created.artifact.artifact_id,
      businessVersionId: created.businessVersion.business_version_id,
    };
    console.log(`# Utworzono pakiet kanoniczny ${pack.businessVersionId} (artefakt ${pack.artifactId})`);
  }

  const context = await ensureStatementPackTemporalContext({
    organizationId: org.id,
    businessVersionId: pack.businessVersionId,
    createdBy: actorId,
    periods: Array.from(periodKeys.values()).map((p) => ({
      periodStart: p.start,
      periodEnd: p.end,
      label: p.label,
    })),
    entityName,
    entityCode,
    currency: chosen.find((s) => s.currency)?.currency ?? 'PLN',
  });
  console.log(
    `# Kalendarz ${context.fiscalCalendarId} (nowy: ${context.calendarCreated}); ` +
      `okresy: ${context.periods.length} (nowych ${context.periodsCreated}); ` +
      `jednostka ${context.entityCode} (nowa: ${context.entityCreated})`
  );

  // IDEMPOTENCJA MAPOWANIA. `statementMappingService.mapStatementLines` wstawia linie zwykłym
  // `INSERT`-em, BEZ `ON CONFLICT` (`statementMappingService.ts:393-399`) — powtórne mapowanie tej
  // samej komórki wywraca się na `uq_finance_stmt_lines_cell`. Zmierzone, nie założone. Nie
  // zmieniam kontraktu współdzielonego mappera importu (jego wykrywanie duplikatów jest CELOWE);
  // zamiast tego skrypt odświeża zawartość WŁASNEGO pakietu (rozpoznanego po kluczu naturalnym):
  // kasuje jego linie i pisze je od nowa z toru legacy. Efekt netto powtórnego `--apply` = 0
  // nowych wierszy. Kasujemy WYŁĄCZNIE linie pakietu backfillu — okresy, jednostka, kalendarz
  // i cudze pakiety zostają nietknięte.
  if (existingPack) {
    const before = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ count: string }>(
        `SELECT count(*) AS count FROM finance_stmt_lines WHERE business_version_id = ?`,
        [pack.businessVersionId]
      )
    );
    await withPgTransaction((tx) =>
      tx.query(`DELETE FROM finance_stmt_lines WHERE business_version_id = ?`, [
        pack.businessVersionId,
      ])
    );
    console.log(
      `# Odświeżenie istniejącego pakietu: skasowano ${Number(before?.count ?? 0)} linii przed ponownym mapowaniem.`
    );
  }

  const periodIdByRange = new Map<string, EnsuredPeriod>();
  for (const period of context.periods) {
    periodIdByRange.set(`${period.periodStart}..${period.periodEnd}`, period);
  }

  const totals: Record<string, number> = {};
  for (const plan of plans) {
    const period = periodIdByRange.get(
      `${plan.statement.period_start}..${plan.statement.period_end}`
    );
    if (!period) throw new Error(`Brak okresu dla ${plan.statement.id} — przerywam bez zapisu.`);
    const results = await mapStatementLines({
      organizationId: org.id,
      businessVersionId: pack.businessVersionId,
      unit: unitFromScaling(plan.statement.scaling),
      presentationCurrency: String(plan.statement.currency || 'PLN').toUpperCase(),
      accumulationBasis: 'FULL_YEAR',
      createdBy: actorId,
      rawLines: plan.rawLines.map((line) => ({
        ...line,
        periodId: period.periodId,
        entityCode: context.entityCode,
      })),
      rules: plan.rules,
    });
    const counts = bucketCounts(results);
    for (const [bucket, count] of Object.entries(counts)) {
      totals[bucket] = (totals[bucket] || 0) + count;
    }
    console.log(
      `  · ${plan.statement.statement_type} ${plan.statement.period_label ?? plan.statement.period_end}: ` +
        Object.entries(counts)
          .map(([bucket, count]) => `${bucket}=${count}`)
          .join(' ')
    );
  }
  console.log(`# Razem po kubełkach: ${JSON.stringify(totals)}`);

  // ŚWIADOMIE BEZ KRAWĘDZI RODOWODU. Pakiet jest KORZENIEM grafu (`finance_lineage_edges`
  // łączy DWA różne artefakty; krawędź pakiet→ten sam pakiet jest odrzucana kodem
  // `LINEAGE_CYCLE_REJECTED` — zmierzone, nie założone). Pochodzenie danych jest zapisane
  // tam, gdzie ma sens i gdzie je widać w podglądzie: w `finance_stmt_lines.source_ref`
  // każdej linii (`source_document_ref: financial_statements:<id>`, `legacy_value_id`).
  // Krawędź STATEMENT_TO_ANALYSIS zakłada dopiero skrypt analizy.

  const cold = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ lines: string; periods: string; entities: string; nonzero: string }>(
      `SELECT (SELECT count(*) FROM finance_stmt_lines WHERE business_version_id = ?) AS lines,
              (SELECT count(DISTINCT period_id) FROM finance_stmt_lines WHERE business_version_id = ?) AS periods,
              (SELECT count(*) FROM finance_stmt_entities WHERE business_version_id = ?) AS entities,
              (SELECT count(*) FROM finance_stmt_lines
                WHERE business_version_id = ? AND value_status = 'PRESENT_NONZERO') AS nonzero`,
      [
        pack.businessVersionId,
        pack.businessVersionId,
        pack.businessVersionId,
        pack.businessVersionId,
      ]
    )
  );
  console.log('');
  console.log(
    `# ODCZYT NA ZIMNO pakietu ${pack.businessVersionId}: linie=${cold?.lines} ` +
      `okresy=${cold?.periods} jednostki=${cold?.entities} wartości niezerowe=${cold?.nonzero}`
  );
  console.log('');
  console.log('Następny krok (analiza wskaźnikowa):');
  console.log(
    `  DATABASE_URL=… npx tsx server/scripts/finance-analiza-dbr77.ts --apply --org=${org.id} --pack=${pack.businessVersionId}`
  );
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error('BŁĄD:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
