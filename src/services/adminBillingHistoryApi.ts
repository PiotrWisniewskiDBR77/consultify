import { apiGet } from './api/baseClient';

export interface PlanHistoryEntry {
  id: string;
  action: string;
  from_plan: string | null;
  to_plan: string | null;
  reason: string | null;
  performed_by: string | null;
  metadata: string | null;
  created_at: string;
}

interface PlanHistoryEnvelope {
  success: boolean;
  data?: PlanHistoryEntry[];
}

export async function getPlanHistory(limit = 50, offset = 0): Promise<PlanHistoryEntry[]> {
  const response = await apiGet<PlanHistoryEnvelope>(`/admin/billing-history?limit=${limit}&offset=${offset}`);
  return response.data ?? [];
}
