# Raport pętli sterowania (`execution-control-loop`) — NIE karta N

**Status:** ROZSTRZYGNIĘTE (CTO, ta partia) — nie jest kartą N. Wzorzec rozstrzygnięcia:
`_wzorzec-raport-dokument.md` §„Rozstrzygnięcie CTO".

## Co to jest

`src/components/Execution/reports-intelligence/ControlLoopReport.tsx:32` (238 linii) — komponent
BEZ propsów (`ControlLoopReport(): React.ReactElement`, brak `interface Props`), czyta na żywo
`listManagementSignals()`+`listInterventions()` (`ControlLoopReport.tsx:8-9`) i renderuje wynik
przez **`StandardTable`** (`ControlLoopReport.tsx:5`). To jest **LISTA**, nie dokument-rekord:
każde otwarcie liczy na nowo, nie ma `id` do odczytania tej samej treści później, nie ma widoku
pojedynczego obiektu z tożsamością.

## Dlaczego nie karta N

Test z wzorca bazowego: „czy `GET /.../<id>` po zamknięciu i otwarciu ponownie odda dokładnie ten
sam zapisany dokument?” — NIE. Ten ekran nie ma `id` w ogóle; `listManagementSignals`/
`listInterventions` to listy zdarzeń bieżących, nie migawka. Renderowanie przez `StandardTable`
samo w sobie to potwierdza — kanon list, nie kanon kart N.

## Stan runtime

Ekran jest DZIŚ nieosiągalny na żadnym środowisku poza jawnym opt-in: flaga `execReportsIntelligence`
(`src/components/Execution/executionFeatureFlags.ts:52`) ma twardy `return false`
(`executionFeatureFlags.ts:128`) niezależnie od query/localStorage/env — komentarz przy tej linii
(1.12-R4, 06.09.2026) tłumaczy wprost: cztery raporty `reports-intelligence/` czytają WYŁĄCZNIE
szkielet `runtime-v1`, który dla DBR77 zwraca 0 rekordów — włączenie pokazałoby cztery puste
raporty, nie brakującą funkcję (reguła #7 CLAUDE.md — zakaz pokazywania niedopracowanego).
Mount: `ExecutionHub.tsx:5842` (`activeDocumentId === 'execution-intelligence:control'`), za tą
samą flagą.

## Rekomendacja

Nie pisać pełnego kontraktu K1–K30 dla tego ekranu — to nie jest byt, który ten kontrakt reguluje.
Jeśli właściciel zdecyduje przenieść „sygnały i interwencje” do stałego miejsca w menu (np. jako
zakładka listy w Realizacji, poza flagą), wtedy to zadanie jest „dopisz do rejestru list” (skill
`consultify-triada`), nie „dopisz kontrakt karty N”. Warunek zdjęcia flagi (cytat z kodu): przepiąć
te cztery raporty na realne dane (pakiet R1) ALBO zrobić ich własny czysty zrzut i dostać akcept
właściciela — żaden z warunków nie jest spełniony 06.09.2026.
