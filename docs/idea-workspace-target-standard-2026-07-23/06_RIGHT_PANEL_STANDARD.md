# 06 — Prawy panel

## Najważniejsza decyzja

Obecny prawy panel Idea jest do przebudowy. Nie poprawiamy go kosmetycznie.

Docelowy prawy panel ma pięć zakładek:

1. Przegląd
2. Inspektor
3. Powiązania
4. Komentarze
5. Historia

To jest stały kanon dla Mind Map, Whiteboard, Process Flow i Table.

## Dlaczego nie obecny układ

Obecny układ `Problem / Status / Inspector / Convert / Health` jest błędny, ponieważ:

- ikony udają zakładki, ale nie przełączają treści,
- Problem, Status i Health opisują ten sam poziom: całą Idea,
- Convert nie jest informacją, tylko akcją tworzenia artefaktu,
- brakuje Powiązań jako first-class,
- brakuje Komentarzy jako first-class,
- AI i Health są rozproszone i częściowo dublowane.

## Wygląd

Prawy panel jest jasnym komponentem systemowym:

- szerokość stała: 360-420 px,
- jasne tło,
- obramowanie 1 px,
- radius 8 px,
- odstęp od krawędzi ekranu i canvasu,
- cień bardzo subtelny albo brak,
- scroll wewnątrz panelu,
- zakładki ikonowe w prawym railu albo u góry panelu, ale zawsze przełączające treść.

Ikony mają tooltipy:

- Przegląd
- Inspektor
- Powiązania
- Komentarze
- Historia

Kliknięcie aktywnej ikony zamyka panel. Kliknięcie innej ikony przełącza zawartość.

Stan aktywnej zakładki jest lokalny dla użytkownika. Nie może przełączać panelu innym osobom.

## 1. Przegląd

Scope: `workspace`.

Pokazuje całą Idea.

Sekcje:

1. Brief / problem
2. Status i etap
3. Health / kompletność
4. Statystyki
5. Najbliższy rekomendowany krok
6. Źródła wysokiego poziomu

Przegląd nie pokazuje właściwości zaznaczonego elementu.

Przykładowe pola:

- nazwa Idea,
- opis problemu,
- etap,
- owner,
- liczba elementów,
- liczba relacji,
- liczba komentarzy,
- kompletność,
- ostatnia aktywność.

Health:

- może mieć score,
- musi pokazać, kiedy był liczony,
- nie może udawać, że walidacja została wykonana, jeśli jej nie wykonano,
- szczegóły health mogą być rozwijane w Przeglądzie, ale Health nie jest osobną zakładką.

## 2. Inspektor

Scope: `single_item`, `selected_items`, `edge`, `lane_frame`, `table_row`, `table_column`, `table_cell`.

Inspektor pokazuje szczegóły aktualnego zaznaczenia.

Jeżeli nic nie zaznaczono:

- pokazuje ustawienia aktualnego widoku,
- np. grid, layout, theme, validation options, table view options.

Jeżeli zaznaczono jeden element:

- nazwa,
- typ,
- opis,
- status,
- priorytet,
- właściciel,
- właściwości specyficzne,
- relacje elementu,
- komentarze elementu,
- załączniki,
- lokalne AI,
- lokalna historia.

Jeżeli zaznaczono wiele elementów:

- licznik zaznaczenia,
- wspólne właściwości,
- bulk actions,
- AI for selection,
- align/distribute/group, jeśli dotyczy.

Jeżeli zaznaczono krawędź:

- label,
- typ relacji,
- kierunek,
- styl,
- source,
- target,
- delete edge,
- insert node on edge.

Jeżeli zaznaczono table column:

- field name,
- field type,
- visibility,
- width,
- sorting/grouping usage,
- formula/options,
- delete field.

Jeżeli zaznaczono table cell:

- value,
- field type,
- validation,
- edit history,
- clear,
- copy,
- AI fill cell.

## 3. Powiązania

Scope: `workspace` z filtrem do zaznaczenia.

Powiązania są first-class.

Sekcje:

1. Artefakty Consultify
2. Źródła i dowody
3. Załączniki
4. Backlinks
5. Importowane dane
6. Linki zewnętrzne

Artefakty:

- Initiative
- Task
- Decision
- Report
- Presentation
- Interview
- Notebook
- Document

Każda pozycja pokazuje:

- typ,
- nazwę,
- status,
- źródło powiązania,
- datę utworzenia,
- akcję otwarcia,
- akcję odłączenia, jeśli user ma uprawnienia.

Przełącznik zakresu:

- `Whole Idea`
- `Current view`
- `Selection`

Jeżeli akcja `Dodaj powiązanie` jest widoczna, musi mieć działający handler. Martwe eventy `idea-workspace-add-edge` / `idea-workspace-link-artifact` nie mogą zostać w UI bez obsługi.

## 4. Komentarze

Scope: `workspace` albo `selection`.

Komentarze są first-class, nie są ukryte w Inspektorze.

Przełącznik:

- Whole Idea
- Current view
- Selection

Funkcje:

- lista komentarzy,
- autor,
- data,
- odpowiedzi,
- oznaczenie resolved/unresolved,
- wzmianki,
- filtr: all / unresolved / mine / AI,
- dodanie komentarza.

Komentarze AI muszą być oznaczone jako AI.

Komentarze nie mogą mieszać się z historią zmian.

## 5. Historia

Scope: `workspace`, z filtrem widoku lub zaznaczenia.

Historia pokazuje log działań.

Filtry:

- All
- People
- AI
- System
- Import
- Convert

Każdy wpis:

- kto,
- kiedy,
- co,
- zakres,
- poprzednia wartość, jeżeli dotyczy,
- nowa wartość, jeżeli dotyczy,
- link do obiektu lub elementu,
- możliwość porównania wersji, jeżeli dotyczy.

Historia zawiera zdarzenia AI, ale zakładka nazywa się `Historia`, nie `Historia / AI`.

## Co nie może być w prawym panelu

- Przełącznik reprezentacji.
- Globalny Convert jako zakładka.
- Export.
- Martwe ikony.
- Problem, Status i Health jako oddzielne zakładki.
- AI jako osobna stała zakładka bez jasnego scope.

## Akcje w prawym panelu

Akcje są dopuszczalne tylko wtedy, gdy wynikają z aktualnej zakładki.

Przykłady:

- Przegląd: `Improve brief with AI`, `Run health check`.
- Inspektor: `Convert selected item`, `Delete selected item`, `AI rewrite item`.
- Powiązania: `Add link`, `Attach source`.
- Komentarze: `Add comment`.
- Historia: `Restore version`, po confirm.

Globalne `Convert whole Idea` zostaje w Menu 1.

## Kryteria akceptacji

- Pięć ikon prawego raila przełącza pięć różnych treści.
- Aktywna zakładka jest widoczna.
- Klik aktywnej zakładki zamyka panel.
- Przegląd nie miesza się z Inspektorem.
- Powiązania i Komentarze istnieją jako osobne zakładki.
- Convert nie jest zakładką.
- Prawy panel działa identycznie we wszystkich czterech reprezentacjach.

