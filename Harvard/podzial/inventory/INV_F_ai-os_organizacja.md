# Inwentarz funkcjonalności F — AI OS / INTERNAL TOOLS + ORGANIZACJA

Część mapy modułów V2. Zweryfikowane w kodzie 2026-06-11, branch `feat/deliverables-light`.

---

## MODUŁ: AI OS / INTERNAL TOOLS

**Trasy:** `/ai` (alias `/ai-os`) + 8 pod-tras: `/ai/action-center`, `/ai/research-sessions`, `/ai/artifacts`, `/ai/context`, `/ai/connectors`, `/ai/agents`, `/ai/outcomes` — montaż przez `renderInternalToolsShell` → `InternalToolsGate` (`AppRoutes.tsx:1230-1298`). Badge **beta**. `/ai/work-canvas` JAWNIE wyłączony z gatingu Internal Tools (osobny moduł Canvas).
**Opis:** Wewnętrzny (DBR77-only) panel sterowania „AI OS" — runtime'owe panele governance AI: akcje z aprobatą, sesje researchu, artefakty, pamięć, konektory, agenci, KPI/ROI.

**Podwójny gating:**
- Frontend (`internalToolsAccess.ts` → `canUseInternalTools`): DEV zawsze; prod wymaga `VITE_INTERNAL_TOOLS_ENABLED=true` + domena `dbr77.com` + rola SUPERADMIN/ADMIN/OWNER + org dbr77.
- Backend (`internalTools.middleware.ts` → `requireInternalToolsAccess`, mount `Gateway.ts:372-394`): prod wymaga `INTERNAL_TOOLS_ENABLED=true` + domena + rola; inaczej **404**.

### 1. AI_OS_HOME — `/ai` — `AIOSHub.tsx`
1. Hub z 6 kartami modułów + checklisty testów akceptacyjnych. [DZIAŁA — nawigacja]
2. AI OS Build Milestones — tabela 10 fal; „static reference, not a live health check". [STUB — statyczne]
3. V10 Teresa voice workspace — live odczyt `/api/v10/teresa/voice-config`. [DZIAŁA — diagnostyka read-only]

### 2. AI Actions — `/ai/action-center` — `ActionCenter.tsx`
1. Lista propozycji akcji AI (scope mine→org), statusy + severity. [DZIAŁA] `ai.routes.ts:6001`
2. Approve / Reject / Execute — osobna aprobata od egzekucji. [DZIAŁA]
3. Run Ledger — read-only AIRuns z degradacją. [DZIAŁA]
4. Audit Viewer — kto/co/kiedy/dlaczego + rollback + eventy. [DZIAŁA]
5. Deep-link `?actionId=`. [DZIAŁA]

### 3. Research Sessions — `/ai/research-sessions` — `ResearchSessionsDock.tsx`
1. Tworzenie sesji — mission + scope + pytania + dozwolone źródła. [DZIAŁA]
2. Lifecycle: Approve → Start → Pause → Resume → Retry. [DZIAŁA]
3. Auto-refresh (polling 5 s). [DZIAŁA]
4. Evidence Graph — confidence %, klasa źródła, flaga sprzeczności. [DZIAŁA]
5. Final Artifact — raport markdown. [DZIAŁA]
6. Tryb compact (osadzany). [DZIAŁA]

### 4. Artifacts — `/ai/artifacts` — `Wave5ArtifactRuntimePanel.tsx`
**Backend `/api/artifacts` ma DODATKOWO `v8FeatureGate`** — bez `ENABLE_V8_GLOBAL` panel widoczny, ale API 404 (zgodne z findingiem „v8 404 na stagingu").
1. Generate Output (executive_report / board_deck / kpi_table). [ZA FLAGĄ]
2. Create Artifact — 11 typów. [ZA FLAGĄ]
3. Document Filling — szablon `{{pola}}`; brakujące pola → pytania. [ZA FLAGĄ]
4. Mutation proposals z diffem — propose→diff→approve→commit. [ZA FLAGĄ]
5. Version lineage v1..vN. [ZA FLAGĄ]
6. Provenance footer + Export manifest. [ZA FLAGĄ]

### 5. Memory & Scope — `/ai/context` — `Wave6ContextLearningPanel.tsx`
1. „What AI Knows" — snapshoty kontekstu (org/project/user) ze świeżością. [DZIAŁA]
2. Capture context snapshot. [DZIAŁA]
3. Private mode — blokada zapisów uczenia. [DZIAŁA]
4. Memory Candidate — assistant scope (teresa_tenant/anna_public) + memory scope + klucz, retencja 180 dni. [DZIAŁA]
5. Memory Stewardship Queue — approve/reject/apply/expire z powodem. [DZIAŁA]

### 6. Connectors — `/ai/connectors` — `Wave7ConnectorAdminPanel.tsx`
1. Katalog + rejestracja konektora — ACL per-projekt, freshness TTL. [DZIAŁA]
2. Tool Execution Test — write/destructive wymagają AIRun id. [DZIAŁA]
3. Real Source Binding — link do `tp_connectors` + Reindex + Disconnect. [DZIAŁA]
4. OAuth Session Lifecycle — RĘCZNE ustawianie stanów, nie realny OAuth flow. [DZIAŁA-ALE-SYMULOWANE]
5. Connector Health dashboard. [DZIAŁA]
6. ConnectorRun Audit. [DZIAŁA]

### 7. Agents — `/ai/agents` — `Wave8AgentCatalogPanel.tsx`
1. Katalog agentów (DB-backed) — role, persona, allowed/blocked tools, approval policy, cost class, risk. [DZIAŁA]
2. Launch agenta — goal + tools + harmonogram + swarm z budżetem. [DZIAŁA]
3. Scoped tool execution test. [DZIAŁA]
4. Edycja definicji agenta. [DZIAŁA]
5. Process due schedules. [DZIAŁA]
6. Run history + Notifications. [DZIAŁA]

### 8. KPI/ROI & AI Ops — `/ai/outcomes` — `Wave9OutcomeAIOpsPanel.tsx`
1. Tworzenie outcome KPI/ROI z automatyczną rejestracją evidence. [DZIAŁA]
2. Value report builder. [DZIAŁA]
3. AI Ops: provider health / incydenty / eval runs. [DZIAŁA]
4. Acceptance runs (regression/CISO/persona/compliance). [DZIAŁA]
5. Final AI OS acceptance gate. [DZIAŁA]
6. AI Ops dashboard. [DZIAŁA]

---

## MODUŁ: ORGANIZACJA

**Trasy:** `/organization/*` → `OrganizationView.tsx` (`ProtectedRoute requireAuth` — **bez wymogu roli na routcie**). Wpis sidebar tylko dla ADMIN/OWNER/SUPERADMIN — member nie widzi wpisu, ale wejdzie deep-linkiem (gating po stronie API). Nawigacja wewnętrzna (`OrganizationSidebar.tsx`): ORGANIZATION (profile, goals, challenges, megatrends, strategy, knowledge-graph) + ADMINISTRATION (members, competencies, billing, limits, domains, branding). Legacy `/context/*` przekierowane.
**Opis:** Workspace organizacji — kontekst biznesowy dla AI + sekcje administracyjne.

**Anomalia nawigacyjna (do audytu):** kliknięcie sekcji ADMINISTRATION w sidebarze **przekierowuje** do `/admin/*` (`ADMIN_REDIRECTS`, `OrganizationView.tsx:37`), ale **bezpośredni URL** `/organization/members` itd. renderuje INNY, lokalny `OrganizationAdminPanel` — podwójna implementacja tych samych sekcji.

1. **Profil firmy** — `/organization/profile` — kanoniczny SSOT (zastąpił split-brain): 9 sekcji warunkowych, zapis `GET/PUT /api/organization-profiles/:orgId`, ekstrakcja z dokumentu przez AI (propozycje do zatwierdzenia), podpowiedzi Teresy, walidacje krzyżowe, wskaźnik gotowości. [DZIAŁA] `OrganizationProfileModule.tsx` (1592 l.)
2. **Cele (Goals & Expectations)** — taby intent/metrics/scope/nogo/expectations; dane w zustand persist **wyłącznie localStorage**, sugestie AI częściowo zamockowane. [DZIAŁA-LOKALNIE — brak persystencji backendowej, nie zasila kontekstu serwera]
3. **Wyzwania (Challenge Map)** — mapa z dowodami i root-causes; localStorage-only. [DZIAŁA-LOKALNIE]
4. **Strategia (Strategic Synthesis)** — Hidden Risks / Strengths / Scenarios / Executive Report; AI realne (`Api.chatWithAI` z fallbackiem rule-based); persystencja lokalna. [DZIAŁA-LOKALNIE]
5. **Megatrendy** — wyłącznie redirect do Discovery Tools. [DZIAŁA — redirect]
6. **Knowledge Graph** — interaktywny eksplorator (React Flow + dagre): statystyki, wyszukiwanie encji, relacje, trawersowanie, proweniencja claimów; backend `/api/knowledge-graph`. [DZIAŁA]
7. **Baner kontekstu Teresy (OrgContextSummaryBanner)** — liczba claimów + ostatni rebuild, przycisk Rebuild (admin-only), live-refresh przez Socket.IO `/org-context`; **zastąpił statyczny marketingowy OrganizationV8CanonPanel (usunięty)**. [DZIAŁA]
8. **Members** — lista członków + zaproszenia e-mail z rolą; **zaproszenia NIE są już mountStub** („M16 P0-1: production route", `Gateway.ts:695-697`). Braki: brak usuwania członka i zmiany roli w TYM panelu. [DZIAŁA]
9. **Competencies** — taksonomia: kategorie CRUD + seed, kompetencje, poziomy; `/api/competency` + `/api/capabilities`. [DZIAŁA]
10. **Billing** — plan + zużycie tokenów live z policy-snapshot; **„Upgrade" tylko trackuje event — żaden checkout** (martwe CTA). [WIDOCZNE-ALE-NIEPEŁNE]
11. **Limits** — live limity + zużycie; „View Plans" też tylko trackFunnelEvent. [WIDOCZNE-ALE-NIEPEŁNE]
12. **Domains** — custom domain (PATCH branding, verified/pending) + approved email domains (auto-join). [DZIAŁA — DNS pozostaje krokiem operatora]
13. **Branding** — logo upload, kolor brandu live; sekcja Regional **read-only**. [DZIAŁA — regional bez edycji]
14. **OrgContext (globalny kontekst React)** — lista organizacji, **przełączanie org z wymianą tokenu** + hard reload (fix deep-linków Elkomtech), sync między kartami, czyszczenie stale org-id (fix 403). [DZIAŁA]

### Ryzyka zasygnalizowane (do audytu)
- Goals/Challenges/Strategy: localStorage-only — nie zasilają backendowego kontekstu Teresy (w przeciwieństwie do Profilu).
- Podwójna implementacja sekcji admin (lokalny panel vs redirect do /admin) — drift.
- `/organization/*` bez gatingu roli na routcie.
- Billing/Limits CTA bez akcji.
- AI OS Artifacts: panel widoczny przy wyłączonym `ENABLE_V8_GLOBAL`, API 404.
