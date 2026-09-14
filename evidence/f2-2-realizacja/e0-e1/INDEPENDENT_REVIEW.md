# F2-2 Realizacja E0/E1 — niezależny przegląd exact freeze

**Werdykt: HOLD — dowody E0 oraz rdzeń modelu/widoków E1 są zielone, ale checkpoint nie zachowuje starego zachowania przy fladze OFF i nie udostępnia użytkownikowi wymaganych filtrów Banku.**

## Tożsamość i integralność

- gałąź: `codex/realizacja-cztery-przyciski-20260913`
- baza i HEAD w chwili freeze: `bc40d5327c6cf133f8cfd2b0e68a5295fb782189`
- manifest: `FREEZE_MANIFEST.json`
- oczekiwany i zmierzony SHA-256 manifestu: `0293b3140aec99dc29faeffa040b5b51bc871dc1075f413559c95b3190694939`
- integralność przed utworzeniem tego raportu: **38/38 plików**, rozmiar i SHA-256 zgodne, **drift = 0**
- migracje: **0 nowych, 0 zmodyfikowanych**

## Niezależnie powtórzone dowody

- focused Vitest na czterech plikach: **21/21 PASS**, retry = 0; wykonane ponownie przez recenzenta, nie odczytane wyłącznie z logu autora;
- cztery widoki zachowują jeden zbiór tożsamości Inicjatyw; kalendarz/Gantt używają wspólnego horyzontu 1/3/6/12, a geometria Gantta i kontrolowane `asOf` mają test zachowania;
- model wybiera deterministycznie jeden najnowszy cień `execution_case` per Inicjatywa, zachowuje rekord bez case i rozróżnia brak danych od zera;
- E0: oba PNG mają dokładnie 1440×900, różne SHA i wizualnie pokazują jasny/ciemny wariant bez obcięcia; zbudowany artefakt uruchomiony ponownie pod Playwrightem zwrócił HTTP 200, `scrollWidth/clientWidth = 1440`, `scrollHeight/clientHeight = 900`, błędy konsoli = 0, ostrzeżenia = 0, `pageerror` = 0;
- TypeScript: oba utrwalone przebiegi mają **189** błędów, po normalizacji pozycji listy są identyczne; w `executionBankModel.ts`, `ExecutionBankViews.tsx` i `executionFeatureFlags.ts` nie ma trafień. To mieści się w przekazanym progu bazowym `<=192`, ale nie jest zielonym pełnym typecheckiem.

## Znaleziska

### P1 — flaga domyślnie OFF nie zachowuje starego Banku

`VITE_EXECUTION_FOUR_BUTTONS` rozwiązuje się domyślnie do `false`, ale flaga steruje jedynie `identityMode` i ukryciem identyfikatora case w podglądzie. Deduplikacja wielu `execution_case` do jednego wiersza zachodzi przed `buildRow` niezależnie od `identityMode`, więc także ścieżka `LEGACY` zmienia mianownik względem bazy. Również nowe kolumny i etykiety (`Initiative`, projekt, `Timeline position` z `asOf`) są renderowane bez warunku flagi. Test nazwany „preserves the legacy row identity” obejmuje tylko jeden case na Inicjatywę i nie broni starego mianownika ani starego renderu. To narusza kontrakt „wszystko nowe za flagą domyślnie OFF”.

**Wymagana poprawka:** przy OFF zachować dokładnie bazowy zbiór wierszy i bazowy render, a deduplikację/tożsamość Inicjatywy oraz nowy układ kolumn włączyć dopiero przy ON. Dodać test zachowania z dwiema wersjami case jednej Inicjatywy oraz porównaniem widocznego Banku OFF.

### P1 — filtry istnieją w modelu, ale nie w osiągalnym UI Banku

`filterExecutionBankRows` obsługuje `projectIds`, `ownerIds`, `priorities` i `timeWindow`, lecz `ExecutionHub` przekazuje do niego tylko search, lifecycle status, execution state i data issues. Pasek Banku renderuje tylko przełącznik Active/All; nie ma kontrolek projektu, właściciela, priorytetu ani okna czasu. To nie dostarcza R1.1 ani definicji odbioru „co najmniej sześć filtrów”, nawet w niezależnej części E1. Test 21/21 sprawdza kontrakt funkcji modelu, ale nie dowodzi, że użytkownik może użyć tych filtrów.

**Wymagana poprawka:** podłączyć osiągalne kontrolki co najmniej projektu, statusu, właściciela, priorytetu i okna czasu do jednego stanu filtrów i jednego zbioru wszystkich czterech widoków; `projectId = null` musi być wybieralnym koszykiem. Szósty filtr sygnału pozostaje kontrolowanym HOLD do akceptacji E0. Dodać testy interakcji UI, w tym null-project i zachowanie zbioru po zmianie widoku.

### P2 — podgląd Banku nie spełnia reguł UI z Wpisu 11

Nowy podgląd może pokazać surowy chip `UNKNOWN`, skleja właściwości (`Lifecycle`, `Execution state`, daty) w `details.text` zamiast `details.properties`, a `StandardPreview` renderuje ramkę Relations również dla pustej tablicy. W efekcie ekran nie spełnia warunku meta bez `Unknown`, sześciu bloków bez pustej ramki Relations i uporządkowanych właściwości bez luźnego zrzutu pól. Typowane szerokości tabeli są poprawne: tytuł jest szeroki, chipy/daty węższe.

**Wymagana poprawka:** mapować stan nieznany na opisowy brak danych poza meta, przekazać pola jako tabelę `properties`, a pustą sekcję Relations pominąć zgodnie z ogłoszonym kanonem; dodać test renderu braków danych i struktury preview.

## Jawne bramki zachowane jako HOLD, nie jako defekty checkpointu

- produkcyjna sygnalizacja ryzyka i szósty filtr nie zostały rozpoczęte;
- nie ma litery właściciela akceptującej wariant E0;
- zgodność z artefaktem `8c073b0a` pozostaje `EVIDENCE_MISSING`;
- pełny mianownik 29/29 pozostaje otwarty (`3 COMPLETE · 21 PARTIAL · 5 MISSING`);
- nie rozpoczęto E2–E4.

Kod nie przekroczył granicy produkcyjnej sygnalizacji ryzyka. Po usunięciu P1/P2 potrzebny jest nowy exact freeze i świeży niezależny przegląd; ten raport nie akceptuje etapu E1 ani nie otwiera kolejnego etapu.
