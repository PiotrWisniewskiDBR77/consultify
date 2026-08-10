# Case Workspace — prototyp W2-V0 — lista decyzji do akceptu właściciela

Status: **PROTOTYP, NIEPOKAZANY PIOTROWI, NIE PRODUKCYJNY**. To jest materiał do wewnętrznego
przeglądu przed jakąkolwiek prośbą o `OWNER_PROTOTYPE_APPROVAL_REF` — zgodnie z CLAUDE.md regułą
#7 (Piotr nigdy nie jest pierwszym testerem wizualnym), ten prototyp przechodzi przegląd wewnętrzny
jako pierwszy krok, nie jako gotowy do pokazania ekran.

Każda pozycja poniżej to nieoczywisty wybór wizualny/interakcyjny, który podjąłem budując mockup —
nie decyzja produktowa udawana za mnie. Tam gdzie nie było jednoznacznej odpowiedzi w kanonie ani
w kodzie serwisów, zaznaczam to jako **PYTANIE OTWARTE**, nie ciche założenie.

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
3. **Widok Ekspercki jako statyczna reprezentacja, nie canvas.** SPEC-A archetyp A (Canvas) zakłada
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
- Widok Ekspercki na mobile pokazuje graf przycięty do widocznego fragmentu (poziomy scroll) —
  zgodne z odrzuceniem „udajemy że canvas działa na telefonie” z §19.1, ale nie ma dedykowanego
  komunikatu „ten widok jest czytelniejszy na desktopie”.
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
