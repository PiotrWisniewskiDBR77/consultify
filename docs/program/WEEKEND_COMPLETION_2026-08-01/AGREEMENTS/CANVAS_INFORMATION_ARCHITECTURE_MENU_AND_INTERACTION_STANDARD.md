---
document_id: CANVAS-INFORMATION-ARCHITECTURE-MENU-INTERACTION
surface: Canvas
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Canvas — architektura ekranu, menu i interakcje

## 1. Układ podstawowy

```text
┌──────────────── Chat / Teresa ────────────────┬──────────── Canvas ─────────────┐
│ historia tej samej rozmowy                    │ header: artefakt + stan + close │
│ pytania, ustalenia, polecenia                 │ command row                     │
│ źródła i potwierdzenia                        │                                │
│                                               │ właściwy edytor / preview       │
│ composer zachowujący kontekst Canvasu         │                                │
│                                               │ prawy inspector (opcjonalny)    │
└───────────────────────────────────────────────┴────────────────────────────────┘
```

Chat i Canvas używają jednego `conversationId`, identity i business scope.
Zmiana szerokości paneli jest zapamiętywana. Canvas może wejść w tryb focus/full
screen, ale powrót przywraca tę samą rozmowę i zaznaczenie.

## 2. Header

Stała kolejność:

1. back/close;
2. ikona typu i edytowalny tytuł;
3. status zapisu;
4. lifecycle i capability label;
5. collaborators/reviewer;
6. Share;
7. Export/Present;
8. menu `…`.

Close zawsze oznacza powrót, nie usunięcie. Delete/Archive znajdują się w menu
`…`, mają potwierdzenie i opis skutku.

## 3. Command row

Minimalny wspólny zestaw:

- Undo / Redo;
- tryb `Edit / Preview / Source` zależnie od artefaktu;
- Insert;
- Teresa / Improve selection;
- Comments / Review;
- History;
- Find;
- Save status.

Nie pokazujemy funkcji niedziałających. Capability `partial/scaffold` ma jawną
etykietę i wyjaśnienie. Polecenie nie może występować równocześnie w trzech
równorzędnych miejscach.

## 4. Insert

Menu jest zależne od artefaktu. W dokumencie: text, heading, list, quote, table,
image, file, callout, divider, decision, source, chart/diagram embed. W tabeli:
row, column, formula, chart, filter view. W decku: slide, layout, chart, image,
section. Element nieobsługiwany natywnie może być tylko linkiem lub kontrolowanym
embedem, nie udawanym rendererem.

## 5. Selection menu

Po zaznaczeniu tekstu lub bloku pojawia się kompaktowe menu:

- Ask Teresa;
- rewrite / shorten / expand / clarify;
- change tone/audience;
- turn into list/table/action items;
- add source / verify claim;
- comment;
- move/duplicate/delete.

Operacja AI zachowuje dokładny zakres. Preview pokazuje before/after i nie może
nadpisać ręcznych zmian wykonanych po rozpoczęciu generowania.

## 6. Prawy inspector

Inspector jest kontekstowy i domyślnie zamknięty. Maksymalnie pięć sekcji:

- Properties;
- Sources & evidence;
- Comments & review;
- History & lineage;
- Teresa suggestions.

Kliknięcie ikony zmienia treść panelu; nie może wyświetlać tej samej treści dla
każdej zakładki. Panel nie zasłania krytycznej części dokumentu bez możliwości
resize/collapse.

## 7. Nawigacja i recovery

- breadcrumb prowadzi do źródłowego modułu lub biblioteki artefaktów;
- `Esc` zamyka menu, potem inspector, nigdy bezpośrednio całe dzieło;
- `Cmd/Ctrl+S` wymusza zapis;
- `Cmd/Ctrl+Z/Shift+Z` obsługuje historię lokalną;
- refresh otwiera ostatnią zapisaną wersję i proponuje odzyskanie local draft;
- deep link otwiera właściwy draft i zachowuje uprawniony kontekst;
- po handoffie użytkownik może otworzyć target albo pozostać w Canvasie.

## 8. Tryby responsive

- desktop wide: chat + Canvas + opcjonalny inspector;
- desktop narrow: chat + Canvas, inspector jako overlay;
- tablet: przełącznik Chat/Canvas z trwałym stanem;
- mobile: jeden panel naraz, stały przycisk powrotu i jawny save state.

## 9. Dostępność

Pełna obsługa klawiatury, logiczny focus, nazwy aria, kontrast WCAG AA,
niekolorystyczne statusy, możliwość wyłączenia animacji, sensowna kolejność
czytnika oraz tekstowe odpowiedniki wykresów i diagramów.

## 10. Stany

Każdy ekran definiuje: loading, empty, generating, saving, saved, offline,
conflict, permission denied, stale source, projection failed, review blocked,
export failed i success with next action. Skeleton nie może wyglądać jak gotowy
wynik. Błąd zawiera odzyskiwalny krok i nie usuwa treści użytkownika.

## 11. Wizualny standard 2026

Minimalizm, wyraźna hierarchia typograficzna, duża powierzchnia treści, spokojne
tło i jeden dominujący CTA dla aktualnego etapu. Chips i badges służą statusowi,
nie dekoracji. Artefakty klientowskie stosują brand system deliverable, a shell
aplikacji pozostaje neutralny i spójny z resztą Consultify.
