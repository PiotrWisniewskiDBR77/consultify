/**
 * REJESTR KART N — jedno źródło prawdy „co jest prawidłowym komponentem".
 *
 * SPEC-N §5.4: „`src/components/standard/registry.ts` — jedno źródło: powierzchnia →
 * komponent → sekcja standardu → bramka. Z niego korzystają jednocześnie: test §5.3,
 * hook §5.2 i generowany przegląd »które ekrany są na standardzie«."
 *
 * Problem, który rozwiązuje: dziś nic w systemie nie wie, ile kart N istnieje ani
 * gdzie one są. Ósma karta może powstać niezgodna i nikt tego nie zauważy, bo nie ma
 * listy, względem której da się porównać. Rejestr jest tą listą.
 *
 * Fala F (fundament) — TEN PLIK NIE MIGRUJE ŻADNEJ KARTY. Wszystkie 7 wpisów startuje
 * ze `statusMigracji: 'przed'`; zmiana na 'zmigrowana' należy do fal M1–M7
 * (`_PLAN_WDROZENIA_KART_N_2026-07-21.md` §3) i jest jedyną edycją, jakiej ten plik
 * wtedy wymaga.
 *
 * Czytają go:
 *   · `scripts/karty-n-smoke.mjs` — bramka strukturalna (ekran harnessu istnieje
 *     i jest zarejestrowany w `dev-render/main.tsx`),
 *   · docelowo test zgodności ze SPEC-N §5.3 (render + 7 asercji runtime),
 *   · docelowo `scripts/check-artefakt.sh` (SPEC-N §5.2 — lista plików do sprawdzenia).
 */

/**
 * Klucze siedmiu kart N (SPEC-N §0A — Tool Document WYPADŁ z zakresu: jest wynikiem
 * PPT/Word/Excel, nie kartą).
 *
 * To jest miejsce, w którym widać ósmą kartę: dopisanie klucza do tego uniona bez
 * dopisania wpisu do `REJESTR_KART_N` psuje kompilację (`Record<KartaNKey, ...>`
 * wymaga kompletu kluczy). Odwrotnie też — wpis bez klucza w unionie nie przechodzi.
 */
export type KartaNKey =
  | 'tool'
  | 'initiative'
  | 'insight'
  | 'interview'
  | 'decision'
  | 'notification'
  | 'task';

/**
 * Klasa wielkości wg SPEC-A §12.2 (drabina otwierania) i SPEC-N §2.1:
 *   S = drawer, MAKSYMALNIE 4 sekcje lewej kolumny,
 *   L = pełna strona, bez limitu 4.
 */
export type KartaNKlasa = 'S' | 'L';

/**
 * Status migracji do kontraktu `StandardArtifactShell` (fala F1).
 * 'przed'      — karta działa na surowym `NModeShell`, kontrakt jej nie obowiązuje,
 * 'zmigrowana' — karta przeszła falę M i podlega bramkom SPEC-N §5.1–5.3.
 */
export type KartaNStatusMigracji = 'przed' | 'zmigrowana';

/** Identyfikator ekranu w harnessie `dev-render/main.tsx` (klucz obiektu SCREENS). */
export type KartaNEkranHarnessu =
  | 'karta-tool'
  | 'karta-initiative'
  | 'karta-insight'
  | 'karta-interview'
  | 'karta-decision'
  | 'karta-notification'
  | 'karta-task';

export interface KartaNWpis {
  /** Nazwa typu karty widoczna w raportach i tabeli smoke'a. */
  readonly nazwa: string;
  /** Ścieżka pliku komponentu względem korzenia repo. */
  readonly komponent: string;
  /** Klasa wielkości — patrz `KartaNKlasa`. */
  readonly klasa: KartaNKlasa;
  /** Odwołanie do paragrafu SPEC-N / planu wdrożenia, z którego wynika ten wiersz. */
  readonly paragraf: string;
  /** Ekran harnessu `dev-render` — zrzut PRZED/PO i bramka runtime. */
  readonly ekranHarnessu: KartaNEkranHarnessu;
  /** Status migracji — w fali F wszystkie 'przed'. */
  readonly statusMigracji: KartaNStatusMigracji;
}

/**
 * Siedem kart objętych standardem — pełne widoki, NIE panele boczne list.
 * Kolejność wpisów = kolejność migracji wg ciężaru (SPEC-N §6, plan §3: M1…M7).
 */
export const REJESTR_KART_N: Record<KartaNKey, KartaNWpis> = {
  tool: {
    nazwa: 'Tool',
    komponent: 'src/components/DiscoveryTools/KnownToolDetailView.tsx',
    // Klasa S: 4 sekcje lewej kolumny (plan §3 M1 — `aiContract` na 4 sekcjach),
    // czyli dokładnie limit klasy S ze SPEC-N §2.1.
    klasa: 'S',
    paragraf: 'SPEC-N §0A, §2.1 · plan §3 M1',
    ekranHarnessu: 'karta-tool',
    statusMigracji: 'przed',
  },
  notification: {
    nazwa: 'Notification',
    komponent: 'src/components/MyWork/NotificationDetailView.tsx',
    // Klasa S: decyzja SPEC-N §7 #3 — lżejszy podtyp „wiadomość systemowa",
    // skrócony panel (Właściwości + Historia), sekcja Komentarze znika (plan K2).
    klasa: 'S',
    paragraf: 'SPEC-N §7 #3 · plan §0A K2, §3 M2',
    ekranHarnessu: 'karta-notification',
    statusMigracji: 'przed',
  },
  interview: {
    nazwa: 'Interview Session',
    komponent: 'src/components/Interview/InterviewWorkspace.tsx',
    // Klasa L: jedna powłoka dla 3 wariantów runtime (decyzja SPEC-N §7 #5),
    // otwierana pełnostronicowo — nie mieści się w limicie 4 sekcji klasy S.
    klasa: 'L',
    paragraf: 'SPEC-N §7 #5 · plan §3 M3',
    ekranHarnessu: 'karta-interview',
    statusMigracji: 'przed',
  },
  decision: {
    nazwa: 'Decision',
    komponent: 'src/components/MyWork/DecisionDetailView.tsx',
    // Klasa L wg korekty K1: 8 sekcji treści, cięcie do 4 = utrata treści, nie porządek.
    // Drawer z listy (DecisionPreviewPanel) jest jej preview, nie samą kartą.
    klasa: 'L',
    paragraf: 'plan §0A K1 (korekta S→L wobec SPEC-N §7 #2) · plan §3 M4',
    ekranHarnessu: 'karta-decision',
    statusMigracji: 'przed',
  },
  insight: {
    nazwa: 'Insight',
    komponent: 'src/components/Interview/InsightViewer.tsx',
    // Klasa L: karta referencyjna warstwy dowodowej (`evidence`), pełnostronicowa.
    klasa: 'L',
    paragraf: 'SPEC-N §4A · plan §3 M5',
    ekranHarnessu: 'karta-insight',
    statusMigracji: 'przed',
  },
  task: {
    nazwa: 'Task',
    komponent: 'src/components/MyWork/TaskDetailView.tsx',
    // Klasa L wg korekty K1 (dziś kod deklaruje „Menu 1 (klasa S)" przy 10 sekcjach —
    // to jest ta sprzeczność klasyfikacji, którą K1 rozstrzyga na L).
    klasa: 'L',
    paragraf: 'plan §0A K1 (korekta S→L wobec SPEC-N §7 #2) · plan §3 M6',
    ekranHarnessu: 'karta-task',
    statusMigracji: 'przed',
  },
  initiative: {
    nazwa: 'Initiative',
    komponent: 'src/components/Initiatives/InitiativeDocumentView.tsx',
    // Klasa L: 26 sekcji, najcięższa karta (10 818 linii), prawy panel do zbudowania.
    klasa: 'L',
    paragraf: 'SPEC-N §2.2, §4A (P2) · plan §3 M7',
    ekranHarnessu: 'karta-initiative',
    statusMigracji: 'przed',
  },
};

/** Wszystkie klucze rejestru — do iteracji w testach i skryptach. */
export const KLUCZE_KART_N = Object.keys(REJESTR_KART_N) as KartaNKey[];

/** Wpisy jako tablica, w kolejności migracji M1…M7. */
export const WPISY_KART_N: readonly KartaNWpis[] = KLUCZE_KART_N.map((k) => REJESTR_KART_N[k]);

/**
 * Zwraca wpis rejestru dla klucza. Brak wpisu jest niewyrażalny typem
 * (`Record<KartaNKey, …>`), więc funkcja nie zwraca `undefined`.
 */
export function wpisKartyN(klucz: KartaNKey): KartaNWpis {
  return REJESTR_KART_N[klucz];
}

/**
 * Czy plik jest jedną z 7 kart N? Używa tego bramka `check-artefakt.sh` (SPEC-N §5.2),
 * żeby wiedzieć, na których plikach egzekwować zakaz `createPortal` i drugiego solid-CTA.
 */
export function czyKartaN(sciezkaPliku: string): boolean {
  const znorm = sciezkaPliku.replace(/^\.\//, '');
  return WPISY_KART_N.some((w) => znorm === w.komponent || znorm.endsWith(`/${w.komponent}`));
}
