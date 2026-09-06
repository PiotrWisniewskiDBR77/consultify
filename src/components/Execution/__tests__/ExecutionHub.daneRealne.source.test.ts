/**
 * @vitest-environment node
 *
 * 1.12-R1 (D) — ExecutionHub przestaje zawężać portfel do JEDNEGO projektu.
 *
 * POMIAR 06.09 (org DBR77, API 127.0.0.1:4100): 43 z 72 inicjatyw i 20 z 35
 * decyzji nie ma `projectId`. Pięć wołań w tym pliku pytało `?projectId=…`
 * i wychodziło wcześniej przez `if (!currentProjectId) return;`, więc kafel
 * „Do rozstrzygnięcia" pokazywał 1 zamiast 25.
 *
 * `ExecutionHub` jest za ciężki do zamontowania w teście jednostkowym (patrz
 * bratni `ExecutionHub.demoFallback.test.tsx` / `.entityLookup.test.tsx`),
 * więc regresję blokujemy na źródle — dokładnie tak, jak reszta rodziny.
 * MUTACJA (dowód): przywrócenie `Api.getTasks({ projectId: currentProjectId })`
 * albo `/decisions?projectId=` wywraca pierwsze dwa przypadki.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');

const blok = (od: string, doTekstu: string): string => {
  const start = source.indexOf(od);
  expect(start, `nie znaleziono kotwicy: ${od}`).toBeGreaterThan(-1);
  const end = source.indexOf(doTekstu, start);
  return source.slice(start, end === -1 ? source.length : end);
};

describe('1.12-R1 (D) — zdjęty filtr po projekcie', () => {
  it('zadania pobiera dla całej organizacji, bez projectId i bez bramki wyjścia', () => {
    const fn = blok('const loadTasks = async () => {', 'loadTasks();');
    expect(fn).toContain('Api.getTasks()');
    expect(fn).not.toMatch(/Api\.getTasks\(\s*\{\s*projectId/);
    expect(blok('  // 1.12-R1 (D): ZDJĘTY FILTR', 'loadTasks();')).not.toMatch(
      /if \(!currentProjectId\) return;\s*\n\s*const loadTasks/
    );
  });

  it('decyzje pobiera dla całej organizacji, bez projectId i bez bramki wyjścia', () => {
    const fn = blok('const loadDecisions = async () => {', 'loadDecisions();');
    expect(fn).toContain("Api.get('/decisions')");
    expect(fn).not.toContain('/decisions?projectId=');
    const przedFunkcja = source.slice(
      source.lastIndexOf('useEffect(() => {', source.indexOf('const loadDecisions')),
      source.indexOf('const loadDecisions')
    );
    expect(przedFunkcja).not.toContain('if (!currentProjectId) return;');
  });

  it('inicjatywy pobiera bez projectId (43 z 72 nie mają projektu)', () => {
    const fn = blok('const loadInitiatives = async () => {', '} catch (err: any) {');
    expect(fn).toContain('Api.getInitiatives()');
    expect(fn).not.toContain('Api.getInitiatives(currentProjectId');
  });
});

describe('1.12-R1 (D) — kafle liczą z realnych danych', () => {
  it('„Do rozstrzygnięcia" bierze KAŻDĄ otwartą decyzję po terminie, nie tylko PENDING', () => {
    const fn = blok('const actionCenter = useMemo(() => {', 'return {\n      blocked,');
    // Stary filtr dawał na DBR77 dokładnie 0 — wszystkie 12 przeterminowanych
    // decyzji ma status ESCALATED.
    expect(fn).not.toMatch(/=== 'PENDING' && isPastDue/);
    expect(fn).toContain('overdueOpenDecisions(decisions)');
  });

  it('lista „do rozstrzygnięcia" nie jest obcinana do sześciu pozycji', () => {
    const fn = blok('const pendingDecisionItems = decisions', 'const milestones =');
    expect(fn).not.toContain('.slice(0, 6)');
    expect(fn).toContain('isOpenDecision(d)');
  });

  it('„Na czas" liczy się z plannedEndDate, a nie „wszystko poza zablokowanym"', () => {
    const fn = blok('const summaryOneLookProps = useMemo(() => {', 'const roi =');
    expect(fn).toContain('onTimeFromInitiatives(dashboardBaseInitiatives)');
    expect(fn).not.toContain('portfolioMetrics.onTrackCount');
  });

  it('kondycja portfela liczy decyzje tą samą definicją co kafel', () => {
    const fn = blok('const portfolioMetrics = useMemo(() => {', 'const criticalCapacityAlerts');
    expect(fn).toContain('overdueOpenDecisions(decisions)');
    expect(fn).toContain('openDecisions(decisions)');
  });
});

describe('1.12-R1 (A) — zakres „w toku"', () => {
  it('TRACKING jest wczytywane i mieści się w zakresie aktywnym', () => {
    const zakres = blok(
      'const ACTIVE_EXECUTION_STATUSES: InitiativeStatus[] = [',
      '];'
    );
    expect(zakres).toContain('InitiativeStatus.EXECUTING');
    expect(zakres).toContain('InitiativeStatus.BLOCKED');
    expect(zakres).toContain('InitiativeStatus.TRACKING');
    expect(blok('const EXECUTION_STATUSES: InitiativeStatus[] =', ');')).toContain(
      'InitiativeStatus.TRACKING'
    );
  });
});
