---
doc_kind: UI_AI_CAPACITY_CONTRACT
function_id: MW_CALENDAR
status: REVIEW
last_updated: 2026-07-31
---

# Calendar — UX, Teresa i zarządzanie obciążeniem

## 1. Ekran

Toolbar: `Today`, prev/next, czytelny zakres, Month/Week/Day/List, `+`. Mini-calendar i źródła są w zwijanym lewym panelu. Event drawer pokazuje informacje, źródło, sync state, powiązany obiekt i działania zgodne z uprawnieniami.

Kolory rozróżniają źródło tylko pomocniczo; typ jest opisany ikoną/tekstem. Conflict, stale i blocked mają osobne sygnały. Free/busy zawsze renderuje `Busy`.

### Język projektów długotrwałych

| Obiekt | Reprezentacja |
| --- | --- |
| projekt/inicjatywa trwająca tygodniami | brak pełnego paska; neutralne kropki/lekka prowadnica zakresu |
| start projektu | mały znacznik `start` |
| milestone/gate | romb lub punkt z tooltipem |
| deadline | pojedynczy marker dnia |
| ryzyko projektu | badge przy markerze, nie czerwony pas przez cały zakres |
| zaplanowana praca | normalny blok czasu o realnym początku i końcu |

Prowadnica nie zajmuje toru wydarzeń, nie konkuruje z tekstem i znika po wyłączeniu źródła `Initiatives`. Projekt można wyróżnić przez hover/focus. W widoku Day nie pokazujemy prowadnicy — tylko realne bloki i markery.

## 2. Create flow

Pierwszy wybór: `Event`, `Focus block`, `Schedule task`, `Decision slot`, `Meeting`. Formularz zmienia pola według typu. Przed zapisem pokazuje conflicts/load i miejsce zapisu (`Consultify`, wybrany Google/Outlook calendar). Użytkownik widzi, czy uczestnicy otrzymają update.

## 3. Day/Week planning

Capacity nie jest liczbą eventów. Uwzględnia working hours, istniejące busy blocks, planowany wysiłek tasków, priorytet, deadline, buffer i chroniony focus. System nie udaje dokładności, gdy brak effort estimate lub source jest stale.

Teresa przedstawia plan w kolejności:

1. constraints i dostępny czas;
2. zobowiązania nieprzesuwalne;
3. priorytety i deadline risk;
4. proponowane bloki;
5. elementy, których nie da się zmieścić;
6. preview zmian i approval.

## 4. Konflikty

Typy: double booking, no time for priority, deadline without work block, decision without slot, missing prep/follow-up, overload, recurrence conflict, stale sync, write conflict. Każdy ma severity, dotknięte obiekty, źródła, wyjaśnienie i następny krok.

## 5. Minimalizm

- nie pokazujemy pełnej diagnostyki integracji w kalendarzu;
- brak stałego prawego panelu z rekomendacjami;
- Teresa pojawia się jako jedno kontekstowe wejście i preview planu;
- source filters zwinięte na małych ekranach;
- widok miesiąca nie pokazuje operacyjnych szczegółów tasków;
- event drawer ma jedno CTA adekwatne do stanu.

## 6. Dostępność

Agenda jest pełnoprawną alternatywą dla siatki. Każda operacja drag ma odpowiednik klawiaturowy/formularzowy. Screen reader otrzymuje datę, czas, typ, status i conflict. Focus order jest chronologiczny.

## 7. Benchmark funkcjonalny

Dojrzałe kalendarze rozróżniają wydarzenia, tasks i focus time, sprawdzają wiele kalendarzy przy dostępności oraz pokazują working constraints. Consultify przyjmuje te wzorce, ale dodaje owner-module governance i realną analizę capacity. Referencje: [Google focus time](https://support.google.com/calendar/answer/11190973), [Google Tasks in Calendar](https://support.google.com/calendar/answer/9901136), [availability across calendars](https://support.google.com/calendar/answer/16287054).
