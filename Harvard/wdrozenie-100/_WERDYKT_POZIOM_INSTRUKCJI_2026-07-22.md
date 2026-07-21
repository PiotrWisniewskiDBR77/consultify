# WERDYKT — czy instrukcje Consultify są na poziomie BCG

**Dla:** Piotr · **Data:** 2026-07-22 · **Gałąź:** `fix/prv-mywork-preview` (worktree `.worktrees/prv-mywork`, baza `origin/demo`)
**Podstawa:** 3 audyty korpusów (`_AUDYT_INSTRUKCJI_1..3_2026-07-22.md`) + własna weryfikacja 8 twierdzeń o najwyższej stawce.
**Charakter:** ocena. Zero zmian w plikach źródłowych.

---

## 1. ODPOWIEDŹ

**Częściowo — i granica biegnie w jednym, powtarzalnym miejscu: instrukcje, które UCZĄ, są na poziomie BCG; instrukcje, które WYKONUJĄ, nie są. A to te drugie dotykają klienta.**

Wszystkie trzy korpusy pokazały ten sam gradient, niezależnie od siebie: **jakość spada tym mocniej, im bliżej punktu użycia.**

| Korpus | Warstwa daleka od użycia | Warstwa w punkcie użycia |
|---|---|---|
| Prompty AI | ~6 promptów spełnia wszystkie 8 kryteriów | 76 promptów Mind Map/Whiteboard/Flow/Tabela — **zero** z 8 reguł |
| Doktryna treści | `CONCLUSION_LAYER_STANDARD.md` = **8/10** | 63 placeholdery w kartach = **2/10** |
| Instrukcje agentów | forma pisarska = **8/10** | integralność (liczby, źródła, egzekucja) = **3/10** |

**Tak-więc:** problemem nie jest wiedza. Wiecie, jak wygląda dobry wniosek — jest to zapisane, i to dobrze zapisane. Problemem jest **dystrybucja**: najlepszy materiał leży najdalej od konsultanta, który realnie pisze przy kliencie. Dlatego nie zlecaj przepisywania instrukcji „pod BCG" — przepisywanie zniszczy działające fragmenty i nie tknie realnego problemu.

---

## 2. OCENA KORPUSÓW

| Korpus | /10 | Jedno zdanie | Co decyduje o ocenie |
|---|---|---|---|
| **1. Prompty AI** (treść dla klienta) | **7** | Górna warstwa bez wstydu na stół partnera, dolna produkuje tekst dobrego chatbota. | Rozrzut, nie jakość. „Gotowe do klienta" osiąga ~1/3 korpusu (179 plików, 524 wystąpienia promptu). |
| **2. Doktryna treści** | **5** | Wiedza istnieje i jest mocna — w dokumencie najdalszym od miejsca pisania. | Spadek przez trzy warstwy: 8/10 → 5/10 → 2/10. **0 z 63** placeholderów niesie choć jedną cyfrę. |
| **3. Instrukcje dla agentów** | **5** | Napisane lepiej niż przeciętny deliverable BCG, ale liczby nie zgadzają się same ze sobą. | 36 dokumentów-widm (podłoga, nie sufit); ta sama lista ma 40 i 43 punkty. |
| **4. —** | **brak** | **Dokument `_AUDYT_INSTRUKCJI_4_*` nie istnieje.** | Zlecono 4 korpusy, dostarczono 3. Nie zgaduję, co miał obejmować — brak śladu w treści pozostałych trzech i w repo. |

**Ocena łączna: 6/10.** Korpusy 1–2 ważą więcej niż 3, bo dotykają klienta; korpus 3 dotyczy wyłącznie naszej pracy wewnętrznej.

Co ta ocena znaczy w praktyce: **materiał, który pokazujesz na spotkaniu sprzedażowym, jest klasy doradczej. Materiał, który powstaje na ekranie w trakcie warsztatu — nie zawsze.**

---

## 3. ★ GDZIE JESTEŚMY LEPSI, NIŻ SIĘ SPODZIEWANO

Cztery rzeczy trzymają poziom top-tier. Wymieniam je, żebyś ich nie zniszczył przy następnej fali.

### 3.1. Bezpiecznik istnieje i jest na demo — audyt 3 się mylił (★ moja korekta)

Audyt 3 postawił jako ustalenie nr 1 (★★★★★): *„żaden z pięciu skryptów `check-*.sh` nie jest wywoływany automatycznie (…) Wszystkie trzy zdania o «blokowaniu» w `CLAUDE.md` są nieprawdziwe"* (`_AUDYT_INSTRUKCJI_3_AGENCI_2026-07-22.md:41`).

**Sprawdziłem. Guardy istnieją, są wpięte i są na `origin/demo`:**

- `git cat-file -p origin/demo:.husky/pre-commit` → **81 linii, 6 guardów** (kanon tabel · crimson w powłoce artefaktu · crimson w liście · doktryna gęstości · klasa `.sql.sql` · martwe ścieżki SSOT w `CLAUDE.md`)
- stoi za nimi **~37 KB realnych skryptów**: `check-artefakt.sh` (12,9 KB), `check-gestosc.sh` (10,5 KB), `check-triada.sh` (6,8 KB), `check-list-canon.sh` (4,0 KB), `check-sqlsql.sh` (2,3 KB), `check-ssot-paths.sh` (0,8 KB)
- commit `3425a359de` jest przodkiem `origin/demo` — zweryfikowane `git merge-base --is-ancestor`

**Dlaczego mimo to nie odpalają:** `git config --local core.hooksPath` wskazuje `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/.husky` — czyli **poza worktree**, na kopię w głównym checkoucie, a tamta kopia to zaśniedziały kikut z 13 lipca (112 B, `exit 0`).

**Tak-więc:** to nie jest „nikt nie zbudował siatki bezpieczeństwa" — ktoś ją zbudował, wpiął i scalił na demo. Jedno nieaktualne ustawienie gita kieruje git w martwą kopię. **Naprawa to jedna komenda (`git config --unset core.hooksPath`), nie projekt.** Uczciwie: część twierdzenia audytu 3 stoi — `pre-push` jest `exit 0` w OBU kopiach, więc zdanie z `CLAUDE.md:43-44` o „OBOWIĄZKOWO przed KAŻDYM push" opisuje procedurę ludzką, nie automat.

**Kalibracja dla Ciebie:** audyt, który karcił korpus za łamanie ZŁOTEJ REGUŁY 1 („weryfikuj realny runtime"), sam zatrzymał się o jeden krok za wcześnie. Traktuj te trzy dokumenty jak dobry materiał źródłowy, nie jak wyrok.

### 3.2. Testy zamiast definicji — to jest realnie klasa BCG

> „**Test: czy zdanie pasowałoby do dowolnej firmy na świecie?**" — `docs/standards/CONCLUSION_LAYER_STANDARD.md:46` (R1)
> „**czy przy przeciwnych danych napisalibyśmy to samo zdanie?** Jeśli tak — wniosek jest pusty" — `:60` (R3)
> „Liczby klient ma w Excelu za darmo — **płaci za wniosek**." — `:10`

To nie definicje falsyfikowalności — to **operacje**, które konsultant wykona na własnym zdaniu i sam rozstrzygnie. Większość korporacyjnych „standardów jakości" nie dochodzi do tego poziomu nigdy.

### 3.3. Kontrakt dowodowy jako POLA DANYCH, nie prośba w prozie

`server/src/services/InterviewInsightService.ts:512-515` — każde ustalenie musi nieść `confidence_level` + `limits[]` („co by to obaliło") + `evidence_refs[]`, a `"high"` **wymaga triangulacji z 2+ niezależnych źródeł bez sprzeczności**. Falsyfikowalność wpisana w schemat, nie w apel. To najmocniejszy pojedynczy element w całym korpusie.

### 3.4. Mierzycie jakość, nie tylko ją deklarujecie

`server/src/services/consultingBenchmarkJudgeService.ts:36-41` ocenia output w pięciu binarnych wymiarach (`answer_first`, `mece_structure`, `grounding`, `actionability`, `evidence_discipline`) — z zabezpieczeniem antykontaminacyjnym, żeby rubryki nigdy nie trafiły do promptu produktowego (`:23-25`). Zamknięta pętla pomiaru to rzecz, której nie ma większość firm doradczych.

**Bonus — eksperyment naturalny na Twoim repo.** Reguły z podanym POWODEM były przestrzegane; reguła #1 `CLAUDE.md` (bez powodu) została złamana, co reguła #9 dokumentuje z nazwami plików-winowajców. Lekarstwem było powtórzenie tej samej reguły **z powodem**. Masz twardy dowód, że mechanizm „reguła + powód" działa u Ciebie — dopisanie powodów do reguł #1, #2, #4, #5 to ~15 minut.

---

## 4. ★ TRZY LUKI, KTÓRE ODDZIELAJĄ NAS OD POZIOMU BCG

Uszeregowane wg tego, ile kosztują **wiarygodność przed klientem** — nie wg trudności naprawy.

### LUKA 1 — Zapraszamy AI do zmyślania liczb na ekranie, na który patrzy klient

**Dziś.** 76 promptów sterujących Mind Mapą, Whiteboardem, Process Flow i Tabelą (`server/src/services/ideaAIGeneratorService.ts`) każe produkować liczby bez źródła:

> „propose: (…) risks (risks), **industry benchmarks (benchmarks)**. Each suggestion has confidence (0-1)." — `:868` *(zweryfikowane)*
> „generate a current state Value Stream Map **with realistic metrics** for the ${industry} industry (…) cycle time/changeover/uptime" — `:1018`
> „Return recommendations[] with: nodeId, automationPotential, **savingsEstimate**" — `:1002`

Żadnego wymogu źródła, żadnego zakazu wymyślania, żadnego oznaczenia hipotezy. A blok anty-fabrykacyjny **istnieje i jest świetny**:

> „MOSTEK WYLICZENIOWY: każda kwota w EUR/PLN, ROI lub procent MUSI mieć pole «derivation» pokazujące licznik/mianownik. Jeśli nie potrafisz podać mostka — NIE podawaj kwoty." — `src/hooks/discovery/toolAi/groundingRules.ts:22`

**Zweryfikowałem: importuje go 32 pliki frontendu i ZERO plików serwerowych** (`grep -rln "GROUNDING_RULES\|groundingRules" server/src` → pusto). Cała generacja serwerowa działa bez niego. Plik sam ostrzega w `:17`: *„DO NOT copy-paste this text — import and inject this constant"*.

**Powinno być.** Reguły ugruntowania w miejscu widocznym dla frontendu i serwera; pola typu `benchmark` / `savingsEstimate` / metryki VSM wymagają albo źródła, albo jawnego znacznika `„szacunek; przy założeniu X"`.

**Co to zmienia.** Benchmark branżowy to pierwsza liczba, którą klient sprawdzi — i jedyna klasa błędu w całym korpusie, która kończy relację w trakcie jednego spotkania. Reszta luk obniża ocenę produktu; ta podważa uczciwość konsultanta.

### LUKA 2 — Konsultant piszący przy kliencie nie dostaje ani jednej wskazówki

**Dziś.** 63 pola w kartach N. Zmierzone, nie oszacowane: **0 z 63** niesie cyfrę, **0** prosi o dowód lub źródło, **0** wspomina kierunek zmiany, **0** podaje „do ustalenia". Najgorsze pole — opis wariantu decyzyjnego, czyli serce karty Decision:

> **„Opis…"** — `src/components/MyWork/DecisionDetailView.tsx:5740` *(ścieżka i linia zweryfikowane)*

A najlepsze pole jest **pułapką**. Jedyny placeholder podający strukturę zdania:

> **„Wierzymy, że… ponieważ… Zmierzymy to przez…"** — `public/locales/pl/translation.json:7406` i `:7719` *(zweryfikowane)*

uczy formatu, który walidator karze jako naruszenie `hard`, bo wymaga innego:

> `const HYPOTHESIS_RE = /Jeśli .+ to .+ (bo|ponieważ) .+/i;` — `server/src/services/cardContentFormulaValidator.ts:1020` *(zweryfikowane)*

Do tego wzorzec złoty, który pokazałby, jak wygląda dobra karta, **jest obietnicą**: *„Wzorcową kartę (…) **dołączymy** po przebudowie treści Elkomtechu"* — `docs/standards/CARD_CONTENT_FORMULA.md:207-209` — w dokumencie, którego §A1 (`:30`) stanowi: *„Zakaz wypełniaczy (ogólnik/placeholder udający treść) = rubryka NIEZALICZONA"*.

**Powinno być.** 20 pól o największym zasięgu niesie pytanie w **wzorcu, który już u Was działa** — 5 pól go ma, np. *„Co się stanie jeśli nie podejmiemy działań?"* (`src/components/Initiatives/InitiativeDocumentView.tsx:6451`, klucz `initiatives.whatHappensIfWeDoNothing2` — *zweryfikowane*). Plus jedna karta wzorcowa jako punkt odniesienia.

**Co to zmienia.** Sprzedajesz klasę doradczą. Konsultant otwiera kartę, widzi „Opis…" i produkuje output generycznego formularza. Doktryna, która by mu pomogła, jest klasy 8/10 — i leży w pliku, którego on nigdy nie otworzy.

### LUKA 3 — Nikt nie wie, kto to przeczyta

**Dziś.** Kryterium „wyraźny odbiorca i decyzja" jest najsłabsze w całym korpusie. W ścieżce deliverables pole `audience` jest zbierane od użytkownika i **nigdy nie trafia do promptu** — zweryfikowałem, dokładnie 3 wystąpienia, żadne w prompcie:

```
server/src/services/deliverables/docGenerationRuntime.ts
  :362  audience?: string[];                          ← deklaracja typu
  :395  audience: Array.isArray(setup.audience) …     ← odczyt z setupu
  :515  audience: parsed.audience,                    ← zapis wyniku
```

Że da się inaczej, dowodzi **drugi silnik dokumentów w tym samym repo**:

> ``The document is a "${schema.documentType}" written for the audience: ${schema.audience.join(', ')}`` — `server/src/services/documentStudio/documentBlockProseGenerator.ts:162` *(zweryfikowane)*

`CARD_CONTENT_FORMULA.md` nie wspomina odbiorcy ani razu. Persona Teresy wie, KIM jest — nie wie, DO KOGO pisze.

**Powinno być.** Odbiorca w prompcie wszędzie tam, gdzie jest już zbierany. Dane istnieją (`starterTemplates.ts:46-106` definiuje `investor`, `board`, `client`, `internal`).

**Co to zmienia.** Zarząd, komitet inwestycyjny i kierownik operacyjny czytają inaczej. Dokument napisany „dla klienta" jest napisany dla nikogo — i to jest różnica między deliverable'em a dokumentem.

---

## 5. NAJTAŃSZY RUCH O NAJWIĘKSZYM SKUTKU

**Wynieś `groundingRules.ts` do miejsca współdzielonego i wstrzyknij go do `ideaAIGeneratorService.ts`.**

Dlaczego to, a nie coś innego:

- **Artefakt już istnieje i jest sprawdzony w boju** — powstał z panelu adwersaryjnego, ma udokumentowaną genezę konkretnego incydentu (`groundingRules.ts:8-10`: zmyślone metryki klienta ostemplowane jako fakt). Nie projektujesz nic nowego.
- **To nie jest przepisywanie 76 promptów.** Blok doklejasz raz, do bazy systemowej jednego pliku. Koszt: przeniesienie jednego pliku + jeden import.
- **Trafia dokładnie w lukę nr 1** — jedyną, która kosztuje relację, a nie ocenę.
- **Zasięg**: dziś blok pokrywa 32 pliki frontendu i 0 serwera. Po zmianie obejmuje generatory Mind Mapy, Whiteboardu, Process Flow i Tabeli — czyli artefakty, które konsultant pokazuje na ekranie w trakcie warsztatu.

Rozważałem tańszą alternatywę (dopisanie par ŹLE/DOBRZE do 6 promptów o największym zasięgu — dziś w całym repo są **2** takie przykłady na 179 plików). Jest tańsza, ale podnosi jakość promptów, które i tak są przyzwoite. Jeśli można zrobić tylko jedno, robi się to, co eliminuje błąd nieodwracalny — nie to, co poprawia średnią.

---

## 6. CZEGO NIE ZWERYFIKOWANO

Uczciwe granice tej oceny — żeby nie zestarzała się cicho.

- **Korpus 4 nie istnieje.** Nie ma pliku `_AUDYT_INSTRUKCJI_4_*`, nie ma śladu w treści trzech pozostałych, nie ma dokumentu zlecenia. Zlecono 4, dostarczono 3. **Nie zgaduję, czego dotyczył** — to znaczy, że jeden fragment instrukcji Consultify pozostaje nieoceniony.
- **Nie odtwarzałem audytów od zera.** Zweryfikowałem 8 twierdzeń o najwyższej stawce (hooki na demo · guardy w `origin/demo` · brak `groundingRules` na serwerze · `audience` w obu silnikach · placeholder vs `HYPOTHESIS_RE` · wzorzec złoty · prompt OPERATIONAL 20/31 · lista TRIADY 43 vs 40 w `CLAUDE.md:10`). Reszta cytatów pochodzi z audytów — cztery widma potwierdziłem punktowo (`_PLANY_KONCOWE_2026-07-07/…`, `_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md`, `_FORMULA_TRESCI_INSIGHT.md` nie istnieją; katalogu `docs/ui-standards/assets/triada/` nie ma), liczby 36 widm nie przeliczałem.
- **Żaden z trzech audytów nie ocenia REALNYCH OUTPUTÓW.** Wszystkie oceniają TEKST instrukcji. Mocny prompt ≠ mocny output. Zdania „gotowe do klienta" dotyczą instrukcji, nie rezultatu. **To jest największa nieznana w całej ocenie** — nie wiemy, ile z tych reguł model faktycznie wykonuje.
- **V8 Prompt OS niesprawdzony** (`server/src/services/v8/promptOsRuntimeService.ts`). Prompty mogą być nadpisywane presetami z bazy. Jeśli ta warstwa jest aktywna na demo, część ocen korpusu 1 dotyczy kodu, który nie jest tym, co wykonuje się w produkcji.
- **Żywa baza nieczytana.** Nie wiem, jakie wyniki mają karty produkcyjne — walidator uruchamiano na kartach syntetycznych.
- **Zero pełnego `tsc`/`vitest`** (zakaz OOM). Weryfikacja = `grep` + odczyt kodu + `git cat-file`.
- **Rozjazd korzeń/worktree** (audyt 3 §6c: dwie wersje `CLAUDE.md`, 11 vs 8 skilli) — potwierdziłem go tylko na `.husky/`. Pełnego diffa nie robiłem. To znaczy, że „co obowiązuje" może nadal zależeć od katalogu, w którym stoi agent.
