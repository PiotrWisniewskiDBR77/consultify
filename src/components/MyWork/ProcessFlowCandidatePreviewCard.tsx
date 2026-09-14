/**
 * ProcessFlowCandidatePreviewCard — wynik kliknięcia „Przejrzyj kandydaturę".
 *
 * P-T14 (pilotaż Tomka, DEC-496 pkt XIV): „przycisk «Przejrzyj kandydaturę»
 * nic nie robi" + „nadmiar UI w Process Flow".
 *
 * ZMIERZONA PREMISA (przed zmianą): klik ZAWSZE wołał realną trasę
 * `GET /my-work/my-ideas/:id/map/candidate/preview`
 * (`server/src/routes/my-work.routes.ts:4719` — trasa istnieje, to nie fantom),
 * ale efekt na ekranie był bezimiennym blokiem telemetrii wewnątrz sekcji
 * „Akcje" prawego panelu:
 *     3 nodes · 2 edges · v7
 *     Start → Weryfikacja → Akcept
 *     Sprzedaż, Operacje
 *     a91f3c0b12de…
 * Bez nagłówka, bez zdania po ludzku, bez wskazania co dalej. Konsultant czyta
 * to albo jako „nic się nie stało", albo jako debug, który nie powinien być na
 * ekranie — stąd DWIE uwagi Tomka o tym samym bloku.
 *
 * Zmiana: nazwany blok, jedno zdanie, jawny stan pusty. `projectionHash`
 * pozostaje w stanie warsztatu (jest kontraktem `approve` — patrz
 * `handleApproveProcessFlowCandidate`), ale znika Z EKRANU: użytkownik nie ma
 * co zrobić z 12 znakami sha256.
 *
 * Wydzielone z `IdeaMapWorkspace.tsx` wyłącznie po to, żeby dało się to
 * odebrać testem komponentu — warsztat to ~5 tys. linii z płótnem, WS i
 * portalami i nie renderuje się w jsdom.
 */
import React from 'react';

export interface ProcessFlowCandidatePreview {
  nodeCount?: number | string | null;
  edgeCount?: number | string | null;
  mapVersion?: number | string | null;
  projectionHash?: string | null;
}

export interface ProcessFlowCandidatePreviewCardProps {
  preview: ProcessFlowCandidatePreview;
  isPolish: boolean;
  onCancel: () => void;
}

/** Liczba kroków w podglądzie — jedyna wartość, od której zależy stan pusty. */
export function processFlowCandidateNodeCount(preview: ProcessFlowCandidatePreview): number {
  const raw = Number(preview?.nodeCount);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export const ProcessFlowCandidatePreviewCard: React.FC<ProcessFlowCandidatePreviewCardProps> = ({
  preview,
  isPolish,
  onCancel,
}) => {
  const nodeCount = processFlowCandidateNodeCount(preview);
  const rawEdges = Number(preview?.edgeCount);
  const edgeCount = Number.isFinite(rawEdges) && rawEdges > 0 ? rawEdges : 0;

  return (
    <div
      data-testid="process-flow-candidate-preview"
      className="max-w-xs rounded-lg border border-c-border bg-c-surface p-2 text-xs text-c-text-secondary"
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-c-text-muted">
        {isPolish ? 'Kandydat inicjatywy — podgląd' : 'Initiative candidate — preview'}
      </div>
      {nodeCount > 0 ? (
        <p className="mt-1 text-c-text" data-testid="process-flow-candidate-preview-summary">
          {isPolish
            ? `Z tego Process Flow powstanie kandydat inicjatywy: ${nodeCount} kroków, ${edgeCount} połączeń.`
            : `This Process Flow will become an initiative candidate: ${nodeCount} steps, ${edgeCount} connections.`}
        </p>
      ) : (
        <p className="mt-1 text-c-text" data-testid="process-flow-candidate-preview-empty">
          {isPolish
            ? 'Ten Process Flow jest pusty — dodaj kroki, zanim utworzysz kandydata.'
            : 'This Process Flow is empty — add steps before creating a candidate.'}
        </p>
      )}
      <button type="button" onClick={onCancel} className="mt-1 underline">
        {isPolish ? 'Anuluj' : 'Cancel'}
      </button>
    </div>
  );
};

export default ProcessFlowCandidatePreviewCard;
