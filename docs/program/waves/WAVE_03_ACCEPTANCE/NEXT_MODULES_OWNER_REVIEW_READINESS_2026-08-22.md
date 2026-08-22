# Gotowość kolejnych modułów do odbioru — 2026-08-22

Status: `LIVE_BROWSER_AUDIT / PARTIAL_READINESS / DATA_MUTATION_NOT_PERFORMED`

Runtime: `http://127.0.0.1:4119`, widoczny marker `LOCAL @f3237e942304`.

## Zasada oceny

Trasa lub nagłówek nie oznacza gotowości. Moduł kwalifikuje się do odbioru dopiero, gdy w bieżącym runtime widać właściwe menu, tabelę i co najmniej jeden wiarygodny rekord albo jawnie zaakceptowany pusty stan, bez błędu blokującego odczyt. Ten audyt jest wyłącznie odczytem przeglądarkowym; nie potwierdza bazy bezpośrednim zapytaniem SQL ani trwałości zapisu.

## Wynik

| Moduł | Widok/tabela | Dane widoczne | Błąd blokujący | Gotowość do kolejnego odbioru |
|---|---|---:|---|---|
| Tools / Sessions | tabela kompletna | 30 rekordów; 24 Draft, 6 Pending Review | brak błędu blokującego w aktualnym odczycie | `READY_FOR_OWNER_REVIEW` |
| Assessment / Licensed | lokalny katalog 5 frameworków; sesje/procesy i downstream bez danych | katalog widoczny; backendowe rekordy nie zostały odczytane | `404 API_ROUTE_NOT_FOUND` dla kanonicznego Method Core; workspace `RECOVERY_DRAFT`; Outputs nie ładuje się | `NOT_READY / CLIENT_BACKEND_CONTRACT_MISMATCH / OWNER_REVIEW_BLOCKED` |
| Initiatives | menu i pusty stan, bez tabeli danych | UI pokazuje 0 | `Cannot read properties of undefined (reading 'freshness')` w `initiativeRegisterProjection.ts:87`; ponowienia są błędnie opisane jako network error | `NOT_READY / CLIENT_PROJECTION_FAILURE` |
| Execution / Realizacje | pełna tabela | 1 aktywna realizacja; presety Active 1, At risk 1, Blocked work 1 | brak błędu blokującego w aktualnym odczycie | `READY_FOR_GUIDED_OWNER_REVIEW / PERSISTENCE_NOT_RETESTED` |

## Diagnoza

### Assessment

To jest moduł **licencjonowanych Assessmentów** (DRD/DLD, SIRI i kolejne metody), a nie zwykła pusta tabela. Widoczny katalog jest metadanymi renderowanymi po stronie klienta i nie dowodzi połączenia z backendem. Bieżący klient Vite działa z tymczasowego checkoutu `1fce2f0631af9d4a1c68521ad44d53a75a9977fc` na `:4119`, proxy kieruje `/api` do backendu Railway, a kanoniczne `GET /api/method/outputs` kończy się `404 API_ROUTE_NOT_FOUND`. Kod bieżącego repozytorium definiuje klienta `/api/method` i montuje tę trasę w Gateway, więc aktualny stan wskazuje na **niezgodność wersji/kontraktu klient–backend**, nie na potwierdzony brak rekordów w bazie.

Skutki widoczne w całym łańcuchu są trzy: Library/Processes nie odczytuje sesji, otwarcie procesu kończy się `RECOVERY_DRAFT` + 404, a Outputs nie ładuje się wcale. Przed odbiorem trzeba wystawić kompatybilny backend Method Core dla dokładnego kandydata klienta, potwierdzić tenant/licencję i wykonać cold readback co najmniej jednej wiarygodnej sesji DRD oraz jej niezmiennego wyniku. SIRI i pozostałych metod nie wolno udawać fixture'em, jeśli nie mają zatwierdzonej treści licencyjnej.

### Initiatives

To nie wygląda na brak rekordów w bazie. Klient mapuje otrzymane rekordy przez `projectCanonicalInitiativeRegisterRow`, zakłada obecność zagnieżdżonego pola `freshness` i rzuca wyjątek. Warstwa `InitiativesHub` klasyfikuje ten błąd transformacji jako błąd sieci, wykonuje trzy bezcelowe retry i kończy widok liczbą 0. Przed odbiorem potrzebne są:

1. zgodny kontrakt danych dla projekcji rejestru;
2. bezpieczna obsługa starszego/brakującego pola;
3. rozdzielenie błędu sieci od błędu mapowania danych;
4. test na realnym rekordzie oraz cold readback;
5. ponowny odczyt tabeli bez zerowania danych po wyjątku.

### Execution

To najlepszy kandydat na następną rundę. Widoczne są menu, presety, tabela i jeden konkretny rekord. Przed rozpoczęciem właściwego odbioru nadal trzeba wykonać szybki preflight: otwarcie rekordu, preview, menu prawego przycisku/kebaba oraz odczyt po ponownym załadowaniu.

## Zalecana kolejność dalszego odbioru

1. `Execution` — po krótkim preflight rekordu i preview.
2. `Assessment / Licensed` — dopiero po zrównaniu klienta i backendu Method Core, usunięciu 404 oraz cold readback wiarygodnej sesji i wyniku.
3. `Initiatives` — dopiero po naprawie kontraktu/projekcji `freshness` i potwierdzeniu danych.

Nie wykonano seedowania, kasowania, migracji, przełączenia bazy ani wdrożenia. Takie działania wymagają osobnej, świadomej decyzji po potwierdzeniu targetu środowiska.
