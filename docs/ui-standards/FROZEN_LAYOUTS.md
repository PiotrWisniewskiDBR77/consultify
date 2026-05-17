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

**Reguła:** Nie zmieniaj kolejności tabów. Nie dodawaj nowych tabów między istniejącymi. Tab Manager jest widoczny tylko dla ról admin/manager/superadmin. Home jest domyślnym landing tabem dla wszystkich użytkowników.

**Specyfikacja:** `docs/product/MYWORK_HOME_V1_SSOT.md`, `docs/product/MYWORK_CALENDAR_V1_SSOT.md`

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

**Standard wizualny (MUST — identyczny we wszystkich modułach):**
- **Tło paska:** dziedziczy `dark:bg-navy-900` z ModuleNavBar; chipy mają ciemniejsze `dark:bg-navy-800`
- **Separator:** `border-b border-slate-200/60 dark:border-white/5` pod całym ModuleNavBar
- **Format chipów:** pill shape `h-8 rounded-full`, ikona kolorowa 14px + label + badge z counterem
- **Aktywny chip:** fioletowa ramka `border-purple-500/40`, tło `bg-purple-500/10`, tekst `text-purple-700 dark:text-purple-200`
- **Przyciski AI (prawa strona):** kontekstowe, `h-8 rounded-full`, ikona `Sparkles`, wspólny format Menu 3; bez dużych fioletowych CTA i bez gradientów w operational chrome
- **Pełna specyfikacja:** `module-hub-standard.md` §3.2 (tło/separator), §3.3 (chipy), §3.4 (AI buttons)

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
