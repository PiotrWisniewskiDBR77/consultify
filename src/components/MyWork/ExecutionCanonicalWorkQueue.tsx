import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CanonicalWorkHardeningPanel,
  type HardenedWorkItem,
} from '@/components/shared/CanonicalWorkHardeningPanel';
import { TaskMilestoneBlastRadius } from '@/components/shared/TaskMilestoneBlastRadius';
import {
  listMyExecutionWork,
  listMyOperationalAllocations,
} from '@/services/initiatives-execution/runtimeApi';
import { useAppStore } from '@/store/useAppStore';
export const ExecutionCanonicalWorkQueue = () => {
  const { t } = useTranslation();
  const actorId = useAppStore((store) => store.currentUser?.id ?? null);
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING'),
    [work, setWork] = useState<any>({ tasks: [], decisions: [] }),
    [allocations, setAllocations] = useState<any[]>([]),
    [selectedKey, setSelectedKey] = useState<string | null>(null);
  const load = useCallback(() => {
    setState('LOADING');
    return Promise.all([listMyExecutionWork(), listMyOperationalAllocations()])
      .then(([w, a]: any[]) => {
        setWork(w);
        setAllocations(a.items ?? []);
        setState('READY');
      })
      .catch(() => setState('ERROR'));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const items = useMemo(
    () => [
      ...(work.tasks ?? []).map((x: any) => ({ ...x, id: x.taskId, type: 'TASK' })),
      ...(work.decisions ?? []).map((x: any) => ({ ...x, id: x.decisionId, type: 'DECISION' })),
      ...allocations.map((x: any) => ({ ...x, id: x.allocationId, type: 'ALLOCATION' })),
    ],
    [allocations, work.decisions, work.tasks]
  );
  const selected = items.find((item: any) => `${item.type}:${item.id}` === selectedKey) ?? null;
  if (state === 'LOADING')
    return (
      <section aria-label={t('myWork.executionCanonicalWorkQueue.sectionLabel', 'My canonical execution work')} role="status" className="p-4">
        {t('myWork.executionCanonicalWorkQueue.loading', 'Loading canonical execution work')}
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label={t('myWork.executionCanonicalWorkQueue.sectionLabel', 'My canonical execution work')} role="alert" className="p-4">
        {t('myWork.executionCanonicalWorkQueue.unavailable', 'Canonical execution work unavailable.')}
      </section>
    );
  if (!(work.tasks?.length || work.decisions?.length || allocations.length)) return null;
  return (
    <section aria-label={t('myWork.executionCanonicalWorkQueue.sectionLabel', 'My canonical execution work')} className="border-b border-c-border p-4">
      <h3 className="font-semibold">{t('myWork.executionCanonicalWorkQueue.title', 'My Execution work')}</h3>
      <p className="text-xs text-c-text-muted">
        {t('myWork.executionCanonicalWorkQueue.subtitle', 'Same canonical Task, Decision and OperationalAllocation IDs as Execution.')}
      </p>
      {items.map((x: any) => (
        <button
          type="button"
          key={`${x.type}:${x.id}`}
          className="mt-2 block w-full rounded border border-c-border p-2 text-left text-sm"
          onClick={() => setSelectedKey(`${x.type}:${x.id}`)}
        >
          <strong>
            {x.type} · {x.id}
          </strong>
          <span className="ml-2">{x.status}</span>
          <div className="text-xs text-c-text-muted">{t('myWork.executionCanonicalWorkQueue.executionCase', 'Execution Case')} {x.executionCaseId}</div>
        </button>
      ))}
      {selected && selected.type !== 'ALLOCATION' && (
        <div className="mt-3">
          <CanonicalWorkHardeningPanel
            item={selected as HardenedWorkItem}
            actorId={actorId}
            onReadback={(next, version) => {
              setWork((current: any) => ({
                ...current,
                tasks:
                  selected.type === 'TASK'
                    ? (current.tasks ?? []).map((item: any) =>
                        item.taskId === selected.id ? { ...item, ...next, version } : item
                      )
                    : current.tasks,
                decisions:
                  selected.type === 'DECISION'
                    ? (current.decisions ?? []).map((item: any) =>
                        item.decisionId === selected.id ? { ...item, ...next, version } : item
                      )
                    : current.decisions,
              }));
            }}
          />
          {selected.type === 'TASK' && <TaskMilestoneBlastRadius task={selected} />}
        </div>
      )}
    </section>
  );
};
