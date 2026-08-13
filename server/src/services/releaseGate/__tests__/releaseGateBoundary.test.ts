/**
 * Release migration gate — boundary and negative controls.
 *
 * These are the tests that would have caught the conditions the 2026-08-13 forensic pass found:
 * a no-op preDeployCommand, a scoped --only list, filename-only checksum grandfathering, and a
 * legacy variant accepted on its checksum alone.
 *
 * Pure-function level: no database, no network.
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { BUILD_SHA_ENV_PRECEDENCE, BUILD_SHA_UNKNOWN, resolveBuildSha } from '../../../config/buildSha.js';
import {
  APPROVED_SQL_CHAIN_VARIANTS,
  SCHEMA_ATTESTED_FILENAME,
  SCHEMA_ATTESTED_PAIR,
  classifySqlChainChecksum,
} from '../sqlChainChecksumPolicy.js';
import { assertExpectedTarget, assertNoForbiddenFlags } from '../gateContract.js';

const repoRoot = path.resolve(process.cwd());
const readJson = (p: string) => JSON.parse(fs.readFileSync(path.resolve(repoRoot, p), 'utf-8'));

describe('release gate — railway config contract', () => {
  for (const file of ['railway.json', 'railway.api.json']) {
    it(`${file} declares a real preDeployCommand (not missing, not a no-op)`, () => {
      const cfg = readJson(file);
      const cmd = cfg?.deploy?.preDeployCommand;
      expect(cmd, `${file} must declare deploy.preDeployCommand`).toBeTruthy();
      const text = Array.isArray(cmd) ? cmd.join(' ') : String(cmd);
      // The live Railway service carried ["true"] on all 20 retained deployments — an explicit
      // no-op. That must never be what the repo declares.
      expect(text.trim()).not.toBe('true');
      expect(text).toContain('release-migration-gate');
    });

    it(`${file} preDeployCommand carries no forbidden flag`, () => {
      const cfg = readJson(file);
      const text = String(
        Array.isArray(cfg.deploy.preDeployCommand)
          ? cfg.deploy.preDeployCommand.join(' ')
          : cfg.deploy.preDeployCommand
      );
      expect(text).not.toContain('--only');
      expect(text).not.toContain('--safe');
      expect(text).not.toContain('--allow-checksum-drift');
    });
  }
});

describe('release gate — forbidden flags', () => {
  it('accepts an empty argument list', () => {
    expect(() => assertNoForbiddenFlags([])).not.toThrow();
  });
  for (const flag of ['--only', '--safe', '--allow-checksum-drift']) {
    it(`refuses ${flag}`, () => {
      expect(() => assertNoForbiddenFlags([flag])).toThrow(/forbidden flag/i);
    });
  }
  it('refuses a forbidden flag among otherwise benign arguments', () => {
    expect(() => assertNoForbiddenFlags(['--verbose', '--safe'])).toThrow(/--safe/);
  });
});

describe('release gate — positive target assertion', () => {
  it('passes when the resolved host contains the expected fingerprint', () => {
    expect(assertExpectedTarget('postgresql://u:p@127.0.0.1:5432/db', '127.0.0.1')).toBe('127.0.0.1');
  });
  it('fails closed when no expectation is declared', () => {
    expect(() => assertExpectedTarget('postgresql://u:p@127.0.0.1:5432/db', undefined)).toThrow(
      /RELEASE_TARGET_DB_HOST_FINGERPRINT is required/
    );
  });
  it('fails closed when the host does not match the declared intent', () => {
    expect(() => assertExpectedTarget('postgresql://u:p@somewhere.example:5432/db', 'staging')).toThrow(
      /Target mismatch/
    );
  });
});

describe('checksum policy — the 25 approved pairs', () => {
  it('contains exactly 25 approved variants and excludes 730', () => {
    expect(Object.keys(APPROVED_SQL_CHAIN_VARIANTS)).toHaveLength(25);
    expect(APPROVED_SQL_CHAIN_VARIANTS[SCHEMA_ATTESTED_FILENAME]).toBeUndefined();
  });

  it('accepts every approved file on its EXACT (stored, current) pair', () => {
    for (const [filename, pair] of Object.entries(APPROVED_SQL_CHAIN_VARIANTS)) {
      expect(classifySqlChainChecksum(filename, pair.stored, pair.current)).toBe(
        'APPROVED_HISTORICAL_VARIANT'
      );
    }
  });

  it('rejects the same filename with a DIFFERENT stored checksum', () => {
    for (const [filename, pair] of Object.entries(APPROVED_SQL_CHAIN_VARIANTS)) {
      expect(classifySqlChainChecksum(filename, 'f'.repeat(64), pair.current)).toBe('DRIFT');
    }
  });

  it('rejects the same stored checksum with a DIFFERENT current checksum', () => {
    // i.e. the file was edited again after the variant was reviewed — must force a fresh review.
    for (const [filename, pair] of Object.entries(APPROVED_SQL_CHAIN_VARIANTS)) {
      expect(classifySqlChainChecksum(filename, pair.stored, '0'.repeat(64))).toBe('DRIFT');
    }
  });

  it('never grandfathers by filename alone', () => {
    const [filename] = Object.keys(APPROVED_SQL_CHAIN_VARIANTS);
    expect(classifySqlChainChecksum(filename, 'a'.repeat(64), 'b'.repeat(64))).toBe('DRIFT');
  });

  it('treats an identical checksum as a plain MATCH, not a variant', () => {
    expect(classifySqlChainChecksum('anything.sql', 'c'.repeat(64), 'c'.repeat(64))).toBe('MATCH');
  });

  it('treats a missing stored checksum as DRIFT rather than silently passing', () => {
    expect(classifySqlChainChecksum('anything.sql', null, 'c'.repeat(64))).toBe('DRIFT');
    expect(classifySqlChainChecksum('anything.sql', '', 'c'.repeat(64))).toBe('DRIFT');
  });

  it('rejects an unknown filename that drifted', () => {
    expect(classifySqlChainChecksum('not_reviewed.sql', 'a'.repeat(64), 'b'.repeat(64))).toBe('DRIFT');
  });
});

describe('checksum policy — 730 requires schema attestation', () => {
  it('classifies the exact 730 pair as SCHEMA_ATTESTED_LEGACY_VARIANT, never as approved', () => {
    expect(
      classifySqlChainChecksum(
        SCHEMA_ATTESTED_FILENAME,
        SCHEMA_ATTESTED_PAIR.stored,
        SCHEMA_ATTESTED_PAIR.current
      )
    ).toBe('SCHEMA_ATTESTED_LEGACY_VARIANT');
  });

  it('rejects 730 on a different stored checksum even if current matches', () => {
    expect(
      classifySqlChainChecksum(SCHEMA_ATTESTED_FILENAME, 'e'.repeat(64), SCHEMA_ATTESTED_PAIR.current)
    ).toBe('DRIFT');
  });

  it('rejects 730 on a different current checksum even if stored matches', () => {
    expect(
      classifySqlChainChecksum(SCHEMA_ATTESTED_FILENAME, SCHEMA_ATTESTED_PAIR.stored, 'e'.repeat(64))
    ).toBe('DRIFT');
  });
});

describe('build sha resolver — one precedence for every consumer', () => {
  it('declares the agreed precedence', () => {
    expect([...BUILD_SHA_ENV_PRECEDENCE]).toEqual([
      'APP_BUILD_SHA',
      'RAILWAY_GIT_COMMIT_SHA',
      'GITHUB_SHA',
      'GIT_SHA',
    ]);
  });

  it('prefers APP_BUILD_SHA over every platform variable', () => {
    expect(
      resolveBuildSha({ APP_BUILD_SHA: 'aaa', RAILWAY_GIT_COMMIT_SHA: 'bbb', GITHUB_SHA: 'ccc' } as any)
    ).toBe('aaa');
  });

  it('falls through the precedence in order', () => {
    expect(resolveBuildSha({ RAILWAY_GIT_COMMIT_SHA: 'bbb', GITHUB_SHA: 'ccc' } as any)).toBe('bbb');
    expect(resolveBuildSha({ GITHUB_SHA: 'ccc', GIT_SHA: 'ddd' } as any)).toBe('ccc');
    expect(resolveBuildSha({ GIT_SHA: 'ddd' } as any)).toBe('ddd');
  });

  it('returns UNKNOWN rather than empty when nothing is configured', () => {
    expect(resolveBuildSha({} as any)).toBe(BUILD_SHA_UNKNOWN);
  });

  it('ignores whitespace-only values instead of reporting a blank sha', () => {
    expect(resolveBuildSha({ APP_BUILD_SHA: '   ', RAILWAY_GIT_COMMIT_SHA: 'bbb' } as any)).toBe('bbb');
  });
});

describe('migration coverage — 9xx and lettered same-day files are executable', () => {
  it('includes the 9xx and lettered-same-day migrations the runtime runner cannot see', async () => {
    const { isExecutableMigration } = await import('../migrationExecutionPolicy.js');
    const orphans = [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
      '934_organization_governance_profiles.sql',
      '935_plan_scenario_time_basis.sql',
      '946_benefit_tracking_fresh_install.sql',
      '20260810c_case_workspace_inbox_ambiguous_code.sql',
      '20260810d_case_workspace_case_identity.sql',
      '20260810e_case_workspace_event_correlation.sql',
      '20260810f_case_workspace_append_only_guards.sql',
      '20260811a_case_workspace_run_lifecycle.sql',
      '20260812a_case_workspace_outbox_next_retry_at.sql',
    ];
    for (const f of orphans) {
      expect(isExecutableMigration(f), `${f} must be executed by the SQL chain`).toBe(true);
    }
  });

  it('still excludes the files the runner deliberately skips', async () => {
    const { isExecutableMigration } = await import('../migrationExecutionPolicy.js');
    expect(isExecutableMigration('000_initdb_core_tables.sql')).toBe(false);
  });
});
