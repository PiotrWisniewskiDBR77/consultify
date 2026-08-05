/**
 * F2 — SKRZYNKA KANDYDATÓW (D5/D8): zakładka „Kandydaci" w hubie inicjatyw.
 *
 * AI proaktywnie sugeruje inicjatywy z rozpoznania (insights / assessments / audits).
 * Ten panel listuje kandydatów (tytuł · uzasadnienie · dopasowanie) i pozwala
 * zaakceptować (→ generator F1) lub odrzucić.
 *
 * Samowystarczalny: własny mini-hook fetch (reużywa getHeaders/API_URL z baseClient,
 * bez edycji współdzielonych API). i18n PL/EN przez t() z fallbackami. Read-mostly +
 * 3 mutacje (scan/accept/dismiss).
 */
import { Loader2, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '@/services/api/baseClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CandidateStatus = 'pending' | 'accepted' | 'dismissed';

export interface InitiativeCandidate {
  id: string;
  organizationId: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  rationale: string;
  fitScore: number;
  status: CandidateStatus;
  createdAt?: string;
  createdBy?: string | null;
}

export interface AcceptCandidatePayload {
  candidateId: string;
  organizationId: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  rationale: string;
  brief: string;
  /** Gdy serwer już utworzył inicjatywę z kandydata (accept tworzy+wypełnia) — nawiguj do niej, nie twórz drugiej. */
  initiativeId?: string | null;
  /** Czy generator wypełnił karty (auto-fill). */
  filled?: boolean;
}

// ---------------------------------------------------------------------------
// Small self-contained fetch hook
// ---------------------------------------------------------------------------

const CANDIDATES_BASE = `${API_URL}/initiatives/candidates`;

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

interface UseCandidatesResult {
  candidates: InitiativeCandidate[];
  loading: boolean;
  error: string | null;
  busyId: string | null;
  scanning: boolean;
  refresh: () => Promise<void>;
  scan: () => Promise<void>;
  accept: (id: string) => Promise<AcceptCandidatePayload | null>;
  dismiss: (id: string) => Promise<boolean>;
}

export function useCandidates(status: CandidateStatus = 'pending'): UseCandidatesResult {
  const [candidates, setCandidates] = useState<InitiativeCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${CANDIDATES_BASE}?status=${encodeURIComponent(status)}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await readJson(res);
      setCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`${CANDIDATES_BASE}/scan`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    } finally {
      setScanning(false);
    }
  }, [refresh]);

  const accept = useCallback(async (id: string): Promise<AcceptCandidatePayload | null> => {
    setBusyId(id);
    try {
      const res = await fetch(`${CANDIDATES_BASE}/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await readJson(res);
      if (data?.accepted !== true || data?.receiptPersisted !== true) {
        throw new Error('Acceptance receipt was not persisted');
      }
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      // Serwer tworzy+wypełnia inicjatywę i zwraca initiativeId — scal do payloadu,
      // żeby hub nawigował do niej zamiast tworzyć drugą (anty-dublet F2→F1).
      const payload = (data?.payload as AcceptCandidatePayload) ?? null;
      if (!payload && !data?.initiativeId) return null;
      return {
        ...(payload ?? ({} as AcceptCandidatePayload)),
        initiativeId: data?.initiativeId ?? null,
        filled: !!data?.filled,
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
      return null;
    } finally {
      setBusyId(null);
    }
  }, []);

  const dismiss = useCallback(async (id: string): Promise<boolean> => {
    setBusyId(id);
    try {
      const res = await fetch(`${CANDIDATES_BASE}/${encodeURIComponent(id)}/dismiss`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
      return false;
    } finally {
      setBusyId(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { candidates, loading, error, busyId, scanning, refresh, scan, accept, dismiss };
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

function FitScoreBadge({ score }: { score: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-c-info/10 px-2 py-0.5 text-xs font-medium text-c-info dark:bg-c-info/20 dark:text-c-info">
      {pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export interface CandidatesPanelProps {
  /** Wywoływane po akceptacji — host (hub) może uruchomić generator F1 z payloadem. */
  onAccept?: (payload: AcceptCandidatePayload) => void;
}

export function CandidatesPanel({ onAccept }: CandidatesPanelProps) {
  const { t } = useTranslation();
  const { candidates, loading, error, busyId, scanning, scan, accept, dismiss } =
    useCandidates('pending');

  const handleAccept = useCallback(
    async (id: string) => {
      const payload = await accept(id);
      if (payload && onAccept) onAccept(payload);
    },
    [accept, onAccept]
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-c-info" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t('initiatives.candidates.title', 'Kandydaci AI')}
        </h3>
        <p className="basis-full text-xs text-slate-500 dark:text-slate-400">
          {t(
            'initiatives.candidates.subtitle',
            'AI proponuje inicjatywy na podstawie rozpoznania (insighty, assessmenty, audyty).'
          )}
        </p>
        <button
          type="button"
          onClick={() => void scan()}
          disabled={scanning}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {scanning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {t('initiatives.candidates.scan', 'Przeskanuj rozpoznanie')}
        </button>
      </header>

      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {t('initiatives.candidates.error', 'Nie udało się pobrać kandydatów.')}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading', 'Ładowanie…')}
        </div>
      ) : candidates.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">
          {t(
            'initiatives.candidates.empty',
            'Brak kandydatów. Uruchom skan, aby AI zaproponowało inicjatywy z rozpoznania.'
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {candidates.map((c) => {
            const busy = busyId === c.id;
            return (
              <li
                key={c.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {c.title}
                      </h4>
                      <FitScoreBadge score={c.fitScore} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{c.rationale}</p>
                    <div className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">
                      {t('initiatives.candidates.source', 'Źródło')}: {c.sourceType}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAccept(c.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md bg-navy-900 dark:bg-[#F4F7FB] px-3 py-1.5 text-xs font-medium text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ThumbsUp className="h-3.5 w-3.5" />
                      )}
                      {t('initiatives.candidates.accept', 'Akceptuj')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void dismiss(c.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                      {t('initiatives.candidates.dismiss', 'Odrzuć')}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CandidatesPanel;
