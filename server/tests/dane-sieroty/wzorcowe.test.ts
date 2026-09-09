/**
 * BEZPIECZNIK: wartości wzorcowe organizacji nie są sierotami.
 *
 * POWÓD (09.09.2026): `--sieroty-apply` skasował na stagingu i demo 319 wierszy
 * konfiguracji produktu — w tym `ie_governance_policies ('*','PRODUCT','DEFAULT')`
 * z migracji 932. Każda próba utworzenia inicjatywy kończyła się wtedy HTTP 500
 * `INITIATIVES_EXECUTION_RUNTIME_FAILED` („Product baseline is missing”).
 */
import { describe, expect, it } from 'vitest';

import { ORGANIZACJE_WZORCOWE, predykatSieroty } from '../../../scripts/dane/usun-organizacje';

describe('sieroty — wartości wzorcowe', () => {
  it('predykat sieroty wyklucza wartości wzorcowe', () => {
    const p = predykatSieroty('ie_governance_policies', 'organization_id');
    expect(p).toContain("NOT IN ('*','__system__','__global__','')");
    expect(p).toContain('NOT EXISTS (SELECT 1 FROM organizations');
  });

  it('lista wzorcowych obejmuje baseline produktu, systemowe, globalne i pusty ciąg', () => {
    expect([...ORGANIZACJE_WZORCOWE]).toEqual(['*', '__system__', '__global__', '']);
  });

  it('mutacja: usunięcie wykluczenia z predykatu jest wykrywalne', () => {
    const p = predykatSieroty('t', 'organization_id');
    const bezWykluczenia = `"t"."organization_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = "t"."organization_id"::text)`;
    expect(p).not.toBe(bezWykluczenia);
  });
});
