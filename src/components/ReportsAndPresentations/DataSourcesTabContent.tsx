/**
 * M17/T4.3 — tab „Dane" (źródła danych materiału).
 *
 * Ożywia martwą-w-FE warstwę danych Materiałów (`src/services/materialData.ts`,
 * realny backend W5.1/W5.2 pod /deliverables/generations/data/*). Dwa tryby:
 *   • Połącz źródło  — wybierz konektor (postgres/airtable/jira/sheets/csv/webhook),
 *     podaj konfigurację, zrób podgląd pierwszych wierszy.
 *   • Zbierz przez formularz — wciągnij zgłoszenia formularza intake jako dataset.
 * Fail-soft: serwis zwraca pustą/null wartość zamiast rzucać → UI pokazuje stan pusty.
 *
 * PL-first (wzorzec jak M14HandoffInbox); EN i18n = dług Fazy 4.
 */
import { Database, Download, Eye, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import {
  fetchFormDataset,
  listConnectorTypes,
  previewConnector,
  type MaterialDataset,
} from '@/services/materialData';

const CONNECTOR_LABEL: Record<string, string> = {
  postgres: 'PostgreSQL',
  airtable: 'Airtable',
  jira: 'Jira',
  sheets: 'Google Sheets',
  csv: 'CSV / XLSX',
  webhook: 'Webhook',
};

function DatasetTable({ dataset }: { dataset: MaterialDataset }): React.ReactElement {
  const cols = dataset.columns ?? [];
  const rows = dataset.rows ?? [];
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
        <span>
          {dataset.rowCount} wierszy · {cols.length} kolumn · źródło: {dataset.source?.kind}
        </span>
        {dataset.truncated && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            podgląd skrócony
          </span>
        )}
      </div>
      <div className="max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-navy-700">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-gray-50 dark:bg-navy-800">
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold text-gray-700 dark:border-navy-700 dark:text-slate-200"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50/50 dark:odd:bg-navy-900 dark:even:bg-navy-800/40">
                {cols.map((c) => (
                  <td
                    key={c}
                    className="whitespace-nowrap border-b border-gray-100 px-3 py-1.5 text-gray-600 dark:border-navy-800 dark:text-slate-300"
                  >
                    {String(row?.[c] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const DataSourcesTabContent: React.FC = () => {
  const [types, setTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [config, setConfig] = useState<string>('{\n  \n}');
  const [connectorBusy, setConnectorBusy] = useState(false);
  const [connectorError, setConnectorError] = useState<string | null>(null);
  const [connectorData, setConnectorData] = useState<MaterialDataset | null>(null);

  const [formId, setFormId] = useState<string>('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<MaterialDataset | null>(null);

  useEffect(() => {
    let alive = true;
    void listConnectorTypes().then((t) => {
      if (!alive) return;
      setTypes(t);
      setSelectedType((prev) => prev || t[0] || '');
    });
    return () => {
      alive = false;
    };
  }, []);

  const runPreview = useCallback(async () => {
    if (!selectedType) return;
    setConnectorBusy(true);
    setConnectorError(null);
    setConnectorData(null);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = config.trim() ? (JSON.parse(config) as Record<string, unknown>) : {};
    } catch {
      setConnectorError('Konfiguracja musi być poprawnym JSON-em.');
      setConnectorBusy(false);
      return;
    }
    const ds = await previewConnector(selectedType, parsed);
    if (ds) setConnectorData(ds);
    else setConnectorError('Nie udało się pobrać podglądu — sprawdź konfigurację źródła.');
    setConnectorBusy(false);
  }, [selectedType, config]);

  const runForm = useCallback(async () => {
    if (!formId.trim()) return;
    setFormBusy(true);
    setFormError(null);
    setFormData(null);
    const ds = await fetchFormDataset(formId.trim());
    if (ds) setFormData(ds);
    else setFormError('Brak zgłoszeń lub nie znaleziono formularza o tym ID.');
    setFormBusy(false);
  }, [formId]);

  return (
    <div className="h-full overflow-auto p-4" data-testid="rap-data-tab">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="flex items-center gap-2">
          <Database size={18} className="text-gray-500" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              Źródła danych materiału
            </h2>
            <p className="text-xs text-gray-400">
              Podłącz dane do generowanych materiałów — z konektora albo z formularza intake.
            </p>
          </div>
        </header>

        {/* Połącz źródło */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
            Połącz źródło
          </h3>
          {types.length === 0 ? (
            <p className="text-xs text-gray-400" data-testid="rap-data-no-connectors">
              Brak dostępnych konektorów (warstwa danych wyłączona lub bez rejestru).
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-gray-500">Konektor:</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  data-testid="rap-data-connector-select"
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-200"
                >
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {CONNECTOR_LABEL[t] ?? t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void runPreview()}
                  disabled={connectorBusy || !selectedType}
                  data-testid="rap-data-preview-btn"
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  {connectorBusy ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                  Podgląd danych
                </button>
              </div>
              <label className="mt-2 block text-xs text-gray-500">Konfiguracja (JSON):</label>
              <textarea
                value={config}
                onChange={(e) => setConfig(e.target.value)}
                spellCheck={false}
                rows={4}
                data-testid="rap-data-config"
                className="mt-1 w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-800 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-200"
              />
              {connectorError && (
                <p className="mt-2 text-xs text-amber-600" data-testid="rap-data-connector-error">
                  {connectorError}
                </p>
              )}
              {connectorData && <DatasetTable dataset={connectorData} />}
            </>
          )}
        </section>

        {/* Zbierz przez formularz */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
            Zbierz przez formularz
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              placeholder="ID formularza intake"
              data-testid="rap-data-form-id"
              className="min-w-[14rem] flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-200"
            />
            <button
              type="button"
              onClick={() => void runForm()}
              disabled={formBusy || !formId.trim()}
              data-testid="rap-data-form-btn"
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {formBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Pobierz zgłoszenia
            </button>
          </div>
          {formError && (
            <p className="mt-2 text-xs text-amber-600" data-testid="rap-data-form-error">
              {formError}
            </p>
          )}
          {formData && <DatasetTable dataset={formData} />}
        </section>
      </div>
    </div>
  );
};

export default DataSourcesTabContent;
