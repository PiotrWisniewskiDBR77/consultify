# 09 — Convert, Export, Import, Templates

## Definicje

Convert:

- tworzy trwały artefakt lub wynik w Consultify,
- np. Initiative, Task, Decision, Report, Presentation.

Export:

- tworzy plik poza systemem,
- np. PNG, SVG, PDF, CSV, Markdown, JSON, BPMN.

Import:

- wprowadza dane do Idea z zewnętrznego źródła.

Templates:

- stosują gotowy szablon struktury.

Przełączanie reprezentacji:

- pokazuje te same dane w innym widoku,
- nie jest Convert,
- nie jest Export,
- nie jest Import.

## Convert

Convert może mieć scope:

- Whole Idea
- Current view
- Selection
- Single item
- Branch
- Table rows

Każde wejście Convert musi pokazać scope.

Przykłady etykiet:

- `Convert whole Idea`
- `Convert selected rows`
- `Convert selected node`
- `Convert branch`

Nie wolno:

- używać jednej etykiety `Convert` dla różnych zakresów bez wyjaśnienia,
- nadpisywać statusu całej Idea przy konwersji zaznaczenia,
- gubić poprzednich konwersji.

Backend musi zapisywać konwersje jako historię wielu wyników, nie pojedyncze pole `promoted_to`.

## Export

Export zawiera tylko pliki:

- PNG
- SVG
- PDF
- Markdown
- JSON / diagram package
- BPMN
- draw.io
- CSV / TSV dla tabeli

Report i Presentation nie są exportem, jeżeli tworzą trwałe rekordy Consultify. Są Convert.

## Import

Import destrukcyjny wymaga confirm.

Przed importem, który zastępuje graf:

1. pokaż co zostanie zastąpione,
2. pokaż źródło,
3. utwórz snapshot przed zmianą,
4. pozwól anulować,
5. po imporcie pokaż summary,
6. pozwól cofnąć.

CSV import dla Table:

- pokazuje preview,
- mapuje kolumny,
- pokazuje konflikty typów,
- pozwala wybrać append / update / replace,
- replace wymaga confirm.

## Templates

Templates mogą:

- stworzyć początkową strukturę,
- dodać brakujące elementy,
- zastąpić aktualną strukturę tylko po confirm.

Templates muszą być świadome aktywnego widoku:

- Mind Map templates,
- Whiteboard templates,
- Process Flow templates,
- Table templates.

Nie wolno pokazywać szablonów niepasujących do aktywnego widoku bez filtra.

## `Create from map`

Ta etykieta jest zakazana w docelowym standardzie, bo jest niejednoznaczna.

Zastępujemy ją konkretnymi nazwami:

- `Convert whole Idea`
- `Generate process proposal from map`
- `Create report from Idea`
- `Switch to Process Flow`

Każda z tych funkcji ma inny skutek i nie może być opisana jednym skrótem.

## Kryteria akceptacji

- Export nie tworzy trwałych artefaktów.
- Convert ma preview i zachowuje source link.
- Import destrukcyjny ma confirm i snapshot.
- Templates mają confirm przy replace.
- `Create from map` nie istnieje w UI.

