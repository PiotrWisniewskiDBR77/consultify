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

## Runda 6

Decyzja właściciela 05.09 (strona decyzji): włączyć ROI dla organizacji DBR77 na stagingu. Wykonano
kliknięcie „Włącz ROI dla organizacji" na `/results/roi` → `POST /api/vnext/results/roi/visibility-policy`
→ 201, `outcome: applied`, organizacja `a3e05d4a-5397-419d-b486-8e44366c0063`, opublikowane przez
`d2b6a316-...` (Piotr Wiśniewski, OWNER), 2026-09-05T10:33:48Z. Szczegóły i dowód sieciowy:
`evidence/odbior-zywo-20260905/UTWORZONE_REKORDY.md` (sekcja Runda 6) i
`evidence/odbior-zywo-20260905/08-wyniki/runda6/klik-siec.json`. Ta sama organizacja miała już JEDNĄ
realną sprawę ROI ("Program poprawy realizacji korzyści", status Szkic) — niewidoczną wyłącznie z braku
wiersza governance; nie utworzono żadnej nowej sprawy demo.

| id | werdykt runda 4 | werdykt runda 6 | jedno zdanie |
|---|---|---|---|
| roi-jedna-karta | DANE | **DANE** | Blokada zniknęła po publikacji polityki — powłoka karty N (5 sekcji lewego menu, prawy panel Akcje/Właściwości/Powiązania/Źródła/Komentarze/Historia) jest identyczna z obrazem; różni się tylko treść sekcji Założenia, bo jedyna realna sprawa w organizacji jest w statusie Szkic i pokazuje surowe tabele edycyjne (Baseline i polityka / Założenia) zamiast dojrzałej narracji z obrazu — brakuje sprawy z pełnym modelem w statusie W realizacji/Aktywna. |
| results-vnext-roi-model | DANE | **ZGODNY** | Blokada zniknęła; obraz zatwierdzony to STARY, odrzucony 02.09 wzorzec 4-fazowego poziomego menu — żywa sekcja „Model" (Koszty/Korzyści/Scenariusze, realne wiersze kosztowe) jest zgodna z NOWYM zatwierdzonym wzorcem jednej karty N (ten sam co roi-jedna-karta), czyli z tym, co właściciel faktycznie zaakceptował 2026-08-30 (RoiCaseCardSections.ts). |
| results-vnext-roi-full-tool | DANE | **ZGODNY** | Blokada zniknęła; obraz zatwierdzony to ten sam nieaktualny wzorzec 4-fazowy. Rejestr ROI (Poziom 1) pokazuje teraz realną sprawę i poprawny przycisk „Nowa sprawa ROI"; wejście w sprawę (Poziom 3) otwiera dokładnie tę samą kartę N co roi-jedna-karta, ze wszystkimi 16-17 dawnymi podwidokami zachowanymi pod nową nawigacją — zgodne z decyzją właściciela z 02.09/dokumentacją w kodzie z 2026-08-30. |

## Runda 7

Zlecenie: rozstrzygnąć z dowodem w kodzie, czy odrzucenie właściciela na `roi-jedna-karta`
("Nie. Ma być taka jak zatwierdzona.") wynika z DANYCH czy z KOMPOZYCJI — bez żadnych zmian
kodu w tym zadaniu.

| id | werdykt runda 6 | werdykt runda 7 | jedno zdanie |
|---|---|---|---|
| roi-jedna-karta | DANE | **KOMPOZYCJA** | Runda 6 się myliła: `RoiCaseFullTool.tsx:146` renderuje surowy warsztat `RoiCaseModelWorkspace` w sekcji Założenia dla KAŻDEJ sprawy bez wyjątku (potwierdzone w kodzie, nie w danych) — narracja z zatwierdzonego obrazu istnieje wyłącznie jako statyczny JSX w prototypie `dev-render/screens/roi-jedna-karta.tsx:206-241` i nigdy nie została zbudowana na produkcji; żadna dojrzałość sprawy tego nie zmieni. Pełny spec zmiany (pliki, linie, co budować) zapisany w `wyniki.json` → pole `spec` wpisu `roi-jedna-karta`. Zero zmian kodu w tej rundzie — zgodnie ze zleceniem.
