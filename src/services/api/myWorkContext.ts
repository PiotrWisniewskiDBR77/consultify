import { fetchWithRetry, handleResponse } from './baseClient';

export interface MyWorkContextSummary {
  tasksByStatus?: Record<string, number>;
  totalOpenTasks?: number;
  overdueTasks?: Array<{ id: string; title: string }>;
  overdueCount?: number;
  pendingDecisions?: Array<{ id: string; title: string; due_date?: string | null }>;
  pendingDecisionCount?: number;
  inboxUnprocessed?: number;
  focusTodayCount?: number;
}

export async function getMyWorkContextSummary(): Promise<MyWorkContextSummary> {
  const response = await fetchWithRetry('/api/my-work/context-summary');
  return handleResponse<MyWorkContextSummary>(response, 'GET My Work context summary');
}
