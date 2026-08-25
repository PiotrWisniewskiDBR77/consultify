# Kalendarz My Work — model danych i kontrakt API (propozycja do akceptu)

Dokument techniczny do decyzji **DEC-2026-08-25-24** (właściciel wybrał budowę realnego
kalendarza w MVP zamiast fasady „wpis = zadanie"). Stan na 25.08.2026, odczyt runtime
z gałęzi roboczej `/private/tmp/consultify-mod07-mywork`.

**Nic z tego nie jest wdrożone.** Kod powstaje dopiero po akcepcie makiety
(`kalendarz-prototyp.html`, zrzuty `kalendarz-light.png` / `kalendarz-dark.png`).

---

## 0. Co jest dziś w runtime (dowody, nie dokumentacja)

| Fakt | Miejsce w kodzie |
|---|---|
| „Utwórz wydarzenie" tworzy **zadanie**; `source` inny niż `task` → HTTP 501 | `server/src/routes/my-work/calendar.routes.ts:739-781` |
| Modal mówi to wprost: „In V1, calendar creation produces a personal task with a due date" · „Artifact type: Task" | `src/components/MyWork/Calendar/CalendarCreateEventModal.tsx:154-183` |
| Odczyt zbiorczy (zadania + inicjatywy + decyzje + spotkania + zewnętrzne) już działa | `calendar.routes.ts:113-733` (`GET /calendar/unified`) |
| Zadania są **zawsze** całodniowe — `allDay: true` na sztywno, data cięta do `YYYY-MM-DD` | `calendar.routes.ts:246-267`, helper `toDateOnly` |
| Spotkania widać tylko własne — filtr `m.created_by = userId`, uczestnictwo nie liczy się | `calendar.routes.ts:531-534` |
| **Nie istnieje** tabela na własne wydarzenia kalendarza | brak `calendar_events` w `server/migrations/*.sql` |
| Istnieje `v8_calendar_items` — ale to **lustro sync-u zewnętrznego** (FK do `v8_calendar_sources`), nie miejsce na wpis użytkownika | `server/migrations/20260331_v8_calendar_interop_p02b.sql:30` |
| Domyślny widok to miesiąc | `CalendarView.tsx` — `useState<CalendarViewMode>('month')` |
| Link do spotkania gubi identyfikator: typ `meeting` → `'/meeting'` bez id | `src/utils/artifactLinks.ts:294-295` |
| …choć hub spotkania **umie** czytać `?meetingId=` | `src/components/Meeting/MeetingHub.tsx:276` (`deepLinkMeetingId`) |

Wniosek: brakuje dokładnie jednej rzeczy — **miejsca na własne wydarzenie**.
Odczyt, siatka, filtry warstw i wykrywanie obciążenia dnia już są.

---

## 1. Zasada nadrzędna: kalendarz agreguje, nie duplikuje

```
  meetings          (moduł 06)  ──┐
  tasks.due_date    (moduł 07)  ──┼──►  GET /calendar/unified  ──►  siatka tygodnia
  calendar_events   (NOWA)      ──┘
```

* Spotkania **zostają** w `meetings`. Kalendarz je pokazuje i linkuje, nie kopiuje i nie edytuje.
* Zadania **zostają** w `tasks`. Kalendarz pokazuje ich termin w pasie „Terminy".
* `calendar_events` przechowuje **wyłącznie** to, czego nigdzie indziej nie ma:
  własny blok czasu użytkownika.

Konsekwencja: zero migracji danych, zero podwójnego zapisu, zero rozjazdu stanów.
Zmiana tytułu spotkania w module Spotkania natychmiast widać w kalendarzu, bo to ten sam wiersz.

---

## 2. Tabela `calendar_events`

Migracja **addytywna**: `server/migrations/20260826_calendar_events.sql`.
Konwencja z repo: `CREATE TABLE IF NOT EXISTS`, kolumny `TEXT`, czas jako ISO w `TEXT`
(dokładnie jak `meetings` — `20260623_meetings_baseline.sql`), brak `DROP`, brak `ALTER`
na cudzych tabelach. Bez rollbacku (nic nie usuwa).

```sql
CREATE TABLE IF NOT EXISTS calendar_events (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    owner_id            TEXT NOT NULL,

    title               TEXT NOT NULL,
    description         TEXT DEFAULT '',
    location            TEXT DEFAULT '',

    start_at            TEXT NOT NULL,          -- ISO 8601 UTC
    end_at              TEXT NOT NULL,          -- ISO 8601 UTC, zawsze > start_at
    all_day             INTEGER DEFAULT 0,      -- 0/1

    attendees_json      TEXT DEFAULT '[]',      -- ["<user_id>", ...] TYLKO z tej organizacji
    visibility          TEXT DEFAULT 'private', -- private | busy | org   (decyzja F)
    status              TEXT DEFAULT 'confirmed', -- confirmed | cancelled

    related_type        TEXT,                   -- task | initiative | meeting | NULL
    related_id          TEXT,                   -- BEZ klucza obcego (patrz §2.2)

    recurrence_rule     TEXT,                   -- zarezerwowane, w MVP zawsze NULL (decyzja D)
    recurrence_parent_id TEXT,                  -- zarezerwowane, w MVP zawsze NULL

    created_by          TEXT NOT NULL,
    created_at          TEXT DEFAULT (now()::text),
    updated_at          TEXT DEFAULT (now()::text)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_range
    ON calendar_events(organization_id, owner_id, start_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_org_range
    ON calendar_events(organization_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_related
    ON calendar_events(organization_id, related_type, related_id);
```

### 2.1 Dzierżawa (tenant-scope) — twarda reguła

`organization_id` jest **w każdym** `WHERE`, razem z `owner_id` albo z regułą widoczności.
Żadne zapytanie kalendarza nie może mieć tylko `owner_id` — user może być przeniesiony
między organizacjami, a wtedy filtr po samym userze przecieka dane.

Wzorzec odczytu (identyczny jak w istniejącym `/calendar/unified`):

```sql
WHERE e.organization_id = ?
  AND (
        e.owner_id = ?
     OR e.attendees_json LIKE ?                    -- '%"<userId>"%'
     OR (e.visibility = 'org')                     -- tylko gdy decyzja F1
  )
  AND e.start_at < ?  AND e.end_at >= ?            -- zakres, przecięcie a nie zawieranie
  AND e.status <> 'cancelled'
```

### 2.2 Dlaczego `related_id` bez klucza obcego

`related_id` może wskazywać na `tasks`, `initiatives` albo `meetings` — trzy różne tabele.
Klucz obcy polimorficzny nie istnieje. Zamiast tego: pole informacyjne, a UI degraduje
uczciwie („powiązany obiekt jest niedostępny"), gdy cel zniknął. Ten sam wzorzec, którego
repo używa dla `tasks.source_type` / `tasks.source_id`.

### 2.3 Indeksy — po co każdy

| Indeks | Zapytanie, które obsługuje |
|---|---|
| `(organization_id, owner_id, start_at)` | główny odczyt: „mój tydzień" — 95% ruchu |
| `(organization_id, start_at, end_at)` | widok zespołu / szukanie wolnego slotu (Teresa: „znajdź 90 min") |
| `(organization_id, related_type, related_id)` | „pokaż bloki czasu zarezerwowane na to zadanie" |

---

## 3. Kontrakt API

Wszystko pod istniejącym prefiksem `/api/my-work`, w istniejącym pliku
`server/src/routes/my-work/calendar.routes.ts`.

### 3.1 Odczyt zakresu — rozszerzenie istniejącego endpointu

```
GET /api/my-work/calendar/unified?start=<ISO>&end=<ISO>&sources=meeting,task,event
```

* Do listy `sources` dochodzi wartość **`event`** (własne wydarzenia).
* Kształt odpowiedzi **bez zmian** — ten sam `{ events: [...] }`, żeby frontend nie musiał
  rozróżniać źródeł inaczej niż dziś.
* Nowe wpisy mają `source: 'event'`, `allDay` zgodne z kolumną, `end` realne (nie „exclusive+1 dzień",
  bo to nie jest wpis całodniowy).
* `end` jest **inclusive-exclusive tylko dla `all_day = 1`** — tak jak dziś działa gałąź zadań.

Uwaga wykonawcza: dzisiejsza gałąź spotkań filtruje `m.created_by = ?`. Przy tej samej okazji
zmienia się na „twórca **lub** uczestnik" (`attendees_json LIKE`), inaczej kalendarz nadal
nie pokaże spotkań, na które użytkownik jest zaproszony.

### 3.2 Zapis własnego wydarzenia

```
POST   /api/my-work/calendar/events
PUT    /api/my-work/calendar/events/:id
DELETE /api/my-work/calendar/events/:id      → soft delete: status = 'cancelled'
```

`POST` body (zod):

```jsonc
{
  "title":       "Przegląd modelu z Anną",   // wymagane, 1..500
  "startAt":     "2026-08-28T09:00:00Z",     // wymagane
  "endAt":       "2026-08-28T10:00:00Z",     // wymagane, > startAt
  "allDay":      false,
  "description": "",
  "location":    "",
  "attendees":   ["usr_..."],                // opcjonalnie, walidowane: ta sama organizacja
  "visibility":  "private",                  // private | busy | org
  "relatedType": "task", "relatedId": "tsk_..."   // opcjonalnie
}
```

Odpowiedź: pełny obiekt wydarzenia (nie samo `id`) — żeby siatka mogła dorysować blok
bez ponownego odczytu całego tygodnia.

**Zmiana zachowania, którą trzeba zrobić świadomie:** dzisiejszy `POST /calendar/events`
z `source: 'task'` tworzy zadanie. Ta ścieżka **zostaje** (formularz ma jawny wybór
„Wydarzenie | Zadanie"), ale przestaje być domyślna i przestaje być jedyna.
Domyślnym typem w szybkim formularzu jest **Wydarzenie**.

Walidacje serwera (twarde, nie tylko UI):
1. `endAt > startAt`;
2. `owner_id` = zalogowany user, `organization_id` z sesji — **nigdy z body**;
3. każdy `attendees[]` musi należeć do tej samej organizacji (inaczej 400);
4. `PUT`/`DELETE` tylko dla `owner_id = userId` — uczestnik nie edytuje cudzego wpisu.

### 3.3 Przesunięcie (drag lub zmiana godziny w formularzu)

Istniejący `PATCH /calendar/events/:eventId/reschedule` rozpoznaje prefiksy
`task-` i `decision-`. Dochodzi `event-`:

```
PATCH /api/my-work/calendar/events/event-<id>/reschedule
{ "newStart": "...", "newEnd": "..." }
```

### 3.4 Obciążenie dnia

`GET /calendar/conflicts?date=YYYY-MM-DD` istnieje i liczy dziś zadania + decyzje.
Dochodzi trzeci składnik (spotkania + wydarzenia w godzinach), żeby „2 spotkania · 1,5 h"
w lewej szynie mówiło prawdę.

---

## 4. Świadomie POZA MVP — z dyspozycją

| Rzecz | Dlaczego poza | Dyspozycja |
|---|---|---|
| **Zaproszenia zewnętrzne** (e-mail, plik ICS, RSVP) | Wymaga nadawcy poczty, tożsamości domeny, obsługi odpowiedzi „tak/nie/może" i osobnego modelu gościa spoza organizacji | Uczestnik = wyłącznie user z organizacji. Osoba z zewnątrz trafia do pola `location`/`description` jako tekst. Wraca razem z modułem Spotkania, nie osobno. |
| **Sync Google / Outlook** | Warstwa istnieje (`v8_calendar_items`, `v8_calendar_sources`), ale integracja nie jest podłączona; dwukierunkowość to konflikty, etagi i „kto wygrywa" | Warstwy zostają w lewej szynie jako **wyłączone**, z uczciwym opisem „Niepodłączony" (dokładnie tak, jak robi to dziś `CalendarView.tsx`). Włączamy dopiero po podłączeniu integracji w Ustawieniach. |
| **Powtarzalność (RRULE)** | Osobny podsystem: wyjątki serii, „edytuj to / wszystkie / przyszłe", przesuwanie ogona | **Decyzja D.** Rekomendacja: w MVP przycisk „Powiel na kolejne 4 tygodnie" = 4 niezależne wpisy. Kolumny `recurrence_rule` / `recurrence_parent_id` zakładamy **puste od pierwszego dnia**, żeby późniejsze włączenie serii nie wymagało migracji. |
| **Rezerwacja sal / zasobów** | Brak modelu zasobu w bazie | `location` jako tekst wolny. |
| **Strefy czasowe inne niż strefa użytkownika** | Cały system trzyma czas jako ISO UTC; wyświetlanie w jednej strefie | Przechowujemy UTC, renderujemy w strefie przeglądarki. Wybór strefy per wydarzenie — poza MVP. |
| **Przeciąganie bloków myszą** | Endpoint `reschedule` już istnieje, ale drag&drop na siatce to osobna praca frontu | Zmiana godziny przez formularz. Drag dokładamy po akcepcie siatki. |

---

## 5. Kolejność wykonania (po akcepcie)

1. Migracja `20260826_calendar_events.sql` — addytywna, sama tabela + indeksy.
2. `GET /calendar/unified` — gałąź `event` + naprawa filtra spotkań (`created_by` → `created_by OR attendee`).
3. `POST/PUT/DELETE /calendar/events` + walidacje serwera.
4. Frontend: siatka tygodnia/dnia za flagą **domyślnie WYŁĄCZONĄ** (`ff_myWorkRealCalendar`), zgodnie z regułą 7.
5. Zrzuty jasny + ciemny robi wykonawca, nie właściciel. Dopiero potem akcept i włączenie flagi.
6. `artifactLinks.ts` — `meeting` zwraca `/meeting?meetingId=${id}` (jedna linia, naprawia klik w spotkanie).
7. Widok miesiąca — tylko jeśli decyzja **E1**.
