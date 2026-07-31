---
doc_kind: UI_UX_DECISION_CONTRACT
function_id: MW_NOTEBOOK
status: REVIEW
last_updated: 2026-07-31
---

# Notes — prawy panel i standard minimalizmu

## 1. Decyzja

Prawy panel pozostaje jednym opcjonalnym panelem o dwóch zakładkach:

1. `Teresa` — rozmowa i kontekstowe propozycje dotyczące bieżącej strony lub zaznaczenia;
2. `Powiązania` — istniejące relacje, backlinki, outputy i świadome dodawanie referencji.

Panel jest domyślnie zamknięty, pamięta ostatnią zakładkę i nigdy nie jest niezbędny do napisania, zapisania, opuszczenia ani odnalezienia notatki. Szerokość desktopowa jest stała w rozsądnym przedziale; na węższych ekranach panel staje się drawerem z jawnym `Zamknij`.

## 2. Problem AS-IS

`NotebookRightRail` scala dwa panele, ale zakładka `Praca` nadal agreguje zbyt wiele klas funkcji. `AIChatInlinePanel` zawiera równocześnie:

- szybkie akcje AI i pełny chat;
- transformacje tekstu;
- wstawianie callout, warning, toggle, tabeli i dividera;
- pole swobodnej komendy, również głosowej;
- konwersje do Initiative, Task, Decision, Idea, Assessment, Report i Presentation;
- maturity, summary, datę, liczbę słów i visibility;
- delete i inne akcje strony.

Zakładka `Kontekst` jednocześnie pokazuje:

- `Used in` i backlinki;
- linked outputs;
- sugerowane Ideas, Initiatives, Tasks, Decisions i Notes;
- insert/open/browse dla każdej sekcji.

Konsolidacja techniczna już nastąpiła, ale konsolidacja znaczeniowa nie. Panel ma za dużo powtarzających się sekcji, opcji i decyzji o różnej wadze.

## 3. Zasada lokowania funkcji

| Rodzaj działania | Docelowe miejsce | Nie powinno być w railu |
| --- | --- | --- |
| formatowanie zaznaczenia | bubble toolbar | stała lista formatów |
| dodawanie bloku | slash menu / `+` bloku | callout/table/divider jako osobna sekcja |
| operacje strony | menu `…` w nagłówku | delete, visibility, cover |
| status i verification | nagłówek/metadane strony | powtórzona karta informacyjna |
| AI na zaznaczeniu | małe menu inline | długa lista zawsze widocznych transformacji |
| rozmowa z Teresą | zakładka `Teresa` | drugi równoległy chat |
| tworzenie outputu | jeden `Utwórz z notatki` | siedem równorzędnych kafli |
| relacje i backlinki | zakładka `Powiązania` | sugestie udające istniejące relacje |
| historia/źródła | zwijana sekcja nagłówka lub menu strony | stale zajmujący miejsce panel |

## 4. Zakładka Teresa

### Stan spoczynkowy

Pokazuje jedno pole rozmowy i maksymalnie trzy kontekstowe sugestie. Sugestie zależą od strony:

- pusta/krótka: `Pomóż mi zacząć`, `Zaproponuj strukturę`;
- długa: `Podsumuj`, `Znajdź luki`, `Wyodrębnij działania`;
- ma źródła: `Sprawdź zgodność ze źródłami`;
- ma działania: `Przygotuj output`;
- stale/disputed: `Pomóż zweryfikować`.

Nie pokazujemy niedostępnych lub nieadekwatnych akcji tylko po to, żeby demonstrować możliwości AI.

### Po wykonaniu polecenia

Wynik zawiera:

1. krótkie wyjaśnienie;
2. źródła/zakres użyty przez AI;
3. preview albo diff;
4. `Zastosuj`, `Zastosuj fragment`, `Spróbuj inaczej`, `Odrzuć`;
5. przy operacji wielomodułowej: wskazanie celu i brakujących pól.

Nie wolno wstawiać wyniku automatycznie jako callout. Teresa proponuje zmianę; użytkownik decyduje, czy ma ona zastąpić zaznaczenie, zostać wstawiona poniżej, utworzyć nową stronę czy output.

### Rozmowa globalna a lokalna

- rozmowa w railu ma scope bieżącej strony/zaznaczenia;
- pełny Chat może kontynuować wątek obejmujący wiele modułów;
- przy `Otwórz w Chat` przekazujemy jawny pakiet kontekstu i backlink, a nie kopiujemy ukrytej historii;
- w jednym momencie widoczna jest jedna powierzchnia rozmowy.

## 5. Zakładka Powiązania

Trzy sekcje, rozwijane tylko gdy mają treść:

### A. Powiązane

Jawne relacje: strony, Ideas, Initiatives, Tasks, Decisions i inne obiekty. Każdy wiersz: typ, tytuł, status, relacja, `Otwórz`, `Odłącz`. Dodanie przez jedno `+ Dodaj powiązanie` z wyszukiwarką wszystkich dozwolonych typów.

### B. Użyto w / Outputy

Backlinki i artefakty utworzone z tej strony. To dowód faktycznego użycia, nie sugestia. Pokazujemy status synchronizacji/read-backu oraz możliwość otwarcia celu.

### C. Sugestie

Domyślnie zwinięte, maksymalnie trzy wyniki z uzasadnieniem `Dlaczego`. Sugestia nie jest relacją. Akcje: `Połącz`, `Nie pokazuj`, `Zobacz wszystkie`. Brak automatycznego inserta do treści.

## 6. Jedna komenda outputu

`Utwórz z notatki` otwiera niewielki picker pogrupowany według rezultatu:

- `Zorganizuj pracę`: Task, Decision;
- `Rozwiń pomysł`: Idea, Initiative candidate;
- `Przygotuj materiał`: Document/Report, Presentation;
- `Uruchom analizę`: tylko dozwolone, sensowne procesy owner-module.

Picker pokazuje ostatnio używany i maksymalnie cztery najbardziej trafne cele. `Wszystkie` otwiera pełny katalog. `Assessment` nie może być prostą konwersją notatki, jeżeli właściciel Assessment nie ma kontraktu importu takiego draftu.

## 7. Progressive disclosure

Minimalizm oznacza hierarchię, nie usuwanie możliwości:

- poziom 0: czysty edytor;
- poziom 1: akcje potrzebne teraz;
- poziom 2: panel Teresa/Powiązania;
- poziom 3: pełny picker, historia, zaawansowane metadata;
- poziom 4: ustawienia administracyjne poza stroną.

Jeżeli funkcja jest dostępna w dwóch miejscach, jedno musi być skrótem prowadzącym do tego samego command handlera, nie drugą implementacją.

## 8. Reguły wizualne

- maksymalnie dwa główne taby i jeden dominujący CTA na widok;
- bez tęczy ikon: kolor semantyczny tylko dla statusu, ryzyka i wyniku;
- wiersze zamiast dużych kafli, gdy użytkownik skanuje więcej niż trzy elementy;
- liczniki tylko gdy wspierają decyzję;
- sekcje bez treści są ukryte albo mają pojedynczy empty state;
- brak zagnieżdżonych scrolli w railu;
- nagłówki i odstępy zgodne z kanonem sekcji 2026;
- tooltip wyjaśnia ikonę, ale podstawowa akcja ma tekst.

## 9. Zachowanie adaptacyjne

| Szerokość | Zachowanie |
| --- | --- |
| duży desktop | rail obok edytora, użytkownik może zamknąć |
| laptop | rail overlay/drawer, edytor nie staje się zbyt wąski |
| tablet | pełnoekranowy panel z back do strony |
| mobile | oddzielny ekran; zachowane zaznaczenie i draft rozmowy |

## 10. Kryteria odbioru

- nowy użytkownik tworzy i zapisuje stronę bez otwierania raila;
- formatowanie i bloki nie są duplikowane w prawym panelu;
- użytkownik znajduje każdą operację strony w jednym przewidywalnym miejscu;
- na pierwszym ekranie Teresy są maksymalnie trzy rekomendacje;
- istniejące relacje są wizualnie oddzielone od sugestii AI;
- wszystkie outputy przechodzą przez jeden preview i owner read-back;
- zamknięcie panelu nie kasuje zaznaczenia, draftu ani stanu strony;
- test użyteczności nie wykazuje zagnieżdżonego przewijania lub braku drogi wyjścia.
