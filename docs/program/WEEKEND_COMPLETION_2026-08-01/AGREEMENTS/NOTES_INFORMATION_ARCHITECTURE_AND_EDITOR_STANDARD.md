---
doc_kind: ARTIFACT_UX_CONTRACT
function_id: MW_NOTEBOOK
status: REVIEW
last_updated: 2026-07-31
---

# Notes — architektura informacji, menu i edytor

## 1. Reguła nadrzędna

Użytkownik ma zawsze wiedzieć: gdzie jest, co edytuje, czy zmiana została zapisana, kto widzi treść i jak bezpiecznie wrócić. Notes stosuje kanon sekcji 2026 i wzorce nawigacji aplikacji; nie tworzy osobnego języka UI.

## 2. Poziomy nawigacji

### Poziom A — biblioteka

Tabela/karty notatników zawierają: nazwę, opis, właściciela, zakres (`private`/`project`), projekt, liczbę stron, ostatnią aktywność i akcje. Użytkownik może utworzyć, otworzyć, zmienić nazwę, przenieść do archiwum i — po sprawdzeniu zawartości — usunąć notatnik.

### Poziom B — workspace notatnika

Trzykolumnowy układ adaptacyjny:

1. lewa kolumna: capture, filtry i lista stron;
2. centrum: strona i edytor;
3. prawa szyna: kontekst, źródła, relacje, AI i outputy.

Na mniejszych ekranach kolumny boczne są panelami, nigdy nakładką blokującą wyjście.

### Poziom C — strona

Nagłówek zawiera breadcrumb, ikonę/cover, tytuł, status zapisu, widoczność, właściciela, aktualność i menu strony. Ciało jest edytorem blokowym. Stopka/prawa szyna zawiera źródła, backlinki, historię i outputy.

## 3. Menu

### Menu 1 — moduł

`My Work` pozostaje aktywne. Wyjście zachowuje szkic i ostatni kontekst.

### Menu 2 — funkcja

Aktywne `Notatki`. Powrót do biblioteki jest zawsze widoczny i nie wymaga użycia przycisku przeglądarki.

### Menu 3 — kontekst

W bibliotece: `Wszystkie`, `Moje`, `Projektowe`, `Archiwum` oraz `Nowy notatnik`.

W notatniku: oś statusu `Wszystkie`, `Inbox`, `Aktywne`; dodatkowe soczewki `Przypięte`, `Ostatnie`, `Do przeglądu`, `Świeże`, `Osierocone`. Oś właściciela (`Wszystkie`, `Moje`, `Zespół`) pojawia się tylko, gdy ma sens.

W stronie: nazwa notatnika, breadcrumb i działania strony. Filtry listy nie mogą zmieniać statusu strony.

## 4. Anatomia wiersza strony

Każdy wiersz pokazuje w stałej kolejności:

1. status i opcjonalną ikonę;
2. tytuł oraz czas ostatniej zmiany;
3. jednoliniowe podsumowanie;
4. do dwóch tematów/tagów;
5. sygnały: przypięta, projektowa, zweryfikowana, stale, osierocona, reminder, istniejący output;
6. akcje hover/focus: rozpocznij pracę, konwertuj, przypnij, archiwizuj.

Kolor jest sygnałem wspierającym, nie jedynym nośnikiem znaczenia.

## 5. Edytor blokowy

Minimalny katalog bloków MVP:

- tekst, nagłówki H1–H3, quote/callout;
- lista punktowana, numerowana, checklist;
- tabela prosta;
- link, obraz i załącznik;
- code block;
- divider;
- embed kontrolowany obiektu Consultify;
- wzmianka `@` do osoby, strony lub obiektu.

Obowiązkowe interakcje: slash menu, bubble toolbar, undo/redo, skróty klawiaturowe, drag/reorder bloków, copy/paste, linkowanie, dostępne focus states. Nie wolno uzależniać pełnej obsługi od prawego przycisku myszy.

## 6. Zapis, wyjście i konflikt

- autosave działa po krótkim debounce i pokazuje `Zapisywanie…`, `Zapisano`, `Offline` albo `Konflikt`;
- przed zmianą strony wykonywany jest flush oczekującego zapisu;
- awaria zapisu nie usuwa lokalnej treści i daje `Spróbuj ponownie`/`Skopiuj treść`;
- konflikt wersji pokazuje porównanie: wersja moja, wersja serwera, autor/czas; użytkownik wybiera scal, zachowaj moją jako kopię lub przyjmij serwer;
- historia wersji umożliwia podgląd i przywrócenie jako nowej wersji;
- zamknięcie, back i przejście do modułu nie mogą powodować utraty treści.

## 7. Źródła, załączniki i cover

- `source file` jest dowodem pochodzenia treści po imporcie;
- `attachments` są plikami pomocniczymi strony;
- usunięcie załącznika nie może po cichu usunąć cytowanego źródła;
- import zachowuje nazwę, typ, rozmiar, czas i osobę dodającą;
- cover i ikona wspierają orientację, ale nie zastępują tytułu.

## 8. Relacje i widoki wiedzy

- backlink pokazuje, co odwołuje się do bieżącej strony;
- mention/embed tworzy kontrolowaną krawędź relacji;
- topic view grupuje strony bez zmiany ich właściciela;
- graph view jest widokiem pomocniczym, nie główną nawigacją;
- `osierocona` oznacza brak relacji, a nie błąd; system proponuje połączenie lub archiwizację.

## 9. Stany interfejsu

| Stan | Treść | Następna akcja |
| --- | --- | --- |
| loading | skeleton bez migotania pustego edytora | poczekaj |
| empty library | wyjaśnienie wartości notatnika | utwórz notatnik |
| empty notebook | capture + pierwszy starter | utwórz/importuj stronę |
| no filter results | informacja o filtrze | wyczyść/zmień filtr |
| degraded | edycja działa, panel zależny nie | kontynuuj lub ponów panel |
| error | bezpieczny opis i trace ID | ponów/powrót |
| conflict | porównanie wersji | rozstrzygnij bez utraty danych |

## 10. Dostępność i responsywność

- pełna nawigacja klawiaturą i widoczny focus;
- etykiety dla ikon i komunikaty statusu przez live region;
- zachowany kontrast, reduced motion i powiększenie 200%;
- mobilnie: lista → strona → panel, z zawsze widocznym back;
- kolejność tabulatora odpowiada kolejności wizualnej.
