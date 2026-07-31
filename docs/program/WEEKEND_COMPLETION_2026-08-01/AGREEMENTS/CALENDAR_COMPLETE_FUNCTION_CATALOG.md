---
doc_kind: FUNCTION_CATALOG
function_id: MW_CALENDAR
status: REVIEW
last_updated: 2026-07-31
---

# Calendar — kompletny katalog funkcji

| ID | Funkcja | Zachowanie | Teresa | Priorytet |
| --- | --- | --- | --- | --- |
| CAL-V01 | Month | deadline'y, all-day, zagęszczenie i przejście do dnia | wskazuje tygodnie ryzyka | P0 |
| CAL-V02 | Week | główne planowanie czasu i drag/drop | proponuje realokację | P0 |
| CAL-V03 | Day | wykonanie, load, focus, prep/follow-up | plan dnia | P0 |
| CAL-V04 | List/Agenda | chronologiczny skan i mobile | podsumowanie | P0 |
| CAL-V05 | Today/navigation | dzisiaj, prev/next, date picker | brak | P0 |
| CAL-F01 | Source filters | Consultify, task, initiative, decision, Google, Outlook | brak | P0 |
| CAL-F02 | Ownership | any/assigned/owned | może wyjaśnić obciążenie | P0 |
| CAL-F03 | Project filter | jeden/wiele projektów zgodnie z dostępem | proponuje fokus | P1 |
| CAL-F04 | Search | tytuł, osoba, projekt, miejsce, source | semantic później | P1 |
| CAL-E01 | Create native event | termin, timezone, all-day, participants, location, conferencing | pomaga w agendzie | P0 |
| CAL-E02 | Edit/delete | zgodnie z ownerem i edit authority | pokazuje wpływ | P0 |
| CAL-E03 | Recurrence | preset + custom, instance/series decision | wykrywa ryzyka serii | P0/P1 |
| CAL-E04 | Attendee RSVP | accept/tentative/decline zgodnie z providerem | proponuje odpowiedź, nie wysyła | P1 |
| CAL-E05 | Drag/resize | proposal → conflict check → owner/provider write | ocenia wpływ | P0 |
| CAL-E06 | Duplicate | nowy event z nowym identity | brak | P1 |
| CAL-E07 | Focus block | chroniony czas na task/initiative | dobiera długość | P0 |
| CAL-E08 | Prep/follow-up | powiązane bloki przed/po meetingu | generuje propozycję | P1 |
| CAL-L01 | Task deadline | marker terminu owner object | ostrzega o braku work block | P0 |
| CAL-L02 | Task work block | konkretna rezerwacja czasu | rozkłada pracę | P0 |
| CAL-L03 | Decision slot | czas na przygotowanie/rozstrzygnięcie | wykrywa brak slotu | P0 |
| CAL-L04 | Milestone/review | projekcja Initiatives/Execution | wykrywa spiętrzenie | P0 |
| CAL-L04A | Long-project context | projekt wielotygodniowy jako kropki/prowadnica i markery, nigdy gruby all-day bar | pokazuje najbliższy milestone | P0 |
| CAL-L05 | Meeting link | otwiera Meeting, nie kopię | briefing i follow-up | P1 |
| CAL-C01 | Double booking | konflikt busy/busy z severity | sugeruje alternatywy | P0 |
| CAL-C02 | Capacity load | planned work vs availability | analizuje overload | P0 |
| CAL-C03 | Deadline risk | brak czasu przed deadline | proponuje rozłożenie | P0 |
| CAL-C04 | Travel/buffer | bufor między eventami | propozycja | P1 |
| CAL-C05 | Working hours | respektuje dostępność i dni wolne | nie planuje poza polityką | P1 |
| CAL-A01 | Plan my day | preview planu, bez automatycznych writes | główna funkcja | P0 |
| CAL-A02 | Plan my week | priorytety, capacity, ryzyka | główna funkcja | P1 |
| CAL-A03 | Find time | wspólna dostępność i constraints | ranking slotów | P1 |
| CAL-A04 | Reschedule proposal | before/after, participants, deadlines | wymaga approval | P0 |
| CAL-A05 | Explain load | dlaczego dzień jest przeciążony | evidence-linked | P0 |
| CAL-S01 | Connect source | przejście do Integrations/OAuth | brak | P0 |
| CAL-S02 | Source status | last sync, lifecycle, recovery | wyjaśnia użytkownikowi | P0 |
| CAL-S03 | Manual refresh | async, bez wielokrotnego ticka | brak | P0 |
| CAL-S04 | Conflict resolution | compare and resolve | pomaga, nie rozstrzyga | P0 |
| CAL-S05 | Default write calendar | jawny wybór celu nowych eventów | rekomendacja | P0 |
| CAL-S06 | ICS feed | read-only fallback z tokenized URL/revoke | brak | P1 |
| CAL-N01 | Reminders | event/task/decision według owner policy | nie duplikuje powiadomień | P1 |
| CAL-N02 | Invitation changes | trafiają do Inbox, wymagają reakcji | podsumowuje zmianę | P1 |
| CAL-N03 | Sync/reauth alert | tylko actionable, deduplikowany | krok naprawczy | P0 |

## Zasady bez wyjątków

- `Add to calendar` tworzy prawdziwy event albo jawnie `Schedule task`; nie może pod niejasną nazwą tworzyć taska.
- Deadline i work block są różnymi pojęciami.
- Event zewnętrzny zachowuje provider identity i recurrence.
- Każde przeniesienie pokazuje target object oraz miejsce zapisu.
- Teresa nie zmienia kalendarza uczestników bez preview i zgody.
