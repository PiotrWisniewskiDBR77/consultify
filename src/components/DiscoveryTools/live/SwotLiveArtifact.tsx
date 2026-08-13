/**
 * Dynamic SWOT — LIVE Artifact.
 *
 * Renders the 2×2 strategic field straight off REAL session state and updates
 * as the user works — not a static demonstrator. It reuses the REAL engine
 * (`src/config/swot/swotTensionEngine.ts`) for every rule that decides what
 * appears, how it is weighed, and how items relate:
 *
 *  - `isAcceptedSwotItem`      → gate: only accepted items enter the field.
 *  - `deriveTensionCandidates` → SO/WO/ST/WT pairs, deterministic impact weight.
 *  - `computeTensionCoverage`  → which tension types are covered/missing.
 *  - `toEvidenceKind` (buildSwotOutput) → fact / observation / hypothesis,
 *    the SAME mapping the Output uses, so the live field and the eventual
 *    Output never disagree about what counts as a fact.
 *
 * The view adds NO pairing/classification logic of its own — SO/WO/ST/WT
 * relations, their weight, and the accepted/not-accepted gate all come from
 * the engine. The view only renders what the engine derived, plus a light
 * "conflict" annotation (an item pulled into more than one posture) computed
 * from the engine's own output, and local undo/redo over reclassification.
 *
 * KANON UI: `c-*` tokens only. Evidence kind uses signal colors
 * (c-success/warning/info) — impact weight is a plain number, never a
 * crimson/red badge (crimson stays reserved for critical/destructive state).
 */
import React from 'react';

import {
  deriveTensionCandidates,
  computeTensionCoverage,
  isAcceptedSwotItem,
  TENSION_TYPE_TO_POSTURE,
  type DerivedTensionCandidate,
  type SwotTensionType,
} from '@/config/swot/swotTensionEngine';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import type { SWOTItem } from '@/store/useToolStore';
import { toEvidenceKind } from '@/toolOutputs/buildSwotOutput';
import type { EvidenceKind } from '@/toolOutputs/types';

const IMPACT_WEIGHT: Record<SWOTItem['impact'], number> = { high: 3, medium: 2, low: 1 };

const QUADRANTS: Array<{ key: SWOTItem['quadrant']; pl: string }> = [
  { key: 'strengths', pl: 'Siły' },
  { key: 'weaknesses', pl: 'Słabości' },
  { key: 'opportunities', pl: 'Szanse' },
  { key: 'threats', pl: 'Zagrożenia' },
];

const EVIDENCE_LABEL_PL: Record<EvidenceKind, string> = {
  fact: 'fakt',
  observation: 'obserwacja',
  hypothesis: 'hipoteza',
};

/** Hipoteza NIGDY nie ma tonu faktu — trzy odrębne, jednoznaczne sygnały. */
const EVIDENCE_TONE: Record<EvidenceKind, string> = {
  fact: 'text-c-success',
  observation: 'text-c-info',
  hypothesis: 'text-c-warning',
};

const POSTURE_DOT: Record<string, string> = {
  attack: 'bg-c-tag-3',
  repair: 'bg-c-tag-5',
  defend: 'bg-c-tag-7',
  protect: 'bg-c-tag-9',
};

// ---------------------------------------------------------------------------
// Pure model — no React, fully unit-testable on its own.
// ---------------------------------------------------------------------------

export interface SwotLiveTension extends DerivedTensionCandidate {
  /** Stable id: deterministic from type + linked items (no random ids). */
  id: string;
  /** True when either linked item is pulled into more than one posture. */
  conflict: boolean;
}

export interface SwotFieldModel {
  /** Items that pass the engine's acceptance gate — these alone reach the field. */
  accepted: SWOTItem[];
  /** Items that do NOT pass the gate — shown outside the field, never in the Output. */
  pending: SWOTItem[];
  /** SO/WO/ST/WT relations, engine-derived, weight-sorted, conflict-annotated. */
  tensions: SwotLiveTension[];
  coverage: ReturnType<typeof computeTensionCoverage>;
}

function tensionId(c: DerivedTensionCandidate): string {
  return `${c.type}:${c.linkedItemIds.join(':')}`;
}

/**
 * An item is "in conflict" when the engine pulls it into more than one
 * posture (e.g. the same strength anchors both an SO/attack tension and an
 * ST/defend tension) — two different recommended stances contend for the
 * same resource. Deterministic, computed solely from engine output.
 */
function annotateConflicts(candidates: DerivedTensionCandidate[]): SwotLiveTension[] {
  const posturesByItem = new Map<string, Set<string>>();
  candidates.forEach((c) => {
    c.linkedItemIds.forEach((id) => {
      const set = posturesByItem.get(id) ?? new Set<string>();
      set.add(c.posture);
      posturesByItem.set(id, set);
    });
  });
  return candidates.map((c) => ({
    ...c,
    id: tensionId(c),
    conflict: c.linkedItemIds.some((id) => (posturesByItem.get(id)?.size ?? 0) > 1),
  }));
}

/**
 * Build the full field model from raw session items. Pure function of
 * `items` — same input always yields the same output (remount/reload-safe),
 * and this is exactly what the tests exercise without touching React.
 */
export function buildSwotFieldModel(items: SWOTItem[], maxTensionsPerType = 2): SwotFieldModel {
  const accepted = items.filter(isAcceptedSwotItem);
  const pending = items.filter((i) => !isAcceptedSwotItem(i));
  const candidates = deriveTensionCandidates(items, maxTensionsPerType);
  const tensions = annotateConflicts(candidates);
  const coverage = computeTensionCoverage(
    items,
    tensions.map((t) => ({ type: t.posture, proposalStatus: 'accepted' as const }))
  );
  return { accepted, pending, tensions, coverage };
}

function itemLabel(items: SWOTItem[], id: string): string {
  return items.find((i) => i.id === id)?.text ?? id;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
      {children}
    </div>
  );
}

function EvidenceBadge({ item }: { item: SWOTItem }) {
  const kind = toEvidenceKind(item);
  return (
    <span
      data-testid={`swot-evidence-${item.id}`}
      data-evidence-kind={kind}
      className={`shrink-0 text-[10px] uppercase tracking-[0.12em] ${EVIDENCE_TONE[kind]}`}
    >
      {EVIDENCE_LABEL_PL[kind]}
    </span>
  );
}

function ItemCard({
  item,
  onReclassify,
}: {
  item: SWOTItem;
  onReclassify: (itemId: string, quadrant: SWOTItem['quadrant']) => void;
}) {
  return (
    <li
      data-testid={`swot-item-${item.id}`}
      data-quadrant={item.quadrant}
      className="rounded-lg border border-c-border-subtle bg-c-surface p-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] leading-snug text-c-text">{item.text}</p>
        <EvidenceBadge item={item} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] tabular-nums text-c-text-muted">
          waga {IMPACT_WEIGHT[item.impact]}
        </span>
        <select
          aria-label={`Ćwiartka: ${item.text}`}
          data-testid={`swot-reclassify-${item.id}`}
          className="rounded border border-c-border-subtle bg-c-surface px-1.5 py-0.5 text-[11px] text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          value={item.quadrant}
          onChange={(e) => onReclassify(item.id, e.target.value as SWOTItem['quadrant'])}
        >
          {QUADRANTS.map((q) => (
            <option key={q.key} value={q.key}>
              {q.pl}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}

function TensionRow({ tension, items }: { tension: SwotLiveTension; items: SWOTItem[] }) {
  const posture = TENSION_TYPE_TO_POSTURE[tension.type];
  const [internalId, externalId] = tension.linkedItemIds;
  return (
    <li
      data-testid={`swot-tension-${tension.id}`}
      data-conflict={tension.conflict}
      className={`flex items-start gap-3 rounded-lg border p-2.5 ${
        tension.conflict
          ? 'border-c-warning bg-c-surface'
          : 'border-c-border-subtle bg-c-surface'
      }`}
    >
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${POSTURE_DOT[tension.posture] ?? 'bg-c-border-strong'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-c-text-muted">
            {tension.type}
          </span>
          <span className="text-[12px] text-c-text-secondary">{posture.titlePl}</span>
          {tension.conflict && (
            <span
              data-testid={`swot-conflict-badge-${tension.id}`}
              className="rounded-full border border-c-warning px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-c-warning"
            >
              Konflikt zasobu
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-c-text">
          {itemLabel(items, internalId)} <span className="text-c-text-muted">×</span>{' '}
          {itemLabel(items, externalId)}
        </p>
      </div>
      {/* Waga jest deterministyczna z silnika (impact 3/2/1 per pozycja) — nigdy z redakcji. */}
      <span
        data-testid={`swot-tension-weight-${tension.id}`}
        className="shrink-0 text-right text-[13px] tabular-nums text-c-text"
      >
        {tension.weight}
      </span>
    </li>
  );
}

export interface SwotLiveArtifactProps {
  /** Session items — the single source of truth this artifact renders live. */
  items: SWOTItem[];
  /**
   * Called after a local reclassification so the caller can persist it back
   * to the session/store (e.g. `useToolStore.updateSWOTItem`). Optional —
   * without it the artifact still updates locally (useful for the harness).
   */
  onItemChange?: (itemId: string, updates: Partial<SWOTItem>) => void;
  maxTensionsPerType?: number;
  className?: string;
}

/**
 * Live Dynamic SWOT field. Renders accepted items in their quadrant, engine
 * tensions between quadrants, and a tray of not-yet-accepted items that
 * explicitly do NOT enter the field/Output. Local undo/redo covers
 * reclassification so exploring "what if" is reversible.
 */
export function SwotLiveArtifact({
  items,
  onItemChange,
  maxTensionsPerType = 2,
  className = '',
}: SwotLiveArtifactProps) {
  const history = useUndoRedo<SWOTItem[]>(items);
  const current = history.current;

  const model = React.useMemo(
    () => buildSwotFieldModel(current, maxTensionsPerType),
    [current, maxTensionsPerType]
  );

  const handleReclassify = React.useCallback(
    (itemId: string, quadrant: SWOTItem['quadrant']) => {
      const next = current.map((i) => (i.id === itemId ? { ...i, quadrant } : i));
      history.push(next);
      onItemChange?.(itemId, { quadrant });
    },
    [current, history, onItemChange]
  );

  const missingTypes: SwotTensionType[] = model.coverage.missing;

  return (
    <div data-testid="swot-live-artifact" className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Pole strategiczne — na żywo</Eyebrow>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="swot-undo"
            aria-label="Cofnij"
            disabled={!history.canUndo}
            onClick={() => history.undo()}
            className="rounded border border-c-border-subtle px-2 py-1 text-[11px] text-c-text-secondary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            Cofnij
          </button>
          <button
            type="button"
            data-testid="swot-redo"
            aria-label="Ponów"
            disabled={!history.canRedo}
            onClick={() => history.redo()}
            className="rounded border border-c-border-subtle px-2 py-1 text-[11px] text-c-text-secondary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            Ponów
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-c-border-subtle bg-c-border-subtle">
        {QUADRANTS.map((q) => {
          const inQ = model.accepted.filter((i) => i.quadrant === q.key);
          return (
            <div
              key={q.key}
              data-testid={`swot-quadrant-${q.key}`}
              className="min-h-[120px] space-y-2 bg-c-surface p-3"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                {q.pl}
              </div>
              <ul className="space-y-1.5">
                {inQ.map((item) => (
                  <ItemCard key={item.id} item={item} onReclassify={handleReclassify} />
                ))}
                {inQ.length === 0 && <li className="text-[12px] text-c-text-muted">—</li>}
              </ul>
            </div>
          );
        })}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Eyebrow>Napięcia SO / WO / ST / WT</Eyebrow>
          {missingTypes.length > 0 && (
            <span className="text-[11px] text-c-text-muted">
              brakuje: {missingTypes.join(', ')}
            </span>
          )}
        </div>
        <ul className="space-y-1.5">
          {model.tensions.map((t) => (
            <TensionRow key={t.id} tension={t} items={model.accepted} />
          ))}
          {model.tensions.length === 0 && (
            <li className="text-[12px] text-c-text-muted">
              Brak napięć — potrzebne co najmniej dwie zaakceptowane pozycje w sąsiednich ćwiartkach.
            </li>
          )}
        </ul>
      </section>

      {model.pending.length > 0 && (
        <section
          data-testid="swot-pending-tray"
          className="rounded-lg border border-dashed border-c-border-subtle bg-c-surface p-3"
        >
          <Eyebrow>Poza polem — nie zaakceptowane (nie wchodzi do Output)</Eyebrow>
          <ul className="mt-2 space-y-1.5">
            {model.pending.map((item) => (
              <li
                key={item.id}
                data-testid={`swot-pending-${item.id}`}
                className="flex items-center justify-between gap-2 text-[12px] text-c-text-muted"
              >
                <span>{item.text}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.1em]">
                  {item.proposalStatus ?? item.status ?? 'brak statusu'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default SwotLiveArtifact;
