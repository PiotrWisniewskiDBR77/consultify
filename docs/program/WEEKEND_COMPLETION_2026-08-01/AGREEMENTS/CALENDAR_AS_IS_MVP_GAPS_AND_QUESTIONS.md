---
doc_kind: AS_IS_TARGET_GAP_ANALYSIS
function_id: MW_CALENDAR
status: REVIEW
last_updated: 2026-07-31
---

# Calendar — AS-IS, MVP, luki i pytania

## 1. Potwierdzone AS-IS

- frontend `CalendarView`, Month/Week/Day/List, FullCalendar grid, sidebar i filters;
- event click do Task/Decision/Initiative;
- drag/move z edit authority i etag payload;
- create modal, recurrence presets i day-load check;
- unified event types i sync metadata;
- adaptery Google, Microsoft Graph i CalDAV;
- incremental checkpoints, cron, webhook routes i resync fallback;
- recurrence canon, permission gradients, lifecycle/error states;
- testy interop i canonical routes.

## 2. Krytyczne rozjazdy

1. UI inicjalnie opisuje Google/Outlook jako `Coming soon`, choć infrastruktura i status endpointy istnieją — potrzebna jedna prawda wynikająca z realnej connection state.
2. `Add to calendar` tworzy przez API obiekt ze `source: task`; semantyka jest myląca. Rozdzielamy `Event` i `Schedule task`.
3. Stare `my-work`, integrations i `v8` routes współistnieją; frontend potrzebuje jednego adaptera kanonicznego.
4. Backendowy sync nie jest równoznaczny z gotową autoryzacją, odnowieniem subskrypcji i produkcyjnym operowaniem wszystkich providerów.
5. Day-load opiera się głównie na liczbie tasków/decyzji, a target wymaga czasu, effort i availability.
6. Brakuje pełnego product flow rozwiązywania etag conflict.

## 3. P0 MVP

- prawdziwe connection status Google/Microsoft i domyślny write calendar;
- Month/Week/Day/List oraz event detail;
- task deadline/work block, decision slot, milestone i external event;
- create/edit/delete/drag zgodne z ownerem i uprawnieniami;
- timezone/all-day/recurrence correctness;
- incremental sync, cursor recovery, stale/lifecycle UI;
- conflict UI i brak silent overwrite;
- plan dnia, load i podstawowe conflict proposals;
- owner/provider read-back oraz audit;
- świeża baza + test dwóch kont/providerów.

## 4. P1/P2

P1: meeting RSVP, shared availability, prep/follow-up, working hours, travel buffers, week planning, notifications/inbox invitations, ICS feed, CalDAV maturity.

P2: appointment scheduling, advanced resource/room booking, travel intelligence, cross-organization scheduling, autonomous planning within explicit policy.

## 5. Golden flows

- GF-C1 connect Google/Microsoft → initial sync → event visible with freshness;
- GF-C2 external update/webhook → incremental sync → no duplicate;
- GF-C3 move writable event → conditional write → provider read-back;
- GF-C4 concurrent external edit → visible conflict → safe resolution;
- GF-C5 task deadline → Teresa proposes work blocks → user approves → Tasks read-back;
- GF-C6 private/free-busy source → second user sees only Busy;
- GF-C7 recurring event exception/cancellation → correct instance without series explosion;
- GF-C8 expired OAuth/cursor → requires action/recoverable → resync without fake freshness;
- GF-C9 timezone/DST/all-day → same intended local time/date;
- GF-C10 retry create after timeout → exactly one event.

## 6. Otwarte decyzje właściciela

1. Czy `Inbox + Calendar` mają jeden wspólny tab z przełącznikiem, czy dwa osobne wejścia Menu 3?
2. Czy CalDAV read-only wchodzi do MVP, czy po stabilnym Google/Microsoft?
3. Czy Consultify tworzy natywne eventy, czy każdy nowy event musi mieć wybrany kalendarz zewnętrzny?
4. Czy focus blocks mogą automatycznie odrzucać spotkania, czy tylko ostrzegać?
5. Kto może zmieniać milestone/deadline projektu przez kalendarz?
6. Czy Meeting odpowiada za zaproszenia uczestników, a Calendar tylko za czas?
