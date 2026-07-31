---
doc_kind: INTEGRATION_CONTRACT
function_id: MW_CALENDAR
status: REVIEW
last_updated: 2026-07-31
---

# Calendar — synchronizacja i interoperacyjność

Nadrzędnym kontraktem sposobu podłączania providerów jest
[`UNIVERSAL_CONNECTOR_PLATFORM_MCP_LIKE_STANDARD.md`](UNIVERSAL_CONNECTOR_PLATFORM_MCP_LIKE_STANDARD.md).
Calendar konsumuje capability gateway; nie buduje własnego token store ani osobnego onboardingu per provider.

## 1. Dostawcy i zakres

| Provider | Wave 1 | Odczyt | Zapis | Tryb |
| --- | --- | --- | --- | --- |
| Google Calendar | tak | tak | tak przy scope/write | bounded bidirectional |
| Microsoft 365 / Outlook | tak | tak | tak przy scope/write | bounded bidirectional |
| CalDAV / Apple-compatible | tak | tak | nie w Wave 1 | read-only |
| ICS subscription | fallback | publikacja feedu Consultify | brak import write-back | one-way export |

ICS nie może być przedstawiany jako synchronizacja dwukierunkowa. Apple Calendar w Wave 1 korzysta z CalDAV/ICS zgodnie z realnymi możliwościami połączenia.

## 2. Źródła prawdy

| Dane | Canonical owner | Reguła |
| --- | --- | --- |
| zewnętrzny event | provider | lokalny mirror + conditional write |
| natywny event Consultify | Calendar/Meeting | write do provider tylko po wyborze celu |
| task/decision/milestone | owner module | calendar projection nie kopiuje lifecycle |
| connection/token | Integrations | Calendar przechowuje connection reference, nigdy token plaintext |
| sync checkpoint | Calendar sync runtime | osobny per provider/account/calendar/window |

## 3. Tożsamość i antyduplikacja

Każdy wpis ma `calendarItemId`, provider, account/source ID, calendar ID, provider event ID, iCalendar UID jeśli dostępny, series master ID, source object reference, transaction/idempotency ID i etag/change key. Unikalność jest co najmniej po `(organization, source, providerEventId)`.

Create używa stabilnego idempotency key. Retry po timeout nie tworzy drugiego eventu. Import tego samego eventu przez dwa źródła nie jest automatycznie scalany bez bezpiecznego identity match.

## 4. Algorytm synchronizacji

1. initial full sync w kontrolowanym oknie;
2. zapis checkpointu/cursora;
3. incremental sync cykliczny oraz po webhooku;
4. paginacja do końcowego tokenu;
5. upsert zmian i cancellations;
6. nowy checkpoint dopiero po poprawnym zakończeniu partii;
7. invalid cursor → source `recoverable`, kontrolowany full resync;
8. po sukcesie `lastOkAt`, freshness i audit.

Google używa sync tokenów; nieważny token wymaga pełnej synchronizacji. Microsoft Graph używa osobnych delta linków dla kalendarza i zakresu. Webhook jest sygnałem do pobrania zmian, a nie kompletną treścią prawdy. Źródła: [Google incremental sync](https://developers.google.com/workspace/calendar/api/guides/sync), [Google push notifications](https://developers.google.com/workspace/calendar/api/guides/push), [Microsoft Graph delta query](https://learn.microsoft.com/en-us/graph/delta-query-events).

## 5. Zapisy i konflikty

- update/delete wymaga aktualnego etag/change key;
- mismatch tworzy `syncState=conflict`, bez overwrite;
- conflict UI pokazuje wersję lokalną, zewnętrzną, różnice i skutki;
- opcje: przyjmij zewnętrzną, ponów moją na aktualnej wersji, utwórz kopię, anuluj;
- seria cykliczna wymaga wyboru `this event`, `this and following` jeśli provider wspiera, albo `entire series`;
- zmiana z uczestnikami pokazuje politykę wysyłania aktualizacji przed wykonaniem.

## 6. Recurrence

- przechowujemy master i regułę, nie eksplodujemy serii na stałe;
- occurrences materializujemy tylko w query window;
- exceptions i cancelled instances zachowują własną tożsamość;
- nieznana/niepoprawna reguła jest `blocked` i renderowana z ostrzeżeniem;
- edycja instance nie może nadpisać mastera;
- zmiana timezone nie może przesunąć `floating time` bez jawnej reguły.

## 7. Czas i strefy

- timed event: instant start/end + IANA timezone;
- all-day: local date range, end exclusive, bez przeliczania przez UTC midnight;
- UI pokazuje strefę wydarzenia, gdy różni się od strefy użytkownika;
- DST, podróż i zmiana strefy mają testy graniczne;
- domyślna strefa organizacji nie nadpisuje strefy user/event.

## 8. Uprawnienia

| Gradient | Widok | Edycja |
| --- | --- | --- |
| free_busy | tylko `Busy`, czas i źródło w dozwolonym zakresie | brak |
| read | szczegóły według provider ACL | brak |
| write | edit owned items | conditional write |
| delegate | edit on behalf of | pokazuje osobę delegującą i audit |

ACL jest egzekwowane backendowo. Ukrycie przycisku nie jest zabezpieczeniem.

## 9. Lifecycle źródła

`connected`, `degraded`, `requires_action`, `recoverable`, `blocked`.

- OAuth expired/revoked → `requires_action` + reauth;
- rate limit → `degraded` + backoff;
- invalid cursor → `recoverable` + resync;
- missing scope → `blocked/requires_action` z listą braków;
- permanent auth failure → `blocked`;
- żadna awaria nie aktualizuje fałszywie freshness.

## 10. Sync z modułami Consultify

- Task: deadline i work blocks; drag block proponuje zmianę planu, nie zawsze deadline'u;
- Decision: deadline/review slot; decyzja pozostaje w Decisions;
- Initiative/Execution: milestones, gates, reviews i capacity context;
- Meeting: event, uczestnicy, agenda, briefing, notes/output;
- Notifications: reminders, sync failures, conflicts i reauth;
- My Work Inbox: zaproszenia/zmiany wymagające reakcji;
- Settings/Admin: connections, scopes, default calendar, policies i audit.

## 11. Obserwowalność

Per source: last attempt, last success, cursor age, items processed, conflicts, retries, rate limits, webhook/subscription expiry. Użytkownik widzi tylko potrzebny status i krok naprawczy; administrator widzi diagnostykę i trace ID bez sekretów.
