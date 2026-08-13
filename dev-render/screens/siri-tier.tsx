/**
 * A7 — SIRI TIER / Prioritisation Matrix, dev-render harness screen.
 *
 * SEPARATE VIEW on purpose (ASSESSMENT_KB_SIRI.md §4: "Nie wolno łączyć
 * wyboru Band z priorytetyzacją w jednym formularzu.") — this screen never
 * mounts `MethodWorkspaceShell`; it is a small, standalone results view that
 * only exists post-freeze, wired to
 * `src/method-core/methods/siri/siriTierView.ts` (itself a thin wrapper over
 * `siriAdapter.prioritise()` / `src/services/siriPrioritisation.ts`,
 * COORD-08). No formula lives here — only display shaping.
 *
 * URL params:
 *   &frozen=1|0        session frozen? (default 1 — TIER reachable)
 *   &flag=1|0          SIRI_PM_V2 flag ON/OFF (default 0 — legacy_v1)
 *   &horizon=strategic|tactical|operational   (default strategic)
 *   &theme=light|dark
 */
import React, { useMemo } from 'react';

import {
  runSiriTier,
  siriTierAvailability,
  type SiriTierViewResult,
} from '../../src/method-core/methods/siri/siriTierView';
import { SIRI_PM_V2_FLAG_KEYS } from '../../src/utils/siriPmV2Flag';
import type { SiriPmPlanningHorizon } from '../../src/services/siriPrioritisation';
import { SIRI_PRIORITISATION_AREAS } from '../../src/services/siriStructure';

const params = new URLSearchParams(window.location.search);
const frozen = params.get('frozen') !== '0';
const flagOn = params.get('flag') === '1';
const horizon = (params.get('horizon') || 'strategic') as SiriPmPlanningHorizon;

if (typeof window !== 'undefined') {
  if (flagOn) window.localStorage.setItem(SIRI_PM_V2_FLAG_KEYS.localStorage, '1');
  else window.localStorage.removeItem(SIRI_PM_V2_FLAG_KEYS.localStorage);
}

function buildFrozenSnapshotLevels(): Record<string, number> {
  // Deterministic, plausible-looking frozen 16D snapshot for the demo —
  // NOT a real assessment result.
  const levels: Record<string, number> = {};
  SIRI_PRIORITISATION_AREAS.forEach((area, i) => {
    levels[area.id] = [1, 3, 2, 0, 4, 1, 3, 2, 1, 0, 2, 3, 1, 4, 2, 1][i % 16];
  });
  return levels;
}

const BUILDING_BLOCK_LABEL: Record<string, string> = {
  PROCESS: 'Procesy',
  TECHNOLOGY: 'Technologia',
  ORGANIZATION: 'Organizacja',
};

function Screen(): React.ReactElement {
  const availability = useMemo(() => siriTierAvailability(frozen ? 'frozen' : 'active'), []);

  const result: SiriTierViewResult | null = useMemo(() => {
    if (!availability.available) return null;
    return runSiriTier({
      frozenSnapshotId: 'snap-demo-tier-001',
      frozenUnitLevels: buildFrozenSnapshotLevels(),
      planningHorizon: horizon,
      // Deliberately NO explicit calculationVersion here — this screen's
      // whole point is to show the version resolved from the SIRI_PM_V2
      // flag (?flag=1|0), never a silent hardcode (COORD-08).
    });
  }, [availability.available]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)', padding: 24, fontFamily: 'system-ui' }}>
      <header style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          SIRI · Osobny ekran (nie MethodWorkspaceShell)
        </p>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: '2px 0' }}>TIER — Prioritisation Matrix</h1>
        <p style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
          Uruchamiany dopiero po zamrożeniu (freeze) Assessment Matrix — dwie kolejne macierze
          (ASSESSMENT_KB_SIRI.md §4), nigdy w tym samym formularzu co wybór Bandu.
        </p>
      </header>

      {!availability.available && (
        <div
          role="alert"
          data-testid="siri-tier-unavailable"
          style={{
            border: '1px solid var(--c-warning)',
            background: 'color-mix(in srgb, var(--c-warning) 12%, transparent)',
            color: 'var(--c-warning)',
            borderRadius: 10,
            padding: '14px 16px',
            fontSize: 13,
            maxWidth: 640,
          }}
        >
          <strong>TIER niedostępny.</strong>
          <p style={{ marginTop: 6 }}>{availability.reason}</p>
        </div>
      )}

      {result && (
        <div data-testid="siri-tier-result" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              fontSize: 12,
              border: '1px solid var(--c-border)',
              borderRadius: 10,
              padding: 12,
              background: 'var(--c-surface)',
            }}
          >
            <span data-testid="siri-tier-calculation-version">
              <strong>calculationVersion:</strong> {result.calculationVersion}
            </span>
            <span data-testid="siri-tier-planning-horizon">
              <strong>planningHorizon:</strong> {result.planningHorizon}
            </span>
            <span>
              <strong>wagi (cost/kpi/proximity):</strong> {result.weights.cost} / {result.weights.kpi} / {result.weights.proximity}
            </span>
            <span>
              <strong>parametersVersion:</strong> {result.parametersVersion}
            </span>
            <span>
              <strong>flaga SIRI_PM_V2:</strong> {flagOn ? 'ON' : 'OFF'} (URL ?flag={flagOn ? '1' : '0'})
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {result.focusByBlock.map((block) => (
              <div
                key={block.buildingBlock}
                data-testid={`siri-tier-focus-block-${block.buildingBlock}`}
                style={{ border: '1px solid var(--c-border)', borderRadius: 10, padding: 12 }}
              >
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--c-text-muted)' }}>
                  {BUILDING_BLOCK_LABEL[block.buildingBlock] ?? block.buildingBlock}
                </p>
                {block.focusAreaIds.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--c-warning)' }}>Brak focus dimension — nieoczekiwane.</p>
                ) : (
                  <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12 }}>
                    {block.focusAreaIds.map((id) => (
                      <li key={id}>{SIRI_PRIORITISATION_AREAS.find((a) => a.id === id)?.name ?? id}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
            Łącznie <strong data-testid="siri-tier-total-focus">{result.totalFocusCount}</strong> focus dimension(s) — ≥1 na
            każdy z 3 building blocks + 1 dodatkowy (Whitepaper Step 8).
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--c-text-muted)' }}>
                <th style={{ padding: '4px 8px' }}>#</th>
                <th style={{ padding: '4px 8px' }}>Wymiar (16D)</th>
                <th style={{ padding: '4px 8px' }}>Focus</th>
                <th style={{ padding: '4px 8px' }}>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {result.ranked.map((row) => (
                <tr
                  key={row.areaId}
                  style={{
                    borderTop: '1px solid var(--c-border-subtle)',
                    background: row.isFocus ? 'color-mix(in srgb, var(--c-info) 8%, transparent)' : undefined,
                  }}
                >
                  <td style={{ padding: '4px 8px' }}>{row.rank}</td>
                  <td style={{ padding: '4px 8px' }}>{row.areaName}</td>
                  <td style={{ padding: '4px 8px' }}>{row.isFocus ? 'SELECTED_FOCUS' : '—'}</td>
                  <td style={{ padding: '4px 8px', color: 'var(--c-text-secondary)' }}>{row.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Screen;
