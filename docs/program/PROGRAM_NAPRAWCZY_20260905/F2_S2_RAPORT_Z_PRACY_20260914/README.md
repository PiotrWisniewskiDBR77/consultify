# F2 S2 — Raport z pracy inicjatyw — E1

## Werdykt

Kod E1 po finalnym przeglądzie i poprawkach jest gotowy do ponownego przeglądu na aktualnej linii. Funkcja pozostaje domyślnie wyłączona po obu stronach: przez `VITE_INITIATIVES_WORK_REPORT` w UI oraz `ENABLE_INITIATIVES_WORK_REPORT` na serwerze. Nie wykonano wdrożenia ani operacji na stagingu.

## Zakres dostawy

- kreator definicji: tytuł, adresaci, właściciel i niezależny zatwierdzający, tryb na żądanie / tygodniowy / miesięczny, pięć szablonów oraz zakres wszystkie inicjatywy / bieżący projekt;
- kanoniczny lifecycle `reportDefinition` i `reportRun`: CREATE → VALIDATE → PUBLISH dla definicji oraz CREATE → VALIDATE → FREEZE → APPROVE → PUBLISH dla przebiegu;
- snapshot przechwytywany wyłącznie po stronie serwera, oparty o rzeczywiste rekordy `ie_aggregate_state`, z izolacją organizacji i opcjonalnym filtrem projektu;
- E2: zestawienie osób zalegających z decyzjami, liczba decyzji oczekujących i przeterminowanych oraz najstarszy termin;
- PDF generowany z zamrożonego snapshotu; pięć szablonów ma trwały identyfikator i różny dobór treści;
- wysyłka PDF przez istniejący `EmailService`; serwer wymaga stanu APPROVED, zgodności zatwierdzającego i identyczności adresatów z zamrożoną listą;
- harmonogram wykorzystuje istniejące `report_schedules.config_json`, deterministyczny identyfikator okresu, zamraża i zatwierdza raport, utrwala stan dostawy każdego odbiorcy, wysyła rzeczywisty PDF przez SMTP i publikuje receipt dopiero po sukcesie wszystkich odbiorców;
- usunięto atrapę `report={true}`; listę przebiegów renderuje `StandardTable`;
- jeśli PMO nie dostarcza bieżącego projektu, zakres degraduje się do `All initiatives`.

Przy serwerowej fladze OFF wszystkie cztery dedykowane trasy `/work-reports/*`, łącznie z odczytem PDF, zwracają `FEATURE_DISABLED`, a runner okresowy kończy pracę przed pierwszym odczytem lub zapisem. Wspólna trasa tworzenia `reportRun` rozpoznaje `workReport` przed odczytem źródeł i zapisem; przejścia z UI niosą profil `initiative_work_report`, więc także kończą się przed odczytem przebiegu. Serwer dodatkowo rozpoznaje istniejący Work report po odczycie, aby wykluczyć obejście przez pominięcie profilu. Zwykłe kanoniczne zapisy oraz wspólne odczyty `reportDefinition` i `reportRun` pozostają bez zmian dla innych konsumentów silnika raportów.

## Migracja

Migracja nie jest potrzebna. Definicje i przebiegi przechowują rozszerzalne payloady/snapshoty JSONB, a harmonogram przechowuje konfigurację runtime w istniejącym `report_schedules.config_json`. Nie dodano tabel, kolumn ani indeksów; rollback polega na wyłączeniu flagi i cofnięciu commitów pakietu.

## Bramka SMTP

Lokalny transport SMTP został sprawdzony przez prawdziwe połączenie TCP i wiadomość z załącznikiem PDF. Odbiór live na stagingu pozostaje `BLOCKED`: CTO nie wskazał skrzynki testowej ani nie udzielił zgody na wysyłkę. Runbook live: włączyć flagę wyłącznie w zatwierdzonym środowisku, utworzyć i opublikować definicję przez dwie różne osoby, zamrozić przebieg, zatwierdzić go, wysłać na wskazaną skrzynkę testową, zachować Message-ID i potwierdzenie odbioru.

## Dowód wizualny

`evidence/work-report-light.png` i `evidence/work-report-dark.png` pokazują rzeczywisty komponent oraz `StandardTable` zbudowane przez Vite. Harness używa deterministycznych, lokalnych odpowiedzi tylko do prezentacji; dowód danych i izolacji pochodzi osobno z RealPG. Oba pliki mają mniej niż 2 MB.

## Znane ograniczenia E1

- odpowiedź błędu członków organizacji pozostawia wybór zatwierdzającego pusty zamiast podstawiać niezweryfikowaną osobę; lista pokazuje wyłącznie aktywnych administratorów, właścicieli i superadministratorów.
- stan `SENDING` ma pięciominutowy lease i token fence; po wygaśnięciu może zostać przejęty przez nową próbę ze stabilnym RFC Message-ID, a stary proces nie może zapisać spóźnionego wyniku.
