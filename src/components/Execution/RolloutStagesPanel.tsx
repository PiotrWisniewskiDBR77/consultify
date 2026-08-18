/**
 * M14/5.1 — Rollout stages panel (wave-based rollout planning).
 *
 * Surfaces the canonical rollout taxonomy (pilot → limited → full → hypercare →
 * closure) as a progression bound to /api/rollout-ext/stages. Lets the user create
 * the missing waves and advance a stage's status (not_started → active → gated →
 * done). Behind the `rolloutStages` flag (default OFF). Fails soft.
 */
import React, { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';

const WAVE_ORDER = ['pilot', 'limited', 'full', 'hypercare', 'closure'] as const;
type WaveType = (typeof WAVE_ORDER)[number];

const WAVE_LABEL: Record<WaveType, string> = {
  pilot: 'Pilot',
  limited: 'Limited',
  full: 'Full',
  hypercare: 'Hypercare',
  closure: 'Closure',
};

interface Stage {
  id: string;
  name: string;
  waveType: WaveType;
  status: 'not_started' | 'active' | 'gated' | 'done';
}

const STATUS_STYLE: Record<Stage['status'], string> = {
  not_started: 'bg-c-surface-raised text-c-text-muted border-c-border-subtle',
  active: 'bg-blue-100 text-blue-700 border-blue-200',
  gated: 'bg-amber-100 text-amber-700 border-amber-200',
  done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const STATUS_LABEL: Record<Stage['status'], string> = {
  not_started: 'nie rozpoczęty',
  active: 'aktywny',
  gated: 'bramka',
  done: 'zakończony',
};

interface Props {
  projectId?: string | null;
}

export const RolloutStagesPanel: React.FC<Props> = ({ projectId }) => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await Api.get(`/rollout-ext/stages${q}`)) as { stages?: Stage[] };
      setStages(Array.isArray(res?.stages) ? res.stages : []);
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

  const createWave = async (waveType: WaveType) => {
    setBusy(waveType);
    try {
      await Api.post('/rollout-ext/stages', {
        name: WAVE_LABEL[waveType],
        waveType,
        sequence: WAVE_ORDER.indexOf(waveType),
        projectId: projectId ?? null,
      });
      await load();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  const advance = async (id: string) => {
    setBusy(id);
    try {
      await Api.post(`/rollout-ext/stages/${id}/advance`, {});
      await load();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  const byWave = new Map<WaveType, Stage>();
  for (const s of stages) byWave.set(s.waveType, s);

  return (
    <section
      className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
      data-testid="rollout-stages-panel"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-c-text">Fale wdrożenia (rollout stages)</h3>
        <span className="text-xs text-c-text-muted">{stages.length}/5 fal</span>
      </div>

      {failed && (
        <p className="mb-2 text-xs text-amber-600">
          Nie udało się załadować/zmienić fal (sprawdź uprawnienia MANAGE_ROLLOUT).
        </p>
      )}
      {loading && <p className="text-sm text-c-text-muted">Ładowanie…</p>}

      <div className="flex flex-wrap items-stretch gap-2" data-testid="rollout-waves">
        {WAVE_ORDER.map((wave, idx) => {
          const stage = byWave.get(wave);
          return (
            <div
              key={wave}
              className="flex min-w-[8.5rem] flex-1 flex-col gap-1 rounded-lg border border-c-border-subtle p-2"
            >
              <div className="flex items-center gap-1 text-xs font-medium text-c-text-muted">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-c-surface-raised text-[10px]">
                  {idx + 1}
                </span>
                {WAVE_LABEL[wave]}
              </div>
              {stage ? (
                <>
                  <span
                    className={`inline-block w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[stage.status]}`}
                  >
                    {STATUS_LABEL[stage.status]}
                  </span>
                  {stage.status !== 'done' && (
                    <button
                      type="button"
                      disabled={busy === stage.id}
                      onClick={() => void advance(stage.id)}
                      className="mt-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      {busy === stage.id ? '…' : 'Dalej →'}
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy === wave}
                  onClick={() => void createWave(wave)}
                  className="mt-1 rounded-md border border-c-border-subtle px-2 py-0.5 text-[11px] font-medium text-c-text-muted hover:bg-c-surface-raised disabled:opacity-50"
                >
                  {busy === wave ? '…' : '+ utwórz'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default RolloutStagesPanel;
