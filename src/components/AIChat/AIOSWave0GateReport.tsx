import { ClipboardCheck } from 'lucide-react';
import React from 'react';

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

export const AIOSWave0GateReport: React.FC = () => {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-navy-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
            <ClipboardCheck size={14} />
            Wave 0 Gate Report
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">
            Runtime truth table
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Formal AI OS gate artifact for owners, feature flags, test data and release decision.
            Product owner: AI OS; backend owner: AI runtime; frontend owner: AI OS panels; QA owner:
            agent/manual acceptance.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
          PASS
        </span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-4">Wave</th>
              <th className="py-2 pr-4">Scope</th>
              <th className="py-2 pr-4">Gate</th>
              <th className="py-2 pr-4">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
            {gateRows.map(([wave, scope, gate, evidence]) => (
              <tr key={wave}>
                <td className="py-2 pr-4 font-medium text-slate-900 dark:text-white">{wave}</td>
                <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{scope}</td>
                <td className="py-2 pr-4 font-semibold text-emerald-600">{gate}</td>
                <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default AIOSWave0GateReport;
