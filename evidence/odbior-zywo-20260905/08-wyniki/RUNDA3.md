# RUNDA 3 — 08-wyniki

| id | werdykt rano | werdykt teraz | jedno zdanie |
|---|---|---|---|
| roi-jedna-karta | ROZNI_SIE | ROZNI_SIE | Nadal nie da się zweryfikować na żywo z tego samego powodu co w rundzie 1: rejestr ROI ma 0 spraw, tworzenie sprawy zwraca 403 ROI_CASE_CREATION_NOT_AUTHORIZED (potwierdzone dziś ś… |
| results-vnext-kpi-scorecards | ROZNI_SIE | DANE | NAPRAWIONE: integracja z rundy 1 ('zbudowane, ale niepodłączone') działa — chip 'Karty wyników' w rejestrze KPI jest teraz klikalny, prowadzi do /results/kpi/scorecards/:id z pełną… |
| results-vnext-roi-model | ROZNI_SIE | ROZNI_SIE | BLOKADA NADAL AKTYWNA (identyczna jak w rundzie 1): rejestr ROI ma 0 spraw; próba utworzenia sprawy z pełnym, wypełnionym formularzem (inicjatywa+nazwa+waluta+daty) kończy się 403 … |
| results-vnext-roi-full-tool | ROZNI_SIE | ROZNI_SIE | Ta sama blokada co 'Model ROI', potwierdzona ponownie świeżą próbą z pełnym formularzem: POST /api/vnext/results/roi/cases → 403 ROI_CASE_CREATION_NOT_AUTHORIZED. |
| results-vnext-okr-admin | ROZNI_SIE | ROZNI_SIE | Obraz zatwierdzony dokumentował uczciwy stan WYŁĄCZENIA ('Programy OKR jeszcze nie włączone'). |
| results-vnext-okr-registry | ROZNI_SIE | ROZNI_SIE | POZYTYWNA NAPRAWA potwierdzona: nagłówek ma teraz przycisk 'Nowy OKR' na górze, a 'Programy'/'Cykle' zjechały do drugiego rzędu — dokładnie to, czego brakowało wg uwagi właściciela… |

## Runda 4

| id | werdykt runda 3 | werdykt runda 4 | jedno zdanie |
|---|---|---|---|
| roi-jedna-karta | ROZNI_SIE (403) | DANE | Blokada zmieniła charakter: zamiast mylącego 403 po formularzu, ekran teraz uczciwie mówi "ROI nie jest włączone w tej organizacji" z przyciskiem "Włącz ROI dla organizacji" (brak wiersza w rvn_roi_visibility_governance) — kod poprawny, brakuje decyzji/danych organizacyjnych. |
| results-vnext-roi-model | ROZNI_SIE (403) | DANE | Ten sam blocker co roi-jedna-karta (NO_GOVERNED_POLICY); po odblokowaniu porównywać do NOWEGO wzorca jednej n-karty, nie do starego 4-fazowego obrazu (odrzuconego przez właściciela 02.09). |
| results-vnext-roi-full-tool | ROZNI_SIE (403) | DANE | Identyczny blocker; układ 4 faz z zatwierdzonego obrazu jest nieaktualny (właściciel odrzucił na rzecz jednej n-karty) — czeka na publikację polityki widoczności ROI dla organizacji. |

## Runda 5

| id | werdykt runda 3 | werdykt runda 5 | jedno zdanie |
|---|---|---|---|
| results-vnext-okr-registry | ROZNI_SIE | **ZGODNY** | Kolumna WLASCICIEL pokazuje juz realne imie i nazwisko 'Piotr Wisn...' zamiast UUID. |
| results-vnext-okr-admin | ROZNI_SIE | **ZGODNY** | Panel podgladu programu ma juz stale wypelniony pasek akcji ('Cykle OKR', 'Kopiuj identyfikator') pod sekcja Powiazania - kod (OkrProgramsPage.tsx:286-301) wprost dokumentuje ta nasrawe jako odpowiedz na uwage z rundy 3. |
