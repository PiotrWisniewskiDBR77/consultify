/**
 * managementReportsApi — cienka warstwa odczytu/zapisu dla zakładki
 * „Raporty zarządcze" w Menu 2 modułu Wyniki (DEC-422b/e, 06.09).
 *
 * ZERO NOWEGO SILNIKA. Wszystkie trzy wywołania trafiają w trasy, które już
 * istniały i już mają konsumenta w `src/components/Reports/Management/**`:
 *   • GET  /api/management-reports/history   (managementReports.routes.ts:103)
 *   • POST /api/management-reports/generate  (managementReports.routes.ts:52)
 *   • GET  /api/projects                     (lista realnych rekordów źródła)
 * Kopiujemy tu wyłącznie kształt odpowiedzi, żeby zakładka w Wynikach nie
 * musiała importować komponentów tamtej sekcji (pkt 4 zlecenia: sekcja
 * /reports/management ZOSTAJE NIETKNIĘTA).
 */

import { Api } from '@/services/api';
import type {
  ManagementReportScope,
  ManagementReportStatus,
  ManagementReportType,
} from '@/types';

/**
 * Wiersz zwracany przez `/history`. Kształt jest 1:1 z mapowaniem w
 * `managementReportsService.getReportHistory()` — celowo NIE jest to pełny
 * `ManagementReport` z `types/core.ts`, bo historia zwraca podzbiór pól
 * (bez `content`, `aiNarrative`, `periodStart/End`).
 */
export interface ManagementReportHistoryRow {
  id: string;
  title: string;
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  status: ManagementReportStatus;
  generatedBy: string;
  generatedByName: string;
  projectName?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  pdfPath?: string | null;
  pptxPath?: string | null;
}

export interface ManagementReportHistoryPage {
  reports: ManagementReportHistoryRow[];
  total: number;
}

export interface ManagementReportProject {
  id: string;
  name: string;
}

/**
 * Normalizacja listy projektów — ta sama, którą robi już
 * `ManagementReportsView.normalizeManagementReportProjects`. Powtórzona tu
 * lokalnie, bo import z tamtej sekcji ściągnąłby do bundla Wyników cały
 * widok raportów (lazy chunki, PDF, harmonogramy).
 */
export function normalizeProjects(response: unknown): ManagementReportProject[] {
  const payload = response as any;
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.data?.projects)
        ? payload.data.projects
        : null;
  if (!rows) throw new Error('INVALID_PROJECTS_RESPONSE');
  return rows
    .map((project: any) => ({
      id: String(project?.id || '').trim(),
      name: String(project?.name || '').trim(),
    }))
    .filter((project: ManagementReportProject) => project.id && project.name);
}

export async function fetchManagementReports(params: {
  status?: ManagementReportStatus | null;
  scope?: ManagementReportScope | null;
  limit?: number;
  offset?: number;
}): Promise<ManagementReportHistoryPage> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.scope) query.set('scope', params.scope);
  query.set('limit', String(params.limit ?? 50));
  query.set('offset', String(params.offset ?? 0));
  const response: any = await Api.get(`/api/management-reports/history?${query.toString()}`);
  const reports = Array.isArray(response?.data?.reports) ? response.data.reports : [];
  const total = Number(response?.data?.total ?? reports.length) || 0;
  return { reports: reports as ManagementReportHistoryRow[], total };
}

export async function fetchProjectsForReports(): Promise<ManagementReportProject[]> {
  return normalizeProjects(await Api.get('/api/projects'));
}

export async function generateManagementReport(payload: {
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  projectId?: string;
  periodDays?: number;
}): Promise<{ id: string } | null> {
  const response: any = await Api.post('/api/management-reports/generate', {
    reportType: payload.reportType,
    scope: payload.scope,
    projectId: payload.scope === 'PROJECT' ? payload.projectId : undefined,
    periodDays: payload.periodDays,
    aiEnhancement: true,
  });
  const report = response?.data?.report;
  return report?.id ? { id: String(report.id) } : null;
}
