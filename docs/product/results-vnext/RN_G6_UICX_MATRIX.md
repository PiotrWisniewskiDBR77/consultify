# RN-G6-MATRIX — macierz UI/CX na jednym finalnym SHA

**HEAD (musi być identyczny przez cały dowód):** `4af92d207de475103a5736a649dae1460bb24065`
**Gałąź:** `rn-g6-matrix` (worktree `/Users/piotrwisniewski/rn-g2-lanes/g6-matrix`)
**Data przebiegu:** 2026-08-12 (wieczór)
**Środowisko:** własny backend (`:3101`) + własny frontend (`:3201`) na WSPÓLNYM
Postgresie z runbooka (port `55821`, gniazdo `/tmp/rn-g6-sock`, PID `38806`,
baza `rn_g6_runtime`) — **porty `3097`/`3197` (żywa sesja właściciela) nie
były dotykane**. Runbook: `docs/product/results-vnext/RN_G6_RUNTIME_ENVIRONMENT.md`.

**Status raportu:** ZAMKNIĘTY dla zakresu wykonanego w tej sesji —
commitowany przyrostowo po każdej sekcji, zgodnie z instrukcją
orkiestratora. Pozycje spoza zakresu są jawnie wypisane w §8 NIEWYKONANE z
powodem, nie zmyślone.

## 0. Uwaga metodologiczna — baza jest żywa i współdzielona

Baza `rn_g6_runtime` jest w tej chwili używana równolegle przez inne tory
(widoczne żywo w trakcie tej sesji: nowe wiersze `KPI-G6-EVID-P0A-001`
pojawiające się w rejestrze KPI między jednym a drugim zrzutem, dodatkowe
sety OKR `RN-G6 C3 Gold Flow`/`RN-G6 C3 — cel testowy not_calculable` nie
opisane w oryginalnym runbooku z 2026-08-12 rano). Tam gdzie test zależy od
DOKŁADNEJ zawartości wiersza (np. „ile wierszy w tym filtrze") wynik może się
różnić minuta do minuty — nie jest to defekt tego programu, tylko właściwość
współdzielonego środowiska. Testy stanu/interakcji (czy kliknięcie robi to co
ma robić) są od tego niezależne i wiarygodne niezależnie od tego dryfu.
Żadna mutacja stanu (Suspend/Archive/Approve/Submit itp.) nie została
wykonana przez ten przebieg — patrz §9.

---

## 1. Macierz ról — kto dociera do `/results/*`

Zweryfikowane empirycznie na TYM SHA (nie przepisane z dokumentacji), skrypt
`scripts/rn-g6-uicx-matrix.mjs` sekcja `runRoleMatrix`, zrzuty
`docs/qa/screens/rn-g6-uicx/role-*.png`.

| rola (DB) | user | trasa docelowa | trasa finalna | dotarł? | błędy konsoli | odpowiedzi ≥400 |
|---|---|---|---|---|---|---|
| OWNER (org A) | rn-g6-user-a-owner | `/results/kpi?ff_resultsVNextKpi=1` | `/results/kpi` | TAK | 4 | 4 |
| ADMIN (org A) | rn-g6-user-a-admin | jw. | `/results/kpi` | TAK | 4 | 4 |
| MEMBER (org A, "contributor") | rn-g6-user-a-contributor | jw. | `/interview` | **NIE** | 4 | 4 |
| CONSULTANT (org A, "reviewer") | rn-g6-user-a-reviewer | jw. | `/interview` | **NIE** | 4 | 4 |
| GUEST (org A, "outsider") | rn-g6-user-a-outsider | jw. | `/interview` | **NIE** | 4 | 4 |
| ADMIN (org B, izolacja tenantów) | rn-g6-user-b-admin | jw. | `/results/kpi` | TAK | 4 | 4 |

**4 błędy konsoli / 4 odpowiedzi ≥400 są IDENTYCZNE na wszystkich sześciu
kontach** i pochodzą z dwóch globalnych, przed-istniejących źródeł
niezwiązanych z Results Next (zweryfikowane z treści odpowiedzi):
- `GET /api/v10/teresa/voice-config → 401` ×2 — strzelane PRZED zalogowaniem
  (brak tokenu), zanim `Api.login` się zakończy; nie odtwarza się po
  zalogowaniu.
- `GET /api/v8/admin/flags → 404` ×2 — ten sam przed-istniejący, globalny
  defekt opisany w `RN_G6_RUNTIME_ENVIRONMENT.md` §6 (strzela na KAŻDEJ
  stronie aplikacji, także `/chat`, nie coś co Results Next wprowadził).

**Wniosek — macierz 7 ról NIE jest wykonalna w całości na tym SHA:** tylko
OWNER i ADMIN (obie organizacje) faktycznie widzą `/results/*`. MEMBER,
CONSULTANT i GUEST są bezwarunkowo odbijane na `/interview` przez
`RouterSync.tsx`'s `isPilotRestrictedRole`, niezależnie od etykiety roli w
DB — to jest ZNANY, zapisany wcześniej defekt/ograniczenie modelu ról
(`RN_G6_RUNTIME_ENVIRONMENT.md` §7.1), nie coś odkrytego od nowa tutaj.
Siódma rola z pierwotnej macierzy (jeśli program zakładał więcej niż 6 kont
testowych) nie istnieje w seedzie tego środowiska — NIEWYKONALNE, powód:
brak konta.

---

## 2. Interakcje na trzech rejestrach — wynik ręcznej weryfikacji (Playwright headless + manualna sonda w przeglądarce)

Wykonane ręcznie/manualnie w tej sesji (nie tylko ze zrzutu — każde kliknięcie
faktycznie wykonane i zweryfikowany DOM/URL po nim), na koncie
`rn-g6-user-a-admin`, viewport 1440×900, dark, PL.

| # | Interakcja | Domena | Wynik | Dowód |
|---|---|---|---|---|
| 1 | Pojedynczy klik na wiersz → otwiera podgląd (panel z prawej) | KPI | DZIAŁA — panel z Property/Value, AI, Relations, akcje | manualne, opisane niżej |
| 2 | Ponowny klik na TEN SAM wiersz → nie nawiguje przypadkowo | KPI | DZIAŁA — URL bez zmian po drugim kliknięciu | manualne |
| 3 | Podwójny klik na wiersz → NIE nawiguje (w KPI nawigacja idzie przez przycisk „Open" w panelu, nie przez dblclick) | KPI | Zgodne z wzorcem (nie regresja — dblclick nie jest jedyną ścieżką) | manualne |
| 4 | Klik „Open" w panelu podglądu → pełne narzędzie | KPI | DZIAŁA — `/results/kpi/:id` | manualne |
| 5 | Esc z pełnego narzędzia (bez otwartej warstwy) | KPI | Brak zmiany URL — poprawne (nie ma czego zwijać) | manualne |
| 6 | **Powrót (strzałka „<") zachowuje filtr/zakładkę** | KPI | **DEFEKT — patrz §5.1.** Zakładka „Org" resetuje się do „My" | manualne, powtórzone 2× |
| 7 | Pojedynczy klik na wiersz → podgląd | ROI | DZIAŁA — panel z komunikatem „Registry preview — full ROI case editing is not built in this package yet" (jawny, uczciwy brak — nie ukryty) | manualne |
| 8 | Podwójny klik na wiersz | ROI | Nie nawiguje (spójne z KPI — nawigacja przez kebab, nie dblclick) | manualne |
| 9 | Kebab (⋮) na wierszu ROI → menu z 15 pozycjami (Open, Open full tool, przejścia cyklu życia w większości wyszarzone/niedostępne dla obecnego statusu, Open preview, Edit, Archive) | ROI | DZIAŁA, dobra semantyka wyszarzania (guard na etapie cyklu życia, nie tylko wizualnie ukryte) | manualne, zrzut |
| 10 | Kebab → „Open full tool” → `/results/roi/cases/:id` | ROI | DZIAŁA | manualne |
| 11 | **Powrót (breadcrumb „ROI registry") zachowuje chip-filtr „In progress” I zaznaczenie wiersza** | ROI | **DZIAŁA POPRAWNIE** — `sessionStorage` (`ResultsRoiHub.tsx:201-248`, klucz stanu UI, komentarz „RN-G5 — persist tab/chip/selection...") | manualne, powtórzone |
| 12 | Klik na wiersz OKR → podgląd z przyciskami „OKR workspace”/„Objectives” | OKR | DZIAŁA | manualne |
| 13 | „OKR workspace” → pełne narzędzie z zakładkami Overview/Objectives & Key Results/Alignment/Conversations & Support/Review & Reflection/History | OKR | DZIAŁA | manualne |
| 14 | **Powrót (breadcrumb „OKR sets") zachowuje chip-filtr „In progress”** | OKR | **DZIAŁA POPRAWNIE** — ten sam `sessionStorage`-wzorzec co ROI (`ResultsOkrHub.tsx:159`) | manualne, powtórzone |

### 2.1 Przepływ WYŁĄCZNIE klawiaturą (zweryfikowany precyzyjnie, skrypt `scripts/rn-g6-uicx-keyboard2.mjs`)

Ustalenie #1 wymaga korekty pierwotnego założenia zadania: **wiersz tabeli
NIE jest samodzielnie fokusowalny przez Tab** — pierwszym elementem
fokusowalnym w wierszu jest przycisk kebaba (⋮). To znaczy, że dosłowne
„Enter na zaznaczonym wierszu → pełne narzędzie" NIE istnieje jako pojedyncze
naciśnięcie klawisza z poziomu samego wiersza — ale ścieżka klawiaturowa DO
pełnego narzędzia istnieje i działa:

| krok | akcja | wynik |
|---|---|---|
| 1 | Tab (12 kroków od body przez chrome aplikacji) | fokus dociera do kebaba pierwszego wiersza — **widoczny pierścień fokusa** (niebieski, zrzut `kbd2-focused-kebab.png`) |
| 2 | Enter | otwiera dropdown menu (13 pozycji: Open, Open full tool, Measurements, Approve/Reject/Activate z powodami blokady, Open preview, Archive) |
| 3 | Esc | **zamyka TYLKO menu (jedna warstwa)** — zweryfikowane (`menuStillOpenAfterEsc: false`), URL bez zmian |
| 4 | (po Esc) | **fokus wraca na przycisk kebaba, który otworzył menu** — zweryfikowane (`focusReturnsToTriggerAfterEscFromMenu: true`) |
| 5 | Enter → ArrowDown ×2 → Enter | fokusuje i aktywuje pozycję „Open full tool" wyłącznie klawiaturą | 
| 6 | wynik | **nawigacja do `/results/kpi/:id` potwierdzona przez samą klawiaturę** (`keyboardOnlyReachedFullTool: true`) |
| 7 | Esc w pełnym narzędziu (brak otwartej warstwy) | **no-op** (`escFromFullToolNoLayerNoOp: true`) — poprawne, nie ma czego zwijać |

**Wniosek:** pułapka fokusu, widoczny fokus, jedna-warstwa-na-Esc i powrót
fokusu do wyzwalacza — WSZYSTKIE zweryfikowane pozytywnie na ścieżce
kebab→menu. Literalne „Enter na wierszu" nie istnieje, bo wiersz sam nie
jest przystankiem Tab — to GAP względem litery wymogu (przepływ jest o jeden
krok dłuższy niż „zaznacz wiersz, Enter"), ale NIE jest to martwy koniec ani
pułapka fokusu — oceniam jako niską wagę, patrz §5.5.

**Pozostałe interakcje z wymaganej listy — wykonane przez skrypt w tle,
wyniki w §3/§6/§7 poniżej: dark/light/PL/EN/viewporty, zimny deep link,
kontrast na skomponowanym tle.** Kebab na KPI zweryfikowany dogłębnie wyżej.
Pstryczek kolumn, zaznaczenie wielokrotne, przeładowanie zachowuje
ustawienia, pułapka fokusu w PRAWDZIWYM modalu (dialog, nie dropdown) —
patrz §8 NIEWYKONANE.

---

## 3. Presentation matrix (dark/light, PL/EN, viewporty, 125% zoom)

Skrypt `scripts/rn-g6-uicx-matrix.mjs` (`runPresentationMatrix`), konto
`rn-g6-user-a-admin`, zrzuty `docs/qa/screens/rn-g6-uicx/{kpi,roi,okr}-*.png`.

| wariant | rozdzielczość | motyw | język | wynik | błędy konsoli/≥400 |
|---|---|---|---|---|---|
| `kpi-1440-light-pl` | 1440×900 | light | PL | czysty, pełne tłumaczenie PL, brak mieszanych napisów | 4/4 (znane, patrz §1) |
| `kpi-1440-dark-pl` | 1440×900 | dark | PL | czysty | 4/4 |
| `kpi-1440-dark-en` | 1440×900 | dark | EN | czysty, pełne tłumaczenie EN | 4/4 |
| `kpi-1280-dark-pl` | 1280×720 | dark | PL | czysty, brak kolizji etykiet | 4/4 |
| `kpi-1600-dark-pl` | 1600×900 | dark | PL | czysty (diagnostyczny) | 4/4 |
| `kpi-1920-dark-pl` | 1920×1080 | dark | PL | czysty, tabela rozciąga się na pełną szerokość, brak twardego `max-width` (diagnostyczny, brak wymogu górnego capu) | 4/4 |
| `kpi-tablet-dark-pl` | 768×1024 | dark | PL | **patrz obserwacja niżej — tabela przewijana poziomo, zweryfikowana strukturalnie** | 4/4 |
| `kpi-1280-125pct-dark-pl` | 1280×720 + CSS zoom 1.25 (aproksymacja) | dark | PL | **DEFEKT — patrz §5.3** | 4/4 |
| `roi-1440-light-pl` | 1440×900 | light | PL | czysty | 4/4 |
| `roi-1440-dark-en` | 1440×900 | dark | EN | czysty | 4/4 |
| `okr-1440-light-pl` | 1440×900 | light | PL | czysty | 4/4 |
| `okr-1440-dark-en` | 1440×900 | dark | EN | czysty | 4/4 |

**Mechanizm zmiany motywu/języka zweryfikowany żywo** (nie tylko z dokumentacji):
`localStorage['consultify-storage'].state.theme` + `localStorage['i18nextLng']`
ustawione PRZED pierwszym renderem (`page.addInitScript`) poprawnie sterują
motywem i językiem od pierwszego malowania, bez FOUC. Żadna z 12 kombinacji
nie wprowadziła NOWEGO błędu konsoli/sieci ponad 2 znane, przed-istniejące
(`teresa/voice-config` 401, `admin/flags` 404) — dark/light/PL/EN/viewport
nie psują żadnego z trzech ekranów.

**Uwaga o 125% zoom:** Playwright nie ma prawdziwego zoomu przeglądarki —
użyto `document.documentElement.style.zoom='1.25'` na viewport 1280×720 jako
najbliższego analogu DOM-owego (dokumentowane ograniczenie, nie prawdziwy
zoom systemowy/przeglądarki). Efekt layoutu (obcięcie nagłówka kolumny) jest
realny niezależnie od dokładnego mechanizmu emulacji — patrz §5.3.

**Obserwacja — tablet 768×1024, zweryfikowana strukturalnie (nie tylko ze
zrzutu):** tabela KPI ma kontener `<div class="w-full overflow-x-auto">`
(potwierdzone `overflowX: 'auto'`, `scrollWidth=980` > `clientWidth=616`) —
przewijanie poziome MECHANICZNIE działa (nie jest to utrata treści), ale w
statycznym zrzucie ekranu (`kpi-tablet-dark-pl.png`) baner pustego stanu
„Brak wierszy pasujących do aktualnych filtrów." jest OBCIĘTY bez wielokropka
na krawędzi widocznego obszaru, bez żadnego wizualnego sygnału „przewiń, żeby
zobaczyć więcej" (brak gradientu zanikania, brak widocznego paska przewijania
na zrzucie). Sam pasek boczny (Menu 1) NIE zwija się/nie chowa się przy 768px
— zajmuje pełną szerokość jak na desktopie, dodatkowo zawężając obszar
roboczy. Klasyfikacja: **obserwacja UX średniej wagi, NIE potwierdzony
defekt funkcjonalny** (mechanizm przewijania istnieje i działa), do rozważenia
przy ewentualnym docelowym wsparciu tabletu.

---

## 4. Macierz stanów (rejestr/podgląd/pełne narzędzie × stan)

Skrypt `scripts/rn-g6-uicx-matrix.mjs` (`runStateMatrix`), konto
`rn-g6-user-a-admin` (org A) / `rn-g6-user-b-admin` (org B, empty), viewport
1440×900 dark. Zrzuty `docs/qa/screens/rn-g6-uicx/{kpi,roi,okr}-full-*.png`,
`*-not-found.png`, `*-empty-*.png`.

| domena | stan | trasa | wynik | błędy konsoli | odpowiedzi ≥400 |
|---|---|---|---|---|---|
| KPI | active | `kpi-full-active` | pełne narzędzie renderuje, pomiar `-2 450 320,75`, chipy critical/verified | 4 (znane) | 4 |
| KPI | draft | `kpi-full-draft` | renderuje, „brak danych" uczciwie | 4 | 4 |
| KPI | pending_approval | `kpi-full-pending` | renderuje | 4 | 4 |
| KPI | suspended | `kpi-full-suspended` | renderuje | 4 | 4 |
| KPI | archived | `kpi-full-archived` | renderuje | 4 | 4 |
| KPI | scorecard | `kpi-scorecard` | renderuje | 4 | 4 |
| KPI | not-found (losowy UUID) | `kpi-not-found` | **„You don't have access to this record" + kłódka + „Back"** — patrz §5.4 | 7 (4 znane + 3× 404 z samego zapytania o brakujący zasób, OCZEKIWANE) | 7 |
| ROI | modeling (Build Case, brak calc run) | `roi-full-modeling` | „No record" dla Baseline/Calculation policy — uczciwy brak | 8 (4 znane + 4× 404 na `/baseline`,`/calculation-policy`, KAŻDY ×2 — patrz uwaga niżej) | 8 |
| ROI | approved (Decision) | `roi-full-approved` | jw. | 8 | 8 |
| ROI | tracking (Realize Value) | `roi-full-tracking` | jw. | 8 | 8 |
| ROI | post_investment_review (Learn) | `roi-full-pir` | jw. | 8 | 8 |
| ROI | changes_requested (`not_calculable` literal wg seed docs) | `roi-full-changes-requested` | jw., uczciwy brak, brak crasha | 8 | 8 |
| ROI | closed (terminal/locked) | `roi-full-closed-locked` | tytuł sprawy zawiera „sprawa zamknięta, tylko odczyt"; lifecycle-guardy poprawnie blokują wszystkie przejścia (patrz §2/§6) | 8 | 8 |
| ROI | not-found | `roi-not-found` | ten sam fail-closed wzorzec co KPI | 6 (4 znane + 2× 404 na samo zapytanie o sprawę, OCZEKIWANE) | 6 |
| OKR | active, watch, 58%→86% (dryf danych między przebiegami, patrz §0) | `okr-full-active-watch` | renderuje poprawnie | 4 | 4 |
| OKR | draft, not_calculable | `okr-full-draft-notcalc` | „—" dla progress/confidence, uczciwe | 4 | 4 |
| OKR | closed (terminal/locked) | `okr-full-closed-locked` | wszystkie przejścia lifecycle poprawnie zablokowane z powodem | 4 | 4 |
| OKR | not-found | `okr-not-found` | ten sam fail-closed wzorzec | 6 (4 znane + 2× 404 oczekiwane) | 6 |
| KPI | pusty (org B, zakładka „My") | `kpi-empty-orgB-my-tab` | „No rows match the current filters" | 4 | 4 |
| OKR | pusty (org B — program tylko draft, 0 setów) | `okr-empty-orgB` | renderuje pusty rejestr bez crasha | 4 | 4 |

**Uwaga o podwójnych 404 na ROI (`/baseline`, `/calculation-policy` KAŻDY
wywołany 2×):** zweryfikowane, że te 404 występują IDENTYCZNIE na
WSZYSTKICH sześciu stanach ROI niezależnie od fazy/statusu sprawy — to
sugeruje, że komponent zawsze odpytuje te dwa endpointy i traktuje 404 jako
sygnał „No record" (zweryfikowane wizualnie — brak crasha, czysty napis „No
record"), NIE że któryś konkretny stan ma unikalny błąd. Podwojenie
wywołania (ten sam URL 2×) jest spójne z podwójnym wywołaniem efektów w
React 18 StrictMode w trybie dev (Vite dev server) — **nie jest to
potwierdzone jako defekt produkcyjny** (StrictMode nie działa w buildzie
produkcyjnym), tylko odnotowane jako obserwacja tego środowiska.

**Empty/empty-after-filter:** zweryfikowane dla org B (lekki zestaw danych)
— zarówno KPI (zakładka „My", 0/0) jak i OKR (0 setów, program tylko draft)
renderują czysty komunikat pustego stanu bez crasha. „Pusty PO filtrze" (a
nie „pusty od zawsze") zweryfikowany ręcznie w §2 (filtr „In progress" na
ROI/OKR, „Org" na KPI z 0 dopasowań nie było testowane wprost, ale mechanizm
identyczny jak dla org B).

---

## 5. ZNALEZIONE WADY

**Skrót (7 pozycji, szczegóły niżej):**

| # | tytuł | waga | plik:linia |
|---|---|---|---|
| 5.1 | Rejestr KPI resetuje zakładkę „Org" po powrocie z pełnego narzędzia | WYSOKA | `ResultsKpiRegistryPage.tsx:689` |
| 5.2 | Brak persystencji sortowania/przewinięcia we WSZYSTKICH 3 domenach (obserwacja kodowa) | do potwierdzenia | — |
| 5.3 | Nagłówek „ZAKTUALIZOWANO" obcina się bez wielokropka przy 1280+125% | ŚREDNIA | `FilterableTable.tsx:697-746` |
| 5.4 | „Nie znaleziono" nieodróżnialne od „brak uprawnień" (obserwacja, może być celowe) | do decyzji | — |
| 5.5 | „Enter na wierszu" nie istnieje — wiersz nie jest przystankiem Tab | NISKA | `FilterableTable.tsx` (wiersz) |
| 5.6 | Stopka OKR pokazuje literalny komentarz deweloperski „file:line citations in okrWorkspaceMappers.ts" | ŚREDNIA | `OkrSetOverviewView.tsx:278-280` |
| 5.7 | Zduplikowana etykieta w powodzie blokady OKR („Approve: Approve: requires…") | NISKA | `okrWorkspaceMappers.ts:180` + `OkrSetOverviewView.tsx:266` |
| 5.8 | Brak `aria-sort` na sortowalnym nagłówku (cała aplikacja, nie tylko Results Next) | ŚREDNIA-WYSOKA | `FilterableTable.tsx:697` |

### 5.1 DEFEKT — Rejestr KPI nie zachowuje zakładki „Org" po powrocie z pełnego narzędzia

**Plik:** `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx:689`
```ts
const [tab, setTab] = useState<'my' | 'org' | 'scorecards'>('my');
```

**Kroki odtworzenia (zweryfikowane 2× ręcznie w tej sesji):**
1. Zaloguj się jako `rn-g6-user-a-admin@consultify.local`.
2. Otwórz `/results/kpi?ff_resultsVNextKpi=1` — domyślna zakładka „My" jest
   pusta (0 wierszy, „No rows match the current filters" — poprawne, użytkownik
   nie jest właścicielem żadnego seedowanego KPI).
3. Kliknij zakładkę „Org" — pojawia się 8-9 wierszy (KPI-A-001…006 +
   KPI-G6-*).
4. Kliknij dowolny wiersz → panel podglądu → przycisk „Open" → pełne
   narzędzie (`/results/kpi/:id`).
5. Kliknij strzałkę powrotu („<") w lewym górnym rogu pełnego narzędzia.
6. **Obserwacja:** rejestr wraca na zakładkę „My" (0 wierszy, „No rows match
   the current filters"), NIE na „Org", mimo że użytkownik jawnie wybrał
   „Org" przed nawigacją. URL po powrocie: `/results/kpi` (bez parametru
   zakładki).

**Przyczyna źródłowa:** `tab` jest zwykłym `useState` inicjalizowanym na
stałą `'my'`, bez żadnego mechanizmu odczytu/zapisu (URL, `sessionStorage`,
router state) — komponent remontuje się od zera przy każdym powrocie na
trasę `/results/kpi`.

**Kontrast z resztą programu (dowód, że to NIE jest "tak ma być"):** ROI
(`src/components/ResultsVNext/roi/ResultsRoiHub.tsx:201-248`) i OKR
(`src/components/ResultsVNext/okr/ResultsOkrHub.tsx:159` + analogiczny
`readOkrHubUiState`/`writeOkrHubUiState`) mają dokładnie ten sam problem
ROZWIĄZANY przez `sessionStorage`, z jawnym komentarzem w kodzie ROI:
```
// RN-G5 — persist tab/chip/selection so navigating to the full tool
// (`ROUTES.RESULTS_ROI.CASE`) and back restores the list context instead
// of resetting to defaults on remount.
```
Zweryfikowano ŻYWO (nie tylko w kodzie), że ROI i OKR faktycznie działają
poprawnie — patrz §2 wiersze 11 i 14. KPI nigdy nie dostał tej samej łatki
mimo że „RN-G5" był krokiem wspólnym dla całego programu Results Next.

**Konsekwencja:** bezpośrednie złamanie wymogu programu „powrót zachowuje
filtr, sortowanie, przewinięcie i zaznaczenie" — dla KPI tylko dla filtra/
zakładki (sortowanie i przewinięcie nie mają w ogóle mechanizmu persystencji
w ŻADNEJ z trzech domen, patrz §5.2). Użytkownik z dużym rejestrem KPI (org
z wieloma kartami) traci kontekst pracy przy każdym „zerknij i wróć" —
codzienny wzorzec pracy audytora/ownera KPI.

**Waga:** WYSOKA — dotyczy podstawowej pętli pracy (przegląd→szczegóły→powrót)
na najczęściej używanym z trzech rejestrów, ma już gotowy wzorzec naprawy w
dwóch siostrzanych plikach (kopiuj-wklej ryzyko niskie).

**Status:** zapisany do osobnego toru naprawy przez orkiestratora — TA sesja
(weryfikator) NIE naprawia.

### 5.2 OBSERWACJA (nie klasyfikowana jako defekt — brak wymaganej persystencji sortowania/przewinięcia we WSZYSTKICH trzech domenach)

Przegląd źródeł `ResultsKpiRegistryPage.tsx`, `ResultsRoiHub.tsx`,
`ResultsOkrHub.tsx`: żaden z trzech rejestrów nie persystuje stanu
SORTOWANIA kolumny ani POZYCJI PRZEWINIĘCIA (grep za `scrollTop`/
`sortState`/podobnym w tych plikach — zero trafień poza opisanym wyżej
tab/chip/selection w ROI/OKR). Wymóg programu explicite wymienia
„filtr, sortowanie, przewinięcie i zaznaczenie" jako jeden pakiet — obecnie
TYLKO filtr+zaznaczenie są objęte (i tylko w ROI/OKR). Nie podnoszę tego do
rangi osobnego "defektu" bo nie zweryfikowałem jeszcze żywo (kolumny
rejestrów są krótkie, 3-9 wierszy, więc scroll nie jest obecnie
obserwowalny na tych danych) — flaguję jako lukę do potwierdzenia, patrz §8.

### 5.3 DEFEKT — nagłówek kolumny „ZAKTUALIZOWANO" obcina się bez wielokropka przy 1280px + 125% zoom

**Plik:** `src/components/shared/ModuleHub/FilterableTable.tsx` (nagłówek
`<th>` linia 697, przycisk sortujący linia 738-746) — komponent WSPÓLNY dla
`StandardTable` używanego przez wszystkie trzy ekrany.

**Kroki odtworzenia:** zaloguj się, otwórz `/results/kpi?ff_resultsVNextKpi=1`
na viewport 1280×720, ustaw `document.documentElement.style.zoom='1.25'`
(aproksymacja 125% — patrz zastrzeżenie w §3), zakładka „Organizacja".

**Obserwacja (zrzut `kpi-1280-125pct-dark-pl.png`):** najdłuższy nagłówek
kolumny „ZAKTUALIZOWANO" renderuje się jako **„ZAKT"** — twarde obcięcie BEZ
wielokropka (`…`), więc dla użytkownika wygląda jak urwany/zepsuty tekst, nie
jak celowe skrócenie. Pozostałe nagłówki („KOD KPI", „WŁAŚCICIEL", „PROCES")
mieszczą się bez problemu — to konkretnie najdłuższe polskie słowo w
zestawie nagłówków tej tabeli, dokładnie scenariusz z wymogu programu
„długie polskie etykiety przy 1280 i 125%".

**Konsekwencja:** czytelność nagłówka kolumny „Zaktualizowano" ginie w tej
kombinacji rozdzielczość+zoom — użytkownik nie wie, co oznacza kolumna bez
najechania/zgadywania.

**Zastrzeżenie metodologiczne:** 125% zoom zaemulowano przez CSS
`zoom` (Playwright nie ma prawdziwego zoomu przeglądarki) na viewport
1280×720 — efektywna szerokość dostępna dla treści jest analogiczna do
prawdziwego zoomu przeglądarki 125% na fizycznym 1280px, ale mechanizm
renderowania może się nieznacznie różnić od faktycznego przeglądarkowego
page zoom. Efekt (obcięcie tekstu nagłówka) jest jednak zgodny z tym, czego
należałoby oczekiwać przy realnym zawężeniu dostępnej szerokości kolumny.

**Waga:** ŚREDNIA — dotyczy czytelności, nie funkcjonalności (kolumna nadal
sortowalna, dane nadal czytelne), ale bezpośrednio trafia w explicite
wymieniony scenariusz testowy programu.

### 5.4 OBSERWACJA — stan „nie znaleziono" jest nieodróżnialny od „brak uprawnień" (fail-closed) we wszystkich trzech domenach

**Zrzuty:** `kpi-not-found.png`, `roi-not-found.png`, `okr-not-found.png` —
identyczny ekran we wszystkich trzech: kłódka, „You don't have access to
this record", „No visibility record exists for this item — treated as
denied by default.", przycisk „Back".

**Obserwacja:** nawigacja do losowego, nieistniejącego UUID w KAŻDEJ z
trzech domen zwraca ten sam komunikat co dostęp do istniejącego, ale
niewidocznego dla użytkownika zasobu — czyli „ten obiekt nie istnieje" i
„ten obiekt istnieje, ale nie wolno ci go zobaczyć" są NIEODRÓŻNIALNE z
perspektywy UI. Backend zwraca w obu przypadkach ten sam 404 na
`GET /api/vnext/results/{domena}/.../:id` (zweryfikowane w §4 — sieć), więc
to nie jest niespójność frontendu, tylko świadomy (albo przynajmniej
konsekwentny) wzorzec „fail-closed"/„deny by default" widoczny w treści
komunikatu.

**Nie klasyfikuję tego jako defekt bez decyzji integratora** — maskowanie
"not found" jako "access denied" jest uznanym wzorcem bezpieczeństwa
(zapobiega enumeracji ID przez odróżnienie odpowiedzi), więc może być
CELOWE. Odnotowuję jako obserwację do potwierdzenia: jeśli intencją NIE
było ukrycie istnienia obiektu (np. zwykły martwy link po usunięciu KPI),
użytkownik dostaje mylącą informację „nie masz dostępu" zamiast „ten
rekord już nie istnieje", co utrudnia self-service (nie wie, czy prosić o
dostęp, czy zaakceptować że rekord zniknął). Przycisk „Back" działa
identycznie w obu interpretacjach, więc funkcjonalnie brak zerwania.

### 5.5 DEFEKT (niska waga) — literalne „Enter na wierszu → pełne narzędzie" nie istnieje; wiersz nie jest przystankiem Tab

Patrz pełny opis i dowód w §2.1. Skrót: pierwszym fokusowalnym elementem w
wierszu tabeli jest przycisk kebaba, nie sam wiersz — więc nie da się
nacisnąć Enter „na wierszu" żeby otworzyć pełne narzędzie jednym klawiszem,
trzeba przejść przez menu kebaba (Enter→Strzałka→Strzałka→Enter). Ścieżka
klawiaturowa DZIAŁA i jest bezpieczna (widoczny fokus, jedna warstwa na Esc,
powrót fokusu) — to gap względem litery wymogu, nie martwy koniec.

**Plik:** wzorzec dotyczy struktury wiersza w `FilterableTable.tsx` (brak
`tabIndex`/obsługi klawiatury na `<tr>` lub jego kontenerze) — nie
zlokalizowano dokładnej linii z braku czasu, tylko potwierdzono zachowanie
żywo.

**Waga:** NISKA — funkcjonalnie osiągalne, tylko dłuższa ścieżka niż litera
wymogu sugeruje.

### 5.6 DEFEKT (treść) — stopka przeglądu zestawu OKR zawiera literalny komentarz deweloperski „see file:line citations in okrWorkspaceMappers.ts"

**Plik:** `src/components/ResultsVNext/okr/OkrSetOverviewView.tsx:278-280`
```tsx
{isPolish
  ? 'Każdy przycisk stosuje regułę serwera 1:1 — patrz cytaty plik:linia w okrWorkspaceMappers.ts.'
  : 'Every button mirrors the server rule 1:1 — see file:line citations in okrWorkspaceMappers.ts.'}
```

**Kroki odtworzenia:** zaloguj się jako `rn-g6-user-a-admin`, otwórz
dowolny zestaw OKR w pełnym narzędziu (`/results/okr/sets/:id`), zakładka
„Overview"/„Przegląd" (domyślna) — pod przyciskami „Set lifecycle" widoczna
jest zielona ikona ✓ i ten tekst jako stały footer (widoczny na KAŻDYM
zestawie OKR, nie tylko w stanach błędu — zrzuty
`okr-full-draft-notcalc.png`, `okr-full-active-watch.png`,
`okr-full-closed-locked.png` wszystkie go pokazują).

**Konsekwencja:** to jest surowa nazwa pliku źródłowego (`okrWorkspaceMappers.ts`)
i wewnętrzny żargon inżynierski („cytaty plik:linia") wprost w interfejsie,
który OWNER/ADMIN widzi za każdym razem przeglądając dowolny zestaw OKR — w
obu językach (PL i EN, więc to nie przeoczenie tłumacza, ktoś świadomie
przetłumaczył tę linijkę). Żaden użytkownik biznesowy nie ma dostępu ani
potrzeby do pliku źródłowego repozytorium. Wygląda na notatkę zostawioną
dla siebie/QA podczas budowy funkcji bramkowania przycisków cyklu życia,
nigdy nie usuniętą przed odsłonięciem ekranu.

**Waga:** ŚREDNIA — nie łamie funkcji, ale nieprofesjonalne dla realnego
klienta/demo; łatwe do przeoczenia bo tekst jest szary/drugoplanowy, ale
widoczny na 100% ekranów OKR.

### 5.7 DEFEKT (treść, drobny) — zduplikowana etykieta w powodzie blokady przycisku cyklu życia OKR („Approve: Approve: requires…")

**Pliki:**
- `src/components/ResultsVNext/okr/okrWorkspaceMappers.ts:180` — buduje
  komunikat już zaczynający się od nazwy akcji:
  `` en: `${action.en}: requires status ${allowedList}, current status is "${current}".` ``
- `src/components/ResultsVNext/okr/OkrSetOverviewView.tsx:266` — dokleja
  etykietę PONOWNIE przed tym komunikatem: `{a.label}: {isPolish ? a.gate!.pl : a.gate!.en}`

**Efekt widoczny na zrzucie** (`okr-full-closed-locked.png` i pokrewne):
„Approve: Approve: requires status submitted, current status is 'closed'.",
„Activate: Activate: requires status approved, current status is
'closed'." — nazwa akcji zduplikowana na początku każdego z 4-5 powodów
blokady widocznych pod przyciskami cyklu życia, na każdym zestawie OKR w
każdym stanie.

**Waga:** NISKA — kosmetyczny defekt treści, czytelny mimo powtórzenia, ale
konsekwentnie widoczny na każdym ekranie OKR z zablokowanymi przejściami
(czyli w praktyce na większości zestawów poza „draft" ze statusem
zezwalającym na jedną konkretną akcję).

---

## 6. Standard graficzny — obserwacje wstępne

- Status **nigdy nie jest tylko kolorem** — każdy chip statusu (Active/Draft/
  Pending approval/Suspended/Archived w KPI; Modeling/Approved/Tracking/
  Post-investment review/Changes requested/Closed w ROI; Draft/Active/Closed
  w OKR) niesie tekstową etykietę obok koloru. Zgodne z wymogiem.
- Fazy zamknięte/terminalne (ROI: Approved/Tracking/Post-investment review/
  Closed; OKR: sety zamknięte) mają dodatkową ikonę kłódki obok statusu —
  dobry, nie-kolorowy sygnał "locked" niezależny od chipa.
- Menu 1 (lewy pasek modułów) i Menu 2 (górne zakładki rejestru) obecne i
  spójne między KPI/ROI/OKR.
- **Obserwacja poza allowlistą, tylko odnotowana:** globalny pasek chrome
  (poza komponentami Results Next) ma pigułkę „● Model" wypełnioną
  kolorem wyglądającym na crimson/bordo obok neutralnej „Data" — jeśli to
  faktycznie `primary`/crimson token, byłoby to naruszenie zakazu z
  `TRIADA_KANON.md` linia 87/147, ALE element ten należy do globalnego
  chrome aplikacji (poza `src/components/ResultsVNext/**`), nie do żadnego
  z trzech ekranów w zakresie tej macierzy — nie audytowany dalej, tylko
  odnotowany dla integratora.
- Pełne narzędzie KPI używa powłoki SPEC-A (Menu 1 + prawy panel accordion
  Actions/Properties/Relations) — pełne narzędzie ROI (faza Build Case) NIE
  używa tej samej powłoki (breadcrumb + zakładki poziome + StandardTable
  bez prawego accordion panelu). To NIE jest oceniane tutaj jako "defekt"
  bez konsultacji z `ARTIFACT_ANATOMY_STANDARD.md` (mogą to być różne,
  celowo różne archetypy — Rekord vs Matryca) — odnotowane jako pytanie do
  integratora, nie jako stwierdzony defekt.
- **Pozytyw — kolor destrukcyjny poprawnie odizolowany:** na ekranie
  zestawu OKR jedyny czerwony/crimson wypełniony przycisk to „Cancel set"
  (destrukcyjny), wszystkie pozostałe przyciski cyklu życia
  (Submit/Approve/Request changes/Activate/Open review) są neutralne —
  zgodne z zakazem „crimson tylko semantyka krytyczna, CTA/aktywne =
  neutralne" (zrzuty `okr-full-*.png`).
- **Pozytyw — powody blokady akcji są jawne, nie tylko wyszarzenie:** kebab
  KPI i przyciski cyklu życia OKR/ROI pokazują TEKSTOWY powód niedostępności
  akcji (np. „Activation requires an approved KPI definition version…"),
  nie tylko wyłączają przycisk bez wyjaśnienia — dobra praktyka
  odnaleziona wielokrotnie, choć jeden z tych tekstów sam jest wadliwy
  (§5.6, §5.7).

---

## 6.1 Sieć — opóźnienie/timeout i błąd+ponowienie (KPI, reprezentatywny dla wzorca)

Skrypt `runNetworkFaultProbe` przechwytuje WYŁĄCZNIE żądania własnej karty
przeglądarki (`page.route`) — brak wpływu na serwer/inne sesje.

**Opóźnienie sieci (8s na każdą odpowiedź `/api/vnext/results/**`):**
zrzut w locie (`kpi-network-delay-inflight.png`) pokazuje **poprawny
SKELETON LOADER** (3 animowane placeholdery wierszy z shimmer) zamiast
pustego ekranu lub zawieszenia — dobry wzorzec stanu „ładowanie". Po
rozwiązaniu (9,9s) ekran wraca do normalnego rejestru bez błędu.

**Twardy błąd sieci (`route.abort('failed')` na wszystkich żądaniach
`/api/vnext/results/kpi**`):** zrzut `kpi-network-abort-error-state.png` —
czerwona ikona ostrzeżenia (poprawne użycie czerwieni — semantyka błędu, nie
CTA), komunikat **„Could not reach the server. Check your connection and
try again."**, przycisk **„Try again"** z ikoną odświeżenia. **Zweryfikowano
że przycisk FAKTYCZNIE DZIAŁA** (pierwszy przebieg skryptu miał błąd we
własnym selektorze — szukał tekstu „Retry"/„Ponów"/„Spróbuj", którego UI nie
używa; poprawiony przebieg z selektorem `button:has-text("Try again")`
potwierdza: kliknięcie ponawia żądanie i po zdjęciu blokady sieciowej
rejestr wraca do normalnego stanu, zrzut
`kpi-network-abort-retry-succeeded.png`). **Stan „udane ponowienie" —
POTWIERDZONY POZYTYWNIE.**

Błędy konsoli podczas tej sondy zawierają, oprócz 2 znanych par (§1),
`[ResultsVNext] request failed: TypeError: Failed to fetch` ze śladem
stosu — zgodnie z przypomnieniem orkiestratora **to jest ZAMIERZONE**
(helper `shared/errorMessage.ts` wysyła surowy komunikat do telemetrii),
NIE zgłaszam tego jako defekt.

## 6.2 Zimny deep link (fresh context, bezpośrednio na URL obiektu)

| trasa docelowa | otworzył WŁAŚCIWY obiekt? | finalna ścieżka |
|---|---|---|
| KPI pending_approval (`KPI-A-004`) | **TAK** | `/results/kpi/4d5db4f5-…` |
| ROI tracking (Realize Value) | **TAK** | `/results/roi/cases/4d60dfcc-…` |
| OKR set active/watch | **TAK** | `/results/okr/sets/f772dd20-…` |

Wszystkie trzy — świeży kontekst przeglądarki (brak wcześniejszej
nawigacji po rejestrze), logowanie, potem BEZPOŚREDNIO URL obiektu —
otworzyły dokładnie żądany obiekt, nie rejestr ani błąd. **Wymóg „zimny
deep link otwiera właściwy obiekt" — POTWIERDZONY dla wszystkich trzech
domen.**

---

## 7. Dostępność

Skrypt pierwotny miał błąd (zrzut z ekranem ładowania zamiast
zarenderowanej tabeli — zera w pierwszym przebiegu były ARTEFAKTEM
własnego skryptu, NIE realnym wynikiem; poprawiono i uruchomiono ponownie
z jawnym oczekiwaniem na treść tabeli przed pomiarem). Dane niżej pochodzą z
POPRAWIONEGO przebiegu (`/tmp/rerun-a11y.mjs` → 
`docs/qa/screens/rn-g6-uicx/uicx-a11y-v2-report.json`,
zrzut `a11y-kpi-registry-org-tab-v2.png`), rejestr KPI, zakładka
„Organizacja", dark, PL, 1440×900.

### 7.1 Sygnały DOM

| sygnał | wynik |
|---|---|
| `role="table"`/`<table>` | 1 — natywny element `<table>` (potwierdzone `tagName==='TABLE'`), więc `<tr>`/`<th>` mają NIEJAWNĄ semantykę ARIA row/columnheader automatycznie — brak `role="row"` w DOM (0) jest OCZEKIWANY, nie luka |
| `role="tablist"`/`role="tab"` | 4 |
| `role="columnheader"`/`<th>` | 6 (5 kolumn danych + 1 kolumna ustawień) |
| `role="menu"`/`role="menuitem"` | 0 na statycznym rejestrze (menu istnieje tylko po otwarciu kebaba — nie testowane w TYM przebiegu, ale otwarte i zweryfikowane w §2.1 z poprawną semantyką interakcji) |
| `role="dialog"` | 0 (brak otwartego modala w tym przebiegu — pułapka fokusu w PRAWDZIWYM dialogu nieprzetestowana, patrz §8) |
| `aria-sort` | **0 — DEFEKT, patrz §5.8** |
| `aria-live` | 0 na tym ekranie (istnieje gdzie indziej w kodzie — `TeresaProposalPanel.tsx`, toasty czatu — ale nie na tej trasie w tym stanie) |
| przyciski tylko-ikona | **34/34 mają dostępną nazwę** (`aria-label` lub `title`) — 0 brakujących |

### 5.8 DEFEKT — brak `aria-sort` na sortowalnym nagłówku kolumny (StandardTable/FilterableTable, wspólne dla całej aplikacji)

**Plik:** `src/components/shared/ModuleHub/FilterableTable.tsx:697` (`<th>`)
i `:738-746` (przycisk sortujący wewnątrz), stan sortowania dostępny lokalnie
jako `sort` (`{ columnId, direction }`, linia 613) — DOKŁADNIE w zasięgu w
miejscu renderowania `<th>`, więc dodanie `aria-sort` byłoby mechanicznie
proste (`aria-sort={sort?.columnId === column.id ? (sort.direction==='asc'?'ascending':'descending') : undefined}`
na `<th>`).

**Kroki odtworzenia:** otwórz `/results/kpi?ff_resultsVNextKpi=1`, zakładka
Organizacja (domyślnie posortowane po „Zaktualizowano" malejąco — widoczna
strzałka ↓ w nagłówku), zbadaj DOM `<th>` odpowiadający kolumnie
„Zaktualizowano" — `aria-sort` jest `null`/nieobecny mimo wizualnej
strzałki sortowania.

**Zasięg:** `FilterableTable` to WSPÓLNY komponent bazowy `StandardTable` —
ten sam brak dotyczy każdej listy w aplikacji zbudowanej na standardzie
Triada (nie tylko KPI/ROI/OKR), więc naprawa w jednym miejscu naprawiłaby
całą aplikację.

**Konsekwencja:** czytnik ekranu nie ogłasza aktualnego kierunku sortowania
kolumny — użytkownik niewidomy nie wie, że tabela jest posortowana ani po
czym, tylko po wizualnej strzałce.

**Waga:** ŚREDNIA-WYSOKA — bezpośrednio dotyczy explicite wymienionego w
zadaniu punktu „aria-sort", dotyczy całej aplikacji (nie tylko trzech
ekranów tego programu), łatwa naprawa z jasną lokalizacją.

### 7.2 Kontrast na skomponowanym tle (nie na gołym kolorze)

Metoda: dla każdego próbkowanego elementu tekstowego obliczono tło przez
przejście w górę drzewa DOM i skomponowanie WSZYSTKICH nieprzezroczystych
warstw tła (strona → panele → karty → chip), zgodnie z wymogiem „liczenie
na gołym tle dało w tym programie fałszywy wynik" z instrukcji zadania.
Wzór WCAG 2.2 (`(L1+0.05)/(L2+0.05)`, luminancja względna sRGB). 30 unikalnych
próbek tekstu z rejestru KPI (dark, PL, zakładka Organizacja).

**Wynik: 29/30 przechodzi próg AA dla zwykłego tekstu (≥4,5:1); wszystkie 30/30
przechodzą próg AA dla dużego tekstu (≥3:1).**

| element | fg (rgb) | tło skomponowane (rgb) | rozmiar/waga | ratio | AA zwykły | AA duży |
|---|---|---|---|---|---|---|
| logo „77" (marka) | `(200,50,74)` | `(10,15,30)` | 20px/700 | **3.65** | **NIE** | TAK (duży pogrubiony ≥18.7px kwalifikuje) |
| pigułka „Model" | `(255,255,255)` | `(37,21,43)` | 12px | 17.20 | TAK | TAK |
| nagłówki kolumn (Kod KPI/Status/…) | `(148,163,184)` | `(14,22,40)` | 11px | 7.04 | TAK | TAK |
| treść wiersza (kod KPI, właściciel, data) | `(244,247,251)` | `(14,21,38)` | 16px | 16.94 | TAK | TAK |
| chipy filtrów (Szkic/Aktywny/…) | `(138,153,176)` | `(15,23,42)` | 11px | 6.18 | TAK | TAK |
| liczniki chipów | `(203,213,225)` | `(42,54,85)` | 10px | 8.05 | TAK | TAK |
| „Nowy KPI" (CTA, jasne tło) | `(10,15,30)` | `(244,247,251)` | 14px | 17.77 | TAK | TAK |
| zakładki Menu 2 (Moje/Organizacja) | `(203,213,225)`/`(241,245,249)` | `(25,32,51)`/`(15,23,42)` | 14px | 10.9-16.3 | TAK | TAK |

**Jedyny fail:** logo marki „77" w lewym górnym rogu — 3.65:1 dla zwykłego
tekstu (próg 4,5:1), ALE tekst jest 20px/waga 700 (pogrubiony), co
kwalifikuje się jako „duży tekst" wg WCAG (próg dla pogrubionego ≥14pt≈18.7px)
— przy progu 3:1 dla dużego tekstu **PRZECHODZI**. Kolor `rgb(200,50,74)`
(≈`#C8324A`) to jaśniejszy odcień crimsonu niż kanoniczny `#85182F` — zgodnie
z `TRIADA_KANON.md` linia 190, crimson jest dozwolony „TYLKO marka/nic-UI",
a to jest DOKŁADNIE znak marki, więc użycie jest zgodne z regułą, nie
naruszeniem.

**Wniosek:** żaden faktyczny fail AA nie został znaleziony na próbce 30
elementów rejestru KPI liczonej na skomponowanym tle — kontrast tego ekranu
jest solidny. Nie przebadano kontrastu wewnątrz kebab-menu (tło dropdownu)
ani wewnątrz pełnego narzędzia (np. duży czerwony wskaźnik „-2 450 320,75"
na KPI-A-001) — patrz §8 NIEWYKONANE.

---

## 8. NIEWYKONANE (lista pełna)

- **Macierz 7 ról w całości** — powód: środowisko ma tylko 6 kont testowych
  (2 organizacje × po 1 OWNER/ADMIN/MEMBER/CONSULTANT/GUEST rozłożone
  nierówno — patrz §1), a model ról i tak odbija 3 z 5 ról org A na
  `/interview`; to ZNANE ograniczenie, nie nowe odkrycie. Wykonane dla
  WSZYSTKICH 6 dostępnych kont (§1).
- **Stany saving/saved/save-failed/stale-conflict** — powód: wymagałyby
  faktycznej mutacji (Suspend/Approve/Edit) na WSPÓŁDZIELONYCH danych
  seedowych używanych przez inne równoległe tory (KPI-A-001..006, ROI
  case'y, OKR sety mają identyfikatory na stałe wpisane w inne skrypty tej
  sesji) — świadomie NIE wykonane, żeby nie zepsuć cudzych fixture'ów
  (zakaz z briefu: „ZERO zmian kodu produkcyjnego" + zasada nienaruszania
  danych używanych przez inne tory).
- **Legacy tylko do odczytu** — powód: nie znaleziono w seedzie encji
  oznaczonej jako "legacy read-only" dla żadnej z trzech domen; bez dostępu
  do zapisu (patrz punkt wyżej) nie da się jej też wytworzyć bezpiecznie.
- **Pstryczek kolumn, zaznaczenie wielokrotne** — nie zweryfikowane manualnie
  ani skryptowo z braku czasu w tej rundzie (widoczne w UI — ikona ustawień
  kolumn w prawym rogu nagłówka tabeli, checkbox „zaznacz wszystko" w
  kodzie `FilterableTable.tsx:709-725` — ale interakcja nieprzeklikana).
- **Pułapka fokusu w PRAWDZIWYM modalu (dialog)** — kebab-dropdown
  zweryfikowany dogłębnie (§2.1) i zachowuje się poprawnie (Esc=jedna
  warstwa, fokus wraca), ale to NIE jest `role="dialog"` (0 dialogów
  wykryto w §7.1) — żaden prawdziwy modal (np. potwierdzenie usunięcia,
  formularz „New KPI"/„New ROI case") nie został otwarty i przetestowany
  pod kątem uwięzienia fokusu (Tab nie wychodzi poza modal).
- **Przeładowanie zachowuje ustawienia** — zweryfikowany mechanizm
  persystencji (`sessionStorage` dla ROI/OKR, brak dla KPI — §5.1) tylko
  pod kątem nawigacji Back, NIE pod kątem twardego odświeżenia strony
  (F5/`location.reload()`), które w przypadku `sessionStorage` powinno
  działać identycznie (przetrwa reload karty), ale nie zweryfikowano
  wprost eksperymentem.
- **Sortowanie/przewinięcie — potwierdzenie żywe** — kod nie ma mechanizmu
  persystencji (patrz §5.2), ale nie zweryfikowano interaktywnie (kliknij
  sortuj → przejdź → wróć, przewiń długą listę → przejdź → wróć) — dane
  seedowe (3-9 wierszy) są za krótkie żeby przewijanie było w ogóle
  obserwowalne; oznaczone jako obserwacja kodowa, nie potwierdzony defekt
  na żywym ekranie.
- **Teresa (przepływ tworzenia z czatu, panel propozycji)** — nie testowany
  interaktywnie w tej rundzie; globalny przycisk „AI currently unavailable"
  widoczny w topbarze na WSZYSTKICH zrzutach (69 zrzutów przejrzanych)
  potwierdza stan „Teresa niedostępna" jako REALNY, ŻYWY stan tego
  środowiska (nie zasymulowany) — prawdopodobnie brak klucza API w env
  lokalnym (`DISABLE_AI_HEALTH_MONITOR=true` w runbooku wyłącza tylko
  monitor zdrowia, nie tłumaczy braku klucza) — czy to jest stan wyłącznie
  środowiska testowego czy też występuje na demo/produkcji NIE
  rozstrzygnięte w tej sesji.
- **Kontrast wewnątrz kebab-dropdown i wewnątrz pełnego narzędzia** (np.
  duży czerwony wskaźnik „-2 450 320,75" na KPI-A-001, chipy „critical"/
  „verified") — próbka 30 elementów w §7.2 objęła tylko rejestr KPI (zakładka
  Organizacja); nie przeliczono kontrastu wewnątrz otwartego menu ani na
  ekranach pełnych narzędzi KPI/ROI/OKR.
- **`prefers-reduced-motion`** — nie zweryfikowano czy animacje (spinner
  ładowania, przejścia zakładek) respektują tę preferencję systemową.
- **PL/EN mieszane napisy wewnątrz pełnych narzędzi ROI/OKR (poza
  rejestrem)** — §3 objęła tylko ekrany rejestru pod kątem PL/EN; pełne
  narzędzia (zakładki Baseline & policy/Assumptions/… w ROI, Overview/
  Objectives/… w OKR) nie zostały przełączone i sprawdzone pod kątem
  kompletności tłumaczenia — ryzyko na podstawie samego kodu OKR
  (`OkrSetOverviewView.tsx:278-280` ma PEŁNE tłumaczenie obu wersji nawet
  wadliwej linijki z §5.6, więc lokalizacja WYGLĄDA kompletna, ale
  nieprzeklikana systematycznie).

---

## 9. Czy ruszono coś poza allowlistą

**Nie.** Zmiany w tej sesji ograniczone do plików w allowlist:
- `docs/product/results-vnext/RN_G6_UICX_MATRIX.md` (ten plik)
- `docs/qa/screens/rn-g6-uicx/**` (nowy katalog zrzutów + raporty JSON)
- `scripts/rn-g6-uicx-matrix.mjs` (główny skrypt macierzy)
- `scripts/rn-g6-uicx-keyboard2.mjs` (uzupełniający skrypt sondy klawiatury)

Kilka jednorazowych skryptów pomocniczych do weryfikacji semantyki DOM/
kontrastu/tabletu zostało napisanych i uruchomionych z `/tmp/` (POZA
repozytorium, nie commitowane, nie wchodzą w allowlist bo nie są w repo w
ogóle) — ich wyjście zostało wklejone do tego raportu, same pliki nie są
częścią dowodu i zostały pozostawione w `/tmp/` (nie sprzątnięte, ale też
nigdy nie były w drzewie repo).

Żaden plik w `src/`/`server/src/` nie był edytowany — wszystkie file:line w
§5 to WYNIK CZYTANIA kodu, nie zmiana. Żadna mutacja danych (Suspend/
Approve/Archive/Submit/Edit) nie została wykonana na współdzielonym
seedzie — wszystkie interakcje w §2/§2.1 kończące się PRZED akcją zapisu
zostały celowo zatrzymane (kliknięto/klawiszowano tylko nawigację/podgląd/
otwarcie-i-zamknięcie kebaba, nigdy pozycję menu która by coś zmieniła).
Backend/frontend własne na portach `3101`/`3201`; porty `3097`/`3197` (żywa
sesja właściciela) nietknięte przez cały przebieg. Postgres (PID `38806`)
nie był zabijany, żaden `pkill -f` nie został użyty — wyłącznie precyzyjne
PID-y własnych procesów (backend/frontend), zatrzymane pojedynczym `kill`
(patrz §10). `.claude/launch.json` nie był modyfikowany (backend/frontend
uruchomione bezpośrednio przez `npx`, nie przez launch.json/preview_start).

---

## 10. Sprzątanie na koniec sesji

Własny backend (`:3101`, PID zmienny — sprawdzony `lsof -iTCP -sTCP:LISTEN`
przed zamknięciem) i frontend (`:3201`) zatrzymane precyzyjnymi PID-ami po
zakończeniu przebiegu skryptów. Postgres współdzielony (PID `38806`)
POZOSTAWIONY URUCHOMIONY — używają go inne tory i sesja właściciela, zgodnie
z instrukcją „NIE ZABIJAJ". Żadne dane w bazie nie zostały zmienione przez
tę sesję (tylko odczyty SELECT do ustalenia ID + normalny ruch GET z
aplikacji).
