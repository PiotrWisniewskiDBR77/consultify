# RUNDA 3 — 09-finanse

| id | werdykt rano | werdykt teraz | jedno zdanie |
|---|---|---|---|
| finance-comments-panel | ROZNI_SIE | ROZNI_SIE | Kompozycja zgodna z obrazem (czerwony baner blokujących komentarzy, nagłówek 'Komentarze (2)', karty z plakietką 'Blokujący', kompozytor, lista kontrolna) — potwierdzone świeżym zr… |
| finance-workspace-bar | ROZNI_SIE | ROZNI_SIE | Potwierdzone świeżym zrzutem i kodem: src/components/Finance/Valuation/ValuationWorkspace. |
| finance-analysis-workspace | ROZNI_SIE | DANE | PO PRZEZ SERWER PRZEBUDOWANYM W TRAKCIE SESJI (staging przeszedł z gitSha b852ade6 na 770f9e49919c ok. |
| finance-statement-pack-workspace-v2 | ROZNI_SIE | DANE | NAPRAWIONE PO REDEPLOYU STAGINGU (gitSha b852ade6 → 770f9e49919c w trakcie tej sesji): ekran już nie wisi na szkielecie ładowania. |
| finance-compare-panel | ROZNI_SIE | ROZNI_SIE | Potwierdzone ponownie: FinanceComparePanel się nie renderuje — host FinanceWorkspaceUtilities. |
| finance-prediction-workspace | ROZNI_SIE | ROZNI_SIE | NIESTABILNE PO REDEPLOYU STAGINGU (gitSha 770f9e49919c): sieć jest już czysta (wszystkie wywołania, w tym /resolve-legacy/financial_models/. |
| finance-valuation-workspace | ROZNI_SIE | ROZNI_SIE | NIE ZWERYFIKOWANO PONOWNIE po redeployu stagingu (gitSha b852ade6 → 770f9e49919c w trakcie tej sesji) — sesja logowania padła (współdzielony plik ODBIOR_AUTH_STATE nadpisany przez … |
| finance-baseline-workspace | ROZNI_SIE | DECYZJA | Zgodnie z przekazaniem na dziś: Baseline v3 jest WYŁĄCZONY decyzją CTO — obecny widok klasyczny (zakładki 'Dane wejściowe i założenia' / 'Oś czasu zdarzeń' / 'Wyniki (RZiS/Bilans/C… |

## Runda 4

| id | werdykt runda 3 | werdykt runda 4 | jedno zdanie |
|---|---|---|---|
| finance-prediction-workspace | ROZNI_SIE (niestabilne) | ROZNI_SIE | Zmierzone 16 świeżych prób (4x4, wg specyfikacji --czekaj=4000): tylko 1/16 (~6%) dała pełny biały ekran, znacznie rzadziej niż raportowane 3/4 — defekt realny ale rzadki, prawdopodobnie związany z FinanceHub.tsx fullView-routing (~linia 4019, ten sam obszar co udokumentowany FIX-4 z 2026-08-25) lub zimnym lazy-importem workspace'u. |
| finance-valuation-workspace | ROZNI_SIE (brak weryfikacji, sesja padła) | ROZNI_SIE | Stary most legacy→v3 (404/409) NAPRAWIONY, graficzna uwaga o okrągłych przyciskach TEŻ naprawiona (pigułki + pasek akcji na dole) — ale NOWY blocker: wszystkie 3 zatwierdzone wyceny CD PROJEKT pokazują "Źródło ZABLOKOWANE" bo brakuje endpointu tworzącego powiązanie (lineage edge) Baseline/Scenario→Valuation (komunikat wprost z kodu, zgłoszona znana luka pakietu B3). |

## Runda 5

| id | werdykt runda 3 | werdykt runda 5 | jedno zdanie |
|---|---|---|---|
| finance-comments-panel | ROZNI_SIE | **ZGODNY** | Autor komentarza pokazuje teraz realne imie i nazwisko 'Piotr Wisniewski' zamiast surowego UUID. |
| finance-workspace-bar | ROZNI_SIE | **ZGODNY** | Pasek ma juz komplet kontrolek z obrazu: przycisk 'Eksportuj', rozwijany status 'Wersja robocza' i kebab '...'. |

## Runda 6 — decyzja właściciela 05.09: włączyć Baseline v3 dla DBR77

| id | werdykt runda 3 | werdykt runda 6 | jedno zdanie |
|---|---|---|---|
| finance-baseline-workspace | DECYZJA | **ROZNI_SIE** | Flaga `financeBaselineWorkspaceV1` jest zdalnie WYŁĄCZONA dla DBR77 w tabeli `feature_flags` (potwierdzone: GET /api/feature-flags/runtime → false), a zmiana wymaga roli superadmin (token OWNER dostaje 403) — włączyłem tylko klient-side `?ff_wave3FinanceOwnerReview=1` (bez zapisu do bazy), co odkryło DRUGI, niezależny blocker: jedyny kanoniczny artefakt BASELINE_MODEL dla DBR77 daje 409 `BASELINE_CONTEXT_NOT_CONFIGURED` na `/api/v8/finance-v2/baseline/:businessVersionId/context`, więc ekran nadal pokazuje kartę błędu zamiast pełnej tabeli RZiS/Bilans/CF z obrazu; pełna specyfikacja naprawy (SQL + endpoint do wywołania) w `wyniki.json`.
