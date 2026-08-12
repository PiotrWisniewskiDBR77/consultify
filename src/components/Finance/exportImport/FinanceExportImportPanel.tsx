/**
 * FinanceExportImportPanel — Pakiet AP-CLIENT (Gate J), priorytet #5.
 *
 * Samodzielny panel Export/Import `.xlsx`: eksport z manifestem (wersja/
 * jednostka/źródło) pobieranym jako plik przeglądarki; import trzystopniowy
 * (parse .xlsx → PODGLĄD RÓŻNIC read-only → zastosowanie transakcyjne,
 * wszystko-albo-nic — przycisk „Zastosuj" jest zablokowany, dopóki podgląd
 * nie zwróci `ok:true`, i serwer sam odrzuca częściowe zastosowanie
 * WORKING_REVISION_CONFLICT/VALIDATION_FAILED/STATE_PRECONDITION_FAILED).
 *
 * NIE montowany w żadnym workspace produkcyjnym w tym pakiecie — dev-render
 * only, do akceptu Piotra na zrzutach (CLAUDE.md #7).
 *
 * Za flagą `financeExportImportV1` (default OFF): przy `enabled=false`
 * renderuje `null` PRZED jakimkolwiek wywołaniem sieciowym.
 */
import React, { useState } from 'react';

import { useFinanceExportImportFlag } from '@/hooks/useFinanceExportImportFlag';
import {
  applyFinanceImport,
  exportFinanceStatementPackXlsx,
  parseFinanceImportXlsx,
  previewFinanceImport,
} from '@/services/api/financeV2.api';
import { describeFinanceV2Error, type FinanceExcelManifestDto, type FinanceImportPreviewDto, type FinanceImportRawRow } from '@/services/api/financeV2.types';

export interface FinanceExportImportPanelProps {
  artifactId: string;
  businessVersionId: string;
  /** CAS pin dla `apply` — host (workspace) zna bieżącą `working_revision_id` swojego artefaktu. */
  expectedWorkingRevisionId: string;
  className?: string;
}

type ExportState = { kind: 'idle' } | { kind: 'exporting' } | { kind: 'exported'; manifest: FinanceExcelManifestDto } | { kind: 'error'; title: string; detail: string };

type ImportState =
  | { kind: 'idle' }
  | { kind: 'parsing' }
  | { kind: 'parsed'; manifest: FinanceExcelManifestDto | null; manifestIssues: string[]; rows: FinanceImportRawRow[] }
  | { kind: 'previewing' }
  | { kind: 'previewed'; manifest: FinanceExcelManifestDto; rows: FinanceImportRawRow[]; preview: FinanceImportPreviewDto }
  | { kind: 'applying' }
  | { kind: 'applied'; appliedCount: { added: number; changed: number; cleared: number }; newWorkingRevisionId: string }
  | { kind: 'error'; title: string; detail: string };

export function FinanceExportImportPanel({
  artifactId,
  businessVersionId,
  expectedWorkingRevisionId,
  className,
}: FinanceExportImportPanelProps): React.ReactElement | null {
  const { enabled } = useFinanceExportImportFlag();
  const [exportState, setExportState] = useState<ExportState>({ kind: 'idle' });
  const [importState, setImportState] = useState<ImportState>({ kind: 'idle' });

  if (!enabled) return null;

  async function handleExport() {
    setExportState({ kind: 'exporting' });
    try {
      const result = await exportFinanceStatementPackXlsx(artifactId, businessVersionId);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportState({ kind: 'exported', manifest: result.manifest });
    } catch (err) {
      setExportState({ kind: 'error', ...describeFinanceV2Error(err) });
    }
  }

  async function handleFileSelected(file: File) {
    setImportState({ kind: 'parsing' });
    try {
      const parsed = await parseFinanceImportXlsx(file, file.name);
      setImportState({ kind: 'parsed', manifest: parsed.manifest, manifestIssues: parsed.manifestIssues, rows: parsed.rows });
    } catch (err) {
      setImportState({ kind: 'error', ...describeFinanceV2Error(err) });
    }
  }

  async function handlePreview() {
    if (importState.kind !== 'parsed' || !importState.manifest) return;
    const { manifest, rows } = importState;
    setImportState({ kind: 'previewing' });
    try {
      const preview = await previewFinanceImport({ artifactId, businessVersionId, manifest, rows });
      setImportState({ kind: 'previewed', manifest, rows, preview });
    } catch (err) {
      setImportState({ kind: 'error', ...describeFinanceV2Error(err) });
    }
  }

  async function handleApply() {
    if (importState.kind !== 'previewed' || !importState.preview.ok) return;
    const { manifest, rows } = importState;
    setImportState({ kind: 'applying' });
    try {
      const batchIdempotencyKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const result = await applyFinanceImport({
        artifactId,
        businessVersionId,
        expectedWorkingRevisionId,
        manifest,
        rows,
        batchIdempotencyKey,
      });
      setImportState({ kind: 'applied', appliedCount: result.appliedCount, newWorkingRevisionId: result.newWorkingRevisionId });
    } catch (err) {
      setImportState({ kind: 'error', ...describeFinanceV2Error(err) });
    }
  }

  return (
    <div className={`flex flex-col gap-4 rounded-lg border border-c-border-subtle bg-c-surface p-3 ${className ?? ''}`} data-testid="finance-export-import-panel">
      <div className="flex flex-col gap-1.5" data-testid="export-section">
        <p className="text-xs font-semibold text-c-text-secondary">Eksport (.xlsx)</p>
        <button
          type="button"
          disabled={exportState.kind === 'exporting'}
          className="w-fit rounded-md border border-c-border-subtle bg-c-surface-raised px-2.5 py-1.5 text-xs font-medium text-c-text-primary hover:bg-c-surface disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          onClick={handleExport}
          data-testid="export-button"
        >
          {exportState.kind === 'exporting' ? 'Eksportuję…' : 'Eksportuj .xlsx'}
        </button>
        {exportState.kind === 'exported' ? (
          <p className="text-[11px] text-c-text-secondary" data-testid="export-manifest-summary">
            Wersja v{exportState.manifest.businessVersionNo} · jednostka {exportState.manifest.defaultUnit} · źródło {exportState.manifest.source}
          </p>
        ) : null}
        {exportState.kind === 'error' ? (
          <p className="text-xs text-c-danger" data-testid="export-error">
            {exportState.title}: {exportState.detail}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2" data-testid="import-section">
        <p className="text-xs font-semibold text-c-text-secondary">Import (.xlsx) — transakcyjny, wszystko-albo-nic</p>
        <input
          type="file"
          accept=".xlsx"
          data-testid="import-file-input"
          className="text-xs text-c-text-secondary file:mr-2 file:rounded-md file:border file:border-c-border-subtle file:bg-c-surface-raised file:px-2 file:py-1 file:text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        />

        {importState.kind === 'parsing' ? <p className="text-xs text-c-text-secondary">Wczytuję plik…</p> : null}

        {importState.kind === 'parsed' ? (
          <div className="flex flex-col gap-1.5" data-testid="import-parsed">
            {importState.manifestIssues.length > 0 ? (
              <p className="text-xs text-c-danger">Manifest: {importState.manifestIssues.join('; ')}</p>
            ) : (
              <p className="text-xs text-c-text-secondary">Wczytano {importState.rows.length} wierszy. Manifest OK.</p>
            )}
            <button
              type="button"
              disabled={!importState.manifest}
              className="w-fit rounded-md border border-c-border-subtle bg-c-surface-raised px-2.5 py-1.5 text-xs font-medium text-c-text-primary hover:bg-c-surface disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              onClick={handlePreview}
              data-testid="import-preview-button"
            >
              Podgląd różnic
            </button>
          </div>
        ) : null}

        {importState.kind === 'previewing' ? <p className="text-xs text-c-text-secondary">Liczę podgląd różnic…</p> : null}

        {importState.kind === 'previewed' ? (
          <div className="flex flex-col gap-2" data-testid="import-preview">
            <div className="grid grid-cols-4 gap-2 text-xs">
              <SummaryTile label="Dodane" value={importState.preview.diff.toAdd.length} />
              <SummaryTile label="Zmienione" value={importState.preview.diff.toChange.length} />
              <SummaryTile label="Wyczyszczone" value={importState.preview.diff.toClear.length} />
              <SummaryTile label="Bez zmian" value={importState.preview.diff.unchangedCount} />
            </div>
            {importState.preview.rowErrors.length > 0 ? (
              <div className="rounded-md border border-c-danger/40 bg-c-danger/10 p-2 text-xs text-c-danger" data-testid="import-row-errors">
                {importState.preview.rowErrors.length} błędów wierszy — import zablokowany, dopóki nie zostaną naprawione.
              </div>
            ) : null}
            {!importState.preview.manifestCheck.ok ? (
              <div className="rounded-md border border-c-danger/40 bg-c-danger/10 p-2 text-xs text-c-danger" data-testid="import-manifest-check-issues">
                {importState.preview.manifestCheck.issues.join('; ')}
              </div>
            ) : null}
            <button
              type="button"
              disabled={!importState.preview.ok}
              className="w-fit rounded-md border border-c-border-subtle bg-c-surface-raised px-2.5 py-1.5 text-xs font-medium text-c-text-primary hover:bg-c-surface disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              onClick={handleApply}
              data-testid="import-apply-button"
              title={importState.preview.ok ? undefined : 'Zastosowanie zablokowane — napraw błędy powyżej (wszystko-albo-nic)'}
            >
              Zastosuj (transakcyjnie)
            </button>
          </div>
        ) : null}

        {importState.kind === 'applying' ? <p className="text-xs text-c-text-secondary">Zapisuję…</p> : null}

        {importState.kind === 'applied' ? (
          <div className="rounded-md border border-c-border-subtle bg-c-surface-raised p-2 text-xs text-c-text-primary" data-testid="import-applied">
            Zastosowano: dodane {importState.appliedCount.added}, zmienione {importState.appliedCount.changed}, wyczyszczone{' '}
            {importState.appliedCount.cleared}. Nowa robocza rewizja: {importState.newWorkingRevisionId}.
          </div>
        ) : null}

        {importState.kind === 'error' ? (
          <div className="rounded-md border border-c-danger/40 bg-c-danger/10 p-2 text-xs text-c-danger" data-testid="import-error">
            <p className="font-medium">{importState.title}</p>
            <p>{importState.detail}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="rounded-md border border-c-border-subtle bg-c-surface-raised px-2 py-1.5">
      <p className="text-[11px] text-c-text-secondary">{label}</p>
      <p className="text-sm font-semibold text-c-text-primary">{value}</p>
    </div>
  );
}

export default FinanceExportImportPanel;
