import { API_URL, fetchWithRetry, getHeaders, handleResponse } from '../apiUtils';

export interface PresentationApprovalAssignment {
  id: string;
  assigned_to_user_id: string;
  assigned_by_user_id?: string;
  status: string;
  escalation_reason?: string | null;
}

export interface PresentationApprovalState {
  state: 'draft' | 'review' | 'approved' | 'rejected';
  assignment: PresentationApprovalAssignment | null;
  versionId: string;
  currentForVersion: boolean;
}

interface ApiEnvelope<T> { success: boolean; data: T }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithRetry(`${API_URL}${path}`, {
    ...init,
    headers: { ...getHeaders(), ...(init?.headers || {}) },
  });
  const envelope = (await handleResponse(
    response,
    'Nie udało się wykonać operacji zatwierdzania prezentacji'
  )) as ApiEnvelope<T>;
  return envelope.data;
}

export const PresentationApprovalsApi = {
  getState: (deckId: string) =>
    request<PresentationApprovalState>(`/presentations/decks/${deckId}/approval-state`),
  submit: (deckId: string, assignedToUserId: string) =>
    request(`/presentations/decks/${deckId}/approval/submit`, {
      method: 'POST', body: JSON.stringify({ assignedToUserId }),
    }),
  approve: (deckId: string) =>
    request(`/presentations/decks/${deckId}/approval/approve`, { method: 'POST' }),
  reject: (deckId: string, reason: string) =>
    request(`/presentations/decks/${deckId}/approval/reject`, {
      method: 'POST', body: JSON.stringify({ reason }),
    }),
};
