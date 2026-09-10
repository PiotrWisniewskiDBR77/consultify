#!/usr/bin/env tsx
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';

type Mode = 'dry-run' | 'apply' | 'rollback' | 'verify';
type LegacyRow = Record<string, unknown> & {
  id: string;
  organization_id: string;
  project_id: string | null;
  owner_business_id: string | null;
};

/** FIX-E3-4 [ODBIÓR C2 96_ODBIOR_C2_E3_E5.md]: klucz `ie_aggregate_state` jest
 * trójkolumnowy (`organization_id, aggregate_type, aggregate_id`). Zapisywanie
 * i kasowanie WYŁĄCZNIE po `aggregate_id` ryzykuje kolizję id między
 * organizacjami. Manifest niesie odtąd pełną parę. */
type CreatedAggregateRef = { organizationId: string; aggregateId: string };

type Manifest = {
  generatedAt: string;
  codeSha: string;
  database: string;
  host: string;
  mode: Mode;
  counts: {
    legacyBefore: number;
    canonicalBefore: number;
    missingBefore: number;
    eligible: number;
    skipped: number;
    created: number;
    canonicalAfter: number;
    missingAfter: number;
  };
  createdAggregates: CreatedAggregateRef[];
  /** FIX-E3-3: ścieżka do pliku "do decyzji właściciela" (pełne wiersze
   * pominiętych) — bez tego pola za tydzień nie da się odtworzyć kompletu
   * dowodów z samego manifestu głównego. `null`, gdy plik nie powstał
   * (FIX-E3-2: dry-run bez --zapisz-manifest). */
  ownerDecisionManifestPath: string | null;
  /** FIX-E3-3: md5 tabeli `initiatives` przed i po — dowód, że migracja
   * (INSERT wyłącznie do `ie_aggregate_state`) nie rusza tabeli zastanej. */
  initiativesMd5Before: string;
  initiativesMd5After: string;
};

const STATUS: Record<string, string> = {
  DRAFT: 'REGISTERED_DRAFT',
  PROPOSED: 'DEFINED',
  PENDING_APPROVAL: 'READY_FOR_DECISION',
  APPROVED: 'APPROVED_BACKLOG',
  IN_EXECUTION: 'IN_EXECUTION',
  EXECUTING: 'IN_EXECUTION',
  REJECTED: 'ARCHIVED',
  CLOSED: 'CLOSED',
};

const args = process.argv.slice(2);
const value = (prefix: string) => args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
const rollbackPath = value('--rollback=');
const explicitManifest = value('--manifest=');
const manifestDir = value('--manifest-dir=');
const expectedHost = value('--oczekiwany-host=');
const expectedDatabase = value('--baza=');
const zapiszManifestDryRun = args.includes('--zapisz-manifest');
const mode: Mode = rollbackPath
  ? 'rollback'
  : args.includes('--apply')
    ? 'apply'
    : args.includes('--verify')
      ? 'verify'
      : 'dry-run';

/**
 * FIX-E3-1 [ODBIÓR C2 96_ODBIOR_C2_E3_E5.md §3.1]: przed tym FIX-em jedynym
 * strażnikiem bazy była nazwa `codex1_staging_1009` przybita w kodzie — skrypt
 * był bezużyteczny poza kontenerem Codexa (nie dało się nim zmigrować kopii
 * demo ani stagingu). Naprawa: jawny `--baza=<nazwa>` musi zgadzać się z
 * `DATABASE_URL`, a hosty produkcji/demo są ZAWSZE zakazane (lista skopiowana
 * z `tests/integration/_helpers/assertRealPostgres.ts::FORBIDDEN_DB_HOSTS`,
 * DEC-2026-08-28-165/172). Hosty stagingowe (w tym `thomas`) są dopuszczone
 * WYŁĄCZNIE gdy operator jawnie potwierdzi cel przez
 * `--oczekiwany-host=<ten sam host>` — to samo potwierdzenie jest wymagane
 * także dla hostów lokalnych, żeby literówka w `DATABASE_URL` nigdy nie
 * przeszła cicho.
 */
const FORBIDDEN_DB_HOSTS = new Set([
  'centerbeam.proxy.rlwy.net', // Production (DEC-2026-08-28-165).
  'trolley.proxy.rlwy.net', // Demo pgvector (DEC-165/DEC-172).
  'sakura.proxy.rlwy.net', // Staging release-gate migration target.
  'thomas.proxy.rlwy.net', // Staging Postgres service.
  'caboose.proxy.rlwy.net', // Origin unresolved; retained defensively.
  'ballast.proxy.rlwy.net', // Origin unresolved; retained defensively.
]);

function target(): { url: string; host: string; database: string } {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('Brak DATABASE_URL.');
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const database = decodeURIComponent(parsed.pathname.slice(1));

  if (FORBIDDEN_DB_HOSTS.has(host)) {
    throw new Error(`ODMOWA: host ${host} to produkcja/demo/staging — migracja NIGDY nie może tam biec, bez wyjątku.`);
  }
  if (!expectedHost || expectedHost !== host) {
    throw new Error(`ODMOWA: wymagane --oczekiwany-host=${host || '<host z DATABASE_URL>'} (jawne potwierdzenie hosta).`);
  }
  if (!expectedDatabase) {
    throw new Error('ODMOWA: wymagany jawny --baza=<nazwa bazy> — nazwa bazy nie jest już przybita w kodzie.');
  }
  if (expectedDatabase !== database) {
    throw new Error(`ODMOWA: --baza=${expectedDatabase} nie zgadza się z bazą z DATABASE_URL (${database}).`);
  }
  if (mode === 'apply' && process.env.MIGRACJA_INICJATYW_APPLY !== 'true') {
    throw new Error('ODMOWA: --apply wymaga MIGRACJA_INICJATYW_APPLY=true.');
  }
  return { url, host, database };
}

async function scalar(client: PoolClient, sql: string): Promise<number> {
  const result = await client.query<{ count: string }>(sql);
  return Number(result.rows[0]?.count || 0);
}

/** FIX-E3-3: md5 zawartości `initiatives` — dowód nietykalności tabeli zastanej. */
async function initiativesMd5(client: PoolClient): Promise<string> {
  const result = await client.query<{ md5: string }>(
    `SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY id), '')) AS md5 FROM initiatives t`
  );
  return String(result.rows[0]?.md5 || '');
}

async function codeSha(): Promise<string> {
  const { execFileSync } = await import('node:child_process');
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

/**
 * FIX-E3-5 [ODBIÓR C2 96_ODBIOR_C2_E3_E5.md §3.1 poz. 5]: przed tym FIX-em
 * `payload()` robił CICHY fallback `STATUS[x] || rawStatus` — status spoza
 * słownika wchodził do kanonu jako surowa wartość (zgadywanie stanu spoza
 * `INITIATIVE_LIFECYCLE`). Naprawa: brak w mapie ⇒ wiersz POMINIĘTY z
 * powodem `NIEZNANY_STATUS`, tak samo fail-closed jak C1-FIX-4 na czytniku
 * (`initiativeUnifiedReader.ts`, `a25dec1083`) — obie strony migracja/czytnik
 * teraz odmawiają zgadywania stanu, zamiast przepuszczać go dalej.
 */
function reason(row: LegacyRow): string[] {
  const reasons: string[] = [];
  if (!row.project_id) reasons.push('BRAK_PROJECT_ID');
  if (!row.owner_business_id) reasons.push('BRAK_OWNER_BUSINESS_ID');
  const rawStatus = String(row.status || 'DRAFT').toUpperCase();
  if (!STATUS[rawStatus]) reasons.push('UNKNOWN_STATUS');
  return reasons;
}

function payload(row: LegacyRow): Record<string, unknown> {
  const title = String(row.title || row.name || row.id);
  // Bezpieczne wyłącznie dla wierszy, które przeszły `reason()` (status
  // zmapowany) — funkcja jest wołana tylko dla `eligible`, ale zostawiamy
  // domyślną wartość na wypadek wywołania spoza tej ścieżki (np. `examples`).
  const state = STATUS[String(row.status || 'DRAFT').toUpperCase()] || 'REGISTERED_DRAFT';
  return {
    initiativeId: row.id,
    title,
    name: title,
    problem: String(row.problem_statement || row.summary || row.description || title),
    proposedOutcome: row.summary || null,
    lifecycleState: state,
    projectId: row.project_id,
    initiativeOwnerId: row.owner_business_id,
    priority: String(row.priority || 'MEDIUM').toUpperCase(),
    plannedStartDate: row.planned_start_date || row.start_date || null,
    plannedEndDate: row.planned_end_date || row.end_date || null,
    requiredCapacityFte: Number(row.required_capacity_fte || 0),
    source: {
      sourceType: 'legacy_initiatives_migration',
      sourceId: row.id,
      sourceVersion: 1,
      freshness: 'MIGRATED',
      refreshedAt: new Date().toISOString(),
    },
    planning: {
      source: 'LEGACY_INITIATIVES',
      moduleStatus: String(row.status || 'DRAFT'),
      registeredAt: row.created_at || new Date().toISOString(),
      registeredBy: row.created_by || row.owner_business_id,
      conditional: false,
    },
    readiness: 'NOT_EVALUATED',
    conditional: false,
    dependencySnapshot: [],
  };
}

/** Katalog domyślny dla manifestu "do decyzji właściciela" (FIX-E3-2) — poza
 * repo, żeby `git add -A` nigdy nie zaciągnął 106-kolumnowego zrzutu danych
 * klienta. Jawny `--manifest-dir=` nadpisuje to (np. na potrzeby testu). */
function ownerDecisionDefaultDir(): string {
  return path.join(os.homedir(), 'Developer', 'consultify-dumps', 'manifesty');
}

async function main(): Promise<void> {
  const identity = target();
  const pool = new Pool({ connectionString: identity.url, max: 1 });
  const client = await pool.connect();
  try {
    if (mode === 'rollback' || mode === 'verify') {
      const manifestPath = rollbackPath || explicitManifest;
      if (!manifestPath) throw new Error(`${mode} wymaga --manifest=<plik> albo --rollback=<plik>.`);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;
      if (manifest.database !== identity.database || manifest.host !== identity.host) throw new Error('Manifest wskazuje inny cel.');
      const refs = manifest.createdAggregates || [];
      const orgIds = refs.map((r) => r.organizationId);
      const aggIds = refs.map((r) => r.aggregateId);
      if (refs.length === 0) {
        console.error(`OSTRZEŻENIE: manifest pusty (created=0) — ${mode} nie potwierdza żadnego utworzonego agregatu, tylko rozjazd.`);
      }
      if (mode === 'rollback') {
        await client.query('BEGIN');
        // FIX-E3-4: kasujemy po PEŁNYM kluczu (organization_id + aggregate_id),
        // nie po samym aggregate_id — trójkolumnowy PK dopuszcza kolizję id
        // między organizacjami.
        const deleted = refs.length
          ? await client.query(
              `DELETE FROM ie_aggregate_state t
               USING unnest($1::text[], $2::text[]) AS x(organization_id, aggregate_id)
               WHERE t.aggregate_type='initiative' AND t.organization_id = x.organization_id AND t.aggregate_id = x.aggregate_id`,
              [orgIds, aggIds]
            )
          : { rowCount: 0 };
        await client.query('COMMIT');
        const canonicalAfter = await scalar(client, `SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative'`);
        const missingAfter = await scalar(client, `SELECT count(*) FROM initiatives i WHERE NOT EXISTS (SELECT 1 FROM ie_aggregate_state s WHERE s.aggregate_type='initiative' AND s.aggregate_id=i.id)`);
        const initiativesMd5After = await initiativesMd5(client);
        const receipt: Manifest = {
          ...manifest,
          generatedAt: new Date().toISOString(),
          codeSha: await codeSha(),
          mode: 'rollback',
          counts: { ...manifest.counts, created: 0, canonicalAfter, missingAfter },
          initiativesMd5After,
        };
        const receiptPath = path.join(path.dirname(manifestPath), `inicjatywy-kanon-rollback-${receipt.generatedAt.replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
        console.log(JSON.stringify({ mode, deleted: deleted.rowCount, manifest: manifestPath, receiptPath }));
      } else {
        // FIX-E3-6: `present` jest teraz zawsze zapytaniem realnym (nie
        // skrótem `0` przy pustej liście), a dla apply z `created===0`
        // (idempotentny no-op, np. apply #2) porównujemy rozjazd z
        // `missingBefore` z manifestu tej próby — jeśli między wygenerowaniem
        // manifestu a `--verify` coś dopisało/usunęło wiersze do `initiatives`,
        // to wykryjemy to jako `ok=false` zamiast trywialnego `ok=true`.
        const present = Number(
          (
            await client.query<{ count: string }>(
              `SELECT count(*) FROM ie_aggregate_state t
               WHERE t.aggregate_type='initiative' AND (t.organization_id, t.aggregate_id) IN (
                 SELECT x.organization_id, x.aggregate_id FROM unnest($1::text[], $2::text[]) AS x(organization_id, aggregate_id)
               )`,
              [orgIds, aggIds]
            )
          ).rows[0]?.count || 0
        );
        const missingNow = await scalar(client, `SELECT count(*) FROM initiatives i WHERE NOT EXISTS (SELECT 1 FROM ie_aggregate_state s WHERE s.aggregate_type='initiative' AND s.aggregate_id=i.id)`);
        const expectedPresent = manifest.mode === 'apply' ? refs.length : 0;
        const expectedMissing = manifest.mode === 'apply' && manifest.counts.created === 0
          ? manifest.counts.missingBefore
          : manifest.counts.missingAfter;
        const ok = present === expectedPresent && missingNow === expectedMissing;
        console.log(JSON.stringify({
          mode, ok, present, expectedPresent, missingNow, expectedMissing,
          emptyManifest: refs.length === 0,
          manifest: manifestPath,
        }));
        if (!ok) process.exitCode = 2;
      }
      return;
    }

    const initiativesMd5Before = await initiativesMd5(client);
    const rows = (await client.query<LegacyRow>(`SELECT i.* FROM initiatives i WHERE NOT EXISTS (SELECT 1 FROM ie_aggregate_state s WHERE s.aggregate_type='initiative' AND s.aggregate_id=i.id) ORDER BY i.id`)).rows;
    const eligible = rows.filter((row) => reason(row).length === 0);
    const skipped = rows.filter((row) => reason(row).length > 0);
    const skippedNieznanyStatus = skipped.filter((row) => reason(row).includes('UNKNOWN_STATUS'));
    if (skippedNieznanyStatus.length > 0) {
      console.error(
        `OSTRZEŻENIE: ${skippedNieznanyStatus.length} wierszy pominiętych z powodu UNKNOWN_STATUS (fail-closed, zero zgadywania) — id: ${skippedNieznanyStatus.slice(0, 5).map((r) => r.id).join(', ')}${skippedNieznanyStatus.length > 5 ? '…' : ''}`
      );
    }
    const legacyBefore = await scalar(client, 'SELECT count(*) FROM initiatives');
    const canonicalBefore = await scalar(client, `SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative'`);
    const createdRefs: CreatedAggregateRef[] = [];
    if (mode === 'apply') {
      await client.query('BEGIN');
      for (const row of eligible) {
        const result = await client.query(
          `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json,updated_at)
           VALUES($1,'initiative',$2,1,$3::jsonb,COALESCE($4::timestamptz,CURRENT_TIMESTAMP))
           ON CONFLICT (organization_id,aggregate_type,aggregate_id) DO NOTHING
           RETURNING aggregate_id`,
          [row.organization_id, row.id, JSON.stringify(payload(row)), row.updated_at || row.created_at || null]
        );
        if (result.rowCount === 1) createdRefs.push({ organizationId: row.organization_id, aggregateId: row.id });
      }
      await client.query('COMMIT');
    }
    const canonicalAfter = await scalar(client, `SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative'`);
    const missingAfter = await scalar(client, `SELECT count(*) FROM initiatives i WHERE NOT EXISTS (SELECT 1 FROM ie_aggregate_state s WHERE s.aggregate_type='initiative' AND s.aggregate_id=i.id)`);
    const initiativesMd5After = await initiativesMd5(client);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const targetManifestDir = manifestDir || process.cwd();
    const base = `inicjatywy-kanon-${mode}-${stamp}`;
    const manifestPath = path.join(targetManifestDir, `${base}.json`);

    // FIX-E3-2 [ODBIÓR C2 96_ODBIOR_C2_E3_E5.md §3.1 poz. 2]: przed tym FIX-em
    // KAŻDY tryb (w tym `dry-run`, domyślny) zapisywał na dysk plik "do decyzji
    // właściciela" z PEŁNYMI wierszami pominiętymi (105 wierszy × 106 kolumn =
    // 920 KB danych klienta). Tryb suchy nie powinien materializować kopii
    // danych osobowych bez jawnej zgody. Naprawa: pełny plik powstaje TYLKO
    // przy `--apply` albo gdy operator poda `--zapisz-manifest` jawnie przy
    // dry-run — i domyślnie ląduje POZA repo (`~/Developer/consultify-dumps/manifesty/`),
    // chyba że `--manifest-dir=` wskaże inaczej.
    const shouldWriteOwnerDecisionFile = mode === 'apply' || zapiszManifestDryRun;
    let decisionPath: string | null = null;
    if (shouldWriteOwnerDecisionFile) {
      const decisionDir = manifestDir || ownerDecisionDefaultDir();
      fs.mkdirSync(decisionDir, { recursive: true });
      decisionPath = path.join(decisionDir, `${base}-do-decyzji-wlasciciela.json`);
      fs.writeFileSync(
        decisionPath,
        JSON.stringify({ generatedAt: new Date().toISOString(), database: identity.database, count: skipped.length, rows: skipped.map((row) => ({ reasons: reason(row), row })) }, null, 2) + '\n',
        { mode: 0o600 }
      );
    }

    const manifest: Manifest = {
      generatedAt: new Date().toISOString(), codeSha: await codeSha(), database: identity.database, host: identity.host, mode,
      counts: { legacyBefore, canonicalBefore, missingBefore: rows.length, eligible: eligible.length, skipped: skipped.length, created: createdRefs.length, canonicalAfter, missingAfter },
      createdAggregates: createdRefs,
      ownerDecisionManifestPath: decisionPath,
      initiativesMd5Before,
      initiativesMd5After,
    };
    if (mode === 'apply' || zapiszManifestDryRun) {
      fs.mkdirSync(targetManifestDir, { recursive: true });
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    }

    // Bez pliku pełnego (dry-run bez --zapisz-manifest): tylko liczby i id w
    // konsoli (bez PII wiersza — reasons + id wystarczą do decyzji właściciela
    // o ZAKRESIE problemu, pełne dane trzeba pobrać jawnym --zapisz-manifest).
    const skippedSummary = shouldWriteOwnerDecisionFile
      ? undefined
      : skipped.map((row) => ({ id: row.id, organizationId: row.organization_id, reasons: reason(row) }));

    console.log(JSON.stringify({
      ...manifest,
      manifestPath: mode === 'apply' || zapiszManifestDryRun ? manifestPath : null,
      examples: eligible.slice(0, 3).map(payload),
      skippedSummary,
    }));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
