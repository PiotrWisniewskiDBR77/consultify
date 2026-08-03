# FROZEN LAYOUTS — NIE ZMIENIAJ

> **Status:** OBOWIĄZKOWY  
> **Cel:** Układy UI, które **NIGDY** nie mogą być zmieniane przy tworzeniu nowych tasków ani implementacji.  
> **Kto stosuje:** Wszyscy (dev, AI, code review).
>
> **Uzasadnienie:** Tworzenie nowych funkcji często "rozjeżdża" układ: zmienia kolejność w menu, przerabia tabele i preview, modyfikuje sidebar tools. Ten dokument **PINUJE** kanony — aby nie robić bałaganu.

---

## ⛔ NIGDY NIE ZMIENIAJ

### 1. Sidebar (główne menu aplikacji)

**SSOT:** `src/components/navigation/Sidebar/menuConfig.ts`  
**Referencja:** `docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

**Kolejność pozycji (góra → dół):**
1. Chat  
2. My Work  
3. Interview  
4. Tools (Library, Assessment)  
5. Initiatives  
6. Execution  
7. Results (Benefits)  
8. Finance  
9. Outputs (unified Reports & Presentations hub — P19)  
10. … (pozostałe według menuConfig)

**Reguła:** Nie zmieniaj kolejności, nie dodawaj nowych pozycji między istniejącymi bez aktualizacji `menuConfig.ts` i świadomej decyzji PO/CTO.

> **Stan na 2026-08-02 (zweryfikowano greppem `menuConfig.ts`):** kolejność pozycji 1–8 **zgodna** z kodem (Chat → My Work → Interview → Tools/Assessment → Initiatives → Execution → Results → Finance). **Rozjazd na pozycji 9:** dokument deklaruje „Outputs (unified Reports & Presentations hub — P19)", kod (`getMenuStructure`, `id: 'MODULE_PRESENTATIONS'`) ma etykietę **„Materials"** (`t('sidebar.materialy', 'Materials')`) — komentarz w kodzie (linie 134–140) potwierdza, że to ten sam skonsolidowany moduł („Consolidates the former four sidebar entries … into one"), tylko nazwany inaczej niż w tym dokumencie. Za nim, wciąż pod „pozostałe według menuConfig", idą `MODULE_AUDITS` („Audits") i `MODULE_MEETING` („Meeting"). **Nierozstrzygnięte:** czy nazwa docelowa to „Outputs" czy „Materials" — do decyzji PO/CTO, nie poprawiane tu arbitralnie.

---

### 1b. My Work — wewnętrzna kolejność tabów

**SSOT:** `src/components/MyWork/MyWorkHub.tsx` (tablica `tabs` w `useMemo`)

**Kolejność tabów (lewa -> prawa):**
1. Home (wszyscy)
2. Ideas (wszyscy)
3. Notebook (wszyscy)
4. Inbox (wszyscy)
5. Calendar (wszyscy)
6. Tasks (wszyscy)
7. Decisions (wszyscy)
8. Manager (tylko admin/manager/superadmin)

**Reguła:** Nie zmieniaj kolejności tabów. Nie dodawaj nowych tabów między istniejącymi. Tab Manager jest widoczny tylko dla ról admin/manager/superadmin. **Kolejność kanoniczna** zakłada Home jako pierwszy tab i domyślny landing — to jest stan **docelowy/projektowy**, nie stan dzisiejszy. **Dziś Home jest CAŁKOWICIE WYFILTROWANY** flagą `RADAR_ENABLED = false` (`src/components/MyWork/MyWorkHub.tsx`, komentarz l.227–231: „Radar … is temporarily HIDDEN and PAUSED: it is memory-heavy and still under active development. Flipping RADAR_ENABLED back to true restores the sidebar tab, the default landing, and HomeView rendering"); realnym domyślnym landing tabem jest **Inbox** (stała `MY_WORK_FALLBACK_TAB = 'inbox'`, l.237, użyta w fallbacku l.506). Nie „przywracaj" Home jako domyślnego bez świadomej decyzji PO/CTO — wyłączenie jest celowe. Pełny opis rozjazdu (w tym etykieta „Radar" i taby `vault`/`agent`) w nocie niżej.

**Specyfikacja:** `docs/product/MYWORK_HOME_V1_SSOT.md`, `docs/product/MYWORK_CALENDAR_V1_SSOT.md`

> **Stan na 2026-08-02 (zweryfikowano greppem `MyWorkHub.tsx`, tablica `allTabs`):** kolejność 7 tabów 1–7 (Home/Ideas/Notebook/Inbox/Calendar/Tasks/Decisions) **zgodna** z kodem, Manager **zgodny** jako ostatni (gate `requiresManagerAccess`). **Rozjazd:** kod ma DWA dodatkowe warunkowe taby nieopisane w tym dokumencie — `vault` („Client Vault", gate `requiresVaultFlag`/`isClientVaultEnabled()`) i `agent` („Run agent", gate `requiresAgentFlag`/`isAgentPlanEnabled()`) — wstawione MIĘDZY Decisions a Manager. Oba pochodzą z relokacji VLT-004/AGT-003 (patrz komentarz w kodzie) i są domyślnie ukryte za flagą, ale gdy flaga jest ON, realna kolejność to: Home → Ideas → Notebook → Inbox → Calendar → Tasks → Decisions → **Vault → Agent** → Manager. Dodatkowo tab `home` renderuje się z etykietą **„Radar"**, nie „Home" (id pozostaje `home`). Do decyzji PO/CTO, czy dopisać oba taby i etykietę do kanonu — nie poprawiane tu arbitralnie.

---

### 2. Module topbar (kolejność przycisków)

**SSOT:** `docs/ui-standards/03-modules/module-hub-standard.md` sekcja 2

**Kolejność od prawej do lewej (wizualnie):**
- **Area** (toggle panelu)  
- **Add** (Primary CTA, bez leading `+` w Module Topbar)  
- **Tool** (jeśli moduł ma)  
- **View** (przełącznik view modes)  
- **Filters**

**Reguła:** Przy implementacji nowych modułów/hubów — ta kolejność jest stała. Nie "przesuwaj" View czy Filters w inne miejsce.

---

### 3. View modes — kolejność ikon

**SSOT:** `docs/ui-standards/03-modules/view-modes-standard.md` sekcja 2.1 oraz `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`

**Kolejność (zawsze ta sama):**
1. `table`  
2. `kanban`  
3. `timeline`  
4. `calendar`  
5. `matrix`  
6. `grid` (cards)

**Reguła:** Pokazujemy tylko dostępne tryby, ale **kolejność nigdy się nie zmienia**. Nie dodawaj np. "queue" jako 3. ikony między kanban a timeline. View modes są widocznymi segmented/icon buttons, nie dropdownem. Dla prostego układu `Lista/Karty`, `Lista` jest po lewej, `Karty/Grid` po prawej.

---

### 4. Command Row (Menu 3) — dokładnie jeden rząd

**SSOT:** `docs/ui-standards/03-modules/module-hub-standard.md` sekcje 3.1, 3.2, 3.3; `golden-standard-table-cards-preview-v3.md` sekcja 0.2

**Reguła:** Pod topbarem jest **dokładnie jeden** Command Row. Ten rząd obsługuje (wymieniając się w tym samym miejscu):
- Dynamic tabs (otwarte dokumenty)
- Search row (lupa rozwinięta)
- Context counters (pills: All, Overdue, This week…)
- Bulk actions (po zaznaczeniu)

**Doprecyzowanie (MUST):**
- Jeśli Menu 3 używa prawej strony na przyciski AI / actions, nie dokładamy tam przełączników typu `prev/next`, `W/M`, `3M/6M/12M`.
- Takie kontrolki należą do toolbara konkretnego widoku (np. timeline / heatmap / canvas), a nie do Command Row.

**MUST NOT:** Dokładanie 2.–3. rzędu filtrów/toolbarów między topbarem a tabelą.

**Standard wizualny (MUST — identyczny we wszystkich modułach; zweryfikowano 2026-08-02 względem SSOT klas `src/components/shared/ModuleMenu3.tsx` i `TRIADA_KANON.md` §A3/§C5 — poprzednia wersja tej sekcji opisywała stan SPRZED migracji z fioletu na neutral i była nieaktualna):**
- **Wiersz paska:** `MENU_3_ROW_CLASS` = `px-4 py-2 mb-2 bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/[0.05]`. Tło jest jawne (`bg-white`/`dark:bg-navy-900`), nie "dziedziczone".
- **Separator:** `border-b border-slate-200/60 dark:border-white/[0.05]` — część `MENU_3_ROW_CLASS`, pod całym paskiem (nie `dark:border-white/5` jak poprzednio zapisano tu — wartość dark jest `white/[0.05]`, czyli ten sam ułamek, ale zapisany jako notacja arbitrary value, nie skrót).
- **Odstęp Menu 3 → nagłówek tabeli:** `mb-2` (8px), wymuszany w samym `MENU_3_ROW_CLASS` — **nie ustawiany per ekran**. Dopisane do kodu 2026-07-28 jako reakcja na uwagę P-6 (`OBR-09`); udokumentowane też w `TRIADA_KANON.md` (linia „Odstęp Menu 3 → nagłówek tabeli: `mb-2` (8px)").
- **Format chipów:** `MENU_3_CHIP_BASE` = `h-7 rounded-full border px-2.5 text-[11px] font-medium` + `gap-1.5` (NIE `h-8` jak poprzednio zapisano tu — `h-8` to wysokość przycisków AI/akcji, nie chipów filtrów). SSOT: `MENU_3_CHIP_BASE`/`MENU_3_CHIP_ACTIVE`/`MENU_3_CHIP_INACTIVE` w `ModuleMenu3.tsx`; potwierdzone w `TRIADA_KANON.md` §A3/§C5 („Chipy MNIEJSZE niż Menu 2: h-7, text-[11px], rounded-full").
- **Aktywny chip:** `MENU_3_CHIP_ACTIVE` = **NEUTRALNY**, nigdy fioletowy ani crimson: `border-slate-300 bg-state-selected text-slate-900` / dark `border-white/30 text-white`. `bg-state-selected` = token `--state-selected` (`color-mix(in srgb, var(--c-text) 8%, transparent)`, `src/index.css`). Fiolet (`#7C3AED`, `border-purple-500/40`, `bg-purple-500/10`, `text-purple-700`) **nie istnieje już w produkcie** — `tailwind.config.js` opisuje `primary` jako crimson `#85182F` z komentarzem „was violet"; migracja jest zakończona, nie w toku.
- **Nieaktywny chip:** `MENU_3_CHIP_INACTIVE` = `border-slate-200 bg-transparent text-c-text-muted hover:bg-state-hover hover:text-slate-900` / dark `border-white/10 dark:hover:text-slate-200`.
- **Przyciski AI (prawa strona):** kontekstowe, ten sam format Menu 3 (`h-8 rounded-full` dla `MENU_3_ACTION_*`, nie mylić z `h-7` chipów filtrów), ikona `Sparkles`; **zero crimson jako stanu aktywnego, zero dużych/gradientowych CTA** — poprzednie sformułowanie „bez dużych fioletowych CTA" zakładało istnienie fioletu jako punktu odniesienia, którego już nie ma.
- **Pełna specyfikacja:** `module-hub-standard.md` §3.2 (tło/separator), §3.3 (chipy), §3.4 (AI buttons) — **jeśli te sekcje nadal opisują fiolet lub `h-8` chipów, są RÓWNIEŻ nieaktualne**; kod (`ModuleMenu3.tsx`) i `TRIADA_KANON.md` §A3/§C5 rozstrzygają w razie sprzeczności.

**Znany dług doc↔kod — wysokość paska Menu 3 (nierozstrzygnięte, 2026-08-02):**
`docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md` (wiersz „contextual command / Menu 3") deklaruje wysokość **44 px**. Realny kod (`MENU_3_ROW_CLASS` = `py-2` czyli 8px+8px, `MENU_3_INNER_CLASS` = `min-h-8` czyli 32px) daje **~48 px** (8+32+8). Rozjazd 4px między kontraktem tokenów a implementacją. Nie wybieramy tu arbitralnie, która wartość jest "prawdziwa" — do rozstrzygnięcia: albo `FOUNDATION_TOKEN_CONTRACT.md` aktualizuje się na 48px, albo `MENU_3_INNER_CLASS`/`MENU_3_ROW_CLASS` w `ModuleMenu3.tsx` zmieniają się na 44px (co wymaga świadomej decyzji, bo dotyka też odstępu `mb-2` opisanego wyżej).

---

### 5. App Table + Preview Pane

**SSOT:**  
- `docs/ui-standards/03-modules/app-table-standard.md`  
- `docs/ui-standards/03-modules/table-preview-pane-standard.md`  
- `docs/ui-standards/03-modules/golden-standard-table-cards-preview-v3.md`

**App Table:**
- Topbar `h-9`, filtry w headerach kolumn, resizable columns
- Akcje: max 2 ikonki + kebab (⋮) pionowy
- Brak duplikowania toolbarów

**Preview pane (Outlook style):**
- Single click → selection + preview
- Double click / Enter → full detail
- Esc → zamknięcie preview
- Anatomia: Header (tytuł + Open + X) → Body (scroll) → Footer (AI hints, Relations, Actions)

**Anatomia preview — doprecyzowanie (zweryfikowano 2026-08-02):** obowiązkowe są **6 bloków** wg `TRIADA_KANON.md` §A7 (1 Nagłówek → 2 Karta meta → 3 Details → 4 AI → 5 Relations → 6 Akcje), **plus opcjonalny blok „Co dalej"/„What's next"**, który — zgodnie z realną implementacją w `src/components/standard/StandardPreview.tsx` (ANEKS #4, sekcja `whatsNext`) — renderuje się **PO** bloku akcji, nie przed nim: kolejność faktyczna w kodzie to AI → Relations → Akcje → Co dalej (opcjonalne). **Kolejność kanoniczna: 6. Akcje → 7. „Co dalej" (opcjonalny, poza numeracją TRIADY, zawsze na końcu)** — zgodna z `StandardPreview.tsx` i `TRIADA_KANON.md` §A7.

**Rozjazd względem `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` §7.3c jest ZAMKNIĘTY (zweryfikowano ponownie 2026-08-02).** Wcześniejsza rewizja tego dokumentu opisywała ten rozjazd jako otwarty i wymagający „korekty równoległej, nie robionej tutaj" — to było nieaktualne w momencie pisania: `TABLE_AND_PREVIEW_CANON.md` sam odnotował (2026-08-02, l.431–443) własną wcześniejszą pomyłkę i poprawił deskryptor stref (tabela §7.3c, l.424) na „6 AKCJE | CO DALEJ (poza numeracją)" — czyli Akcje przed opcjonalnym Co dalej, dokładnie zgodnie z `StandardPreview.tsx` i z tym dokumentem. Nie ma już nic do korygowania równolegle.

**Reguła:** Nowe moduły tabelaryczne MUSZĄ stosować ten sam wzorzec. Nie wymyślaj "innego" layoutu preview ani tabeli.

---

### 6. Workspace 3-tools strip (prawy panel)

**SSOT:** `docs/ui-standards/02-components/workspace-3-tools-strip.md`

**Stałe 3 tryby (single-select — jeden otwarty naraz):**
1. **Tools** — narzędzia (insert, convert, transform)  
2. **Context / Links** — powiązania, "Used in", backlinks  
3. **AI Suggestions** — sugestie do analizy, Send to chat

**Implementacja:** `src/components/shared/WorkspacePanelStrip.tsx`  
Kontrakt: `value: 'tools' | 'context' | 'ai_suggestions' | null`

**Reguła:** Nie dodawaj 4. przycisku (np. "Export"). Nie zmieniaj kolejności. Nie twórz osobnego "mini-sidebaru" z innym zestawem.

---

## Przed każdą zmianą UI (checklist)

- [ ] Czy dotykam sidebar / menuConfig? → sprawdź FROZEN LAYOUTS §1  
- [ ] Czy dotykam taby My Work? → sprawdź §1b (Home→Ideas→Notebook→Inbox→Calendar→Tasks→Decisions→Manager)  
- [ ] Czy dotykam topbar modułu? → sprawdź §2 (kolejność Area→Add→Tool→View→Filters)  
- [ ] Czy dotykam view modes? → sprawdź §3 (table→kanban→timeline→calendar→matrix→grid)  
- [ ] Czy dodaję nowy rząd pod topbarem? → §4 — NIE (tylko 1 Command Row)  
- [ ] Czy buduję tabelę / preview? → §5 (App Table + Preview Pane)  
- [ ] Czy dotykam prawy panel workspace? → §6 (Tools / Context / AI Suggestions)

---

## Odwołania

- `.cursorrules` — sekcja FROZEN LAYOUTS  
- `docs/product/V4_IMPLEMENTATION_PROGRAM.md` — kontrakt 1.4  
- `docs/product/MYWORK_HOME_V1_SSOT.md` — specyfikacja Home tab  
- `docs/product/MYWORK_CALENDAR_V1_SSOT.md` — specyfikacja Calendar tab  
- `docs/ui-standards/00-foundation/canvas-mode.md` — Canvas Mode (rozszerzenie DBR77)  
- `docs/ui-standards/README.md` — indeks wszystkich standardów

---

## Changelog

**2026-08-02 (panel adwersaryjny, K-35)** — korekta „zamrożonego" stanu, który rozjechał się z kodem:
- §1b: Reguła przestała twierdzić, że Home jest domyślnym landing tabem — dopisano wprost, że to jest stan **docelowy/projektowy**, a dziś Home jest **całkowicie wyfiltrowany** flagą `RADAR_ENABLED = false` (`MyWorkHub.tsx` l.227–232), z cytatem komentarza z kodu; realny domyślny tab to **Inbox** (`MY_WORK_FALLBACK_TAB`). Poprzednio ta sprzeczność istniała TYLKO w nocie pod Regułą — sama Reguła nadal twierdziła coś fałszywego, co groziło „przywróceniem" świadomie wyłączonego taba. Zweryfikowano ponownie greppem `RADAR_ENABLED`/`MY_WORK_FALLBACK_TAB`/`allTabs` w `MyWorkHub.tsx` — nota o tabach `vault`/`agent` i etykiecie „Radar" (dopisana w poprzedniej rewizji) potwierdzona jako nadal aktualna i kompletna, bez zmian.
- §5: doprecyzowanie anatomii preview dopisało jawną kolejność kanoniczną „6. Akcje → 7. Co dalej (opcjonalny)" i **zamknęło** rozjazd względem `TABLE_AND_PREVIEW_CANON.md` §7.3c — ten dokument sam poprawił swój deskryptor stref 2026-08-02 (zweryfikowano greppem l.424, 431–443: header tabeli to dziś „6 AKCJE | CO DALEJ", nie „6 CO DALEJ | 7 AKCJE"). Poprzednia wersja tej sekcji FROZEN LAYOUTS opisywała ten rozjazd jako otwarty i „nie robiony tutaj" — to było przeterminowane w chwili pisania.
- Przegląd całego dokumentu pod kątem innych rozjazdów doc↔kod (§1 sidebar vs `menuConfig.ts`, §2 topbar vs `ModuleNavBar.tsx`, §3 view modes vs `ModuleNavBar.tsx`/`view-modes-standard.md` §2.1, §4 Menu 3 vs `ModuleMenu3.tsx`/`FOUNDATION_TOKEN_CONTRACT.md`, §6 Workspace strip vs `WorkspacePanelStrip.tsx`) — **żadnego nowego rozjazdu nie znaleziono**; wszystkie zgodne z kodem lub już opisane jako znany, nierozstrzygnięty dług (§1 pozycja 9 „Outputs"/"Materials", §4 wysokość paska 44px/48px). Szczegóły w raporcie sesji.

**2026-08-02** — §4 przepisane na faktyczny stan kodu (dokument opisywał fiolet sprzed migracji na neutralny chip; `ModuleMenu3.tsx` był już dawno neutralny). Konkretnie:
- Usunięto `border-purple-500/40` / `bg-purple-500/10` / `text-purple-700 dark:text-purple-200` — zastąpiono realnymi klasami `MENU_3_CHIP_ACTIVE` (`border-slate-300 bg-state-selected text-slate-900`, dark `border-white/30 text-white`).
- Poprawiono format chipów z `h-8 rounded-full` na faktyczne `h-7 text-[11px] rounded-full` (`MENU_3_CHIP_BASE`), zgodne z `TRIADA_KANON.md` §A3/§C5.
- Poprawiono separator/tło na faktyczne wartości `MENU_3_ROW_CLASS`.
- Dopisano `mb-2` (8px, P-6, 2026-07-28) jako obowiązkowy odstęp Menu 3 → nagłówek tabeli, wymuszany w kodzie, nie per ekran.
- Usunięto sformułowanie „bez dużych fioletowych CTA" przy przyciskach AI (zakładało istnienie fioletu jako punktu odniesienia) — zastąpiono regułą aktualną (format Menu 3, zero crimson jako stanu aktywnego).
- Dopisano jawną notę o rozjeździe wysokości Menu 3: `FOUNDATION_TOKEN_CONTRACT.md` deklaruje 44px, `MENU_3_ROW_CLASS`+`MENU_3_INNER_CLASS` dają ~48px — **znany dług, nierozstrzygnięty tutaj**.
- §1 (sidebar): zweryfikowano względem `menuConfig.ts` — pozycje 1–8 zgodne; pozycja 9 rozjechana (dokument: „Outputs", kod: „Materials", ten sam skonsolidowany moduł `MODULE_PRESENTATIONS`) — dopisana nota, nie poprawiona arbitralnie.
- §1b (My Work taby): zweryfikowano względem `MyWorkHub.tsx` — 7 głównych tabów + Manager zgodne kolejnością; kod ma dwa dodatkowe warunkowe taby (`vault`, `agent`) między Decisions a Manager, nieopisane w dokumencie — dopisana nota.
- §5: dopisano doprecyzowanie anatomii preview — 6 bloków wg `TRIADA_KANON.md` §A7 plus opcjonalny blok „Co dalej" renderowany PO akcjach (wg realnego kodu `StandardPreview.tsx`, ANEKS #4), z jawnym wskazaniem rozjazdu względem `TABLE_AND_PREVIEW_CANON.md` §7.3c (który stawia „Co dalej" przed akcjami).
