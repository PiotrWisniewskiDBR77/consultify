/**
 * SYGNAŁY OPÓŹNIEŃ — CZYSTA LOGIKA (P16/R5, DEC-453, §4 D4).
 *
 * POMIAR PRZED R5 (07.09, kopia bazy `consultify_p16r45`):
 *   · zakładka „Decyzje i ryzyka" czytała `runtime-v1/management-signals`
 *     i `runtime-v1/interventions` — OBA po 0 rekordów (`ExecutionControl
 *     Surface.tsx:603-604`), a przycisk „Przygotuj interwencję" był przez to
 *     ZAWSZE wyszarzony,
 *   · obok, nieczytane: `GET /api/execution-control/delay-signals` → **42
 *     policzone sygnały** (LATE_START 23 · OVERDUE 19; CRITICAL 30 ·
 *     WARNING 12; INITIATIVE 23 · TASK 19), z powodami `whySlipReasons`
 *     (NO_OWNER 7 · BLOCKED 6 · RAID_HIGH_RISK 6; 26 sygnałów bez powodu).
 *
 * Sygnał jest LICZONY, nie zapisany: `detectDelaySignals` wylicza go przy
 * każdym zapytaniu i NIE MA trwałego stanu „obsłużony". Dlatego stan wiersza
 * czytamy z rejestru decyzji: sygnał ma stan „Interwencja", gdy istnieje
 * decyzja o rodowodzie `delay_signal` wskazującym TEN sygnał (`sourceId`).
 */

export type RodzajOdchylenia = 'LATE_START' | 'LATE_FINISH_RISK' | 'DEADLINE_RISK' | 'OVERDUE';

export interface PowodOpoznienia {
  reason: string;
  detail?: string;
}

export interface SygnalOpoznienia {
  id: string;
  projectId?: string;
  entityType: 'INITIATIVE' | 'TASK';
  entityId: string;
  entityName: string;
  deviationType: RodzajOdchylenia | string;
  severity: 'WARNING' | 'CRITICAL' | string;
  daysDeviation: number;
  plannedDate: string | null;
  actualOrCurrent: string | null;
  whySlipReasons: PowodOpoznienia[];
  isDismissed?: boolean;
  createdAt: string;
}

type Tlumacz = (key: string, fallback: string) => string;

/**
 * RODZAJ SYGNAŁU po polsku — słownik `DeviationType`
 * (`server/src/services/delayDetectionService.ts:12`), wszystkie cztery
 * wartości kontraktu, nie tylko te dwie, które akurat są w danych.
 */
export const rodzajSygnaluLabel = (value: unknown, t: Tlumacz): string => {
  const key = String(value ?? '').toUpperCase();
  const slownik: Record<string, string> = {
    LATE_START: t('execution.signals.kind.lateStart', 'Late start'),
    OVERDUE: t('execution.signals.kind.overdue', 'Overdue'),
    LATE_FINISH_RISK: t('execution.signals.kind.lateFinishRisk', 'Late finish risk'),
    DEADLINE_RISK: t('execution.signals.kind.deadlineRisk', 'Deadline at risk'),
  };
  return slownik[key] ?? String(value ?? '—');
};

/**
 * POWÓD po polsku — słownik `WhySlipReason` (sześć wartości kontraktu).
 * Brak powodu NIE jest zerem ani pustką bez nazwy: mówimy wprost, że system
 * go nie ustalił (§10: zero liczb i etykiet bez wyjaśnienia).
 */
export const powodSygnaluLabel = (value: unknown, t: Tlumacz): string => {
  const key = String(value ?? '').toUpperCase();
  const slownik: Record<string, string> = {
    BLOCKED: t('execution.signals.reason.blocked', 'Blocked'),
    DEPENDENCY_NOT_DONE: t('execution.signals.reason.dependency', 'Unresolved dependency'),
    NO_OWNER: t('execution.signals.reason.noOwner', 'No owner'),
    RAID_HIGH_RISK: t('execution.signals.reason.raidHighRisk', 'High RAID risk'),
    CAPACITY_OVERLOAD: t('execution.signals.reason.capacity', 'Resource overload'),
    NO_TASKS_PLANNED: t('execution.signals.reason.noTasks', 'No planned tasks'),
  };
  return slownik[key] ?? String(value ?? '');
};

/** Wszystkie powody jednego sygnału w jednej komórce, albo nazwany brak. */
export const powodySygnaluLabel = (powody: PowodOpoznienia[] | undefined, t: Tlumacz): string => {
  const lista = (powody ?? [])
    .map((p) => powodSygnaluLabel(p?.reason, t))
    .filter((x) => x.trim().length > 0);
  if (lista.length === 0) return t('execution.signals.reason.unknown', 'Not determined');
  return lista.join(' · ');
};

/**
 * RODOWÓD DECYZJI Z SYGNAŁU — `decisions.source_type`.
 * Wartość jest ogólna (kontroler przyjmuje dowolną parę `sourceType` +
 * `sourceId` od OKR-E006), więc nie trzeba niczego dokładać po stronie API.
 */
export const ZRODLO_SYGNALU = 'delay_signal';

export type StanSygnalu = 'NOWY' | 'INTERWENCJA' | 'ZAMKNIETY';

/** Decyzja w kształcie, w jakim zwraca ją `GET /api/decisions`. */
export interface DecyzjaRodowod {
  id: string;
  status?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}

const zakonczona = (status: unknown): boolean =>
  ['APPROVED', 'REJECTED', 'SUPERSEDED', 'CANCELLED'].includes(String(status ?? '').toUpperCase());

/**
 * STAN SYGNAŁU liczony z rejestru decyzji (serwer nie trzyma stanu sygnału):
 *   · brak powiązanej decyzji                → Nowy,
 *   · powiązana decyzja jeszcze nie zapadła  → Interwencja,
 *   · powiązana decyzja zapadła              → Zamknięty.
 */
export const stanSygnalu = (
  signalId: string,
  decyzje: DecyzjaRodowod[]
): { stan: StanSygnalu; decyzjaId: string | null } => {
  const powiazane = decyzje.filter(
    (d) =>
      String(d.sourceType ?? '').toLowerCase() === ZRODLO_SYGNALU &&
      String(d.sourceId ?? '') === signalId
  );
  if (powiazane.length === 0) return { stan: 'NOWY', decyzjaId: null };
  const otwarta = powiazane.find((d) => !zakonczona(d.status));
  if (otwarta) return { stan: 'INTERWENCJA', decyzjaId: otwarta.id };
  return { stan: 'ZAMKNIETY', decyzjaId: powiazane[0].id };
};

export const stanSygnaluLabel = (stan: StanSygnalu, t: Tlumacz): string =>
  ({
    NOWY: t('execution.signals.state.new', 'New'),
    INTERWENCJA: t('execution.signals.state.intervention', 'Intervention'),
    ZAMKNIETY: t('execution.signals.state.closed', 'Closed'),
  })[stan];

/**
 * KARENCJA INTERWENCJI — decyzja o przesunięciu ma zapaść w 3 dni.
 * Metodyka A1 pkt 6: data planowana bez decyzji jest niezmienna, więc
 * przesunięcie MUSI mieć decyzję z terminem, a nie „kiedyś".
 */
export const DNI_NA_DECYZJE_INTERWENCJI = 3;

export const terminInterwencji = (teraz: Date = new Date()): string => {
  const termin = new Date(teraz.getTime());
  termin.setDate(termin.getDate() + DNI_NA_DECYZJE_INTERWENCJI);
  return termin.toISOString();
};

/** Tytuł decyzji re-baseline — mówi CO i O ILE, bez kodów technicznych. */
export const tytulInterwencji = (nazwaObiektu: string, dniOdchylenia: number): string =>
  `Przesunięcie terminu: ${nazwaObiektu} (+${Math.max(0, Math.round(dniOdchylenia))} dni)`;

/**
 * Rodzaj decyzji dla wniosku o przesunięcie. `decisions.type` jest tekstem
 * (kontroler robi `.toUpperCase()` na dowolnej wartości), więc nie wymaga
 * ani migracji, ani nowej wartości w słowniku bazy.
 */
export const RODZAJ_DECYZJI_REBASELINE = 'RE_BASELINE';
