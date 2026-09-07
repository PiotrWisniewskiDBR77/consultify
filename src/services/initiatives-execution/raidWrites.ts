/**
 * Kanoniczny (26A) klient zapisu pozycji RAID inicjatywy.
 *
 * POWOD ISTNIENIA — trzy rzeczy naraz, zmierzone 07.09:
 *
 *  1. Front wolal wycofane trasy `POST/PATCH/DELETE /api/initiatives/:id/raid*`.
 *     Bramka `requireCanonicalInitiativeExecutionWriter` odpowiada na nie 409,
 *     wiec dodanie, edycja i usuniecie ryzyka nie robily NIC.
 *  2. Czesc wywolan miala `.catch(() => {})` — awaria byla polykana w ciszy,
 *     uzytkownik nie dostawal zadnego komunikatu.
 *  3. Kanoniczny writer jest CAS-owy (`expectedVersion`), a UI nie ma skad
 *     znac wersji agregatu. Ten modul trzyma ja u siebie i po konflikcie
 *     ponawia raz z wersja podana przez serwer, wiec ekran nie musi o tym
 *     wiedziec.
 *
 * Zapis idzie do tego samego modelu odczytu, ktory czyta UI
 * (`GET /api/initiatives/:id/raid` -> tabela `raid_items`), wiec rekord jest
 * widoczny po odswiezeniu strony, a nie tylko w stanie komponentu.
 */

const BASE = '/api/initiatives/runtime-v1/initiatives';

/** Wersja agregatu per pozycja RAID — CAS kanonicznego writera. */
const aggregateVersions = new Map<string, number>();

function newRequestId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `raid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class RaidWriteError extends Error {
  constructor(
    /** Komunikat po polsku, gotowy do pokazania uzytkownikowi. */
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'RaidWriteError';
  }
}

function messageForStatus(status: number, conflictAfterRetry: boolean): string {
  if (conflictAfterRetry) {
    return 'Ktoś inny zmienił tę pozycję w tym samym czasie. Odśwież stronę i wprowadź zmianę jeszcze raz.';
  }
  if (status === 401) return 'Sesja wygasła. Zaloguj się ponownie i powtórz zmianę.';
  if (status === 403 || status === 404) {
    return 'Nie możesz zmieniać tej inicjatywy albo została usunięta. Odśwież stronę.';
  }
  if (status === 400) return 'Nie udało się zapisać — sprawdź wypełnione pola i spróbuj ponownie.';
  if (status === 0) return 'Zapis nie doszedł do serwera. Sprawdź połączenie i spróbuj ponownie.';
  return 'Zapis się nie powiódł. Spróbuj ponownie za chwilę.';
}

async function readJson(response: Response): Promise<Record<string, any>> {
  try {
    return (await response.json()) as Record<string, any>;
  } catch {
    return {};
  }
}

async function call(
  method: 'POST' | 'PATCH' | 'DELETE',
  initiativeId: string,
  raidItemId: string,
  payload: Record<string, unknown>,
  expectedVersion: number
): Promise<{ ok: true; version: number } | { ok: false; status: number; currentVersion?: number }> {
  let response: Response;
  try {
    response = await fetch(
      `${BASE}/${encodeURIComponent(initiativeId)}/raid-items/${encodeURIComponent(raidItemId)}`,
      {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...payload, expectedVersion, clientRequestId: newRequestId() }),
      }
    );
  } catch {
    return { ok: false, status: 0 };
  }
  const body = await readJson(response);
  if (response.ok) {
    return { ok: true, version: Number(body.aggregateVersion ?? expectedVersion + 1) };
  }
  const current = body?.error?.currentVersion;
  return {
    ok: false,
    status: response.status,
    currentVersion: typeof current === 'number' ? current : undefined,
  };
}

/**
 * Wysyla komende i — gdy serwer zglosi konflikt wersji — ponawia RAZ z wersja,
 * ktora serwer podal jako biezaca. Pozycje zalozone przed 26A nie maja jeszcze
 * wersji (serwer zwraca `null`), dlatego domyslna wartoscia jest 0.
 */
async function send(
  method: 'POST' | 'PATCH' | 'DELETE',
  initiativeId: string,
  raidItemId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const first = await call(
    method,
    initiativeId,
    raidItemId,
    payload,
    aggregateVersions.get(raidItemId) ?? 0
  );
  if (first.ok) {
    aggregateVersions.set(raidItemId, first.version);
    return;
  }
  if (first.status === 409 && typeof first.currentVersion === 'number') {
    const retry = await call(method, initiativeId, raidItemId, payload, first.currentVersion);
    if (retry.ok) {
      aggregateVersions.set(raidItemId, retry.version);
      return;
    }
    throw new RaidWriteError(messageForStatus(retry.status, retry.status === 409), retry.status);
  }
  throw new RaidWriteError(messageForStatus(first.status, first.status === 409), first.status);
}

export type RaidItemDraft = {
  type: 'RISK' | 'ASSUMPTION' | 'ISSUE' | 'DEPENDENCY';
  title: string;
  description?: string | null;
  status?: 'OPEN' | 'MITIGATED' | 'REALIZED' | 'CLOSED';
  probability?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  ownerId?: string | null;
  dueDate?: string | null;
  mitigationPlan?: string | null;
};

export type RaidItemPatch = {
  title?: string | null;
  description?: string | null;
  status?: 'OPEN' | 'MITIGATED' | 'REALIZED' | 'CLOSED' | null;
  probability?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  ownerId?: string | null;
  dueDate?: string | null;
  mitigationPlan?: string | null;
};

/** Identyfikator nadaje klient — kanoniczna komenda jest adresowana docelowym id. */
export function newRaidItemId(): string {
  return newRequestId();
}

/**
 * ZASILENIE PAMIĘCI WERSJI Z MODELU ODCZYTU (P16/R4, DEC-453).
 *
 * ZMIERZONE 07.09 (`evidence/p16-r45/po/api.log`, przebieg przed poprawką):
 * pamięć wersji żyła WYŁĄCZNIE w tej zakładce przeglądarki, więc PIERWSZY
 * zapis po każdym przeładowaniu strony szedł z `expectedVersion: 0`, dostawał
 * 409 `VERSION_OR_IDEMPOTENCY_CONFLICT` i dopiero ponowienie kończyło się 200.
 * Skutki były dwa, oba złe:
 *   1. czerwony błąd w konsoli przy KAŻDEJ pierwszej edycji (próg §10 paczki:
 *      zero błędów konsoli poza `NetworkBuffer`),
 *   2. CAS nigdy niczego nie chronił — ślepe „0" zawsze przegrywało i zawsze
 *      było nadpisywane wersją serwera, więc równoległa edycja dwóch osób
 *      przechodziła bez ostrzeżenia. Zabezpieczenie, które zawsze ustępuje,
 *      nie jest zabezpieczeniem.
 *
 * `GET /api/raid` zwraca teraz `aggregateVersion` (LEFT JOIN na
 * `ie_aggregate_state`). Pozycje sprzed decyzji 26A nie mają tam wiersza i
 * przychodzą z `null` — takie POMIJAMY, żeby zostały przy dotychczasowej
 * adopcji przez 0, a nie dostały zmyślonej wersji.
 */
export function seedRaidVersions(
  items: Array<{ id?: unknown; aggregateVersion?: unknown }> | null | undefined
): void {
  for (const item of items ?? []) {
    const id = String(item?.id ?? '');
    const version = item?.aggregateVersion;
    if (!id || typeof version !== 'number' || !Number.isFinite(version)) continue;
    aggregateVersions.set(id, version);
  }
}

export async function createRaidItem(
  initiativeId: string,
  raidItemId: string,
  draft: RaidItemDraft
): Promise<string> {
  await send('POST', initiativeId, raidItemId, {
    type: draft.type,
    title: draft.title,
    description: draft.description ?? null,
    status: draft.status ?? 'OPEN',
    probability: draft.probability ?? null,
    severity: draft.severity ?? null,
    ownerId: draft.ownerId ?? null,
    dueDate: draft.dueDate ?? null,
    mitigationPlan: draft.mitigationPlan ?? null,
    linkedItems: [],
  });
  return raidItemId;
}

export async function updateRaidItem(
  initiativeId: string,
  raidItemId: string,
  patch: RaidItemPatch
): Promise<void> {
  // `null` znaczy "nie zmieniaj" — kanoniczna komenda robi COALESCE, tak samo
  // jak robil wycofany zapis legacy, wiec czesciowa edycja nie zeruje reszty.
  await send('PATCH', initiativeId, raidItemId, {
    title: patch.title ?? null,
    description: patch.description ?? null,
    status: patch.status ?? null,
    probability: patch.probability ?? null,
    severity: patch.severity ?? null,
    ownerId: patch.ownerId ?? null,
    dueDate: patch.dueDate ?? null,
    mitigationPlan: patch.mitigationPlan ?? null,
  });
}

export async function deleteRaidItem(initiativeId: string, raidItemId: string): Promise<void> {
  await send('DELETE', initiativeId, raidItemId, {});
  aggregateVersions.delete(raidItemId);
}

/** Wylacznie dla testow — czysci pamiec wersji miedzy przypadkami. */
export function __resetRaidVersionCache(): void {
  aggregateVersions.clear();
}
