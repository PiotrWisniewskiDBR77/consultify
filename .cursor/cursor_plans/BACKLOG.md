# 📋 CONSULTIFY BACKLOG

> Tematy do realizacji w przyszłości, zgrupowane tematycznie.

---

## 🔧 SETTINGS MODULE (Admin & User Settings)

### 1. Governance Structure / Approval Matrix (Admin)
**Priority:** P1 - Needed before go-live  
**Description:**  
Konfigurowalny model zatwierdzania inicjatyw w ustawieniach administratora:
- **Option A:** Single Owner (jeden decydent)
- **Option B:** Dual Ownership (Business + Execution muszą zatwierdzić)
- **Option C:** Multi-approver z progami budżetowymi (np. >100k PLN = CFO)
- **Option D:** Hierarchiczny (Team Lead → Manager → Sponsor)

**UI Location:** Admin Panel → Organization Settings → Governance Rules

**Related:** Initiative approval workflow, role-based access control

---

### 5. Financial Tracking Mode (Admin/User)
**Priority:** P2  
**Description:**  
3 opcje wyboru dla użytkownika/organizacji:
- **Simple:** Tylko planned CAPEX/OPEX
- **Standard:** Forecast vs Actual + warning signals przy przekroczeniu progu
- **Advanced:** EVM (Earned Value Management) + budget breakdown by quarter

**Features to include:**
- Forecast at completion
- Realization tracking (planned vs actual spend)
- Warning signals (e.g., >10% variance = yellow, >25% = red)
- Dashboard widget for finance overview

**UI Location:** Admin Panel → Finance Settings

---

### 7. Notifications & Task Assignment Rules (Admin + User)
**Priority:** P1  
**Description:**  
Pełny pakiet notyfikacji z konfiguracją na poziomie:

**Admin Settings (Organization-wide defaults):**
- Default notification channels (email, in-app, both)
- Escalation rules (e.g., blocked task → escalate after X hours)
- Mandatory notifications (cannot be disabled by user)

**User Settings (Personal preferences):**
- Which events trigger notifications
- Notification frequency (immediate, daily digest, weekly)
- Quiet hours / Do not disturb
- Channel preference per event type

**Events to support:**
- [ ] Task assigned to me
- [ ] Task due in X days (configurable)
- [ ] Task overdue
- [ ] Task blocked
- [ ] Initiative needs my approval
- [ ] Initiative status changed
- [ ] Comment/mention
- [ ] Budget threshold reached

**UI Location:** 
- Admin Panel → Notification Settings
- User Profile → My Notifications

---

### 8. AI Autonomy Level (Admin)
**Priority:** P2  
**Description:**  
Poziom autonomii AI konfigurowalny przez administratora:

**Levels:**
- **Observer:** AI only suggests, never acts
- **Assistant:** AI can draft, but ALL actions require human approval
- **Copilot:** AI can execute low-risk actions (e.g., create draft tasks), high-risk require approval
- **Autonomous:** AI can execute most actions, only critical decisions require approval

**AI Actions to control:**
- Auto-create tasks from initiative description
- Suggest task dependencies
- Predict delivery risk
- Draft approval summary for decision maker
- Auto-escalate when criteria met
- Send reminders

**UI Location:** Admin Panel → AI Settings → Autonomy Level

**Safety:**
- Audit log of all AI actions
- "AI executed" badge on auto-generated content
- One-click revert for AI actions

---

### 9. AI Report Generation Prompts & Instructions (Admin)
**Priority:** P2  
**Description:**  
Rozbudowane ustawienia AI do generowania raportów DRD:

**Konfiguracja promptów:**
- Styl pisania (formalny, techniczny, przystępny)
- Długość sekcji (krótki/standardowy/rozbudowany)
- Język raportu (PL/EN)
- Instrukcje specyficzne dla organizacji (np. "używaj naszej terminologii")
- Szablony tekstów dla Executive Summary, rekomendacji, etc.

**Parametry generowania:**
- Max tokens per section
- Poziom szczegółowości opisu luk
- Czy uwzględniać benchmarki branżowe
- Formatowanie tabel i wykresów

**Wyjaśnienia dla użytkownika:**
- Tooltip/help text przy każdym parametrze
- Przykłady wpływu parametru na wynik
- "Preview" wygenerowanej sekcji z aktualnymi ustawieniami

**UI Location:** Admin Panel → AI Settings → Report Generation

**Related:** Report Builder, AI Autonomy Level (#8)

---

## 📦 FUTURE FEATURES (Not Settings)

### Task Dependencies Visualization
**Priority:** P2  
**Description:**  
Wizualne linkowanie tasków (Blocks / Blocked By):
- Dependency graph view
- Critical path highlighting
- Automatic blocking status when upstream task not done

**Status:** Currently shows "Coming in Phase 2" in UI

---

### Version Snapshots for Initiatives
**Priority:** P3  
**Description:**  
Immutable snapshots przy kluczowych zmianach statusu:
- Snapshot on SUBMIT_FOR_REVIEW
- Snapshot on APPROVED
- Ability to compare versions side-by-side
- Restore from historical version (creates new version)

---

### Multi-Currency Support
**Priority:** P3  
**Description:**  
Wsparcie dla wielu walut w financial tracking:
- Default organization currency
- Per-initiative currency override
- Exchange rate management
- Consolidated reporting in base currency

---

## ✅ DECISIONS MADE (Reference)

| # | Topic | Decision | Date |
|---|-------|----------|------|
| 2 | Task Types | Current list sufficient (ANALYSIS, DESIGN, BUILD, PILOT, VALIDATION, DECISION, CHANGE_MGMT) | 2024-12-26 |
| 3 | Evidence Standards | Only person declaration/sign-off required. No external system linking needed. | 2024-12-26 |
| 4 | Initiative Lifecycle | DRAFT → PLANNING → REVIEW → APPROVED → EXECUTING → DONE → ARCHIVED. DRAFT→PLANNING = transfer to Initiative Management module. APPROVED = transfer to Execution module. | 2024-12-26 |
| 6 | Progress Calculation | % of closed tasks. Tasks have weight (default: equal). Weight customizable per initiative. | 2024-12-26 |

---

## 📊 IMPLEMENTATION STATUS

| Feature | Status | Module | Notes |
|---------|--------|--------|-------|
| Initiative Charter Modal | ✅ Done | Assessment/Initiatives | All 10 tabs complete |
| Governance Tab | ✅ Done | Initiatives | Roles, Workflow, Audit Trail |
| Team Tab | ✅ Done | Initiatives | Resource allocation, roles, % |
| Comments/Discussion Tab | ✅ Done | Initiatives | Threaded comments |
| History Tab | ✅ Done | Initiatives | Version snapshots, export |
| Related Initiatives | ✅ Done | Initiatives | Dependency linking |
| Export Charter | ✅ Done | Initiatives | JSON export (PDF planned) |
| Clone/Template | ✅ Done | Initiatives | Duplicate as template |
| Task Detail Modal | ✅ Done | Initiatives | With Evidence Sign-off |
| Task Weight System | ✅ Done | Initiatives | 1-5x weight for progress calc |
| Bulk Status Change | ✅ Done | Initiatives | Multi-select tasks |
| Module Transition Indicator | ✅ Done | Initiatives | Visual breadcrumb |
| Enhanced Readiness Score | ✅ Done | Initiatives | 7-category breakdown |
| Quick Actions (Cards) | ✅ Done | Initiatives | Advance, Assign, Flag |
| Initiative Context in Tasks | ✅ Done | Initiatives | Header banner |
| Status Machine | ✅ Done | Backend | Full lifecycle |
| Approval Workflow | 🔴 Not Started | Backend + UI | Blocked by Settings #1 |
| Notifications System | 🔴 Not Started | Backend + UI | Backlog #7 |
| AI Autonomy Controls | 🔴 Not Started | Backend + UI | Backlog #8 |
| Financial Tracking Modes | 🔴 Not Started | Backend + UI | Backlog #5 |
| Task Dependencies | 🔴 Not Started | Initiatives | Coming in Phase 2 |

---

*Last updated: 2024-12-26*

