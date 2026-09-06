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

export interface ResourcePlanRow {
  userId: string;
  name: string;
  role: string;
  weekStart: string;
  demandHours: number;
  supplyHours: number;
  utilizationPercent: number;
  gapHours: number;
  overdueHours: number;
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
  backlogHours: number;
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
    overloadedCount: number;
    peopleWithoutProfileSupply: number;
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
