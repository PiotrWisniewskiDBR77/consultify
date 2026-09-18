import { describe, expect, it } from 'vitest';
import { isSqliteOnlyMigration } from '../../scripts/migrate.postgres.js';

// Bind to the runner's REAL predicate (exported; main() stays behind
// isDirectCliInvocation) so this proves the offline runner's file selection,
// not a copy of it.
function mig(filename: string, version = '0') {
  return { version, filename, filepath: `server/migrations/${filename}`, checksum: 'x' };
}

// The live boot autorun applies every canonical-flow file
// (/^(7\d{2}|\d{8})_.*\.sql$/) and registers it in tp_migration_history, so the
// offline runner must NOT skip these even when the name says seed/mock/demo —
// otherwise the two ledgers diverge and a fresh Postgres DB loses global
// reference data (v6 interview templates -> demo seed etap 09 `--api` 404).
const CANONICAL_FLOW_SEED_FILES = [
  ['20260409_p25d_help_seed_and_lifecycle.sql', '20260409'],
  ['20260411_consultify_partner_kb_seed.sql', '20260411'],
  ['20260412_seed_business_templates.sql', '20260412'],
  ['20260608_megatrends_seed.sql', '20260608'],
  ['20260628_finance_seed_readiness_fix.sql', '20260628'],
  ['20260720_seed_v6_interview_library_templates.sql', '20260720'],
  ['20262105_seed_business_templates_origin_runtime_repair.sql', '20262105'],
  ['771_demo_mock_seed_cleanup.sql', '771'],
  ['784_dbr77_template_seeds.sql', '784'],
  ['785_dbr77_template_seeds_f32.sql', '785'],
] as const;

// Legacy demo/mock seeds OUTSIDE the canonical flow (3-digit, version >= 500 so
// only the seed/mock/demo rule can catch them — the <500 rule must not confound
// the assertion). The live autorun skips these too, so skipping offline is
// consistent, not a divergence.
const LEGACY_NON_CANONICAL_SEED_FILES = [
  ['500_comprehensive_demo_data.sql', '500'],
  ['501_interview_demo_data.sql', '501'],
  ['513_org_report_templates_demo.sql', '513'],
] as const;

describe('isSqliteOnlyMigration — substantive canonical-flow rule (seed v4)', () => {
  it.each(CANONICAL_FLOW_SEED_FILES)(
    'does NOT skip canonical-flow seed file %s (live autorun applies it)',
    (filename, version) => {
      expect(isSqliteOnlyMigration(mig(filename, version))).toBe(false);
    },
  );

  it.each(LEGACY_NON_CANONICAL_SEED_FILES)(
    'SKIPS legacy non-canonical demo/seed file %s',
    (filename, version) => {
      expect(isSqliteOnlyMigration(mig(filename, version))).toBe(true);
    },
  );

  it('does not skip a plain dated schema migration', () => {
    expect(isSqliteOnlyMigration(mig('20262301_meetings_agenda_lifecycle.sql', '20262301'))).toBe(false);
  });

  it('still skips the non-seed legacy exclusions (add_ / assessment-module / fix_conversations)', () => {
    expect(isSqliteOnlyMigration(mig('add_some_column.sql'))).toBe(true);
    expect(isSqliteOnlyMigration(mig('assessment-module.sql'))).toBe(true);
    expect(isSqliteOnlyMigration(mig('fix_conversations_table.sql'))).toBe(true);
  });

  it('still skips iCloud duplicate artifacts', () => {
    expect(isSqliteOnlyMigration(mig('515_some_migration 2.sql', '515'))).toBe(true);
  });
});
