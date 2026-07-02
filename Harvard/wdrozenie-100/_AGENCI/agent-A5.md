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

### RAPORT 2026-07-02 · Fala 2 · Artefakty (Chat crimson-removal + Document Studio + Deck Builder)
**Branch:** `reskin/A5/wave-2` (baza `reskin/A5/wave-1`, worktree agent-ac31e69e2f45ebd25). Migracja: klasy CSS-only, zero zmian JSX/logiki. Weryfikacja: esbuild `--bundle` parse 9/9 OK (importy się rozwiązują → brak zerwanych referencji); wszystkie tokeny `c.*` potwierdzone w `tailwind.config.js`.

**Ekrany / pliki (9):**
1. **Chat — `AIChat/UnifiedChatPanel.tsx`** (crimson-removal, uwaga Piotra „czerwone bąble AI"): avatar „C" (typing) `bg-primary-50…border-primary-200`→`bg-c-surface-raised border-c-border` + ikona→`text-c-text-secondary`; history-toggle active `text-primary-600 bg-primary-50/50`→`text-c-text bg-c-surface-raised`; work-panel + autoread active (2×) `bg-primary-50/40`→`bg-c-surface-raised`; quick-prompt chip hover `hover:bg-primary-50…`→`c-surface-raised/c-text`; mode-tile „Analiza rynku" (jedyny crimson z 4, siostry emerald/amber/blue) `text-primary-500 bg-primary-50`→**indigo** (identity≠crimson); mode-tile hover-tytuł `group-hover:text-primary-600`→`c-text`; compact-empty „Teresa" pill (pełny crimson fill) `border-primary-500/30 bg-primary-500/10 text-primary-300`→`c-border/c-surface-raised/c-text-secondary`; **+2 dodatkowe hover-leaki:** resize-handle `group-hover:bg-primary-400`→`c-border-strong` (+`group-focus`→`c-focus-solid`), quick-prompts pill (input area) hover crimson→tokeny. **ZOSTAWIONE (brand celowy):** loading-spinner `border-primary-500`, welcome-name `text-primary-600`, private-mode ring `ring-primary-200` (RODO state indicator, NIE chrome), Sparkles/Teresa ikony.
2. **Chat — `AIChat/MessageRenderer.tsx`** (REAL „czerwony bąbel"): bąbel AI (Teresa) był już OK (document-style, bez tła) — czerwony jest **bąbel USER** (`bg-primary-50 text-primary-900 border-primary-100 dark:bg-primary-900/25`) → `bg-c-surface-raised text-c-text border-c-border`. To najprawdopodobniej źródło uwagi Piotra o „czerwonych bąblach". Zgodne SPEC-K §16 (user bubble = neutral surface).
3. `DocumentStudio/DocumentStudioView.tsx` — kontener `bg-slate-50 dark:bg-navy-950`→`bg-c-bg`; presence hint + empty state slate→`c-text-muted`.
4. `DocumentStudio/DocumentStudioEditorPanel.tsx` (24 hitów) — labelki (5×), selecty (2×), textarea, global-scope span, checkbox border, diff-panel + before/after pre, structured-changes lista, audit-trail → tokeny. **ZOSTAWIONE:** `sky-*` (semantyczny akcent edytora, nie crimson), `emerald` note (success), `danger` error.
5. `DocumentStudio/DocumentStudioOutlinePanel.tsx` — nagłówek/meta + karty sekcji (border/bg/3 role tekstu) → tokeny.
6. `Presentations/DeckBuilder/CardRenderer.tsx` — hover-ring bloku `group-hover:border-primary-400/50`→`c-border-strong`; **selection ring** slajdu `ring-slate-500 dark:ring-white/50`→`ring-c-focus-solid` (selection=blue, spec §18.1).
7. `Presentations/DeckBuilder/DeckBuilderBottomBar.tsx` — pasek (border/bg/3 role), „Ask Teresa" btn, notes-toggle active `bg-primary-500/10 text-primary-600`→`c-accent-soft/c-text`.
8. `Presentations/DeckBuilder/DeckBuilderTopBar.tsx` (24 hitów) — kontener, back, breadcrumb, 7× toolbar-btn (replace_all), undo/redo (2×), title-input **fokus** `border-primary-500 ring-primary-500/30`→`c-focus-solid/c-focus` (crimson-na-fokus = SYS), animacje-toggle + Teresa-toggle active crimson→`c-accent-soft/c-text`, Present primary `bg-navy-900`→inverse `bg-c-text text-c-surface`, confidentiality badge text. **ZOSTAWIONE:** GOVERNANCE_DOT + CONFIDENTIALITY (emerald/amber/orange/danger/blue = semantyczne statusy), `INCONCLUSIVE bg-slate-400` (neutralny dot „brak werdyktu").
9. `Presentations/DeckBuilder/CardCanvas.tsx` (11 hitów) — canvas bg `bg-slate-100 dark:bg-navy-950`→`bg-c-bg`; gap-actions (2×) crimson-hover→tokeny; layout-menu btn+popover, **layout-selector active** crimson→`c-focus-solid/c-accent-soft`, Regenerate primary `bg-navy-900`→inverse, speaker-notes panel + textarea **fokus** `ring-primary-500/20`→`c-focus`.

**KIMI (w zleceniu):** `AIChat/KimiWorkspace/TabeleView.tsx` + `PrezentacjeView.tsx` — **0 klas kolorów, 0 className** (czyste komponenty logiki/wrappery, delegują render do dzieci). Nic do reskinu — CZYSTE.

**DoD:** esbuild parse 9/9 OK; grep sanity: zero `navy-*`/`bg-white dark:`/crimson-na-fokus/status/selection w dotkniętych plikach; jedyne pozostałe `slate-*` = 2 neutralne status-doty (INCONCLUSIVE). Tokeny wszystkie zdefiniowane. `npm run build` NIE odpalony (zlecenie: klasy CSS-only + grep sanity; esbuild bundle potwierdza brak zerwanych importów). Screenshoty light/dark — brak przeglądarki w tej sesji → przed „→UI".

**DEFER (NIE ruszane, zalogowane):**
- **Chat SPEC-K strukturalne (B-1/B-2):** ramka wokół CAŁEGO czatu + logo niżej = layout, wymaga decyzji Piotra. Fala 2 zrobiła TYLKO crimson-removal.
- **StudioView `bg-slate-950` (trzecia paleta):** Fala 3.
- **Report Builder** przeniesienie do Materiały: decyzja/koordynacja z A3 — nie ruszane.
- **NIE DOTYKANE (pre-existing TS):** `DocumentStudio/editor/DocumentTipTapEditor.tsx`, `DocumentStudio/editor/tipTapToSchema.ts`.
- **Deck Builder reszta (~24 plików, ~360 hitów):** DeckAuditLogModal, ShareModal, DeckQualityGatesPanel, ThemeSwitcher, VersionHistoryPanel, PresentMode, SlideSorter, CommandPalette, BlockToolbar, CardFloatingToolbar, EditCardPopup, MediaLibraryBrowser, ShareAnalyticsPanel, DeckGovernanceCardModal, AgentActivityPanel, DeckBuilder(main), EditableBlock, TipTapEditor, PresenceIndicators, SourceTraceability, DeckThemeContext, DeckBuilderMelsView — modale/panele głębsze poza golden-path. Budżet ~10 plików wyczerpany na najwyżej-widocznych powierzchniach (Chat + DocStudio + shell decka). → Fala 2-cont / kolejna sesja A5.
- **Inverse primary** wciąż ad-hoc `bg-c-text text-c-surface hover:opacity-90` (brak wariantu w `ui/primitives/Button`) — kandydat na wariant współdzielony (przeniesione z Fali 1).

### RAPORT 2026-07-02 · Fala 3 · INSTRUMENTY §15 + trzecia paleta (branch `reskin/A5/wave-3` od `wave-2`)
**Zakres:** Studio (trzecia paleta ujednolicona do `c.*`) · MessageRenderer AI-widgets chrome · PresentationStudio preview surface.

**Pliki (9):**
1. `src/views/StudioView.tsx` — `bg-slate-950`→`bg-c-bg`; header `bg-slate-900/50`→`c.surface`, `border-white/10`→`c.border-subtle`; ikony/przyciski slate→`c.text-muted/c.text`; blue accent (badge typu, toggle chat, focus)→`c.accent`/`c.accent-soft`/`c.focus`; unsaved-dot→`c.warning`.
2. `src/components/Studio/StudioCanvas.tsx` — ReactFlow `bg-slate-950`→`bg-c-bg`; Panel/Controls/MiniMap `slate-800/90`+`white/10`→`c.surface-raised`/`c.border-subtle`; toggle grid/lock/snapshot/export→`c.*`; lock-banner amber=semantyczny (`c.warning`).
3. `src/components/Studio/StudioToolbar.tsx` — dock+tooltip+node-chipy→`c.*`; „More" blue→`c.accent`.
4. `src/components/Studio/StudioSidebar.tsx` — kontener→`c.surface`; search/lista/zaznaczenie blue→`c.accent`/`c.focus`; naprawiony zepsuty fallback `bg-navy-800/300/20`→`c.surface-raised`.
5. `src/components/Studio/StudioChat.tsx` — SPEC-K §16: bąble AI/user→`c.surface-raised`/`c.text` (avatar AI był crimson `primary-500/20`→neutral); input/send/quick-actions/typing-dots→`c.*`; brand Sparkles ZOSTAWIONY; suggestions amber=semantyczny.
6. `src/components/Studio/StudioExportModal.tsx` — modal+format-picker+toggle+quality→`c.*`; `#020617` w `toPng/toSvg` = wartość eksportu (JS, poza CSS) zostawiona.
7. `src/components/Studio/StudioLinkModal.tsx` — modal+taby+search+checkbox+footer→`c.*`; header icon `primary-*`(crimson)→`c.accent`.
8. `src/components/PresentationStudio/PresentationStudioPage.tsx` — light+dark slate/navy chrome (32 miejsc)→`c.*`; primary CTA `bg-navy-900...dark:bg-[#F4F7FB]`→`c.accent`; StatusBadge tone `slate`→`c.surface-raised`; amber „request approval"=semantyczny.
9. `src/components/AIChat/MessageRenderer.tsx` — proposal/deep-thinking/citation chrome (~90 miejsc) slate/navy/blue→`c.*`; `focus:ring-blue-500`→`c.focus`; navy secondary CTA→`c.accent`; state-chip: done=green/error=danger ZOSTAWIONE, active blue→`c.info`, idle→neutral; `primary-*` brand outline CTA ZOSTAWIONE (baza→`c.surface`); Sparkles+gradienty amber/emerald ZOSTAWIONE; struktura widżetów NIETKNIĘTA.

**DoD:** `c.*` (zero navy/slate/hex-class w chrome) ✅ · `tsc --noEmit` exit 0 / zero błędów w moich plikach ✅ · `build:shared` tsc ✅ · light+dark theme-aware ✅ · semantyka (success/warning/danger/info+brand) zachowana ✅.
**Weryfikacja wizualna:** NIE — worktree bez `node_modules` (vite niedostępne w izolacji). Wymaga preview/screenshot przy odbiorze.
**DEFER:** Chat SPEC-K ramka (layout/Piotr) · kolory DANYCH (`StudioCanvas` edge-stroke/minimap hex-JS, `StudioSidebar.getTypeColor`, `PresentationsHub SOURCE_TYPE_META.upload=slate`) · `tipTapToSchema` (pre-existing) · `ui/**`/`shared/**` nietknięte · zero npm/`-A`/merge.
