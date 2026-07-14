/**
 * materialDataBinding (W5.1/W5.2) — komponuje DOJRZAŁĄ warstwę danych F5
 * (connectorFramework + FormService) na materiale wiązki.
 *
 * Most: zewnętrzne źródło (konektor: postgres/airtable/jira/sheets/csv/webhook
 * LUB formularz intake) → znormalizowany `MaterialDataset` (kolumny + wiersze) →
 * intent tabeli (`datasetToTableIntent`) który seeduje generateTableSchema.
 *
 * Decyzja W0.1 = KOMPONUJ dojrzałe studia. F5 jest ~90% zbudowane i żywe —
 * tu tylko cienka, czysta warstwa adaptacyjna do pipeline'u Materiałów.
 *
 * Fail-soft: błąd źródła → null (caller pomija dane). DI dla testowalności bez DB.
 */
import logger from '../../utils/Logger.js';
import { connectorRegistry, type ExternalRecord } from '../dataCollection/connectorFramework.js';

const LOG = '[materialDataBinding]';

/** Znormalizowany zbiór danych do zasilenia tabeli materiału. */
export interface MaterialDataset {
  /** Kolumny w stabilnej kolejności (pierwsze-widziane). */
  columns: string[];
  /** Wiersze jako obiekty kolumna→wartość. */
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  /** Skąd pochodzą dane (audyt/provenance). */
  source: { kind: 'connector' | 'form'; ref: string };
  /** True gdy ucięto do limitu (więcej danych w źródle). */
  truncated?: boolean;
}

/** Maksymalna liczba wierszy w datasecie materiału (ochrona pamięci/UI). */
export const MATERIAL_DATASET_MAX_ROWS = 500;

/**
 * ExternalRecord[] (z konektora) lub surowe obiekty (z formularza) → kolumny+wiersze.
 * Kolumny = unia kluczy w stabilnej kolejności pierwszego wystąpienia.
 */
function rowsToColumns(
  rawRows: Array<Record<string, unknown>>,
  maxRows: number
): {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  truncated: boolean;
} {
  const truncated = rawRows.length > maxRows;
  const rows = truncated ? rawRows.slice(0, maxRows) : rawRows;
  const seen = new Set<string>();
  const columns: string[] = [];
  for (const r of rows) {
    for (const key of Object.keys(r ?? {})) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  return { columns, rows, truncated };
}

/**
 * W5.1 — konektor → dataset. Komponuje connectorRegistry: pobiera rekordy przez
 * `fetchRecords(config)` zarejestrowanego konektora danego typu. Fail-soft → null.
 */
export async function connectorDataset(
  type: string,
  config: Record<string, unknown>,
  opts: { limit?: number; offset?: number } = {}
): Promise<MaterialDataset | null> {
  try {
    if (!connectorRegistry.listTypes().includes(type)) {
      logger.warn(`${LOG} unknown connector type: ${type}`);
      return null;
    }
    const impl = connectorRegistry.get(type);
    const limit = Math.min(opts.limit ?? MATERIAL_DATASET_MAX_ROWS, MATERIAL_DATASET_MAX_ROWS);
    const records: ExternalRecord[] = await impl.fetchRecords(config, {
      limit,
      offset: opts.offset,
    });
    const rawRows = (records ?? []).map((rec) => rec?.data ?? {});
    const { columns, rows, truncated } = rowsToColumns(rawRows, MATERIAL_DATASET_MAX_ROWS);
    return {
      columns,
      rows,
      rowCount: rows.length,
      source: { kind: 'connector', ref: type },
      truncated,
    };
  } catch (err) {
    logger.warn(
      `${LOG} connectorDataset(${type}) failed (fail-soft): ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/** Zależności wstrzykiwane dla formDataset (testowalność bez DB). */
export interface FormDatasetDeps {
  /** Pobiera zgłoszenia formularza (np. formService.getSubmissions). */
  fetchSubmissions: (formId: string) => Promise<{ records: unknown[]; total: number }>;
  /** Mapa fieldId→czytelna etykieta kolumny (opcjonalna; gdy brak → klucz surowy). */
  fieldLabels?: Record<string, string>;
}

/**
 * W5.2 — formularz intake → dataset. Każde zgłoszenie = 1 wiersz; kolumny = pola
 * formularza (po etykietach gdy dostępne). DI na fetchSubmissions → testowalne.
 * Fail-soft → null.
 */
export async function formDataset(
  formId: string,
  deps: FormDatasetDeps
): Promise<MaterialDataset | null> {
  try {
    const { records } = await deps.fetchSubmissions(formId);
    const labels = deps.fieldLabels ?? {};
    const rawRows = (records ?? []).map((rec) => {
      const r = rec as { id?: string; created_at?: string; data?: Record<string, unknown> };
      const data = r?.data ?? {};
      const out: Record<string, unknown> = {};
      for (const [fieldId, value] of Object.entries(data)) {
        out[labels[fieldId] ?? fieldId] = value;
      }
      return out;
    });
    const { columns, rows, truncated } = rowsToColumns(rawRows, MATERIAL_DATASET_MAX_ROWS);
    return {
      columns,
      rows,
      rowCount: rows.length,
      source: { kind: 'form', ref: formId },
      truncated,
    };
  } catch (err) {
    logger.warn(
      `${LOG} formDataset(${formId}) failed (fail-soft): ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/**
 * Dataset → intent tabeli (string) dla generateTableSchema. Niesie kolumny +
 * próbkę wierszy (do 8) jako JSON, żeby generator otypował pola i zasiał realne
 * dane zamiast zmyślać. Zwraca '' gdy dataset pusty.
 */
export function datasetToTableIntent(dataset: MaterialDataset | null, title: string): string {
  if (!dataset || dataset.columns.length === 0) return '';
  const sample = dataset.rows.slice(0, 8);
  const srcLabel =
    dataset.source.kind === 'connector'
      ? `konektor ${dataset.source.ref}`
      : `formularz ${dataset.source.ref}`;
  return [
    `Tabela: ${title}.`,
    `Źródło danych: ${srcLabel} (${dataset.rowCount} wierszy${dataset.truncated ? ', ucięte do limitu' : ''}).`,
    `Kolumny: ${dataset.columns.join(', ')}.`,
    `Otypuj pola wg tych kolumn i ZASIAĆ realnymi danymi (nie zmyślaj): ${JSON.stringify(sample)}`,
  ].join(' ');
}
