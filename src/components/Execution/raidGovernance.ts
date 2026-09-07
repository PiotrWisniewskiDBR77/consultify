/**
 * RAID w zakładce „Decyzje i ryzyka" — CZYSTA LOGIKA (P16/R4, DEC-453).
 *
 * Wydzielona z `ExecutionControlSurface.tsx`, żeby dało się ją zmierzyć
 * testem bez renderowania całego ekranu (2,4 tys. linii) i żeby mutacja
 * w jednym miejscu dawała RED w jednym teście, a nie w dziesięciu.
 *
 * POMIAR PRZED R4 (07.09, kopia bazy `consultify_p16r45`, `GET /api/raid`):
 *   · 16 pozycji, **0 z terminem** (`due_date` puste u wszystkich),
 *   · kolumny `probability` (LOW/MEDIUM/HIGH) i `impact`
 *     (LOW/MEDIUM/HIGH/CRITICAL) SĄ w tabeli i mają wartości — migracja
 *     nie była potrzebna,
 *   · kolumna `risk_score` też jest, ale **kłamie**: 13 z 16 wierszy zgadza
 *     się ze skalą 5×5, a 3 nie (LOW/HIGH → 10 zamiast 8, MEDIUM/CRITICAL →
 *     18 zamiast 15, LOW/CRITICAL → 15 zamiast 10). Zapisał je seed, nie
 *     kalkulator. Dlatego EKSPOZYCJA JEST LICZONA TUTAJ z dwóch pól, a nie
 *     czytana z `riskScore` — „pole liczone, tylko do odczytu"
 *     (AUDYT_RYNKU_PMO §4.3, wzorzec Planview `RiskRate` i MS Project
 *     `Exposure = Probability × Impact`).
 */

/**
 * Skala 5-stopniowa — LUSTRO `PROBABILITY_5` / `IMPACT_5` z
 * `server/src/services/raidScoringService.ts`. Front nie importuje kodu
 * serwera, więc wartości są tu powtórzone; test `raidGovernance.test.ts`
 * pilnuje, żeby iloczyn dawał dokładnie to, co pokazuje ekran.
 *
 * Słownik `raid_items.probability` nie ma stopni VERY_LOW / VERY_HIGH,
 * więc używane są trzy środkowe (2–4); `impact` ma dodatkowo CRITICAL = 5.
 */
export const RAID_PRAWDOPODOBIENSTWO: Readonly<Record<string, number>> = Object.freeze({
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
});

export const RAID_WPLYW: Readonly<Record<string, number>> = Object.freeze({
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  CRITICAL: 5,
});

/** Kolejność w formularzu i w filtrze — od najniższego. */
export const RAID_PRAWDOPODOBIENSTWO_OPCJE = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const RAID_WPLYW_OPCJE = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/** Cztery typy pozycji RAID (`raid_items.type`, kontrakt kanonicznego writera). */
export const RAID_TYPY = ['RISK', 'ISSUE', 'DEPENDENCY', 'ASSUMPTION'] as const;
export type RaidTyp = (typeof RAID_TYPY)[number];

/** Statusy pozycji (kontrakt `RaidItemCreateSchema`). CLOSED = stan końcowy. */
export const RAID_STATUSY = ['OPEN', 'MITIGATED', 'REALIZED', 'CLOSED'] as const;
export type RaidStatus = (typeof RAID_STATUSY)[number];

/** Stan końcowy pozycji — po nim pozycja nie liczy się do „Po terminie". */
export const RAID_STATUS_KONCOWY: RaidStatus = 'CLOSED';

const klucz = (value: unknown): string => String(value ?? '').toUpperCase();

/** Wartość liczbowa prawdopodobieństwa (2–4) albo `null` dla braku/nieznanej. */
export const wartoscPrawdopodobienstwa = (value: unknown): number | null =>
  RAID_PRAWDOPODOBIENSTWO[klucz(value)] ?? null;

/** Wartość liczbowa wpływu (2–5) albo `null` dla braku/nieznanej. */
export const wartoscWplywu = (value: unknown): number | null => RAID_WPLYW[klucz(value)] ?? null;

/**
 * EKSPOZYCJA = prawdopodobieństwo × wpływ. Pole LICZONE, tylko do odczytu.
 *
 * `null`, gdy któregokolwiek składnika brakuje — pusta komórka jest uczciwa,
 * a podstawienie „1" za brak dałoby liczbę, której nikt nie umie wyjaśnić
 * (to jest dokładnie ta rodzina defektu, którą łapie §10 paczki: „0 liczb,
 * których nie da się wyjaśnić jednym zdaniem").
 */
export const ekspozycjaRaid = (probability: unknown, impact: unknown): number | null => {
  const p = wartoscPrawdopodobienstwa(probability);
  const w = wartoscWplywu(impact);
  if (p == null || w == null) return null;
  return p * w;
};

/**
 * Pasmo ekspozycji dla barwy: ≤6 niskie, ≤12 średnie, >12 wysokie
 * (`categorizeScore5x5`, progi 6/12 — te same, co na serwerze).
 */
export const pasmoEkspozycji = (score: number | null): 'brak' | 'niskie' | 'srednie' | 'wysokie' => {
  if (score == null) return 'brak';
  if (score <= 6) return 'niskie';
  if (score <= 12) return 'srednie';
  return 'wysokie';
};

/** Czy pozycja jest wciąż otwarta (nie w stanie końcowym). */
export const czyRaidOtwarty = (status: unknown): boolean =>
  klucz(status || 'OPEN') !== RAID_STATUS_KONCOWY;

const DZIEN_MS = 86_400_000;

/**
 * DNI PO TERMINIE — liczone WYŁĄCZNIE dla pozycji OTWARTEJ z terminem.
 * Pozycja zamknięta po terminie nie jest zaległością (ta sama reguła, którą
 * R3 zastosował do decyzji rozstrzygniętych).
 */
export const raidDniPoTerminie = (
  dueDate: unknown,
  status: unknown,
  teraz: number = Date.now()
): number | null => {
  if (!czyRaidOtwarty(status)) return null;
  if (!dueDate) return null;
  const termin = Date.parse(String(dueDate));
  if (Number.isNaN(termin) || termin >= teraz) return null;
  return Math.floor((teraz - termin) / DZIEN_MS);
};

/** Czy pozycja jest po terminie (otwarta + termin w przeszłości). */
export const czyRaidPoTerminie = (
  dueDate: unknown,
  status: unknown,
  teraz: number = Date.now()
): boolean => raidDniPoTerminie(dueDate, status, teraz) != null;

/**
 * ESKALACJA RYZYKA → PROBLEM (AUDYT_RYNKU_PMO §4.3, wzorzec Clarity:
 * nowy rekord ma „a link back to the originating Risk").
 *
 * `raid_items` nie ma kolumny `source_raid_id` (sprawdzone w
 * `information_schema` 07.09 — 28 kolumn, żadnej takiej), a paczka zabrania
 * migracji, gdy da się bez niej. Link do źródła idzie więc w OPISIE nowej
 * pozycji, w formacie, który da się odczytać maszynowo i okiem.
 */
export const ZNACZNIK_ZRODLA_RAID = 'ŹRÓDŁO-RAID:';

/** Opis nowej pozycji „Problem" powstałej z eskalacji ryzyka. */
export const opisEskalacjiRyzyka = (
  zrodloId: string,
  zrodloTytul: string,
  poprzedniOpis?: string | null
): string =>
  [
    `${ZNACZNIK_ZRODLA_RAID} ${zrodloId} — „${zrodloTytul}"`,
    poprzedniOpis?.trim() || null,
  ]
    .filter(Boolean)
    .join('\n');

/** Odczytuje identyfikator pozycji źródłowej z opisu (albo `null`). */
export const zrodloEskalacji = (opis: unknown): string | null => {
  const tekst = String(opis ?? '');
  const indeks = tekst.indexOf(ZNACZNIK_ZRODLA_RAID);
  if (indeks < 0) return null;
  const reszta = tekst.slice(indeks + ZNACZNIK_ZRODLA_RAID.length).trim();
  const id = reszta.split(/[\s—]/)[0]?.trim();
  return id || null;
};

/** Adnotacja dopisywana do pozycji ŹRÓDŁOWEJ po eskalacji. */
export const ZNACZNIK_PRZEKSZTALCENIA = 'PRZEKSZTAŁCONE-W-PROBLEM:';

export const opisPoPrzeksztalceniu = (
  problemId: string,
  poprzedniOpis?: string | null
): string =>
  [`${ZNACZNIK_PRZEKSZTALCENIA} ${problemId}`, poprzedniOpis?.trim() || null]
    .filter(Boolean)
    .join('\n');
