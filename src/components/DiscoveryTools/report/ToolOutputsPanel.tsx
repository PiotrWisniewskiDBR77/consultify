/**
 * ToolOutputsPanel — READ / LIST / REOPEN surface for the canonical
 * `tool_outputs` snapshot (server/src/routes/toolOutputs.routes.ts).
 *
 * Closes the UI half of the L8 gap: `promoteToOutput` writes an immutable
 * `tool_outputs` row (server/src/services/tools/toolOutputSnapshotService.ts)
 * and its derived Reports/Presentations, but until this component nothing
 * listed or reopened them. This panel:
 *   - lists Outputs for a session — CURRENT (status="approved") and
 *     SUPERSEDED revisions both shown, oldest→newest via version;
 *   - lists the Reports/Presentations traced to a selected Output
 *     (`tool_report_sources` lineage) and renders one with the EXISTING
 *     `ToolReportView` — no new renderer, no screenshot, the same
 *     deterministic document the approved Output produces;
 *   - lists Initiative Proposals traced to a selected Output's conclusions;
 *   - reopens an approved Output into a new draft revision (correction flow,
 *     `POST /api/tool-outputs/:id/reopen` → `correctToolOutput`).
 *
 * KANON: `c-*` tokens only, same vocabulary as `ToolReportView.tsx`
 * (c-text/c-text-secondary/c-text-muted/c-surface-raised/c-border-subtle).
 * Crimson is never used as a data/status colour — status comes from
 * `EntityStatusChip` (tone by semantic status, not a literal colour here).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import ToolReportView from '@/components/DiscoveryTools/report/ToolReportView';
import { EntityStatusChip } from '@/components/ui/primitives/chips/EntityStatusChip';
import { Api } from '@/services/api';
import type { ToolReportDocument } from '@/toolOutputs/types';

interface OutputSummary {
  id: string;
  toolSessionId: string;
  toolType: string;
  version: number;
  supersedesId: string | null;
  title: string;
  status: string;
  contentHash: string;
  createdAt: string;
  approvedAt: string | null;
  isCurrent: boolean;
}

interface ReportSummary {
  id: string;
  kind: 'report' | 'presentation';
  title: string;
  status: string;
  createdAt: string;
}

interface ProposalSummary {
  id: string;
  proposedTitle: string;
  status: string;
  initiativeId: string | null;
  sourceConclusionId: string;
}

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export interface ToolOutputsPanelProps {
  toolSessionId: string;
  /** Called after a successful reopen — parent can refresh session status, etc. */
  onReopened?: (revisionId: string) => void;
}

export const ToolOutputsPanel: React.FC<ToolOutputsPanelProps> = ({ toolSessionId, onReopened }) => {
  const { t } = useTranslation();

  const [outputs, setOutputs] = useState<OutputSummary[]>([]);
  const [outputsLoading, setOutputsLoading] = useState(false);
  const [outputsError, setOutputsError] = useState<string | null>(null);

  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [childLoading, setChildLoading] = useState(false);

  const [viewingDoc, setViewingDoc] = useState<ToolReportDocument | null>(null);
  const [docLoading, setDocLoading] = useState(false);

  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);

  const loadOutputs = useCallback(async () => {
    setOutputsLoading(true);
    setOutputsError(null);
    try {
      const res = await Api.listToolOutputs(toolSessionId);
      const list = (res.outputs || []) as OutputSummary[];
      setOutputs(list);
      // Keep the current selection if it still exists; otherwise default to
      // the current (non-superseded) revision, falling back to the newest.
      setSelectedOutputId((prev) => {
        if (prev && list.some((o) => o.id === prev)) return prev;
        return list.find((o) => o.isCurrent)?.id ?? list[0]?.id ?? null;
      });
    } catch (e: any) {
      setOutputsError(e?.message || t('toolOutputs.loadFailed', 'Failed to load outputs'));
    } finally {
      setOutputsLoading(false);
    }
  }, [toolSessionId, t]);

  useEffect(() => {
    void loadOutputs();
  }, [loadOutputs]);

  useEffect(() => {
    if (!selectedOutputId) {
      setReports([]);
      setProposals([]);
      return;
    }
    let cancelled = false;
    setChildLoading(true);
    Promise.all([
      Api.listToolOutputReports(selectedOutputId),
      Api.listToolOutputInitiativeProposals(selectedOutputId),
    ])
      .then(([reportsRes, proposalsRes]) => {
        if (cancelled) return;
        setReports((reportsRes.reports || []) as ReportSummary[]);
        setProposals((proposalsRes.proposals || []) as ProposalSummary[]);
      })
      .catch(() => {
        if (cancelled) return;
        setReports([]);
        setProposals([]);
      })
      .finally(() => {
        if (!cancelled) setChildLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOutputId]);

  const openReport = useCallback(async (reportId: string) => {
    setDocLoading(true);
    try {
      const res = await Api.getToolOutputReport(reportId);
      setViewingDoc((res.report?.doc ?? null) as ToolReportDocument | null);
    } finally {
      setDocLoading(false);
    }
  }, []);

  const selectedOutput = outputs.find((o) => o.id === selectedOutputId) ?? null;
  const canReopen = selectedOutput?.status === 'approved';

  const handleReopen = useCallback(async () => {
    if (!selectedOutputId) return;
    setReopening(true);
    setReopenError(null);
    try {
      const res = await Api.reopenToolOutput(selectedOutputId);
      await loadOutputs();
      setSelectedOutputId(res.revision.id);
      onReopened?.(res.revision.id);
    } catch (e: any) {
      setReopenError(e?.message || t('toolOutputs.reopenFailed', 'Failed to reopen output'));
    } finally {
      setReopening(false);
    }
  }, [selectedOutputId, loadOutputs, onReopened, t]);

  if (viewingDoc) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setViewingDoc(null)}
          className="text-xs font-medium text-c-text-secondary hover:text-c-text"
        >
          ← {t('toolOutputs.backToOutputs', 'Back to outputs')}
        </button>
        <div className="rounded-xl border border-c-border-subtle bg-c-surface">
          <ToolReportView doc={viewingDoc} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="tool-outputs-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-c-text">
          {t('toolOutputs.title', 'Outputs')}
        </h3>
        {outputsLoading && (
          <span className="text-[11px] text-c-text-muted">{t('common.loading', 'Loading…')}</span>
        )}
      </div>

      {outputsError && <p className="text-sm text-c-danger">{outputsError}</p>}

      {!outputsLoading && outputs.length === 0 && !outputsError && (
        <p className="text-sm text-c-text-muted">
          {t('toolOutputs.empty', 'No promoted output yet for this session.')}
        </p>
      )}

      <ul className="divide-y divide-c-border-subtle overflow-hidden rounded-xl border border-c-border-subtle">
        {outputs.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => setSelectedOutputId(o.id)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                o.id === selectedOutputId ? 'bg-c-surface-raised' : 'hover:bg-c-surface-raised/60'
              }`}
              data-testid="tool-output-row"
              data-output-id={o.id}
            >
              <span className="w-10 shrink-0 text-xs tabular-nums text-c-text-muted">v{o.version}</span>
              <span className="flex-1 truncate text-sm text-c-text">{o.title}</span>
              <EntityStatusChip status={o.isCurrent ? o.status : 'superseded'} />
              <span className="w-24 shrink-0 text-right text-[11px] text-c-text-muted">
                {formatDate(o.approvedAt || o.createdAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selectedOutput && (
        <div className="space-y-4 rounded-xl border border-c-border-subtle bg-c-surface-raised p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
                {t('toolOutputs.selected', 'Selected output')} · v{selectedOutput.version}
              </div>
              <div className="mt-1 text-sm font-medium text-c-text">{selectedOutput.title}</div>
              <div className="mt-0.5 font-mono text-[10px] text-c-text-muted">
                {selectedOutput.contentHash.slice(0, 16)}…
              </div>
            </div>
            {canReopen && (
              <button
                type="button"
                onClick={() => void handleReopen()}
                disabled={reopening}
                className="rounded-lg border border-c-border-strong px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface disabled:opacity-50"
                data-testid="tool-output-reopen"
              >
                {reopening
                  ? t('toolOutputs.reopening', 'Reopening…')
                  : t('toolOutputs.reopen', 'Reopen for correction')}
              </button>
            )}
          </div>
          {reopenError && <p className="text-xs text-c-danger">{reopenError}</p>}

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
              {t('toolOutputs.reports', 'Reports & presentations')}
            </div>
            {childLoading && (
              <p className="mt-1 text-xs text-c-text-muted">{t('common.loading', 'Loading…')}</p>
            )}
            {!childLoading && reports.length === 0 && (
              <p className="mt-1 text-xs text-c-text-muted">
                {t('toolOutputs.noReports', 'No report or presentation generated from this output yet.')}
              </p>
            )}
            <ul className="mt-1.5 space-y-1">
              {reports.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => void openReport(r.id)}
                    disabled={docLoading}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-c-text hover:bg-c-surface"
                    data-testid="tool-output-report-row"
                  >
                    <span className="flex-1 truncate">{r.title}</span>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-c-text-muted">
                      {r.kind === 'presentation'
                        ? t('toolOutputs.kindPresentation', 'Presentation')
                        : t('toolOutputs.kindReport', 'Report')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
              {t('toolOutputs.initiativeProposals', 'Initiative proposals')}
            </div>
            {!childLoading && proposals.length === 0 && (
              <p className="mt-1 text-xs text-c-text-muted">
                {t('toolOutputs.noProposals', 'No initiative was proposed from this output yet.')}
              </p>
            )}
            <ul className="mt-1.5 space-y-1">
              {proposals.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-c-text"
                  data-testid="tool-output-proposal-row"
                >
                  <span className="flex-1 truncate">{p.proposedTitle}</span>
                  <EntityStatusChip status={p.status} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolOutputsPanel;
