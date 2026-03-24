# Table Platform — Honest Audit & Realistic Plan

**Date:** 2026-03-16  
**Author:** AI Agent (post-Airtable screenshot analysis)  
**Status:** CRITICAL — system not production-ready

---

## Part 1: The Truth

### What We Built
- 36 backend services with real SQL, real logic, real tests (246 pass)
- 25 SQL migration files (700-724) defining complete schema
- 165 API routes with auth, rate limiting, feature flags
- 107 frontend components

### What Actually Works
**Almost nothing end-to-end.** The system has a critical missing link:

1. **No migration runner** — the 25 SQL files are never executed. `initDb()` doesn't create `tp_*` tables. Without tables, every API endpoint crashes.
2. **Frontend defaults to broken backend** — `usePlatform=true` by default, so users see empty/broken tables instead of their legacy data.
3. **Many UI components are theater** — FormBuilder, InterfaceDesigner render but never save. Save button is a no-op. Redo is broken in platform mode.

### What Airtable Does That We Don't (from CEO's screenshots)

| Airtable Feature | Screenshot | Our Status |
|---|---|---|
| **Omni: NL → plan → tables + data + automations** | #2, #4b, #5a-5d | Partial: Chat-to-Schema exists but no auto-data, no auto-automations |
| **Multi-table tabs in one base** | #8 | Backend: yes. UI: NO — one table per workspace |
| **Split screen: chat + table side by side** | #7 | NO — chat is separate from table |
| **Tools menu (clean dropdown)** | #9 | NO — 30+ toolbar buttons instead |
| **Date dependencies (cascading dates)** | #9, article | NO — not implemented |
| **Record templates** | #12 | NO — we have base templates, not record templates |
| **Automations visual builder** | #5c | Backend exists. UI exists but NOT wired to main flow |
| **Column footers (Sum, Count)** | #5d | NO |
| **Status bar ("15 records")** | #5d | NO |
| **Sharing: invite link + email + base guide** | #10 | Partial: view sharing exists, no email invite, no base guide |
| **"Hide fields" button** | #7 | NO — we have column config but not as a toolbar button |
| **"Color" rows button** | #7 | Partial — conditional formatting exists but different UX |
| **"Share and sync" button** | #7 | NO |
| **Settings per base (Company, Industry, Team)** | #3 | NO |
| **Insights (base health)** | #9 | NO |
| **Field agents** | #7 | NO |
| **"Generate reports with Omni"** | #5d | NO |
| **Onboarding wizard (5 steps)** | #10 | NO |

---

## Part 2: What Must Be Done (Priority Order)

### PHASE 0: Make It Actually Work (CRITICAL — Day 1)

Without this, nothing else matters.

| # | Task | Why Critical |
|---|---|---|
| 0.1 | **Create migration runner** — add to server startup: read `server/migrations/7*.sql` files, execute in order, track in `tp_migration_history` table | Without this, 0% of backend works |
| 0.2 | **Run migrations on Railway DB** — execute all 25 SQL files | Creates the actual tables |
| 0.3 | **Fix feature flag fallback** — if platform API fails, fall back to legacy gracefully instead of showing empty table | Users must never lose data |
| 0.4 | **Fix FormBuilder onSave** — actually call `FormService.createForm` | Currently a no-op |
| 0.5 | **Fix InterfaceDesigner** — load existing layout, save to backend | Currently always empty |
| 0.6 | **Fix Redo in platform mode** — use platform undo/redo, not legacy stack | Currently broken |
| 0.7 | **Fix collaboration userId** — pass real user from auth context, not "current-user" | Currently fake |
| 0.8 | **Seed default templates** — call `templateService.seedDefaultTemplates()` on startup | Gallery is empty without this |

### PHASE 1: Match Airtable Core UX (Week 1-2)

This is what the user sees and compares directly to Airtable.

| # | Task | Airtable Screenshot |
|---|---|---|
| 1.1 | **Multi-table tabs** — UI tabs at top of table showing all tables in a base, click to switch, "+" to add table | #8 |
| 1.2 | **Clean Tools menu** — replace 30+ toolbar buttons with a single "Tools" dropdown (Extensions, Manage fields, Record templates, Date dependencies) | #9 |
| 1.3 | **Column footers** — Sum, Count, Avg, Min, Max per column at bottom of grid | #5d |
| 1.4 | **Status bar** — "X records" count at bottom left, column sums at bottom right | #5d |
| 1.5 | **Hide fields button** — toolbar button to toggle field visibility per view | #7 |
| 1.6 | **Record expand on click** — single click = select, click on expand icon = full record detail | #5d |
| 1.7 | **Row numbers** — numbered rows in grid (1, 2, 3...) | #5d, #7, #8 |

### PHASE 2: AI-Powered Table Creation (Week 2-3)

This is Airtable's "Omni" — the killer feature from screenshots #2-5d.

| # | Task | Airtable Screenshot |
|---|---|---|
| 2.1 | **"Start with Omni" flow** — dedicated entry point: describe what you need → AI creates plan | #1, #2 |
| 2.2 | **Plan presentation** — show structured plan with table names, descriptions, "Build it" button, thumbs up/down | #4b |
| 2.3 | **Auto-generate demo data** — when building tables, populate with realistic sample records (15-20 per table) | #5d |
| 2.4 | **Auto-create automations** — detect business rules from description and create automation (e.g., "alert when budget exceeded") | #5c |
| 2.5 | **Split screen: chat + table** — Airtable's core UX: chat on left, table on right, with Recommended/Ask/Analyze/Build tabs | #7 |
| 2.6 | **Settings dialog** — Company name, Industry type, Team — used to personalize AI output | #3 |

### PHASE 3: Project Management Features (Week 3-4)

Date dependencies is a paid Airtable feature visible in screenshot #9.

| # | Task |
|---|---|
| 3.1 | **Date dependencies engine** — configure Start Date, End Date, Duration, Predecessor fields per table |
| 3.2 | **Cascading date updates** — change predecessor → auto-shift dependent records |
| 3.3 | **3 rescheduling modes** — Flexible (consume buffer), Fixed (maintain buffer), None |
| 3.4 | **4 dependency types** — FS, SS, FF, SF |
| 3.5 | **Weekend/holiday exclusion** — omit non-working days from duration calculation |
| 3.6 | **Record templates** — create reusable record templates within a table |
| 3.7 | **Dependency visualization in Timeline/Gantt** — arrows between dependent records |

### PHASE 4: Collaboration & Sharing (Week 4-5)

From screenshot #10.

| # | Task |
|---|---|
| 4.1 | **Invite by email** — send invitation to collaborate on a base |
| 4.2 | **Base guide wizard** — 5-step onboarding: base guide, table descriptions, field descriptions, name a view, create backup |
| 4.3 | **Real-time collaboration** — fix userId, show actual user avatars and cursors |
| 4.4 | **Comments on records** — already built, verify it works end-to-end |
| 4.5 | **"Share and sync" button** — unified sharing UX in toolbar |

### PHASE 5: Polish & Insights (Week 5-6)

| # | Task |
|---|---|
| 5.1 | **Insights / Base health** — dashboard showing table sizes, field usage, automation stats |
| 5.2 | **Field agents** — AI agents that can research, summarize, analyze data in fields |
| 5.3 | **"Generate reports with Omni"** — AI-powered report generation from table data |
| 5.4 | **Conditional row coloring** — "Color" button in toolbar |
| 5.5 | **"Share and sync"** — sync tables between bases |

---

## Part 3: Effort Estimates

| Phase | Scope | Realistic Effort |
|---|---|---|
| **Phase 0** | Make it work | 1-2 days |
| **Phase 1** | Core UX parity | 1-2 weeks |
| **Phase 2** | AI table creation | 2-3 weeks |
| **Phase 3** | Date dependencies | 1-2 weeks |
| **Phase 4** | Collaboration | 1 week |
| **Phase 5** | Polish | 1-2 weeks |
| **TOTAL** | | **6-10 weeks** |

---

## Part 4: What We Have That Airtable Doesn't

Despite the gaps, we have genuine advantages:

1. **Governed Models** — KPI definitions, trust flags, Power BI-like analytics (Airtable has nothing like this)
2. **Graph compatibility** — tables as nodes in workspace graph (unique to Consultify)
3. **86 formula functions** — more than Airtable's ~50
4. **Offline queue** — localStorage with LWW conflict resolution
5. **Extension SDK** — iframe sandbox with marketplace
6. **Schema diff preview** — user sees changes before approval
7. **Chat-to-Schema pipeline** — NL → proposal → approval → execution (Airtable's Omni is more polished but less transparent)
8. **Row-level permissions** — policy-based, not just table-level
9. **Webhook relay** — native Zapier/Make integration without marketplace registration
10. **Artifact distribution** — automated report delivery (email/Slack/Teams)

---

## Part 5: Honest Assessment

**We are NOT at 97% Airtable parity.** That number counted files on disk, not working features.

**Realistic parity estimate:**
- Backend code quality: **90%** (real, tested, but not deployed)
- Frontend UX parity: **30%** (toolbar chaos, no multi-table tabs, no clean Tools menu, no column footers)
- End-to-end working: **10-20%** (depends on whether migrations have been run)
- AI experience (vs Omni): **20%** (intent detection works, but no plan presentation, no auto-data, no auto-automations)

**The good news:** The hardest part (backend services, SQL, API routes) is genuinely done and well-tested. The gap is primarily in:
1. DevOps (migration runner)
2. UI/UX (matching Airtable's clean, focused design)
3. AI flow (Omni-like experience)
4. Missing features (date dependencies, record templates, multi-table tabs)
