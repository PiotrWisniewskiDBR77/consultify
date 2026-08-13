# Case Workspace — prototyp W2-V0 — lista decyzji do akceptu właściciela

Status: **PROTOTYP, NIEPOKAZANY PIOTROWI, NIE PRODUKCYJNY**. To jest materiał do wewnętrznego
przeglądu przed jakąkolwiek prośbą o `OWNER_PROTOTYPE_APPROVAL_REF` — zgodnie z CLAUDE.md regułą
#7 (Piotr nigdy nie jest pierwszym testerem wizualnym), ten prototyp przechodzi przegląd wewnętrzny
jako pierwszy krok, nie jako gotowy do pokazania ekran.

Każda pozycja poniżej to nieoczywisty wybór wizualny/interakcyjny, który podjąłem budując mockup —
nie decyzja produktowa udawana za mnie. Tam gdzie nie było jednoznacznej odpowiedzi w kanonie ani
w kodzie serwisów, zaznaczam to jako **PYTANIE OTWARTE**, nie ciche założenie.

---

# RUNDA 2 (W2-V0.1) — cztery uwagi właściciela

Właściciel odrzucił rundę 1 z czterema uwagami. Poniżej: co zmienione, dowód liczbowy
before/after, i checklista zamknięcia. Zrzuty dowodowe: `evidence/w2v01/` (14 plików).

## Checklista „zamknięte uwagi"

| # | Uwaga właściciela | Stan | Gdzie zrobione | Dowód |
|---|---|---|---|---|
| 1 | Plan Ekspercki ucina węzły na prawej krawędzi | **ZAMKNIĘTE** | `screens/zlecenie.html` (układ grafu w pasach), `js/app.js` (`initGraph`), `css/shell.css` (`.graph-viewport`, `.graph-toolbar`) | 12/12 węzłów, 0 uciętych w prawo, 0 w lewo, `scrollWidth 1030 = clientWidth 1030` przy 1440 px; zrzuty 03 (dark) i 06 (light) |
| 2 | Słownik PL zamiast rozsypanych tłumaczeń | **ZAMKNIĘTE** (z rundy poprzedniej, zweryfikowane teraz) | `js/labels.js` + `data-i18n` w ekranach | 469 wystąpień `data-i18n`, **0 nieznanych kluczy**, 100 % podmienione w locie; zero angielskich enumów w widocznym tekście |
| 3 | Mobile 320/375/430 — nic ucięte, 6 zakładek używalnych palcem | **ZAMKNIĘTE** | `css/shell.css` (media 768/430/360, `.tabscroll`), `js/app.js` (`initTabScroll`, preview-close) | 36/36 stron-pomiarów bez poziomego scrolla dokumentu; 6/6 zakładek klikalnych przy 320/375/430; zrzuty 08–14 |
| 4 | Dieta wizualna — mniej ramek, niższe karty | **ZAMKNIĘTE** | `css/shell.css`, blok `<style>` w `screens/zlecenie.html` | karta Plan-Lista na mobile **−35 %**, blok AKCJE **−76 %**, lista Plan Prosty **−28 %**, zakładka Realizacja **−11 %**; zrzuty 02, 04, 07, 09 |

## 1. Plan Ekspercki — cały graf widoczny (uwaga: „ucina węzły")

**Przed:** graf był jednym długim, poziomym łańcuchem 12 węzłów w kontenerze `overflow:hidden` —
prawa część (n7…n11) po prostu nie istniała na ekranie i nie było czym jej dosięgnąć.

**Po:** trzy zmiany naraz, tak by całość mieściła się bez żadnej akcji użytkownika, a mimo to dało
się ją oglądać także na telefonie:

- **Układ łamany w pasy.** Graf renderuje się w 4 pasach (Pas 1 · Pas 2 · Gałąź A · Pas 3) ze
  znacznikami ciągłości `↴`/`↳`. Naturalna szerokość spadła z ~1 950 px do **718 px**, więc przy
  1440 px cały graf mieści się w kadrze — zmierzone: `graph-viewport.scrollWidth = clientWidth =
  1030`, 0 węzłów przekraczających prawą krawędź treści.
- **Kontener ze scrollem z WIDOCZNĄ afordancją**, nie `overflow:hidden`. Na mobile
  `overflow-x: scroll` (pasek zawsze rysowany, nie „na hover"), plus podpis w toolbarze
  („Szerszy niż ekran? Przewiń graf w poziomie w jego własnej ramce").
- **Toolbar zoom: `−` / `%` / `+` / „⤢ Dopasuj do widoku" / „1:1".** Skala to czysty
  `transform: scale()` na scenie + przeliczany rozmiar `graph-sizer` (bez tego po zmniejszeniu
  zostawał martwy pas scrolla, bo `transform` nie zmienia layoutu).

**Wybór narzędzia (świadomy, nie z lenistwa):** kontener ze scrollem + CSS `transform: scale`,
**nie** interaktywny canvas (react-flow / pan-drag). Uzasadnienie: (a) prototyp jest statyczny,
canvas wymagałby bundlera i zamieniłby mockup w aplikację; (b) rzecz do udowodnienia właścicielowi
to „nic nie ucina", a nie „umiemy zrobić canvas"; (c) scroll+scale nie ma stanu do zgubienia —
odporność wygrywa z możliwościami. To jest zgodne z DECISIONS pkt 3 poniżej (widok Ekspercki jako
reprezentacja statyczna).

**Bezpieczeństwo „Dopasuj do widoku" (wymóg wprost):** każde dzielenie jest osłonięte, a `clamp()`
odrzuca `NaN`/`Infinity`/`≤0` i zwraca 1. Ścieżki brzegowe przetestowane realnie, nie deklaratywnie:
- pusty graf (`stage.innerHTML = ''`) → fit kończy się cichym `scale = 1`, `transform: none`,
  zero błędów JS;
- graf z 1 węzłem → `scale = 1`, `sizer = 138px`, zero błędów JS;
- 24 kliknięcia serią (`−` ×6, `+` ×6, fit ×6, 1:1 ×6) → zero błędów JS, zero `NaN` w `transform`.

**Auto-fit ma podłogę czytelności 0,75.** Automatyczne dopasowanie przy wejściu w zakładkę nie
schodzi poniżej 75 %, żeby na telefonie graf nie „zmieścił się" w 47 % jako nieczytelna plama;
pełny przegląd daje dopiero JAWNE kliknięcie „Dopasuj do widoku" (bez podłogi). **PYTANIE OTWARTE:**
czy 0,75 to właściwy próg — to jest wartość dobrana wzrokowo, nie wyliczona z badań.

**Zakładka „Lista" nietknięta** — pozostaje pełną alternatywą tekstową (12 wierszy, te same węzły).

## 3. Mobile 320 / 375 / 430 — zmierzone, nie „wygląda OK"

**Przed:** przy 320–430 px chowały się zakładki poza 4. pozycją, Menu 1 ucinało chip statusu, a
preview otwierał się od razu na pełny ekran bez jawnego wyjścia.

**Po:**

- **Pasek 6 zakładek ze scrollem i afordancją** (`.tabscroll`): własny pasek przewijania + gradienty
  krawędziowe + przyciski `‹`/`›`, atrybut `data-overflow=start|middle|end|none` steruje tym, która
  krawędź jest zaznaczona. Aktywna zakładka jest doprowadzana w kadr **tylko w poziomie tego paska**
  (`scrollIntoView` przewijał wcześniej całą stronę w pionie i chował Menu 1 pod paskiem prototypu).
  Zmierzone: 6/6 zakładek klikalnych i przełączających treść przy 320, 375 i 430; wysokość celu
  dotykowego 40 px.
- **Menu 1 artefaktu łamie się na dwa wiersze** zamiast ucinać (≤430 px): wiersz 1 = powrót + nazwa
  + chip statusu, wiersz 2 = akcje. Nic nie znika; przełącznik panelu WŁAŚCIWOŚCI zwężony do ikony,
  ale **nie** ukryty (ukrycie = panel nieosiągalny, bo sam panel stoi poza ekranem).
- **Plan Lista na mobile = stos kart, 2-kolumnowa siatka**, każda komórka niesie własną etykietę
  (`td[data-th]::before`). Wszystkie 5 pól w każdym z 12 wierszy: kolejność, status, wykonawca,
  wynik, następne działanie — sprawdzone programowo dla 12/12 wierszy przy 320 i 375 px.
- **Preview Zlecenia ma jawny, przyklejony powrót.** Na ≤768 px preview startuje ZAMKNIĘTY (lista
  jest ekranem głównym), wybór wiersza go otwiera, a `← Wróć do listy` w pasku `position: sticky`
  jest widoczny bez przewijania i realnie zamyka preview. Zero polegania na „wstecz" przeglądarki.
  Ten sam wzorzec dla panelu WŁAŚCIWOŚCI (`← Wróć do zlecenia`).
- **Powroty nawigacyjne mają 32 px wysokości** na telefonie (wyjątek od diety — `pill--sm` ma
  domyślnie 26 px, co jest za mało na palec). Wyjątek dotyczy WYŁĄCZNIE powrotów, nie wszystkich
  małych pigułek — inaczej dieta z uwagi #4 zostałaby cofnięta.

**ZMIERZONY brak poziomego scrolla strony** (`document.documentElement.scrollWidth` vs
`window.innerWidth`), 12 ekranów × 3 szerokości = **36/36 OK**:

| szerokość | scrollWidth | innerWidth | wynik |
|---|---|---|---|
| 320 px | 320 | 320 | brak poziomego scrolla (12/12 ekranów) |
| 375 px | 375 | 375 | brak poziomego scrolla (12/12 ekranów) |
| 430 px | 430 | 430 | brak poziomego scrolla (12/12 ekranów) |

Szeroka treść (graf, tabela) scrolluje **we własnym kontenerze** — `.app-frame` dostaje
`overflow-x: clip`, żeby żaden element chrome'u nie mógł rozepchnąć `<body>`. Zrzut 14 nosi stempel
z żywego pomiaru wykonanego w momencie robienia zdjęcia (nie dopisany ręcznie).

## 4. Dieta wizualna — co dokładnie schudło

Zasada: **treść i stan zostają w całości, znika dekoracja.** Zero nowych tokenów — wszystko na
istniejących zmiennych z `css/tokens.css`. Zmiany mierzone w pikselach, nie „na oko":

| element | przed | po | zmiana |
|---|---|---|---|
| karta wiersza Plan-Lista (mobile 375) | 254 px | 165 px | **−35 %** |
| 12 kart Plan-Lista łącznie (mobile 375) | 3 048 px | 1 982 px | **−35 %** |
| blok AKCJE w prawym panelu | 124 px | 30 px | **−76 %** |
| lista 6 kroków „Plan Prosty" | 388 px | 278 px | **−28 %** |
| cała treść zakładki Realizacja | 771 px | 690 px | **−11 %** |
| cała treść zakładki Rezultaty | 412 px | 398 px | **−3 %** |

Co konkretnie zrobione:

- **„Plan Prosty": sześć pudełek → jedna ramka.** Kroki były stosem osobnych kart ze złączkami;
  teraz to jeden kontener, a kroki są wierszami rozdzielonymi włoskową kreską (`.node-steps`).
  Ramek 6 → 1, znika 5 złączek i 5 przerw. Treść kroku (tytuł + status + ikona stanu) bez zmian.
- **Panel podglądu przestał być pudełkiem w pudełku.** `.preview-pane` był PODNIESIONĄ powierzchnią
  (`--c-surface-raised`), na której leżały jeszcze ramkowane karty `.pv-card`. Panel schodzi do tła
  strony (`--c-bg`) — zostaje jeden poziom pudełka.
- **Blok AKCJE: trzy pełnej szerokości pigułki w stosie → jeden zawijany rząd kompaktowych.**
  Te same trzy akcje, 124 px → 30 px.
- **„Postęp" w Realizacji stracił własną kartę.** Etykieta + pasek + liczba to sama treść i stan;
  ramka wokół nich była czystą dekoracją. Teraz jeden płaski rząd (`.progress-flat`).
- **Ścieśnione paddingi bez usuwania treści:** `.node-card` 8→6 px, `.wait-card` 8→6 px,
  `.deliverable-card` 8→6 px, `.approval-card` 10→8 px, `.pv-card` 12→10 px, karta wiersza na
  mobile 10/12→8/10 px, `line-height` tytułów i podtytułów 1,3.

**Znaleziony przy okazji realny defekt CSS (nie kosmetyka).** Reguła bazowa tabeli to
`table.std-table tbody td` (3 elementy), a mobilny „tryb kart" był pisany jako `table.std-table td`
(2 elementy) — **niższa specyficzność, więc NIE nadpisywał**. Efekt: komórki kart na telefonie
zachowywały desktopowy `padding: 10px 12px` **oraz** `border-bottom`, przez co karta rosła prawie
dwukrotnie i dostawała siatkę kresek udającą tabelę. To jest źródło większości „za dużo ciężaru" na
mobile z uwagi #4. Naprawione przez dopisanie `tbody` do selektorów mobilnych. Wniosek dla
implementacji produkcyjnej: przy przełączaniu tabeli w karty **specyficzność selektora mobilnego
musi dorównać regule bazowej**, inaczej dostaje się cichy hybrydowy układ, który wygląda jak decyzja
projektowa.

**Nowe klasy (bez nowych tokenów, wszystkie na istniejących zmiennych):** `.node-steps`
(pojedyncza ramka listy kroków), `.progress-flat` (bezramkowy rząd postępu),
`.tabscroll*` (pasek zakładek z afordancją), `.graph-viewport`/`.graph-sizer`/`.graph-stage`/
`.graph-toolbar*` (rama grafu), `.pv-mobile-back` (przyklejony powrót z preview). Nazewnictwo
trzyma konwencję pliku (blok`__element`, `--modyfikator`). **Żaden token z `tokens.css` nie został
dodany ani zmieniony** — nie powstał równoległy design system.

## Czego runda 2 NIE zmieniła (świadomie)

- Zakładka „Lista" w Planie — działa jak dotąd, to alternatywa dla grafu, nie przedmiot poprawki.
- Zawartość merytoryczna wszystkich ekranów (żadne pole, chip, liczba ani wiersz nie zostały
  usunięte w ramach diety — zmieniały się wyłącznie ramki, tła i paddingi).
- Wszystkie **PYTANIA OTWARTE** z rundy 1 (poniżej) pozostają otwarte — dieta i mobile ich nie
  rozstrzygają.

---

## Zakres i metoda

- **Technologia:** statyczny HTML/CSS/JS (bez frameworka, bez builda). W tym repo/worktree katalog
  `dev-render/` (harness do renderowania realnych komponentów React bez logowania) **nie istnieje**
  na sprawdzonej gałęzi worktree — `git ls-tree HEAD` zwraca zero plików w `dev-render/`, mimo że
  istnieje na `origin/demo` i na `claude/case-workspace-v1-20260809` (155 plików). Ponieważ allowlist
  tego strumienia zabrania dotykać czegokolwiek poza nowym katalogiem prototypu, nie ściągałem
  harnessu z innej gałęzi do tego worktree — wybrałem samodzielny statyczny mockup. **PYTANIE
  OTWARTE:** czy przyszła iteracja powinna zamiast tego użyć realnego `dev-render` (i jeśli tak, na
  którym SHA) — flaguję to jako decyzję do potwierdzenia, nie zakładam.
- **Dane domenowe:** kształty i nazwy pól (case_profile, governance_tier, autonomy_policy,
  case_status, closure axes, plan_version status, semantic_graph node/edge types, action_proposal
  status, wait_type/status, artifact_link_relation, value_measurement_status) są przepisane
  dosłownie z `server/src/services/caseWorkspace/*.ts` na gałęzi `claude/case-workspace-v1-20260809`
  (caseCoreService, casePlanVersionService, proposalApprovalService, waitSubscriptionService,
  caseHistoryService, executionGraphService, artifactLinkService) — czytane przez `git show
  claude/case-workspace-v1-20260809:<path>`, nigdy nie ściągane do working tree tego worktree (poza
  allowlistem). Treść przykładowa (nazwy zleceń, kwoty, osoby) jest fikcyjna.
- **Zrzuty:** Playwright (chromium headless) sterowany z osobnego katalogu poza repo (npm w
  scratchpadzie tej sesji), celujący w statyczny serwer `python3 -m http.server` serwujący WYŁĄCZNIE
  pliki z `docs/product/case-workspace/prototype-w2-v0/`. Wybrałem to zamiast Browser pane z tej
  sesji, ponieważ trzeba było przechwycić >100 kombinacji ekran×viewport×motyw×stan — Playwright
  pozwolił to zrobić deterministycznie przez parametry URL (`?theme=&state=&tab=&view=`), Browser
  pane posłużył do weryfikacji interaktywnej (klikanie, hover, accordion) i wykrycia dwóch bugów CSS
  (patrz niżej), które potem naprawiłem przed właściwym przechwytywaniem.
- Sam katalog prototypu i zrzuty **nie są** wpięte w żaden routing `src/`; nie ma callera
  produkcyjnego i nie może być pomylony z prawdziwym ekranem.

## Decyzje wizualne/interakcyjne (nieoczywiste, do potwierdzenia)

1. **Menu 3 artefaktu = dodatkowe zakładki ponad kanoniczną bazę.** ARTIFACT_ANATOMY_STANDARD §13.1
   definiuje bazę Rekordu jako „Przegląd · Powiązania · Aktywność”. Zadanie wymagało osobnych
   zakładek Plan/Realizacja/Rezultaty. Zdecydowałem: **6 zakładek razem** (Przegląd · Plan ·
   Realizacja · Rezultaty · Powiązania · Aktywność), traktując Plan/Realizacja/Rezultaty jako
   „dodatkowe zakładki” w tym samym sensie, w jakim Initiative (L) w §13.1 dostaje dodatkowe
   Zadania/Definicja/Wdrożenie/Ekonomia/Governance/Zespół ponad bazę. **PYTANIE OTWARTE:** czy to
   jest właściwy podział, czy „Powiązania”/”Aktywność” powinny zniknąć jako osobne zakładki i żyć
   wyłącznie w prawym panelu (który i tak ma sekcje Powiązania/Historia) — ryzyko duplikacji dwóch
   miejsc na to samo.
2. **Prosty/Ekspercki/Lista = trzy renderowania JEDNEGO `semantic_graph`, nie trzy plany.** To jest
   dosłownie w komentarzu `casePlanVersionService.ts` („there is nowhere for Simple/Expert/List to
   persist a competing process model”) — potraktowałem to jako twardy wymóg, nie interpretację.
   Prosty = zredukowany do węzłów typu CAPABILITY/HUMAN_TASK/APPROVAL (ukrywa gateway/split/join).
   Ekspercki = pełny graf z typami technicznymi. Lista = płaska tabela (StandardTable-owy wygląd)
   wszystkich węzłów. **PYTANIE OTWARTE:** czy „Prosty” powinien pokazywać TYLKO ukończone+następny
   krok, czy całą oś czasu jak zrobiłem (ryzyko zbyt długiej listy przy dużych planach).
3. **Widok Ekspercki jako statyczna reprezentacja, nie canvas.** (Zaktualizowane w rundzie 2 — patrz
   sekcja „RUNDA 2 · pkt 1": graf jest teraz łamany w pasy i ma zoom/fit, nadal bez canvasu.)
   SPEC-A archetyp A (Canvas) zakłada
   react-flow; budowanie realnego interaktywnego canvasu wykraczało poza zakres statycznego
   prototypu HTML. Zrobiłem układ pudełek+strzałek w przewijalnym kontenerze, jawnie podpisany
   „Reprezentacja statyczna w tym prototypie (nie interaktywny canvas)”. **PYTANIE OTWARTE:** czy
   produkcyjny widok Ekspercki faktycznie potrzebuje pełnego react-flow (zoom/pan/drag), czy
   wystarczy czytelna lista/graf bez edycji, skoro Ekspercki w tym Case jest raczej widokiem
   diagnostycznym niż miejscem tworzenia planu (tworzenie planu = osobny, nie objęty tym zadaniem
   przepływ).
4. **Kolumna „Postęp” na liście Zlecenia jest wartością POCHODNĄ, nie polem z `case_core`.** Nie ma
   `progress_pct` w żadnym czytanym serwisie — policzyłem ją jako „ukończone węzły / wszystkie węzły”
   z przykładowego grafu. **PYTANIE OTWARTE:** czy formuła postępu ma liczyć węzły, czy coś innego
   (np. closure axes, wagę biznesową kroków) — potwierdzić z produktem/inżynierią przed podłączeniem
   realnych danych.
5. **Enumeration-safe 404: ten sam ekran dla „nie istnieje” i „brak dostępu”.** Zgodnie z poleceniem
   zadania (powiązanie z posturą Stream A) `not-found.html` nigdy nie mówi „zablokowano dostęp” ani
   nie sugeruje, że ukryty rekord istnieje — zawsze neutralne „Nie znaleziono zlecenia”. To jest
   świadomy wybór bezpieczeństwa, nie oszczędność treści — **PYTANIE OTWARTE:** czy produkt chce
   dodać kanał wsparcia („poproś o dostęp”) bez łamania enumeration-safety (np. zawsze widoczny
   „Skontaktuj się z administratorem”, niezależnie od tego czy rekord istnieje).
6. **Case-level „stan ekranu” (stale/partial/blocked) jako baner pod Menu 1, nie jako osobna
   podstrona.** Realizacja/Rezultaty pokazują swoje przykładowe treści (uwaga/blokady/oczekiwania)
   ZAWSZE w stanie domyślnym, bo to są realne elementy treści wymagane przez zadanie, nie tylko
   warianty stanu. Toggle stanu „Zablokowane” dodatkowo podmienia chip lifecycle w Menu 1 i pokazuje
   baner. **PYTANIE OTWARTE:** czy to poprawnie oddaje różnicę między „case_status=BLOCKED” (całe
   Zlecenie stoi) a pojedynczym zablokowanym węzłem/oczekiwaniem wewnątrz aktywnego Case (który nie
   jest globalnie BLOCKED) — w realnym produkcie te dwa stany prawdopodobnie wymagają osobnych
   sygnałów wizualnych, w tym prototypie są uproszczone do jednego przełącznika.
7. **„Powrót do zlecenia” zamockowany jako pełnoekranowa nakładka z trwałym paskiem, nie prawdziwa
   nawigacja.** Zadanie wprost pozwala „opisać/zamockować przejście, bez realnej nawigacji”. Pasek
   `rtc-bar` jest position:sticky na górze nakładki, zawsze widoczny, z nazwą macierzystego Zlecenia.
   **PYTANIE OTWARTE:** czy w produkcji to ma być osobny URL z breadcrumbem (Zlecenie › Dokument), czy
   faktyczny modal/split-view bez zmiany URL — oba są zgodne z „nie gubimy kontekstu”, różnią się
   głębią nawigacyjną i historią przeglądarki.
8. **Prawy panel accordion: „Powiązania” ma DWA miejsca (zakładka pełna + sekcja skrócona).** Zgodnie
   z §11.2 prawy panel zawsze ma sekcję Powiązania niezależnie od zakładek Menu 3. Nie eliminowałem
   dublowania (patrz punkt 1) — zostawiłem oba, bo taki jest dosłowny wzorzec kanonu (Lista ma pełną
   tabelę + preview ma skrócone relations; Artefakt analogicznie). **PYTANIE OTWARTE:** patrz punkt 1.
9. **Menu 1 primary CTA zmienia się z case_status (DRAFT→„Zatwierdź i rozpocznij”,
   ACTIVE→„Poproś o decyzję”, BLOCKED→„Rozwiąż blokadę”).** „Zatwierdź i rozpocznij” dla LIGHT-case
   jest dosłownie opisane w `proposalApprovalService.ts` open_question #12 jako jedna, złożona akcja
   orkiestracji (createCase + publishPlanVersion + start run), NIE jako ActionProposal. Potraktowałem
   to jako potwierdzenie, że taki przycisk ma sens UI-owo, ale **PYTANIE OTWARTE:** ten packet
   jednoznacznie NIE buduje backendu tej orkiestracji — przycisk w prototypie jest czystą atrapą,
   real wiring to osobna, niezrobiona jeszcze praca.
10. **Ikony domenowe artefaktów (⚖️ decision, 📄 document, 📊 presentation, 🎯 initiative) użyte jako
    emoji, nie jako biblioteka lucide.** SPEC-A §13.1/13.2/13.4 podaje konkretne nazwy ikon lucide
    (`scale`, `file-text`, `presentation`, `target`) — w statycznym HTML bez bundlera użyłem emoji
    jako czytelnego zamiennika wizualnego, WYRAŹNIE nie licząc się z tym jako z finalnym doborem
    ikonografii. **PYTANIE OTWARTE (techniczne, nie produktowe):** finalna implementacja musi użyć
    prawdziwych ikon lucide z rejestru — to jest różnica narzędziowa prototypu, nie decyzja projektowa.
11. **Kolumny tabeli Zlecenia:** Nazwa/Status/Profil/Governance/Plan/Postęp/Sponsor/Zaktualizowano.
    Dobrane tak, by (a) każda poza „Postęp” mapowała się 1:1 na realne pole `case_core`/
    `case_plan_versions`, (b) spełniać wymóg MY_WORK_TABLE_SURFACE_CONTRACT „kompletność
    informacyjna kolumn” (rozróżnienie/porównanie/obsługa bez otwierania). **PYTANIE OTWARTE:** czy
    „Governance” i „Profil” są wystarczająco często używane do sortowania/filtrowania żeby zasługiwać
    na stałą kolumnę, czy powinny być tylko w Details prawego panelu.

## Znane uproszczenia prototypu (świadomie NIE naprawiane w tej iteracji)

- Stan `loading`/`error` na ekranie pełnego Zlecenia jest wspólny dla wszystkich zakładek (podmienia
  całą treść `.center-pad`, niezależnie od tego która zakładka jest aktywna) zamiast osobnego
  loading/error per zakładka. Prawy panel WŁAŚCIWOŚCI zostaje widoczny nawet w stanie `loading`
  centrum — to świadome uproszczenie (właściwości Case są tańsze/szybsze do pobrania niż graf/
  realizacja), nie błąd.
- Stan `empty` (DRAFT bez planu) zaimplementowany jest dla zakładek Przegląd/Plan/Realizacja/
  Rezultaty; zakładki Powiązania/Aktywność zawsze pokazują przykładową treść (nie mają wariantu
  empty w tym prototypie) — DRAFT case realnie miałby też puste Powiązania/Aktywność, ale nie
  budowałem tego wariantu ze względu na czas.
- Stany nie-domyślne (`empty/loading/error/stale/partial/blocked`) na mobile są przechwycone dla
  tych samych reprezentatywnych zakładek co desktop (Przegląd + Plan/Realizacja/Rezultaty gdzie
  dotyczy), NIE dla wszystkich 8 kombinacji zakładek × 6 stanów — to jest świadome ograniczenie
  zakresu (patrz macierz w evidence/SCREENSHOT_INDEX.md), zgodne z ARTIFACT_ANATOMY_STANDARD §19.1
  („mobile = przegląd i lekkie akcje, nie budowa artefaktów”) — mniej krytyczne kombinacje na mobile
  nie zostały pomnożone przez wszystkie stany.
- ~~Widok Ekspercki na mobile pokazuje graf przycięty do widocznego fragmentu (poziomy scroll) —
  zgodne z odrzuceniem „udajemy że canvas działa na telefonie” z §19.1, ale nie ma dedykowanego
  komunikatu „ten widok jest czytelniejszy na desktopie”.~~ **Zmienione w rundzie 2:** graf jest
  łamany w pasy, ma zawsze widoczny pasek przewijania i przyciski zoom/„Dopasuj do widoku"; nadal
  **nie** ma komunikatu „ten widok jest czytelniejszy na desktopie" — świadomie, bo po zmianie graf
  jest na telefonie w pełni osiągalny, a nie tylko przycięty.
- Dwa bugi CSS znalezione i naprawione podczas budowy (przed przechwyceniem finalnych zrzutów):
  (a) nakładanie się tytułu Menu 1 artefaktu z przyciskiem „Indeks” na wąskich viewportach (flex
  dzieci bez `min-width:0`); (b) na mobile prawy panel/preview (position:fixed do viewportu)
  chowały swój nagłówek pod paskiem deweloperskim prototypu (position:sticky, wyższy z-index) —
  naprawione przez `position:absolute` względem `.app-frame` zamiast `position:fixed` względem
  viewportu. Oba dotyczą WYŁĄCZNIE tego prototypu (pasek deweloperski nie istnieje w produkcji), ale
  pierwszy (tytuł/Indeks) jest realną wskazówką dla implementacji produkcyjnej Menu 1 artefaktu na
  mobile — flex dzieci potrzebują `min-width:0`.

## Co NIE jest w zakresie tego prototypu

- Brak realnego API/danych — wszystko statyczne, jeden przykładowy Case.
- Brak edycji planu (tworzenie/zmiana węzłów) — Plan tab jest wyłącznie widokiem odczytu.
- Brak realnej implementacji eksportu/udostępniania/komentarzy — przyciski są atrapami.
- Brak weryfikacji z prawdziwym `StandardTable`/`StandardModuleBar`/`StandardPreview` z `src/` —
  wygląd jest RĘCZNIE dopasowany do kanonu (TRIADA_KANON + MY_WORK_TABLE_SURFACE_CONTRACT), nie
  wyrenderowany przez faktyczny komponent, więc może się rozjechać przy realnej implementacji mimo
  starań o wizualną wierność.
