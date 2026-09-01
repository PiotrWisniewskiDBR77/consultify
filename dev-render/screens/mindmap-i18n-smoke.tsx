/**
 * Smoke i18n fala 2 — M06 Mind Map: realne modale (AssignPerson / AttachArtifact /
 * AddEvidence) po sweepie isPl -> t() (ideas.mindmap.*). Harness-only; renderuje
 * komponenty produkcyjne z mock-callbackami, PL/EN przez &lang=.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ★ 2026-09-01 — ROZDZIELONE na `?variant=` (audyt przyrządu, Kategoria 3).
 *
 * Ten ekran wcześniej montował WSZYSTKIE TRZY modale naraz w tym samym
 * DOM-ie. Każdy z nich jest `fixed` (patrz `AssignPersonModal` /
 * `AttachArtifactModal` / `AddEvidenceModal` — overlay `fixed inset-0`),
 * więc wizualnie widać było TYLKO JEDEN (ostatni zamontowany, najwyższy
 * z-index) — właściciel oceniał pozostałe dwa "w ciemno", nigdy ich
 * nie widząc. Teraz każdy modal jest osobnym stanem wybieranym
 * `?variant=` — jeden montaż na raz, dający się sfotografować osobno
 * (wzór: `prezentacje-template-states.tsx`).
 *
 * URL: ?screen=mindmap-i18n-smoke&variant=assign|attach|evidence (domyślnie
 *      "assign") [&lang=pl|en][&theme=light|dark]
 * ─────────────────────────────────────────────────────────────────────────
 */
import React from 'react';

import { AddEvidenceModal } from '../../src/components/MyWork/mindmap/AddEvidenceModal';
import { AssignPersonModal } from '../../src/components/MyWork/mindmap/AssignPersonModal';
import { AttachArtifactModal } from '../../src/components/MyWork/mindmap/AttachArtifactModal';

const noop = () => undefined;

type Variant = 'assign' | 'attach' | 'evidence';

const VARIANT_LABELS: Record<Variant, string> = {
  assign: 'AssignPersonModal',
  attach: 'AttachArtifactModal',
  evidence: 'AddEvidenceModal',
};

function readVariant(): Variant {
  const raw = new URLSearchParams(window.location.search).get('variant');
  if (raw === 'attach' || raw === 'evidence') return raw;
  return 'assign';
}

const MindmapI18nSmokeScreen: React.FC = () => {
  const variant = readVariant();

  return (
    <div className="min-h-screen bg-c-surface p-6 text-c-text">
      <h1 className="mb-4 text-lg font-semibold" data-dev-render-chrome="">
        M06 Mind Map — {VARIANT_LABELS[variant]} po sweepie i18n (ideas.mindmap.*)
      </h1>
      {variant === 'assign' && (
        <AssignPersonModal open onClose={noop} onAssign={noop} recentAssignees={['Alice', 'Bob']} />
      )}
      {variant === 'attach' && <AttachArtifactModal open onClose={noop} onAttach={noop} />}
      {variant === 'evidence' && <AddEvidenceModal open onClose={noop} onAdd={noop} />}
    </div>
  );
};

export default MindmapI18nSmokeScreen;
