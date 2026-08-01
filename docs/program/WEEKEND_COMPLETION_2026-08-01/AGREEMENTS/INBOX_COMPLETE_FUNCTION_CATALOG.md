---
doc_kind: FUNCTION_CATALOG
function_id: MW_INBOX
status: REVIEW
last_updated: 2026-07-31
---

# Inbox — kompletny katalog funkcji

| ID | Funkcja | Cel/zachowanie | Teresa | Priorytet |
| --- | --- | --- | --- | --- |
| IN-V01 | Action queue | rzeczy wymagające działania | ranking z wyjaśnieniem | P0 |
| IN-V02 | Waiting | wysłane/delegowane, oczekujące na ownera | wykrywa overdue | P1 |
| IN-V03 | Saved | świadomy powrót bez terminu | przypomina przy zmianie | P0 |
| IN-V04 | FYI | wartościowa informacja bez akcji | streszcza grupę | P0 |
| IN-V05 | Compact/detailed | szybki skan vs pełny kontekst | brak | P0 |
| IN-V06 | Flat/sections | chronologia albo smart sections | proponuje sekcję | P0 |
| IN-F01 | Status/section/type | jawne filtry | brak | P0 |
| IN-F02 | Project/person/source | znalezienie kontekstu | brak | P1 |
| IN-F03 | Action required | tylko realne wymagane reakcje | klasyfikacja z confidence | P0 |
| IN-F04 | Saved views | osobiste kombinacje filtrów | propozycje | P1 |
| IN-R01 | Read/unread | attention state | brak | P0 |
| IN-R02 | Open source | preview + deep link | brief źródła | P0 |
| IN-R03 | Today/week/later | dodanie do Focus/planowania | ocenia wykonalność | P0 |
| IN-R04 | Schedule | przejście do Calendar proposal | proponuje slot | P0 |
| IN-R05 | Delegate | owner command z komentarzem | proponuje osobę, nie deleguje | P1 |
| IN-R06 | Snooze | ukrywa do czasu/istotnej zmiany | rekomenduje termin | P0 |
| IN-R07 | Save | zachowanie do powrotu | brak | P0 |
| IN-R08 | Done | kończy reakcję inboxową | weryfikuje rezultat | P0 |
| IN-R09 | Dismiss | usuwa z uwagi, nie źródło | brak | P0 |
| IN-R10 | Undo | cofa triage w oknie bezpieczeństwa | pokazuje cofany skutek | P0 |
| IN-R11 | Bulk triage | zgodne akcje na wielu itemach | preview i exceptions | P0/P1 |
| IN-A01 | Explain | co to jest i dlaczego widzę | cytuje source/reason | P0 |
| IN-A02 | Brief | 2 zdania + 2–4 punkty | proposal | P0 |
| IN-A03 | Recommend action | allowed action + confidence | nigdy auto high-impact | P0 |
| IN-A04 | Prioritize | urgency/SLA/deadline/impact | explainable ranking | P0 |
| IN-A05 | Deduplicate | wykrywa podobne itemy | człowiek potwierdza merge | P1 |
| IN-A06 | Batch plan | plan triage z exceptions | approval przed wykonaniem | P1 |
| IN-S01 | SLA/aging | czas, breach/at-risk | ostrzega | P0 |
| IN-S02 | Source/sync | owner, freshness, pending/conflict | wyjaśnia błąd | P0 |
| IN-S03 | Why visible | reguła/subscription/role/event | generuje z danych, nie zgaduje | P0 |
| IN-S04 | Keyboard triage | J/K + jawne skróty akcji | brak | P0 |
| IN-S05 | Mobile gestures | swipe z undo | brak | P1 |
| IN-G01 | Notification preferences | kanały, digest, quiet hours | proponuje redukcję szumu | P1 |
| IN-G02 | Routing rules | admin/user bounded rules | symuluje wpływ | P1 |
| IN-G03 | Eval/golden set | mierzenie klasyfikacji AI | monitoring | P0 tech |

## Niezmienne reguły

- action availability pochodzi z owner contract, nie z typu ikony;
- mark read nie zmienia owner object;
- done/dismiss nie może ukryć nieudanego commandu;
- AI confidence nie zastępuje source evidence;
- bulk pokazuje dokładnie, ile elementów wykona się, pominie i dlaczego.
