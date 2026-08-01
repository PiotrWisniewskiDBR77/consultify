---
doc_kind: PRODUCT_FUNCTION_REVIEW
module_id: MODULE_MY_WORK
function_id: MW_INBOX
status: REVIEW
last_updated: 2026-07-31
---

# My Work — Inbox

## 1. Misja

Inbox jest osobistą kolejką uwagi i reakcji. Zbiera wyłącznie zdarzenia, które użytkownik powinien zobaczyć, rozstrzygnąć, zaplanować, przekazać albo świadomie odłożyć. Nie jest kopią wszystkich zmian w systemie ani drugim właścicielem tasków, decyzji i inicjatyw.

Najważniejsze pytanie Inboxa brzmi: `Co wymaga teraz mojej uwagi i jaka jest następna bezpieczna akcja?`

## 2. Co trafia do Inboxa

- przypisanie lub istotna zmiana taska;
- prośba o decyzję, approval, review lub akceptację;
- mention, komentarz lub odpowiedź wymagająca reakcji;
- escalation, blocker, SLA breach i krytyczne ryzyko;
- zaproszenie/zmiana spotkania lub kalendarza wymagająca RSVP;
- system/integration alert wymagający działania;
- istotna rekomendacja Teresy, jeżeli spełnia próg jakości;
- FYI o wysokiej wartości, ale w oddzielnej sekcji.

Nie trafiają: każda edycja pola, własna czynność użytkownika, techniczny log, powtarzający się identyczny alert, reklama funkcji ani insight bez wskazanego znaczenia.

## 3. Jeden obiekt, wiele źródeł

`InboxItem` jest projekcją uwagi. Przechowuje source entity reference i lokalny stan triage, ale nie kopiuje kanonicznego lifecycle obiektu. Ten sam task może wygenerować kolejne zdarzenie tylko, gdy zaszła materialna zmiana po zamknięciu poprzedniego itemu.

## 4. Semantyka stanów

| Oś | Wartości | Znaczenie |
| --- | --- | --- |
| attention | unread/read | czy użytkownik zapoznał się z itemem |
| triage | open/snoozed/saved/dismissed/done | co użytkownik zrobił z wpisem |
| source | owner-specific | faktyczny stan taska/decyzji/etc. |
| sync | pending/in_sync/conflict/failed | czy akcja została potwierdzona przez ownera |

`Read` nie oznacza `Done`. `Dismissed` usuwa wpis z bieżącej uwagi, ale nie usuwa źródła. `Done` oznacza wykonanie reakcji inboxowej, a nie automatycznie ukończenie taska. `Saved` to świadome zachowanie do późniejszego powrotu bez terminu; `Snoozed` wraca w określonym czasie lub po istotnej nowej aktywności.

## 5. Główna nawigacja

- taby: `Do działania`, `Oczekujące`, `Zapisane`, `FYI`, opcjonalnie `Wszystkie`;
- smart sections: Decisions, Approvals, Assigned work, Blockers/Escalations, SLA/Overdue, Mentions, AI insights, System;
- widok `compact` jako domyślny, `detailed` dla kontekstu;
- preview po prawej lub drawer na małych ekranach;
- search i filtry są dostępne, ale nie dominują pierwszego ekranu.

## 6. Triage

Podstawowe akcje: `Otwórz`, `Dziś`, `Ten tydzień`, `Zaplanuj`, `Deleguj`, `Snooze`, `Zapisz`, `Done`, `Dismiss`. Dostępne akcje zależą od typu źródła i uprawnień. Bulk działa tylko dla semantycznie zgodnych elementów i zawsze pokazuje liczbę oraz skutek.

## 7. Teresa

Teresa może wyjaśnić item, przygotować krótki brief, określić dlaczego go widzimy, zasugerować priorytet/sekcję/następny krok, wykryć duplikaty i przygotować batch triage preview. Nie może samodzielnie delegować, podejmować decyzji, akceptować approval, zmieniać deadline'u ani usuwać itemu.

## 8. Dokumenty pakietu

- [kompletny katalog funkcji](INBOX_COMPLETE_FUNCTION_CATALOG.md);
- [źródła, synchronizacja, routing i deduplikacja](INBOX_SOURCES_SYNCHRONIZATION_AND_ROUTING_CONTRACT.md);
- [UX, triage, Teresa i minimalizm](INBOX_UX_TRIAGE_AND_AI_STANDARD.md);
- [AS-IS, MVP i golden flows](INBOX_AS_IS_MVP_GAPS_AND_QUESTIONS.md).

## 9. Benchmark

Dojrzałe produkty traktują Inbox jako centrum uwagi, nie bazę danych: Linear oferuje szybkie skróty, snooze i pracę na źródłowym issue; Asana łączy detail preview, follow-up, bookmark/archive i saved views; Slack rozdziela dense/detailed oraz custom views; Teams filtruje activity po typie. Consultify przyjmuje te wzorce i dodaje owner read-back, SLA, decyzje i governance AI. Źródła: [Linear Inbox](https://linear.app/docs/inbox), [Asana Inbox](https://help.asana.com/s/article/inbox), [Slack Activity](https://slack.com/help/articles/19693583638803-Get-your-work-done-from-the-Activity-view), [Teams Activity](https://support.microsoft.com/en-us/teams/chat-channels/explore-the-activity-feed-in-microsoft-teams).
