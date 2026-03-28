# Agent 4 Packet 1 - Initiative Write Truth

> Date: 2026-03-28
> Scope owner: Agent 4
> Cluster: `Inicjatywy -> Wdrozenia -> KPI -> Finanse`
> Packet status: proposed first bounded packet

## Name

`Initiative Write Truth`

## Goal

Usunac najwyzszy-value split-brain na wejsciu consulting / execution spine, tak aby glowny user-facing lifecycle `create -> update -> status -> reopen` dla inicjatywy mial jedna wiarygodna prawde.

## Why this packet is first

- `Inicjatywy` sa upstream governance anchor dla calego spine.
- Dzis repo ma mocne V8 reads dla initiatives, ale glowny write path nadal wpada w legacy seams.
- Bez zamkniecia tego miejsca `Wdrozenia`, `KPI` i `Finanse` beda wygladaly jak downstream do nie w pelni kanonicznego obiektu.

## Scope

Ten packet obejmuje tylko glowny user-facing write path dla `Inicjatywy`:

- create z glownego modulu
- status change
- quick update dla podstawowych pol
- immediate reopen in governed detail
- readiness / history coherence po write

## What we deliver

- Jedna jawna prawda dla create/status/quick-update na glownym happy path inicjatywy.
- Widoczny governed contract albo jawnie oznaczony governed shim zamiast cichego legacy persistence.
- Spojnosc miedzy:
  - lista portfolio
  - detail / preview
  - status history
  - readiness state
- Odswiezenie po zapisie nie zmienia zrodla prawdy ani nie rozjezdza UI.

## What we consciously do not touch

- `Wdrozenia` control tower cleanup
- `KPI` naming / route truth
- `Finanse` naming / route truth
- nowe widoki portfolio
- szeroki PM suite, AI planner, approval expansion
- upstream `Idea` / `Interview` product work
- `Tools`, `Assessment`, `Radar`, `Outputs`, admin programs

## Acceptance proof

- User tworzy nowa inicjatywe z glownego modulu i nie trafia w niejawny legacy write path.
- Nowa inicjatywa od razu pojawia sie w portfolio i otwiera w tym samym spojnym detail view.
- User zmienia status oraz podstawowe pola i widzi zgodna historie zmian oraz readiness state.
- Po refreshu lista, detail i status dalej pokazuja te sama prawde bez route ambiguity.
- User rozumie, ze inicjatywa jest kanonicznym obiektem startowym dalszego consulting / execution spine.

## Repo truth behind the packet

- `InitiativesHub.tsx` preferuje V8 portfolio read, ale fallbackuje do legacy reads.
- Create nadal idzie przez `POST /initiatives`.
- Status change i quick update nadal ida przez legacy `/initiatives/:id/status` oraz `/initiatives/:id/quick-update`.
- V8 planning ma mocne governed reads dla portfolio, initiative detail, readiness, history, KPI i budget context.
- To oznacza, ze najwieksza luka nie jest w breadth funkcji, tylko w write truth na glownym flow.

## Risks

- V8 planning jest dzis glownie read bridge, wiec packet moze wymagac nowego governed write seam albo jawnego compatibility shim.
- W hubie moga istniec ukryte zalozenia legacy w bulk actions i quick edit.
- Latwo zrobic lokalny polish bez realnego zamkniecia split-brain; taki wynik nie moze byc uznany za acceptance.
- Jest ryzyko falszywej gotowosci, bo backend depth jest duzy, ale user-facing write truth nadal nie jest wymuszona.

## Dependencies

- Packet nie zalezy od wdrozenia calego `Execution Truth Spine`, ale musi zachowac przyszla kompatybilnosc z downstream handoff do `Wdrozenia`.
- Upstream z `Idea` i `Interview insights` pozostaje dependency dla pelnego spine, ale nie blokuje tego bounded packetu.
- Jeśli nie istnieje jeszcze bezpieczny governed write contract dla initiatives, to to jest twardy blocker implementacyjny i trzeba go nazwac wprost zamiast ukrywac legacy path.

## Done condition

Packet jest done tylko wtedy, gdy user moze przejsc przez podstawowy lifecycle inicjatywy bez zgadywania, czy zapis poszedl do kanonicznej prawdy, i gdy ten sam obiekt zachowuje spojna tozsamosc w liscie, detalu, readiness i historii.
