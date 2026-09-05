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

## Runda 7 — próba utworzenia realnego baseline DBR77 przez normalny kreator UI (05.09, popołudnie)

| id | werdykt runda 6 | werdykt runda 7 | jedno zdanie |
|---|---|---|---|
| finance-baseline-workspace | ROZNI_SIE | **ROZNI_SIE** | Flaga naprawiona i działa sama (bez override); przez normalny kreator UI (oba tryby: "Oprzyj na sprawozdaniu" i "Rozpocznij od zera") NIE da się skonfigurować kontekstu nowego baseline'u — żaden ekran w aplikacji tego nie robi, to luka w kodzie (`CreateModelModal.tsx` nigdy nie woła `PUT .../baseline/:id/context`), nie w danych. |

Szczegóły i pełna specyfikacja dla robotnika w `wyniki.json` (pole `opis`, `runda: 7`). Skrót:
- Zaimportowałem przez UI (Sprawozdania → „Importuj sprawozdanie") 2 realne, spójne sprawozdania DBR77
  (integrator robotyki, PLN, RZiS+Bilans+CF, 2024 z por. 2023 i 2025 z por. 2024) — oba potwierdzone,
  ale utknęły na `pack_readiness_status: recoverable` (deterministyczna ekstrakcja wielosekcyjna gubi
  statement Bilansu dla okresu porównawczego — osobny zgłoszony defekt), więc żaden nie kwalifikuje się
  do listy „Oprzyj na sprawozdaniu" (wymaga `ready`).
- Ominąłem to trybem „Rozpocznij od zera" — model **DBR77 — Model bazowy 2023-2025** powstał
  (`financial_models.id 08b2fad8-b072-4d02-8ec4-3ff6b948ce39`, kanoniczny
  `artifactId 314dfbc9-fc64-4581-a84b-039877ea6ecc` / `businessVersionId d151a83a-50b4-460c-8193-4080a0d4798c`),
  ale otwarcie od razu daje ten sam błąd „Nie można otworzyć kontekstu modelu bazowego" (409
  `BASELINE_CONTEXT_NOT_CONFIGURED`) — **niezależnie od trybu tworzenia**, co dowodzi, że to
  luka strukturalna kreatora, nie dane.
- Nie improwizowałem naprawy przez bezpośrednie PUT do API (zgodnie z poleceniem) — to wymaga
  zmiany kodu w `CreateModelModal.tsx` / endpointzie tworzącym model, żeby po utworzeniu artefaktu
  automatycznie wołał `PUT /api/v8/finance-v2/baseline/:businessVersionId/context`.
- Zrzut nadpisany (`finance-baseline-workspace.png` + `-pelna.png`), świeża sesja bez `?ff_wave3FinanceOwnerReview`.
