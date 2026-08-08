/**
 * AgentManifestLauncher — "uruchom jednego z 31 gotowych agentów" (HP-4).
 *
 * Decyzja Piotra 07-16 (koncept §4, §5 Q3 — zakres HP-5 zawężony): Agent
 * Builder w tej fali = URUCHAMIANIE gotowych manifestów katalogu Discovery
 * Tools (server/src/services/ai/agentRuntime/discoveryAgentManifestCatalog.ts,
 * 31 wpisów, endpoint `/api/ai/agent-manifests` — już żywy, read-only), NIE
 * pełny builder definicji agenta od zera (to HP-5, osobna, późniejsza fala).
 *
 * PlanBuilder (koncept zadanie F1 — LANDED 2026-07-16,
 * server/src/services/ai/agentPlan/planBuilderService.ts) tłumaczy teraz
 * manifest na 3-4 realne kroki narzędzi (kurowane per manifest-id, fallback
 * per `wave` dla manifestów bez kuracji). Ten launcher NIE buduje już kroków
 * sam — wysyła tylko `manifestId`, a backend (agent-plan.routes.ts POST /)
 * woła `buildPlanFromManifest` i zapisuje wygenerowaną listę. Poprzedni
 * placeholder (pojedynczy krok "kickoff" — `search_knowledge_base`) został
 * usunięty; agent wykonuje teraz realną wieloetapową pracę.
 *
 * Za flagą `ff_agentPlan` (patrz AgentPlanWorkspace.tsx, wołający tego
 * komponentu). Wyłącznie tokeny c-*, fokus c-focus, zero crimson w primary.
 */
import { Loader2, PlayCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewActionButton } from '@/components/shared/PreviewPane';
import { type AgentManifestSummary, listAgentManifests } from '@/services/api/agentManifests.api';
import { createAgentPlan } from '@/services/api/agentPlan.api';

export interface AgentManifestLauncherProps {
  /** Wywołane po pomyślnym utworzeniu planu — wołający montuje AgentPlanPanel z tym id. */
  onPlanCreated: (planId: string) => void;
}

const WAVE_ORDER = ['wave-1', 'wave-2', 'wave-3', 'reference'] as const;

const WAVE_LABEL_KEY: Record<string, string> = {
  'wave-1': 'agentPlan.launcher.wave.wave1',
  'wave-2': 'agentPlan.launcher.wave.wave2',
  'wave-3': 'agentPlan.launcher.wave.wave3',
  reference: 'agentPlan.launcher.wave.reference',
};

const WAVE_LABEL_FALLBACK: Record<string, string> = {
  'wave-1': 'Wave 1',
  'wave-2': 'Wave 2',
  'wave-3': 'Wave 3',
  reference: 'Reference',
};

export const AgentManifestLauncher: React.FC<AgentManifestLauncherProps> = ({ onPlanCreated }) => {
  const { t, i18n } = useTranslation();
  const isPl = (i18n.language || '').toLowerCase().startsWith('pl');

  const [manifests, setManifests] = useState<AgentManifestSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAgentManifests({ status: 'built' })
      .then(({ manifests: fetched }) => {
        if (!cancelled) setManifests(fetched);
      })
      .catch((error) => {
        // Diagnostic detail stays in the console for support/engineering;
        // the user only ever sees the safe, localized product message.
        console.error('[AgentManifestLauncher] Failed to load agent manifests:', error);
        if (!cancelled) {
          setLoadError(
            t('agentPlan.launcher.loadError', 'We could not load the agent list. Please try again.')
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const byWave = new Map<string, AgentManifestSummary[]>();
    (manifests || []).forEach((m) => {
      const arr = byWave.get(m.wave) || [];
      arr.push(m);
      byWave.set(m.wave, arr);
    });
    const knownWaves = WAVE_ORDER.filter((w) => byWave.has(w)).map((w) => ({
      wave: w,
      items: byWave.get(w) as AgentManifestSummary[],
    }));
    const extraWaves = [...byWave.keys()]
      .filter((w) => !(WAVE_ORDER as readonly string[]).includes(w))
      .map((w) => ({ wave: w, items: byWave.get(w) as AgentManifestSummary[] }));
    return [...knownWaves, ...extraWaves];
  }, [manifests]);

  const handleStart = useCallback(async () => {
    if (!selectedId || !manifests) return;
    const manifest = manifests.find((m) => m.id === selectedId);
    if (!manifest) return;

    setStarting(true);
    setStartError(null);
    try {
      const label = isPl ? manifest.displayName.pl : manifest.displayName.en;
      const { plan } = await createAgentPlan({
        title: `${t('agentPlan.launcher.planTitlePrefix', 'Agent')}: ${label}`,
        manifestId: manifest.id,
        // No `steps` here — the backend's PlanBuilder (planBuilderService.ts)
        // generates the real multi-step playbook from manifest.id/wave.
      });
      onPlanCreated(plan.id);
    } catch (error) {
      console.error('[AgentManifestLauncher] Failed to start agent:', error);
      setStartError(
        t('agentPlan.launcher.startError', 'We could not start this agent. Please try again.')
      );
    } finally {
      setStarting(false);
    }
  }, [selectedId, manifests, isPl, t, onPlanCreated]);

  if (loadError) {
    return <p className="text-xs text-c-danger py-1.5">{loadError}</p>;
  }

  if (!manifests) {
    return (
      <div className="flex items-center gap-2 text-xs text-c-text-muted py-1.5">
        <Loader2 size={14} className="animate-spin" />
        {t('agentPlan.launcher.loading', 'Loading agents…')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-c-text-muted">
        {t('agentPlan.launcher.hint', 'Choose a ready-made agent to launch as a background plan.')}
      </p>
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {grouped.map(({ wave, items }) => (
          <div key={wave}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted mb-1">
              {t(WAVE_LABEL_KEY[wave] || wave, WAVE_LABEL_FALLBACK[wave] || wave)}
            </div>
            <ul className="space-y-1">
              {items.map((manifest) => {
                const selected = manifest.id === selectedId;
                const label = isPl ? manifest.displayName.pl : manifest.displayName.en;
                return (
                  <li key={manifest.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(manifest.id)}
                      aria-pressed={selected}
                      className={`w-full text-left text-xs rounded-lg border px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ${
                        selected
                          ? 'border-c-border-strong bg-c-surface-raised text-c-text'
                          : 'border-c-border-subtle text-c-text-muted hover:bg-c-surface-raised'
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {startError ? <p className="text-xs text-c-danger">{startError}</p> : null}
      <PreviewActionButton
        variant="positive"
        icon={starting ? Loader2 : PlayCircle}
        label={t('agentPlan.launcher.start', 'Start agent')}
        onClick={() => void handleStart()}
        disabled={!selectedId || starting}
      />
    </div>
  );
};

export default AgentManifestLauncher;
