# RUNDA 3 — 16-kanon (05.09.2026, po naprawach)

Staging `GET /api/health` → **gitSha `b852ade6164e0dec755ea3ae0c59ec2f7ca3dc04`** — czyli **starszy** niz `5ffdabe05e`: naprawy SERWEROWE z 05.09 NIE dzialaja jeszcze na stagingu. Frontend localhost:3000 stoi na m03 @ `03c47ab29a` i ma komplet napraw frontendowych.

Sprawdzono ponownie **3** pozycji, ktore rano mialy werdykt `ROZNI_SIE`. Kazda ma swiezy jasny zrzut 1440 (nadpisany `<id>.png`).

## Tabela

| id | werdykt rano | werdykt teraz | jedno zdanie |
|---|---|---|---|
| `mw-007-calendar-narrow-viewport` | ROZNI_SIE | **ROZNI_SIE** | „Lista" wrocila (4 pozycje); lista ZRODEL nadal 3 zamiast 4 — spec naprawy w opisie. |
| `standard-grid-card` | ROZNI_SIE | **ZGODNY** | Siatka renderuje juz StandardGridCard: akcent, pasek postepu, pigulka statusu, stopka. |
| `standard-kanban-card` | ROZNI_SIE | **ZGODNY** | Kanban renderuje juz StandardKanbanCard: ciche pigulki, polskie kolumny, pasek pilnosci. |

## Bilans calego pakietu po rundzie 3

| Werdykt | Liczba |
|---|---|
| ZGODNY | 5 |
| FALA_2 | 4 |
| ROZNI_SIE | 1 |
| BRAK_W_APLIKACJI | 1 |
| **Razem** | **11** |

## Pozostale `ROZNI_SIE` — specyfikacja dla robotnika

### `mw-007-calendar-narrow-viewport`

Przelacznik widoku NAPRAWIONY (SHA d8203681b8) — sa cztery pozycje: Miesiac / Tydzien / Dzien / Lista, tak jak na obrazie. ZOSTAJE lista ZRODLA: 3 pozycje (Consultify / Zadania / Wydarzenia wlasne) zamiast 4 z obrazu (Zadania / Inicjatywy / Decyzje / Consultify). NAPRAWA: w src/components/MyWork/Calendar/CalendarSidebar.tsx w galezi `v2` (linie ~179-181) lista zrodel jest przybita jako ['consultify','task','event','google','outlook'] i gubi 'initiative' oraz 'decision' — dopisz oba do tej tablicy (sa juz w ALL_SOURCES i maja etykiety w SOURCE_LABELS oraz kolory w SOURCE_COLORS), a kolor kropki dla nich wez z tokenu niekrytycznego (nie crimson), tak jak dla 'task' uzyto var(--c-warning).

Zrzut: `evidence/odbior-zywo-20260905/16-kanon/mw-007-calendar-narrow-viewport.png`


## Runda 5

| id | werdykt runda 3 | werdykt runda 5 | jedno zdanie |
|---|---|---|---|
| mw-007-calendar-narrow-viewport | ROZNI_SIE | **ZGODNY** | Lista ZRODLA ma teraz Inicjatywy i Decyzje obok Zadan/Consultify (plus nowa piata pozycja Wydarzenia wlasne) — brakujace elementy z rundy 3 sa dopisane. |
