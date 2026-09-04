# Dyżur 361 — R3: co można zamknąć maszynowo

Wynik: **zero wierszy zamykalnych maszynowo w granicach tego dyżuru**. Kontener `cx-day361-pg` nie został uruchomiony, ponieważ triaż nie wykazał gotowego, indywidualnego przypadku, którego wykonanie domknęłoby cały obowiązek G19 danego modułu.

| Moduł | Dlaczego wiersz nie jest teraz zamykalny maszynowo |
| --- | --- |
| `02_INTERVIEW` | Najpierw trzeba zbudować scenariusz wykonujący, zamiast mockować, `NModeLeftNav` oraz prawdziwe prymitywy formularza na realnym rekordzie rozmowy; pojedyncza para HTTP nie pokryje tej luki UI. |
| `03_TOOLS` | Istnieje scenariusz komponentowy, ale do zlecenia pozostaje realna para `GET/PUT /api/tools/:toolId` przez ApiGateway/JWT/PG z filtrem `ToolController.ts:1205-1206` oraz mutacją tego filtra. Samo uruchomienie testu DOM nie zmieni stanu G19. |
| `07_MY_WORK_AGENT` | Brak scenariusza wykonującego wspólną nawigację w realnym rekordzie zadania/decyzji/powiadomienia; trzeba najpierw określić jeden odbiorowy rekord i warunkową gałąź. |
| `09_RESULTS` | Brak scenariusza łączącego realny raport, `HelpButton`, `ErrorState` i PL/EN; istniejące testy nie wykonują tego przekroju. |
| `10_FINANCE` | Brak scenariusza realnego rekordu finansowego sprawdzającego zmienione treści i stany warunkowe w obu językach. |
| `12_AUDITS` | Istnieją osobne testy lokalnych stanów, ale zmieniony `MultiSelect` jest mockowany i brak scenariusza całego realnego audytu. |
| `14_ADMIN` | Brak scenariusza realnego konta admin łączącego pomoc, błąd, dane warunkowe i oba języki. |
| `15_SETTINGS` | Testy formularzy testują atrapy albo nie istnieją; brak przypadku na realnych ustawieniach. |
| `16_PARTNER` | Brak scenariusza realnego rekordu partnera w PL/EN; sama obecność tras V8 nie jest dowodem wykonania. |

Nie ustawiono żadnego stanu macierzy. Nie wykonano mutacji kodu produktu. Nie ogłoszono wyniku testowego, więc pomiar nazw przypadków `przed/po` nie ma zastosowania w R3.
