import { useCallback, useEffect, useMemo, useState } from 'react';

import { getMyGateSignoffs } from '@/services/initiatives-execution/runtimeApi';

export type GovernanceGate =
  | 'DEFINITION'
  | 'ANALYSIS'
  | 'PORTFOLIO'
  | 'SCHEDULE'
  | 'HANDOFF'
  | 'CLOSURE';
export type GovernanceProfile = 'BASELINE_SMALL' | 'STANDARD' | 'COMPLEX';

export interface GateSignoffProjection {
  gate: GovernanceGate;
  decisionId: string;
  decisionVersion: number;
  initiativeId: string;
  projectId: string;
  requesterId: string;
  authorityId: string;
  requestedAt: string;
  dueAt: string | null;
  sla: { hours: number; dueAt: string | null; state: 'OPEN' | 'OVERDUE' | 'COMPLETED' };
  effectivePolicy: {
    policyId: string;
    policyVersion: number;
    profile: GovernanceProfile;
    source: string;
    policyEnforced: boolean;
    rule: { quorum: number; requiredRoles: string[]; separation: boolean; slaHours: number };
  };
  actorBindings: Array<{
    roleKey: string;
    mode: 'DIRECT' | 'DELEGATED';
    delegatedFrom: string | null;
    delegationProof: { delegatedFrom: string; delegationRef: string; version: number } | null;
    eligible: boolean;
  }>;
  actorEligible: boolean;
  actorCanDecide?: boolean;
  quorum: {
    quorumId: string;
    version: number;
    status: 'COLLECTING' | 'SATISFIED' | 'REJECTED';
    signoffs: Array<{ roleKey: string; outcome: 'APPROVE' | 'REJECT' | 'ABSTAIN' }>;
    receiptId: string | null;
    updatedAt: string | null;
  };
}

export function normalizeGateSignoffs(body: unknown): GateSignoffProjection[] {
  if (Array.isArray(body)) return body as GateSignoffProjection[];
  if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items))
    return (body as { items: GateSignoffProjection[] }).items;
  return [];
}

export function useGateSignoffGuard(gate: GovernanceGate, decisionId: string | null) {
  const [items, setItems] = useState<GateSignoffProjection[]>([]);
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const load = useCallback(async () => {
    setState('LOADING');
    try {
      setItems(normalizeGateSignoffs(await getMyGateSignoffs()));
      setState('READY');
    } catch {
      setItems([]);
      setState('ERROR');
    }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('canonical-gate-signoff-updated', refresh);
    return () => window.removeEventListener('canonical-gate-signoff-updated', refresh);
  }, [load]);
  const projection = useMemo(
    () => items.find((item) => item.gate === gate && item.decisionId === decisionId) ?? null,
    [decisionId, gate, items]
  );
  const quorumRef =
    projection?.quorum.status === 'SATISFIED' && projection.quorum.receiptId
      ? {
          quorumId: projection.quorum.quorumId,
          version: projection.quorum.version,
          receiptId: projection.quorum.receiptId,
        }
      : null;
  return { state, projection, quorumRef, ready: Boolean(quorumRef), reload: load };
}
