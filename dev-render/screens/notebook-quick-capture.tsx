/**
 * Dev-render host for #12a follow-up: verify the "Wrzuć" (Capture) CTA in
 * NotebookQuickCapture no longer renders as a full crimson fill.
 *
 * Mounts the REAL production component (no mock wrapper) — the button never
 * fires a real submit in this screenshot-only harness since no click happens.
 */
import React from 'react';

import { NotebookQuickCapture } from '../../src/components/MyWork/notebook/NotebookQuickCapture';

export default function NotebookQuickCaptureScreen(): React.ReactElement {
  return (
    <div className="flex h-full w-full items-start justify-center bg-c-bg p-10">
      <div className="w-full max-w-[560px] rounded-2xl border border-c-border-subtle bg-c-surface p-6 shadow-sm">
        <h1 className="mb-4 text-sm font-semibold text-c-text">
          Notatnik — pasek szybkiego wrzucania (#12a)
        </h1>
        <NotebookQuickCapture />
        <p className="mt-3 text-xs text-c-text-muted">
          Wpisz dowolny tekst, aby zobaczyć przycisk „Wrzuć" w stanie aktywnym
          (bez klikania — brak realnego zapisu w tym harnessie).
        </p>
      </div>
    </div>
  );
}
