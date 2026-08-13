#!/usr/bin/env tsx
/**
 * Czyści dane pozostawione przez testy domeny Audits.
 *
 * DLACZEGO ISTNIEJE:
 * Testy serwisów Audits tworzą własne organizacje (`org_<uuid>`, `gf-org-<ts>`
 * itp.) i sprzątają po sobie tylko częściowo — po pełnym przebiegu suity w
 * bazie testowej zostają programy, ustalenia i zdarzenia domenowe. Na bazie
 * testowej to nie boli (izolacja idzie po `organization_id`), ale rośnie i
 * zaciemnia ręczne oglądanie danych. Ten skrypt daje jedną, jawną komendę
 * zamiast niewidocznego długu.
 *
 * BEZPIECZNIK: skrypt kasuje WYŁĄCZNIE organizacje pasujące do wzorców
 * testowych i odmawia działania na bazie, której nazwa nie wygląda na testową.
 * Nie uruchamiaj go przeciw demo ani produkcji — nie ma tam czego czyścić.
 *
 * Użycie (z korzenia repo):
 *   NODE_ENV=test DB_TYPE=postgres DATABASE_URL="postgresql://.../consultify_audits_x" \
 *     npx tsx server/scripts/cleanup-audit-test-data.ts [--dry-run]
 */
import '../src/config/loadEnv.js';

import { Pool } from 'pg';

const TEST_ORG_PATTERNS = [
  'org\\_%',
  'org-a\\_%',
  'org-b\\_%',
  'gf-org-%',
  'probe-org-%',
  'u2-%',
  'u3-%',
  'u4-%',
  'u5-%',
  'u6-%',
];

/** Tabele w kolejności od zależnych do nadrzędnych. */
const TABLES = [
  'audit_initiative_proposals',
  'audit_reports',
  'audit_outputs',
  'audit_verifications',
  'audit_corrective_actions',
  'audit_management_responses',
  'audit_program_findings',
  'audit_evidence',
  'audit_evidence_requests',
  'audit_program_criteria',
  'audit_program_members',
  'audit_ai_proposals',
  'audit_domain_events',
  'audit_programs',
  'audit_packs',
  'audit_norm_sources',
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Brak DATABASE_URL.');
    process.exit(1);
  }

  const dbName = url.split('/').pop()?.split('?')[0] ?? '';
  if (!/test|audits|probe|_u\d/i.test(dbName)) {
    console.error(
      `Odmowa: „${dbName}" nie wygląda na bazę testową. Ten skrypt nie ma nic do roboty poza testami.`,
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const where = TEST_ORG_PATTERNS.map((_, i) => `organization_id LIKE $${i + 1}`).join(' OR ');

  let total = 0;
  try {
    for (const table of TABLES) {
      const exists = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
        [table],
      );
      if (exists.rowCount === 0) continue;

      // `audit_pack_criteria` nie ma organization_id — sprząta się przez pakiet.
      const countSql = `SELECT COUNT(*)::int AS c FROM ${table} WHERE ${where}`;
      const { rows } = await pool.query(countSql, TEST_ORG_PATTERNS);
      const count = Number(rows[0]?.c ?? 0);
      if (count === 0) continue;

      total += count;
      if (dryRun) {
        console.log(`[dry-run] ${table}: ${count} wierszy do usunięcia`);
        continue;
      }

      if (table === 'audit_packs') {
        await pool.query(
          `DELETE FROM audit_pack_criteria WHERE pack_id IN (SELECT id FROM audit_packs WHERE ${where})`,
          TEST_ORG_PATTERNS,
        );
      }
      await pool.query(`DELETE FROM ${table} WHERE ${where}`, TEST_ORG_PATTERNS);
      console.log(`${table}: usunięto ${count} wierszy`);
    }

    console.log(
      dryRun
        ? `[dry-run] Łącznie do usunięcia: ${total} wierszy w bazie ${dbName}.`
        : `Gotowe. Usunięto ${total} wierszy testowych w bazie ${dbName}.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Czyszczenie nie powiodło się:', error);
  process.exit(1);
});
