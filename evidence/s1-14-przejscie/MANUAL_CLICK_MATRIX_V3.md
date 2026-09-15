# M2 v3 — pełna matryca kontrolek Pomysły / Notatnik / Dokumenty

Pomiar: 2026-09-15 CDT, konto Irina Lebedjuk, organizacja Northwind, runtime staging `dcbd6c052a` oraz lokalny kandydat M2 dla naprawy Dokument → Zadanie. `PASS` oznacza realne wywołanie i widoczny skutek. `OPENED` oznacza otwarcie menu/panelu bez zatwierdzenia zapisu. `NOT_TESTED` oznacza świadome niewykonanie operacji zapisującej lub destrukcyjnej po Wpisie 78 (`ZAKAZ zapisu na stagingu bez zlecenia CTO`). `NOT_PROVEN` oznacza brak wiarygodnego skutku.

## Pomysły

| Obszar | Kontrolka | Wynik | Zachowanie |
|---|---|---:|---|
| Menu 1 | Table | PASS | układ tabeli |
| Menu 1 | Grid | PASS | układ kafelków |
| Menu 1 | All / Spark / Growing / Shaping / Ready / Promoted | PASS 6/6 | każdy filtr zmienił zbiór |
| Menu 1 | Folder filter | OPENED | lista folderów; `New folder…` otworzył formularz, anulowano |
| Menu 1 | New Idea | OPENED | pełny formularz idei, anulowano |
| Menu 2 | Sort: Title / Stage / Tags / Tool | PASS 4/4 | sortowanie przełączone |
| Menu 2 | Sort: Updated | NOT_PROVEN | klik zakończył się otwarciem preview, brak pewnego dowodu sortowania |
| Menu 2 | Filter: Stage / Tags / Tool | OPENED 3/3 | każdy panel filtra widoczny |
| Menu 2 | View settings | OPENED | panel ustawień widoku |
| wiersz | Star | PASS | włączono i wyłączono; stan wrócił do bazowego |
| wiersz | Stage | OPENED | lista etapów; wybrano ponownie stan Promoted |
| wiersz | Open preview | PASS | kanoniczny panel boczny |
| karta/menu | Open / Edit | PASS | otwarcie warsztatu idei |
| karta/menu | Process Flow | DEFECT → M6 | istniejąca idea wraca do Mind Map |
| karta/menu | AI Chat / AI Insights | PASS 2/2 | prawy panel Teresy z kontekstem; bez wysłania wiadomości |
| karta/menu | Initiative / Decision / Presentation / Report | DEFECT → M6 | serwer odpowiada, UI tylko ogólne `Done`, bez ID/linku |
| karta/menu | Tasks | PASS | trzy zadania z tytułem, UUID, właścicielem |
| karta/menu | Team Chat | PASS | utworzona rozmowa i nawigacja do `/chat/<id>` |
| karta/menu | Folder | DISABLED | uczciwie niedostępne bez folderu |
| karta/menu | Delete | OPENED | potwierdzenie widoczne; usunięcia nie zatwierdzono |

## Notatnik — lista

| Obszar | Kontrolka | Wynik | Zachowanie |
|---|---|---:|---|
| Menu 1 | All / Personal / Organization | PASS 3/3 | każdy filtr zakresu wywołany |
| Menu 1 | New notebook | OPENED | Personal i Organization sprawdzone; Organization pokazał `No teams available`; anulowano |
| Menu 2 | Sort Notebook / Type / Notes / Updated | PASS 4/4 | każde sortowanie wywołane |
| Menu 2 | Context filter | PASS | Private zastosowany, potem filtr wyczyszczony |
| Menu 2 | View settings | OPENED | panel ustawień widoku |
| kebab | Open preview | PASS | otworzył podgląd notatnika `My notes` |
| kebab | Open | PASS | otworzył `Steering group — Operational Excellence` |
| kebab | Edit | PASS | ta sama powierzchnia edytowalna |
| kebab | Delete | OPENED | bramka potwierdzenia; bez zatwierdzenia |

## Notatnik — wnętrze i prawy panel

| Obszar | Kontrolka | Wynik | Zachowanie |
|---|---|---:|---|
| Menu 1 | All / Inbox / Active | PASS 3/3 | przełączenie statusu listy |
| Menu 1 | Search notes | PASS | modal `Search all notebooks`; zamknięty |
| Menu 1 | New note | OPENED | 8 szablonów i Upload file widoczne; bez nowego zapisu |
| filtr listy | All / Pinned / Recent / To review / Fresh / Orphaned | PASS 6/6 | każdy stan wywołany, finalnie All |
| wiersz More | Pin / Unpin | PASS | licznik 0→1→0, stan przywrócony |
| wiersz More | Archive | NOT_TESTED | zapis stanu na stagingu zakazany Wpisem 78 |
| prawy panel | Open side panel | PASS | Actions, Properties, Relations, Sources, Comments, History; panel zamknięty |
| edytor | Block actions | OPENED | Duplicate, Move up/down, Delete oraz pełna paleta widoczne |
| edytor | Insert block below | OPENED | H1/H2/H3, listy, quote, callout, warning, toggle, divider, code, image, date, columns, table, AI i Create widoczne |
| edytor | Add cover | NOT_TESTED | zapis na stagingu zakazany Wpisem 78 |
| edytor | Change page icon | OPENED | Remove + 30 ikon widocznych; bez zmiany |
| edytor | Attachments | OPENED | dropzone i limit 25 MB widoczne; bez uploadu |
| edytor | Create Task | PASS | trzy zadania z trwałym readbackiem |
| edytor | Create Decision / Save as Idea | NOT_TESTED | tworzą rekord na stagingu |
| menu notatki | Export: Markdown / PDF / Word | NOT_PROVEN | submenu wywołane; pobrania po timeout/reset nie potwierdzono |
| menu notatki | Version history | PASS | jedna wersja i przycisk Restore widoczne |
| menu notatki | Sources & attachments | NO_VISIBLE_CHANGE | wywołane; brak nowego odróżnialnego panelu przy już otwartych Attachments |
| menu notatki | Verification & review | NOT_TESTED | może zmieniać stan review |
| menu notatki | Share | OPENED_ONLY | pozycja istnieje; wysyłki/udostępnienia nie wykonano |
| menu notatki | Expand into document | NOT_TESTED | tworzy dokument na stagingu |
| menu notatki | Connection graph | OPENED w poprzednim przebiegu | graf bez zapisu |
| menu notatki | Initiative / Task / Decision | DISABLED 3/3 | komunikat o braku durable action receipt |
| menu notatki | Idea / Assessment / Report / Presentation | NOT_TESTED 4/4 | tworzą rekordy na stagingu |
| menu notatki | Ask AI | OPENED_ONLY | bez wysłania wiadomości |
| menu notatki | Delete note | OPENED | potwierdzenie; bez zatwierdzenia |

## Dokumenty

| Obszar | Kontrolka | Wynik | Zachowanie |
|---|---|---:|---|
| Menu 1 | Project documents / My documents | PASS 2/2 | Project bez projektu ma uczciwy empty state; My documents pokazuje trzy pliki |
| Menu 1 | Upload | PASS (wcześniej) | testowy, niesensytywny TXT, status Ready, 1 chunk |
| wiersz | Refresh document status | PASS | zmienił czas odświeżenia |
| wiersz | Download | NOT_PROVEN | kontrolka widoczna; brak potwierdzonego pliku pobrania |
| wiersz | Delete | OPENED_ONLY | bez zatwierdzenia usunięcia |
| wiersz | Create task | PASS 3/3 na lokalnym kandydacie | trzy odrębne zadania; stabilny idempotency key; staging przed M2 nie miał tej kontrolki |
| karta zadania | Source | PASS w kandydacie | owner scoped API zwraca `document` + UUID; karta pokazuje `Document/Dokument` |
| karta zadania | Link źródła | PASS w teście komponentu | emituje `mywork-open-item` z `type=document`, dokładnym `sourceId` |

## Zapisy wykonane przed zakazem z Wpisu 78

Lokalny frontend kandydata był połączony z API stagingu i utworzył w Northwind, jako Irina Lebedjuk, trzy angielskie zadania dokumentowe:

- `ad9124b4-1fc8-4210-a531-a88edf504512`
- `e0fafe06-08f9-4536-a894-0a11b95df68f`
- `554f155d-1b54-46a4-9609-66e30547ea30`

Po Wpisie 78 nie wykonano żadnego nowego zapisu na stagingu.
