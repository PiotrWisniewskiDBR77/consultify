import type { ActionCardModel, ActionCardSourceKind } from '@/components/standard/ActionCard.types';

export interface CreateActionCardPayload extends Omit<ActionCardModel, 'id' | 'status' | 'ownerName' | 'severity'> {
  ownerUserId: string;
}

async function read<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || 'ACTION_CARD_REQUEST_FAILED');
  return body;
}

export async function listActionCards(filters: { ownerUserId?: string; status?: 'OPEN' | 'CLOSED'; sourceKind?: ActionCardSourceKind } = {}): Promise<ActionCardModel[]> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
  const response = await fetch(`/api/action-cards?${query}`, { credentials: 'include' });
  return (await read<{ cards: ActionCardModel[] }>(response)).cards;
}

export async function createActionCard(payload: CreateActionCardPayload): Promise<ActionCardModel> {
  const response = await fetch('/api/action-cards', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return (await read<{ card: ActionCardModel }>(response)).card;
}

export async function updateActionCard(id: string, patch: Partial<CreateActionCardPayload>): Promise<ActionCardModel> {
  const response = await fetch(`/api/action-cards/${encodeURIComponent(id)}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  return (await read<{ card: ActionCardModel }>(response)).card;
}

export async function closeActionCard(id: string): Promise<ActionCardModel> {
  const response = await fetch(`/api/action-cards/${encodeURIComponent(id)}/close`, { method: 'POST', credentials: 'include' });
  return (await read<{ card: ActionCardModel }>(response)).card;
}
