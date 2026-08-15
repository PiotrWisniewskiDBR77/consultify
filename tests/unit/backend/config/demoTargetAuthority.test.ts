/**
 * MAT-006B — the demo target authority.
 *
 * This is the file that decides whether a destructive operator tool is allowed to
 * touch the database in front of it. It is a pure function over env + connection
 * string, so every case below is exercised without a driver, a socket or a DB.
 */
import { describe, expect, it } from 'vitest';

import {
  assertDemoOrganization,
  assertDemoTargetAuthority,
  DECLARED_TARGET_ENV_VARS,
  DEMO_ORGANIZATION_SQL,
  DEMO_TARGET_ELEMENTS,
  type DemoTargetElement,
  demoTargetDigest,
  describeDemoTargetRefusals,
  evaluateDemoOrganizationRow,
  OBSERVED_TARGET_ENV_VARS,
  parseConnectionTarget,
} from '../../../../server/src/config/demoTargetAuthority.js';

const DEMO_HOST = 'trolley.proxy.rlwy.net';
const DEMO_PORT = '28146';
const DEMO_DATABASE = 'railway';
const DEMO_CONNECTION = `postgres://demo:pw@${DEMO_HOST}:${DEMO_PORT}/${DEMO_DATABASE}`;

const DECLARED_VALUES: Record<DemoTargetElement, string> = {
  railwayProjectId: 'prj_consultify_0001',
  railwayEnvironmentId: 'env_demo_0002',
  railwayEnvironmentName: 'demo',
  railwayServiceId: 'svc_consultify_0003',
  railwayServiceName: 'consultify',
  databaseHost: DEMO_HOST,
  databasePort: DEMO_PORT,
  databaseName: DEMO_DATABASE,
};

function goodEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const element of DEMO_TARGET_ELEMENTS) {
    env[DECLARED_TARGET_ENV_VARS[element]] = DECLARED_VALUES[element];
  }
  for (const [element, envVar] of Object.entries(OBSERVED_TARGET_ENV_VARS)) {
    env[envVar] = DECLARED_VALUES[element as DemoTargetElement];
  }
  return { ...env, ...overrides };
}

function refusedElements(env: NodeJS.ProcessEnv, connectionString = DEMO_CONNECTION): string[] {
  const result = assertDemoTargetAuthority({ env, connectionString });
  expect(result.ok).toBe(false);
  expect(result.fingerprint).toBeNull();
  expect(result.digest).toBeNull();
  return result.refusals.map((refusal) => refusal.element);
}

describe('demoTargetAuthority — the allowlist admits exactly one target', () => {
  it('accepts a fully declared, fully observed, matching demo fingerprint', () => {
    const result = assertDemoTargetAuthority({ env: goodEnv(), connectionString: DEMO_CONNECTION });
    expect(result.refusals).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.fingerprint).toEqual(DECLARED_VALUES);
    expect(result.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('binds the digest to every element — one changed element changes the digest', () => {
    const base = demoTargetDigest(DECLARED_VALUES);
    for (const element of DEMO_TARGET_ELEMENTS) {
      const mutated = { ...DECLARED_VALUES, [element]: `${DECLARED_VALUES[element]}-x` };
      expect(demoTargetDigest(mutated)).not.toBe(base);
    }
  });
});

describe('demoTargetAuthority — NEGATIVE MATRIX: one missing DECLARED element each', () => {
  for (const element of DEMO_TARGET_ELEMENTS) {
    it(`refuses when ${element} is not declared, and names ${element}`, () => {
      const env = goodEnv();
      delete env[DECLARED_TARGET_ENV_VARS[element]];
      const result = assertDemoTargetAuthority({ env, connectionString: DEMO_CONNECTION });
      expect(result.ok).toBe(false);
      const reason = describeDemoTargetRefusals(result.refusals);
      expect(reason).toContain(`[${element}]`);
      expect(reason).toContain(DECLARED_TARGET_ENV_VARS[element]);
    });
  }
});

describe('demoTargetAuthority — NEGATIVE MATRIX: one missing OBSERVED element each', () => {
  for (const [element, envVar] of Object.entries(OBSERVED_TARGET_ENV_VARS)) {
    it(`refuses when ${element} is not observed at runtime`, () => {
      const env = goodEnv();
      delete env[envVar];
      const result = assertDemoTargetAuthority({ env, connectionString: DEMO_CONNECTION });
      expect(result.ok).toBe(false);
      const reason = describeDemoTargetRefusals(result.refusals);
      expect(reason).toContain(`[${element}]`);
      expect(reason).toContain(envVar);
    });
  }

  it('refuses a connection string with NO EXPLICIT PORT — 5432 is never assumed', () => {
    const result = assertDemoTargetAuthority({
      env: goodEnv(),
      connectionString: `postgres://demo:pw@${DEMO_HOST}/${DEMO_DATABASE}`,
    });
    expect(result.ok).toBe(false);
    const reason = describeDemoTargetRefusals(result.refusals);
    expect(reason).toContain('[databasePort]');
    expect(reason).toContain('no explicit port');
    expect(parseConnectionTarget(`postgres://demo:pw@${DEMO_HOST}/${DEMO_DATABASE}`).port).toBe('');
  });

  it('refuses a connection string with no database name', () => {
    const elements = refusedElements(goodEnv(), `postgres://demo:pw@${DEMO_HOST}:${DEMO_PORT}`);
    expect(elements).toContain('databaseName');
  });

  it('refuses an unparseable connection string, naming the host it could not read', () => {
    const elements = refusedElements(goodEnv(), 'not-a-url');
    expect(elements).toContain('connectionString');
    expect(elements).toContain('databaseHost');
    expect(elements).toContain('databasePort');
    expect(elements).toContain('databaseName');
  });

  it('refuses when there is no connection string at all', () => {
    const elements = refusedElements(goodEnv(), '');
    expect(elements).toContain('connectionString');
  });
});

describe('demoTargetAuthority — NEGATIVE MATRIX: mismatch between declared and observed', () => {
  for (const [element, envVar] of Object.entries(OBSERVED_TARGET_ENV_VARS)) {
    if (element === 'railwayEnvironmentName') continue; // covered by its own canon test
    it(`refuses when observed ${element} differs from the declaration`, () => {
      const env = goodEnv({ [envVar]: 'something-else' });
      const result = assertDemoTargetAuthority({ env, connectionString: DEMO_CONNECTION });
      expect(result.ok).toBe(false);
      expect(describeDemoTargetRefusals(result.refusals)).toContain(
        `[${element}]: observed "something-else" does not match declared`
      );
    });
  }

  it('refuses when the connection string points at a different port than declared', () => {
    const result = assertDemoTargetAuthority({
      env: goodEnv(),
      connectionString: `postgres://demo:pw@${DEMO_HOST}:5432/${DEMO_DATABASE}`,
    });
    expect(result.ok).toBe(false);
    expect(describeDemoTargetRefusals(result.refusals)).toContain(
      '[databasePort]: observed "5432" does not match declared "28146"'
    );
  });

  it('refuses when the connection string points at a different database than declared', () => {
    const result = assertDemoTargetAuthority({
      env: goodEnv(),
      connectionString: `postgres://demo:pw@${DEMO_HOST}:${DEMO_PORT}/postgres`,
    });
    expect(result.ok).toBe(false);
    expect(describeDemoTargetRefusals(result.refusals)).toContain('[databaseName]');
  });
});

describe('demoTargetAuthority — NEGATIVE MATRIX: production-looking targets', () => {
  it('refuses a production environment NAME even when everything matches it', () => {
    const env = goodEnv({
      [DECLARED_TARGET_ENV_VARS.railwayEnvironmentName]: 'production',
      [OBSERVED_TARGET_ENV_VARS.railwayEnvironmentName]: 'production',
    });
    const result = assertDemoTargetAuthority({ env, connectionString: DEMO_CONNECTION });
    expect(result.ok).toBe(false);
    const reason = describeDemoTargetRefusals(result.refusals);
    expect(reason).toContain('[railwayEnvironmentName]');
    expect(reason).toContain('production-class environment');
  });

  it('refuses a staging environment name', () => {
    const env = goodEnv({
      [DECLARED_TARGET_ENV_VARS.railwayEnvironmentName]: 'staging',
      [OBSERVED_TARGET_ENV_VARS.railwayEnvironmentName]: 'staging',
    });
    expect(refusedElements(env)).toContain('railwayEnvironmentName');
  });

  it('refuses an environment id that does not match, even if the name says demo', () => {
    const env = goodEnv({ [OBSERVED_TARGET_ENV_VARS.railwayEnvironmentId]: 'env_production_9999' });
    expect(refusedElements(env)).toContain('railwayEnvironmentId');
  });

  it('refuses the centerbeam PRODUCTION host even when it is declared as the demo host', () => {
    const env = goodEnv({
      [DECLARED_TARGET_ENV_VARS.databaseHost]: 'centerbeam.proxy.rlwy.net',
    });
    const result = assertDemoTargetAuthority({
      env,
      connectionString: `postgres://demo:pw@centerbeam.proxy.rlwy.net:${DEMO_PORT}/${DEMO_DATABASE}`,
    });
    expect(result.ok).toBe(false);
    const reason = describeDemoTargetRefusals(result.refusals);
    expect(reason).toContain('[databaseHost]');
    expect(reason).toContain('production host pattern');
  });

  it('refuses a non-demo consultify.ai app origin', () => {
    const env = goodEnv({ APP_URL: 'https://consultify.ai' });
    const result = assertDemoTargetAuthority({ env, connectionString: DEMO_CONNECTION });
    expect(result.ok).toBe(false);
    expect(describeDemoTargetRefusals(result.refusals)).toContain('[appOrigin]');
  });

  it('accepts https://demo.consultify.ai as the app origin', () => {
    const env = goodEnv({ APP_URL: 'https://demo.consultify.ai' });
    expect(assertDemoTargetAuthority({ env, connectionString: DEMO_CONNECTION }).ok).toBe(true);
  });

  it('has NO override: no env var makes a refused target acceptable', () => {
    const env = goodEnv({
      [OBSERVED_TARGET_ENV_VARS.railwayProjectId]: 'prj_production',
      DEMO_TARGET_FORCE: '1',
      FORCE: '1',
      ALLOW_PRODUCTION: 'true',
      SKIP_TARGET_CHECK: 'true',
    });
    expect(refusedElements(env)).toContain('railwayProjectId');
  });
});

describe('demoTargetAuthority — tenant class must be DEMO', () => {
  it('refuses organization_type other than DEMO', () => {
    const refusal = evaluateDemoOrganizationRow({
      organizationId: 'atelier',
      row: { id: 'atelier', name: 'Atelier Toys', organization_type: 'CLIENT' },
    });
    expect(refusal?.element).toBe('organization_type');
    expect(refusal?.reason).toContain('organization_type="CLIENT"');
  });

  it('refuses a blank organization_type', () => {
    const refusal = evaluateDemoOrganizationRow({
      organizationId: 'atelier',
      row: { id: 'atelier', organization_type: null },
    });
    expect(refusal?.element).toBe('organization_type');
  });

  it('refuses a missing organization row rather than creating one', () => {
    const refusal = evaluateDemoOrganizationRow({ organizationId: 'atelier', row: null });
    expect(refusal?.element).toBe('organization');
    expect(refusal?.reason).toContain('does not exist');
  });

  it('accepts organization_type = DEMO', () => {
    expect(
      evaluateDemoOrganizationRow({
        organizationId: 'atelier',
        row: { id: 'atelier', organization_type: 'DEMO' },
      })
    ).toBeNull();
  });

  it('reads the row with a parameterized SELECT and refuses when the read itself fails', async () => {
    const seen: Array<{ sql: string; values: unknown[] }> = [];
    const ok = await assertDemoOrganization({
      organizationId: 'atelier',
      query: async (sql, values) => {
        seen.push({ sql, values });
        return [{ id: 'atelier', organization_type: 'DEMO' }];
      },
    });
    expect(ok).toBeNull();
    expect(seen[0].sql).toBe(DEMO_ORGANIZATION_SQL);
    expect(seen[0].sql.trim().startsWith('SELECT')).toBe(true);
    expect(seen[0].values).toEqual(['atelier']);

    const failed = await assertDemoOrganization({
      organizationId: 'atelier',
      query: async () => {
        throw new Error('connection reset');
      },
    });
    expect(failed?.element).toBe('organization');
    expect(failed?.reason).toContain('Unproven is not proven');
  });
});
