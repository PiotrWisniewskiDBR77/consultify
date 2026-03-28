# Agent 4 - Fala 1 Execution Memo

> Date: 2026-03-28
> Scope owner: Agent 4
> Scope: `Inicjatywy` / `Wdrozenia` / `KPI` / `Finanse`
> Status: execution memo

## Scope truth
- Repo potwierdza jeden consulting / execution spine: `Inicjatywy -> Wdrozenia -> KPI -> Finanse`, a nie 4 niezalezne ekrany.
- Najmocniejsza prawda dla tego klastra siedzi w V8 runtime i route'ach, nie w jednym czystym user-facing happy path.
- Najwiekszy split-brain jest na wejsciu spine: `Inicjatywy` maja mocne V8 reads, ale kluczowe create/update/status nadal przechodza przez legacy seams.
- `Wdrozenia` sa uzywalne, ale dalej mieszaja V8 control signals z legacy task/decision/health sources, wiec operator truth nie jest jednolita.
- `KPI` i `Finanse` sa relatywnie mocne funkcjonalnie, ale dalej niosa legacy naming / route drift, wiec wygladaja jak pol-migracja zamiast jeden spojny system.

## First packet
- `Initiative Write Truth`

## Acceptance proof
- User tworzy nowa inicjatywe z glownego modulu bez wpada nia w niejawny legacy write path.
- Nowa inicjatywa od razu pojawia sie w portfolio i otwiera sie w tym samym spojnym detail view.
- User zmienia status oraz podstawowe pola i widzi zgodna historie zmian oraz readiness state.
- Po odswiezeniu lista, detail i status dalej pokazuja ta sama prawde.
- User rozumie, ze to jest kanoniczny punkt startu dalszego consulting / execution spine.

## Blockers / dependencies
- Brak jednego widocznego governed write contract dla `Inicjatywy`; V8 planning jest dzis glownie read bridge.
- `Wdrozenia` nadal zaleza od mieszanych zrodel danych, wiec nawet po naprawie initiatives spine nie bedzie jeszcze w pelni czysty.
- Upstream z `Idea` i `Interview insights` jest wazny jako wejscie do inicjatyw, ale pozostaje dependency, nie ownership tego memo.
- `KPI` i `Finanse` maja nadal naming / route drift (`Benefits`, `Economics`), co oslabia trust downstream.
- Duza glebokosc backendu moze falszywie sugerowac gotowosc produktu, mimo ze user-facing continuity nadal jest nierowna.

## Start now or wait
- `wait` - ten spine powinien wejsc dopiero w swoim miejscu manager order; kiedy ruszy, trzeba zaczac od `Initiative Write Truth`, bo bez tego caly klaster dziedziczy split-brain.
