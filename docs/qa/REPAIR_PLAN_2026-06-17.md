# PLAN NAPRAWY WIZUALNEJ — całość aplikacji Consultify

**Data:** 2026-06-17
**Autor:** CTO + lead designer
**Status:** dokument roboczy (SSOT remediacji) — wynik pełnego re-audytu wizualnego 20 modułów (182 zrzuty, light+dark, po adversarial-verify)
**Kanon (autorytety):** `docs/ui-standards/CANON.md` · `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` · `docs/ui-standards/00-foundation/light-mode-readability.md` · katalog findingów `docs/qa/MASTER_VISUAL_QA_CATALOG.md` (VIS-001..019)

## Streszczenie stanu

Re-audyt obejmuje 20 modułów. Jakość: **0 reference**, **4 good** (chat, document-studio, initiatives, internal-tools), **16 needs-work** (admin-panel, audits, documents, execution, finance, interview, meeting, my-work, organization, partner-portal ×2 przebiegi, presentation-studio, results, review/notebook, settings ×3 przebiegi, table-studio, tools), **0 broken** (żaden moduł nie jest całkowicie niegrywalny — wszędzie renderuje się przynajmniej uczciwy stan). Łączny rozkład severities (po deduplikacji per moduł): około **1× P0** (VIS-013 Inbox crash — wymaga żywego stack-trace), **9× P1**, **40× P2**, **30× P3** — plus jeden klaster P1 systemowy (Settings dark-surface-leak w light) o charakterze blokera użyteczności. **Rdzeń długu = 6 wzorców systemowych** (selekcja crimson/rose VIS-009, primary-CTA crimson zamiast navy VIS-006, badge bez danger-fill w light VIS-001, fioletowe/violet CTA i powierzchnie spoza palety VIS-014, mix PL/EN VIS-018, dark-surface-leak w light mode) — naprawa tych 6 na poziomie tokenów i komponentów współdzielonych usuwa około 60% wszystkich findingów bez dotykania kodu poszczególnych modułów.

---

## 1. FIXY SYSTEMOWE NAJPIERW

Posortowane wg zysk/ryzyko (najwyższy zwrot na górze). Każdy fix to zmiana tokenowa lub w jednym komponencie współdzielonym, czyszcząca wiele modułów naraz.

### SYS-1 · Token selekcji `surface-selected` → neutral/info-blue (zastąpienie crimson/rose) — VIS-009
- **Zysk: bardzo wysoki · Ryzyko: niskie · Wysiłek: M**
- **Dotyka (12+ obszarów):** admin-panel (sub-nav active), audits (tab „All" fill), chat (sidebar item), initiatives (tło wiersza Team workload), my-work (Ideas selected row), organization (sidebar active), partner-portal (sidebar + karty Bank Transfer), presentation-studio (chip zakładki), review/notebook (selekcja notatki), settings ×3 (Language radio, sidebar active, option-cards Instant/Summary/HTML), table-studio (zakładki + wiersz), interview (badge Assigned indigo — pokrewne).
- **Root-cause locus:**
  - `src/components/MyWork/MyTasksListContent.tsx:123` → `TASK_SELECTED_ROW_CLASS = bg-primary-50 + inset primary.500 + ring-primary` (selekcja NIEscentralizowana — każda tabela ma własną klasę).
  - `src/components/MyWork/table/RowColoringConfig.tsx` (`*SELECTED_ROW_CLASS`).
  - Sidebar nav active: wspólny `SidebarNavItem` / per-moduł (`PartnerSidebar.tsx`, Settings sidebar, OrganizationNav, Admin sub-nav).
  - Definicja `surface-selected` w `light-mode-readability.md §3` mówi `bg-primary-50 border-primary-200 ring-primary-200` — ale `primary = crimson`, więc selekcja czyta się alarmowo.
- **Zmiana:** wprowadzić DEDYKOWANY token selekcji NIEzależny od `primary`: `--c-select-bg` (slate-100 / blue-50), `--c-select-border` (slate-300 / blue-200), `--c-select-accent` (info-blue zamiast crimson left-border). Zdefiniować w `src/index.css`. Utworzyć jedną klasę `SELECTED_ROW_CLASS` w jednym pliku (np. `src/components/shared/selectionTokens.ts`) i zrepointować wszystkie `*_SELECTED_ROW_CLASS` oraz sidebar-active na nią. Wiersze tabel: §3.5 kanonu `selected = primary-500/8 + 4px lewy akcent` — zaktualizować zapis kanonu, by akcent był info-blue, a nie crimson.
- **Ryzyko:** kosmetyczne; jedyny realny test to czy żadna selekcja nie zgubi widoczności (ring/border musi zostać). Weryfikacja before/after measure DOM.

### SYS-2 · Primary-CTA: jeden token navy (koniec crimson dla zwykłego CTA) — VIS-006
- **Zysk: bardzo wysoki · Ryzyko: niskie · Wysiłek: S–M**
- **Dotyka (13 modułów):** admin-panel (Add member), audits (New audit program), chat (New conversation), documents (New presentation/template), finance (mieszanka — patrz SYS-4), initiatives (New initiative), internal-tools (karta Memory & Scope OPEN crimson), meeting (New meeting), my-work, organization (Save), partner-portal (Save Changes/New Campaign/Zażądaj wypłaty), presentation-studio, results (PASS — już navy, nie ruszać), settings (Save Changes/Create Key/Add Webhook/Connect), table-studio, tools (Add).
- **Root-cause locus:** brak jednego wariantu `Button variant="primary"` mapowanego na navy. Crimson często pochodzi z gradientu/wrappera, nie z `backgroundColor` — mierzyć `background-image`. Per-moduł CTA: `Tools/*`, `Initiatives/*` topbar, `Menu 2 rightControls`, `menu3ActionButtonStyles.ts`.
- **Zmiana:** zdefiniować regułę §18.3: primary-CTA = navy token (`--c-accent`/navy), crimson zarezerwowany WYŁĄCZNIE dla Talk-to-Teresa i destructive. Zmapować `Button` variant `primary` → navy w SSOT przycisku; usunąć lokalne crimson/gradient warianty. Wzorzec referencyjny: Results „+ Add KPI" (już navy, PASS).
- **Ryzyko:** niskie; uwaga na rozróżnienie destructive (zostaje danger-red) i Teresa (zostaje crimson) — nie spłaszczyć ich do navy.

### SYS-3 · Badge danger/status: fill+border+text-800 w light (koniec „gołego" badge) — VIS-001
- **Zysk: wysoki · Ryzyko: niskie · Wysiłek: M**
- **Dotyka:** my-work (Critical/Inbox/Tasks bez fill, Decisions overdue szary), interview (badge light bez bordera, Submitted zielony), presentation-studio (draft/ready niewidoczny), table-studio (ready niewidoczny), tools (Active/Inactive bez fill), admin-panel (STATUS raw text), results (Below... bez fill), settings (task.updated chip).
- **Root-cause locus:** `src/components/MyWork/shared/PMOPriorityBadge.tsx` (light wariant fallback do neutral); lokalne `statusConfig` w `Interview/InterviewWorkspace.tsx` (STATUS_MAP); legacy `shared/StatusPill.tsx` + `src/constants/statusColors.ts` (~34 callerów do migracji); ad-hoc badge w hub-ach (presentation/table-studio).
- **Zmiana:** wymusić strukturę z `light-mode-readability §5` (tło-100 + border-200 + text-700/800; danger/warning/success → text-800; amber → text-amber-900). Docelowo migracja na rodzinę `ui/primitives/chips/StatusChip` + `statusChipTone()` (TABLE_AND_PREVIEW §4.1). Faza 1: naprawić `PMOPriorityBadge` light variant + dodać brakujące `bg/border`. Faza 2: zmigrować callerów `StatusPill`.
- **Ryzyko:** średnie — `statusChipTone()` musi pokryć wszystkie surowe statusy (m.in. `ready`, `submitted`, `assigned`); brak mapowania = fallback neutral (regresja). Zinwentaryzować enumy przed migracją.

### SYS-4 · Usunięcie fioletu/violet spoza palety (CTA + powierzchnie) — VIS-014
- **Zysk: wysoki · Ryzyko: niskie · Wysiłek: S**
- **Dotyka:** finance (CTA „+ New model/analysis/scenario/valuation", „Nowy case inwestycyjny" — fiolet; Statements crimson — niespójne), review/notebook (CTA „AI proposal", badge „Uploaded file", nagłówek paska — violet `rgb(107,48,121)`), my-work Calendar (event bars violet-600 — kolor poza paletą), interview/my-work/tools (progress in-progress indigo zamiast info-blue — VIS-005, rodzina pokrewna).
- **Root-cause locus:** `src/components/Finance/*` topbar create-CTA (gradient violet); `src/components/MyWork/notebook/NotebookCanonicalPathStrip.tsx` (inline `bg-purple/violet`); My Work Calendar event-bar renderer (`CalendarContent`) — hardcoded violet fill zamiast `categoryTone()` na neutralnym shellu; `ProgressCell` / lokalne paski progresu (indigo→`--c-info`).
- **Zmiana:** finance-CTA → navy (zgodnie z SYS-2). Notebook violet → navy/neutral wg palety. Calendar → identity-dot `categoryTone()` (c-tag-1..12) na neutralnym pasku zdarzenia, NIE solid violet fill (§4.0a — MUST NOT solid color fill). Progress in-progress → `--c-info` (blue).
- **Ryzyko:** niskie; Calendar wymaga decyzji wizualnej (dot vs cienki bar) — patrz „do weryfikacji na żywo".

### SYS-5 · i18n: jeden język per locale (koniec mix PL/EN + ALL-CAPS-zdań) — VIS-018
- **Zysk: średni-wysoki · Ryzyko: niskie · Wysiłek: M**
- **Dotyka:** documents (taby EN ↔ chipy statusu PL), finance (breadcrumb „Investment" ↔ tab „Analiza inwestycyjna" ↔ CTA „Nowy case inwestycyjny" Polglish), partner-portal (Commission Earnings PL/EN mix, Statements), tools (Sessions „Sesja"/„Session"), audits/documents/finance/partner (empty-state hint ALL-CAPS pełnym zdaniem — kicker na zdaniu).
- **Root-cause locus:** hardcodowane stringi zamiast `t()`: `Finance/*` (labels + breadcrumb mapping), `Documents` status->label map, `Partner/CommissionEarnings`, `Tools` title suffix („— Sesja"). Empty-state: klasa `uppercase` na pełnym zdaniu.
- **Zmiana:** przeprowadzić zakładki/chipy/CTA/empty-hints przez `useTranslation` + klucze w `public/locales/*`. Empty-state hint = normalny case (uppercase tylko dla mikroetykiet/kickerów, §2).
- **Ryzyko:** niskie; uwaga na brakujące klucze w niektórych locale (DE/ES/JP/AR — patrz `finding_landing_i18n_gaps`).

### SYS-6 · Settings light-mode: usunięcie dark-surface-leak / stuck-scrim (P0-grade) — nowy systemowy, related VIS-001/VIS-019
- **Zysk: wysoki (bloker użyteczności) · Ryzyko: średnie · Wysiłek: M**
- **Dotyka:** wyłącznie settings, ale CAŁA rodzina paneli: Behavior & Instructions, Autocomplete, Availability, AI Data & Privacy, Authentication & Access, Voice & TTS, Notifications (Overview/Email&Digest/Desktop&Sounds), AI&Automation (Memory/Model&Parameters/Prompt Library), Security. Trzy przebiegi audytu opisują to samo: główna karta treści renderuje się jako CIEMNA powierzchnia (slate-700/800) w trybie LIGHT, miejscami z wrażeniem stałego scrimu/overlay; inputy date/number jako navy fill.
- **Root-cause locus:** wspólny wrapper kart sekcji Settings (np. `SettingsSectionCard` / `AISettingsPanel` / `SettingsPanelShell`) ma wariant `dark:` BEZ poprawnego odpowiednika light → fallback do ciemnego tła. Hipoteza alternatywna: pozostawiony `bg-black/40` / `opacity` / `saving`-overlay niezdejmowany po fetchu (LoadingOverlay stuck).
- **Zmiana:** doprowadzić wrapper do `surface-default` (bg-white + border-slate-200) w light; inputy → `light-mode-readability §7` (bg-white border-slate-300). Jeśli to overlay-bug — usunąć stuck scrim. **WYMAGA pomiaru DOM na żywo** (dark-surface vs overlay to dwa różne fixy) — patrz sekcja 5.
- **Ryzyko:** średnie — trzeba ustalić, czy to klasa surface czy overlay, zanim ruszymy.

### SYS-7 · Status raw-text / kolumna STATUS → StatusChip (admin + interview manualne tabele)
- **Zysk: średni · Ryzyko: niskie · Wysiłek: M**
- **Dotyka:** admin-panel (STATUS goły tekst, case `active`/`ACTIVE`), interview (5 ręcznych tabel z lokalnym systemem statusów), documents/tools (EXPORTS/Category malowane tekstem zamiast chipa).
- **Root-cause locus:** `AdminSettingsModule` (Members & Roles render komórki STATUS = raw `member.status`); `Interview/*` ręczne `<table>` (świadomy wyjątek §2.2, ale statusy lokalne); `Tools/Library` kolumna category/license (`text-emerald` inline zamiast `MetaChip` + `categoryTone` dot).
- **Zmiana:** użyć `EntityStatusChip`/`statusChipTone()` dla STATUS; `MetaChip` + identity-dot dla kolumn tożsamości (§4.0a — shell neutralny, sygnał w kropce). Interview: migracja statusów na `c.*` (`submitted→warning`, `assigned→neutral`, in-progress progress→`--c-info`).
- **Ryzyko:** niskie; Interview to wyjątek §2.2 — nie przepisywać tabel, tylko podmienić renderer statusu/progresu.

### SYS-8 · Preview-pane parytet stopki (Open/kolory/kształt) — VIS-011 (przeniesione z A1, nadal otwarte)
- **Zysk: średni · Ryzyko: niskie · Wysiłek: M**
- **Dotyka:** każda tabela z preview (My Work, Interview ×5, Tools, Execution, Results, Initiatives, partner, finance — jeśli mają być tabelami encji).
- **Root-cause locus:** `src/components/shared/PreviewPane/{previewStyles.ts, PreviewActionBar, PreviewRelations.tsx}` + `MyWork/table/RowDetailPanel.tsx`. `PreviewActionBar` ma 22 użycia — audyt parytetu: które tabele NIE używają.
- **Zmiana:** ujednolicić stopkę (§7.3b: AI hints → divider → Relations → Actions pill h-9; `actionPillClass()` jako jedyny SSOT). Zweryfikować obecność jednego „Open" (UWAGA #15 — Initiatives board-preview).
- **Ryzyko:** niskie; ale zawiera otwarty wątek crashu `PreviewRelations` React #31 — patrz sekcja 5.

---

## 2. PLAN PER MODUŁ

Legenda: **[SYS-n]** = pokryte fixem systemowym (nie powtarzać roboty). **[LOK]** = praca lokalna w module.

### admin-panel — needs-work
- **P2 [SYS-1]** Active sub-nav „Team & Access" rose/crimson → token selekcji neutral/blue. Locus: `Admin/AdminSettingsModule` sub-nav active class. (VIS-009)
- **P2 [SYS-2]** „Add member" crimson vs „Generate code" navy vs „Transfer Ownership" neutral → ujednolicić primary na navy. Locus: AdminSettingsModule button variant. (VIS-006)
- **P2 [SYS-7]** Kolumna STATUS raw text + case `active`/`ACTIVE` → `EntityStatusChip`. Locus: Members & Roles table STATUS cell. (VIS-001)
- **P3 [SYS-7]** STATUS bez chipa = brak rozpoznawalności w grayscale → ten sam fix chip. (§8)
- **P3 [LOK]** Tabela ręczna `<table>` zamiast FilterableTable (brak preview/filtrów). Locus: AdminSettingsModule. Niski priorytet — rozważyć migrację w Fazie 3 (TABLE_AND_PREVIEW §1.1/§2).

### audits — needs-work
- **P2 [LOK]** Inline czerwony banner błędu bez ikony/kontenera/retry + raw-techniczny komunikat („Requests blocked by global transport safeguard") → kanoniczna karta błędu + retry + przyjazny komunikat (CANON §4.1, TABLE §10). **Zdiagnozować fetch/transport-safeguard** — patrz sekcja 5. Locus: `Audits/*` error banner.
- **P2 [SYS-2]** „New audit program" crimson → navy. Locus: `Audits/*` header CTA. (VIS-006)
- **P3 [SYS-1]** Aktywny tab „All" crimson fill → token selekcji. (echo VIS-009)
- **P3 [LOK]** Placeholder „Select a program..." zbyt wyblakły → `text-slate-600` (§2). Locus: `Audits/*` dashboard placeholder.
- **P3 [LOK]** Empty-state dashed ultra-subtelne bordery (light) → widoczny border (§3). Locus: `Audits/*` empty card + prawy panel.

### chat — good
- **P2 [LOK]** Composer „Ask Teresa…" tworzy pustą otchłań w centrum przed chipami sugestii → przebudowa rytmu/gęstości landing (VIS-003). Locus: do ustalenia (composer + suggestion chips layout). Patrz sekcja 5 (locus nieznany).
- **P3 [SYS-2]** Sidebar „New conversation" crimson-fill → navy (VIS-006). PASS: „Talk to Teresa" crimson = legalny budżet marki — NIE ruszać.

### document-studio — good
- **P3 [LOK]** Light: brak rozwarstwienia surface — formularz płasko na slate-50 → owinąć w `surface-default` kartę. Locus: `DocumentStudio/DocumentStudioView.tsx:227` (bg-slate-50) + `DocumentStudioIntakeForm.tsx`. (§3/§12)
- **P3 [SYS-2/chrome]** Crimson underline aktywnej zakładki z wspólnego TopBar → navy (systemowe, nie per-moduł).
- **P3 [LOK/global]** Amber ikony prawego raila (help/feedback FAB) — graniczne, prawdopodobnie globalny komponent poza modułem; zweryfikować osobno.

### documents — needs-work
- **P1 [LOK]** Kolumna OWNER = raw UUID zamiast nazwy (Presentations/Sheets) → `AssigneeCell` z mapowaniem `user_id→display name` (§3.3, CANON §4.1). Locus: `Documents|DeliverablesLibrary` kolumna owner.
- **P2 [SYS-5]** Mix PL/EN (taby EN, chipy statusu PL) → i18n. Locus: status->label map. (VIS-018)
- **P2 [SYS-5]** Empty/error ALL-CAPS pełnym zdaniem → normalny case. (VIS-018)
- **P2 [LOK]** Stan błędu bez Retry → karta błędu + retry (§10). Locus: Documents Presentations error state. (VIS-016)
- **P2 [LOK]** Niska jakość seed (Sheets: powtarzalne tytuły, identyczne metadane, truncate „Utw") → deduplikacja seed + realne dane (§8.1/§13). (VIS-017)
- **P3 [LOK]** EXPORTS goły tekst „XLSX" → `MetaChip` (§3.3/§4.0a).

### execution — needs-work
- **P3 [LOK]** DEADLINE + osobna kolumna ALERTS → rozważyć konsolidację do jednego `DueChip` (§4.4). Locus: `Execution/Summary`. (conf:low — patrz sekcja 5)
- **Uwaga z opisu (do dopisania jako findingi w backlogu, nie w głównej liście):** nadużycie czerwieni na DEADLINE mimo Overdue=0 → czerwień tylko realny overdue (§4.0/§4.4); liczniki „CRITICAL" crimson na danych; pastelowe obwódki kart Management (status-tinted container, zakaz §3/§4); duplikaty seed (DevOps ×3, QMS ×3) + rozjazd „Active/All 9" vs 6 wierszy. Wszystkie pokryte regułą budżetu czerwieni + light-tinty (SYS-3/SYS-4 rodzina) + seed cleanup.

### finance — needs-work (poza scope A1, pełny re-audyt potwierdza VIS-014/015/018)
- **P2 [SYS-4]** Primary-CTA fioletowy → navy. Locus: `Finance/*` topbar create-CTA (gradient violet). (VIS-014)
- **P2 [SYS-2/SYS-4]** Niespójność: Statements crimson vs reszta fiolet → jeden navy. (VIS-014)
- **P2 [LOK]** Pasek 10+ chipów filtra przeładowany → redukcja/grupowanie (§15, VIS-007). Locus: `Finance/*` command row filter chips. (VIS-015)
- **P2 [LOK]** Liczniki chipów NIE scoped do zakładki (te same na Enterprise valuation z 0 rekordów) → query per-tab. Locus: chip counters. (VIS-015)
- **P3 [LOK]** Zero-pad „Linkages 01" + „% w rzędzie liczników" → spójny formatter. (VIS-015)
- **P2 [SYS-5]** Mix PL/EN (breadcrumb/tab/CTA/treść) → i18n. (VIS-018)
- **P3 [SYS-5]** Empty-state hint ALL-CAPS pełne zdanie → normalny case. (VIS-018)
- **P3 [LOK]** Zdublowany nagłówek „TYPE" w tabeli Analysis → poprawić columns def. Locus: `Finance/*` Analysis columns. (nowy, conf:medium)

### initiatives — good
- **P1 [SYS-1]** Tło wiersza „Team workload" barwione statusem (rose/magenta) — złamanie §3.5 (MUST NOT tła wiersza barwionego statusem) → neutralizacja + sygnał w chipie/kropce. Locus: `Initiatives/Analysis/*` ResourcesView renderer wiersza. (VIS-009)
- **P2 [SYS-2]** „New initiative" crimson → navy. Locus: `Initiatives/*` topbar. (VIS-006)
- **P2 [SYS-3]** Badge „Overallocated" crimson/rose → `--c-danger` token. Locus: `Initiatives/Analysis/*` status->tone. (VIS-001)
- **P3 [LOK/shell]** Tło app light = slate-50 zamiast slate-100 → `surface-app`. Locus: shell/layout (wspólny). (§3)
- **P3 [LOK]** Chip „AI Balance workload" z niebieskim tłem shellu → neutralny shell, sygnał w kropce (§4.0a/§4.5). Locus: `Initiatives/Analysis/*` pasek pod-filtrów.

### internal-tools — good
- **P2 [SYS-2/SYS-1]** Karta „Memory & Scope" OPEN crimson + crimson border vs neutral na innych → ujednolicić na neutral. Locus: `InternalTools/views/internal-tools` ToolCard warunek koloru OPEN. (VIS-006)
- **P3 [LOK]** „OPEN" goły uppercase bez struktury badge → badge tło+border+tekst (§5). Locus: ToolCard nagłówek/odznaka.
- **P3 [LOK]** Surowe enumy snake_case w copy („PASS_WITH_LIMITATIONS") → etykiety domenowe (CANON §4.1). Locus: callout „Manual gate checklist".

### interview — needs-work
- **P2 [SYS-7]** Status „Submitted" zielony (success) zamiast amber (warning) → `submitted='warning'`. Locus: `Interview/InterviewWorkspace.tsx` STATUS_MAP. (CANON §4.2)
- **P3 [SYS-3]** Badge'y light bez bordera, tekst <800 → migracja na `ChipBase`/`EntityStatusChip`. Locus: lokalny statusConfig. (VIS-001)
- **P3 [SYS-4]** Progress in-progress indigo/fiolet → `--c-info`. Locus: `ProgressCell`/lokalny pasek. (VIS-005)
- **P2 [SYS-7]** Badge „Assigned" indigo/lawenda → neutral-slate (§4.1; indigo=identity, nie status). Locus: STATUS_MAP `assigned`.
- **P3 [LOK]** Initiatives: duplikat tytułu + tytuł-timestamp ISO → fix fallback tytułu + dane testowe. Locus: generowanie tytułu z insightu.
- **PASS (nie ruszać):** primary-CTA już navy; DueChip jako jedna kolumna; kebab/wyrównanie spójne.

### meeting — needs-work (cały moduł w stanie błędu fetch — ocena tylko chrome + error state)
- **P2 [SYS-2]** „New meeting" crimson → navy. Locus: `Meeting/*` Menu 3 / `menu3ActionButtonStyles.ts`. (VIS-006)
- **P2 [LOK]** Liczniki chipów filtra „0" mimo niezaładowanych danych (nieuczciwy UI) → `undefined` w stanie error/loading, nie domyślne 0 (CANON §4.1). Locus: `Meeting/*` pasek chipów. (VIS-015)
- **P3 [LOK]** Generyczny „Something went wrong" → konkretniejszy stan (§4.1). Locus: wspólny ErrorState. (VIS-016)
- **P3 [LOK]** Light: „Try again" + chip-row słaba separacja → surface separation (§3/§9).
- **BLOKER:** faktyczny fetch-bug listy meetingów (VIS-016) — diagnoza backendu PRZED resztą; **patrz sekcja 5** (env-specyficzne czy realne).

### my-work — needs-work
- **P1 [SYS-3]** „Critical" badge bez danger-fill w light (icon-only) → fill+border+text. Locus: `PMOPriorityBadge`. (VIS-001)
- **P2 [SYS-4]** Calendar event bars solid violet-600 → identity-dot `categoryTone()` na neutralnym shellu (§4.0a MUST NOT solid fill). Locus: CalendarContent event-bar renderer. **Decyzja wizualna — patrz sekcja 5.**
- **P3 [SYS-3]** Decisions overdue DueChip neutralny szary (brak danger) → danger przez DueChip (§4.4). Locus: Decisions due-date cell. (VIS-001)
- **P2 [SYS-8/SYS-3]** Overdue niespójne (Tasks red clock vs Decisions grey) → oba przez wspólny `DueChip` (§4.4/§3.3). Locus: `MyTasksListContent` vs Decisions table.
- **P3 [SYS-4]** „In progress" dot indigo → `--c-info`. Locus: statusChipTone / lokalny Tasks config. (VIS-005)
- **P2 [SYS-1]** Ideas selected row rose/primary-100 → token selekcji neutral/blue. Locus: `RowColoringConfig`/SELECTED_ROW_CLASS. (VIS-009)
- **P3 [LOK/data]** Inbox received-dates wszystkie aging-critical crimson (stare demo) → odświeżyć seed (intencjonalny aging, nie leak — VIS-002). Locus: AGING_STYLES + dane.
- **P3 [LOK/data]** Manager „Team Capacity 512% utilized" — niemożliwa metryka → fix agregacji/danych (CANON §4.1). Locus: Manager portfolio-health calc. (conf:low — sekcja 5)

### organization — needs-work
- **P2 [SYS-2]** „Save" crimson `rgb(133,25,48)` → navy. Locus: `Organization/**/OrganizationProfile*.tsx`/`CompanyProfile*.tsx`. (VIS-006)
- **P2 [SYS-1]** Aktywny nav rose tint `rgb(253,242,243)` + crimson text `rgb(109,20,39)` → token selekcji. Locus: `SidebarNavItem`/`OrganizationNav`. (VIS-009)
- **P3 [LOK]** Ikony nagłówków sekcji dekoracyjnie crimson `rgb(168,45,73)` → neutral/slate (czerwień poza budżetem; dekoracja). Locus: section header icons.
- **P3 [LOK]** „Completeness" za jasna `rgb(184,192,203)` (~slate-300/400) → `text-slate-600` (§2/§9). Locus: OrganizationProfile label.
- **P3 [LOK/perf]** Dark = tylko spinner → re-capture po pełnym załadowaniu (nie bug). **Sekcja 5.**
- **PASS:** Teresa „Go"/„Save"/„AI Guide" crimson = dozwolone (branding Teresa).

### partner-portal — needs-work (dwa przebiegi audytu — scalone)
- **P1 [SYS-5]** Mix PL/EN na Commission Earnings (stat-cards + statusy) → i18n. Locus: `Partner/CommissionEarnings` + `views/partner/CommissionView.tsx`. (VIS-018)
- **P2 [SYS-2]** Primary-CTA crimson (Save Changes/New Campaign/Zażądaj wypłaty/Add organization/Eksport CSV) → navy. Locus: `views/partner/DirectoryView.tsx`, `ReferralToolsSection.tsx`, `EarningsSection.tsx`, per-view CTA. (VIS-006)
- **P2 [SYS-1]** Selekcja sidebara + karty Bank Transfer rose tint + crimson akcent → token selekcji. Locus: `Partner/PartnerSidebar.tsx` active + Payout card. (VIS-009)
- **P2 [LOK]** Banery „Summary" (V8 Earnings/Customer Acquisition/Runtime/Referral) w `bg-primary-50 + border-primary-200` jako dekoracja → neutral surface (crimson nie na danych). Locus: `Partner/PartnerRuntimeSummaryStrip.tsx:153` + summary-cards w EarningsSection/ReferralToolsSection. (VIS-002)
- **P2 [LOK/data]** Raw ISO timestamps („2026-04-25T05:00:00.000Z") + raw UUID jako identyfikator klienta (Payout History, Referred Customers) → formatować datę + `id→display name` (CANON §4.1). Locus: `EarningsSection.tsx` + lista Referred Customers.
- **P2 [LOK]** Chip „Assessment 0/5" różowy (neutralny licznik jak alarm) → usunąć rose tint. Locus: `DirectoryView.tsx`.
- **P2 [LOK]** KPI-tile Partner Runtime Summary pastelowo-rose (crimson na danych neutralnych) → surface separacja bez crimson (§3). Locus: PartnerRuntimeSummary. (VIS-002)
- **P2 [SYS-5]** Mix PL/EN w Statements → i18n. (VIS-018)
- **P2 [LOK]** Listy (Referred Customers/Commission Statements/Campaign Links) bez kanonicznej FilterableTable + preview → migracja (§1.1/§13). Locus: `views/partner/*`. (VIS-011, conf:low — Faza 3)
- **P3 [LOK]** Ikony-awatary org w różowych boxach (crimson dekoracyjny) → neutral/identity (§4.0a). Locus: `ClientAccessView.tsx`/`DirectoryView.tsx`.
- **P3 [LOK]** ALL-CAPS crimson kicker „LIFECYCLE: PAYOUT" → `text-slate-500` (§2). Locus: `PartnerRuntimeSummaryStrip.tsx`.
- **P3 [LOK]** Copy-to-clipboard/akcje linków crimson (My Links & Codes) → neutral/ghost. Locus: `ReferralToolsSection.tsx`.
- **P3 [LOK]** Niespójna ikona Refresh między zakładkami → ujednolicić (CANON §1). Locus: `CompanyInfo` vs `Dashboard/ActiveProjects`.
- **P3 [LOK/perf]** Client Access Manager spinner zamiast skeleton; Certificates/Exams złapane w skeleton (loading); Revenue Over Time pusty box → empty/loading state (§10). **Re-capture — sekcja 5.**

### presentation-studio — needs-work
- **P2 [SYS-1]** Aktywny chip zakładki (Templates/Recent/Saved) crimson → navy/primary token. Locus: segmentowany przełącznik. (VIS-006)
- **P2 [SYS-3]** Badge „draft"/„ready" w light bez fill/border (szary, nieczytelny) → `EntityStatusChip`/`statusChipTone()`. Locus: renderer statusu Recent/Saved. (VIS-001)
- **P1 [LOK/data]** Recent i Saved identyczna lista 6 pozycji (scope niezsynchronizowany) → rozróżnić query (recent=all, saved=savedOnly). Locus: fetch/filter hub. (sekcja 5 — weryfikacja danych)
- **P2 [LOK/data]** Duplikaty szablonów (Assessment Summary ×3, Tool Workshop ×3, Steering Committee ×3, Valuation Pack ×2) → deduplikacja seed. Locus: seed/`presentationTemplates`. (VIS-017)
- **P3 [LOK]** Karty szablonów bez anatomii GridCard (brak badge row/stats footer/kebab) → `GridView`/GridCard (§8.1). Locus: TemplateCard. (Faza 3)
- **P2 [LOK]** Recent/Saved nie kanoniczna tabela (brak preview/filtrów/row actions) → `TableWithPreviewLayout` (§7/§13). (Faza 3)
- **P3 [LOK]** Status „ready" spoza taksonomii → dodać do `statusChipTone()` (część SYS-3 inwentaryzacji).

### results — needs-work
- **P2 [LOK]** Wartości CURRENT renderowane crimsonem (czyta się jak alarm) → metadata/liczby nie crimson (§4.0/§18.1). Locus: KPI table CURRENT cell (`KPIListTable`/`KpiValueCell`). (VIS-002)
- **P3 [LOK]** Status „Below..." nad-truncate → zwiększyć min-width kolumny STATUS (§3.3). Locus: tabela KPI columns.
- **P3 [LOK]** Nagłówek „NEEDS ENTRY" łamie się na 2 linie → skrócić label / min-width (§3.2).
- **P3 [LOK]** Pusty wykres „Initiative Contributions to ROI" (płaska linia) → empty-state (§10). Locus: ROI Analysis chart. (sekcja 5 — dane)
- **P3 [LOK/perf]** ROI/ROI Analysis light loading spinner bez skeletonu → spójny loading (§10).
- **P2 [LOK]** Badge „Needs entry" anomalna geometria (rozlany amber pill poza komórką) → poprawić chip layout. (z opisu — dopisać do backlogu)
- **PASS:** CTA „+ Add KPI"/„Record ROI" navy — wzorzec referencyjny dla SYS-2.

### review (My Work → Notebook) — needs-work
- **P2 [LOK/broken]** Raw token „FileText" renderowany jako tekst przed tytułem notatki → mapować ikonę przez komponent, nie nazwę (CANON §4.1). Locus: `MyWork/notebook/` NoteListItem (gałąź type==='file'/'canvas').
- ~~**P2 [LOK]** Pasek „CANONICAL NOTEBOOK PATH" ~40% kanwy → wdrożyć SPEC_07 (slim progres-chip ①Sources·②AI·③Review·④Convert). Locus: `NotebookCanonicalPathStrip.tsx:25-179` (render `NotebookContent.tsx:2503-2523`). (VIS-012 — design, czeka na akceptację Piotra)~~ **DONE** — `NotebookProgressChip.tsx` (L-03) w użyciu od `NotebookContent.tsx:2579`; stary `NotebookCanonicalPathStrip` nie jest renderowany.
- **P2 [SYS-4]** Violet `rgb(107,48,121)` na „AI proposal"/badge „Uploaded file"/nagłówku → navy/neutral. Locus: `NotebookCanonicalPathStrip.tsx`. (VIS-014)
- **P2 [SYS-1]** Selekcja notatki rose + crimson lewy akcent → token selekcji. Locus: lewa lista item selected. (VIS-009)
- **P3 [LOK]** Lista notatników bez karty (pływa po slate-50) → `surface-default` (§3.1). Locus: NotebookListContent wrapper.
- **P3 [LOK]** Niespójna terminologia „NOTES/16" vs „16 pages" → ujednolicić (CANON §5).

### settings — needs-work (trzy przebiegi audytu — scalone; najcięższy klaster systemowy)
- **P0-grade/P1 [SYS-6]** Cała rodzina paneli (Behavior&Instructions, Autocomplete, Availability, AI Data&Privacy, Authentication&Access, Voice&TTS, Notifications, Security) ciemna powierzchnia / stuck-scrim w light → fix wspólnego wrappera. **WYMAGA pomiaru DOM — sekcja 5.** (VIS-001/VIS-019/VIS-008)
- **P1 [LOK]** i18n bug: „settings.ai.tone/formality/verbosity (en) returned an object instead of string" — raw klucze w UI (CANON §4.1) → poprawić klucze w `public/locales/en/translation.json` (zdefiniowane jako obiekt) lub czytać `t('...label')`. Locus: translation.json + komponent.
- **P2 [SYS-1]** Selekcja języka radio + option-cards (Instant/Summary/HTML/Top Right) crimson/rose → token selekcji. Locus: radio/option-card selected. (VIS-009)
- **P2 [SYS-2]** Primary-CTA crimson (Save Changes/Create Key/Add Webhook/Connect/New Prompt) → navy. (VIS-006)
- **P2 [SYS-3/LOK]** Badge „task.updated" (event chip) różowy crimson fill → neutral MetaChip. Locus: renderer chipów eventów webhooka. (VIS-001)
- **P3 [SYS-1]** Sidebar active crimson → navy accent. (VIS-009)
- **P2 [LOK]** Toggle „Show Greeting Message" crimson vs Widget Visibility emerald — niespójna semantyka toggle → jeden komponent Toggle. Locus: Display Options vs Widget Visibility.
- **P2 [LOK]** KPI-kafelki Usage Dashboard pełno-wypełnione tonami semantycznymi (rose/green/amber) dla neutralnych liczb → neutralny surface metryki (§4.0). Locus: AI Usage Dashboard StatTile. (VIS-002)
- **P3 [LOK]** Tekst roli „DBR77" w crimson → `text-supportive` (§18.1). Locus: Profile identity card.
- **P3 [LOK]** Webhook „Inactive" zielona kropka (sukces dla stanu nieaktywnego — kolizja znaczenia) → neutral/grey dot.
- **P3 [LOK]** Connected Apps „Coming soon" zbyt jasny + Connect crimson → kontrast + navy.
- **P3 [LOK]** Empty-state „Get started by creating your first item." generyczny → domenowy label (API Keys).
- **P3 [LOK/data]** Zrzut `work-preferences-light.png` pokazuje Profile, nie Work Preferences → fix mapowania capture (`docs/qa/capture-*.mjs`).
- **PASS:** Profile/my-settings, Language, Admin Billing&FinOps, Calendar Sync, Chat History — czyste.

### table-studio — needs-work
- **P1 [LOK/data]** Saved = identyczna zawartość co Recent (lista nie-scoped) → filtr `scope=saved|recent`. Locus: `views/table-studio/*` hub fetch. (VIS-015, sekcja 5 — dane)
- **P2 [SYS-1]** Selekcja zakładek crimson/rose → navy token. Locus: segment tabs hub. (VIS-009)
- **P2 [SYS-3]** Badge „ready" bez tła/bordera w light → `EntityStatusChip`. Locus: renderer wiersza Recent/Saved. (VIS-001)
- **P2 [LOK/data]** Ucięte tytuły encji („Utw" zamiast „Utwórz...") → fix fallback tytułu (§15.3 Formuła 3). Locus: mapowanie tytułu zapisanej tabeli.
- **P2 [SYS-1]** Wiersz Recent/Saved rose/crimson lewy akcent → token selekcji. (VIS-009)
- **P3 [LOK]** Listy Recent/Saved bez anatomii (preview/status-chip/kebab) → `TableWithPreviewLayout`/RowActionsMenu (§7/§9). (Faza 3)

### tools — needs-work
- **P2 [SYS-2]** „Add" crimson → navy (każda zakładka). Locus: `Tools/*` Menu 2 rightControls. (VIS-006)
- **P2 [SYS-7]** Kolumna tożsamości (Category/License) kolorowy tekst emerald → `MetaChip` + `categoryTone` dot (§4.0a). Locus: `Tools/Library` cell renderer.
- **P2 [LOK/data]** Raw HTML entity „&amp;" w tytułach sesji → dekodowanie (CANON §4.1). Locus: Sessions name cell / seed.
- **P2 [SYS-5]** Mix PL/EN („Sesja" vs „Session") → i18n (usunąć doklejany suffix hardcode). Locus: Sessions title composition. (VIS-018)
- **P3 [SYS-3]** Badge Active/Inactive bez fill/bordera w light → chip light variant. (VIS-001)
- **P3 [SYS-4]** Progress in-progress indigo → `--c-info`. (VIS-005)
- **P3 [LOK]** ROI „4.7x" zielony jak sygnał sukcesu na danych neutralnych → neutralny (§18.1). Locus: Initiatives ROI cell.
- **P3 [LOK/data]** Duplikat 3 identycznych wierszy w Initiatives → seed cleanup.

---

## 3. KOLEJNOŚĆ WYKONANIA

### Faza 1 — P0/P1 + fixy tokenowe (największy zwrot, najmniejsze ryzyko)
Wykonać w tej kolejności; SYS-1/2/3/4 są niezależne i mogą iść równolegle.
1. **SYS-6** Settings dark-surface-leak/scrim w light — PRZED tym pomiar DOM (sekcja 5). Bloker użyteczności. Zależność: brak; ale wymaga diagnozy surface-vs-overlay.
2. **SYS-1** Token selekcji neutral/blue (VIS-009) — czyści 12+ obszarów. Zależność: zdefiniować `--c-select-*` w `src/index.css` najpierw.
3. **SYS-2** Primary-CTA navy (VIS-006) — czyści 13 modułów. Zależność: SSOT przycisku.
4. **SYS-3** Badge danger-fill w light (VIS-001) — Faza 1a: `PMOPriorityBadge` light; inwentaryzacja enumów dla `statusChipTone()`.
5. **SYS-4** Usunięcie violet/indigo spoza palety (VIS-014/VIS-005) — finance CTA, notebook, my-work Calendar (Calendar po decyzji wizualnej), progress→info.
6. **P1 lokalne:** documents OWNER UUID; settings i18n object-key bug; partner Commission Earnings i18n; initiatives Team workload row (część SYS-1); review FileText raw token; my-work Critical badge (część SYS-3); presentation/table-studio scope Recent/Saved (po weryfikacji danych — sekcja 5).

### Faza 2 — P1 reszta + diagnozy backendowe
- **SYS-6** dokończenie po pomiarze.
- **meeting** fetch-bug (VIS-016) diagnoza i fix backendu.
- **audits** transport-safeguard banner — diagnoza fetch + kanoniczna karta błędu.
- Seed/data P1: presentation-studio + table-studio scope, documents seed quality.

### Faza 3 — P2 spójność
- **SYS-5** i18n sweep (documents/finance/partner/tools) — jeden język per locale + empty-hints normalny case.
- **SYS-7** STATUS raw-text → chip (admin/interview/tools/documents EXPORTS).
- **SYS-8** preview-pane parytet stopki (VIS-011) + verify crash `PreviewRelations`.
- Finance chipy filtra (scope per-tab + redukcja + formatowanie).
- Migracje do FilterableTable/TableWithPreviewLayout: partner listy, presentation/table-studio Recent/Saved, admin Members&Roles. (Większe — można rozłożyć.)
- Settings toggle/KPI-tile semantyka kolorów.

### Faza 4 — P3 polish
- Placeholdery/kontrast (audits, organization Completeness, settings Coming soon).
- Surface separation kart formularzy (document-studio, notebook lista, initiatives slate-100).
- GridCard anatomia (presentation/table-studio kafle).
- Drobiazgi: nagłówki kolumn (results NEEDS ENTRY, finance duplikat TYPE), ikony Refresh (partner), terminologia NOTES/pages (notebook), enumy snake_case (internal-tools), ROI/Category kolor (tools), webhook Inactive dot.
- Seed cleanup pozostałe (execution duplikaty, tools Initiatives, my-work Inbox aging dates, Manager 512%).
- review/notebook SPEC_07 (VIS-012) — po akceptacji Piotra.

**Zależności krytyczne:** SYS-1/2/3/4 muszą wprowadzić tokeny do `src/index.css` ZANIM repoint per-moduł. SYS-3 migracja `StatusPill` (~34 callerów) wymaga kompletnej inwentaryzacji enumów (m.in. `ready`, `submitted`, `assigned`) — niekompletne mapowanie = regresja neutral. Każdy fix systemowy: before/after measure DOM + smoke wizualny light+dark (reguła verify-before-claiming).

---

## 4. DO WERYFIKACJI NA ŻYWO (pomiar DOM / stack-trace przed ruszeniem)

Audyt był wyłącznie ze zrzutów — poniższe wymagają potwierdzenia w runtime, bo determinują KTÓRY fix zastosować lub czy finding jest realny:

1. **SYS-6 settings dark-surface vs stuck-overlay** (conf:medium). Pomiar `computed background-color` wrappera panelu w light + sprawdzić obecność `bg-black/40`/`opacity`/loading-overlay. Dwa różne fixy: klasa surface (`SettingsSectionCard dark:` bez light) vs usunięcie stuck scrim. NIE ruszać przed pomiarem.
2. **meeting fetch-bug (VIS-016)** (conf:medium/func). Stack-trace endpointu listy meetingów — env-specyficzne (backend staging) czy realny bug? Cały moduł niewidoczny dopóki fetch pada.
3. **audits transport-safeguard banner** (conf:medium/func). „Requests blocked by global transport safeguard" — zdiagnozować fetch/transport przed budową karty błędu.
4. **VIS-006 źródło crimson CTA** (conf z katalogu: do potwierdzenia). `.backgroundColor`=transparent → kolor z gradientu/wrappera; mierzyć `background-image` przed zmianą tokenu.
5. **my-work Calendar violet bars** — decyzja wizualna (identity-dot vs cienki bar `categoryTone()`) + pomiar czy violet jest hardcoded czy z palety. Zmiana zmienia gęstość widoku — wymaga oględzin.
6. **execution DEADLINE+ALERTS konsolidacja do DueChip** (conf:low). Sprawdzić czy ALERTS niesie unikalny sygnał vs DueChip zanim scalimy kolumny.
7. **⚠️ P0 — VIS-013 My Work Inbox CRASH przy kliknięciu wiersza** (HANDOFF §5 + SCREEN_REVIEW_TABLE #04). Klik w Inbox-preview crashuje apkę. Przyczyna ≠ PreviewRelations (guarded) — NIE zakładać, że fix PreviewRelations wystarczy (audyt to wyklucza). Wymagany **żywy stack-trace z error boundary** zanim ruszy jakikolwiek fix. To jedyny P0 całego audytu — trafia do Fazy 1 przed fixami tokenowymi. Locus: ścieżka Inbox → klik wiersza → preview (nie PreviewRelations.tsx). **VIS-011 preview stopka (odrębne):** audyt które tabele NIE używają `PreviewActionBar` (22 użycia) + brak „Open" w Initiatives board-preview (UWAGA #15).
8. **Dane/scope (presentation-studio + table-studio Recent=Saved)** — potwierdzić, że to query bez filtra scope, nie artefakt seed.
9. **organization dark = spinner**, **partner Certificates/Exams/Client Access/Revenue chart = skeleton/loading** — re-capture po pełnym załadowaniu; prawdopodobnie timing capture, nie bug (CANON §4.1 honest UI).
10. **my-work Manager „Team Capacity 512%"** (conf:low) — sprawdzić agregację: realna niemożliwa metryka czy demo-data.
11. **Empty wykresy** (results „Initiative Contributions to ROI" płaska linia; finance) — render dla 0/1 datapointa vs faktyczny brak danych.
12. **document-studio amber FAB ikony** — czy globalny komponent help/feedback poza modułem (wtedy fix globalny, nie per-moduł).

Wszystkie fixy systemowe: obowiązkowy before/after measure DOM (computed color/contrast) + smoke wizualny light+dark — zgodnie z regułą verify-before-claiming (zrzut jako dowód, nigdy „done" na tsc/eslint).

---

---

## 5. LUKI UZUPEŁNIONE PO PRZEGLĄDZIE KRYTYKA (2026-06-17)

Poniższe findingi zostały zidentyfikowane przez krytyka kompletności jako pominięte przez główny plan:

- **VIS-013 P0 Inbox crash** — dodany do sekcji §4 pkt 7 (powyżej) jako jedyny P0 audytu. Plan pierwotnie twierdził „0 P0 twardych" — korekta: 1× P0 (crash wymaga stack-trace na żywo).
- **VIS-007 My Work — gęstość Menu 3** (8 chipów kontekstu + 3 scope + AI Triage). Locus: `TABLE_AND_PREVIEW_CANON §15` (overflow/grupowanie chipów). Trafia do Fazy 4 (polish).
- **VIS-010 Preview/KPI nad-truncate tytułu** (`'QA OWNER 17…'` ucinany mimo dostępnej szerokości). Locus: `shared/PreviewPane/previewStyles.ts` nagłówek. Faza 4.
- **VIS-004 Chat bańka usera crimson-tint** (`bg=#FDF2F3`, `text=#450C16`). To pytanie o paletę — user-message ≠ brand. Zweryfikować źródło (chat bubble variant). Faza 4.
- **Crimson VERIFY (chat Reasoning/cytaty #01, Insights „Expires" #13, Calendar today #05)** — przed fixem SYS-1/2 zmierzyć DOM: czy `rgb(109,20,39)` pochodzi z `text-primary` (leak → fix) czy aging/link-primary (intencjonalne → nie ruszać). Dodane do §4 pkt 13–15.
- **SuperAdmin (M27 / audyt #53)** — **POZA ZAKRESEM (odroczony)**. `isSuperAdmin=false` → brak dostępu do capture. Wymaga konta superadmina; audyt wizualny odroczony.

Findingi nieskatalogowane jako VIS-xxx (nowe z re-audytu 2026-06-17): finance duplikat TYPE, settings i18n object-key, review FileText raw token, tools `&amp;` w etykiecie, settings toggle-semantyka, settings KPI-tile, partner raw-ISO/UUID, my-work Manager 512% — dopisać do `MASTER_VISUAL_QA_CATALOG.md` przy realizacji danego modułu.

---

## 6. WYKONANE FIXY (log naprawczy)

### Sesja 2026-06-17 (Kontekst A)
- ✅ **EarningsSection** — raw ISO dates → `fmtDate` helper (locale-aware)
- ✅ **NotebookContent** — FileText raw token → guard `/\p{Emoji}/u` (page header)
- ✅ **ResultsKpisTableV3** — ValueCell crimson → neutral; Initiative Name `text-primary-400` → `text-slate-500`
- ✅ **DiscoveryToolsHub** — `&amp;` HTML entity decode; hardcoded `— Sesja` suffix usunięty (3 miejsca); `tools.hub.defaultSessionName` dodany do EN/PL locale
- ✅ **AdminMembersRolesPanel** — STATUS raw text → `EntityStatusChip`
- ✅ **MyTasksListContent** — Critical/Urgent priority → badge fill+border+text-800

### Sesja 2026-06-18 (Kontekst B)
- ✅ **menu3ActionButtonStyles.ts** — active state violet `rgba(168,85,247)` + crimson bg → sky blue
- ✅ **ResultsKpisTableV3** — "Needs entry" badge: `text-amber-300` → `text-amber-700` + `border-amber-200 bg-amber-50` + `whitespace-nowrap h-6`
- ✅ **DiscoveryToolsHub** — category column: `text-emerald-400` → `ChipBase` z kolorowym `dotClass` per kategoria
- ✅ **PartnerRuntimeSummaryStrip** — `border-primary-200 bg-primary-50` outer + metric cards → neutral slate
- ✅ **CalendarGrid** — `CONSULTIFY_BADGE` fill `#6d28d9` (violet) → `#1e3a5f` (navy)
- ✅ **MeetingHub** — Operator brief card crimson surface → neutral; "today" `bg-primary-600` → `bg-navy-900`; event pills → sky
- ✅ **ModuleNavBar** — `BUTTON_ACTIVE` + filter pill active `bg-primary-500/10` → `bg-slate-900/[0.07]` (SYS-1 shared token)
- ✅ **AdminMembersRolesPanel** — "Generate code" `bg-blue-600` → `bg-navy-900`
- ✅ **AIOSHub** — OPEN card hover border + icon badge + label → neutral
- ✅ **ReportsAndPresentationsHub** — PL fallback strings → EN (Presentations, Template Library, New report, New presentation, New template)
- ✅ **FinanceHub** — tabs + CTAs PL fallbacks → EN; `finance.tabs.investment` + `finance.cta.newInvestment` + `finance.cta.importStatement` dodane do EN locale
- ✅ **EarningsSection** — v8 stat-card `border-primary-200/70 bg-primary-50/50` → neutral slate

### Sesja 2026-06-18 (Kontekst C)
- ✅ **SYS-2 PEŁNE** — 316 instancji `bg-primary-5xx/6xx` solid wyeliminowane; toggles (`SettingsSection`, NotificationSettings, DesktopSounds, KeyboardShortcuts, MyWork/Notifications), checkboxes (21 plików MyWork/ReportBuilder/Admin/Initiatives/Interview), CTAs (BlockCard, SplitLayout FAB, EnterpriseAuditLog, ResizableTable FilterDropdown, PresentationStudio capacity panel), config/constants (`portfolioColors.ts`, `statusColors.ts`, `assessmentColors.ts`, `types.ts` ×2, `UnifiedChatPanel` skip-link). Naprawiono 6 odwróconych ternary (sed-bug z Kontekstu B). tsc: 0 błędów.
- ✅ **SYS-3 ZAKOŃCZONE** — 9 nagich badge przeskanowanych; 4 realne naprawione (ConsultifyLinkPanel Active, ModelsProvidersTab, SLADashboard, UnifiedSyncHub); 5 false-positive (stat-card labels, poprawnie zawarte).
- ✅ **SYS-4 PEŁNE** — violet/indigo CTA/surface: App.tsx, RouteErrorBoundary, InviteUserModal (×3), AIInterviewModal (batch), AIAnalyticsDashboard, AcademyProgress gradients, assessmentColors glowRing. tsc: 0 błędów.
- ✅ **SYS-5 CZĘŚCIOWE** — empty-state "Lub wybierz szablon" (EmptyStateWithActions) usunięto `uppercase` z pełnego zdania.
- ✅ **SYS-6 PEŁNE** — Settings dark-surface-leak (light mode navy containers bez `dark:` prefixu): naprawiono 30+ elementów w 12 plikach: `DataControlsSettings`, `PrivacySettings`, `AccessibilitySettings`, `DesktopSoundsSettings` (×2 batche), `SessionsActivitySettings`, `SecurityOverviewSettings` (×3 instancje), `AuthenticationAccessPage` (×5 input fields batch), `KeyboardShortcutsSettings` (kbd, search input, category containers, key-capture input), `ConnectedAppsSettings`, `AIPromptLibrarySettings` (editor + prompt cards), `ThemeSettings` (density + theme selectors), `AvailabilitySettings` (cardClass, inputClass, day-buttons ×2, preset-buttons ×2). Grep: 0 pozostałych bare navy containers w settings. tsc: 0 błędów.

### Sesja 2026-06-18 (Kontekst D)
- ✅ **SYS-1 CZĘŚCIOWE** — crimson/rose selected states naprawione w 6 plikach: `NavItem.tsx` (sidebar active accent bar bg-crimson-500 → `--c-info`); `ResourcesAnalysis.tsx` (AI proposals panel 8 instancji primary tint → neutral slate + `--c-info` Sparkles); `ExecutionWorkloadView.tsx` (week/month tab active `bg-primary-500/20` → neutral white); `ThemeSettings.tsx` + `AccessibilitySettings.tsx` (option-card selected `border-primary-500 bg-primary-500/5` → `border-slate-700 bg-slate-50`); `KeyboardShortcutsSettings.tsx` (profile card + tip box crimson → neutral); `PrivacySettings.tsx` (option cards crimson → neutral). DOM verify: sidebar accent = `rgb(59,40,131)` (`--c-info`), option cards border = `rgb(51,65,85)` (slate-700). tsc: 0 błędów.
- ✅ **M18 P1 OWNER UUID** — `useRapData.ts`: 5 instancji `raw.ownerUserId` → `raw.ownerName || raw.created_by_name || raw.createdByName || '—'`. Backend: `artifactRegistryService.ts` — dodano `LEFT JOIN users u ON u.id = a.owner_user_id` + `NULLIF(TRIM(...),'') AS owner_name` do SELECT w `listArtifactsForUser`; `ArtifactListItem` type ← `ownerName: string | null`. tsc: 0 błędów frontend + 0 błędów server (nowe — pre-existing errors w ideaCollabWs/apiKeyAuth niezwiązane).

### Sesja 2026-06-18 (Kontekst E)
- ✅ **P0 VIS-013 ZAMKNIĘTE** — Inbox crash zweryfikowany jako już naprawiony w `f0a3ccee6e` (root cause = RelationChip renderujący Lucide forwardRef jako React child / React #31, fix upstream `8bf85a6679` PreviewRelations forwardRef guard). Żywa weryfikacja w preview: klik wiersza (table view) + klik karty (cards view) otwiera preview-pane czysto, 0 error-boundary, 0 React errors w konsoli (tylko niezwiązany `OrgContext` fetch). Brak dalszego fixa potrzebnego.
- ✅ **SYS-1 reszta DOMKNIĘTE** — selekcja crimson/brand → neutral/`--c-info` w 11 plikach: `NotebookContent.tsx` (note selected `from-crimson-500/10 to-primary-500/8` + indigo → slate neutral, DOM-verified live), `ConversationItem.tsx` (chat sidebar conv item active + select-mode + icon + title → neutral/`--c-info`), `composer/CommandPalette.tsx` (active item + icon), `InitiativeScrollView.tsx` + `InitiativeNotionView.tsx` (section nav active bar → `--c-info` left-border + neutral bg), `Tasks/TaskFiltersBar.tsx` (filter chips ×3 + count badge + view-mode toggle), `Focus/FocusView.tsx` (suggestion cards ×2 + template chip), `Notifications/NotificationPreferences.tsx` (toggle enabled), `layout/SplitLayout.tsx` (artifacts toggle ×2), `LanguageSettings.tsx` (radio selected + check), `ResponseStyleSettings.tsx` (length/tone cards + checks), `WorkingHoursSettings.tsx` (same/per-day selectors), Diagram/HTMLPreview renderer segmented toggles. Admin/Settings/Partner sidebary już wcześniej naprawione (zweryfikowano). tsc: 0 błędów.
- ✅ **SYS-2 primary-CTA → navy DOMKNIĘTE** — ad-hoc crimson/`bg-brand` CTA zmapowane na kanoniczny wzorzec navy (`bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF]`) w ~23 plikach: Settings cluster (APIAccess, Webhooks, CalendarSync, CloudData, ConnectedApps, Password, EmailNotifications, IntegrationHealth, NotificationSchedule, AvatarPhoto, UserIntegrations/IntegrationCard, integrations/MappingDriftPanel, NotificationSettingsV2 ×6 tabów), Partner (AcademyProgress, TrustProgressionIndicator), KimiWorkspace (ArtifactModuleHome „Start new", KimiWorkspaceShell retry+generate), ArtifactEditor Save, MultiFwBenchmarkComparison retry, FocusView „Go to Inbox", admin/AdminFeedbackView, partner/CommissionView. Brand crimson zachowany WYŁĄCZNIE dla Teresa + user-chat-bubble + landing/trial (poza scope SYS-2). Render zweryfikowany live: identyczny string klas na żywym przycisku „Log in" → computed dark-mode bg `rgb(244,247,251)` + text `rgb(10,15,30)` (poprawny neutral high-contrast, 0 crimson). tsc: 0 błędów.

- ✅ **SYS-3 DOMKNIĘTE (rdzeń)** — inwentaryzacja wykazała, że infrastruktura badge'y JUŻ jest canon-compliant: `PMOPriorityBadge` (fill+border+text-800 we wszystkich kategoriach light), `shared/StatusPill` (fill+border, de facto martwy — 0 realnych importerów), `constants/statusColors` (`getStatusStyle` zwraca fill+text+dot light+dark — używany przez Results/Execution/Portfolio kanban = NIE gołe badge), huby już zmigrowane na `EntityStatusChip` (Presentations, Interview ×N, Tools table = neutral-shell+dot §4.0a). **Realny dług = brakujące mapowania w `statusChipTone()`** (fallback→neutral = regresja wg ostrzeżenia planu): dodano `ready→success`, `generated→info`, `proposed→info`, `accepted→success`, `on_hold/paused→warning` + jawne neutral dla `inactive/assigned/not_started/todo`. Weryfikacja live (fresh ESM import w preview): wszystkie 10 mapowań poprawne, koniec cichego neutral dla `ready`/`generated`. tsc: 0 błędów. **Faza 2 (migracja gołych ad-hoc badge per-moduł) — nie znaleziono realnych gołych badge'y poza już-zgodnymi (zgodne z `finding_gap_reports_overstate`).**

### Otwarte — wymaga pomiaru DOM lub decyzji
- 🔲 **SYS-5 reszta** Finance/Documents PL/EN mix, breadcrumb, partner commission — wymaga klucze i18n
- ✅ **SYS-7 DOMKNIĘTE (rdzeń)** — inwentaryzacja: admin Members STATUS już używa `EntityStatusChip` z `.toLowerCase()` (`AdminMembersRolesPanel:254`, `active`→success); interview tabele już na `EntityStatusChip`; tools `availability` kolumna już neutral-shell+dot. **Realny gołe-label = tools `License` kolumna** (`DiscoveryToolsHub:1764` raw `text-amber-500`/`text-emerald-500`) → przerobione na canon §4.0a neutral-shell + signal-dot (amber=licensed, emerald=free), spójne z `availability` obok. documents EXPORTS — nie zlokalizowano gołego renderera (prawdopodobnie już zmigrowane lub w hubie za auth). tsc: 0 błędów.
- 🔲 **SYS-8** Preview-pane footer parity — audit which tables miss PreviewActionBar
- 🔲 **Weryfikacja wizualna Settings/Partner CTA** — zmiany SYS-2 tsc-clean + render zweryfikowany przez identyczny żywy „Log in"; pełna wizualna weryfikacja paneli Settings wymaga zalogowanej sesji (fresh preview server traci auth; backend = Railway PROD → bez zgadywania creds)