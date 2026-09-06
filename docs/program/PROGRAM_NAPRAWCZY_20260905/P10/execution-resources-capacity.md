# Raport zasobów i obciążenia (`execution-resources-capacity`) — NIE karta N

**Status:** ROZSTRZYGNIĘTE (CTO, ta partia) — nie jest kartą N. Wzorzec rozstrzygnięcia:
`_wzorzec-raport-dokument.md` §„Rozstrzygnięcie CTO".

## Co to jest

`src/components/Execution/reports-intelligence/ResourcesCapacityReport.tsx:38` (303 linie) —
komponent **bezparametrowy** (`ResourcesCapacityReport(): React.ReactElement`, zero propsów, zero
`id`). Czyta `readOperationalAllocations` na żywo (per uzasadnienie flagi,
`executionFeatureFlags.ts:117-119`) i pokazuje alokacje/obciążenie jednego egzemplarza —
organizacja ma jeden taki widok, nie kolekcję rekordów z historią.

## Dlaczego nie karta N

Ten sam test co w pozostałych trzech plikach tej grupy: brak `id`, brak `GET /.../<id>`, brak
zamrożenia stanu „na dzień X” z możliwością odczytania go później. To pokrywa się z uwagą
inwentarza („tożsamość stała — jeden egzemplarz, nie per rekord”), teraz formalnie rozstrzygniętą.

## Stan runtime

Nieosiągalny poza opt-in — `execReportsIntelligence` ma twardy `return false`
(`executionFeatureFlags.ts:128`); dla DBR77 endpoint alokacji operacyjnych zwraca 0 rekordów (ten
sam pomiar co dla pozostałych trzech, cytowany w komentarzu przy fladze). Mount:
`ExecutionHub.tsx:5839` (`activeDocumentId === 'execution-intelligence:resources'`).

## Rekomendacja

Nie pisać kontraktu K1–K30. Jeśli/gdy dane `runtime-v1` obłożenia się wypełnią i ekran zostanie
odsłonięty, to kandydat na zakładkę w istniejącej `ExecutionResourcesSurface` (kanon LIST), nie na
osobną kartę N — treść jest tej samej natury co „Zasoby” (`ExecutionResourcesSurface.tsx`,
1.12-R2 DEC-427), tylko inne źródło (`runtime-v1` zamiast zastanego modelu).
