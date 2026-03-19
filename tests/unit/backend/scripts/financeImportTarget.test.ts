import { afterEach, describe, expect, it } from 'vitest';

import { resolveFinanceImportOrgId } from '../../../../server/scripts/lib/financeImportTarget.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('financeImportTarget.resolveFinanceImportOrgId', () => {
  it('requires an explicit finance import org id', () => {
    delete process.env.FINANCE_IMPORT_ORG_ID;
    process.env.DEMO_ORG_ID = 'demo-org';

    expect(() => resolveFinanceImportOrgId()).toThrow(/Missing explicit finance import organization/);
  });

  it('blocks demo orgs by default even when explicitly requested', () => {
    process.env.FINANCE_IMPORT_ORG_ID = 'demo-org';
    delete process.env.ALLOW_DEMO_FINANCE_IMPORT;

    expect(() => resolveFinanceImportOrgId()).toThrow(/Demo\/staging orgs are blocked by default/);
  });

  it('allows a real explicit org target', () => {
    process.env.FINANCE_IMPORT_ORG_ID = 'dbr77';

    expect(resolveFinanceImportOrgId()).toBe('dbr77');
  });

  it('allows atelier as another real explicit org target', () => {
    process.env.FINANCE_IMPORT_ORG_ID = 'atelier';

    expect(resolveFinanceImportOrgId()).toBe('atelier');
  });

  it('allows demo orgs only with an override', () => {
    process.env.FINANCE_IMPORT_ORG_ID = 'demo-org';
    process.env.ALLOW_DEMO_FINANCE_IMPORT = '1';

    expect(resolveFinanceImportOrgId()).toBe('demo-org');
  });
});
