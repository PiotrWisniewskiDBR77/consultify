/**
 * M14/5.3 — Rollout baseline panel (plan baseline / rebaseline).
 *
 * Captures and lists plan baselines bound to /api/rollout-ext/baselines. Each
 * baseline is a frozen snapshot of the plan at approval time (label + reason +
 * timestamp), newest first. Lets the user take a manual baseline from the
 * cockpit. Behind the rollout extensions surface. Fails soft — the backend
 * requires a projectId (400 otherwise), surfaced as a "wymaga projektu" note.
 */
import React, { useCallback, useEffect, useState } from 'react';

import { EmptyState, LoadingState } from '@/components/shared/states';
import { Api } from '@/services/api';

interface Baseline {
  id: string;
  label?: string | null;
  reason?: string | null;
  snapshot?: unknown;
  createdAt?: string | null;
  created_at?: string | null;
  createdBy?: string | null;
}

interface Props {
  projectId?: string | null;
}

function baselineDate(b: Baseline): string {
  const raw = b.createdAt ?? b.created_at ?? null;
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString();
}

function shortStamp(): string {
  return new Date().toLocaleString();
}

export const RolloutBaselinePanel: React.FC<Props> = ({ projectId }) => {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [needsProject, setNeedsProject] = useState(false);

  const effectiveProjectId = projectId && projectId.trim() ? projectId : 'all';
  const q = `?projectId=${encodeURIComponent(effectiveProjectId)}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await Api.get(`/rollout-ext/baselines${q}`)) as {
        baselines?: Baseline[];
      };
      setBaselines(Array.isArray(res?.baselines) ? res.baselines : []);
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

  const capture = async () => {
    setBusy(true);
    setNeedsProject(false);
    setFailed(false);
    try {
      await Api.post('/rollout-ext/baselines', {
        projectId: effectiveProjectId,
        snapshot: JSON.stringify({
          capturedAt: new Date().toISOString(),
          source: 'cockpit',
        }),
        label: 'Baseline ' + shortStamp(),
        reason: 'Ręczny zapis z kokpitu',
      });
      await load();
    } catch (err) {
      const status =
        (err as { status?: number; response?: { status?: number } })?.status ??
        (err as { response?: { status?: number } })?.response?.status;
      const msg = String((err as { message?: string })?.message ?? '');
      if (status === 400 || /projectId/i.test(msg)) {
        setNeedsProject(true);
      } else {
        setFailed(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
      data-testid="baseline-panel"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-c-text">Baseline planu (rebaseline)</h3>
        <button
          type="button"
          disabled={busy}
          onClick={() => void capture()}
          data-testid="baseline-capture-btn"
          className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {busy ? 'Zapisywanie…' : 'Zapisz baseline'}
        </button>
      </div>

      {needsProject && (
        <p className="mb-2 text-xs text-amber-600">Zapis baseline wymaga wybranego projektu.</p>
      )}
      {/* Error / loading / content are MUTUALLY EXCLUSIVE. This panel used to
          print the failure as a line ABOVE the list, so a failed load still
          rendered the "nothing here yet — create the first one" copy (or the
          wave cells) underneath: the UI asserted an absence it had not
          established. docs/UI_UX/35_EMPTY_LOADING_ERROR_STATES.md forbids that
          ("MUST NOT: Udawac sukcesu dla krytycznych operacji"). */}
      {failed ? (
        <div data-testid="baseline-load-error">
          <EmptyState
            variant="error"
            compact
            title="Nie udało się wczytać baseline'ów"
            description="Sprawdź uprawnienia."
            onRetry={() => void load()}
          />
        </div>
      ) : loading ? (
        <LoadingState template="list" rows={3} />
      ) : (
        <>
          {baselines.length === 0 ? (
            <p className="text-sm text-c-text-muted">
              Brak zapisanych baseline'ów — zapisz pierwszy.
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="baseline-list">
              {baselines.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-col gap-0.5 rounded-lg border border-c-border-subtle p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-c-text">{b.label || 'Baseline'}</span>
                    <span className="shrink-0 text-xs text-c-text-muted">{baselineDate(b)}</span>
                  </div>
                  {b.reason && <span className="text-xs text-c-text-muted">{b.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export default RolloutBaselinePanel;
