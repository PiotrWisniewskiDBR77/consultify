# ZLECENIE — Agent A5 · Klaster: Materiały + Chat + Studio + Public + Docs/Legal/Partner
**Wznów:** [`_PROTOKOL.md`](_PROTOKOL.md) → to zlecenie → [`_STATUS.md`](_STATUS.md) → spec.
**Branch/worktree:** `reskin/A5/wave-<n>`

## Własność wyłączna (pliki)
`src/components/AIChat/**` (Chat + KIMI + AI OS) · `src/components/DocumentStudio/**` · `src/components/Presentations/**` · `src/components/PresentationStudio/**` · `src/components/ReportsAndPresentations/**` · `src/components/Reports/**` · `src/components/ReportBuilder/**` · `src/components/Studio/**` · `src/views/legal/**` · `src/views/docs/**` · `src/views/knowledge/**` · `src/views/partner/**` · public/marketing views

## Priorytet
P1 = Chat + Materiały (deck/doc/table, golden-path). P2 = Report/Presentation builders. P3 = Public/marketing (15 str) + Docs + Legal + Partner + KB — reskin PO golden-path.

## Zadania per fala
- **Fala 1 (Listy §14):** R&P Hub · Report History · Presentations Hub · Docs/KB category lists · Business Cases · Resources.
- **Fala 2 (Artefakty §11.2+§13):** **Chat (SPEC-K §16 — bąble nie-crimson, ramka wokół całego czatu)** · Document Studio (B) · Deck Builder (E) · Tabele KIMI (D) · Report Builder (B, koordynuj przeniesienie z A3) · KB/Legal article (B).
- **Fala 3 (Instrumenty §15):** Presentation Studio preview · onboarding wizards · public mini-assessment.
- **Fala 5 (Light).**

## Znane bugi (z walkthrough)
- Chat: ramka nie obejmuje całości (B-1) · logo niżej (B-2) · bąble AI czerwone → c.surface-raised · Generatory Menu 2/3 nie trzymają standardu (G-1/2) · „grafika z lat 90" artefaktów (G-3) · Report preview „prehistoryczny" + raporty się nie otwierają · Report Builder dobry ale w złym miejscu (przenieś tu z Initiatives).

## RAPORTY
<!-- Fala X · ekran · pliki · DoD · pominięte -->

### RAPORT 2026-07-02 · Fala 1 · Listy P1 (R&P Hub + Report History + Presentations Hub)
**Branch:** `reskin/A5/wave-1` (worktree agent-a1eb154fea9b61df4). Commity: `4bc5d7fc55` (R&P, 6 plików), `1f144485cc` (Report History), + Presentations Hub.

**Ekrany / pliki (8):**
1. `ReportsAndPresentations/ReportsAndPresentationsHub.tsx` — popover filtrów →`bg-c-surface/border-c-border`, chipy filtrów (7 wariantów lokalnych) → `bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised`; selected → `bg-c-accent-soft text-c-text` (border-primary-500/40 ZOSTAŁ — spójny z SSOT `MENU_3_CHIP_ACTIVE`); badge licznika filtrów → import `MENU_3_BADGE_ACTIVE`; `hover:text-primary-400`→`hover:text-c-text`; dot presetu R1-R4 `bg-primary-400`→`bg-slate-400`; „Done" → inverse `bg-c-text text-c-surface`.
2. `ReportsTabContent.tsx` — kolumny: tytuł→`text-c-text`, Typ (kolorowy font z META)→`text-c-text-secondary` (uwaga Piotra „różne kolory czcionki"; badge typu z tłem zostaje), okres→secondary, data→muted, chip eksportów→`bg-c-surface-raised`; empty/error state→tokeny.
3. `PresentationsTabContent.tsx` — j.w.; miniatura PPT gradient slate/navy→`bg-c-surface-raised border-c-border-subtle`.
4. `SheetsTabContent.tsx` — karta+3 role tekstu→tokeny.
5. `OutputsAggregateTabContent.tsx` — kolumny (ikony typu, tytuł, 4 meta-kolumny, data)→3 role; dialog lineage (karty, wiersze, przyciski Download/Open)→tokeny; stopka preview: przycisk sheet→inverse `bg-c-text`, „Start review"→`border-c-border text-c-text-secondary`; empty (Teresa crimson icon = brand moment, zostaje).
6. `TemplatesTabContent.tsx` — kolorowe ikony typów (blue/emerald)→`text-c-text-muted` (kanon §4.1 neutralne ikony typu); chip typu `bg-slate-500/10`→`bg-c-surface-raised`; onboarding karty→tokeny.
7. `Reports/Management/ReportHistoryTable.tsx` — kontener/nagłówek/thead/divide→tokeny; **fokus selectów `ring-primary-500`→`ring-c-focus` (crimson na fokus = SYS-1)**; **badge STEERING_COMMITTEE primary→indigo, APPROVED primary→emerald (crimson nigdy na status)**; kolorowe ikony akcji (danger/amber/primary/blue)→`text-c-text-muted` + neutralny hover; paginacja aktywna `bg-navy-900`→inverse `bg-c-text text-c-surface`.
8. `Presentations/PresentationsHub.tsx` — SOURCE_TYPE_META assessment `primary-400`→`indigo-400` (identity≠crimson; GridView TYPE_ACCENTS fallback bez zmian — brak klucza primary/indigo); hover ikon kart `hover:text-primary-400`→`hover:text-c-text`; input rename fokus primary→`ring-c-focus`; Save/Open Editor `bg-primary-500`/`bg-navy-900`→inverse `bg-c-text text-c-surface`; preview pane+modal→tokeny.

**DoD:** esbuild parse 8/8 OK; grep: zero `navy-*`, zero `bg-white dark:`, zero `primary-*` poza (a) `border-primary-500/40` selected-chip (spójne z SSOT ModuleMenu3) i (b) dot-kolorami statusów (dane, tier neutral wg statusColors). Pełny `npm run build` NIE odpalony (zlecenie nadrzędne: grep sanity; env bez node_modules gwarancji) — do weryfikacji przy odbiorze.

**Pominięte / TODO / luki (CANON §3):**
- **Multi-select (A-1):** FilterableTable ma opt-in `selection` prop (selectedIds+isAllSelected+isIndeterminate+onToggle) — wiring w R&P/Presentations wymaga stanu + paska akcji bulk = NIE-trywialne → TODO Fala 2.
- **SSOT ModuleMenu3 sam używa `primary-500/*` na active** (MENU_3_CHIP_ACTIVE/BADGE_ACTIVE/MENU_2_TAB_ACTIVE) — decyzja Fundamentu/Fali 0, nie ruszałem `shared/**`; gdy SSOT przejdzie na tokeny, huby dostaną to za darmo.
- **StudioView trzecia paleta `bg-slate-950`:** potwierdzona w `Studio/StudioCanvas.tsx`, `PresentationStudio/PresentationStudioPage.tsx` (+2 pliki) — Fala 2/3, tylko log.
- Przycisk primary inverse zrobiony ad-hoc klasami `bg-c-text text-c-surface` (brak wariantu w `ui/primitives/Button`) — kandydat na wariant współdzielony.
- `docs/qa` screenshoty light/dark NIE zrobione (brak przeglądarki w tej sesji) — wymagane przed „→UI".
