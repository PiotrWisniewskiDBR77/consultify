import React, { useMemo, useRef, useState } from 'react';

import {
  readExecutionCase,
  RuntimeApiError,
  transitionCanonicalDecision,
  transitionCanonicalTask,
} from '@/services/initiatives-execution/runtimeApi';

type TaskAction =
  | 'OFFER_ASSIGNMENT'
  | 'ACCEPT_ASSIGNMENT'
  | 'DECLINE_ASSIGNMENT'
  | 'ESCALATE'
  | 'REOPEN'
  | 'CANCEL';
type DecisionAction = 'ESCALATE' | 'REOPEN' | 'CANCEL';

export interface HardenedWorkItem {
  version: number;
  executionCaseId: string;
  taskId?: string;
  decisionId?: string;
  status: string;
  dueAt: string;
  slaAt?: string;
  ownerId?: string;
  assigneeId?: string;
  authorityId?: string;
  assignment?: {
    status: 'OFFERED' | 'ACCEPTED' | 'DECLINED';
    offeredAt: string;
    respondedAt: string | null;
    reason: string | null;
  };
  escalation?: { level: 'WARNING' | 'CRITICAL'; reason: string; escalatedAt: string; by: string };
  canceledAt?: string;
  cancelReason?: string;
  reopenedAt?: string;
  reopenReason?: string;
}

interface Props {
  item: HardenedWorkItem;
  actorId?: string | null;
  onReadback?: (item: HardenedWorkItem, version: number) => void | Promise<void>;
}

const taskTerminal = ['COMPLETED', 'CANCELED'];
const decisionTerminal = ['APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED', 'RETURNED', 'CANCELED'];

export const CanonicalWorkHardeningPanel: React.FC<Props> = ({ item, actorId, onReadback }) => {
  const isTask = Boolean(item.taskId);
  const id = item.taskId ?? item.decisionId ?? '';
  const terminal = (isTask ? taskTerminal : decisionTerminal).includes(item.status);
  const deadline = Math.min(
    Date.parse(item.dueAt),
    item.slaAt ? Date.parse(item.slaAt) : Number.POSITIVE_INFINITY
  );
  const overdue = !terminal && Number.isFinite(deadline) && Date.now() > deadline;
  const [reason, setReason] = useState('');
  const [level, setLevel] = useState<'WARNING' | 'CRITICAL'>('WARNING');
  const [state, setState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const [receipt, setReceipt] = useState<{ id: string; version: number; status: string } | null>(
    null
  );
  const commandIds = useRef(new Map<string, string>());
  const assignmentState = item.assignment?.status ?? 'NOT_OFFERED';
  const isOwner = isTask && Boolean(actorId) && actorId === item.ownerId;
  const isAssignee = isTask && Boolean(actorId) && actorId === item.assigneeId;
  const isAuthority = !isTask && Boolean(actorId) && actorId === item.authorityId;

  const actions = useMemo<Array<TaskAction | DecisionAction>>(() => {
    if (terminal) return isOwner || isAuthority ? ['REOPEN'] : [];
    const next: Array<TaskAction | DecisionAction> = [];
    if (isTask) {
      if (isOwner && !item.assignment) next.push('OFFER_ASSIGNMENT');
      if (isAssignee && item.assignment?.status === 'OFFERED')
        next.push('ACCEPT_ASSIGNMENT', 'DECLINE_ASSIGNMENT');
    }
    if (overdue && (isOwner || isAuthority)) next.push('ESCALATE');
    if (isOwner || isAuthority) next.push('CANCEL');
    return next;
  }, [isAssignee, isAuthority, isOwner, isTask, item.assignment, overdue, terminal]);

  const transition = async (action: TaskAction | DecisionAction) => {
    const requiresReason = ['DECLINE_ASSIGNMENT', 'ESCALATE', 'REOPEN', 'CANCEL'].includes(action);
    if ((requiresReason && !reason.trim()) || state === 'SAVING') return;
    setState('SAVING');
    setReceipt(null);
    const key = `${id}:${item.version}:${action}`;
    const clientRequestId = commandIds.current.get(key) ?? crypto.randomUUID();
    commandIds.current.set(key, clientRequestId);
    try {
      const executionCase = (await readExecutionCase(item.executionCaseId)) as { version: number };
      const command = {
        expectedVersion: item.version,
        expectedCaseVersion: executionCase.version,
        clientRequestId,
        action,
        reason: reason.trim(),
        ...(action === 'ESCALATE' ? { level } : {}),
      };
      const result = (
        isTask
          ? await transitionCanonicalTask(item.executionCaseId, id, command)
          : await transitionCanonicalDecision(item.executionCaseId, id, command)
      ) as {
        aggregateVersion?: number;
        response?: HardenedWorkItem;
      };
      const next = result.response ?? item;
      const version = result.aggregateVersion ?? item.version + 1;
      setReceipt({ id, version, status: next.status });
      setReason('');
      setState('IDLE');
      await onReadback?.(next, version);
      window.dispatchEvent(new Event('canonical-execution-work-updated'));
    } catch (error) {
      setState(error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };

  return (
    <section
      aria-label={`Governed ${isTask ? 'Task' : 'Decision'} controls`}
      className="space-y-3 rounded-md border border-c-border p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong>
          {isTask ? 'Task' : 'Decision'} · {id}
        </strong>
        <span>v{item.version}</span>
        <span>{item.status}</span>
        <span className={overdue ? 'text-c-danger' : 'text-c-success'}>
          {overdue ? 'OVERDUE' : 'SLA OK'}
        </span>
      </div>
      {isTask && (
        <div>
          Assignment: {assignmentState}
          {item.assignment?.reason ? ` · ${item.assignment.reason}` : ''}
        </div>
      )}
      {item.escalation && (
        <div role="status">
          Escalated {item.escalation.level} · {item.escalation.reason}
        </div>
      )}
      {item.cancelReason && <div>Cancellation: {item.cancelReason}</div>}
      {item.reopenReason && <div>Reopened: {item.reopenReason}</div>}
      {!actorId && (
        <div role="alert" className="text-c-warning">
          Actor binding is unavailable. Governed actions are fail-closed.
        </div>
      )}
      <div className="rounded-md border border-c-border p-2 text-xs text-c-text-muted">
        Direct reassignment is blocked. The owner must offer the existing assignment and the named
        assignee must accept or decline it; identity changes require a separate governed command.
      </div>
      {receipt && (
        <div role="status" className="text-c-success">
          Canonical readback: {receipt.id} · v{receipt.version} · {receipt.status}
        </div>
      )}
      {(state === 'CONFLICT' || state === 'FAILED') && (
        <div role="alert" className="text-c-danger">
          {state === 'CONFLICT'
            ? 'The work item or parent Execution Case changed. Reload before retrying.'
            : 'No change was recorded. Verify that you are the bound owner, assignee or authority.'}
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-c-text-muted">Controlled-action reason</span>
        <textarea
          aria-label="Controlled-action reason"
          className="min-h-20 w-full rounded-md border border-c-border bg-c-surface p-2"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {overdue && (
        <label className="block">
          <span className="mb-1 block text-c-text-muted">Escalation level</span>
          <select
            aria-label="Escalation level"
            className="rounded-md border border-c-border bg-c-surface p-2"
            value={level}
            onChange={(event) => setLevel(event.target.value as 'WARNING' | 'CRITICAL')}
          >
            <option>WARNING</option>
            <option>CRITICAL</option>
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const requiresReason = ['DECLINE_ASSIGNMENT', 'ESCALATE', 'REOPEN', 'CANCEL'].includes(
            action
          );
          return (
            <button
              key={action}
              type="button"
              className={action === 'CANCEL' ? 'btn-danger' : 'btn-secondary'}
              disabled={(requiresReason && !reason.trim()) || state === 'SAVING'}
              onClick={() => void transition(action)}
            >
              {action.replaceAll('_', ' ')}
            </button>
          );
        })}
      </div>
    </section>
  );
};
