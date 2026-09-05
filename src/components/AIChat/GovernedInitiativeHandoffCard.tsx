import { ArrowRight, CheckCircle2, CircleAlert, Clock3, Loader2, ShieldCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type GovernedInitiativeHandoffState =
  | 'idle'
  | 'checking'
  | 'blocked'
  | 'ready'
  | 'adopting'
  | 'adopted'
  | 'failed';

export interface GovernedInitiativeHandoffCardProps {
  initiativeId: string;
  title?: string | null;
  onOpenInitiative: (initiativeId: string) => void;
  onAdopted: (runtimeInitiativeId: string) => void;
}

type InitiativeRead = Record<string, unknown>;

function field(row: InitiativeRead, camel: string, snake: string): string {
  return String(row[camel] ?? row[snake] ?? '').trim();
}

async function readJson(response: Response): Promise<any> {
  return response.json().catch(() => ({}));
}

export const GovernedInitiativeHandoffCard: React.FC<GovernedInitiativeHandoffCardProps> = ({
  initiativeId,
  title,
  onOpenInitiative,
  onAdopted,
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<GovernedInitiativeHandoffState>('idle');
  const [missing, setMissing] = useState<string[]>([]);
  const [readyDraft, setReadyDraft] = useState<{
    projectId: string;
    initiativeOwnerId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const clientRequestId = `chat-draft-adopt:${initiativeId}`;

    void fetch(
      `/api/initiatives/runtime-v1/command-receipts/${encodeURIComponent(clientRequestId)}/read-back`,
      { credentials: 'include' }
    )
      .then(async (response) => {
        if (!active || !response.ok) return;
        const body = await readJson(response);
        if (active && body?.readBackState === 'CONFIRMED') setState('adopted');
      })
      .catch(() => {
        // A missing/unavailable receipt preserves the safe idle state.
      });

    return () => {
      active = false;
    };
  }, [initiativeId]);

  const checkReadiness = async () => {
    setState('checking');
    setError(null);
    try {
      const response = await fetch(`/api/initiatives/${encodeURIComponent(initiativeId)}`, {
        credentials: 'include',
      });
      const draft = (await readJson(response)) as InitiativeRead;
      if (!response.ok) throw new Error('INITIATIVE_READ_FAILED');
      const projectId = field(draft, 'projectId', 'project_id');
      const ownerId =
        field(draft, 'ownerExecutionId', 'owner_execution_id') ||
        field(draft, 'ownerBusinessId', 'owner_business_id') ||
        field(draft, 'ownerId', 'owner_id');
      const problem = field(draft, 'problemStatement', 'problem_statement');
      const gaps = [
        !projectId ? t('chat.initiativeHandoff.missing.project', 'project') : null,
        !ownerId ? t('chat.initiativeHandoff.missing.owner', 'initiative owner') : null,
        !problem ? t('chat.initiativeHandoff.missing.problem', 'problem statement') : null,
      ].filter((item): item is string => Boolean(item));
      setMissing(gaps);
      if (gaps.length > 0) {
        setReadyDraft(null);
        setState('blocked');
        return;
      }
      setReadyDraft({ projectId, initiativeOwnerId: ownerId });
      setState('ready');
    } catch {
      setError(t('chat.initiativeHandoff.readFailed', 'Could not verify the initiative draft.'));
      setState('failed');
    }
  };

  const adopt = async () => {
    if (!readyDraft) return;
    setState('adopting');
    setError(null);
    try {
      const response = await fetch('/api/initiatives/runtime-v1/adoptions/chat-draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatInitiativeId: initiativeId,
          expectedVersion: 0,
          clientRequestId: `chat-draft-adopt:${initiativeId}`,
          projectId: readyDraft.projectId,
          visibility: 'PROJECT',
          initiativeOwnerId: readyDraft.initiativeOwnerId,
        }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(String(body?.error?.code || 'ADOPTION_FAILED'));
      const runtimeInitiativeId = String(body?.response?.initiativeId || initiativeId);
      setState('adopted');
      onAdopted(runtimeInitiativeId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t('chat.initiativeHandoff.adoptionFailed', 'Adoption failed.')
      );
      setState('failed');
    }
  };

  const visual = {
    idle: { Icon: Clock3, label: t('chat.initiativeHandoff.state.idle', 'Awaiting consent') },
    checking: { Icon: Loader2, label: t('chat.initiativeHandoff.state.checking', 'Checking') },
    blocked: {
      Icon: CircleAlert,
      label: t('chat.initiativeHandoff.state.blocked', 'Needs details'),
    },
    ready: { Icon: ShieldCheck, label: t('chat.initiativeHandoff.state.ready', 'Ready') },
    adopting: { Icon: Loader2, label: t('chat.initiativeHandoff.state.adopting', 'Adopting') },
    adopted: { Icon: CheckCircle2, label: t('chat.initiativeHandoff.state.adopted', 'Adopted') },
    failed: { Icon: CircleAlert, label: t('chat.initiativeHandoff.state.failed', 'Failed') },
  }[state];
  const Icon = visual.Icon;

  return (
    <section
      data-testid={`governed-initiative-handoff-${initiativeId}`}
      data-visual-state={state}
      className="not-prose mt-3 overflow-hidden rounded-2xl border border-sky-300/50 bg-gradient-to-br from-white/95 to-sky-50/70 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.10)] dark:border-sky-300/20 dark:from-navy-900/95 dark:to-navy-800/80"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-sky-500/10 p-2 text-sky-700 dark:text-sky-300">
          <Icon
            size={16}
            aria-hidden="true"
            className={state === 'checking' || state === 'adopting' ? 'animate-spin' : undefined}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
              {t('chat.initiativeHandoff.title', 'Pass the initiative to execution?')}
            </h3>
            <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-200">
              {visual.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{title || initiativeId}</p>
          {state === 'blocked' ? (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-200">
              {t('chat.initiativeHandoff.missingPrefix', 'Missing')}: {missing.join(', ')}
            </p>
          ) : null}
          {error ? <p className="mt-3 text-xs text-danger-600">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {state === 'idle' || state === 'failed' ? (
              <button
                type="button"
                onClick={() => void checkReadiness()}
                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
              >
                {t('chat.initiativeHandoff.check', 'Check before handoff')}
              </button>
            ) : null}
            {state === 'ready' ? (
              <button
                type="button"
                onClick={() => void adopt()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {t('chat.initiativeHandoff.consent', 'Pass to execution')}
              </button>
            ) : null}
            {state === 'blocked' ? (
              <button
                type="button"
                onClick={() => onOpenInitiative(initiativeId)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                {t('chat.initiativeHandoff.complete', 'Complete in Initiatives')}
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};
