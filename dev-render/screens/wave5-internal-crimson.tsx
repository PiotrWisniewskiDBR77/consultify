/**
 * Dev-render dowod dla FALI "wave5-internal-crimson" — naprawa nadużyć bg-c-accent
 * (pełne crimson tło jako CTA/toggle/selected-tab) w Studio + SuperAdmin + auth/Onboarding/invite.
 *
 * Renderuje REALNE komponenty (StudioExportModal, StudioLinkModal) z mock-propsami,
 * bez logowania/store/API. Dowodzi: CTA = neutralne (bg-c-text text-c-surface),
 * toggle ON = bg-navy-900 (lokalny wzorzec), selected = neutralny fill + ring-c-focus.
 *
 * Motyw/lang z URL (?theme=light|dark).
 */
import React from 'react';

import { StudioExportModal } from '../../src/components/Studio/StudioExportModal';
import { StudioLinkModal } from '../../src/components/Studio/StudioLinkModal';

export default function Wave5InternalCrimsonScreen(): React.ReactElement {
  const [showExport, setShowExport] = React.useState(true);
  const [showLink, setShowLink] = React.useState(false);

  return (
    <div className="min-h-screen" style={{ background: 'var(--c-bg)' }}>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold text-c-text">
          wave5-internal-crimson — Studio: eksport (CTA + toggle + selected-tab)
        </h1>
        <p className="text-xs text-c-text-muted mt-1">
          PRZED: przyciski/toggle/selektor "1x/2x/3x" mialy pelne crimson tlo (bg-c-accent). PO: CTA
          = bg-c-text/text-c-surface, toggle ON = bg-navy-900, selected = neutralny fill +
          ring-c-focus. Czerwien tylko w tokenach *-soft (ikony), zero pelnego tla.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            className="px-3 py-1.5 text-xs rounded-lg border border-c-border-subtle bg-c-surface text-c-text hover:bg-c-surface-raised"
            onClick={() => {
              setShowExport(true);
              setShowLink(false);
            }}
          >
            Pokaz Export Modal
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-lg border border-c-border-subtle bg-c-surface text-c-text hover:bg-c-surface-raised"
            onClick={() => {
              setShowLink(true);
              setShowExport(false);
            }}
          >
            Pokaz Link Modal
          </button>
        </div>
      </div>

      {showExport && (
        <StudioExportModal
          documentId="doc-mock-1"
          documentName="Mapa procesu — Onboarding klienta"
          onClose={() => setShowExport(false)}
        />
      )}

      {showLink && (
        <StudioLinkModal
          documentId="doc-mock-1"
          documentName="Mapa procesu — Onboarding klienta"
          onClose={() => setShowLink(false)}
        />
      )}
    </div>
  );
}
