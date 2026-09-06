/**
 * Klient rejestru migawek raportów Realizacji (`/api/execution-reports`, zlecenie 1.12-R4).
 *
 * Katalog definicji czyta ten sam wiersz bazy co `report-builder` (tabela `report_definitions`),
 * ale dokłada dwie rzeczy, których nie ma w bazie i których nie chcemy hardkodować na ekranie:
 * `level` (poziom raportowania) i `mvp` (czy generuje migawkę, czy jest „Fala 2").
 */

import { getHeaders } from '@/services/api';

export type ExecutionReportLevel = 'OWNER' | 'PMO' | 'STEERCO' | 'BOARD';
export type ExecutionReportRag = 'GREEN' | 'AMBER' | 'RED' | 'GREY';

export interface ExecutionReportDefinitionDto {
  key: string;
  name: string;
  audience: string | null;
  cadence: string | null;
  scope: string | null;
  sections: string[];
  level: ExecutionReportLevel;
  mvp: boolean;
  formats: Array<'SCREEN' | 'DOCX' | 'PDF'>;
}

export interface ExecutionReportSection {
  id: string;
  title: string;
  narrative?: string;
  bullets?: string[];
  table?: {
    columns: Array<{ id: string; label: string }>;
    rows: Array<Record<string, string>>;
  };
  empty?: string;
}

export interface ExecutionReportSnapshot {
  definitionKey: string;
  title: string;
  subtitle?: string;
  rag: ExecutionReportRag;
  ragReason?: string;
  period: { start: string; end: string };
  asOf: string;
  metrics: Array<{
    id: string;
    label: string;
    value: string;
    hint?: string;
    tone?: 'NEUTRAL' | 'WARN' | 'CRIT' | 'OK' | 'GREY';
  }>;
  sections: ExecutionReportSection[];
}

export interface ExecutionReportRunDto {
  id: string;
  definitionKey: string;
  level: ExecutionReportLevel;
  title: string;
  status: 'DRAFT' | 'PUBLISHED';
  rag: ExecutionReportRag;
  period: { start: string; end: string };
  asOf: string;
  createdAt: string;
  createdByName: string | null;
  publishedAt: string | null;
  payload?: ExecutionReportSnapshot;
}

const BASE = '/api/execution-reports';

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...getHeaders(), ...(init?.headers ?? {}) },
    credentials: 'include',
  });
  const body = await readJson(response);
  if (!response.ok) {
    const error = new Error((body as any)?.error || `HTTP ${response.status}`);
    (error as any).status = response.status;
    (error as any).code = (body as any)?.code;
    throw error;
  }
  return body as T;
}

export function listExecutionReportDefinitions() {
  return request<{ definitions: ExecutionReportDefinitionDto[] }>('/definitions');
}

export function listExecutionReportRuns() {
  return request<{ items: ExecutionReportRunDto[] }>('/runs');
}

export function readExecutionReportRun(id: string) {
  return request<ExecutionReportRunDto>(`/runs/${encodeURIComponent(id)}`);
}

export function createExecutionReportRun(snapshot: ExecutionReportSnapshot) {
  return request<ExecutionReportRunDto>('/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
}

export function publishExecutionReportRun(id: string) {
  return request<ExecutionReportRunDto>(`/runs/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
  });
}

/**
 * Pobranie pliku. Wzorzec 1:1 z raportem Oceny/Audytu
 * (`AuditReportDocumentView.tsx:557`): fetch → blob → tymczasowy `<a download>` → revoke.
 * Nie `window.open`, bo trasa wymaga nagłówka autoryzacji.
 */
export async function downloadExecutionReportFile(
  id: string,
  format: 'docx' | 'pdf',
  fileName: string
): Promise<void> {
  const response = await fetch(`${BASE}/runs/${encodeURIComponent(id)}/export.${format}`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await readJson(response);
    throw new Error((body as any)?.error || `HTTP ${response.status}`);
  }
  const blobUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${fileName}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}
