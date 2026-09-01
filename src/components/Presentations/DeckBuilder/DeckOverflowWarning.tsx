import { AlertTriangle } from 'lucide-react';
import React from 'react';

import type { PresentationOverflowWarning } from '@/services/presentationExport';

interface DeckOverflowWarningProps {
  warnings: PresentationOverflowWarning[];
  onJumpToSlide: (slideIndex: number) => void;
  onContinueExport: () => void;
  onCancel: () => void;
}

function slideCountLabel(count: number): string {
  if (count === 1) return '1 slajd ma';
  const lastTwo = count % 100;
  const last = count % 10;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
    return `${count} slajdy mają`;
  }
  return `${count} slajdów ma`;
}

export function DeckOverflowWarning({
  warnings,
  onJumpToSlide,
  onContinueExport,
  onCancel,
}: DeckOverflowWarningProps) {
  if (warnings.length === 0) return null;
  const first = warnings[0];

  return (
    <div
      role="status"
      className="mx-4 mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-c-warning/40 bg-c-warning/10 px-4 py-3 text-c-text"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-c-warning" aria-hidden="true" />
      <p className="min-w-[18rem] flex-1 text-sm">
        <strong>{slideCountLabel(warnings.length)} treść, która się nie mieści.</strong> Układ może
        się rozjechać po eksporcie do PowerPointa i Google Slides.
      </p>
      <button
        type="button"
        className="rounded-md border border-c-border px-3 py-1.5 text-sm font-medium hover:bg-c-surface-hover"
        onClick={() => onJumpToSlide(first.slideIndex)}
      >
        Przejdź do slajdu {first.slideIndex}
      </button>
      <button
        type="button"
        className="rounded-md bg-c-text px-3 py-1.5 text-sm font-medium text-c-surface"
        onClick={onContinueExport}
      >
        Eksportuj mimo ostrzeżenia
      </button>
      <button type="button" className="text-sm text-c-text-secondary" onClick={onCancel}>
        Anuluj
      </button>
    </div>
  );
}
