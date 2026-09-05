# Odbiór na żywo — pakiet 01-czat (moduł Czat)

Zgodne: 10 / Różnią się: 2 / Nie dotarłem: 3 (razem 15)

## Różnice (1 zdanie każda)
- **chat-split-teresa-right** — układ D17 (artefakt lewo/Teresa prawo) zgodny, ale zestaw ikon paska kanwy w świeżym dokumencie różni się od obrazu (brak "Main"/share/save, jest globe/szablon).
- **chat-signals-feed** — układ panelu Ważne sygnały 1:1 zgodny, ale lista jest pusta z jawnym komunikatem "Producent sygnałów jest wyłączony" zamiast 9 realnych sygnałów z obrazu.

## Nie dotarłem (powód)
- **ntype-analizuj-ai** — wymaga wywołania AI, zakaz (instrukcja pakietu).
- **teresa-confirm-chip** — wymaga wywołania AI, zakaz (instrukcja pakietu).
- **mindmap-i18n-smoke** — modal "Dodaj dowód/źródło" nieosiągnięty: sekcja "DOWODY I ŹRÓDŁA 0" w panelu właściwości węzła mapy myśli nie reagowała na kliknięcia w automacie (zostawała zwinięta).

## Czas i trudności
- Środowisko dzielone z równoległymi sesjami odbioru innych pakietów (60+ procesów node) powodowało: sporadyczne przełączanie języka UI PL/EN w locie, timeouty nawigacji SPA, chwilowe zerwania współpracy real-time ("Ponowne łączenie ze współpracą"), a przy bardzo szybkich powtarzanych kliknięciach zoom w Tablicy — chwilowe wyczyszczenie widoku canvas (nie potwierdzone jako defekt produktu, nie powtórzyło się przy naturalnym tempie klikania).
- Aby dotrzeć do ekranów kanwy (Mind Map/Process Flow/Whiteboard) trzeba było przejść Moja Praca → Pomysły → pojedynczy klik na wiersz (otwiera podgląd) → przycisk "Open"/"Otwórz" w podglądzie → dopiero to nawiguje do faktycznego workspace'u kanwy.
- Sesja zajęła około 90 minut ze względu na eksplorację nawigacji (brak gotowych selektorów) i powtórki po timeoutach.
