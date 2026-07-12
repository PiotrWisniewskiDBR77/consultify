/**
 * Program Management report packs — Sponsor One-Pager / Steering / PMO Weekly.
 * ============================================================================
 * SSOT: decyzje właściciela D12+D13 (`Harvard/wdrozenie-100/_DECYZJE_PIOTRA_2026-07-12.md`)
 * + `_KONCEPT_PROGRAM_MANAGEMENT_2026-07-10.md` §6. Kanon F5 = `reportBuilderService` +
 * `report_builder_templates` (migracja 924, siostrzana do 913_program_3axis_report.sql).
 *
 * ZERO NOWYCH SILNIKÓW — ten plik tylko KOMPONUJE i RENDERUJE dane z ISTNIEJĄCYCH
 * read-modeli (dokładnie wzorzec `threeAxisReportService.ts` „WPIĘCIE W F5"):
 *   - `threeAxisReportService.buildThreeAxisReport`  — T/Z/W trzy osie
 *   - `executionControlReadService.getTimelineWarningsSnapshot` — overdue/blocked (alerty)
 *   - `decisions` (tabela, zapytanie org/project-scoped — wzorzec `decisionService.getPendingDecisions`
 *     rozszerzony o "wszyscy decydenci", nie tylko jeden user — bo raport PM nie ma jednego odbiorcy)
 *   - `aiRiskChangeControl.getOpenRisks` / `getScopeChangeSummary` — ryzyka + zmiany zakresu (project-scoped)
 *   - `workloadCapacityService.getCapacityOverview` / `getOverloadAlerts` — obciążenia (org-wide)
 *   - `initiativeLineageService.getInitiativeFunnel` — cycle-time per status (Observability, F5.2)
 *   - `tasks` (tabela, zapytanie on-time/late — wzorzec `CapacityController` inline SQL)
 *
 * D12 (3. oś = DWIE osobne perspektywy — wartość finansowa vs KPI operacyjny):
 * `threeAxisReportService.computeAxisW` liczy JEDEN zlany wskaźnik W nad WSZYSTKIMI
 * `initiative_kpis` bez względu na `unit`. Tu rozdzielamy PREZENTACYJNIE (bez zmiany
 * silnika W używanego przez inne raporty) przez grupowanie tych samych tabel
 * (`value_baselines` + `initiative_kpis`) wg `unit`: waluty (PLN/USD/EUR/GBP/CHF) =
 * "wartość finansowa", reszta (%, count, hours, ...) = "KPI operacyjny". OGRANICZENIE
 * DANYCH (uczciwie, nie zamiatane pod dywan): `value_ledger_entries` NIE ma `kpi_id`
 * (korekty są per-inicjatywa, nie per-KPI) — więc korekty ladger NIE mogą być
 * przypisane do żadnego z dwóch koszyków z czystym sumieniem. Raportujemy je jako
 * osobną, jawnie oznaczoną pozycję "korekty nieprzypisane", zamiast zgadywać.
 */

import { getInitiativeFunnel } from '../initiative/initiativeLineageService.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import logger from '../../utils/Logger.js';
import { getTimelineWarningsSnapshot, type TimelineWarning } from '../executionControlReadService.js';
import AIRiskChangeControl from '../aiRiskChangeControl.js';
import * as workloadCapacityService from '../workloadCapacityService.js';
import ReportBuilderService from '../reportBuilderService.js';
import {
  buildThreeAxisReport,
  type ThreeAxisReport,
  type ThreeAxisScope,
  type AxisReading,
} from './threeAxisReportService.js';

/* ────────────────────────────────────────────────────────────────────────────
   D12 — split prezentacyjny osi W (wartość finansowa vs KPI operacyjny)
   ──────────────────────────────────────────────────────────────────────────── */

const CURRENCY_UNITS = new Set(['PLN', 'USD', 'EUR', 'GBP', 'CHF']);

export interface ValueAxisSplit {
  financial: AxisReading;
  operational: AxisReading;
  /** Korekty z value_ledger_entries — schemat nie wiąże ich z konkretnym KPI/unit,
   *  więc nie da się ich uczciwie przypisać do żadnego koszyka (patrz docblock pliku). */
  unattributedLedgerDelta: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function axisFromTotals(current: number, target: number): AxisReading {
  if (!(target > 0)) return { pct: null, dataQuality: 'missing', flags: ['no-value-baseline'] };
  return { pct: round1((current / target) * 100), dataQuality: 'ok', flags: [] };
}

/**
 * Rozdziela oś W na "wartość finansowa" (unit walutowy) i "KPI operacyjny" (reszta),
 * reusing DOKŁADNIE te same tabele co `threeAxisReportService.fetchValueAxis`
 * (value_baselines JOIN initiative_kpis), tylko grupowane dodatkowo po `unit`.
 */
export async function fetchValueAxisSplit(
  organizationId: string,
  initiativeIds: string[]
): Promise<Map<string, ValueAxisSplit>> {
  const map = new Map<string, ValueAxisSplit>();
  if (initiativeIds.length === 0) return map;
  try {
    const placeholders = queryHelpers.buildInPlaceholders(initiativeIds);
    const [bucketRows, ledgerRows] = await Promise.all([
      queryHelpers.queryAll<{
        initiative_id: string;
        unit: string | null;
        baseline_total: number;
        target_total: number;
      }>(
        `SELECT vb.initiative_id AS initiative_id,
                ik.unit AS unit,
                SUM(vb.frozen_value) AS baseline_total,
                SUM(COALESCE(ik.target_value, 0)) AS target_total
           FROM value_baselines vb
           JOIN initiative_kpis ik ON ik.id = vb.kpi_id
          WHERE vb.organization_id = ? AND vb.is_active = 1 AND vb.initiative_id IN (${placeholders})
          GROUP BY vb.initiative_id, ik.unit`,
        [organizationId, ...initiativeIds]
      ),
      queryHelpers.queryAll<{ initiative_id: string; delta_total: number }>(
        `SELECT initiative_id, SUM(value_delta) AS delta_total
           FROM value_ledger_entries
          WHERE organization_id = ? AND initiative_id IN (${placeholders})
          GROUP BY initiative_id`,
        [organizationId, ...initiativeIds]
      ),
    ]);

    const deltaByIni = new Map<string, number>();
    for (const row of ledgerRows || []) deltaByIni.set(String(row.initiative_id), Number(row.delta_total) || 0);

    const totalsByIni = new Map<string, { finCurrent: number; finTarget: number; opCurrent: number; opTarget: number }>();
    for (const row of bucketRows || []) {
      const id = String(row.initiative_id);
      const isFinancial = CURRENCY_UNITS.has(String(row.unit || '').toUpperCase());
      const entry = totalsByIni.get(id) || { finCurrent: 0, finTarget: 0, opCurrent: 0, opTarget: 0 };
      const baseline = Number(row.baseline_total) || 0;
      const target = Number(row.target_total) || 0;
      if (isFinancial) {
        entry.finCurrent += baseline;
        entry.finTarget += target;
      } else {
        entry.opCurrent += baseline;
        entry.opTarget += target;
      }
      totalsByIni.set(id, entry);
    }

    for (const [id, t] of totalsByIni.entries()) {
      map.set(id, {
        financial: axisFromTotals(t.finCurrent, t.finTarget),
        operational: axisFromTotals(t.opCurrent, t.opTarget),
        unattributedLedgerDelta: deltaByIni.get(id) ?? 0,
      });
    }
    return map;
  } catch (err) {
    logger.warn(
      `[programManagementReportsService] fetchValueAxisSplit failed (degrading to empty): ${(err as Error)?.message || err}`
    );
    return map;
  }
}

/**
 * Program-level (agregat, nie per-inicjatywa) wersja `fetchValueAxisSplit` — jedno
 * zapytanie GROUP BY unit zamiast GROUP BY (initiative_id, unit) + sumowanie w JS.
 * Używane przez Sponsor One-Pager (potrzebuje tylko agregatu programu, nie wierszy).
 */
export async function fetchProgramValueAxisSplit(
  organizationId: string,
  initiativeIds: string[]
): Promise<ValueAxisSplit> {
  const empty: ValueAxisSplit = {
    financial: { pct: null, dataQuality: 'missing', flags: ['no-value-baseline'] },
    operational: { pct: null, dataQuality: 'missing', flags: ['no-value-baseline'] },
    unattributedLedgerDelta: 0,
  };
  if (initiativeIds.length === 0) return empty;
  try {
    const placeholders = queryHelpers.buildInPlaceholders(initiativeIds);
    const [bucketRows, ledgerRows] = await Promise.all([
      queryHelpers.queryAll<{ unit: string | null; baseline_total: number; target_total: number }>(
        `SELECT ik.unit AS unit,
                SUM(vb.frozen_value) AS baseline_total,
                SUM(COALESCE(ik.target_value, 0)) AS target_total
           FROM value_baselines vb
           JOIN initiative_kpis ik ON ik.id = vb.kpi_id
          WHERE vb.organization_id = ? AND vb.is_active = 1 AND vb.initiative_id IN (${placeholders})
          GROUP BY ik.unit`,
        [organizationId, ...initiativeIds]
      ),
      queryHelpers.queryAll<{ delta_total: number }>(
        `SELECT SUM(value_delta) AS delta_total
           FROM value_ledger_entries
          WHERE organization_id = ? AND initiative_id IN (${placeholders})`,
        [organizationId, ...initiativeIds]
      ),
    ]);

    let finCurrent = 0;
    let finTarget = 0;
    let opCurrent = 0;
    let opTarget = 0;
    for (const row of bucketRows || []) {
      const isFinancial = CURRENCY_UNITS.has(String(row.unit || '').toUpperCase());
      if (isFinancial) {
        finCurrent += Number(row.baseline_total) || 0;
        finTarget += Number(row.target_total) || 0;
      } else {
        opCurrent += Number(row.baseline_total) || 0;
        opTarget += Number(row.target_total) || 0;
      }
    }

    return {
      financial: axisFromTotals(finCurrent, finTarget),
      operational: axisFromTotals(opCurrent, opTarget),
      unattributedLedgerDelta: Number(ledgerRows?.[0]?.delta_total) || 0,
    };
  } catch (err) {
    logger.warn(
      `[programManagementReportsService] fetchProgramValueAxisSplit failed (degrading to empty): ${(err as Error)?.message || err}`
    );
    return empty;
  }
}

function bar(pct: number | null): string {
  if (pct === null) return '░░░░░░░ n/d';
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.max(0, Math.min(7, Math.round((clamped / 100) * 7)));
  return '▓'.repeat(filled) + '░'.repeat(7 - filled) + ` ${round1(pct)}%`;
}

/* ────────────────────────────────────────────────────────────────────────────
   Common scope helper
   ──────────────────────────────────────────────────────────────────────────── */

export interface PmReportScope {
  organizationId: string;
  projectId?: string;
  programId?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
   (a) SPONSOR ONE-PAGER — 3 osie + top 3 alerty + decyzje czekające
   ──────────────────────────────────────────────────────────────────────────── */

export interface PendingDecisionRow {
  id: string;
  title: string;
  type: string;
  deadline: string | null;
  status: string;
}

/** Decyzje czekające, ORG/PROJECT-scoped (nie per-user — raport PM nie ma jednego
 *  odbiorcy, w przeciwieństwie do `decisionService.getPendingDecisions(userId, orgId)`). */
async function fetchPendingDecisions(scope: PmReportScope, limit = 10): Promise<PendingDecisionRow[]> {
  try {
    let where = 'organization_id = ? AND status IN (\'pending\', \'escalated\')';
    const params: unknown[] = [scope.organizationId];
    if (scope.projectId) {
      where += ' AND project_id = ?';
      params.push(scope.projectId);
    }
    const rows = await queryHelpers.queryAll<PendingDecisionRow>(
      `SELECT id, title, type, deadline, status FROM decisions
        WHERE ${where}
        ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC
        LIMIT ${Number(limit) || 10}`,
      params
    );
    return rows || [];
  } catch (err) {
    logger.warn(
      `[programManagementReportsService] fetchPendingDecisions failed (degrading to empty): ${(err as Error)?.message || err}`
    );
    return [];
  }
}

export interface SponsorOnePagerData {
  threeAxis: ThreeAxisReport;
  valueSplit: ValueAxisSplit | null;
  topAlerts: TimelineWarning[];
  pendingDecisions: PendingDecisionRow[];
}

export async function buildSponsorOnePager(scope: PmReportScope): Promise<SponsorOnePagerData> {
  const axisScope: ThreeAxisScope = {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    programId: scope.programId,
  };
  const [threeAxis, alerts, pendingDecisions] = await Promise.all([
    buildThreeAxisReport(axisScope),
    getTimelineWarningsSnapshot(scope.organizationId, scope.projectId).catch(() => ({ warnings: [], total: 0 })),
    fetchPendingDecisions(scope, 5),
  ]);

  const initiativeIds = threeAxis.rows.map((r) => r.initiativeId);
  const valueSplit = await fetchProgramValueAxisSplit(scope.organizationId, initiativeIds);

  return {
    threeAxis,
    valueSplit,
    topAlerts: (alerts.warnings || []).slice(0, 3),
    pendingDecisions,
  };
}

export function renderSponsorOnePagerMarkdown(data: SponsorOnePagerData): Record<string, string> {
  const { threeAxis, valueSplit, topAlerts, pendingDecisions } = data;
  const ragEmoji = (r: string) => (r === 'GREEN' ? '🟢' : r === 'AMBER' ? '🟡' : r === 'RED' ? '🔴' : '⚪');

  const header = [
    `# Sponsor One-Pager — ${threeAxis.scope.level}`,
    '',
    `**Stan na:** ${threeAxis.asOf}`,
    `**Werdykt programu:** ${ragEmoji(threeAxis.program.rag)} ${threeAxis.program.rag}`,
  ].join('\n');

  const threeAxisSnapshot = [
    '## Trzy osie (agregat programu)',
    '',
    `- **T (czas):** ${bar(threeAxis.program.T.pct)}`,
    `- **Z (zadania):** ${bar(threeAxis.program.Z.pct)}`,
    `- **W (wartość, zlana — patrz sekcja D12 poniżej):** ${bar(threeAxis.program.W.pct)}`,
    '',
    '### D12 — wartość finansowa vs KPI operacyjny (osobne perspektywy)',
    valueSplit
      ? [
          `- **Wartość finansowa (PLN/USD/EUR/...):** ${bar(valueSplit.financial.pct)}`,
          `- **KPI operacyjny (%, count, godziny, ...):** ${bar(valueSplit.operational.pct)}`,
          valueSplit.unattributedLedgerDelta !== 0
            ? `- ⚠️ Korekty nieprzypisane (value_ledger, brak kpi_id w schemacie): ${round1(valueSplit.unattributedLedgerDelta)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '_Brak danych o KPI._',
  ].join('\n');

  const alertsSection = [
    '## Top 3 alerty',
    '',
    topAlerts.length
      ? topAlerts
          .map((a) => `- **${a.severity.toUpperCase()}** — ${a.initiativeName}: ${a.message}`)
          .join('\n')
      : '_Brak aktywnych alertów (overdue/blocked)._',
  ].join('\n');

  const decisionsSection = [
    '## Decyzje czekające',
    '',
    pendingDecisions.length
      ? pendingDecisions
          .map((d) => `- **${d.title}** (${d.type})${d.deadline ? ` — termin: ${d.deadline}` : ''}`)
          .join('\n')
      : '_Brak decyzji czekających na akceptację._',
  ].join('\n');

  return {
    header,
    three_axis_snapshot: threeAxisSnapshot,
    top_alerts: alertsSection,
    pending_decisions: decisionsSection,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   (b) STEERING — 3-osi per inicjatywa + ryzyka + zmiany zakresu
   ──────────────────────────────────────────────────────────────────────────── */

export interface SteeringData {
  threeAxis: ThreeAxisReport;
  risks: Awaited<ReturnType<typeof AIRiskChangeControl.getOpenRisks>>;
  scopeChanges: Awaited<ReturnType<typeof AIRiskChangeControl.getScopeChangeSummary>> | null;
}

export async function buildSteering(scope: PmReportScope): Promise<SteeringData> {
  const axisScope: ThreeAxisScope = {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    programId: scope.programId,
  };
  const threeAxis = await buildThreeAxisReport(axisScope);

  // Ryzyka + zmiany zakresu żyją per-projekt (risk_register/scope_change_log —
  // `aiRiskChangeControl.ts`). Bez projectId (zakres = program/organizacja) degradujemy
  // do pustych list zamiast zgadywać po którym projekcie iterować (fail-soft, jawne).
  let risks: SteeringData['risks'] = [];
  let scopeChanges: SteeringData['scopeChanges'] = null;
  if (scope.projectId) {
    [risks, scopeChanges] = await Promise.all([
      AIRiskChangeControl.getOpenRisks(scope.projectId).catch(() => []),
      AIRiskChangeControl.getScopeChangeSummary(scope.projectId, 30).catch(() => null),
    ]);
  }

  return { threeAxis, risks, scopeChanges };
}

export function renderSteeringMarkdown(data: SteeringData): Record<string, string> {
  const { threeAxis, risks, scopeChanges } = data;
  const ragEmoji = (r: string) => (r === 'GREEN' ? '🟢' : r === 'AMBER' ? '🟡' : r === 'RED' ? '🔴' : '⚪');

  const header = [
    `# Raport Steering — ${threeAxis.scope.level}`,
    '',
    `**Stan na:** ${threeAxis.asOf}`,
    `**Werdykt programu:** ${ragEmoji(threeAxis.program.rag)} ${threeAxis.program.rag}`,
  ].join('\n');

  const overviewHeader = '| Inicjatywa | T | Z | W | RAG |\n|---|---|---|---|---|';
  const rows = threeAxis.rows
    .map((r) => `| ${r.name} | ${bar(r.T.pct)} | ${bar(r.Z.pct)} | ${bar(r.W.pct)} | ${ragEmoji(r.rag)} |`)
    .join('\n');
  const threeAxisByInitiative = [
    '## Trzy osie per inicjatywa',
    '',
    overviewHeader,
    rows || '| — | — | — | — | — |',
  ].join('\n');

  const risksSection = [
    '## Ryzyka otwarte',
    '',
    risks.length
      ? risks
          .map(
            (r: any) =>
              `- **${String(r.severity || '').toUpperCase()}** — ${r.title} (${r.risk_type}) — właściciel: ${r.ownerName}`
          )
          .join('\n')
      : scopeChanges === null && !risks.length
        ? '_Zakres raportu = program/organizacja — ryzyka śledzone per-projekt; podaj `projectId`, by je zobaczyć._'
        : '_Brak otwartych ryzyk._',
  ].join('\n');

  const scopeSection = [
    '## Zmiany zakresu (30 dni)',
    '',
    scopeChanges
      ? [
          `- Łącznie zmian: ${scopeChanges.totalChanges} (niekontrolowanych: ${scopeChanges.totalUncontrolled})`,
          `- Wskaźnik kontroli: ${scopeChanges.controlRate}%`,
          `- Wg typu: ${Object.entries(scopeChanges.byChangeType).map(([k, v]) => `${k}=${v}`).join(', ') || '—'}`,
        ].join('\n')
      : '_Zakres raportu = program/organizacja — zmiany zakresu śledzone per-projekt; podaj `projectId`, by je zobaczyć._',
  ].join('\n');

  return {
    header,
    three_axis_by_initiative: threeAxisByInitiative,
    risks: risksSection,
    scope_changes: scopeSection,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   (c) PMO WEEKLY — on-time/late zadania + obciążenia + cycle-time
   ──────────────────────────────────────────────────────────────────────────── */

export interface TaskOnTimeStats {
  doneCount: number;
  doneOnTime: number;
  openTotal: number;
  openLate: number;
}

async function fetchTaskOnTimeStats(scope: PmReportScope): Promise<TaskOnTimeStats> {
  try {
    let where = 'organization_id = ?';
    const params: unknown[] = [scope.organizationId];
    if (scope.projectId) {
      where += ' AND project_id = ?';
      params.push(scope.projectId);
    }
    const nowIso = new Date().toISOString();
    const row = await queryHelpers.queryOne<{
      done_count: number;
      done_on_time: number;
      open_total: number;
      open_late: number;
    }>(
      `SELECT
         SUM(CASE WHEN lower(coalesce(status,'')) IN ('done','completed','validated') THEN 1 ELSE 0 END) AS done_count,
         SUM(CASE WHEN lower(coalesce(status,'')) IN ('done','completed','validated')
                   AND due_date IS NOT NULL AND completed_at IS NOT NULL AND completed_at <= due_date
                  THEN 1 ELSE 0 END) AS done_on_time,
         SUM(CASE WHEN lower(coalesce(status,'')) NOT IN ('done','completed','validated','cancelled') THEN 1 ELSE 0 END) AS open_total,
         SUM(CASE WHEN lower(coalesce(status,'')) NOT IN ('done','completed','validated','cancelled')
                   AND due_date IS NOT NULL AND due_date < ?
                  THEN 1 ELSE 0 END) AS open_late
       FROM tasks WHERE ${where}`,
      [nowIso, ...params]
    );
    return {
      doneCount: Number(row?.done_count) || 0,
      doneOnTime: Number(row?.done_on_time) || 0,
      openTotal: Number(row?.open_total) || 0,
      openLate: Number(row?.open_late) || 0,
    };
  } catch (err) {
    logger.warn(
      `[programManagementReportsService] fetchTaskOnTimeStats failed (degrading to zeros): ${(err as Error)?.message || err}`
    );
    return { doneCount: 0, doneOnTime: 0, openTotal: 0, openLate: 0 };
  }
}

export interface PmoWeeklyData {
  taskStats: TaskOnTimeStats;
  capacity: Awaited<ReturnType<typeof workloadCapacityService.getCapacityOverview>>;
  overloads: Awaited<ReturnType<typeof workloadCapacityService.getOverloadAlerts>>;
  cycleTime: Awaited<ReturnType<typeof getInitiativeFunnel>>['cycleTime'];
}

export async function buildPmoWeekly(scope: PmReportScope): Promise<PmoWeeklyData> {
  const [taskStats, capacity, overloads, funnel] = await Promise.all([
    fetchTaskOnTimeStats(scope),
    workloadCapacityService.getCapacityOverview(scope.organizationId).catch(() => ({
      users: [],
      summary: { totalCapacity: 0, totalAllocated: 0, totalBacklog: 0, avgUtilization: 0 },
      windowStart: '',
      windowEnd: '',
    })),
    workloadCapacityService.getOverloadAlerts(scope.organizationId, 'week').catch(() => []),
    getInitiativeFunnel(scope.organizationId).catch(() => ({
      byStatus: {},
      bySource: {},
      conversion: { created: 0, inExecution: 0, tracking: 0, conversionPct: 0 },
      cycleTime: [],
    })),
  ]);

  return { taskStats, capacity, overloads, cycleTime: funnel.cycleTime };
}

export function renderPmoWeeklyMarkdown(data: PmoWeeklyData): Record<string, string> {
  const { taskStats, capacity, overloads, cycleTime } = data;

  const onTimePct =
    taskStats.doneCount > 0 ? round1((taskStats.doneOnTime / taskStats.doneCount) * 100) : null;

  const header = [
    '# PMO Weekly',
    '',
    `**Stan na:** ${new Date().toISOString()}`,
  ].join('\n');

  const tasksSection = [
    '## Zadania — on-time / late',
    '',
    `- Zamknięte w terminie: ${taskStats.doneOnTime}/${taskStats.doneCount}` +
      (onTimePct !== null ? ` (${onTimePct}%)` : ''),
    `- Otwarte po terminie: ${taskStats.openLate}/${taskStats.openTotal}`,
  ].join('\n');

  const capacitySection = [
    '## Obciążenia (workload)',
    '',
    `- Wykorzystanie średnie: ${capacity.summary.avgUtilization}%`,
    `- Pojemność łączna: ${capacity.summary.totalCapacity}h, przydzielone: ${capacity.summary.totalAllocated}h, backlog: ${capacity.summary.totalBacklog}h`,
    '',
    overloads.length
      ? ['### Przeciążeni (overload)', ...overloads.slice(0, 10).map((o) => `- **${o.severity.toUpperCase()}** — ${o.name}: +${o.overloadHours}h ponad pojemność`)].join('\n')
      : '_Brak przeciążonych osób w bieżącym tygodniu._',
  ].join('\n');

  const cycleTimeSection = [
    '## Cycle-time (per status)',
    '',
    cycleTime.length
      ? ['| Status | Śr. dni | Liczba przejść |', '|---|---|---|']
          .concat(cycleTime.map((c) => `| ${c.status} | ${c.avgDays} | ${c.count} |`))
          .join('\n')
      : '_Brak historii statusów (initiative_status_history) do policzenia cycle-time._',
  ].join('\n');

  return {
    header,
    tasks_on_time_late: tasksSection,
    capacity_workload: capacitySection,
    cycle_time: cycleTimeSection,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   WPIĘCIE W F5 — publish (createReport + updateSectionContent), wzorzec
   `threeAxisReportService.publishThreeAxisSnapshot` (bez Evidence Envelope —
   te 3 pakiety to kompozyty nad już-ugruntowanymi read-modelami, nie nowa
   matematyka; envelope zostaje w gestii `threeAxisReportService`/`financeReportSectionService`
   dla ich własnych źródeł).
   ──────────────────────────────────────────────────────────────────────────── */

export type PmReportKind = 'sponsor-onepager' | 'steering' | 'pmo-weekly';

const TEMPLATE_ID_BY_KIND: Record<PmReportKind, string> = {
  'sponsor-onepager': 'tpl-pm-sponsor-onepager',
  steering: 'tpl-pm-steering',
  'pmo-weekly': 'tpl-pm-weekly',
};

const REPORT_TYPE_BY_KIND: Record<PmReportKind, string> = {
  'sponsor-onepager': 'SPONSOR_ONEPAGER',
  steering: 'STEERING',
  'pmo-weekly': 'PMO_WEEKLY',
};

const TITLE_BY_KIND: Record<PmReportKind, string> = {
  'sponsor-onepager': 'Sponsor One-Pager',
  steering: 'Raport Steering',
  'pmo-weekly': 'PMO Weekly',
};

export interface PublishPmReportParams extends PmReportScope {
  createdBy: string;
  title?: string;
}

export interface PublishPmReportResult {
  reportId: string;
  sections: Record<string, string>;
}

/** Build + render markdown sections for a given pack kind, without publishing. */
export async function buildPmReportSections(
  kind: PmReportKind,
  scope: PmReportScope
): Promise<Record<string, string>> {
  if (kind === 'sponsor-onepager') {
    return renderSponsorOnePagerMarkdown(await buildSponsorOnePager(scope));
  }
  if (kind === 'steering') {
    return renderSteeringMarkdown(await buildSteering(scope));
  }
  return renderPmoWeeklyMarkdown(await buildPmoWeekly(scope));
}

/**
 * TRYB "publikować" — tworzy realny raport-artefakt (kanon F5, `report_builder_reports`)
 * przez zaseedowany szablon (migracja 924) i wypełnia sekcje policzonymi (nie AI-zmyślonymi)
 * markdownami — dokładnie ten sam kontrakt co `publishThreeAxisSnapshot`.
 */
export async function publishPmReport(
  kind: PmReportKind,
  params: PublishPmReportParams
): Promise<PublishPmReportResult> {
  const scopeLabel = params.projectId
    ? `projekt ${params.projectId}`
    : params.programId
      ? `program ${params.programId}`
      : 'organizacja';
  const title = params.title || `${TITLE_BY_KIND[kind]} — ${scopeLabel} (${new Date().toISOString().slice(0, 10)})`;

  const sections = await buildPmReportSections(kind, params);

  const rb = await ReportBuilderService.createReport({
    organizationId: params.organizationId,
    sourceType: 'PROGRAM_MANAGEMENT',
    sourceId: params.projectId || params.programId || params.organizationId,
    sourceName: title,
    title,
    description: `${TITLE_BY_KIND[kind]} — wygenerowany z programManagementReportsService, zakres: ${scopeLabel}.`,
    createdBy: params.createdBy,
    templateId: TEMPLATE_ID_BY_KIND[kind],
    config: {
      scope: { projectId: params.projectId ?? null, programId: params.programId ?? null },
      generatedBy: 'programManagementReportsService',
      reportTypeV3Hint: REPORT_TYPE_BY_KIND[kind],
    },
  });

  for (const [sectionKey, content] of Object.entries(sections)) {
    try {
      await ReportBuilderService.updateSectionContent(rb.report.id, sectionKey, content, params.createdBy);
    } catch (err) {
      logger.warn(
        `[programManagementReportsService] updateSectionContent(${sectionKey}) failed (non-fatal): ${(err as Error)?.message || err}`
      );
    }
  }

  return { reportId: rb.report.id, sections };
}

export default {
  fetchValueAxisSplit,
  buildSponsorOnePager,
  renderSponsorOnePagerMarkdown,
  buildSteering,
  renderSteeringMarkdown,
  buildPmoWeekly,
  renderPmoWeeklyMarkdown,
  buildPmReportSections,
  publishPmReport,
};
