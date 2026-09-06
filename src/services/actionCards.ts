import type { ActionCardModel, ActionCardSourceKind } from '@/components/standard/ActionCard.types';
import { tokenService } from '@/services/tokenService';

/**
 * DEFEKT ZNALEZIONY 06.09 (P7K część B): ten moduł wołał `/api/action-cards`
 * z samym `credentials: 'include'`. Aplikacja uwierzytelnia się NAGŁÓWKIEM
 * `Authorization: Bearer <token>` z `tokenService` — bez niego każde żądanie
 * karty działania wracało 401, a wołacze (`InboxActionCards`,
 * `ResultsActionCards`) po cichu pokazywały pustkę (`.catch(() => setCards([]))`).
 * „Komponent renderuje się" nie znaczyło „karta jest widoczna".
 */
function headers(withBody = false): Record<string, string> {
  const token = tokenService.getToken();
  const base: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (withBody) base['Content-Type'] = 'application/json';
  return base;
}

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
  const response = await fetch(`/api/action-cards?${query}`, { credentials: 'include', headers: headers() });
  /* `?? []` NIE jest ozdobą: gdy odpowiedź nie ma koperty `cards` (atrapa
     `fetch` w testach, pośrednik zwracający pustą treść), poprzednia wersja
     oddawała `undefined`, a wołacz robił z tego `setCards(undefined)` i
     wywracał całą Skrzynkę na `cards.length`. Zmierzone: 3 z 4 przypadków
     `InboxContent.jedenPanel.test.tsx` padało z tego powodu JUŻ PRZED tą
     paczką. Lista, której nie ma, jest listą pustą — nigdy `undefined`. */
  return (await read<{ cards: ActionCardModel[] }>(response)).cards ?? [];
}

export async function createActionCard(payload: CreateActionCardPayload): Promise<ActionCardModel> {
  const response = await fetch('/api/action-cards', { method: 'POST', credentials: 'include', headers: headers(true), body: JSON.stringify(payload) });
  return (await read<{ card: ActionCardModel }>(response)).card;
}

export async function updateActionCard(id: string, patch: Partial<CreateActionCardPayload>): Promise<ActionCardModel> {
  const response = await fetch(`/api/action-cards/${encodeURIComponent(id)}`, { method: 'PATCH', credentials: 'include', headers: headers(true), body: JSON.stringify(patch) });
  return (await read<{ card: ActionCardModel }>(response)).card;
}

/**
 * P7K część B — zadanie z karty działania. Serwer jest idempotentny
 * (`idempotency_key = action-card-task:<id>`), więc drugi klik oddaje TO SAMO
 * zadanie, nigdy drugiego wiersza w Zadaniach.
 */
export async function createTaskFromActionCard(id: string): Promise<{ id: string; title: string; status: string }> {
  const response = await fetch(`/api/action-cards/${encodeURIComponent(id)}/task`, { method: 'POST', credentials: 'include', headers: headers() });
  return (await read<{ task: { id: string; title: string; status: string } }>(response)).task;
}

export async function closeActionCard(id: string): Promise<ActionCardModel> {
  const response = await fetch(`/api/action-cards/${encodeURIComponent(id)}/close`, { method: 'POST', credentials: 'include', headers: headers() });
  return (await read<{ card: ActionCardModel }>(response)).card;
}
