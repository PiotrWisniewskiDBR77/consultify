/**
 * Plan zasobow (osoba x tydzien) dla zakladki Realizacja > Zasoby.
 *
 * DLACZEGO OSOBNE WOLANIE, A NIE WACHLARZ PO REALIZACJACH (1.12-R2):
 * tabela Zasobow czytala WYLACZNIE kanoniczne przydzialy per realizacja
 * (`readOperationalAllocations` przez `fanOutExecutionCases`). W DBR77
 * realizacji jest 0, wiec tabela nie miala ani jednego wiersza, a przy
 * realizacji, ktora nie odpowiada, czekala na nia do 12 s. Popyt i podaz
 * (zadania + etaty osob) NIE zaleza od realizacji — dlatego to jedno,
 * niezalezne wolanie, ktore nigdy nie wisi na cudzej realizacji.
 */
import { getHeaders } from '../apiUtils';

/** Zadanie zalegle — tyle, ile trzeba, zeby je rozliczyc bez wychodzenia z Zasobow. */
export interface ResourcePlanBacklogTask {
  taskId: string;
  title: string;
  status: string;
  dueDate: string | null;
  daysOverdue: number;
  estimatedHours: number;
  remainingHours: number;
}

export interface ResourcePlanRow {
  userId: string;
  name: string;
  role: string;
  weekStart: string;
  demandHours: number;
  supplyHours: number;
  utilizationPercent: number;
  gapHours: number;
  /** Zawsze 0 od P16-R1 — zaleglosc nie wchodzi do popytu zadnego tygodnia. */
  overdueHours: number;
  /** Zaleglosc osoby (h) — TYLKO w wierszu biezacego tygodnia, indziej 0. */
  backlogHours: number;
  backlogTaskIds: string[];
  backlogTasks: ResourcePlanBacklogTask[];
  taskCount: number;
  supplySource: 'PROFIL' | 'DOMYSLNA';
}

export interface ResourcePlanPerson {
  userId: string;
  name: string;
  role: string;
  weeklyCapacityHours: number;
  availabilityPercent: number;
  supplySource: 'PROFIL' | 'DOMYSLNA';
  /** ZALEGLOSC (termin minal, praca otwarta) — jedna liczba na osobe. */
  backlogHours: number;
  /** Godziny zadan otwartych BEZ terminu — poza popytem i poza zalegloscia. */
  unscheduledHours: number;
  backlogTaskIds: string[];
  backlogTasks: ResourcePlanBacklogTask[];
}

export interface ResourcePlanResponse {
  asOf: string;
  weeks: string[];
  rows: ResourcePlanRow[];
  people: ResourcePlanPerson[];
  summary: {
    peopleCount: number;
    demandHours: number;
    supplyHours: number;
    gapHours: number;
    utilizationPercent: number | null;
    /** Liczba przeciazonych TYGODNI (wierszy osoba x tydzien), nie osob. */
    overloadedCount: number;
    peopleWithoutProfileSupply: number;
    backlogHoursTotal: number;
    backlogPeople: number;
  };
}

export async function readExecutionResourcePlan(
  weeks = 8,
  signal?: AbortSignal
): Promise<ResourcePlanResponse> {
  const response = await fetch(
    `/api/execution-control/capacity/resource-plan?weeks=${encodeURIComponent(String(weeks))}`,
    { headers: getHeaders(), signal }
  );
  if (!response.ok) throw new Error(`resource-plan ${response.status}`);
  return (await response.json()) as ResourcePlanResponse;
}

/**
 * Rozliczenie ZALEGLOSCI (P16-R1, §4 D1) — trzy akcje na zadaniu zaleglym.
 * Wszystkie ida jednym, ISTNIEJACYM zapisem `PUT /api/tasks/:id` (ta trasa ma
 * WYLACZNIE metode PUT — PATCH wpada w globalny 404, zmierzone 07.09).
 */
async function zapiszZadanie(
  taskId: string,
  payload: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PUT',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (response.ok) return { ok: true };
  let error = '';
  try {
    const body = (await response.json()) as { error?: string };
    error = String(body?.error ?? '');
  } catch {
    error = '';
  }
  return { ok: false, status: response.status, error };
}

function bladPoPolsku(wynik: { status: number; error: string }, czynnosc: string): string {
  if (wynik.status === 409)
    return `${czynnosc}: zadanie jest zablokowane niepodjętą decyzją — rozstrzygnij ją najpierw.`;
  if (wynik.status === 403) return `${czynnosc}: brak uprawnień do zmiany tego zadania.`;
  if (wynik.status === 404) return `${czynnosc}: zadania już nie ma.`;
  return `${czynnosc}: zapis nie przeszedł. Spróbuj ponownie.`;
}

/** „Przenieś na tydzień" — nowy termin zadania (data poniedziałku albo dowolny dzień). */
export async function przeniesZadanieNaTermin(taskId: string, dueDate: string): Promise<void> {
  const wynik = await zapiszZadanie(taskId, { dueDate });
  if (!wynik.ok) throw new Error(bladPoPolsku(wynik, 'Nie udało się przenieść zadania'));
}

/**
 * „Uznaj za zamknięte" — status końcowy ze SLOWNIKA SILNIKA (`done`).
 *
 * Silnik zadan ma bramke przejsc (`taskWorkflowService.ALLOWED_TRANSITIONS`) i
 * `todo -> done` NIE jest w niej dozwolone; kanoniczna sciezka prowadzi przez
 * `in_progress`. Dlatego przy statusie, z ktorego nie da sie zamknac wprost,
 * robimy DWA jawne zapisy tej samej trasy zamiast omijac bramke — nie
 * dopisujemy wlasnej listy statusow koncowych i nie ruszamy walidatora.
 */
export async function zamknijZadanieZaleglosci(taskId: string, status: string): Promise<void> {
  const obecny = String(status || '')
    .toLowerCase()
    .replace(/[\s-]/g, '_');
  const wprost = obecny === 'in_progress' || obecny === 'review';
  if (!wprost) {
    const krok = await zapiszZadanie(taskId, { status: 'in_progress' });
    if (!krok.ok) throw new Error(bladPoPolsku(krok, 'Nie udało się zamknąć zadania'));
  }
  const wynik = await zapiszZadanie(taskId, { status: 'done' });
  if (!wynik.ok) throw new Error(bladPoPolsku(wynik, 'Nie udało się zamknąć zadania'));
}

/** „Zmniejsz zakres" — nowa pracochłonność zadania (`tasks.estimated_hours`). */
export async function zmniejszZakresZadania(taskId: string, estimatedHours: number): Promise<void> {
  const wynik = await zapiszZadanie(taskId, { estimatedHours });
  if (!wynik.ok) throw new Error(bladPoPolsku(wynik, 'Nie udało się zmniejszyć zakresu'));
}

/** „Dodaj dostepnosc" — jedna edytowalna liczba na osobe (etat + dostepnosc). */
export async function saveUserCapacity(
  userId: string,
  payload: { weeklyCapacityHours?: number | null; availabilityPercent?: number | null }
): Promise<{
  userId: string;
  weeklyCapacityHours: number | null;
  availabilityPercent: number | null;
}> {
  const response = await fetch(`/api/users/${encodeURIComponent(userId)}/capacity`, {
    method: 'PATCH',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`capacity ${response.status}`);
  return await response.json();
}
