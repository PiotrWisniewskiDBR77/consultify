# AI Suggestions Modal — Standard UI/UX (DBR77)

> **Status:** PROPOSED (do adopcji jako standard)  
> **Ostatnia aktualizacja:** 2026-02-15  
> **Referencyjna implementacja (source of truth):** `src/components/Initiatives/sections/TasksMilestonesSection.tsx` (modal propozycji zmian w taskach)

## Cel

Wzorzec modala do **przeglądu i zastosowania sugestii AI** dla list (backlog, items) w artefaktach.

Modal ma umożliwić użytkownikowi szybkie:

- wybranie elementów do usunięcia,
- wybranie elementów do dodania,
- opcjonalne zastosowanie sugerowanej kolejności,
- kliknięcie **Apply** z jasnym „co się stanie” bez nadmiaru tekstu.

## Zasady DBR77 (MUST)

- **Layer 3 (floating)**: modal wygląda jak „floating card” (tło + blur + shadow), bez krzykliwych ramek.
- **Invisible borders**: sekcje wewnątrz rozróżniane tłem + spacingiem, nie borderami.
- **Monochromatic chrome**: kolor tylko semantycznie (remove = amber surface, AI/plan = purple callout), reszta neutralna.
- **Hover**: subtelna zmiana tła (`bg`), bez zmiany koloru tekstu/borderu.

## Układ (KANON)

### Header

- **Title**: `Proposed … (AI)` (zależnie od kontekstu: backlog / changes)
- **Subtitle**: jednozdaniowa instrukcja (np. „Select items…, then Apply”)
- **Close**: ikona `X` (ghost, hover bg)

### Body (scrollable)

Kolejność sekcji **od góry** jest stała:

1. **To remove / Do wywalenia**
2. **To add / Do dodania**
3. **Suggested order / Proponowana kolejność**
4. **Plan** (podsumowanie działań)

Każda sekcja (1–3) jest w „quiet container”:

- `rounded-xl`
- `bg-slate-50/50 dark:bg-navy-950/20`
- `p-3`
- `space-y-2`

### Footer

- **Cancel** (secondary/outline)
- **Apply** (AI accent outline, spójny z resztą UI)

## Sekcje — zachowanie

### 1) To remove / Do wywalenia

- **Nagłówek**: label + count (`(N)`), opcjonalnie link `Select all` (tylko jeśli lista niepusta)
- **Zawartość**: lista checkboxów z tytułem + krótkim powodem
- **Kolor**: semantyczny _warning surface_ (amber), ale bez agresywnych borderów
- **Domyślny wybór**: **unchecked** (użytkownik świadomie wybiera destrukcję)
- **Empty state**: `EmptyStateInline` z `dashed={false}` i spokojnym hintem

### 2) To add / Do dodania

- **Nagłówek**: label + count, opcjonalnie `Select all`
- **Zawartość**: checkbox + title + description + rationale (opcjonalnie)
- **Domyślny wybór**: **checked** (AI propozycje dodania są „proposed”, użytkownik odznacza wyjątki)
- **Empty state**: `EmptyStateInline` (`dashed={false}`)

### 3) Suggested order / Proponowana kolejność

- **Nagłówek**: label + count oraz toggle `Apply order`
- **Toggle**: disabled, gdy brak propozycji order
- **Zawartość**: opcjonalna notatka + lista numerowana
- **Cel**: ordering ma poprawić czytelność backlogu, bez agresywnego narzucania

### 4) Plan (podsumowanie)

- Renderuj jako `Callout` `variant="purple"` w trybie `compact`
- Treść: maks. 2–3 krótkie bullet points (bez oczywistych „porad”)
- Plan ma odpowiadać na pytanie: **co zrobi Apply** (ile doda, ile usunie, czy zastosuje kolejność)

## Stany (MUST)

### Loading / AI working

Użytkownik musi zawsze widzieć, że „AI działa”:

- przyciski wywołujące AI pokazują **spinner + label** typu „Analizuję…” / „Generating…”
- opcjonalnie w nagłówku sekcji (np. Tasks) pojawia się pill „AI working…”

### Brak danych / empty

W każdym miejscu, gdzie lista jest pusta, używamy `EmptyStateInline` (zwykle `dashed={false}` w modalu).

## i18n (MUST)

- Każdy tekst w modalu jest dwujęzyczny (PL/EN).
- Copy jest krótkie i „quiet” (bez instrukcji oczywistych).

## Checklist dla implementacji

- [ ] Kolejność sekcji: remove → add → order → plan
- [ ] Destrukcja domyślnie odznaczona (remove)
- [ ] Add domyślnie zaznaczone
- [ ] `EmptyStateInline` dla pustych list
- [ ] `Callout(purple)` dla planu
- [ ] Widoczny loading (spinner + zmiana label)
- [ ] DBR77 Layer 3 + blur + shadow, bez krzykliwych ramek
