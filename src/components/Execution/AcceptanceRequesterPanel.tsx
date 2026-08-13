import React, { useRef, useState } from 'react';

import {
  requestDeliveryAcceptance,
  requestResultsAcceptance,
  RuntimeApiError,
} from '@/services/initiatives-execution/runtimeApi';

type Props = { executionCaseId: string; executionCaseVersion: number; initiativeId: string };

const parse = (value: string) => JSON.parse(value) as Record<string, unknown>;
const exactRefs = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as { ref?: unknown }).ref === 'string' &&
      Number.isInteger((item as { version?: unknown }).version)
  );

export const AcceptanceRequesterPanel = ({
  executionCaseId,
  executionCaseVersion,
  initiativeId,
}: Props) => {
  const [mode, setMode] = useState<'DELIVERY' | 'RESULTS'>('DELIVERY');
  const [id, setId] = useState('');
  const [payload, setPayload] = useState('{}');
  const [state, setState] = useState<'IDLE' | 'SAVING' | 'ERROR' | 'CONFLICT'>('IDLE');
  const [receipt, setReceipt] = useState<string | null>(null);
  const commandIds = useRef(new Map<string, string>());
  const submit = async () => {
    if (!id.trim()) return;
    try {
      const body = parse(payload);
      const clientRequestId = commandIds.current.get(`${mode}:${id}`) ?? crypto.randomUUID();
      commandIds.current.set(`${mode}:${id}`, clientRequestId);
      setState('SAVING');
      if (mode === 'DELIVERY') {
        const requiredRefs = ['baselineRef', 'scopeRef', 'operationalHandoverRef'] as const;
        const requiredLists = [
          'deliverableRefs',
          'milestoneRefs',
          'financeActualRefs',
          'kpiMeasurementContractRefs',
        ] as const;
        if (
          body.initiativeId !== initiativeId ||
          body.executionCaseId !== executionCaseId ||
          body.executionCaseVersion !== executionCaseVersion ||
          requiredRefs.some((key) => !exactRefs([body[key]])) ||
          requiredLists.some((key) => !exactRefs(body[key]) || !(body[key] as unknown[]).length) ||
          !body.authorityId ||
          !body.ownerId ||
          !body.benefitOwnerId
        )
          throw new Error('EVIDENCE_MISSING');
        await requestDeliveryAcceptance(id.trim(), { ...body, clientRequestId });
      } else {
        if (
          body.initiativeId !== initiativeId ||
          typeof body.packId !== 'string' ||
          !Number.isInteger(body.packVersion) ||
          !body.authorityId ||
          !body.ownerId
        )
          throw new Error('EVIDENCE_MISSING');
        await requestResultsAcceptance(id.trim(), { ...body, clientRequestId });
      }
      setReceipt(`${mode}_ACCEPTANCE_REQUESTED · ${id.trim()}`);
      setState('IDLE');
    } catch (error) {
      setState(error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'ERROR');
    }
  };
  return (
    <section aria-label="Acceptance requester" className="mt-4 rounded border border-c-border p-4">
      <h3 className="font-semibold">Request independent acceptance</h3>
      <p className="text-xs text-c-text-muted">
        Exact versions and evidence are mandatory. Missing or stale evidence fails closed.
      </p>
      <div className="mt-3 flex gap-2">
        {(['DELIVERY', 'RESULTS'] as const).map((value) => (
          <button
            key={value}
            className={mode === value ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setMode(value)}
          >
            {value === 'DELIVERY' ? 'Delivery request' : 'Results request'}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-sm">
        Canonical {mode === 'DELIVERY' ? 'decision' : 'Results Case'} ID
        <input className="input mt-1 w-full" value={id} onChange={(e) => setId(e.target.value)} />
      </label>
      <label className="mt-3 block text-sm">
        Exact request contract (JSON)
        <textarea
          className="input mt-1 min-h-40 w-full font-mono text-xs"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
        />
      </label>
      <button
        className="btn-primary mt-3"
        disabled={state === 'SAVING'}
        onClick={() => void submit()}
      >
        Request {mode === 'DELIVERY' ? 'Delivery Acceptance' : 'Results Acceptance'}
      </button>
      {(state === 'ERROR' || state === 'CONFLICT') && (
        <p role="alert" className="mt-2 text-c-danger">
          {state === 'CONFLICT'
            ? 'Version conflict. Reload exact truth.'
            : 'EVIDENCE_MISSING or invalid request.'}
        </p>
      )}
      {receipt && (
        <p role="status" className="mt-2 text-c-success">
          {receipt}
        </p>
      )}
    </section>
  );
};
