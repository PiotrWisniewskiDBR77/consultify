/**
 * @vitest-environment node
 *
 * 1.12-R1b — dwie dziury w Kokpicie zmierzone przez R1/R2 (ZNALEZISKA):
 *
 *  1. TOP ryzyka czytało `execSnapshot.risks.topRisks` (0 na DBR77), obok
 *     leżało nieczytane `GET /api/raid` (16 pozycji — ten sam rejestr co
 *     zakładka „Decyzje i ryzyka"). Kafel/tabela mają czytać `/api/raid`.
 *  2. Kafel „Obłożenie" pokazywał „—"/„0 osób" z `capacityTimeline`
 *     (podaż z `initiative_resources`, 0 wierszy w DBR77). R2 wystawił
 *     `GET /api/execution-control/capacity/resource-plan` z `summary`
 *     (utilizationPercent/overloadedCount/peopleCount) — Kokpit ma to czytać.
 *  3. Kafel „blokery" liczył `status === 'BLOCKED'` wprost — migracja P12
 *     (Codex, w toku) zamienia to na `IN_EXECUTION` + `on_hold`.
 *
 * `ExecutionHub` jest za ciężki do zamontowania w teście jednostkowym (patrz
 * bratnie `.daneRealne.source.test.ts` / `.entityLookup.test.tsx`) — regres
 * blokujemy na źródle, tym samym wzorcem.
 *
 * MUTACJA (dowód, wykonana ręcznie przy pisaniu tego pliku — patrz meldunek):
 *  · przywrócenie `execSnapshot?.risks?.topRisks` w miejscu `risks` → RED na
 *    teście „ryzyka źródło z /api/raid…";
 *  · przywrócenie `capacityTimeline[0]` w miejscu `utilizationPercent` → RED
 *    na teście „Obłożenie źródło z resource-plan…";
 *  · przywrócenie `i.status === InitiativeStatus.BLOCKED` w `actionCenter`
 *    → RED na teście „blokery liczą przez isBlockedInitiative…".
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');

const blok = (od: string, doTekstu: string): string => {
  const start = source.indexOf(od);
  expect(start, `nie znaleziono kotwicy: ${od}`).toBeGreaterThan(-1);
  const end = source.indexOf(doTekstu, start);
  expect(end, `nie znaleziono końca dla: ${od}`).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe('1.12-R1b (1) — TOP ryzyka Kokpitu z /api/raid, nie z execSnapshot', () => {
  it('pobiera RAID przez Api.raidList(), niezależnie od execSnapshot', () => {
    const fn = blok(
      '// 1.12-R1b (1+2): Kokpit „Ryzyka"',
      'return () => {\n      cancelled = true;\n    };\n  }, [executionTruthRefreshKey]);'
    );
    expect(fn).toContain('Api.raidList()');
    expect(fn).toContain('setRaidItems(');
  });

  it('ryzyka źródło z /api/raid (raidItems), NIE execSnapshot.risks.topRisks', () => {
    const fn = blok('const risks = topRaidItemsByLevel(raidItems, 10).map((r) => ({', '});');
    expect(fn).toContain('topRaidItemsByLevel(raidItems, 10)');
    expect(fn).not.toContain('execSnapshot?.risks?.topRisks');
    expect(fn).toContain('raidLevelScore(r)');
    expect(fn).toContain('raidOwnerDisplayName(r, resolveRaidOwnerName)');
    expect(fn).toContain('mitigationPlan: r.mitigationPlan');
  });

  it('chip „Ryzyka" liczy WSZYSTKIE pozycje RAID (raidItems.length), nie tylko TOP 10', () => {
    const fn = blok(
      "// DEC-426 (1.1-E-1): liczniki chipów Menu 3 Kokpitu",
      '  ]);'
    );
    expect(fn).toContain('ryzyka: raidItems.length');
    expect(fn).not.toContain('ryzyka: summaryOneLookProps.topRisks.length');
  });

  it('klik wiersza ryzyka otwiera podgląd (jedenPanel + wybór), nie fabrykuje panelu', () => {
    const fn = blok('const openEntityById = useCallback(', 'const handleCloseDocument');
    expect(fn).toContain("normalizedType === 'RISK'");
    expect(fn).toContain('raidItems.find((r) => String(r.id) === entityId)');
    expect(fn).toContain('jedenPanel.otworz();');
    expect(fn).toContain('setSummaryPreviewRiskId(entityId);');
    // Ten sam kontrakt co gałąź INITIATIVE: nie znaleziono → toast, nie panel.
    const riskBranch = fn.slice(fn.indexOf("normalizedType === 'RISK'"));
    const notFoundToast = riskBranch.slice(0, riskBranch.indexOf('toast.error('));
    expect(notFoundToast).not.toContain('setSummaryPreviewRiskId(null)');
  });
});

describe('1.12-R1b (2) — Obłożenie Kokpitu z planu zasobów (R2), nie z capacityTimeline', () => {
  it('utilizationPercent/overallocatedCount/headcount pochodzą z resourcePlanSummary', () => {
    const fn = blok(
      'const utilizationPercent = resourcePlanSummary?.utilizationPercent ?? null;',
      'const roi = execSnapshot?.roi?.summary ?? null;'
    );
    expect(fn).toContain('resourcePlanSummary?.overloadedCount');
    expect(fn).toContain('resourcePlanSummary?.peopleCount');
    expect(fn).not.toContain('capacityTimeline[0]');
    expect(fn).not.toContain('capacityAlerts.filter');
  });

  it('brak podaży z profilu (wszyscy DOMYSLNA) ustawia defaultCapacityAssumed, nie milczy', () => {
    const fn = blok(
      'const defaultCapacityAssumed = Boolean(',
      'const roi = execSnapshot?.roi?.summary ?? null;'
    );
    expect(fn).toContain('peopleWithoutProfileSupply === resourcePlanSummary.peopleCount');
  });

  it('pobiera plan zasobów przez readExecutionResourcePlan(), niezależnie od RAID', () => {
    const fn = blok(
      '// 1.12-R1b (1+2): Kokpit „Ryzyka"',
      'return () => {\n      cancelled = true;\n    };\n  }, [executionTruthRefreshKey]);'
    );
    expect(fn).toContain('readExecutionResourcePlan()');
    expect(fn).toContain('setResourcePlanSummary(');
  });
});

describe('1.12-R1b (3) — kafel „blokery" działa w obu słownikach statusu', () => {
  it('actionCenter.blocked liczy przez isBlockedInitiative(i), nie status === BLOCKED wprost', () => {
    const fn = blok('const actionCenter = useMemo(() => {', 'return {\n      blocked,');
    expect(fn).toContain('dashboardBaseInitiatives.filter((i) => isBlockedInitiative(i))');
    expect(fn).not.toContain('i.status === InitiativeStatus.BLOCKED');
  });
});
