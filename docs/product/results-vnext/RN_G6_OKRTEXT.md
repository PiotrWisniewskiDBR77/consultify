# RN-G6 lane `okrtext` — raport wykonawcy

Worktree: `/Users/piotrwisniewski/rn-g2-lanes/g6-okrtext`, gałąź `rn-g6-okrtext`.
HEAD wejściowy: `9fc60a47c8`. HEAD po pracy: **`442096f9a6`**.

Commit:
- `442096f9a6` — `fix(results-vnext/okr): remove dev-note leaks and doubled gate prefix in Set Overview`
  (2 pliki: `src/components/ResultsVNext/okr/OkrSetOverviewView.tsx`,
  `tests/components/ResultsVNext/okr/OkrSetOverviewView.test.tsx`).

`git status --short` na koniec: tylko `docs/qa/screens/rn-g6-okrtext/` (nowe, nieśledzone —
zrzuty tego raportu). Zero innych zmian w drzewie roboczym.

---

## Defekt 1 — komentarz deweloperski w interfejsie

**Znaleziono DWA wycieki w `OkrSetOverviewView.tsx`, nie jeden:**

1. `OkrSetOverviewView.tsx:275-282` (stopka sekcji cyklu życia, widoczna na
   **każdym** ekranie przeglądu zestawu OKR gdy nie ma błędu i nic się nie
   przetwarza):
   - PL było: *„Każdy przycisk stosuje regułę serwera 1:1 — patrz cytaty
     plik:linia w okrWorkspaceMappers.ts."*
   - EN było: *„Every button mirrors the server rule 1:1 — see file:line
     citations in okrWorkspaceMappers.ts."*
2. **Drugi, wcześniej niezgłoszony wyciek**: `OkrSetOverviewView.tsx:114-118`
   — tooltip `notCalculableReason` na czipie „n/a" w wierszu „Postęp ogólny",
   pokazywany gdy wartość jest `'not_calculable'`:
   - PL było: *„Zestaw nie rozróżnia „brak danych" od „nieobliczalne" na
     drucie — patrz nagłówek okrWorkspaceApi.ts (OQ-UI-C)."*
   - EN było: *„The Set cannot distinguish „no data" from „not calculable"
     on the wire — see okrWorkspaceApi.ts header (OQ-UI-C)."*
   Tu wyciekała NIE TYLKO nazwa pliku, ale i wewnętrzny numer zagadnienia
   (`OQ-UI-C`) oraz żargon „na drucie"/„on the wire".
   Uwaga uczciwości: `parseOkrProgress()` (w `okrRegistryMappers.ts`,
   poza allowlistą, tylko odczyt) obecnie NIGDY nie zwraca
   `'not_calculable'` dla tego pola — komentarz w źródle wprost to mówi
   („unreachable from real API data for this specific field today"). Ta
   gałąź kodu jest dziś martwa w praktyce, ale prop nadal istnieje i
   pozostawienie w nim żargonu było utajonym długiem — poprawione mimo
   niskiego ryzyka trafienia na żywo.

**Co wybrałem i dlaczego**: zostawiłem WYŁĄCZNIE część sensowną dla
użytkownika (że dostępność/gating akcji odzwierciedla regułę wymaganą przez
serwer — to uczciwa, użyteczna informacja: „to nie jest ozdoba UI, serwer
naprawdę to wymusza"), **usuwając odwołanie do pliku źródłowego** w obu
miejscach:

- Stopka PL: *„Dostępność każdego przycisku odzwierciedla regułę wymaganą
  przez serwer."* / EN: *„Each button's availability reflects the rule
  enforced by the server."*
- Tooltip PL: *„Postępu nie można obliczyć — nie da się ustalić, czy to
  brak danych, czy wzór, którego nie da się wyliczyć."* / EN: *„Progress
  cannot be calculated — it is not possible to tell whether this is
  missing data or a formula that cannot be computed."*

Uzasadnienie wyboru „skróć, nie usuń": pełne skasowanie zdania ukryłoby
przed użytkownikiem fakt, że blokada przycisku NIE jest arbitralna — to
prawdziwa, przydatna informacja o systemie. Samo odwołanie do pliku
źródłowego (`okrWorkspaceMappers.ts`, `okrWorkspaceApi.ts`, numer
`OQ-UI-C`) nie niesie ŻADNEJ wartości dla klienta — stąd cięcie dokładnie w
tym miejscu.

**Pełny przegląd `okr/` (34 pliki .ts/.tsx) pod kątem podobnych wycieków** —
grep po `.ts`/`.tsx` w cudzysłowach, `plik:linia`, `file:line`, nazwach
plików źródłowych (`okrSetCommands`, `okrCarryForwardCommands`,
`okrReviewCommands`, `okrCycleCommands`, `OQ-UI`, `TODO`/`HACK`/`FIXME`,
`citation`) **wewnątrz literałów stringowych, z pominięciem komentarzy
kodu** (te nie renderują się użytkownikowi):

- **Wynik: TYLKO powyższe dwa miejsca w całym katalogu `okr/` mają wyciek
  do interfejsu.** Wszystkie pozostałe trafienia greppa to komentarze
  kodu (`// D09 fix — see OkrObjectivesView.tsx...`,
  `// Gate table — 1:1 with okrCycleCommands.ts L442-487's named specs.`,
  itp.) — nigdy nie trafiają do JSX/tekstu widocznego dla użytkownika.
  Sprawdzone osobno grepem po `isPolish ? '...'` i po treści literałów
  string poza liniami zaczynającymi się od `//`/`*`/`/*`.
- Nic do zgłoszenia poza allowlistą z tego zakresu — obie naprawy mieszczą
  się w `OkrSetOverviewView.tsx`, w allowliście.

---

## Defekt 2 — zdublowana etykieta w powodzie blokady

**Która warstwa jest właścicielem prefiksu i dlaczego**: **mapper
(`okrWorkspaceMappers.ts`)**. Dowód, nie założenie:

1. `reasonWrongStatus()` (linia 176-182) już buduje `{pl,en}` z nazwą akcji
   wklejoną NA WEJŚCIU: `` `${action.pl}: wymaga statusu ${allowedList}...` ``
   — wywoływana z `gateSubmit`, `gateRequestChanges`, `gateActivate`,
   `gateOpenReview`, `gateCancel`, `gateClose`, `gateCarryForward`.
2. `gateApprove()`'s gałąź samo-akceptacji (linia 194-199) robi to samo
   ręcznie: `'Akceptacja: autor złożenia nie może...'`.
3. **Tooltip przycisku** (`title={... isPolish ? action.gate.pl :
   action.gate.en}`, `OkrSetOverviewView.tsx:245`) renderuje gate.pl/en
   **BEZ ŻADNEGO dodatkowego prefiksu** — i to jest poprawne, bo mapper już
   go dołożył. Gdyby prefiks miał należeć do widoku, tooltip byłby ślepy
   (pokazywałby samo „wymaga statusu..." bez nazwy akcji).
4. **Siostrzany widok `OkrReviewReflectionView.tsx`** (poza allowlistą,
   tylko odczyt) — jego cztery gate'y (`gateClose`, `gateCarryForward`,
   `gateSelfReview`, `gateManagerReviewSubmit`) renderują się identycznie w
   `title=` ORAZ w akapicie powodu (linie 297-298/309, 322-323/364,
   526-527/550-551) — **zawsze bez dodatkowego prefiksu z widoku**. To
   ISTNIEJĄCA, poprawna konwencja gdzie indziej w tym samym katalogu.

Wniosek: `OkrSetOverviewView.tsx`'s akapit powodów (linia 261-267 przed
poprawką) był JEDYNYM miejscem w całym `okr/`, które doklejało własny
prefiks (`{a.label}: `) NA WIERZCHU tekstu, który mapper już prefiksował —
niespójne z własnym tooltipem tego samego przycisku i z konwencją siostrzanego
widoku.

**Poprawka**: usunięto `{a.label}: ` z akapitu powodu w
`OkrSetOverviewView.tsx` (teraz renderuje bare `gate.pl`/`gate.en`,
identycznie jak `title=` i jak `OkrReviewReflectionView.tsx`). Mapper NIE
został zmieniony — jest już poprawnym, jedynym właścicielem prefiksu.

**Dodatkowa poprawka spójności** (ten sam widok, ta sama zasada): lokalny,
niepochodzący z mappera obiekt gate'u dla `requestChanges` (fallback „podaj
powód", gdy `requestChangesGate` jest `null`, ale pole notatek puste) NIE
miał żadnego prefiksu — po usunięciu prefiksu z widoku zniknęłoby wskazanie
KTÓREJ akcji dotyczy powód w stosie kilku jednoczesnych powodów. Dołożono
mu własny prefiks `„Żądanie poprawek: "`/`„Request changes: "` w miejscu
budowy tego obiektu (`OkrSetOverviewView.tsx`), zgodnie z tą samą
konwencją co mapper — **nie w miejscu renderowania** (to nadal ta sama
zasada „prefiks doklejany raz, u źródła tekstu", tylko że źródłem dla tego
JEDNEGO gate'u jest lokalny literał w widoku, bo mapper go nie zna).

**Czy wzorzec dotyczył innych akcji**: TAK, wszystkich sześciu akcji cyklu
życia obsługiwanych przez ten widok (submit/approve/requestChanges/
activate/openReview/cancel) — każda korzysta z `reasonWrongStatus()` albo
(dla `approve`) z ręcznie prefiksowanej gałęzi samo-akceptacji, więc każda
miała ten sam podwójny prefiks przed poprawką. Potwierdzone na żywo (patrz
zrzuty) dla czterech jednocześnie zablokowanych akcji na jednym zestawie
(status `draft`): Approve, Request changes, Activate, Open review — oraz
osobno dla piątej ścieżki (gałąź samo-akceptacji `gateApprove`, status
`submitted`, aktor = `submittedBy`) testem jednostkowym.

Bezpieczeństwo (D06): treść żadnego powodu nie została zmieniona — tylko
sposób ich składania. Powód samo-akceptacji pozostaje ogólny (nie ujawnia
niczego o istnieniu/właścicielu innych obiektów poza już wcześniej
widocznym faktem, że to TEN zestaw wymaga innego akceptującego).

---

## Defekt 3 — obcięty nagłówek „ZAKTUALIZOWANO" bez wielokropka

**Zgłaszam, NIE naprawiam** — przyczyna leży w komponencie wspólnym poza
allowlistą.

**Lokalizacja renderowania nagłówka kolumny** (jedyne miejsce w repo, gdzie
`<th>`+etykieta kolumny tabeli listy się renderuje — `StandardTable.tsx`
tylko deleguje):
`src/components/shared/ModuleHub/FilterableTable.tsx:697-748`
(`<th>` ze stylem `width`/`minWidth`/`maxWidth` w px na linii 699-704; sam
tekst kolumny w `<span>{column.label}</span>` na liniach 744/748 — **bez
`truncate`/`overflow:hidden`/`text-overflow:ellipsis`/`white-space:nowrap`
w ogóle**). Ta ścieżka jest poza allowlistą tej sesji (`shared/**`
zakazane) i, jak wynika z audytu TRIADA (MEMORY `audyt-triada-speca-bramki-2026-07-26`),
jest współdzielona przez WSZYSTKIE tabele listowe w produkcie, nie tylko
OKR — poprawka tu wykracza poza „ekran OKR", to zmiana kanonu tabel.

**Zmierzony, realny dowód przeciążenia** (żywy render, nie zgadywanie) —
`document.querySelectorAll('th')`, nagłówek „ZAKTUALIZOWANO" w rejestrze
zestawów OKR, zalogowany jako `rn-g6-user-a-admin`, dane z realnego
Postgresa:

```json
{ "offsetWidth": 130, "scrollWidth": 145, "text": "Zaktualizowano" }
```

Tekst nagłówka jest **o 15px (≈11.5%) szerszy niż jego własny box już przy
100% zoomu** — to jest przyczyna strukturalna: kolumna dostaje domyślną
szerokość px (nie liczoną z treści etykiety), etykieta w tłumaczeniu PL
(„Zaktualizowano", 14 znaków, `uppercase tracking-wider`) w tym default nie
mieści się, a `<span>` nie ma żadnej reguły truncate/ellipsis. Sąsiadująca
kolumna „ustawień" (`Settings2`, sticky, z nieprzezroczystym tłem,
`FilterableTable.tsx:771+`) potrafi wizualnie „zjeść" nadmiar bez śladu
wielokropka — to najbardziej prawdopodobny mechanizm „ZAKT" bez „…" opisany
przez właściciela.

**Czego NIE udało się odtworzyć 1:1**: dokładnego „1280px + 125% zoom" ze
zgłoszenia. To środowisko automatyzacji (Claude Browser / Playwright headless)
nie eksponuje prawdziwego poziomu zoomu przeglądarki — próbowałem dwóch
przybliżeń:
- `document.body.style.zoom='125%'` — nie zmienia `window.innerWidth`, więc
  nie zmienia relacji tekst/box (zoom skaluje oba jednakowo);
- zawężenie viewportu do `1280/1.25≈1024px` (przybliżenie efektywnej
  szerokości layoutu przy realnym zoomie przeglądarki) — przy TEJ
  konkretnej tabeli (3 wiersze, mało kolumn) kolumna „ZAKTUALIZOWANO"
  renderuje się w pełni nawet w 1024px (patrz
  `defect3-registry-1024w-approx125pct-after.png`), bo szerokości kolumn w
  tym komponencie są sztywnymi px, nie procentami viewportu — zawężenie
  okna samo w sobie tylko uruchamia scroll poziomy całej tabeli, nie
  zawęża pojedynczej kolumny.

Wniosek: przeciążenie 145px/130px jest realne i zmierzone niezależnie od
zoomu; dokładny mechanizm, przez który realny zoom przeglądarki przy
1280px/125% zamienia je w widoczne „ZAKT" bez „…", nie został odtworzony
piksel-w-piksel tym narzędziem — ale lokalizacja i przyczyna strukturalna
(brak truncate/ellipsis na etykiecie kolumny w `FilterableTable.tsx`) są
potwierdzone pomiarem na żywych danych, nie domysłem.

**Rekomendacja dla sesji właścicielskiej `shared/**`**: dodać
`overflow-hidden text-ellipsis whitespace-nowrap` (lub odpowiednik) na
`<span>{column.label}</span>` (`FilterableTable.tsx:744` i `:748`) + `title=
{column.label}` jako fallback tooltip — analogicznie do wzorca już
istniejącego w wierszach danych (`FilterableTable.tsx:982`, `'block
truncate'`). To naprawia WSZYSTKIE tabele listowe naraz, nie tylko OKR.

---

## Środowisko live (nie za flagą, nie dev-render)

Uruchomione WŁASNE kopie (nie dotknięto 3097/3197 właściciela ani 3101/3201,
3105/3205 innych torów):
- Backend: port **3107** (`server/src/index.ts`, `DATABASE_URL` →
  `rn_g6_runtime` na Postgresie `55821`, PID nadzorowanego procesu — zabity
  precyzyjnie po pracy, nie `pkill -f`).
- Frontend: port **3207** (`vite --port 3207 --strictPort`,
  `VITE_API_TARGET=http://127.0.0.1:3107`).
- Login: `rn-g6-user-a-admin@consultify.local` / `RnG6Runtime!2026` (wg
  `RN_G6_TESTDRIVE_DLA_PIOTRA.md`).
- Zestaw testowy: „RN-G6 C3 — cel testowy not_calculable" (status `draft` —
  4 z 6 akcji cyklu życia jednocześnie zablokowane: Approve, Request
  changes, Activate, Open review).

Oba procesy zatrzymane po pracy (`kill` na precyzyjnych PID-ach, zweryfikowanych
przez `ps -p <pid> -o command=` przed zabiciem — nigdy `pkill -f`).
PostgreSQL `55821`/PID `38806` **nietknięty**.

---

## Zrzuty (`docs/qa/screens/rn-g6-okrtext/`)

Wszystkie z realnej aplikacji (backend+Postgres+frontend, zalogowany
użytkownik), nie z dev-render/mocka.

| Plik | Co pokazuje |
|---|---|
| `defect1-2-before-pl.png` | Overview zestawu `draft`, PL, PRZED: stopka z `plik:linia w okrWorkspaceMappers.ts`; 4 powody z podwójnym prefiksem (`Zaakceptuj: Akceptacja:`, `Żądaj poprawek: Żądanie poprawek:`, `Aktywuj: Aktywacja:`, `Otwórz przegląd: Otwarcie przeglądu:`) |
| `defect1-2-after-pl.png` | To samo, PO: stopka bez odwołania do pliku; 4 powody z pojedynczym prefiksem |
| `defect1-2-before-en.png` | Jak wyżej, EN: `file:line citations`; `Approve: Approve:`, `Request changes: Request changes:`, `Activate: Activate:`, `Open review: Open review:` |
| `defect1-2-after-en.png` | To samo, PO, EN: pojedynczy prefiks + `Each button's availability reflects the rule enforced by the server.` |
| `defect3-registry-1280-100pct-{before,after}.png` | Rejestr OKR, 1280px, 100% zoom — identyczne przed/po (nietknięte), „UWAGA"/„ZAKTUALIZOWANO" poza widokiem bez przewinięcia poziomego kontenera tabeli |
| `defect3-registry-1024w-approx125pct-{before,after}.png` | Przybliżenie zawężonego viewportu — „ZAKTUALIZOWANO" renderuje się w pełni nawet tu (patrz zastrzeżenie w sekcji Defekt 3) |
| `defect3-header-overflow-measurement-{before,after}.json` | `{offsetWidth:130, scrollWidth:145}` — identyczne przed/po, dowód że box nagłówka jest o 15px za wąski niezależnie od mojej pracy |

**Co kliknięto (defekt 2 — stan realnie zablokowany, nie stan początkowy)**:
zalogowano się → rejestr OKR (Organizacja) → kliknięto wiersz „RN-G6 C3 —
cel testowy not_calculable" (status `Szkic`/`Draft`) → otworzył się panel
podglądu → kliknięto „Obszar roboczy OKR"/„OKR Workspace" → zakładka
„Przegląd"/„Overview" (domyślna) → przewinięto sekcję do dołu, żeby w kadrze
były jednocześnie WSZYSTKIE cztery zablokowane powody + stopka. Przyciski
Approve/Request changes/Activate/Open review są realnie `disabled` (status
zestawu to `draft`, nie `submitted`/`approved`/`active`) — to nie jest
zrzut stanu początkowego udający zablokowanie, guziki naprawdę nie reagują
na klik w tym stanie.

---

## Liczby: błędy konsoli i odpowiedzi ≥400

Zmierzone automatycznie (Playwright `page.on('console')`/`page.on('response')`)
na finalnym, poprawionym stanie, dla każdego z czterech ekranów z tabeli
zrzutów powyżej — **identyczne dla wszystkich czterech**:

- **4 błędy konsoli**, **4 odpowiedzi ≥400**:
  - `401 GET /api/v10/teresa/voice-config` ×2
  - `404 GET /api/v8/admin/flags` ×2

Oba są **preistniejącym, nieskorelowanym z tą pracą** stanem tego lokalnego
środowiska (Teresa voice-config i admin/flags — infrastruktura spoza
zakresu OKR Set Overview, żaden plik z mojej allowlisty ich nie wywołuje;
`RN_G6_TESTDRIVE_DLA_PIOTRA.md`/`RN_G6_B3_ROUTE_INVENTORY.md` już
dokumentują znane luki tego środowiska). Nie zmieniły się między stanem
przed i po mojej poprawce (te same dwa endpointy, ta sama liczba, w obu
wariantach ręcznej weryfikacji w przeglądarce interaktywnej — Approve
draft/submitted i defekt-3 registry — przed uruchomieniem zautomatyzowanego
pomiaru).

---

## Testy

`tests/components/ResultsVNext/okr/OkrSetOverviewView.test.tsx` (nowy plik,
`git add` bez `-f` — nie jest ignorowany), 5 testów:

1. Defekt 1 PL: tekst renderu nie zawiera `okrWorkspaceMappers.ts` ani
   `plik:linia`; zawiera nadal coś sensownego (`/serwer/i`).
2. Defekt 1 EN: analogicznie, `file:line`/`server`.
3. Defekt 2 PL: dla statusu `draft` (4 zablokowane akcje) tekst NIE pasuje
   do wzorców podwójnego prefiksu (`Zaakceptuj:\s*Akceptacja:` itd.) i
   NADAL zawiera pojedynczy prefiks mappera (`Akceptacja: wymaga statusu`
   itd. — dowód, że to relokacja własności, nie skasowanie etykiety).
4. Defekt 2 EN: analogicznie.
5. Defekt 2 PL, gałąź samo-akceptacji `gateApprove` (status `submitted`,
   aktor = `submittedBy`) — DRUGI kod źródłowy prefiksu w mapperze (nie
   `reasonWrongStatus`), też sprawdzony osobno.

**Kontrola negatywna (wykonana, nie tylko zadeklarowana)**: przywrócono
ręcznie oba defekty w źródle (`{a.label}: ` przed gate.pl/en; stary tekst
stopki z `plik:linia`/`file:line`) → `npx vitest run
tests/components/ResultsVNext/okr/OkrSetOverviewView.test.tsx` → **5/5
CZERWONE**, komunikaty m.in.:

```
AssertionError: expected 'Właściwości zestawu...' not to contain 'okrWorkspaceMappers.ts'
AssertionError: expected '...' not to match /Zaakceptuj:\s*Akceptacja:/
```

→ cofnięto do naprawionej wersji → **5/5 ZIELONE** ponownie (potwierdzone
drugim przebiegiem po przywróceniu z backupu pliku).

---

## Bramki

Wszystkie uruchomione PO commicie `442096f9a6`, exit code odczytany
bezpośrednio z `$?`:

- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → **exit 0**,
  0 linii w logu (brak błędów, nie OOM-134).
- `npx vite build` → **exit 0**, `✓ built in 36.88s` (tylko standardowe
  ostrzeżenie o dużych chunkach, niezwiązane z tą zmianą).
- `bash scripts/check-list-canon.sh` → **exit 0**: „brak NOWYCH naruszeń
  kanonu tabel (pełny skan: 162 plików; naruszeń **408**, baseline **409**
  — dług **spadł** o 1, nie rośnie)". Zgodne z briefem zadania
  (baseline 409 → obecnie 408).
- `bash scripts/check-artefakt.sh` → **exit 0**: „brak nowych naruszeń
  crimson w powłoce artefaktów (aktualnie **7**, baseline **7** — dług nie
  rośnie)" — **7/7**.
- `git diff --check` (working tree i `HEAD~1`) → **exit 0**, brak
  whitespace-conflict markerów.
- Pre-commit hook (uruchomiony automatycznie przy commicie) — te same
  sprawdzenia + `check-triada`/`check-gestosc`/`check-focus-canon` —
  wszystkie **OK**, dług nie rośnie.

---

## Czego to NIE dowodzi

- Nie dowodzi, że defekt 3 jest naprawiony — **nie jest**, celowo (poza
  allowlistą). Dowodzi tylko dokładnej lokalizacji przyczyny i realnego
  (zmierzonego, nie domniemanego) przeciążenia 15px w boxie nagłówka.
- Nie dowodzi piksel-w-piksel odtworzenia „1280px + 125% zoom" — patrz
  zastrzeżenie w sekcji Defekt 3 (brak kontroli poziomu zoomu w dostępnych
  narzędziach automatyzacji).
- Nie dowodzi, że `notCalculableReason`'s stary tekst (drugi wyciek
  Defektu 1) był kiedykolwiek widziany przez realnego użytkownika na
  produkcji — kod źródłowy sam mówi, że ta gałąź jest dziś nieosiągalna
  dla tego pola przy realnych danych API; poprawiona defensywnie.
- Nie dowodzi zachowania pozostałych ośmiu ekranów `okr/` (Objectives,
  Key Results, Alignment, Support, Review & Reflection, History,
  Programs, Cycles) — poza zakresem tego zadania poza jednym grepem po
  wyciekach tekstowych (wynik: brak).
- Nie testuje realnego wywołania API (submit/approve/itd.) — testy
  jednostkowe są czysto renderingowe (props → DOM), zgodnie z zakresem
  (błąd jest w warstwie tekstu, nie w logice wywołań).

---

## Czy ruszyłem coś poza allowlistą

Nie. Zmienione pliki: `src/components/ResultsVNext/okr/OkrSetOverviewView.tsx`
(w allowliście), `tests/components/ResultsVNext/okr/OkrSetOverviewView.test.tsx`
(nowy, w `tests/**`, nie jeden z trzech zakazanych `*.realdb.test.ts`),
`docs/product/results-vnext/RN_G6_OKRTEXT.md` (ten plik),
`docs/qa/screens/rn-g6-okrtext/**` (zrzuty). `okrWorkspaceMappers.ts`
przeczytany i zweryfikowany, ale **nie zmieniony** — jest już poprawnym
właścicielem prefiksu (patrz uzasadnienie Defektu 2). Serwer
(`server/src/**`), `src/components/standard/**`, `shared/**` i
`ResultsKpiRegistryPage.tsx` nietknięte. `.claude/launch.json` nie
commitowany. Zero push/merge/deploy/podagentów.
