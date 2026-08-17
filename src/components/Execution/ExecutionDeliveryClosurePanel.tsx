import { CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ExecutionBvpApi,
  type ExecutionDeliverySnapshot,
} from '@/services/api/v8/executionBvp';

type Props = {
  initialLinkId?: string | null;
  onLinkIdChange?: (linkId: string) => void;
};

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected execution delivery error';

export const ExecutionDeliveryClosurePanel = ({ initialLinkId, onLinkIdChange }: Props) => {
  const { t } = useTranslation();
  const [initiativeId, setInitiativeId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [linkId, setLinkId] = useState(initialLinkId ?? '');
  const [snapshot, setSnapshot] = useState<ExecutionDeliverySnapshot | null>(null);
  const [artifactLinkId, setArtifactLinkId] = useState('');
  const [contentDigest, setContentDigest] = useState('');
  const [refs, setRefs] = useState({ workRef: '', resourceRef: '', controlRef: '', reportRef: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeKey = useRef<string | null>(null);

  const load = useCallback(async (id = linkId) => {
    if (!id.trim()) return;
    setBusy('read');
    setError(null);
    try {
      const value = await ExecutionBvpApi.read(id.trim());
      setSnapshot(value);
      setLinkId(value.link.link_id);
      setRefs({
        workRef: value.link.work_ref ?? '',
        resourceRef: value.link.resource_ref ?? '',
        controlRef: value.link.control_ref ?? '',
        reportRef: value.link.report_ref ?? '',
      });
    } catch (e) {
      setSnapshot(null);
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  }, [linkId]);

  useEffect(() => {
    if (initialLinkId) void load(initialLinkId);
    // Load once for a deep link; explicit Retry owns subsequent reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLinkId]);

  const evidence = useMemo(() => snapshot?.evidence.at(-1) ?? null, [snapshot]);
  const act = async (name: string, operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(name);
    setError(null);
    try {
      await operation();
      if (linkId) await load(linkId);
    } catch (e) {
      setError(messageOf(e));
      setBusy(null);
    }
  };

  const createLink = () => act('link', async () => {
    const link = await ExecutionBvpApi.link(initiativeId.trim(), caseId.trim());
    setLinkId(link.link_id);
    setSnapshot({ link, evidence: [], resultsReceipt: null });
    onLinkIdChange?.(link.link_id);
    setBusy(null);
  });

  const close = () => act('close', async () => {
    if (!snapshot || !evidence) return;
    closeKey.current ??= crypto.randomUUID();
    await ExecutionBvpApi.close(
      snapshot.link.link_id,
      evidence.evidence_id,
      snapshot.link.version,
      closeKey.current
    );
  });

  return (
    <section aria-labelledby="execution-delivery-title" className="mb-4 rounded-xl border border-c-border bg-c-surface p-4" data-testid="execution-delivery-closure">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="execution-delivery-title" className="text-sm font-semibold text-c-text">
            {t('execution.delivery.title', 'Delivery closure and Results receipt')}
          </h2>
          <p className="mt-1 text-xs text-c-text-muted">
            {t('execution.delivery.description', 'Complete the governed spine, submit evidence, obtain an independent approval, and close into Results.')}
          </p>
        </div>
        {snapshot ? <button type="button" disabled={Boolean(busy)} onClick={() => void load()} aria-label={t('common.refresh', 'Refresh')} className="rounded-md p-2 text-c-text-muted hover:bg-c-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus"><RefreshCw size={16} /></button> : null}
      </div>

      {error ? <div role="alert" aria-live="assertive" className="mt-3 rounded-md border border-c-danger/40 bg-c-danger/10 p-3 text-sm text-c-danger">{error}<button type="button" className="ml-3 underline" onClick={() => void load()}>{t('common.retry', 'Retry')}</button></div> : null}
      {busy ? <div role="status" className="mt-3 flex items-center gap-2 text-sm text-c-text-muted"><Loader2 className="animate-spin" size={16} />{t('common.saving', 'Saving…')}</div> : null}

      {!snapshot ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-c-text-muted">{t('execution.delivery.initiativeId', 'Initiative ID')}<input value={initiativeId} onChange={(e) => setInitiativeId(e.target.value)} className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text" /></label>
          <label className="text-xs text-c-text-muted">{t('execution.delivery.caseId', 'Execution case ID')}<input value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text" /></label>
          <button type="button" disabled={Boolean(busy) || !initiativeId.trim() || !caseId.trim()} onClick={() => void createLink()} className="self-end rounded-md bg-c-text px-4 py-2 text-sm font-semibold text-c-surface disabled:opacity-50">{t('execution.delivery.start', 'Start governed closure')}</button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-c-surface-raised px-2 py-1">Link {snapshot.link.link_id}</span><span className="rounded-full bg-c-surface-raised px-2 py-1">v{snapshot.link.version}</span><span className="rounded-full bg-c-surface-raised px-2 py-1">{snapshot.link.status}</span></div>
          <div className="grid gap-3 md:grid-cols-2">
            {(['workRef', 'resourceRef', 'controlRef', 'reportRef'] as const).map((field) => <label key={field} className="text-xs text-c-text-muted">{field}<input value={refs[field]} onChange={(e) => setRefs((v) => ({ ...v, [field]: e.target.value }))} disabled={snapshot.link.status === 'CLOSED'} className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text disabled:opacity-60" /></label>)}
          </div>
          {snapshot.link.status === 'ACTIVE' && !snapshot.link.report_ref ? <button type="button" disabled={Boolean(busy) || Object.values(refs).some((v) => !v.trim())} onClick={() => void act('spine', () => ExecutionBvpApi.recordSpine(snapshot.link.link_id, { ...refs, expectedVersion: snapshot.link.version }))} className="rounded-md bg-c-text px-4 py-2 text-sm font-semibold text-c-surface disabled:opacity-50">{t('execution.delivery.saveSpine', 'Save complete delivery spine')}</button> : null}

          {!evidence && snapshot.link.report_ref ? <div className="grid gap-3 md:grid-cols-3"><label className="text-xs text-c-text-muted">{t('execution.delivery.artifactLink', 'Evidence artifact link')}<input value={artifactLinkId} onChange={(e) => setArtifactLinkId(e.target.value)} className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text" /></label><label className="text-xs text-c-text-muted">SHA-256<input value={contentDigest} onChange={(e) => setContentDigest(e.target.value)} className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text" /></label><button type="button" disabled={Boolean(busy) || !artifactLinkId || !contentDigest} onClick={() => void act('submit', () => ExecutionBvpApi.submitEvidence(snapshot.link.link_id, { artifactLinkId, contentDigest }))} className="self-end rounded-md bg-c-text px-4 py-2 text-sm font-semibold text-c-surface disabled:opacity-50">{t('execution.delivery.submitEvidence', 'Submit evidence')}</button></div> : null}

          {evidence ? <div className="rounded-md border border-c-border p-3 text-sm"><div className="flex items-center gap-2"><ShieldCheck size={16} /><strong>{t('execution.delivery.evidence', 'Evidence')}</strong><span>{evidence.approval_status}</span><span>v{evidence.version}</span></div>{evidence.approval_status === 'SUBMITTED' ? <button type="button" disabled={Boolean(busy)} onClick={() => void act('approve', () => ExecutionBvpApi.approveEvidence(evidence.evidence_id, evidence.version))} className="mt-3 rounded-md border border-c-border px-3 py-2 font-medium text-c-text disabled:opacity-50">{t('execution.delivery.approveIndependent', 'Approve as independent reviewer')}</button> : null}</div> : null}
          {evidence?.approval_status === 'APPROVED' && snapshot.link.status === 'ACTIVE' ? <button type="button" disabled={Boolean(busy)} onClick={() => void close()} className="rounded-md bg-c-text px-4 py-2 text-sm font-semibold text-c-surface disabled:opacity-50">{t('execution.delivery.close', 'Close execution and emit Results signal')}</button> : null}
          {snapshot.resultsReceipt ? <div role="status" className="rounded-md border border-c-success/40 bg-c-success/10 p-3 text-sm text-c-text"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="text-c-success" size={18} />{t('execution.delivery.receiptReady', 'Results receipt persisted')}</div><dl className="mt-2 grid gap-1 text-xs"><div><dt className="inline text-c-text-muted">Signal: </dt><dd className="inline">{snapshot.resultsReceipt.signalId}</dd></div><div><dt className="inline text-c-text-muted">Delivery: </dt><dd className="inline">{snapshot.resultsReceipt.deliveryStatus}</dd></div><div><dt className="inline text-c-text-muted">Receipt: </dt><dd className="inline">{snapshot.resultsReceipt.receiptId ?? t('execution.delivery.consumerPending', 'consumer pending')}</dd></div></dl></div> : null}
        </div>
      )}
    </section>
  );
};
