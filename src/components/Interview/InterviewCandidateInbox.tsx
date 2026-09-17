/**
 * InterviewCandidateInbox — ST-2 (DEC-540 / U-09), etap 1: Interview only.
 *
 * The in-module surface for pending initiative candidates authored from the
 * Interview module. Mounted behind `VITE_ST2_CANDIDATE_CARD` (default OFF,
 * fail-closed) at the top of the Interview "Initiatives" tab so the author can
 * approve a candidate as a draft WITHOUT jumping to the Initiatives module.
 *
 * Self-contained: reuses `API_URL`/`getHeaders` from baseClient (zero edits to
 * shared APIs) and the EXISTING candidate endpoints —
 *   GET  /api/initiatives/candidates?status=pending
 *   POST /api/initiatives/candidates/:id/accept
 * No new backend, no registry change. Fail-soft: a fetch error renders the empty
 * state and never breaks the host tab.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import { API_URL, getHeaders } from '@/services/api/baseClient';
import { useAppStore } from '@/store/useAppStore';

import {
  canViewCandidate,
  isInterviewCandidate,
  InterviewCandidateCard,
  type InterviewCandidate,
} from './InterviewCandidateCard';

const CANDIDATES_BASE = `${API_URL}/initiatives/candidates`;

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export interface InterviewCandidateInboxProps {
  /** Called after a candidate is approved as a draft (host refreshes its list). */
  onApproved?: (initiativeId?: string | null) => void;
}

export const InterviewCandidateInbox: React.FC<InterviewCandidateInboxProps> = ({ onApproved }) => {
  const { t } = useTranslation();
  const currentUser = useAppStore((s) => s.currentUser);
  const [candidates, setCandidates] = useState<InterviewCandidate[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${CANDIDATES_BASE}?status=pending`, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await readJson(res);
      const list: InterviewCandidate[] = Array.isArray(data?.candidates) ? data.candidates : [];
      // Author-only inbox: an interview candidate is shown to its author (+ADMIN).
      const visible = list.filter((c) => isInterviewCandidate(c) && canViewCandidate(c, currentUser));
      if (mounted.current) setCandidates(visible);
    } catch {
      if (mounted.current) setCandidates([]);
    }
  }, [currentUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = useCallback(
    async (candidate: InterviewCandidate) => {
      if (busyId) return;
      setBusyId(candidate.id);
      try {
        const res = await fetch(`${CANDIDATES_BASE}/${encodeURIComponent(candidate.id)}/accept`, {
          method: 'POST',
          headers: { ...getHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ fill: true }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await readJson(res);
        if (data?.accepted !== true || data?.receiptPersisted !== true) {
          throw new Error('Acceptance receipt was not persisted');
        }
        if (mounted.current) {
          setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
          toast.success(t('interview.candidateCard.approved'));
        }
        onApproved?.(data?.initiativeId ?? null);
      } catch {
        if (mounted.current) toast.error(t('interview.candidateCard.approveFailed'));
      } finally {
        if (mounted.current) setBusyId(null);
      }
    },
    [busyId, onApproved, t]
  );

  return (
    <div
      data-testid="interview-candidate-inbox"
      className="mx-4 mb-3 mt-4 shrink-0 rounded-xl border border-c-border bg-c-surface p-3"
    >
      <div className="mb-2 text-[12px] font-semibold text-c-text-secondary">
        {t('interview.candidateCard.inboxHeading')}
      </div>
      {candidates.length === 0 ? (
        <p className="text-sm text-c-text-muted" data-testid="interview-candidate-inbox-empty">
          {t('interview.candidateCard.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map((c) => (
            <InterviewCandidateCard
              key={c.id}
              candidate={c}
              busy={busyId === c.id}
              onApprove={handleApprove}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default InterviewCandidateInbox;
