import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  listMyAIAnalysisReviews,
  reviewAIAnalysisProposal,
  RuntimeApiError,
} from '@/services/initiatives-execution/runtimeApi';
type P = {
  version: number;
  proposalId: string;
  initiativeId: string;
  initiativeVersion: number;
  cardKey: string;
  cardVersion: number;
  sourceRef: { aggregateType: string; aggregateId: string; version: number };
  model: { provider: string; model: string; version: string };
  prompt: { promptId: string; version: number };
  template: { templateId: string; version: number };
  inputHash: string;
  output: Record<string, unknown>;
  evidenceRefs: Array<{ ref: string; version: number }>;
  counterEvidenceRefs: Array<{ ref: string; version: number }>;
  confidence: string;
  requestedBy: string;
  authorizedReviewerId: string;
  status: 'PENDING_REVIEW';
};
interface Row extends TableRow {
  id: string;
  title: string;
  target: string;
  source: string;
  confidence: string;
  requester: string;
  sourceValue: P;
}
const columns: TableColumn[] = [
  { id: 'target', label: 'Card target', sortable: true },
  { id: 'source', label: 'Exact source', sortable: true },
  { id: 'confidence', label: 'Confidence', sortable: true },
  { id: 'requester', label: 'Requested by', sortable: true },
];
export const AIAnalysisProposalReviewQueue = () => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING'),
    [items, setItems] = useState<P[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [rationale, setRationale] = useState(''),
    [edited, setEdited] = useState(''),
    [write, setWrite] = useState<'IDLE' | 'CONFLICT' | 'FAILED'>('IDLE'),
    [receipt, setReceipt] = useState<Record<string, unknown> | null>(null),
    ids = useRef(new Map<string, string>());
  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const r = (await listMyAIAnalysisReviews()) as { items?: P[] };
      setItems(r.items ?? []);
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const rows = useMemo<Row[]>(
      () =>
        items.map((p) => ({
          id: p.proposalId,
          title: `AI Analysis ${p.cardKey}`,
          target: `${p.initiativeId}:${p.cardKey} v${p.cardVersion}`,
          source: `${p.sourceRef.aggregateType}:${p.sourceRef.aggregateId} v${p.sourceRef.version}`,
          confidence: p.confidence,
          requester: p.requestedBy,
          sourceValue: p,
        })),
      [items]
    ),
    selected = rows.find((r) => r.id === selectedId) ?? null;
  const review = async (outcome: 'ACCEPT' | 'EDIT' | 'REJECT') => {
    if (!selected || !rationale.trim()) return;
    try {
      const key = `${selected.id}:${selected.sourceValue.version}:${outcome}`,
        clientRequestId = ids.current.get(key) ?? crypto.randomUUID();
      ids.current.set(key, clientRequestId);
      const fragment = outcome === 'EDIT' ? (JSON.parse(edited) as Record<string, unknown>) : null;
      await reviewAIAnalysisProposal(selected.id, {
        expectedVersion: selected.sourceValue.version,
        clientRequestId,
        outcome,
        rationale: rationale.trim(),
        editedFragment: fragment,
      });
      setReceipt({
        proposalId: selected.id,
        outcome,
        publishedCardVersion: outcome === 'REJECT' ? null : selected.sourceValue.cardVersion + 1,
        oldCardVersion: selected.sourceValue.cardVersion,
      });
      await load();
      setWrite('IDLE');
    } catch (e) {
      setWrite(e instanceof RuntimeApiError && e.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };
  if (state === 'LOADING')
    return (
      <section aria-label="AI Analysis reviews" role="status" className="p-4">
        Loading AI analysis reviews
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label="AI Analysis reviews" role="alert" className="p-4">
        AI review queue unavailable.
      </section>
    );
  if (!rows.length && !receipt) return null;
  return (
    <section aria-label="AI Analysis reviews" className="border-b border-c-border p-4">
      <h3 className="font-semibold">AI Analysis proposals</h3>
      <p className="text-xs text-c-text-muted">
        AI output is a proposal until an independent human review publishes exact truth.
      </p>
      {receipt && (
        <p role="status" className="my-2 rounded border border-c-success/40 p-3">
          Proposal {String(receipt.proposalId)} · {String(receipt.outcome)} ·{' '}
          {receipt.publishedCardVersion
            ? `Card v${String(receipt.publishedCardVersion)}; v${String(receipt.oldCardVersion)} retained with AI lineage`
            : 'no truth change'}
        </p>
      )}
      {write !== 'IDLE' && (
        <p role="alert" className="text-c-danger">
          {write === 'CONFLICT'
            ? 'Card or source is stale. Review blocked.'
            : 'Review was not saved.'}
        </p>
      )}
      {rows.length > 0 && (
        <TableWithPreviewLayout<Row>
          selectedId={selectedId}
          selectedItem={selected}
          onSelect={setSelectedId}
          onOpenFull={setSelectedId}
          itemIds={rows.map((r) => r.id)}
          getItemById={(id) => rows.find((r) => r.id === id) ?? null}
          renderPreview={(r) => (
            <div className="space-y-3 p-4 text-sm" aria-label="AI Analysis Review Workbench">
              <p>Proposal {r.id}</p>
              <p>
                {r.target} · Initiative v{r.sourceValue.initiativeVersion}
              </p>
              <p>{r.source}</p>
              <p>
                Model {r.sourceValue.model.provider}/{r.sourceValue.model.model} v
                {r.sourceValue.model.version}
              </p>
              <p>
                Prompt {r.sourceValue.prompt.promptId} v{r.sourceValue.prompt.version} · template{' '}
                {r.sourceValue.template.templateId} v{r.sourceValue.template.version}
              </p>
              <p>
                Input hash <code>{r.sourceValue.inputHash}</code> · confidence{' '}
                {r.sourceValue.confidence}
              </p>
              <p>
                Evidence{' '}
                {r.sourceValue.evidenceRefs.map((x) => `${x.ref} v${x.version}`).join(', ')}
              </p>
              <p>
                Counter-evidence{' '}
                {r.sourceValue.counterEvidenceRefs
                  .map((x) => `${x.ref} v${x.version}`)
                  .join(', ') || 'None declared'}
              </p>
              <pre className="overflow-auto rounded border border-c-border p-2">
                {JSON.stringify(r.sourceValue.output, null, 2)}
              </pre>
              <label className="block">
                Human rationale
                <textarea
                  aria-label="AI review rationale"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  className="block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
              <label className="block">
                Exact edited human fragment (JSON)
                <textarea
                  aria-label="AI edited fragment"
                  value={edited}
                  onChange={(e) => setEdited(e.target.value)}
                  className="block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
            </div>
          )}
          renderPreviewFooter={() => (
            <div className="flex gap-2 p-3">
              <button className="btn-secondary" onClick={() => void review('REJECT')}>
                Reject
              </button>
              <button className="btn-secondary" onClick={() => void review('EDIT')}>
                Publish human edit
              </button>
              <button className="btn-primary" onClick={() => void review('ACCEPT')}>
                Accept proposal
              </button>
            </div>
          )}
        >
          <StandardTable
            columns={columns}
            data={rows}
            selectedRowId={selectedId}
            onRowClick={(r) => setSelectedId(r.id)}
            persistKey="my-work.ai-analysis-review.v1"
          />
        </TableWithPreviewLayout>
      )}
    </section>
  );
};
