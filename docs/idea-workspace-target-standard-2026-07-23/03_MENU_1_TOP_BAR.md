# 03 — Menu 1: pierwszy pasek

## Rola

Menu 1 zarządza całym obiektem Idea. Nie dotyczy aktualnego widoku, pojedynczego elementu ani zaznaczenia.

## Docelowy układ

Lewa strona:

1. Strzałka powrotu.
2. Breadcrumb `Ideas`.
3. Ikona typu obiektu `Idea`.
4. Nazwa Idea.
5. Etap / status, np. `Spark`.
6. Stan zapisu.

Prawa strona:

1. Teresa.
2. Convert.
3. Kebab globalny.

## Nazwa Idea

Nazwa w Menu 1 jest nazwą całej Idea, nie nazwą reprezentacji.

Poprawnie:

`Predykcja awarii linii pakowania`

Niepoprawnie:

`Predykcja awarii — Mind Map`

Aktualna reprezentacja jest pokazana w prawym dolnym przełączniku widoku, nie w nazwie obiektu.

## Stan zapisu

Dozwolone stany:

- `Saved`
- `Saving...`
- `Local draft`
- `Queued changes`
- `Conflict`
- `Offline`
- `Read-only`

Konflikt nie może automatycznie nadpisywać lokalnych zmian bez pokazania opcji.

Minimalny standard konfliktu:

- pokaż lokalną wersję,
- pokaż wersję serwera,
- pokaż autora i czas,
- pozwól zachować kopię lokalną,
- pozwól scalić albo odrzucić zmiany.

## Teresa

Teresa w Menu 1 otwiera panel rozmowy z AI o całej Idea.

Kontekst przekazywany do Teresy:

- nazwa Idea,
- brief/problem,
- aktualna reprezentacja,
- wszystkie elementy i relacje,
- statusy, komentarze i powiązania,
- aktywna zakładka prawego panelu,
- zaznaczenie, jeśli istnieje, jako dodatkowy kontekst, ale nie jako scope podstawowy.

Teresa nie zastępuje prawego panelu. Otwiera osobny panel rozmowy. Lewy i prawy panel pozostają dostępne.

## Convert

Convert w Menu 1 zawsze oznacza konwersję całej Idea do artefaktu lub trwałego rezultatu.

Dozwolone targety:

- Initiative
- Task set
- Decision
- Report
- Presentation

Zasady:

- Convert musi pokazywać preview przed utworzeniem rekordu.
- Convert musi jasno pokazywać scope: `Whole Idea`.
- Convert musi zachować link do źródła.
- Convert nie może nadpisywać pola `promoted_to` całej Idea w sposób gubiący poprzednie konwersje.
- Historia musi zapisać: kto, kiedy, z czego, do czego, jaki target, jaki zakres.

Nie wolno:

- trzymać Convert jako zakładki prawego panelu,
- ukrywać Convert pod Export,
- używać `Create from map` jako synonimu Convert.

## Kebab globalny

Kebab w Menu 1 zawiera rzadkie funkcje całego obiektu:

- Rename
- Duplicate Idea
- Copy link
- Share
- Version history
- Idea settings
- Archive
- Delete Idea
- Keyboard shortcuts

Nie może zawierać:

- Delete selected,
- Duplicate selected,
- Add node,
- Add shape,
- Add row,
- Auto-layout current view,
- AI for selected item.

## Kryteria akceptacji

- Menu 1 wygląda identycznie we wszystkich czterech reprezentacjach.
- Nazwa Idea nie zmienia się przy zmianie reprezentacji.
- Teresa zawsze działa na całej Idea.
- Convert zawsze działa na całej Idea i ma preview.
- Kebab nie zawiera funkcji edycji elementów.
- Nie ma martwych pozycji ani pozycji `soon` bez jasnego disabled state.

