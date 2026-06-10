# Interview Module — Visual Standard (2026)

**Cel:** rozciągnąć istniejący, nowoczesny język wizualny Consultify (z czatu + menu/filtrów tabel) na cały moduł Interview (4 kroki: pytania → przypisanie/wypełnianie → insighty → inicjatywy). **Nie wymyślamy nowego stylu — kodyfikujemy i reużywamy istniejący.** Styl docelowy: Gemini / Apple / OpenAI / Anthropic — nie „tabelki z 2010".

Źródło prawdy tokenów: `src/index.css` (CSS vars) + `tailwind.config.js`. Wyciąg potwierdzony w kodzie 2026-06-06.

---

## 1. Tokeny (używaj `c.*`, nie surowych hue)

| Rola | Klasa | Light → Dark |
|---|---|---|
| Tło app | `bg-c-bg` | `#fafaf9` → `#0b1220` |
| Powierzchnia (karty/panele) | `bg-c-surface` | `#fff` → `#0f172a` |
| Powierzchnia uniesiona (popover/chip) | `bg-c-surface-raised` | `#fff` → `#15213b` |
| Hairline | `border-c-border-subtle` | `#eef0f2` → `rgba(255,255,255,.06)` |
| Border | `border-c-border` | `#e2e5e9` → `rgba(255,255,255,.10)` |
| Tekst / 2nd / muted | `text-c-text` / `-text-secondary` / `-text-muted` | — |
| **Akcent (jedyny brand)** | `bg-c-accent` / `text-c-accent` | `#85182F` crimson → `#c8324a` |
| Akcent-soft (zaznaczenie) | `bg-c-accent-soft` | `rgba(133,24,47,.08)` |
| Sukces/Ostrz./Błąd/Info | `text-c-success` / `-warning` / `-danger` / `-info` | HBS hues |

**Reguła koloru:** crimson to JEDYNY kolor brandowy; kolor = sygnał (status/priorytet), nigdy dekoracja. Surowe `bg-emerald/blue/amber-50` = anty-wzorzec → `StatusPill` / `chips`.

## 2. Kształt, cień, blur, motion
- **Radii:** `rounded-xl` (12px) karty/inputy/composer · `rounded-2xl` (16px) floating menu/modal · `rounded-full` pills/toggles/tabs. NIGDY `rounded` (4px) na kontrolkach.
- **Cień:** karty `shadow-token-card` (+`-hover`), focus `shadow-token-focus` (crimson). Floating: `shadow-[0_8px_32px_rgba(0,0,0,0.12)]` (dark `0.4`). Modal: `shadow-[0_25px_50px_...]`.
- **Glass:** floating menu = `bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border border-c-border-subtle`.
- **Motion:** framer-motion spring `stiffness 500 damping 30`; enter `opacity 0 + scale .95 + y -4 → 1`. Button `whileTap scale .97`. Card hover `y:-2`. Transitions zawsze scoped: `transition-colors duration-150` / `transition-all duration-200`.

## 3. Typografia
- Font **Inter** (`font-sans`/`font-display`). Serif TYLKO deliverables/landing — nigdy w UI produktu.
- Body `text-sm`, meta `text-xs`/`text-[11px]`. Tytuły `font-semibold` (nie `font-bold`).
- **Eyebrow / section-label:** `text-[11px] font-semibold uppercase tracking-wider text-c-text-muted`.

## 4. Komponenty — REUŻYWAJ (import, nie pisz od zera)

| Potrzeba | Import |
|---|---|
| Przyciski | `@/components/ui/primitives` → `Button` (primary crimson / ghost / outline / danger) |
| Inputy/selecty (portalowe, nie zasłaniają się) | `@/components/shared/forms` → `Select`, `MultiSelect`, `DatePicker`, `PriorityPicker`, `Field`/`FieldLabel`/`FieldError` |
| Chipy/meta | `@/components/ui/primitives/chips` → `StatusChip`/`PriorityChip`/`DueChip`/`MetaChip`/`ToolChip` |
| Status pill (SSOT) | `@/components/shared/StatusPill` |
| Karta | `ui/primitives` → `Card` (+ Header/Content/Footer) |
| Floating/akcje menu | `ui/primitives` → `Dropdown` (portal+kbd+outside-click). Bogaty model: kopiuj shell z `AIChat/WorkModeMenu.tsx` |
| Filtr kolumny „Filter by/Clear/Apply" | `ui/ResizableTable/FilterDropdown.tsx` |
| Detail-view N+C | `@/components/shared/NModeLayout` → `NModeShell`/`NModeCBoard` + `usePresentationMode({entityType})` |
| Pełny wizard (powłoka) | `@/components/shared/WizardModal` → `WizardModal` (header/overlay/footer) + `WizardStepper` |
| Modal/Drawer | `ui/primitives` → `Modal`/`ConfirmModal`/`Drawer` |
| Tabela + filtry + sort | `@/components/shared/ModuleHub` → `FilterableTable` |
| Segmented N⇄C / view | `@/components/shared/TablePresentationToggle` |
| Row kebab | `@/components/shared/RowActionsMenu` |
| Edytory pilli w preview | `@/components/shared/PreviewPane/editors` |

**Wybór ścieżki (spójność):** `ui/primitives` + `shared/forms` + `shared/NModeLayout`. Ignoruj równoległe shadcn (`ui/dialog|dropdown|popover`) w nowej pracy Interview.

## 5. Wzorce-wzorce (file:line do podejrzenia)
- Floating menu: `src/components/AIChat/WorkModeMenu.tsx:202`, `CoThinkerMenu.tsx:245`
- Filtr kolumny: `src/components/ui/ResizableTable/FilterDropdown.tsx:107`
- Composer (premium input): `src/components/AIChat/.../EnhancedChatInput.tsx:1076`
- Chip SSOT: `src/components/ui/primitives/chips/chipBase.tsx:61`
- Segmented toggle: `src/components/shared/TablePresentationToggle.tsx:56`

## 6. Luki — atomy do dodania w `shared/` (dla spójności 4 kroków)
1. **`ThumbnailTile`** — kafelek miniatury obrazu (hover + remove + lightbox). Dziś brak; jest tylko `OptimizedImage`.
2. **`AttachmentChip` + `Dropzone`** — atom załącznika + strefa drop/paste. Dziś każda sekcja robi własne (real gap dla krok 1-2 z plikami).
3. **`PeoplePicker`** — `MultiSelect` + `renderOptionLeading` (avatar) dla `AssignInterviewModal`.
4. **`FormModal`** — cienka owijka `Modal` + body `space-y` + footer Save/Cancel (krótkie formularze).

## 7. Anty-wzorce do zastąpienia (look „2010")
- Ręczne `<table>` + bespoke per-column filter state (`Interview/InterviewHub.tsx`) → `FilterableTable` + `FilterDropdown`.
- Ręczne mapy chipów statusów (`border-emerald-300 bg-emerald-50 …`) → `StatusChip`/`StatusPill`.
- Surowe hue jako status; `rounded` 4px na kontrolkach; `transition` bez scope+duration; native `<select>`/`<input type=date>`; `font-bold` headery; akcent inny niż crimson.

---

**Status:** kontrakt dla redesignu Interview (kroki 1–4). Każda nowa/zmieniona powierzchnia ma się do niego stosować. Dowód = screenshot na żywym koncie po każdej znaczącej zmianie (nie samo `tsc`).
