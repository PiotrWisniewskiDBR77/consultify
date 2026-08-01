---
decision_id: ADR-WK-EXCEL-001
status: PROPOSED_FOR_SPIKE
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-30
---

# Excel — decyzja technologiczna

## Decyzja

Nie budujemy od zera pełnego odpowiednika Excela i nie wymieniamy istniejącego
stosu na zamknięty pakiet. Przyjmujemy wariant hybrydowy:

1. Consultify zachowuje własny kanoniczny model skoroszytu, generatory,
   formuły domenowe, AI, wersjonowanie, uprawnienia, audyt i eksport `.xlsx`.
2. Gotowe komponenty oceniamy dla dwóch wymienialnych warstw: interakcji z
   siatką oraz zgodnego z Excelem silnika formuł.
3. Bez wyniku spike'u nie kupujemy licencji i nie rozpoczynamy migracji UI.

## Co już istnieje

| Zdolność | Dowód | Los |
| --- | --- | --- |
| generowanie `.xlsx` | `exceljs`, `xlsx`, `server/src/services/workbook/WorkbookGeneratorService.ts` | zachować |
| model arkuszy, komórek i formuł | `src/utils/workbookGridPreview.ts`, API schematu workbooka | zachować |
| edytowalna siatka i pasek formuły | `src/components/AIChat/KimiWorkspace/EditableSpreadsheetGrid.tsx` | UX do oceny |
| wiele arkuszy | `ExceleView.tsx`, `KimiWorkspaceShell.tsx`, `ODB-EXCEL-04.md` | zachować |
| modele parametryczne | `ExceleParametricTemplates.tsx`, `server/src/services/workbook/templates/` | zachować |
| formuły Table Platform | `server/src/services/tablePlatform/formulaEngine.ts`, `dependencyGraph.ts` | zachować dla tabel lub zastąpić adapterem |
| import, eksport, QA, governance | `server/src/services/tablePlatform/` | zachować |
| generator szablonów użytkownika | `ff_workbook_templates`, obecnie głównie rejestr kodowy | dokończyć |
| ergonomia klasy Excel | własna siatka | największa luka |

## Uzasadnienie

Pełny edytor arkusza oznacza lata pracy nad zakresami, schowkiem, klawiaturą,
undo/redo, fill handle, formatami, dostępnością i wydajnością. To nie jest
przewaga Consultify. Przewagą są konsultingowe modele, dane, AI i bezpieczne
przejście od rozmowy do materiału.

Całkowity gotowiec również jest złym wyborem: obecny backend zawiera znaczną
część wartości produktu. Wymiana stworzyłaby migrację wysokiego ryzyka i
zależność od dostawcy bez dowodu poprawy golden flow.

## Korekta diagnozy z 2026-07-29

W rozmowie roboczej padła informacja, że własny silnik obsługuje osiem funkcji.
Nie jest to już prawdziwe dla aktualnego kodu. Rejestr
`server/src/services/tablePlatform/formulaEngine.ts` zawiera około 50 funkcji
tekstowych, liczbowych, datowych, logicznych i rekordowych.

To nadal nie oznacza zgodności z Excelem. Silnik Table Platform używa głównie
referencji do pól rekordu i ma inny kontrakt niż arkusz z adresami A1, zakresami,
formułami tablicowymi oraz setkami funkcji. W spike'u mierzymy więc osobno:

- zgodność składni i semantyki formuł;
- zakres funkcji potrzebnych naszym golden flows;
- zakresy i odwołania między arkuszami;
- graf zależności, przeliczanie przyrostowe i cykle;
- błędy Excela oraz zgodność import → edycja → eksport.

Nie przyjmujemy wcześniejszego szacunku „dzień lub dwa” jako planu. Tyle może
zająć prototyp jednego adaptera, ale nie bezpieczna wymiana silnika.

## Spike porównawczy

Do krótkiej listy trafiają maksymalnie trzy silniki siatki. Każdy dostaje tę
samą próbkę: skoroszyt 3-arkuszowy, formuły między arkuszami, 10 tys. komórek,
formaty liczbowe, paste z Excela i zapis do naszego schematu.

Kryteria:

- React/TypeScript i adapter do naszego modelu;
- szerokie pokrycie funkcji, zakresy i odwołania między arkuszami;
- graf zależności, przeliczanie przyrostowe, cykle i błędy;
- klawiatura, zakresy, copy/paste, fill handle, undo/redo;
- wirtualizacja i wydajność;
- ciemny motyw, dostępność i lokalizacja;
- brak wysyłania danych do zewnętrznej chmury;
- licencja komercyjna i przewidywalny koszt;
- możliwość osadzenia Teresy i prawego panelu;
- import/eksport pozostający po naszej stronie.

## Bramki

1. **G0:** zamrozić kanoniczny `WorkbookSchema`.
2. **G1:** wyrenderować jeden arkusz bez utraty danych.
3. **G2:** uruchomić corpus formuł i porównać wyniki z oczekiwaniami.
4. **G3:** tworzenie → edycja → przeliczenie → zapis → reopen → eksport.
5. **G4:** licencja, wydajność, dostępność i bezpieczeństwo.
6. **G5:** decyzja osobno dla `GRID` i `FORMULA_ENGINE`.

## Golden flow

Użytkownik prosi Teresę o model finansowy, wybiera lub doprecyzowuje szablon,
system buduje skoroszyt, użytkownik zmienia założenie, formuły przeliczają
wynik, skoroszyt zapisuje się, otwiera ponownie bez utraty danych i eksportuje
do `.xlsx`.

## Czego teraz nie robimy

- pełnego klona desktopowego Excela;
- migracji backendu workbooków do biblioteki UI;
- zakupu licencji przed spike'iem;
- osobnego modelu danych dla każdej biblioteki;
- automatycznego usunięcia obecnego silnika Table Platform;
- architekta szablonów przed ustaleniem golden flow edycji.
