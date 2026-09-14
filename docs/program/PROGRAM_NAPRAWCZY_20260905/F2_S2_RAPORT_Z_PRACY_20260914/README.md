# F2 S2 — Raport z pracy inicjatyw — E1

## Werdykt

Kod E1 jest gotowy do niezależnego przeglądu na `7a7c238441`. Funkcja pozostaje domyślnie wyłączona przez `VITE_INITIATIVES_WORK_REPORT`; nie wykonano wdrożenia ani operacji na stagingu.

## Zakres dostawy

- kreator definicji: tytuł, adresaci, właściciel i niezależny zatwierdzający, tryb na żądanie / tygodniowy / miesięczny, pięć szablonów oraz zakres wszystkie inicjatywy / bieżący projekt;
- kanoniczny lifecycle `reportDefinition` i `reportRun`: CREATE → VALIDATE → PUBLISH dla definicji oraz CREATE → VALIDATE → FREEZE → APPROVE → PUBLISH dla przebiegu;
- zamrożony snapshot oparty o rzeczywiste rekordy `ie_aggregate_state`, z izolacją organizacji i opcjonalnym filtrem projektu;
- E2: zestawienie osób zalegających z decyzjami, liczba decyzji oczekujących i przeterminowanych oraz najstarszy termin;
- PDF generowany z zamrożonego snapshotu; pięć szablonów ma trwały identyfikator i różny dobór treści;
- wysyłka PDF przez istniejący `EmailService`; serwer wymaga stanu APPROVED, zgodności zatwierdzającego i identyczności adresatów z zamrożoną listą;
- harmonogram wykorzystuje istniejące `report_schedules.config_json`, generuje przebieg FROZEN i zostawia wysyłkę do niezależnego zatwierdzenia;
- usunięto atrapę `report={true}`; listę przebiegów renderuje `StandardTable`;
- jeśli PMO nie dostarcza bieżącego projektu, zakres degraduje się do `All initiatives`.

## Migracja

Migracja nie jest potrzebna. Definicje i przebiegi przechowują rozszerzalne payloady/snapshoty JSONB, a harmonogram przechowuje konfigurację runtime w istniejącym `report_schedules.config_json`. Nie dodano tabel, kolumn ani indeksów; rollback polega na wyłączeniu flagi i cofnięciu commitów pakietu.

## Bramka SMTP

Lokalny transport SMTP został sprawdzony przez prawdziwe połączenie TCP i wiadomość z załącznikiem PDF. Odbiór live na stagingu pozostaje `BLOCKED`: CTO nie wskazał skrzynki testowej ani nie udzielił zgody na wysyłkę. Runbook live: włączyć flagę wyłącznie w zatwierdzonym środowisku, utworzyć i opublikować definicję przez dwie różne osoby, zamrozić przebieg, zatwierdzić go, wysłać na wskazaną skrzynkę testową, zachować Message-ID i potwierdzenie odbioru.

## Znane ograniczenia E1

- brak zrzutów light/dark do czasu uruchomienia kontrolowanego lokalnego runtime z danymi i dwoma użytkownikami;
- automatyczny przebieg okresowy zatrzymuje się w stanie FROZEN, zgodnie z separacją obowiązków; nie wysyła maila bez zatwierdzenia;
- odpowiedź błędu członków organizacji pozostawia wybór zatwierdzającego pusty zamiast podstawiać niezweryfikowaną osobę.
