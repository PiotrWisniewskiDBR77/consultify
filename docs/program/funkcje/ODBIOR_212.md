---
doc_id: funkcje-odbior-212
status: canonical
owner: piotr
truth_type: status
established: 2026-08-31
---

# ODBIÓR 212 — zabezpieczenia bez testu omijającego — SCALONE PO FIX-212 (`a942c59c88`)

## Historia: dyżur wrócił jako sam inwentarz — i to był błąd nadzorcy

Dyżur 212 miał zinwentaryzować zabezpieczenia i dopisać testy omijające. Wrócił z
inwentarzem 34 nazwanych bramek (z `plik:linia`) i **zerem testów**; przy większości
pozycji stało „NIEZNANE — wymaga mutacji", a kolumna „co chroni" była jednym zdaniem
powielonym automatycznie.

**Przyczyna nie leży po stronie wykonawcy.** Zamówienie 34 pozycji naraz w jednym
oknie było nierealne — to błąd planistyczny nadzorcy. Wykonawca uczciwie oznaczył
całość jako częściową i przy okazji wychwycił, że instrukcja podaje w dwóch
miejscach różne liczby (6791 vs 6792; jego pomiar: 6792).

FIX-212 dostał zakres wąski i wykonalny: **pięć pozycji, wybranych po SKUTKU
złamania** — ujawnia cudze dane albo pozwala zapisać bez zgody.

## Pięć bramek — dziesięć przebiegów, każdy przeciw realnemu Postgresowi i realnemu HTTP+JWT

| # | Zabezpieczenie | z zabezpieczeniem | po jego usunięciu |
| --- | --- | --- | --- |
| 1 | `raid.routes.ts:36` `assertRaidItemInOrganization` | 4/4 | **1 failed** — obcy `PUT` dostaje 200 zamiast 404 |
| 2 | `managementReportsService.ts:138` `assertReportInOrganization` | 56/56 | **19 failed** |
| 3 | `DecisionController.ts:650` `assertRelatedObjectsBelongToOrg` | 2/2 | **1 failed** — decyzja z cudzym `projectId`: 201 zamiast 400 |
| 4 | `finance-intelligence.routes.ts:95` `assertAnalysisOwnedByOrg` | 2/2 | **1 failed** — obcy czyta cudzą analizę finansową: 200 zamiast 404 |
| 5 | `interviewEnterpriseService.ts:167` `assertSessionInOrg` | 3/3 | **1 failed** — obcy dopisuje segment do cudzej sesji wywiadu: 201 zamiast 404 |

Każda mutacja: edycja źródła ⇒ czerwień ⇒ przywrócenie przez `cp` ⇒ `diff` pusty
(potwierdzone dla wszystkich pięciu).

## ★ Znalezisko nr 1: test bezpieczeństwa RAID był POMIJANY, a regresja realna

Istniejący test 4/4 był przypięty do nazwy bazy (`Z31`) i **cicho się pomijał** —
**szósty incydent tego wzorca w programie**. Pod spodem siedziała prawdziwa
regresja: cudze RAID-y (ryzyka, akcje, problemy, zależności) były odsłonięte do
**zapisu** metodami `PUT`/`PATCH`/`DELETE`. Odpięcie strażnika ujawniło ją natychmiast.

## ★ Znalezisko nr 2: komentarz w kodzie kłamie o trasie finansowej

`finance-intelligence.routes.ts:18` mówi **„NOT MOUNTED YET"**, a trasa **jest
zamontowana** (`server/src/routes/v8/index.ts:121` — zweryfikowane niezależnie przez
nadzorcę). To jedyna bariera do cudzych danych finansowych: przychodów, ROI, marż.
Następny czytelnik mógł uznać tę trasę za martwą i nie zawracać sobie nią głowy.

## Znaleziska zgłoszone, ŚWIADOMIE niezałatane (zakres FIX-a był wąski)
1. Mylący komentarz „NOT MOUNTED YET" — do sprostowania.
2. `interviewEnterpriseService.getSegments` nie używa `assertSessionInOrg` w ogóle
   (inna ścieżka niż zakładał inwentarz); dziś bezpieczne dzięki `WHERE
   organization_id = ?` w SQL, ale zmiana tego zapytania nie zapali żadnego alarmu.
3. `accessCodes.routes.cross-org-escalation.mounted.realdb.test.ts` ma **ten sam**
   defekt `Z31` co RAID — kolejny cicho pomijany test bezpieczeństwa. Osobny dyżur.

## Co zostaje
**29 z 34 pozycji inwentarza nadal bez testu omijającego.** Inwentarz jest pierwszą
taką listą w tym programie i zostaje jako baza pod kolejne partie po pięć.
