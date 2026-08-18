/**
 * M14/6.1 — Benefits register panel (benefits register + M14 → M15 handoff).
 *
 * Surfaces the org-scoped benefits register backed by /api/benefits-register:
 * tracked outcomes (KPI/ROI) an initiative is expected to keep delivering into
 * sustainment (M15). Lists benefits (org-wide, or scoped to one initiative when
 * `initiativeId` is given) and lets the user register a new benefit. Benefits
 * seeded by the M14 closure handoff carry `source = 'M14_CLOSURE_HANDOFF'` and
 * are flagged with a badge. Fails soft.
 */
import React, { useCallback, useEffect, useState } from 'react';

import { EmptyState, LoadingState } from '@/components/shared/states';
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
}

const STATUS_STYLE: Record<string, string> = {
  tracking: 'bg-blue-100 text-blue-700 border-blue-200',
  achieved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  at_risk: 'bg-amber-100 text-amber-700 border-amber-200',
  missed: 'bg-danger-100 text-danger-700 border-danger-200',
};

const statusStyle = (status: string): string =>
  STATUS_STYLE[status] || 'bg-c-surface-raised text-c-text-muted border-c-border-subtle';

const fmtVal = (v: number | null): string => (v === null || v === undefined ? '—' : String(v));

interface Props {
  initiativeId?: string | null;
}

export const BenefitsRegisterPanel: React.FC<Props> = ({ initiativeId }) => {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const q = initiativeId ? `?initiativeId=${encodeURIComponent(initiativeId)}` : '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await Api.get(`/benefits-register/benefits${q}`)) as {
        benefits?: Benefit[];
      };
      setBenefits(Array.isArray(res?.benefits) ? res.benefits : []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const addBenefit = async () => {
    setBusy(true);
    try {
      await Api.post('/benefits-register/benefits', {
        name: 'Czas cyklu procesu',
        kpiName: 'Czas cyklu (dni)',
        ownerId: null,
        baselineValue: 10,
        targetValue: 6,
        cadence: 'monthly',
        status: 'tracking',
        initiativeId: initiativeId ?? null,
      });
      await load();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
      data-testid="benefits-panel"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-c-text">Rejestr korzyści (handoff M14→M15)</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-c-text-muted">{benefits.length}</span>
          <button
            type="button"
            data-testid="benefits-add-btn"
            disabled={busy}
            onClick={() => void addBenefit()}
            className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {busy ? '…' : '+ Dodaj benefit'}
          </button>
        </div>
      </div>

      {/* Error / loading / content are MUTUALLY EXCLUSIVE. This panel used to
          print the failure as a line ABOVE the list, so a failed load still
          rendered the "nothing here yet — create the first one" copy (or the
          wave cells) underneath: the UI asserted an absence it had not
          established. docs/UI_UX/35_EMPTY_LOADING_ERROR_STATES.md forbids that
          ("MUST NOT: Udawac sukcesu dla krytycznych operacji"). */}
      {failed ? (
        <div data-testid="benefits-load-error">
          <EmptyState
            variant="error"
            compact
            title="Nie udało się wczytać rejestru korzyści"
            description="Sprawdź uprawnienia MANAGE_ROLLOUT."
            onRetry={() => void load()}
          />
        </div>
      ) : loading ? (
        <LoadingState template="list" rows={3} />
      ) : (
        <>
          {benefits.length === 0 ? (
            <p className="text-sm text-c-text-muted" data-testid="benefits-list">
              Brak zarejestrowanych korzyści — dodaj pierwszą (handoff do Rezultatów/M15).
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="benefits-list">
              {benefits.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-col gap-1 rounded-lg border border-c-border-subtle p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-c-text">{b.kpi_name || b.name}</span>
                    <div className="flex items-center gap-1">
                      {b.source === HANDOFF_SOURCE && (
                        <span className="inline-block rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                          handoff M14
                        </span>
                      )}
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyle(b.status)}`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-c-text-muted">
                    <span>owner: {b.owner_id || '—'}</span>
                    <span>
                      {fmtVal(b.baseline_value)} → {fmtVal(b.target_value)}
                    </span>
                    <span>cadence: {b.cadence || '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export default BenefitsRegisterPanel;
