import {
  AlertTriangle,
  BadgeCheck,
  BookOpenCheck,
  Calculator,
  Link2,
  ShieldCheck,
} from 'lucide-react';
import React from 'react';

import { Api } from '@/services/api';
import {
  V8PartnerApi,
  type V8PartnerAttribution,
  type V8PartnerParticipantLedgerEntry,
  type V8PartnerProgramStatus,
} from '@/services/api/v8';

type SurfaceState = 'ready' | 'empty' | 'degraded' | 'unavailable' | 'policy_gated';

export interface PartnerCanonicalRuntimeSnapshot {
  program: V8PartnerProgramStatus | null;
  certifications: {
    total: number;
    completed: number;
    pendingReview: number;
    state: SurfaceState;
  };
  attributions: {
    total: number;
    active: number;
    state: SurfaceState;
  };
  participantLedger: {
    entries: V8PartnerParticipantLedgerEntry[];
    state: SurfaceState;
  };
  programState: SurfaceState;
}

const unwrap = (response: any): any => {
  const outer = response?.data ?? response;
  return outer?.data ?? outer;
};

export async function loadPartnerCanonicalRuntime(): Promise<PartnerCanonicalRuntimeSnapshot> {
  const [programResult, attributionResult, certificationResult, participantLedgerResult] =
    await Promise.allSettled([
      V8PartnerApi.getProgramStatus(),
      V8PartnerApi.getAttributions(),
      Api.get('/api/partners/certifications'),
      V8PartnerApi.getParticipantLedger(),
    ]);

  const program = programResult.status === 'fulfilled' ? programResult.value : null;
  const attributions: V8PartnerAttribution[] =
    attributionResult.status === 'fulfilled' && Array.isArray(attributionResult.value?.attributions)
      ? attributionResult.value.attributions
      : [];
  const certificationPayload =
    certificationResult.status === 'fulfilled' ? unwrap(certificationResult.value) : null;
  const certifications = Array.isArray(certificationPayload) ? certificationPayload : [];
  const participantLedgerEntries =
    participantLedgerResult.status === 'fulfilled' &&
    Array.isArray(participantLedgerResult.value?.entries)
      ? participantLedgerResult.value.entries
      : [];

  return {
    program,
    programState:
      programResult.status === 'rejected'
        ? 'unavailable'
        : program?.degraded
          ? 'degraded'
          : 'ready',
    certifications: {
      total: certifications.length,
      completed: certifications.filter((item: any) => item?.status === 'completed').length,
      pendingReview: certifications.filter((item: any) =>
        ['pending', 'ready', 'changes_requested'].includes(String(item?.reviewState || ''))
      ).length,
      state:
        certificationResult.status === 'rejected'
          ? 'unavailable'
          : certifications.length === 0
            ? 'empty'
            : 'ready',
    },
    attributions: {
      total: attributions.length,
      active: attributions.filter((item) => String(item.status).toUpperCase() === 'ACTIVE').length,
      state:
        attributionResult.status === 'rejected'
          ? 'unavailable'
          : attributions.length === 0
            ? 'empty'
            : 'ready',
    },
    participantLedger: {
      entries: participantLedgerEntries,
      state:
        participantLedgerResult.status === 'rejected'
          ? 'unavailable'
          : participantLedgerEntries.length === 0
            ? 'empty'
            : 'ready',
    },
  };
}

const stateCopy: Record<SurfaceState, string> = {
  ready: 'Ready',
  empty: 'Empty',
  degraded: 'Degraded',
  unavailable: 'Unavailable',
  policy_gated: 'Policy gated',
};

const stateClass: Record<SurfaceState, string> = {
  ready: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  empty: 'bg-slate-100 text-slate-700 dark:bg-navy-700 dark:text-slate-200',
  degraded: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  unavailable: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  policy_gated: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
};

function money(value: number | undefined, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  } catch {
    return `${Number(value) || 0} ${currency || 'EUR'}`;
  }
}

export const PartnerCanonicalRuntimePanel: React.FC<{
  snapshot: PartnerCanonicalRuntimeSnapshot;
}> = ({ snapshot }) => {
  const currency = snapshot.program?.balances?.currency || 'EUR';
  const latestParticipantFact = snapshot.participantLedger.entries[0];
  const cards = [
    {
      id: 'partner',
      title: 'Partner status',
      icon: ShieldCheck,
      state: snapshot.programState,
      value: snapshot.program?.lifecyclePhase || 'Unknown',
      detail: snapshot.program?.partnerOrganizationStatus || 'Status could not be verified',
    },
    {
      id: 'certification',
      title: 'Certification',
      icon: BookOpenCheck,
      state: snapshot.certifications.state,
      value: `${snapshot.certifications.completed}/${snapshot.certifications.total}`,
      detail:
        snapshot.certifications.pendingReview > 0
          ? `${snapshot.certifications.pendingReview} awaiting review`
          : 'No pending operator review',
    },
    {
      id: 'attribution',
      title: 'Attribution',
      icon: Link2,
      state: snapshot.attributions.state,
      value: String(snapshot.attributions.total),
      detail: `${snapshot.attributions.active} active attribution records`,
    },
    {
      id: 'ledger',
      title: 'Participant ledger',
      icon: Calculator,
      state: snapshot.participantLedger.state,
      value: String(snapshot.participantLedger.entries.length),
      detail: latestParticipantFact
        ? `${latestParticipantFact.sourceVersion} · ${latestParticipantFact.sourceDigest.slice(0, 12)}`
        : 'No immutable referral facts recorded',
    },
    {
      id: 'accrual',
      title: 'Accrual eligibility',
      icon: BadgeCheck,
      state: 'policy_gated' as const,
      value: money(snapshot.program?.balances?.availableToPayout, currency),
      detail: 'Recorded balance only; eligibility requires an approved versioned rule.',
    },
  ];

  return (
    <section
      aria-labelledby="partner-canonical-runtime-title"
      className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-navy-700 dark:bg-navy-800"
      data-testid="partner-canonical-runtime"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="partner-canonical-runtime-title"
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            Governed Partner runtime
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Current persisted state for program, certification, attribution, ledger and accrual.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-navy-700 dark:text-slate-200">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
          Read-only governance view
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" role="list">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.id}
              className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-navy-700 dark:bg-navy-900/50"
              data-testid={`partner-runtime-${card.id}`}
              role="listitem"
            >
              <div className="flex items-start justify-between gap-2">
                <Icon
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-slate-600 dark:text-slate-300"
                />
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stateClass[card.state]}`}
                >
                  {stateCopy[card.state]}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                {card.title}
              </h3>
              <p className="mt-1 break-words text-xl font-semibold text-slate-950 dark:text-white">
                {card.value}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
                {card.detail}
              </p>
            </article>
          );
        })}
      </div>

      <div
        className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-500/10 dark:text-amber-100"
        role="note"
      >
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          This ledger contains non-economic referral facts only. Accrual, payout requests, automatic
          payout and self-approval are unavailable under AMD-PRT-ECONOMICS-002.
        </span>
      </div>
    </section>
  );
};

export default PartnerCanonicalRuntimePanel;
