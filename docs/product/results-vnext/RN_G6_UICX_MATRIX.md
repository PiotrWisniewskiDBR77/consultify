# RN-G6-MATRIX — macierz UI/CX na jednym finalnym SHA

**HEAD (musi być identyczny przez cały dowód):** `4af92d207de475103a5736a649dae1460bb24065`
**Gałąź:** `rn-g6-matrix` (worktree `/Users/piotrwisniewski/rn-g2-lanes/g6-matrix`)
**Data przebiegu:** 2026-08-12 (wieczór)
**Środowisko:** własny backend (`:3101`) + własny frontend (`:3201`) na WSPÓLNYM
Postgresie z runbooka (port `55821`, gniazdo `/tmp/rn-g6-sock`, PID `38806`,
baza `rn_g6_runtime`) — **porty `3097`/`3197` (żywa sesja właściciela) nie
były dotykane**. Runbook: `docs/product/results-vnext/RN_G6_RUNTIME_ENVIRONMENT.md`.

**Status raportu:** W TRAKCIE — commitowany przyrostowo po każdej sekcji,
zgodnie z instrukcją orkiestratora. Sekcje bez wypełnionych wyników niżej są
jawnie oznaczone jako `W TOKU` lub `NIEWYKONANE`.

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

**Pozostałe interakcje z wymaganej listy — wykonane przez skrypt w tle,
wyniki w §3/§6/§7 poniżej: Enter→pełne narzędzie, Esc zwija jedną warstwę,
fokus wraca, przepływ klawiaturą, pułapka fokusu w modalu, zimny deep link,
przeładowanie zachowuje ustawienia.** Kebab na KPI/OKR, pstryczek kolumn i
zaznaczenie wielokrotne — patrz §8 NIEWYKONANE.

---

## 3. Presentation matrix (dark/light, PL/EN, viewporty, 125% zoom)

**Status: W TOKU (skrypt w tle).**

---

## 4. Macierz stanów (rejestr/podgląd/pełne narzędzie × stan)

**Status: W TOKU (skrypt w tle).**

---

## 5. ZNALEZIONE WADY

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

---

## 7. Dostępność

**Status: W TOKU (skrypt w tle, kontrast liczony na skomponowanym tle).**

---

## 8. NIEWYKONANE (lista pełna, aktualizowana)

- **Macierz 7 ról w całości** — powód: środowisko ma tylko 6 kont testowych
  (2 organizacje × po 1 OWNER/ADMIN/MEMBER/CONSULTANT/GUEST rozłożone
  nierówno — patrz §1), a model ról i tak odbija 3 z 5 ról org A na
  `/interview`; to ZNANE ograniczenie, nie nowe odkrycie.
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
- **Pstryczek kolumn, zaznaczenie wielokrotne, pułapka fokusu w modalu** —
  nie zweryfikowane manualnie z braku czasu w tej rundzie; skrypt w tle NIE
  obejmuje tych trzech interakcji (nie było ich w automatycznej sekcji
  keyboard/network probe, tylko w manualnej — a manualna runda skupiła się
  na klik/powrót/kebab). Do zrobienia w kolejnej turze jeśli czas pozwoli.
- **Sortowanie/przewinięcie — potwierdzenie żywe** — kod nie ma mechanizmu
  (patrz §5.2), ale nie zweryfikowano interaktywnie (kliknij sortuj →
  przejdź → wróć) z powodu presji czasu; oznaczone jako obserwacja kodowa,
  nie potwierdzony defekt.
- **Teresa (przepływ tworzenia z czatu)** — nie testowany w tej rundzie;
  globalny przycisk „AI currently unavailable" widoczny w topbarze na
  wszystkich zrzutach (patrz zrzuty) sugeruje że Teresa jest NIEDOSTĘPNA w
  tym środowisku lokalnym (prawdopodobnie brak klucza API/health monitor
  wyłączony przez `DISABLE_AI_HEALTH_MONITOR=true` w runbooku) — to może
  być stan środowiska testowego, NIE stan produkcyjny; nie rozstrzygnięte.

---

## 9. Czy ruszono coś poza allowlistą

**Nie.** Zmiany w tej sesji ograniczone do:
- `docs/product/results-vnext/RN_G6_UICX_MATRIX.md` (ten plik)
- `docs/qa/screens/rn-g6-uicx/**` (nowy katalog zrzutów)
- `scripts/rn-g6-uicx-matrix.mjs` (nowy skrypt)

Żaden plik w `src/`/`server/src/` nie był edytowany. Żadna mutacja danych
(Suspend/Approve/Archive/Submit/Edit) nie została wykonana na współdzielonym
seedzie — wszystkie interakcje w §2 kończące się na akcji zapisu zostały
POMINIĘTE celowo (kliknięto tylko nawigację/podgląd/kebab-bez-wyboru-akcji).
Backend/frontend własne na portach `3101`/`3201`; porty `3097`/`3197` (żywa
sesja właściciela) nietknięte. Postgres (PID `38806`) nie był zabijany.
`.claude/launch.json` nie był modyfikowany.
