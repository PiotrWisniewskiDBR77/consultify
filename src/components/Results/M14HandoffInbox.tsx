/**
 * M15/W1 (G1) — M14 → M15 handoff inbox.
 *
 * Closes the chain gap: benefits handed off from M14 closure land in
 * `benefits_register` but the live ResultsHub reads `initiative_kpis` and never
 * showed them. This panel surfaces the handoff inbox and lets the user PROMOTE a
 * benefit into a tracked KPI (POST /benefits-register/benefits/:id/promote → the
 * bridge into the M15 canonical engine). Behind the `m14Handoff` flag (default
 * OFF). Read-mostly, fails soft.
 */
import React, { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';

const HANDOFF_SOURCE = 'M14_CLOSURE_HANDOFF';

interface Benefit {
  id: string;
  name: string;
  kpi_name: string | null;
  owner_id: string | null;
  baseline_value: number | null;
  target_value: number | null;
  current_value: number | null;
  cadence: string | null;
  status: string;
  source: string | null;
  initiative_id: string | null;
  promoted_kpi_id?: string | null;
}

const fmt = (v: number | null): string => (v === null || v === undefined ? '—' : String(v));

interface Props {
  onPromoted?: () => void;
}

export const M14HandoffInbox: React.FC<Props> = ({ onPromoted }) => {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await Api.get('/benefits-register/benefits')) as { benefits?: Benefit[] };
      setBenefits(Array.isArray(res?.benefits) ? res.benefits : []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const promote = async (id: string) => {
    setBusy(id);
    try {
      await Api.post(`/benefits-register/benefits/${id}/promote`, {});
      await load();
      onPromoted?.();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  const handoffCount = benefits.filter((b) => b.source === HANDOFF_SOURCE).length;

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900"
      data-testid="m14-handoff-inbox"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            Skrzynka z wdrożenia (M14 → Rezultaty)
          </h3>
          <p className="text-xs text-gray-400">
            Korzyści przekazane przy zamknięciu inicjatyw — promuj do śledzonych KPI.
          </p>
        </div>
        <span className="text-xs text-gray-400" data-testid="m14-handoff-count">
          {handoffCount} z M14 · {benefits.length} łącznie
        </span>
      </div>

      {failed && (
        <p className="mb-2 text-xs text-amber-600">Nie udało się załadować/zmienić skrzynki.</p>
      )}
      {loading && <p className="text-sm text-gray-400">Ładowanie…</p>}

      {!loading && benefits.length === 0 ? (
        <p className="text-sm text-gray-400" data-testid="m14-handoff-empty">
          Brak przekazanych korzyści — pojawią się tu przy zamknięciu inicjatyw w module Wdrożenie.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="m14-handoff-list">
          {benefits.map((b) => {
            const promoted = !!b.promoted_kpi_id || b.status === 'promoted';
            return (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-2 dark:border-navy-700"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                      {b.kpi_name || b.name}
                    </span>
                    {b.source === HANDOFF_SOURCE && (
                      <span className="shrink-0 rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                        z M14
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-gray-500">
                    <span>owner: {b.owner_id || '—'}</span>
                    <span>
                      {fmt(b.baseline_value)} → {fmt(b.target_value)}
                      {b.current_value != null ? ` (teraz ${b.current_value})` : ''}
                    </span>
                    <span>cadence: {b.cadence || '—'}</span>
                  </div>
                </div>
                {promoted ? (
                  <span
                    className="shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                    data-testid="m14-handoff-tracked"
                  >
                    śledzone ✓
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy === b.id}
                    onClick={() => void promote(b.id)}
                    data-testid="m14-handoff-promote"
                    className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {busy === b.id ? '…' : 'Śledź jako KPI →'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default M14HandoffInbox;
