/**
 * Dev-render story: wave4-choices-crimson.
 *
 * PRZED/PO dowod dla naprawy nadużyć bg-c-accent (pełny crimson jako CTA /
 * stan wybrany) w module Assessment/Initiatives/Execution/Results/Decisions
 * (CLAUDE.md UI-rule #3: primary=crimson TYLKO semantyka krytyczna).
 *
 * 3 reprezentatywne wzorce z realnych plików (dokładne klasy skopiowane
 * 1:1 z produkcyjnego kodu przed/po edycji, nie re-interpretacja):
 *   A) Selected-option checkbox-circle (GenerateInitiativesModal.tsx /
 *      NewReportModal.tsx) — PRZED bg-c-accent border-c-accent,
 *      PO bg-c-text border-c-accent (border zostaje, wypełnienie neutralne).
 *   B) Toggle-tab selector (SIRIAssessmentEditor.tsx / ADMAAssessmentEditor.tsx
 *      viewMode tabs oraz level-selector) — PRZED bg-c-accent text-white,
 *      PO bg-c-text text-c-surface.
 *   C) Filled CTA button (InitiativesHub.tsx / DecisionsHub.tsx /
 *      M14HandoffInbox.tsx) — PRZED bg-c-accent text-white,
 *      PO bg-c-text text-c-surface.
 *
 * Renderuje statyczny mock (bez importu ciężkich modułowych komponentów,
 * żeby uniknąć wciągania całego drzewa zależności Hub-ów) — same klasy/DOM
 * skopiowane z prawdziwych miejsc, więc zrzut wiernie pokazuje realny wygląd.
 */
import { CheckCircle2 } from 'lucide-react';
import React from 'react';

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-8">
      <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted mb-2">
        {label}
      </div>
      <div className="flex items-center gap-6">{children}</div>
    </div>
  );
}

function Frame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-c-border-subtle bg-c-surface p-4">
      <div className="text-[11px] font-medium text-c-text-muted mb-3">{label}</div>
      {children}
    </div>
  );
}

export function Wave4ChoicesCrimsonScreen(): React.ReactElement {
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
      <h1 className="text-lg font-semibold text-c-text mb-1">
        Fala 4 — bg-c-accent CTA/wybor → neutralne
      </h1>
      <p className="text-sm text-c-text-muted mb-8">
        Assessment (SIRI/ADMA/modals) · Initiatives · Execution · Results · Decisions. Kolory PO =
        dokładne klasy wprowadzone w commicie.
      </p>

      {/* A) Selected-option checkbox-circle */}
      <Row label="A · Selected-option (checkbox-circle w karcie wyboru — GenerateInitiativesModal/NewReportModal)">
        <Frame label="PRZED — bg-c-accent border-c-accent (crimson fill)">
          <div
            className="w-full text-left p-3 rounded-lg border-2 border-c-accent bg-c-accent-soft"
            style={{ width: 220 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center border-2 bg-c-accent border-c-accent">
                <CheckCircle2 size={12} className="text-white" />
              </div>
              <p className="font-medium text-c-text text-sm">DBR77 Assessment</p>
            </div>
          </div>
        </Frame>
        <Frame label="PO — bg-c-text border-c-accent (neutralne wypełnienie)">
          <div
            className="w-full text-left p-3 rounded-lg border-2 border-c-accent bg-c-accent-soft"
            style={{ width: 220 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center border-2 bg-c-text border-c-accent">
                <CheckCircle2 size={12} className="text-c-surface" />
              </div>
              <p className="font-medium text-c-text text-sm">DBR77 Assessment</p>
            </div>
          </div>
        </Frame>
      </Row>

      {/* B) Toggle-tab / level selector */}
      <Row label="B · Toggle-tab selector (viewMode tabs + level-selector — SIRI/ADMA AssessmentEditor)">
        <Frame label="PRZED — bg-c-accent text-white">
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-c-accent text-white">
              Wymiary
            </button>
            <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-c-surface-raised text-c-text-secondary">
              Priorytetyzacja
            </button>
            <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-c-surface-raised text-c-text-secondary">
              Macierz
            </button>
          </div>
        </Frame>
        <Frame label="PO — bg-c-text text-c-surface">
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-c-text text-c-surface">
              Wymiary
            </button>
            <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-c-surface-raised text-c-text-secondary">
              Priorytetyzacja
            </button>
            <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-c-surface-raised text-c-text-secondary">
              Macierz
            </button>
          </div>
        </Frame>
      </Row>

      {/* C) Filled CTA button */}
      <Row label="C · Filled CTA (InitiativesHub „Create”/„Apply changes”, DecisionsHub „New Decision”, M14HandoffInbox „Promote”)">
        <Frame label="PRZED — bg-c-accent text-white">
          <button className="px-4 py-2 text-sm text-white bg-c-accent hover:opacity-90 rounded-lg">
            Utwórz inicjatywę
          </button>
        </Frame>
        <Frame label="PO — bg-c-text text-c-surface">
          <button className="px-4 py-2 text-sm text-c-surface bg-c-text hover:opacity-90 rounded-lg">
            Utwórz inicjatywę
          </button>
        </Frame>
      </Row>

      {/* D) Status-semantic reinterpretation (ConclusionSummary gap bar) */}
      <Row label="D · Status-semantic (ConclusionSummary — pasek „poniżej progu FoF”: accent→warning, spójne z tekstem)">
        <Frame label="PRZED — bg-c-accent (mylące, tekst obok już używał text-c-warning)">
          <div
            className="relative h-2.5 rounded-full bg-c-border-subtle overflow-hidden"
            style={{ width: 220 }}
          >
            <div className="h-full rounded-full bg-c-accent" style={{ width: '58%' }} />
          </div>
        </Frame>
        <Frame label="PO — bg-c-warning (spójne z text-c-warning tej samej kondycji)">
          <div
            className="relative h-2.5 rounded-full bg-c-border-subtle overflow-hidden"
            style={{ width: 220 }}
          >
            <div className="h-full rounded-full bg-c-warning" style={{ width: '58%' }} />
          </div>
        </Frame>
      </Row>
    </div>
  );
}

export default Wave4ChoicesCrimsonScreen;
