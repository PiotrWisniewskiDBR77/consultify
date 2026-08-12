/**
 * Step 7/7 — Export.
 *
 * ★ HONEST GAP: `server/src/routes/v8/finance-v2/valuation.routes.ts` (base SHA 9604652e27,
 * 21 endpoints, grep-verified) has NO export endpoint — `artifactType: 'REPORT_EXPORT'` exists
 * in the shared `FinanceArtifactType` enum, but nothing in the Valuation surface produces one.
 * This step states that plainly instead of wiring a button to nothing (or to a generic Finance
 * export mechanism that was never asked to be adapted for Valuation's shape) — reported as
 * EVIDENCE_MISSING in PKG_H_VALUATION_report.md, not silently hidden.
 */
import React from 'react';

export function ExportStep(): React.ReactElement {
  return (
    <div className="max-w-5xl space-y-3" data-testid="valuation-export-step">
      <h2 className="text-sm font-semibold text-c-text">Eksport</h2>
      <div className="rounded-xl border border-c-warning/30 bg-c-warning/10 p-4" data-testid="export-not-available">
        <p className="text-sm font-medium text-c-text">Eksport wyceny nie jest dziś dostępny</p>
        <p className="mt-1 text-xs text-c-text-muted">
          Pakiet B3 (`valuation.routes.ts`, baza 9604652e27) nie udostępnia żadnego endpointu eksportu dla wyceny —
          `REPORT_EXPORT` istnieje jako typ artefaktu w kontrakcie ogólnym, ale nic w powierzchni Valuation go dziś
          nie produkuje. Ten krok jest celowo uczciwym placeholderem, nie podpiętym pod nieistniejące API.
        </p>
      </div>
    </div>
  );
}

export default ExportStep;
