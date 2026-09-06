# Raport inteligencji pracy (`execution-work-intelligence`) — NIE karta N

**Status:** ROZSTRZYGNIĘTE (CTO, ta partia) — nie jest kartą N. Wzorzec rozstrzygnięcia:
`_wzorzec-raport-dokument.md` §„Rozstrzygnięcie CTO".

## Co to jest

`src/components/Execution/reports-intelligence/WorkIntelligenceReport.tsx:122` (535 linii).
Props: `{ onOpenDocument }` (`:13-14`) — WYŁĄCZNIE callback do otwarcia INNEJ karty
(`execution-work-doc`), zero identyfikatora własnego rekordu. Czyta `listExecutionCases`/
`readExecutionWork`/`readExecutionMilestones` (per komentarz w `executionFeatureFlags.ts:118-119`)
na żywo, jeden egzemplarz na całą organizację — nie „mój raport nr X”, tylko „inteligencja pracy
teraz”.

## Dlaczego nie karta N

Brak `id`, brak `GET` po identyfikatorze, brak zapisu/zamrożenia stanu — każde wejście przelicza
od nowa z bieżących danych `runtime-v1`. To odpowiada dokładnie wykluczeniu z reguły CTO
(„raport na żądanie bez rekordu — to ekran generatora”), tu ściślej: ekran-agregat/dashboard
jednego egzemplarza, nie generator w sensie formularza, ale wynik ten sam: brak tożsamości rekordu.

## Stan runtime

Nieosiągalny poza jawnym opt-in — flaga `execReportsIntelligence` ma twardy `return false`
(`executionFeatureFlags.ts:128`, uzasadnienie: dla DBR77 `runtime-v1` zwraca 0 rekordów, więc ON
pokazałoby pusty ekran). Mount: `ExecutionHub.tsx:5833`
(`activeDocumentId === 'execution-intelligence:work'`, callback `onOpenDocument={handleOpenWorkDocument}`
— czyli to jest wejście DO `execution-work-doc`, nie samodzielny cel).

## Rekomendacja

Jak w `execution-control-loop.md`: nie pisać kontraktu K1–K30 — to dashboard/agregat, nie karta.
Jeśli kiedyś dostanie realne dane i zostanie odsłonięty, właściwym bezpiecznikiem jest kanon LIST
(StandardModuleBar/StandardTable), nie kanon kart N.
