# AUDYT GOTOWOŚCI — artefakty (stan 2026-07-24, po nocy naprawczej)

> Zakres: 7 pozycji, które właściciel odbiera jako „artefakty" — 6 kart standardu n-Type
> + Sesja wywiadu (formalnie narzędzie, nie karta N, ale ma własną pozycję w odbiorze).
> Pomiary z **żywego środowiska** `localhost:3000/odbior.html`, nie z dokumentacji.

---

## 1. WERDYKT ZBIORCZY

| Miara | Wynik | Uwaga |
|---|:--:|---|
| Audyt środowiska (18 obiektów × 2 motywy) | **18/18** | zmierzone 2026-07-24, po scaleniu fali 2 |
| Bramki `artefakt` · `triada` · `gestosc` · `sqlsql` | **zielone** | |
| Bramka `list-canon` | **CZERWONA** | 11 naruszeń, ★ dług **zastany na demo** — identyczny zbiór przed i po promocji (§7) |
| Testy rubryki analizy AI | **18/18** | `cardAnalysisRubric.test.ts` |
| Uchwyty edycji w trybie Podgląd | **0 na wszystkich kartach** | było: Decyzja 6, Zadanie 8, Inicjatywa 24, Insight 22 |
| Atrapy AI (kod udający działanie modelu) | **12 rodzin wyciętych** | |
| Ocena 3 sędziów | **7,1** (start 5,9) | ★ cel 9,5 **nieosiągnięty** |

**Gotowość do odbioru: TAK.** Każdy z 7 artefaktów da się przeklikać, ma treść, prawy panel,
tabelę właściwości, panel uwag i czysty tryb ciemny.
**Gotowość do uznania za skończone: NIE** — patrz §4.

---

## 2. STAN PER ARTEFAKT

Kolumna „ocena" to **baseline sprzed nocy** (runda 1 sędziów). ★ **Ocena po fali 2 NIE ZOSTAŁA
ZMIERZONA** — trzecia runda sędziów się nie odbyła, bo noc się skończyła. Nie wpisuję liczb,
których nie zmierzyłem.

| Artefakt | Treść | Klikalne | Ocena (baseline G/M/IT) | Co naprawione w nocy |
|---|:--:|:--:|:--:|---|
| **Decyzja** | 841 zn. | 38 | 7,5 / 6,0 / 5,0 | 11 martwych wywołań AI; „Skróć" niszczący zdanie; uchwyty 6→0; kontrast CTA 4,35→17,09:1 |
| **Zadanie** | 1048 zn. | 33 | 7,5 / 5,5 / 5,5 | 2 przyciski AI = czysty komunikat; zmyślony „komentarz AI"; 6 generatorów udających pracę modelu; `expectedOutcome` — łańcuch przerwany w 3 miejscach |
| **Powiadomienie** | 538 zn. | 23 | 6,5 / 4,5 / 6,5 | surowy enum „AI RISK DETECTED"; chip 2,58:1; cichy no-op zapisu; pewność `0,82%`→`82%` |
| **Insight** | 5849 zn. | 34 | 5,0 / 5,0 / 7,0 | surowy klucz i18n jako tekst; uchwyty 22→0; testy 26 błędów→0; edytowalne pola + backend |
| **Narzędzie** | 6229 zn. | 15 | 5,0 / 6,5 / 7,5 | panel 3/7 sekcji kanonu; czcionka 8 px; **90 podmian językowych**; Menu 2 „Sekcje" |
| **Inicjatywa** | 729 zn. | 21 | 4,5 / 5,0 / 6,0 | **Podgląd ≡ Edycja** (24 uchwyty→0); 5 atrap AI + 8 dalszych przycisków; awaria panelu przy „Wykryj zależności" |
| **Sesja wywiadu** | — | — | poza rundą | pozycja w odbiorze istnieje; formalnie narzędzie, nie karta N |

**Treść mierzona po tekście widocznym na ekranie.** Niska liczba znaków (Powiadomienie 538,
Inicjatywa 729) to karty z krótką treścią demo, nie braki renderu — próg audytu to 250 znaków.

---

## 3. CO REALNIE ZMIENIŁA NOC

**Produkt przestał kłamać użytkownikowi.** To jedyna zmiana tej nocy, która ma znaczenie
biznesowe. Wycięliśmy 12 rodzin kodu, który udawał, że AI zadziałało:

- generator wpisujący **zawsze te same 6 zaszytych fraz**
- komentarz zmyślony i **podpisany „AI Assistant"**, z komunikatem sukcesu
- „Skróć" ucinający zdanie w połowie — **niszczył treść użytkownika**
- 6 generatorów symulujących pracę modelu opóźnieniem + zaszytą treścią
- generator RACI wstawiający po awarii **pierwsze 4 osoby z listy** i meldujący sukces
- pasek statusu **fabrykujący „Szkic"** na każdym artefakcie bez rekordu zatwierdzenia
- 5 kolejnych w module Inicjatyw — z komentarzem w kodzie: „symuluj chwilę myślenia"

Wspólna przyczyna: jeden endpoint zwracał strukturę bez pola, które czytało **15 miejsc w kodzie**.
Nic nie rzucało błędu — odpowiedź poprawna, pole puste, gałąź awaryjna. Tokeny palone, wynik wyrzucany.

**Weryfikacja nie jest deklaracją:** agenci symulowali awarię AI i mierzyli sumę kontrolną znaków
pola przed i po. Identyczna — treść nietknięta, komunikat uczciwy.

★ **Decyzja, która najlepiej pokazuje kierunek:** przy 4 z 5 atrap Inicjatywy agent **odmówił
podłączenia AI**. Funkcje liczyły poprawnie — kłamała wyłącznie etykieta. Przy „Zaproponuj terminy"
uzasadnił wprost: arytmetyka dat to klasa zadań, w której model myli się częściej niż kod,
a wynik trafia do realnych rekordów. **Podłączenie AI pogorszyłoby produkt.**

---

## 4. DLACZEGO TO NIE JEST „SKOŃCZONE"

**Ocena 7,1 przy celu 9,5.** Brakuje 2,4 punktu. Jedna runda naprawcza dała +1,2, więc do celu
potrzeba jeszcze około dwóch takich rund.

Otwarte, znane, nieocenione:

1. **Tryb Podgląd niespójny** — Inicjatywa zostawia aktywne „Utwórz wariant" i „Oznacz jako ukończone",
   Insight „Zgłoś do recenzji" i przełącznik stanu. Decyzja właściciela: **Podgląd = tylko czytanie,
   wszędzie.** Do wykonania.
2. ~~**Ślad audytowy AI zniknął**~~ **→ NAPRAWIONE** (gałąź `fix/ai-regresje-audyt-powiadomienie`
   @ `6e88aa4975`, czeka scalenia). Audyt jest per-handler w `ai.routes.ts`; `/generate` nie wołał
   `AIAuditLogger.logSuggestion`, które `/chat` wołał. Jedna wstawka na endpoincie przywraca ślad dla
   CAŁEJ floty (wszystkie narzędzia idą przez `/generate`). Dowód: test route-level na prawdziwym
   routerze, 2/2 PASS. ★ Do decyzji: wpisy z `/generate` mają `project_id=NULL` (kontrakt nie niesie
   projectId) — jeśli audyt ma być scope'owany per-projekt, dosłać opcjonalne `projectId`.
3. ~~**Powiadomienie loguje błąd pustej odpowiedzi modelu przy wejściu**~~ **→ NAPRAWIONE** (ta sama gałąź).
   `useEffect` odpalał `handleAnalyzeWithAI` przez `setTimeout` przy montażu — usunięty. Zmierzone:
   wejście → 0 wywołań AI, klik „Analizuj z AI" → 1. Ścieżka ręczna nietknięta.
4. ~~**Pasek „Szkic"** zabramkowany po stronie wywołań~~ **→ NAPRAWIONE U ŹRÓDŁA** (gałąź
   `fix/pasek-szkic-zrodlo` @ `f925e5108c`, czeka scalenia). `ArtifactApprovalStatusBar:105`
   spadał na `state ?? 'draft'`; hook odrzucał sygnał `assignment: null` (= brak rekordu). Teraz
   hook wystawia `hasRecord`, pasek renderuje pigułkę TYLKO z prawdziwym rekordem, inaczej pokazuje
   akcję wejścia w obieg albo znika (null). Zweryfikowane na Decyzji/Inicjatywie, light+dark.
   ★ Do decyzji: 3 bramki-obejścia z nocy stają się zbędne — 2 bezpieczne do zdjęcia, 1
   (`DecisionDetailView:4562`) zmienia KIEDY pasek się montuje, wymaga świadomej zgody. Cleanup PO scaleniu.
5. **Cztery różne szerokości powłoki** (1488/1332/1496/1364) — karty nie dzielą jednej powłoki.
   ★ ROZPOZNANE: źródłem są różne tokeny `max-w-*` per karta (`[1500px]` Decyzja/Zadanie,
   `7xl` Inicjatywa, `6xl` Powiadomienie/Insight/Narzędzie) + rozjazd 48 px Menu 1 vs Menu 2
   wewnątrz `NModeShell:170` (px wewnątrz vs zewnątrz limitu). **W TOKU** — prerekwizyt
   (Etap 0 NModeShell + Etap 1 podpięcie Insight/Narzędzie) na gałęzi `fix/powloka-etap0-etap1`.
6. **`StandardArtifactShell`** — 0 konsumentów, ★ ale **NIE martwy kod** (moje „skasować" było błędne):
   to celowo zbudowana, niepodpięta **powłoka docelowa** (Fala F) nad `NModeShell`. Kasowanie =
   wyrzucenie rusztowania, które ujednolica karty. Plan migracji M1–M7 istnieje w `registry.ts`.
   Kolejność wg ciężaru: tool → notification → interview → decision → insight → task → **initiative (Opus)**.
7. ~~**Poza kartami:** „Eksport danych" melduje „otrzymasz e-mail" i nie robi nic~~ **→ NAPRAWIONE**
   (gałąź `fix/eksport-danych-atrapa`, scalona partią 1). Podłączony do działającego synchronicznego
   endpointu `GET /api/user/data-controls/data-export` → pobiera realny JSON, komunikat mówi prawdę.
   ★ Zgłoszone osobno: 2 pokrewne atrapy eksportu w sąsiednich komponentach (`Api.exportUserData`
   zwraca pusty obiekt; `DataControlsSettings` woła niezamontowaną ścieżkę) — do ujednolicenia.

---

## §9. PARTIA 1 SCALONA NA HUB (nie na demo)
Trzy gotowe gałęzie scalone jedną falą z twardą weryfikacją plików, zero konfliktów (rozłączne pliki):
`fix/ai-regresje-audyt-powiadomienie` + `fix/pasek-szkic-zrodlo` + `fix/eksport-danych-atrapa`.
Twarda weryfikacja po scaleniu (lekcja o dwóch delecjach): wszystkie 4 kluczowe zmiany fizycznie
obecne — `logSuggestion` w `/generate`, auto-trigger AI usunięty z Powiadomienia, `?? 'draft'`
zniknął (`hasRecord`), obietnica e-maila zniknęła. esbuild parse-only 5/5 czysto (błąd `--bundle`
na `ai.routes` to nierozwiązany `cheerio`, nie składnia). Crimson na diff vs demo = **0**.
Hub **16 commitów ponad `origin/demo`**. Demo nietknięte (`97f466bd98`).

---

## 5. CZEGO W TYM AUDYCIE NIE MA (świadomie)

- **Ocen sędziów po fali 2** — trzecia runda się nie odbyła. Liczby z §2 są sprzed nocy.
- **Oceny Sesji wywiadu** — nie była w zakresie rundy sędziów.
- **Potwierdzenia zachowania na demo** — pomiary pochodzą ze środowiska odbioru (harness
  z danymi testowymi), nie z żywej aplikacji po zalogowaniu.

★ Metodyczna lekcja tej nocy: **narzędzie pomiarowe potrafi cicho unieważnić pomiar.** Harness
nie montował komponentu wyświetlającego komunikaty — więc każdy komunikat błędu był w nim
niewidoczny, a kilka raportów „widać uczciwy błąd" opierało się na odczycie kodu, nie na oku.
Trzy razy tej nocy ogłosiłem defekt systemowy, który nie istniał; dwa razy odwołali to sami sędziowie.

---

## 6. ŹRÓDŁA
- Dziennik pętli z pomiarami: `_PETLA_NOCNA_9_5_2026-07-23.md`
- Raport poranny (wynik, decyzje, moje błędy): `_RANO_2026-07-24.md`
- Audyt środowiska (surowy):
  `docs/testing/reports/AUDYT_SRODOWISKA_ODBIORU.md`
- Standard: `_STANDARD_N_TYPE_2026-07-23/`

---

## 7. PROMOCJA NA DEMO — WYKONANA (2026-07-24, autoryzacja właściciela)

**SHA na demo:** `97f466bd98` — potwierdzony na `/api/health` (zgodny z wypchniętym).
Deploy SUCCESS, baza i cache podłączone. **Nowy punkt cofania: `demo-safe-2026-07-24`**;
poprzedni `demo-safe-2026-07-23` (`9b143bc913`) nietknięty. Fast-forward, bez force.
88 commitów (86 nocnych + docs + merge). Historia demo zachowana.

**Migracja Insightu — ręcznie na DEMO/trolley, przed pushem kodu.** Kolumna
`interview_insights.section_overrides` dodana, 19 wierszy, wszystkie NULL (zero zmiany zachowania).
★ Bramka hosta przetestowana negatywnie: podanie PROD (centerbeam) **odmówiło wykonania**.
Produkcja nietknięta.

**Automat dorabiający kolumnę ZOSTAWIONY — wbrew mojej rekomendacji, z lepszym powodem.**
Migracja 931 nie poszła na PROD. Ten kod pojedzie kiedyś forward-portem demo → Londyn → prod;
zdjęcie guardu teraz wysypałoby zapis Insightu na produkcji do czasu, aż ktoś sobie przypomni
o migracji. Koszt zostawienia zerowy (jedno tanie sprawdzenie raz na proces, potem flaga zwiera).
**Do zdjęcia dopiero po uruchomieniu 931 na produkcji.**

**Czerwona bramka przepuszczona świadomie, z dowodem.** `check-list-canon.sh` = 11 naruszeń
(surowe tabele). A/B na tym samym zestawie plików w drzewie `origin/demo` sprzed merge'a:
**11 przed, 11 po, zbiory identyczne**, skrypt bramki niezmieniony. To dług zastany na demo,
nie coś, co ta promocja wnosi. Zatrzymanie cofnęłoby całą noc za błąd, którego demo już nie łapie.
★ **Do naprawy osobno** — bramka, która jest trwale czerwona, przestaje cokolwiek chronić.

---

## 8. WERYFIKACJA BRAMEK PO FAKCIE — FAŁSZYWA ZIELEŃ I REALNY PRZEBIEG (2026-07-24, druga sesja)

**Na demo NIE poszła żadna regresja bramkowa.** Sprawdzone jawnie, plik po pliku, na
liście 57 plików nocy (`git diff --name-only 9b143bc913..1666ad39cb`, w tym 23 pliki kodu
wizualnego). Praca nocna nie WNOSI ani jednego nowego naruszenia crimson / tabeli /
gęstości / kart N. Bramki, które są czerwone (`check-list-canon` = 8 plików), są czerwone
długiem ZASTANYM sprzed nocy — identycznym na `9b143bc913`. Szczegóły i metoda niżej.

### 8.1 Na czym polega fałszywa zieleń (DWA niezależne mechanizmy)

**Mechanizm A — pusty payload na czystym drzewie (dotyczy `check-triada`, `check-gestosc`
BLOK 2, `check-list-canon`).** W trybie skanowania dla plików ŚLEDZONYCH treść do sprawdzenia
brana jest z `git diff` (dodane linie) albo z `git status` (nowy plik). Po commicie drzewo
jest czyste → `git diff` pusty → `PAYLOAD` pusty → `[ -z "$PAYLOAD" ] && continue` pomija
sprawdzenie. Bramka melduje sukces po sprawdzeniu ZERA treści. Dowód, dosłownie:

```
$ bash scripts/check-triada.sh          # bez argumentów, czyste drzewo
✓ check-triada: brak nowych naruszeń crimson (sprawdzono plików: 0)
$ bash scripts/check-gestosc.sh
✓ check-gestosc: brak regresji mechanicznych (sprawdzono plików: 0)
```

Licznik „sprawdzono plików" w `check-triada` jest dodatkowo mylący: inkrementuje się PRZED
sprawdzeniem payloadu, więc przy jawnej liście 23 plików pokazuje „sprawdzono plików: 23",
a i tak sprawdził 0 treści (payload każdego pliku pusty). „23" to liczba plików wziętych pod
uwagę, nie liczba plików z realnie sprawdzoną treścią.

**Mechanizm B — bug BSD grep na macOS UNIEWAŻNIA `check-triada` całkowicie (nie tylko na
czystym drzewie).** To jest gorsze niż samo pierwsze odkrycie. W `check-triada.sh` (linie
146/148) payload dla pliku śledzonego liczy się tak:

```
git diff --cached -U0 -- "$f" | grep -E '^\+' | grep -v '^\+\+\+' | sed 's/^\+//'
```

Ostatni człon `grep -v '^\+\+\+'` jest w trybie BRE (bez `-E`). Systemowy `/usr/bin/grep` na
tym macu (BSD grep) odrzuca `\+\+` jako **`grep: repetition-operator operand invalid`** (exit 2,
zero wyjścia). Skutek: `PAYLOAD` wychodzi PUSTY **nawet gdy diff ma realne dodane linie** —
człon czyszczący nagłówek `+++` wywala cały strumień. Zweryfikowane na realnym wejściu:

```
$ printf '+++ b/file\n+primary-100 crimson\n' | /usr/bin/grep -E '^\+' | /usr/bin/grep -v '^\+\+\+'
grep: repetition-operator operand invalid           # exit 2, brak wyjścia → payload=''
```

Czyli **na tej maszynie `check-triada` w trybie skanowania nie jest w stanie wykryć ŻADNEGO
crimson w pliku śledzonym**, niezależnie od stanu drzewa i niezależnie od tego, czy poda się
jawną listę plików. Sam regex wykrywający (`VIOL_RE`) jest OK na BSD grep — psuje się
wcześniejszy człon pipeline'u czyszczący diff. Hook pewnie działał historycznie na maszynie z
GNU grepem (gdzie `\+` w BRE to rozszerzenie „jeden lub więcej"). Na Macu Piotra — martwy.
Werdykt: **błąd grep unieważnia pomiar `check-triada` przez sam skrypt.** Dlatego crimson
sprawdziłem osobno, replikując logikę bramki ręcznie (§8.3), nie ufając jej wyjściu.

Bramki NIE dotknięte bugiem grep (czytają plik wprost, bez pipeline `\+\+`): `check-artefakt`
(`count_violations` = `grep -nE` na całym pliku), `check-list-canon`, `check-gestosc` (awk),
`check-sqlsql`, `check-ssot-paths`. Ich wyjście jest wiarygodne, o ile poda się realną treść.

### 8.2 Jak uruchamiać bramki POPRAWNIE

- **Nigdy na czystym drzewie bez argumentów** — to gwarantowana fałszywa zieleń dla
  `check-triada`/`check-gestosc` (mechanizm A). Bramka jest sensowna tylko wtedy, gdy realnie
  dostaje treść: przed commitem (staging niepusty) albo z jawną listą plików.
- **Dla oceny PO fakcie** (praca już zacommitowana / na demo) diff-owe bramki NIE nadają się
  „z pudełka": porównują drzewo robocze z HEAD, a nie z punktem sprzed pracy. Trzeba albo
  odtworzyć treść w drzewie, albo — jak tutaj — puścić logikę detekcji bramki na
  `git diff <przed>..<po>` / na blobach z commitu (`git show <sha>:<plik>`).
- **`check-artefakt`** (ratchet po całym pliku) działa po fakcie poprawnie — ale porównuje z
  baseline'em `scripts/check-artefakt.baseline.txt` (dziś 274), a nie ze stanem sprzed nocy.
  Naruszenie DODANE nocą, ale wciąż poniżej zawyżonego baseline'u, przeszłoby. Dlatego stan
  crimson w powłoce liczyłem osobno: `9b143bc913` vs `1666ad39cb` per plik (§8.3), nie ufając
  samej ratchecie.
- **Na macOS**: dopóki `grep -v '^\+\+\+'` w `check-triada` nie dostanie `-E` (albo nie zmieni
  wzorca na `^[+][+][+]`), wyjście tej bramki jest bezwartościowe niezależnie od wywołania.

### 8.3 Realny przebieg — metoda i wynik

Metoda: dla każdej bramki puściłem JEJ logikę detekcji na jawnej treści nocy, nie na pustym
drzewie. Crimson (`check-triada`, `check-artefakt` PART 1): regex bramki na dodanych liniach
`git diff 9b143bc913..1666ad39cb` oraz per-plik na blobach obu commitów. Tabele
(`check-list-canon`), gęstość (`check-gestosc`), karty N (`check-artefakt` PART 2), sql, ssot:
skrypt z jawną listą plików nocy + porównanie `git show 9b143bc913:` vs `1666ad39cb:`.

| Bramka | Naruszenia (stan demo) | Zastane | Regresje nocy |
|---|---|---|---|
| `check-triada` (crimson w dodanych liniach, 23 pliki) | 0 | — | **0** |
| `check-artefakt` PART 1 (crimson w powłoce SPEC-A) | 0 nowych (7 ≤ baseline 274; pliki powłoki tknięte nocą: NModeCardState 1=1, reszta 0=0) | — | **0** |
| `check-artefakt` PART 2 · R2 `createPortal` (7 kart N) | 0 | 0 | **0** |
| `check-artefakt` PART 2 · R3 zarezerwowane id w lewej nawigacji | 0 blokujących (raw-grep 0–2/plik, ale wszystkie = prawy panel; identyczne baza vs demo) | wszystkie | **0** |
| `check-artefakt` PART 2 · R1 solid CTA (OSTRZEŻENIE, z definicji nieblokujące) | 1 (TaskDetailView) | — | n/d (nie blokuje) |
| `check-list-canon` (surowe tabele) | 8 plików | **8** | **0** |
| `check-gestosc` BLOK 1/2/3 (blokujące) | 0 | 0 | **0** |
| `check-gestosc` ostrzeżenia (toolbar >5) | 5 plików | pre-existing szum heurystyki | **0** |
| `check-sqlsql` (migracja 931) | 0 | — | **0** |
| `check-ssot-paths` (CLAUDE.md) | 0 (noc nie ruszała CLAUDE.md) | — | — |

**Podział `check-list-canon` (jedyna czerwona bramka), 8 plików — wszystkie ZASTANE:**
CompletenessAnalysis, FeasibilityAnalysis, LogicAnalysis, ResourcesAnalysis,
InitiativeDocumentView (po 2 markery tabeli), InsightViewer (3), DecisionDetailView (23),
TaskDetailView (8). Liczba markerów `<table>/<thead>/<tbody>/role=table` **identyczna na
`9b143bc913` i `1666ad39cb`** dla każdego pliku; wszystkie istniały przed nocą; dodanych linii
nocy z markerem tabeli = **0**. To ten sam dług, który §7 opisał jako „11 przed, 11 po" (8
plików × podwójne trafienia = 11 linii komunikatu). Noc go nie wnosi ani nie powiększa.

### 8.4 Wniosek

Bramki nocą świeciły zielono, bo (A) biegły na czystym drzewie po zerowej treści, a dla crimson
dodatkowo (B) `check-triada` jest na tym Macu trwale ślepy przez bug BSD grep. **Mimo to** — po
uczciwym przeliczeniu logiki bramek na realnej treści nocy — praca nocna **nie wnosi żadnej
regresji bramkowej**: crimson 0, tabele 0 nowych, gęstość 0, karty N 0 blokujących. Jedyna
czerwień (`check-list-canon`, 8 plików) to dług sprzed nocy. Zieleń była fałszywa co do METODY,
ale werdykt („noc nie psuje bramek") okazał się prawdziwy — potwierdzony pomiarem, nie zaufaniem
do skryptu.

Dwie rzeczy do naprawy osobno (decyzja właściciela), NIE w tym przebiegu:
1. `check-triada.sh` — `grep -v '^\+\+\+'` → `grep -Ev '^\+\+\+'` (albo `'^[+][+][+]'`), inaczej
   bramka crimson jest na macOS martwa. Klasa błędu bliźniacza do „fantomowej flagi".
2. `check-list-canon` — trwale czerwony dług zastany (8 plików). Bramka stale czerwona nie
   chroni już przed niczym.

### §8a. NARZĘDZIE NAPRAWIONE (2026-07-24, po ustaleniach §8)
`check-triada.sh` ożywiona i zweryfikowana czynnie:
- `grep -v '^\+\+\+'` (BRE, wywalał BSD grep) → `grep -Ev` — **test negatywny: crimson w zakresie
  daje teraz exit 1** (wcześniej 0, ślepa). Probe `bg-primary-600`/`c-accent` złapany.
- „sprawdzono 0 plików" **ostrzega** zamiast meldować sukces — zero sprawdzonych ≠ zielone.
Commit na hubie (nie na demo — demo nietknięte pod `97f466bd98`).
★ **Do sprawdzenia osobno:** czy siostrzane bramki (`check-artefakt`, `check-list-canon`,
`check-gestosc`, `check-sqlsql`) mają ten sam mechanizm „0 plików = fałszywa zieleń" na czystym
drzewie. `grep` BRE był tylko w `check-triada`, ale pusty-payload-na-czystym-drzewie może być wspólny.
