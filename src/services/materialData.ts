/**
 * materialData.ts — FE-klient warstwy danych Materiałów (W5.3).
 *
 * Cienki klient nad endpointami W5.1/W5.2:
 *   GET  /deliverables/generations/data/connectors          → typy konektorów
 *   POST /deliverables/generations/data/connectors/preview  → podgląd danych
 *   POST /deliverables/generations/data/forms/:formId/dataset → dane z formularza
 *
 * Zasila tab „Dane" na materiale (Connect source + Collect via form). Fail-soft:
 * zwraca pustą/null wartość zamiast rzucać (UI pokazuje stan pusty).
 */
import { API_URL, getHeaders } from './api';

export interface MaterialDataset {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  source: { kind: 'connector' | 'form'; ref: string };
  truncated?: boolean;
}

const DATA_BASE = `${API_URL}/deliverables/generations/data`;

/** Lista dostępnych typów konektorów (postgres/airtable/jira/sheets/csv/webhook). */
export async function listConnectorTypes(): Promise<string[]> {
  try {
    const res = await fetch(`${DATA_BASE}/connectors`, { headers: getHeaders() as HeadersInit });
    if (!res.ok) return [];
    const data = await res.json() as { success: boolean; types?: string[] };
    return data.types ?? [];
  } catch {
    return [];
  }
}

/** Podgląd danych ze źródła (test + fetch pierwszych N wierszy). null gdy błąd. */
export async function previewConnector(
  type: string,
  config: Record<string, unknown>,
  limit = 25,
): Promise<MaterialDataset | null> {
  try {
    const res = await fetch(`${DATA_BASE}/connectors/preview`, {
      method: 'POST',
      headers: { ...(getHeaders() as Record<string, string>), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, config, limit }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { success: boolean; dataset?: MaterialDataset };
    return data.dataset ?? null;
  } catch {
    return null;
  }
}

/** Zgłoszenia formularza intake jako dataset materiału. null gdy błąd. */
export async function fetchFormDataset(formId: string): Promise<MaterialDataset | null> {
  try {
    const res = await fetch(`${DATA_BASE}/forms/${encodeURIComponent(formId)}/dataset`, {
      method: 'POST',
      headers: { ...(getHeaders() as Record<string, string>), 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return null;
    const data = await res.json() as { success: boolean; dataset?: MaterialDataset };
    return data.dataset ?? null;
  } catch {
    return null;
  }
}
