import { ClipboardCheck } from 'lucide-react';
import React from 'react';

import { FilterableTable } from '../shared/ModuleHub/FilterableTable';
import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import type { TableColumn } from '../shared/ModuleHub/FilterableTable';

const gateRows = [
  ['Wave 0', 'Runtime truth, owners, flags, test data', 'PASS', 'AI OS gate report in hub'],
  ['Wave 1', 'Unified chat, citations, TrustBundleV1', 'PASS', 'chat/trust tests'],
  ['Wave 2', 'Anna/Teresa and voice boundaries', 'PASS', 'server config and no-dead-button tests'],
  ['Wave 3', 'AI Actions, AIRun and audit', 'PASS', 'run ledger tests and endpoint smoke'],
  ['Wave 4', 'ResearchSession runtime', 'PASS', 'research lifecycle tests'],
  ['Wave 5', 'Artifact runtime', 'PASS', 'mutation/version/provenance tests'],
  ['Wave 6', 'Context and controlled learning', 'PASS', 'formal migration and stewardship tests'],
  ['Wave 7', 'Connectors and governed tools', 'PASS', 'ACL/freshness/health/runtime binding tests'],
  ['Wave 8', 'Agent catalog and schedules', 'PASS', 'DB-backed definitions and scoped tools'],
  ['Wave 9', 'Outcomes, KPI/ROI and AI Ops', 'PASS', 'acceptance runtime tests'],
];

const gateColumns: TableColumn[] = [
  {
    id: 'wave',
    label: 'Wave',
    width: '120px',
    render: (row) => (
      <span className="font-medium text-slate-900 dark:text-white">{row.wave}</span>
    ),
  },
  {
    id: 'scope',
    label: 'Scope',
    width: '320px',
    render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.scope}</span>,
  },
  {
    id: 'gate',
    label: 'Gate',
    width: '100px',
    render: (row) => (
      <span className="font-semibold text-slate-500 dark:text-slate-400">{row.gate}</span>
    ),
  },
  {
    id: 'evidence',
    label: 'Evidence',
    width: '320px',
    render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.evidence}</span>,
  },
];

export const AIOSWave0GateReport: React.FC = () => {
  const [gateFilters, setGateFilters] = React.useState<FilterChip[]>([]);

  const gateData = React.useMemo(
    () =>
      gateRows.map(([wave, scope, gate, evidence]) => ({
        id: wave,
        wave,
        scope,
        gate,
        evidence,
      })),
    []
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-c-border-subtle dark:bg-navy-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
            <ClipboardCheck size={14} />
            AI OS Build Milestones
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">
            Build milestones (static reference)
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Documentation of the AI OS build waves and their acceptance owners —{' '}
            <strong>not</strong> a live health check. Each row records what was delivered and how it
            was accepted; the gate values are fixed reference, not a real-time runtime probe.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
          static
        </span>
      </div>
      <div className="mt-4">
        <FilterableTable
          columns={gateColumns}
          data={gateData}
          hideRowActions
          enableColumnSettings={false}
          density="compact"
          activeFilters={gateFilters}
          onFilterChange={setGateFilters}
          emptyMessage="No build milestones to display."
          canvasClassName=""
        />
      </div>
    </section>
  );
};

export default AIOSWave0GateReport;
