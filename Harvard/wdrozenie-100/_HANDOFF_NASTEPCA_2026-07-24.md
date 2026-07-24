# HANDOFF dla następcy sesji (2026-07-24, koniec dnia)

> Piotr przechodzi na drugi plan taryfowy (nowa sesja/kontekst) — obecna sesja skończyła tokeny.
> Ten dokument to pełny stan na moment przekazania. Czytaj PIERWSZY, przed czymkolwiek innym.

## ★★★ STATUS: PIOTR WRACA W NIEDZIELĘ WIECZOREM (jedzie na kajaki)

**Testów NIE BĘDZIE do niedzieli wieczorem.** To zmienia tryb pracy następcy względem tego, co
było aktywne przez cały ten dzień („daj wszystkie zmiany na demo do testowania jak zrobisz" —
ten mandat zakładał, że Piotr jest przy komputerze i klika na bieżąco). Teraz nikogo nie ma po
drugiej stronie przez kilka dni. Konsekwencje praktyczne:

- **Reguła #7 (Piotr nigdy pierwszym testerem) obowiązuje z jeszcze większą siłą** — skoro
  fizycznie nie ma go, żeby zareagować na coś złego na demo, tym bardziej każda zmiana musi być
  zweryfikowana renderem WŁASNYM przed jakimkolwiek pushem.
- **Nie ma potrzeby gonić z promocjami** tak jak dziś (gdzie promowałem partię za partią, bo
  ktoś czekał po drugiej stronie z gotowością kliknięcia). Następca MOŻE dalej promować
  zweryfikowane, bezpieczne partie na demo (mandat stały tego nie cofa) — ale rozsądniej jest
  pracować spokojniej, kończyć spójne całości, i zostawić demo w dobrym, przetestowanym stanie
  NA NIEDZIELĘ, zamiast wysyłać coś w piątek w nocy i mieć nadzieję, że nikt tego nie zobaczy
  zepsutego przez 2 dni.
- **Priorytet:** jeśli następca skończy jakiś spójny kawałek pracy w czwartek/piątek/sobotę,
  wart jest jeden ostatni przegląd w niedzielę po południu — świeży `git fetch`, świeży render
  wszystkich dotkniętych ekranów, dopiero potem ewentualny ostatni push — żeby to, co Piotr
  zobaczy w niedzielę wieczorem, było najlepszą możliwą wersją, nie przypadkowym stanem z
  środka nocy.
- Jeśli następca dostanie od Piotra WIADOMOŚĆ (nie feedback z klikania, tylko tekst) w tym
  okresie — to oczywiście ma pierwszeństwo przed wszystkim tutaj.

## 0. STAN DEMO NA MOMENT PRZEKAZANIA (zweryfikowane samodzielnie na żywym serwerze)
`https://demo.consultify.ai/api/health` → **gitSha `553fbf3015`**, branch `demo`, database+redis
connected, HTTP 200. Ostatni commit: „merge(grid): stabilizacja gridu n-Type — 6 kart do wspólnej
powłoki (Etap 7 — zamknięcie zakresu)".

★ **To jest stan NIEZATESTOWANY przez Piotra.** Ostatni stan, który on realnie zaakceptował
oczami, to tag `demo-safe-2026-07-24` (`97f466bd98`) z rana — wszystko po tym (cała fala napraw
+ cały program stabilizacji gridu) poszło na jego STAŁĄ autoryzację promocji, nie na jego
bezpośrednie „widziałem, akceptuję". To nie jest problem — taki był dogadany tryb pracy tego
dnia — ale następca powinien to rozumieć: „gotowe do testowania" ≠ „przetestowane".

## 1. CO SIĘ WYDARZYŁO TEGO DNIA (chronologia)

### Noc 07-23/24 — pętla naprawcza
Mandat: „pracuj w lupie aż średnia 3 sędziów (Grafika/Merytoryka/IT) ≥9,5". Wynik: **5,9 → 7,1**
(cel nieosiągnięty, powiedziane wprost w porannym raporcie). 12 rodzin atrap AI wyciętych (kod
udający działanie modelu — zaszyte frazy, `setTimeout` symulujący myślenie, fallbacki meldujące
sukces po awarii). Dziennik pełny: `_PETLA_NOCNA_9_5_2026-07-23.md`.

### Rano — audyt gotowości + pierwsza promocja
`_AUDYT_GOTOWOSCI_ARTEFAKTY_2026-07-24.md` — 18/18 środowisko, ocena baseline. Promocja:
demo `97f466bd98`, tag `demo-safe-2026-07-24` (**bezpieczny punkt zaakceptowany przez Piotra**).

### Mandat rozszerzony — „jedź aż wszystko zrobione"
Piotr: „jedź tak długo aż zrealizujesz wszystko, wypchnij na demo, posprzątaj gałęzie, daj mi
jasny sygnał gotowe do testowania". Potem: „daj wszystkie zmiany na demo do testowania jak
zrobisz — STAŁA autoryzacja promocji bez pytania za każdym razem".

Wykonane w tej fali: regresje AI (ślad audytowy w `/generate`, Powiadomienie bez auto-AI), pasek
„Szkic" naprawiony u źródła (`hasRecord`, nie fabrykuje statusu), eksport danych (realny endpoint
zamiast obietnicy e-maila), crimson na callout Insight → token `c-ai` (BLOKER zdjęty), 190 polskich
wartości w `pl/translation.json`, surowe enumy/slugi + przy okazji naprawiony błąd nawigacji,
1503 linii martwego kodu Inicjatywy usunięte (★ jeden plik `InitiativeFullView` omal nie padł —
sędzia IT się mylił, jest żywy przez `MyWorkHub`), 21 cichych `catch` uzbrojonych w logi, geometria
kart (rozjazd Inicjatywy 376px naprawiony).

**Dwie bramki dawały fałszywą zieleń** — naprawione: `check-triada.sh` (BRE grep wywalał się na
BSD/macOS, bramka była TRWALE ŚLEPA na crimson), `check-gestosc.sh` (0 plików = fałszywy sukces
zamiast ostrzeżenia). `check-list-canon.sh` dostała mechanizm baseline (jak `check-artefakt.sh`) —
414 naruszeń zastanych, teraz blokuje tylko NOWE.

**Runda 3 sędziów** (pierwszy uczciwy pomiar od 7,1): **8,37** (Grafika 7,6 / Merytoryka 8,3 / IT 9,2).

**Promocja „gotowe do testowania"**: demo `12826509a2`, tag `demo-do-testow-2026-07-24`.

### Triage gałęzi wiszących
6 kandydatów ocenione: **1 scalona** (`fix/panel-akcji-kolor` — kontrast AA, koniec pastelowych
tonów), **5 odrzucone** (duplikat starszy / cofały nowszą pracę o 91 commitów / już na demo).
7 gałęzi wartościowych a niescalonych **zabezpieczonych tagami `zachowane/*-2026-07-24`**, wypchnięte
na origin — nic nie zginie nawet po skasowaniu gałęzi.

### Program GRID STABILIZATION (dostarczony przez Piotra jako plik, cały dzień wykonania)
SSOT: **`Harvard/wdrozenie-100/_GRID_STABILIZATION_COMMAND_2026-07-24.md`** — pełna specyfikacja
7 etapów, 20 kryteriów akceptacji, wymagania per karta. **WYKONANE W CAŁOŚCI:**

- **Etap 1 (audyt)** — zmapowano `NType*` z dokumentu na realne `NMode*` w kodzie. Ustalono: 2/6
  kart (Insight, Narzędzie) idzie przez `NModeShell`, 4/6 hand-rollowało layout ręcznie.
- **Etap 2 (tokeny + szerokości)** — 7 tokenów `--ntype-*` w `src/index.css`. Lewy panel 242→**216px**,
  prawy panel 360→**320px** (jedna zmiana defaultu naprawiła 6/6 kart). Znaleziony i zdjęty DRUGI
  ukryty podwojony margines (Decyzja miała bespoke kanwę).
- **Etap 3 (menu)** — struktura była już w większości zgodna (wcześniejsze fale). Naprawiony JEDYNY
  realny defekt: dwa różne fiolety AI w repo (`violet-*` surowa skala vs token `--c-ai`) → ujednolicone.
- **Etap 4 (prawy panel)** — komunikat „Akcje ukryte w Podglądzie" usunięty w JEDNYM miejscu
  (`ArtifactRightPanel.tsx`, nowy prop `showZeroBadge`) zamiast per-karta. Narzędzie i Powiadomienie
  dostały brakujące sekcje (Actions/Comments/History) jako WIDOCZNE-PUSTE (0), bez nowego backendu —
  **moja decyzja CTO**, rozwiązuje dwie udokumentowane kolizje decyzji naraz. ★ Znaleziony i naprawiony
  ŻYWY BŁĄD: akordeon panelu nie synchronizował się z asynchroniczną zmianą `readMode`.
- **Etap 5 (6 kart)** — Zadanie: centrum 598→760px (token dokumentowy). Decyzja: hierarchia akcji
  (było 6 przycisków naraz → 1 primary + destructive + „More"). Inicjatywa: usunięty banner
  „draft journey" (★ audyt Etapu 1 GO NIE ZŁAPAŁ — grepował angielski tekst, string był polski;
  złapane na ŻYWYM RENDERZE). Insight: tryb analityczny (scoped, nie dotknął `NModeCanvas`).
  Narzędzie: `max-w-prose` na 27 blokach tekstu. Powiadomienie: potwierdzone już zgodne.
- **Naprawa dodatkowa**: lewy panel dostał własny scroll + zwijanie grup (odkrycie: grupowanie
  JUŻ ISTNIAŁO w danych dla 3 kart, dodano tylko UI; pozostałe 3 świadomie bez zmian — brak grup
  w danych, decyzja produktowa nie techniczna).
- **Etap 6 (QA wizualne, 2 rundy)** — runda 1 na 1024/1280/1920px znalazła **P0-1** (prawy panel
  CAŁKOWICIE ZNIKAŁ na 1024px w 3 kartach — `hidden xl:block`) i **P0-2** (kolumna zamrożona 592px
  w 3 kartach — token nigdy niepodłączony). Oba naprawione kopiując gotowe wzorce z Zadania/
  Powiadomienia. Runda 2 potwierdziła naprawę + znalazła P2 kosmetyczny (784 vs 760px) — też naprawiony.
- **Etap 7 (zamknięcie)** — pełny przegląd zakresu (17 plików, wszystkie w obrębie gridu, zero
  migracji, zero nowych funkcji), finalny aparat pomiarowy, promocja.
  **Demo = `553fbf3015`, tag `demo-grid-stabilizacja-2026-07-24`.**

## 2. PUNKTY COFANIA (chronologicznie, na demo)
| Tag | SHA | Znaczenie |
|---|---|---|
| `demo-safe-2026-07-23` | `9b143bc913` | przed nocą naprawczą |
| `demo-safe-2026-07-24` | `97f466bd98` | **zaakceptowany przez Piotra rano** |
| `demo-do-testow-2026-07-24` | `12826509a2` | pierwsze „gotowe do testowania" |
| `demo-do-testow-2026-07-24-b` | `662bb3c21f` | partia: widoczna powłoka + bramka list-canon |
| `demo-do-testow-2026-07-24-c` | `9218962778` | triage gałęzi (panel-akcji-kolor) |
| `demo-grid-stabilizacja-2026-07-24` | `553fbf3015` | **AKTUALNY** — cały program gridu |

★ Bezpieczniejsze cofnięcie konkretnej zmiany = `git revert` merge'a, nie skok do starego tagu —
między `demo-safe-2026-07-24` a teraz jest dużo pracy innych sesji (IDEE, agent, sejfy), powrót
do tagu by ją cofnął.

## 3. OTWARTE WĄTKI — TRZY SESJE PIOTRA W TOKU, status nieznany
Piotr odpalił lokalnie (osobne okna), nie mam wglądu w postęp:
1. **`task_9c0eba8a`** — nieczytelny tekst na Idea Table w trybie ciemnym (kontrast 1,31:1)
2. **`task_f206184a`** — surowa wartość „medium" zamiast tłumaczenia w polu „Pewność" karty Insight
3. **`task_b14d96d7`** — **DUŻY PROJEKT**: modernizacja `StandardArtifactShell` (kontrakt nie przyjmuje
   dzisiejszego `NModeMenu2` ani gotowego `ArtifactRightPanel`) + migracja 6 kart na wspólną powłokę
   docelową. To NIE jest to samo co dzisiejsza „stabilizacja gridu" — grid ujednolicił WYMIARY
   (szerokości/tokeny), ten projekt ma ujednolicić SAM KOMPONENT powłoki. Osobny, większy zakres.

**Następca: sprawdź czy te sesje żyją/skończyły, zanim cokolwiek na tych plikach zaczniesz —
ryzyko kolizji.**

## 4. ZNANY DŁUG (świadomie zostawiony, udokumentowany)
- `check-list-canon.sh` — 414 naruszeń zastanych (bramka DZIAŁA poprawnie, blokuje tylko nowe;
  to nie regresja, to nienaprawiony historyczny dług). Rozkład wg katalogu w raporcie agenta:
  MyWork 58/12 plików, Initiatives 42/13, Reports 31/10 itd. — naturalna kolejność fal sprzątania.
- Powiadomienie bez przycisku „Sekcje" w Menu2 — świadomie wyłączona flaga `ff.cardContract`
  (migracja D-8, `_PRZEPIS_MIGRACJI_NOTIFICATION_2026-07-22.md`, żyje na innej niescalonej gałęzi).
  NIE włączać bez decyzji Piotra na czystym zrzucie (reguła #7/#9).
- Ocena sędziów 8,37, nie 9,5 z pierwotnego mandatu nocnego — świadomie zamknięte jako „gotowe do
  testowania", nie „ideał". Merytoryka wciąż najsłabsza z realnych osi treści (Grafika po dzisiejszym
  gridzie prawdopodobnie wyżej, nieprzemierzona ponownie po Etapie 7).
- `InsightViewer` „Pewność: medium" surowa wartość — patrz task_f206184a wyżej, w toku.
- Aparat pomiarowy `scripts/karty-n-geometria.mjs` ma lukę: `--self-test` domyślnie mierzy tylko
  light/1280/1440 — dawał 6/12 na czystym demo (defekt narzędzia wstrzykiwania treści w dev-render,
  NIE defekt aplikacji, potwierdzone niezależnym Playwrightem). Warto naprawić, żeby „aparat
  niezdatny" nie fałszywie blokował przyszłe odbiory.
- Gałęzie `zachowane/*-2026-07-24` (7 sztuk) — zabezpieczone tagami, nie scalone celowo (duplikaty/
  cofają nowsze/niepowiązana historia). `odbior/lokalny-2026-07-23` (73 commity IDEE) ma NIEPOWIĄZANĄ
  historię z demo — jeśli kiedyś potrzebna, TYLKO cherry-pick per-SHA, NIGDY merge.

## 5. LEKCJE TEGO DNIA — MUSZĄ PRZETRWAĆ (kosztowały realny czas)
1. **Demo uciekało ~6× w ciągu doby** pod innymi równoległymi sesjami. ZAWSZE `git fetch` przed
   pracą I bezpośrednio przed pushem. Po każdym scaleniu `origin/demo`→hub POWTÓRZ render-verify —
   „zero konfliktów" nie znaczy bezpiecznie (jedno scalenie po cichu cofnęło naprawę kontrastu).
2. **Crimson-check tylko na własnych plikach NIE WYSTARCZA** — sprawdzaj CAŁY diff vs `origin/demo`
   przed każdą promocją, inaczej złapiesz tylko swoje zmiany, nie cudze regresje wniesione scaleniem.
3. **`git worktree add` nie zabezpiecza przed wejściem w cudzy katalog** — `cd` przechodzi mimo
   odmowy. Zawsze twórz NOWY worktree z losową unikalną nazwą, nigdy nie wchodź do istniejącego.
4. **Bramki potrafią dawać fałszywą zieleń** na czystym drzewie (0 plików sprawdzonych = nie to
   samo co „czysto"). Sprawdź, czy bramka faktycznie coś sprawdziła, zanim uwierzysz „✓".
5. **Audyty starzeją się w godzinach, nie dniach** — dwukrotnie dzisiaj wcześniejszy audyt się mylił
   (banner Inicjatywy — grep szukał angielskiego stringa, realny był polski; twierdzenie że lewy
   panel ma już scroll — miał tylko `sticky`, nie miał `overflow`). Zawsze weryfikuj na ŻYWYM
   renderze, nie ufaj wcześniejszemu dokumentowi ślepo.
6. **Mandat CTO**: decyzje techniczne (kontrakt komponentu, kompromis produkt vs zakres) podejmuję
   sam i raportuję z uzasadnieniem — nie odsyłam do Piotra, chyba że to realnie decyzja biznesowa/
   wizualna wymagająca jego oka (reguła #7).

## 6. GDZIE PRACOWAĆ
Worktree główny tej doby: `.worktrees/odbior-hub`, gałąź `odbior/hub-2026-07-23`. Po Etapie 7 ta
gałąź jest scalona z demo (`origin/demo` = przodek `HEAD` na hubie) — **następca może zacząć świeżą
gałąź wprost z `origin/demo`**, nie musi kontynuować na `odbior/hub-2026-07-23`, ale może, jeśli
chce zachować dziennik commitów tej doby.

Dokumenty źródłowe (czytaj w tej kolejności jeśli potrzeba więcej detalu):
1. Ten plik (`_HANDOFF_NASTEPCA_2026-07-24.md`)
2. `_GRID_STABILIZATION_COMMAND_2026-07-24.md` — SSOT gridu (wykonany, zostaw jako referencję)
3. `_RUNBOOK_DO_TESTOW_2026-07-24.md` — pełny log krok-po-kroku (fazy A-H + wszystkie etapy gridu)
4. `_AUDYT_GOTOWOSCI_ARTEFAKTY_2026-07-24.md` — audyt poranny
5. `_PETLA_NOCNA_9_5_2026-07-23.md` — dziennik nocy + 3 rundy sędziów

---

## 7. ★★★ PROMPT DLA NASTĘPCY (wklej na start nowej sesji) ★★★

```
Kontynuuję pracę nad Consultify po przekazaniu sesji. Poprzednia sesja skończyła tokeny
2026-07-24 wieczorem, w trakcie mandatu obejmującego naprawę produktu po nocnej pętli i pełny
program stabilizacji gridu n-Type. Zanim zrobię cokolwiek, czytam w całości:
Harvard/wdrozenie-100/_HANDOFF_NASTEPCA_2026-07-24.md — ten prompt jest jego streszczeniem,
nie zastępstwem; szczegóły, dowody i numery linii są tam.

## Kim jest Piotr i jak z nim pracować

Piotr jest właścicielem i CEO Consultify — AI-native systemu realizacji doradztwa, nie
generycznego SaaS-dashboardu. Nie jest programistą — myśli produktowo i strategicznie, mówi
po polsku, krótko, i najlepiej rozumie rzeczy pokazane obrazkiem niż opisane słowami. Nadał mi
(poprzedniej sesji) mandat CTO: decyzje techniczne — architektura, kompromisy, kolejność prac —
podejmuję sam i raportuję z uzasadnieniem, zamiast odsyłać każde pytanie do niego. To wciąż
obowiązuje. Nie pytaj go o rzeczy techniczne, które możesz rozstrzygnąć sam z dobrym uzasadnieniem
— pytaj tylko o decyzje produktowe/wizualne, których nie da się wywnioskować z kontekstu.

Dwie zasady w CLAUDE.md mają za sobą prawdziwe incydenty, więc nie są formalnością:
- **Piotr nigdy nie jest pierwszym testerem wizualnym.** Powód: załamanie 11 lipca, nazwane w
  dokumentacji „gwiazda" — Piotr zobaczył zepsuty ekran jako pierwszy i było to bolesne dla
  zaufania do całej pracy. Od tamtej pory: ZAWSZE render + zrzut własny, ZANIM cokolwiek trafi
  przed jego oczy, nawet na demo za flagą.
- **Zakaz masowego włączania.** Powód: krach 12 lipca, „tabelki jak dla trzylatka" — ktoś
  włączył naraz wiele flag wizualnych na żywo i rozjechało to ekrany. Odtąd: jeden ekran na
  raz, po akcepcie, nigdy hurtem.

## Czym jest ten dzień pracy, którą przejmuję

To była jedna, bardzo długa sesja, która przeszła przez kilka faz, każda z innym mandatem od
Piotra, i każda budowała na poprzedniej:

Zaczęło się od **nocnej pętli naprawczej** — Piotr poszedł spać z poleceniem „pracuj w kółko,
aż trzej niezależni sędziowie (Grafika, Merytoryka, IT) ocenią produkt średnio na 9,5 z 10".
Nie udało się dobić do 9,5 — skończyło na 7,1 (start był 5,9) — i to zostało powiedziane wprost
w porannym raporcie, żadnego naciągania liczb. Ale sama noc była wartościowa: wycięto dwanaście
rodzin kodu, który UDAWAŁ, że sztuczna inteligencja działa — zaszyte na sztywno odpowiedzi,
sztuczne opóźnienia symulujące „myślenie", fallbacki które po cichu meldowały sukces mimo awarii.
To jest temat, który wraca przez cały dzień: produkt miał tendencję do UDAWANIA, że coś działa,
zamiast albo działać naprawdę, albo uczciwie powiedzieć że nie działa. Duża część dzisiejszej
pracy to tropienie i likwidowanie tego wzorca w różnych miejscach.

Rano Piotr obejrzał wyniki, zaakceptował promocję na demo (tag `demo-safe-2026-07-24` — to jest
JEGO OSTATNI realny, oczami zweryfikowany akcept w tym dniu, zapamiętaj ten fakt) i wydał nowy,
szerszy mandat: „jedź tak długo, aż zrealizujesz wszystko, wypchnij na demo, posprzątaj gałęzie,
i dopiero wtedy daj mi jasny sygnał że jesteśmy gotowi do testowania". Chwilę później rozszerzył
to jeszcze: „każdą kolejną gotową partię wypychaj na demo sama, bez pytania mnie za każdym razem
o zgodę — chcę móc kliknąć i dać feedback, kiedy będę gotowy". To jest WAŻNE rozróżnienie od
zasady #7 — nie chodzi o to, że Piotr zgodził się być pierwszym testerem. Chodzi o to, że
zdjął wymóg pytania go o zgodę na PROMOCJĘ, pod warunkiem że JA nadal jestem pierwszym
testerem (render + zrzut własny) PRZED każdym pushem. Ta autoryzacja jest wciąż aktywna i nie
wygasła — ale teraz, gdy Piotr wyjeżdża na kilka dni, sensowniej jest pracować spokojniej niż
gonić z każdą partią, bo nikt po drugiej stronie nie czeka z kliknięciem (patrz sekcja „STATUS"
na górze dokumentu handoff).

Pod tym mandatem poszła długa fala napraw produktu: przywrócony ślad audytowy AI (wywołania
modelu przestały trafiać do rejestru administratora — regresja z nocy, teraz naprawiona jednym
punktem w kodzie, który obsługuje WSZYSTKIE narzędzia naraz), pasek statusu przestał zmyślać
„Szkic" gdy nie ma prawdziwego rekordu, eksport danych przestał obiecywać e-mail którego nikt
nie wysyła, jeden kolor został przywrócony tam gdzie łamał zakaz czerwieni jako koloru marki
(reguła #3 CLAUDE.md), sto dziewięćdziesiąt angielskich fraz w polskim pliku tłumaczeń zostało
przetłumaczonych, tysiąc pięćset linii martwego kodu usunięte (przy czym jeden plik omal nie
padł niesłusznie — sędzia IT twierdził że jest martwy, a był żywy, uratowany bo ktoś sprawdził
zamiast zaufać raportowi). Po drodze naprawiono też DWIE bramki jakości, które od jakiegoś
czasu kłamały — dawały zielone światło, nie sprawdzając w rzeczywistości niczego (jedna miała
wzorzec wyszukiwania, który wywalał się cicho na tym systemie operacyjnym; druga uznawała
„zero sprawdzonych plików" za sukces zamiast za ostrzeżenie). To jest wzorzec, na który warto
uważać dalej: narzędzia, którym ufamy, że nas ostrzegą, same potrafią kłamać, i trzeba to
sprawdzać, nie zakładać.

Trzecia runda trzech sędziów (pierwszy uczciwy pomiar od czasu 7,1) dała **8,37** — realny
postęp, choć wciąż poniżej pierwotnego celu 9,5. To zostało zamknięte jako „gotowe do
testowania", nie jako „ideał osiągnięty" — te dwa stany nie są tożsame i warto je rozróżniać
przy rozmowie z Piotrem.

Na koniec Piotr sam dostarczył **pełną, bardzo precyzyjną specyfikację** — dokument opisujący
dokładnie, jak ma wyglądać wspólny „grid" (układ, szerokości, menu, prawy panel) wszystkich
sześciu kart typu n (Zadanie, Decyzja, Insight, Inicjatywa, Narzędzie, Powiadomienie) — z
poleceniem „wykonaj zmiany, trzeba to zamknąć i ustabilizować". Ten dokument
(`_GRID_STABILIZATION_COMMAND_2026-07-24.md`) został wykonany od deski do deski, w siedmiu
etapach dokładnie takich, jak sam zalecał: audyt, tokeny, menu, prawy panel, karta po karcie,
QA na trzech szerokościach ekranu, i zamknięcie. Po drodze złapano i naprawiono realną
regresję, której żaden pojedynczy etap by nie zobaczył — prawy panel z Akcjami/Właściwościami/
Komentarzami/Historią CAŁKOWICIE ZNIKAŁ na najwęższej, wciąż wspieranej szerokości ekranu w
trzech z sześciu kart. Złapało to dopiero QA testujące trzecią szerokość, bo wcześniejsze
fronty testowały tylko dwie. To jest dobry przykład na to, dlaczego etap „QA na wszystkich
wymaganych szerokościach" nie jest formalnością — to jedyny moment, który znajduje błędy
powstające na PRZECIĘCIU dobrych zmian, nie w żadnej z nich osobno.

## Co jest otwarte i wymaga uwagi następcy

Trzy sesje, które Piotr sam odpalił lokalnie i które działają niezależnie ode mnie — nie mam
wglądu w ich postęp, trzeba sprawdzić czy żyją i co zrobiły: poprawka kontrastu tekstu na
tabeli pomysłów w trybie ciemnym; zamiana surowej angielskiej wartości „medium" na tłumaczenie
w polu pewności karty Insight; i największa z nich — modernizacja komponentu `StandardArtifactShell`
(dzisiejszy program ujednolicił SZEROKOŚCI i geometrię sześciu kart, ale sam komponent wspólnej
powłoki wciąż nie przyjmuje ich dzisiejszego menu ani gotowego prawego panelu — to osobny,
większy projekt architektoniczny, nie mylić z dzisiejszą stabilizacją gridu).

Zanim dotkniesz plików, które mogły być w zakresie tamtych trzech sesji, sprawdź czy nie
kolidujesz — dziś kilka razy różne fronty pracy wchodziły sobie w drogę na tych samych plikach,
i za każdym razem kosztowało to dodatkową rundę weryfikacji.

## Pierwsze kroki po przeczytaniu handoff docu

Sprawdź najpierw, czy w tej rozmowie jest już jakaś wiadomość od Piotra — jeśli tak, ma
pierwszeństwo przed wszystkim powyżej, potraktuj to jako aktualizację, nie jako coś do
zignorowania na rzecz starego planu. Jeśli nie ma — zrób `git fetch` i zweryfikuj SAMODZIELNIE
(nie z pamięci) aktualny `gitSha` na `https://demo.consultify.ai/api/health`, bo demo potrafiło
w ciągu jednego dnia uciec pod innymi sesjami sześć razy. Jeśli Piotr w niedzielę zgłosi coś,
co wygląda jak zepsucie — sprawdź najpierw, czy to nie jest ZAMIERZONA zmiana z dzisiejszego
programu gridu (inne szerokości paneli, panel który teraz przewija się zamiast rosnąć bez
końca, zniknięty komunikat o ukrytych akcjach w trybie podglądu, jeden spójny fiolet zamiast
dwóch) — o czym może po prostu nie wiedzieć, bo nie widział jeszcze na oczy.

Zasady, których nie łamię niezależnie od tego, co robię dalej: demo jest święte — nigdy force
push, nigdy reset, migracje bazy tylko ręcznie na właściwym hoście (trolley, nigdy centerbeam/
produkcja) i tylko po świadomej decyzji. Sprawdzam CAŁY diff względem demo pod kątem
niedozwolonego koloru marki, nie tylko pliki które sam dotknąłem — bo scalenie cudzej pracy
potrafi po cichu cofnąć czyjąś wcześniejszą naprawę. I nie ufam bramce jakości, dopóki nie
sprawdzę, że faktycznie coś sprawdziła, a nie tylko powiedziała „OK" bo nic nie miała do
zbadania.

Czekam na Twoje pierwsze pytanie albo zadanie.
```
