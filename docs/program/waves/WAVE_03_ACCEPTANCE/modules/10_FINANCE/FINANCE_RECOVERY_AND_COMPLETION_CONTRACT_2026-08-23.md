# Finance — kontrakt naprawy i domknięcia Wave 3

Data: 2026-08-23  
Status: `IMPLEMENTATION CONTRACT / NOT IMPLEMENTED / NOT OWNER ACCEPTED`  
Właściciel odbioru: Owner  
Zakres: Finance — Statements, Analysis, Models, Prediction, Enterprise Valuation

## 1. Cel i granice

Celem jest przywrócenie jednego, przewidywalnego modułu Finance, w którym każda pozycja z rejestru otwiera właściwą kartę roboczą, karta korzysta z właściwego backendu, zapis przeżywa odświeżenie i zimne ponowne otwarcie, a cały przepływ da się samodzielnie zweryfikować w przeglądarce.

Dokument jest kontraktem wykonawczym podporządkowanym istniejącym źródłom prawdy. Nie zastępuje:

- `MODULE_ACCEPTANCE.md` — rejestru odbiorowego;
- `FINANCE_VISUAL_CANON.md` — kanonu wizualnego;
- `FN_FINANCE_DETAIL_ROUTES.md` — kontraktu tras szczegółowych;
- istniejących kontraktów API, schematu bazy i testów.

Nie wolno uznać obecności kodu, fixture, flagi, screena ani testu komponentowego za odbiór właścicielski. Dane demonstracyjne mogą być syntetyczne, lecz mechanika zapisu, tożsamości, tenant isolation i ponownego odczytu musi być prawdziwa.

## 2. Diagnoza, którą naprawiamy

W `src/components/Economics/FinanceHub.tsx` są obecnie montowane dwa konkurencyjne systemy:

- starsze workspaces z `src/components/Benefits/`;
- właściwe workspaces Finance V3 z `src/components/Finance/`.

Wybór zależy od kombinacji flag, typu rekordu i dostępności identyfikatorów. Powoduje to, że ten sam moduł może pokazać starą kartę, nową kartę, pusty ekran albo ekran awaryjny. Naprawa nie polega na ponownym zaprojektowaniu finansów, lecz na podłączeniu istniejących właściwych kart przez jeden deterministyczny resolver.

Docelowe komponenty:

| Obszar | Jedyny docelowy workspace |
|---|---|
| Statements | `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` |
| Analysis | `src/components/Finance/Analysis/AnalysisWorkspace.tsx` |
| Models | `src/components/Finance/FinancialModelWorkspace.tsx` oraz właściwy widok bazowy `src/components/Finance/BaselineWorkspace.tsx` |
| Prediction | `src/components/Finance/Prediction/PredictionWorkspace.tsx` |
| Enterprise Valuation | `src/components/Finance/Valuation/ValuationWorkspace.tsx` |

## 3. Niezmienny model nawigacji

### 3.1 Menu

1. Menu pierwsze pozostaje globalnym nagłówkiem aplikacji.
2. Menu drugie Finance ma dokładnie pięć pozycji: `Statements`, `Analysis`, `Models`, `Prediction`, `Enterprise valuation`.
3. Menu trzecie zawiera statusy/filtry bieżącego rejestru po lewej oraz jedną główną akcję kontekstową po prawej (`New statement`, `New analysis`, `New model`, `New prediction`, `New valuation`).
4. Po otwarciu pełnej karty menu trzecie zmienia się na akcje tej karty: status, zapis, Analyze AI/Compute, wersja, działania zatwierdzające i eksport — tylko gdy są dostępne dla stanu i roli.

### 3.2 Rejestr, preview i pełna karta

- Każda zakładka rozpoczyna się tabelą, nie dashboardem ani formularzem wciśniętym pod tabelę.
- Kliknięcie wiersza zaznacza wiersz i otwiera pełnowysokościowy preview od dolnej krawędzi menu trzeciego do dołu viewportu.
- Preview pokazuje wyłącznie najważniejsze dane, status, aktualność, relacje i przycisk `Open`. Nie zastępuje workspace'u.
- Menu `…` ma mały, standardowy zestaw dozwolonych działań; niedostępne akcje nie mogą tworzyć wielostronicowej listy martwych opcji.
- `Open` otwiera pełny workspace w obszarze roboczym Finance. Nigdy nie dokleja edytora pod tabelą.
- `Back` wraca do tego samego rejestru z zachowaniem zakładki, filtrów, wyszukiwania, zaznaczenia i możliwie pozycji scrolla.
- Bezpośredni URL i zimne otwarcie muszą prowadzić do tej samej karty co wejście przez rejestr.

### 3.3 Tożsamość

Każde otwarcie przekazuje i waliduje krotkę:

`{ artifactId, businessVersionId, artifactType, legacyId? }`.

Resolver ma jeden wynik albo jawny błąd. Zakazane są: zgadywanie typu po nazwie, ciche przejście na starą kartę, użycie `artifactId` jako `businessVersionId`, pusta karta po brakującym ID oraz automatyczne utworzenie rekordu podczas odczytu.

## 4. Specyfikacja pięciu kart

### 4.1 Statements

Karta obsługuje kanoniczny sześciopak sprawozdawczy i jego wersje. Musi zawierać:

- nagłówek obiektu, firmę, zakres okresów, walutę, status, wersję i właściciela;
- przełączanie pomiędzy rachunkiem wyników, bilansem i cash flow, bez utraty kontekstu;
- kolumny okresów, poziomy agregacji i rozwijanie pozycji szczegółowych;
- mapping źródeł, dowody/załączniki, kontrolę duplikatów i kompletności okresów;
- kontrole uzgodnienia oraz jawne błędy bilansowania i jakości;
- komentarze i lineage zmian;
- import/utworzenie, zapis szkicu, wysłanie do przeglądu, zatwierdzenie i utworzenie kolejnej wersji zgodnie z uprawnieniami;
- handoff do Analysis dopiero z jednoznacznie wskazanej wersji źródłowej.

### 4.2 Analysis

Karta powstaje z wybranej, istniejącej wersji Statements. Musi zawierać:

- wskazane źródło i okres analizy;
- tabelę wskaźników z nazwą, formułą, jednostką, okresem, wartością, benchmarkiem/targetem, statusem jakości i interpretacją;
- śledzenie komponentów formuły do danych źródłowych;
- porównanie okresów i trend, bez ukrywania brakujących danych;
- komentarz człowieka oraz propozycje AI jako osobną, zatwierdzaną listę zmian;
- ponowne przeliczenie, zapis wersji, workflow review/approval i handoff do modelu/wyceny;
- błąd merytoryczny zamiast `0` dla brakującej wartości.

### 4.3 Models

Karta modelu jest wersjonowanym workspace'em założeń i obliczeń, nie pustym formularzem. Musi zawierać:

- źródłową wersję Statements/Analysis i jawny horyzont;
- assumptions, events/drivers, calculations i outputs rozdzielone na czytelne widoki;
- wariant bazowy oraz scenariusze z różnicami względem bazy;
- jednostki, daty obowiązywania, źródło i właściciela każdego istotnego założenia;
- walidację zależności i błędów formuł;
- wersjonowanie, porównanie wersji, komentarze, review/approval;
- bezpieczny handoff do Prediction i Valuation.

### 4.4 Prediction

Karta prognozy musi zawierać:

- jawny model bazowy, scenariusz, datę odcięcia i horyzont prognozy;
- oddzielne widoki `Assumptions` oraz `Results`;
- szeregi historyczne i prognozowane rozróżnione graficznie i semantycznie;
- porównanie scenariuszy i zmian założeń;
- przeliczenie z informacją o stanie, błędzie i wersji danych;
- zapis, odświeżenie, cold reopen i identyczny readback;
- komentarze oraz analizę AI zwracającą propozycje, nie automatyczne nadpisanie.

### 4.5 Enterprise Valuation

Karta wyceny jest prowadzonym procesem z siedmioma etapami:

1. Source — wybór kanonicznych danych i modelu.
2. Assumptions — założenia, horyzont, jednostki, źródła i właściciele.
3. Methods & weights — dopuszczone metody i ich udziały z walidacją sumy.
4. Results — wyniki metod i wynik zagregowany z pełnym lineage.
5. Sensitivity — kontrolowane warianty kluczowych założeń.
6. Advisor — komentarz ekspercki/AI jako propozycje do akceptacji.
7. Export — wersjonowany eksport z datą odcięcia, źródłami i statusem.

Karta musi obsługiwać komentarze, review/approval, porównanie wersji i powrót do źródła. Nie może prezentować wyniku wyceny, jeżeli krytyczne źródła lub wagi są niepoprawne.

## 5. Zadania wdrożeniowe

### FIN-REC-001 — Zamrożenie i inwentarz

- Zapisać branch, base, SHA, runtime, porty, flagi, tenant i źródło danych.
- Zinwentaryzować wszystkie aktualne trasy, listy, preview, starsze i V3 workspaces oraz ich importy.
- Ustalić użycia starszych komponentów poza Finance przed ich odłączeniem. Bez automatycznego usuwania kodu.
- Wynik: mapa `route → artifactType → resolver → workspace → API` bez pozycji `UNKNOWN` ukrytych jako gotowe.

### FIN-REC-002 — Jeden deterministyczny resolver

- Wydzielić jedną funkcję rozpoznającą typ i identyfikatory obiektu.
- Zamontować wyłącznie właściwy workspace V3 dla pięciu typów.
- Usunąć fallback ze współczesnej karty na historyczny workspace.
- Dla brakującej/niezgodnej tożsamości pokazać jawny błąd z bezpiecznym powrotem do rejestru.
- Dodać test tabelaryczny wszystkich typów, flag i kombinacji ID.

### FIN-REC-003 — Wspólny shell rejestrów

- Ujednolicić menu 2/3, tabelę, zaznaczenie, row menu, preview, `Open`, loading, empty i error state.
- Zachować stan listy w URL lub kontrolowanym stanie nawigacji.
- Zapewnić pełną wysokość preview i brak edytorów renderowanych pod tabelą.
- Zastosować wspólny kanon typografii, ramek, odstępów, status chips i przycisków.

### FIN-REC-004 — Statements end-to-end

- Podłączyć listę, preview i `StatementPackWorkspaceV2` do tych samych rekordów.
- Podłączyć sześciopak, okresy, mapping, evidence i kontrole jakości.
- Udowodnić utworzenie/import, zapis, review, approval, kolejną wersję i handoff do Analysis.

### FIN-REC-005 — Analysis end-to-end

- Podłączyć kreator do wybranej wersji Statements.
- Podłączyć KPI/formuły/benchmarki/interpretacje i ich lineage.
- Udowodnić przeliczenie, zapis, readback, review i handoff.

### FIN-REC-006 — Models/Baseline end-to-end

- Ustalić jednoznaczną relację `FinancialModelWorkspace` ↔ `BaselineWorkspace` i usunąć dublowanie odpowiedzialności.
- Podłączyć źródła, założenia, obliczenia, wyniki i scenariusze.
- Udowodnić wersjonowanie, porównanie, approval oraz handoff do Prediction/Valuation.

### FIN-REC-007 — Prediction end-to-end

- Podłączyć źródłowy model, assumptions, results i scenariusze.
- Udowodnić compute, zapis, readback, cold reopen, porównanie i obsługę błędów.

### FIN-REC-008 — Valuation end-to-end

- Podłączyć siedem etapów do jednego case i jednej wersji źródłowej.
- Walidować kompletność źródeł, metod i wag przed wynikiem.
- Udowodnić sensitivity, rekomendacje, approval, wersję eksportu i cold reopen.

### FIN-REC-009 — Tworzenie nowych obiektów

- Każda główna akcja otwiera krótki kreator z wymaganym minimum i wyborem źródła.
- Po utworzeniu następuje przejście do nowego workspace'u, bez fantomowego rekordu i bez podwójnego POST.
- Anulowanie nie zapisuje obiektu. Błąd zachowuje dane formularza i pokazuje przyczynę.

### FIN-REC-010 — Persistencja, bezpieczeństwo i uprawnienia

- Każda mutacja ma właściwy tenant, role check, wersję/CAS lub równoważną ochronę konfliktu i audit event.
- Zapisać → odświeżyć → zamknąć → uruchomić ponownie → otworzyć bez parametrów fixture; dane muszą być identyczne.
- Użytkownik read-only nie może mutować przez UI ani API.
- Niedozwolona organizacja nie może odczytać obiektu po bezpośrednim ID.

### FIN-REC-011 — Stany brzegowe i odzyskiwanie

- Osobne, czytelne stany: loading, brak danych, brak uprawnień, niezgodne ID, błąd API, konflikt wersji, błąd obliczeń, częściowe dane.
- Retry nie może duplikować mutacji.
- Error boundary musi zachować drogę powrotu i korelacyjny identyfikator błędu bez ujawniania sekretów.

### FIN-REC-012 — Jakość wizualna i dostępność

- Desktop minimum 1440 px, mniejszy viewport, jasny i ciemny motyw, PL i EN.
- Brak uciętych menu, poziomego overflow całej strony, nachodzących paneli i mikroskopijnych pól.
- Nawigacja klawiaturą, focus, Escape, etykiety, role dialogów i sensowna kolejność tabulacji.
- Różnica stanu nie może opierać się wyłącznie na kolorze.

### FIN-REC-013 — Integracje między kartami

- Statements → Analysis przekazuje jawny source version.
- Analysis → Models/Valuation przekazuje wybrane wyniki i lineage.
- Models → Prediction/Valuation przekazuje zatwierdzoną wersję/scenariusz.
- Każdy handoff ma preview danych wejściowych, potwierdzenie i link zwrotny.
- Aktualizacja źródła nie nadpisuje automatycznie zatwierdzonego obiektu potomnego; tworzy kontrolowaną informację o nieaktualności.

### FIN-REC-014 — Automatyzacja testów i dowody

- Testy jednostkowe resolvera i przejść statusów.
- Testy komponentowe pięciu workspace'ów, list, preview i błędów.
- Testy integracyjne API na prawdziwym schemacie PostgreSQL.
- Browser E2E dla pięciu pełnych przepływów i bezpośrednich URL-i.
- Test cold restart i readback bez fixture query params.
- Test negatywny uprawnień/tenantu i brak błędów console/network.

### FIN-REC-015 — Odbiór właścicielski

- Przygotować jeden stabilny candidate SHA i manifest runtime.
- Otworzyć Ownerowi kolejno pięć rejestrów i po jednej pełnej karcie każdego typu.
- Przejść scenariusze tworzenia, edycji, zapisu, odświeżenia, powrotu i handoff.
- Każdą uwagę dopisać atomowo do rejestru; nie zmieniać statusu na accepted bez decyzji Ownera.

## 6. Macierz weryfikacji obowiązkowa dla każdej karty

| Próba | Oczekiwany dowód |
|---|---|
| Rejestr | Dane, liczniki statusów, filtry i brak błędów API |
| Wybór wiersza | Poprawne zaznaczenie i właściwy preview |
| Row menu | Tylko działania zgodne ze stanem i rolą |
| Open | Właściwy workspace V3 i właściwa tożsamość |
| Direct URL | Ten sam obiekt po zimnym wejściu |
| Mutacja | Poprawny request, audit event i widoczny wynik |
| Refresh | Brak utraty zapisu i brak duplikacji |
| Cold reopen | Identyczny readback po restarcie procesu |
| Back | Ten sam tab, filtr, query i zaznaczenie |
| Konflikt | Jawny komunikat, bez cichego nadpisania |
| Brak dostępu | 403/bezpieczny UI, bez wycieku danych |
| Błąd backendu | Jawny error state, retry bez podwójnego zapisu |
| Responsywność | Brak zasłaniania treści i kontroli poza viewportem |
| PL/EN + theme | Pełne etykiety i poprawne tokeny semantyczne |

## 7. Poziomy ukończenia

- `CODE_PRESENT` — kod istnieje; nie dowodzi działania.
- `TECHNICAL_PASS` — automatyczne testy na wskazanym SHA przeszły.
- `READY_FOR_OWNER_REVIEW` — ten sam SHA działa w stabilnym runtime, z danymi do pełnego przejścia.
- `OWNER_ACCEPTED` — wyłącznie jawna decyzja Ownera po przejściu scenariusza.

Nie wolno scalać tych poziomów ani raportować `DONE`, gdy brakuje persistence/readback, przeglądarki, właściwego tenant context albo odbioru.

## 8. Pakiet dowodowy

Każdy FIN-REC zamyka się dopiero po zapisaniu:

- branch/base/candidate SHA i listy zmienionych plików;
- manifestu procesu, portów, flag, API i bezpiecznej identyfikacji bazy;
- wyników testów z licznikami PASS/FAIL/SKIP;
- screenshotów rejestru, preview i pełnej karty;
- logu console/network bez niejawnych danych;
- dowodu zapisu, refresh i cold reopen;
- mapy `uwaga właściciela → zadanie → commit → test → screenshot`;
- jawnej listy pozostałych `NOT_TESTED`, `BLOCKED` i `EVIDENCE_MISSING`.

## 9. Kolejność wykonania i bramki stop

Kolejność: `001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009–013 → 014 → 015`.

Nie rozpoczynać kolejnego workspace'u, jeśli wspólny resolver lub shell nadal potrafi otworzyć historyczny ekran. Zatrzymać wdrożenie przy nieustalonej bazie/tenant, destrukcyjnej migracji, braku możliwości rekonstrukcji danych demo, błędzie izolacji organizacji lub rozbieżności między SHA testowanym i pokazanym Ownerowi.

## 10. Definicja końca modułu

Finance jest domknięty dopiero wtedy, gdy pięć rejestrów i pięć pełnych kart działa na jednym candidate SHA, każdy zapis przechodzi readback i cold reopen, wszystkie handoffy zachowują lineage, testy techniczne mają dowody, a Owner zakończy pełny replay decyzją `OWNER_ACCEPTED`. Do tego momentu moduł pozostaje `IN PROGRESS`, niezależnie od liczby istniejących komponentów.
