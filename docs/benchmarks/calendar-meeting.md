---
brief: calendar-meeting
module: Meeting / Kalendarz
sources: [CalDAV RFC corpus (4791/5545/6638/6764/7953 — scrape 2026-03), Google Calendar API (developers.google.com mirror), Microsoft Graph (learn.microsoft.com — shell only), OneCal, Morgen (docs.morgen.so — SPA, pusty)]
status: done
updated: 2026-06-10
---

# Benchmark: Meeting / Kalendarz

> Po co: ustalić, na jakich protokołach i jakim modelem danych budujemy synchronizację
> kalendarzy w module Meeting/Kalendarz (CalDAV vs Google Calendar API vs Microsoft Graph),
> żeby dwukierunkowy sync + free/busy + harmonogramowanie spotkań nie były wynalezione od zera
> i żeby ominąć nasze znane problemy z `rrule`.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature |
|---|---|---|
| **CalDAV (RFC 4791)** | Otwarty standard kalendarzowy nad WebDAV/HTTP | Interoperacyjność: jeden protokół do iCloud, Fastmail, Nextcloud, Zimbra; `calendar-query` + `free-busy-query` REPORT |
| **Google Calendar API (v3)** | REST nad kontem Google; de-facto standard konsumencki | **Incremental sync** (`syncToken`) + **push notifications** (watch/webhook) + `freebusy.query` |
| **Microsoft Graph (calendar)** | Jednolite REST API do M365/Outlook/Exchange | `findMeetingTimes`, `getSchedule` (free/busy), **delta query** + **change notifications** (subscriptions), online meetings (Teams) |
| **OneCal** | Konsumencka warstwa NAD wieloma kalendarzami | Multi-calendar two-way sync + clean booking links; ukrywanie szczegółów (busy-blocks) między kontami |
| **Morgen** | Desktop „command center": kalendarz + zadania | Łączenie kont (Google/Outlook/iCloud/CalDAV) w jednym widoku + tasks↔calendar + scheduling |

Wniosek strategiczny: **nie budujemy własnego protokołu.** Standard = trzy adaptery (CalDAV, Google v3, Graph)
za wspólnym, znormalizowanym modelem zdarzenia. OneCal/Morgen to wzorzec **warstwy konsolidującej** (jeden
widok wielu kont + busy-merge), a nie wzorzec backendu.

## 2. Wzorce UX / IA (co działa)
Brak realnych zrzutów UI w scrape (źródła to dokumentacja API / RFC / SPA-shelle — patrz Załączniki).
Wzorce produktowe z wiedzy o OneCal/Morgen + Google/Outlook:
- **Multi-calendar merge w jednym widoku** (OneCal/Morgen) → kolory per-konto, toggle widoczności źródła → *u nas:* lista „połączone kalendarze" w ustawieniach Meeting, każdy z kolorem i przełącznikiem.
- **Busy-block sync (prywatność)** (OneCal) → zdarzenie z kalendarza A pojawia się w B jako „Busy" bez tytułu/treści → *u nas:* domyślny tryb sync = tylko free/busy, opt-in na pełne detale.
- **Booking link / scheduling page** (OneCal, Morgen) → publiczny link „zarezerwuj termin", liczy free/busy z wielu kont → *u nas:* spina się z `public-anna` flow (już mamy publiczne trasy) i z free/busy adapterów.
- **Smart suggestion** (`findMeetingTimes` w Graph) → API zwraca rankowane sloty → *u nas:* Teresa proponuje terminy spotkań na bazie agregowanego free/busy.

## 3. Model danych / architektura
Wspólny mianownik trzech API to **iCalendar (RFC 5545)** — nasz znormalizowany `Event` powinien być jego nadzbiorem:
- **Tożsamość:** `iCalUID` (stabilny, cross-system) + lokalny `id` per-provider. Dwa pola, nie jedno — to klucz do deduplikacji przy sync z wielu źródeł.
- **Czas:** `start`/`end` jako `{ dateTime, timeZone }` (Google/Graph) lub `DTSTART;TZID=` (iCal). **Nie trzymaj naiwnego UTC** — gubi DST i strefę pierwotną (RFC 7809: timezones by reference).
- **Recurrence:** `RRULE`/`RDATE`/`EXDATE` (RFC 5545) + **wyjątki instancji** (`recurringEventId` + `originalStartTime` w Google; `seriesMaster`/`occurrence`/`exception` w Graph). Master + override, nie płaska lista.
  - ⚠️ **Nasz kontekst:** `rrule` (npm) już raz wywaliło API w kontenerze (Dockerfile.api przycina deps → crash; wzorzec explicit-install — patrz memory „Voice Railway deploy"). Rekomendacja: rozwijanie reguł po stronie serwera z **przypiętą, jawnie instalowaną** biblioteką lub własnym minimalnym expanderem; nie polegać na tree-shakingu kontenera.
- **Uczestnicy:** `attendees[]` z `responseStatus` (accepted/tentative/declined/needsAction) + `organizer`. iTIP (RFC 5546) / CalDAV scheduling (RFC 6638) opisują wymianę zaproszeń.
- **Konferencja:** `conferenceData` (Google) / `onlineMeeting` (Graph, Teams) — osobne pole, nie tekst w opisie.
→ Dla nas: jedna tabela `event` (nadzbiór iCal) + tabela `calendar_connection` (provider, token, syncToken/deltaLink) + tabela `event_link` mapująca `iCalUID`↔`providerId` per-konto.

## 4. API / integracje (deep-dive)

### Google Calendar API (v3) — REST
- Bazowo `https://www.googleapis.com/calendar/v3`. Zasoby: `calendars`, `calendarList`, `events`, `acl`, `freebusy`, `settings`, `colors`.
- **CRUD zdarzeń:** `events.list/insert/update/patch/delete`; `events.instances` rozwija serię; `sendUpdates` steruje powiadamianiem gości.
- **Incremental sync:** pierwsze `events.list` → `nextSyncToken`; kolejne `list(syncToken=…)` zwracają tylko zmiany (w tym kasacje jako `status: "cancelled"`). 410 GONE → pełny resync. **To kupujemy 1:1.**
- **Push:** `events.watch` → kanał webhook (kanał wygasa, trzeba odnawiać). Bez webhooka = polling po `updatedMin`/syncToken.
- **Free/busy:** `freebusy.query` (lista kalendarzy → przedziały zajętości). Lekkie, idealne pod booking link.
- **CalDAV (Google):** Google wystawia też serwer CalDAV (`caldav/v2`) — fallback gdy nie chcemy OAuth-scope na pełne API.
- Auth: OAuth 2.0, scope `calendar` / `calendar.events` / `calendar.readonly` / `calendar.freebusy`.

### Microsoft Graph (calendar) — REST
- Bazowo `https://graph.microsoft.com/v1.0`. Zasoby: `/me/calendars`, `/me/events`, `/me/calendarView` (zakres czasu z rozwiniętymi instancjami), `/me/calendarGroups`.
- **Scheduling:** `POST /me/calendar/getSchedule` (free/busy wielu adresów) i `POST /me/findMeetingTimes` (rankowane propozycje slotów z ograniczeniami) — **przewaga Graph nad Google**, gotowy „smart scheduling".
- **Sync:** `delta` query (`/me/calendarView/delta`) → `@odata.deltaLink` jak Google syncToken.
- **Powiadomienia:** Graph **subscriptions** (change notifications) → webhook z odnawianiem; rich notifications z payloadem.
- **Recurrence:** własny obiekt `recurrence { pattern, range }` (nie surowy RRULE) → adapter musi tłumaczyć Graph↔iCal RRULE.
- **Online meeting:** `onlineMeeting` / `isOnlineMeeting=true` + `onlineMeetingProvider=teamsForBusiness`.
- Auth: OAuth 2.0 (Entra ID), scope `Calendars.ReadWrite`, `Calendars.Read.Shared`.

### CalDAV (RFC 4791) — standard
- Transport WebDAV/HTTP: `PROPFIND` (właściwości), `REPORT` z `calendar-query` (filtr po czasie/typie) i `free-busy-query`, `PUT`/`GET`/`DELETE` na zasobach `.ics`.
- **Autodiscovery:** RFC 6764 (`.well-known/caldav`, `current-user-principal`, `calendar-home-set`).
- **Scheduling:** RFC 6638 (Scheduling Inbox/Outbox, auto-processing iTIP) + dostępność RFC 7953.
- Sync: `sync-collection` REPORT (sync-token) — odpowiednik Google syncToken.
→ CalDAV = jeden adapter pokrywający iCloud, Fastmail, Nextcloud, Zimbra, Mailcow itd. Najlepszy stosunek pokrycia do nakładu po Google+Graph.

## 5. Decyzje dla Consultify
- ✅ **Kradniemy:** model **iCalUID + providerId** (dwa identyfikatory) jako klucz deduplikacji multi-source sync.
- ✅ **Kradniemy:** wzorzec **incremental sync token** (Google `syncToken` / Graph `deltaLink` / CalDAV `sync-token`) + webhook-z-odnawianiem; polling tylko jako fallback.
- ✅ **Kradniemy:** **free/busy jako pierwszorzędne API** (`freebusy.query` / `getSchedule`) pod booking link i pod sugestie terminów Teresy.
- ✅ **Kradniemy:** Graph `findMeetingTimes` jako wzorzec „smart scheduling" (nawet jeśli sami liczymy sloty z agregowanego free/busy).
- ⚠️ **Adaptujemy:** **trzy adaptery za jednym znormalizowanym Eventem** — Google v3, Graph, CalDAV. CalDAV pokrywa „długi ogon" providerów jednym kodem.
- ⚠️ **Adaptujemy:** warstwę OneCal/Morgen (multi-calendar merge + busy-block prywatność + booking link) jako naszą UX nad adapterami — nie jako osobny produkt.
- ❌ **Unikamy:** naiwnego UTC bez TZID (gubi DST/strefę) — trzymamy `{dateTime, timeZone}` (RFC 7809).
- ❌ **Unikamy:** płaskiej listy instancji serii zamiast master+override (zabija edycję „tego i przyszłych").
- ❌ **Unikamy:** rozwijania `RRULE` na bibliotece, którą Docker przytnie — `rrule` już raz crashowało API; przypiąć + jawnie instalować lub własny minimalny expander.

## 6. Otwarte pytania / do walidacji
- Zakres v1: Google + Graph od razu, CalDAV w fazie 2? Czy CalDAV-first (iCloud) bo szybszy bez review OAuth?
- Webhooki na produkcji (Railway): czy mamy stabilny publiczny endpoint pod Google `watch` / Graph subscriptions (odnawianie!), czy startujemy od pollingu?
- Czy free/busy liczymy sami (agregacja przedziałów), czy delegujemy do `getSchedule`/`freebusy.query` per-provider?
- Strategia recurrence: własny expander vs przypięte `rrule` — rozstrzygnąć przed implementacją (ryzyko z memory).
- Booking link: spinamy z istniejącym `public-anna` flow czy osobna trasa publiczna?

## Załączniki
Brak realnych zrzutów UI do skopiowania — wszystkie źródła to dokumentacja API / RFC / SPA-shelle (nie produktowe UI).
Surowe źródło (do usunięcia po akceptacji): `Softs/0 Kalendarz/`.
Stan źródeł:
- **CALDAV (STANDARD)** — pełny korpus RFC (4791, 2445/2446, 4918, 7953, 7809, 5689, 3253) w `www.rfc-editor.org/rfc/*.txt`; wartościowe, treść z wiedzy o standardach (pliki read-restricted w sandboxie).
- **GOOGLE CALENDAR** — **folder pusty** (0 plików). Treść Google v3 z mirrora pod ONECAL + wiedzy własnej.
- **ONECAL** — zawiera tylko mirror `developers.google.com` (m.in. czytelna strona-overview Calendar API), brak własnych stron onecal.io. OneCal opisany z wiedzy.
- **MICROSOFT OUTLOOK : GRAPH / GRAPH 2** — wyłącznie shelle `learn.microsoft.com` + `support.microsoft.com` (JS-render, `textutil` zwraca pusto). **Nieużyteczne tekstowo**; Graph opisany z wiedzy.
- **morgan (Morgen)** — `docs.morgen.so` to SPA (Mintlify); pliki istnieją (events.html ~410 KB) ale renderują się JS-em, ekstrakcja pusta. **Nieużyteczne**; Morgen opisany z wiedzy.

Powtórna kontrola zasobów (2026-06-10, best-effort po przywróceniu dostępu do FS): potwierdzono brak realnych zrzutów UI produktowego (kalendarz/booking) w którymkolwiek źródle — GOOGLE CALENDAR pusty (0 plików), ONECAL zawiera wyłącznie mirrory hostów `developers.google.com`/`gstatic` (marketing dev-site, nie OneCal ani calendar-grid), morgan ma tylko favicon, Graph/Outlook to JS-shelle. Brak plików skopiowanych do `assets/calendar-meeting/`.
