# Karta poranna 08.09 — Inicjatywy i Realizacja do przejścia

Gałąź: `mvp/inicjatywy-lancuch-20260907` (do stagingu). Noc 07/08.09: P15 (Plan i Obciążenie, K0–K7) i P16 (Realizacja R0–R6) scalone, dwa nocne odbiory na żywo (1440, jasny motyw, reload po każdym zapisie), pięć poprawek po odbiorach.

## Co klikasz rano (kolejność)

### Inicjatywy
1. Lista → wybierz inicjatywę w stanie Szkic → w podglądzie sekcja „Zarządzanie” → **Do zatwierdzenia** → odśwież → pigułka „Do zatwierdzenia”.
2. Ta sama inicjatywa → **Zatwierdź** jest wyszarzony z powodem po polsku (brak decyzji GO) — to jest zamierzone, powód widać PRZED kliknięciem.
3. Inicjatywa „W realizacji” → **Wstrzymaj** → odśwież → pigułka „Wstrzymana” (bursztyn) na liście i w podglądzie → **Wznów** → wraca „W realizacji”.
4. Zaloguj jako zwykły członek (MEMBER): w podglądzie nie ma przycisków zmiany statusu (nie „403 po kliknięciu”).
5. Zakładka **Plan** → „Nowy plan” → nazwa → karta planu → „Pracuj z AI” → zgoda „Uruchomić AI?” → generator → zaznacz inicjatywy → propozycja solvera → Zatwierdź → sekcja „Obciążenie ról” → wpisz FTE → „Zapisano” → odśwież → dwuklik w plan → wartość jest.
6. W karcie planu: Sekcje → Obciążenie ról → **„Nowa analiza z tego planu”** → otwiera się zakładka Obciążenie z formularzem i wybranym planem źródłowym → „Utwórz analizę” → Arkusz obciążenia / Luki i presja / Propozycje zmian.

### Realizacja
1. **Realizacje** — lista inicjatyw w toku (23 na stanowisku), chipy Wszystkie/Zagrożone/Po terminie, pigułka „Wstrzymana” dla wstrzymanych.
2. **Praca** — dwuklik w komórkę Status/Termin/Właściciel zadania → zmiana → zapis → odśwież → trwałe.
3. **Zasoby** — obciążenie tygodniowe osób; zmień termin zadania w Pracy i wróć: liczby się zmieniają (sprawdzone: 284 h → 276 h po przesunięciu jednego zadania). Procenty powyżej 100 % to zaległości spiętrzone w bieżącym tygodniu (tak liczy też Planview).
4. **Decyzje i ryzyka** — chip Decyzje: „Nowa decyzja” (termin, decydent) → odśwież. Chip Ryzyka: „Nowa pozycja RAID” (prawdopodobieństwo × wpływ = ekspozycja liczona) → odśwież; kebab „Eskaluj do problemu”. Chip **Sygnały (42)** — sygnały opóźnień z systemu; wiersz → „Przygotuj interwencję” → w Decyzjach pojawia się decyzja o przesunięciu terminu, sygnał ma stan „Interwencja”.
5. **Raporty** — lista raportów 4 poziomów (Zarząd / Komitet / PMO / Właściciel inicjatywy), „Nowy raport”.

## Dogrywka 08.09 rano (po Twoim pierwszym wejściu na staging)
Twoje zrzuty z 05:50 (pusty Kokpit, „Brak inicjatyw w realizacji”, timeouty 15 s w Pracy i Zasobach, „Platform SuperAdmin” jako stanowisko) odtworzone na kopii Twojej bazy i naprawione:
- **Proces API głodzony nieskończoną pętlą** w rodowodzie projektu (`postgresInitiativeReader.ts`): jedna Twoja inicjatywa bez projektu wpadała w rekurencję bez końca, każde wejście w Pracę lub Zasoby zjadało CPU i pamięć serwera, stąd puste ekrany i timeouty. Strażnik cyklu, 45 s bez odpowiedzi → 0,014 s.
- Lista realizacji wpuszczała pozycję, której nie da się otworzyć (baner „nie udało się pobrać zasobów z 1 realizacji”) — teraz ta sama zasada co przy pojedynczej.
- Podgląd osoby w Zasobach: „Zadania w tym tygodniu” i „Zadania zaległe” zamiast mylącego „Zadania 0” przy 341 h zaległości. „Platform SuperAdmin” to wpis w polu stanowisko w Twojej bazie, nie kod (przegląd danych, pkt 3).
- **Martwa sesja po resecie hasła** (to, co widziałeś jako „Nie udało się załadować kanonicznego rejestru raportów”): po resecie ekran logowania z komunikatem, a każde 401 kończy sesję zamiast pustych ekranów.
- **Szkic bez autora może przesłać administrator** (52 z 69 Twoich szkiców nie dało się przesłać). Zasada: autor, administrator/właściciel organizacji, albo każdy uprawniony gdy szkic nie ma autora.
- Mail resetu hasła po polsku, nadawca „Consultify”, przycisk (zrzut wysłany do akceptacji).
- AI na stagingu: Gemini naprawione (wycofany model), Anthropic i OpenRouter zdrowe; **OpenAI i DeepSeek bez środków na kontach** — doładowanie po Twojej stronie, nie blokuje (domyślny dostawca to OpenRouter).
- Przegląd danych DBR77: `PRZEGLAD_DANYCH_DBR77_20260908.md` (tabela decyzji usunąć/uzupełnić/zostawić). Najpilniejsze przed pokazem: 5 z 8 inicjatyw w realizacji nie ma projektu, dat ani zadań; 13 z 17 osób bez stanowiska.

Nowy STOP (nienaprawiony, do paczki): przy każdej edycji zadania bez właściciela serwer wpisuje jako właściciela osobę edytującą, a kolumna „Osoba” w Pracy to pokazuje (`TaskController.ts:1567`, `ExecutionWorkSurface.tsx:499`). Dotyczy 34 Twoich zadań.

## Co NIE działa albo czeka na Twoją decyzję (uczciwie)
| # | Co | Waga | Co proponuję |
|---|---|---|---|
| 1 | **Bezpieczeństwo: każdy zalogowany może zmienić cudze zadanie** przez `PUT /api/tasks/:id`. Bramka uprawnień działa w trybie „shadow” (tylko loguje), bo `CAPABILITY_ENFORCE=enforce` nie jest ustawione nigdzie (stanowisko, staging, demo). Ekran Praca nie ukrywa edycji cudzych wierszy. | wysoka, przed pilotażem | osobna paczka: enforce dla `task.update` + ukrycie edycji cudzych wierszy w Pracy; NIE włączać globalnego enforce w nocy przed przejściem (dotyka wielu tras) |
| 2 | Decyzja **GO** dla bramki „Zatwierdź” nie ma pisarza w UI (trasa zamknięta decyzją 26A). Dziś Zatwierdź jest wyszarzony z powodem. | średnia | decyzja: pisarz GO w pojemniku 1 czy 2 |
| 3 | Handoff (przekazanie do realizacji) i stanowisko pracownika (`job_title`) — bez UI; podaż w Obciążeniu liczy się ze stanowisk w bazie. Staging NIE ma seedu stanowisk/FTE (na stanowisku nocnym: 6 stanowisk, 5 FTE). | średnia | przed przejściem Obciążenia na stagingu wgrać seed `evidence/p15-k5/seed.sql` (Twoja zgoda) |
| 4 | Kolumna „Dni po terminie” w RAID domyślnie ukryta (dziewiąta nie mieści się w 1440); jest w podglądzie, filtrze „Po terminie” i pstryczku kolumn. | niska | zostawić |
| 5 | Zadanie eskalacji decyzji po terminie: pierwsze uruchomienie tylko na sucho (`POST /api/decisions/escalation/run {dryRun:true}` → 17 kandydatów). | niska | włączyć na żywo po Twoim OK |
| 6 | Dług zastany: `useOrganizationMemberNames` daje 403 u MEMBER-a w wielu modułach; 6 tras Kokpitu → 403; sanitizer zamienia cudzysłowy na encje; `getDecisions` zmienia dane przy odczycie; 5 czerwonych testów `executionControlSurface.test.tsx` już na HEAD. | niska | osobne paczki po MVP |
| 7 | Build frontu od scalenia R4+R5 potrzebuje > 4 GB sterty (Dockerfile.api daje 6 GB — przechodzi; lokalnie z domyślną stertą pada). | niska | zmierzyć, który plik rozdął typy |

## Dowody
- Inicjatywy: `evidence/odbior-noc-0809/inicjatywy/` (01–09, B01–B12, C01–C09, C02b) + `evidence/lancuch-zarzadzania/`, `evidence/p15-k*`.
- Realizacja: `evidence/odbior-noc-0809/realizacja/` (01–37, `ZNALEZISKO-security-put-tasks.md`, `eskalacja-dry-run.json`) + `evidence/p16-r*`.
- Bramka na HEAD: tsc serwera 0, tsc frontu 200 błędów = baza (bez nowych), build OK (6 GB), hooki pre-commit zielone.

## Poprawki po nocnych odbiorach (już w gałęzi)
- `ec26dff25e` Realizacja: pigułka „Wstrzymana” na liście (był tylko kolor).
- `84605a033d` Inicjatywy: `onHold` mapowany do rejestru (kropka + słowo „Wstrzymana”), „Nowa analiza z tego planu” otwiera formularz (wcześniej cicho lista).
- `30687ebd5a` R4+R5 (RAID z ekspozycją, Sygnały, interwencja) — z robotnika Opus, 73/73 testów, 9 mutacji.
