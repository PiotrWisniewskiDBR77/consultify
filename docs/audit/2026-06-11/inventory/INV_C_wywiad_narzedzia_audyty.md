# Inwentarz funkcjonalności C — WYWIAD + NARZĘDZIA + AUDYTY

Część mapy modułów V2. Zweryfikowane w kodzie 2026-06-11, branch `feat/deliverables-light`.

**Globalne mechanizmy gatingu:**
- Closed beta (`betaAccess.ts`): `MODULE_AUDITS: 'closed'`, `BETA_ADMINS_EXEMPT = false` → Audyty zablokowane w sidebarze dla WSZYSTKICH; trasa `/audit-programs` działa po wpisaniu URL.
- Public-production lock (`publicProduction.ts`): na consultify.ai tylko core menu (Chat, Interview, My Work, Inicjatywy, Wdrożenie, Settings) — Tools i Audyty tam zablokowane (`ProductionModuleGate`).

---

## MODUŁ: WYWIAD (Interview / Discovery Consultant)

**Trasy:** `/discovery` → `InterviewHub` (aliasy `/interview`, `/project-intelligence`); `/discovery/canvas` → `DiscoveryConsultantView`.
**Komponent:** `src/components/Interview/InterviewHub.tsx` (13 605 linii). **Serwer:** `interview.routes.ts` (89 handlerów) + `interview-enterprise.routes.ts` (23).
**Opis:** ustrukturyzowane wywiady diagnostyczne — szablony pytań → przydziały → sesje (ręczne/konwersacyjne z AI) → wnioski → inicjatywy.

1. **Inbox (my_assignments)** — moje przydzielone wywiady, start/submit. [DZIAŁA]
2. **Sesje (manager)** — filtry per-kolumna, bulk lifecycle (archive/trash/restore/delete), bulk eksport. [DZIAŁA]
3. **Przydzielone (manager)** — `AssignInterviewModal` (szablon, użytkownicy/zespół, termin, priorytet, scope), remind, approve/send-back/escalate, przeterminowane. [DZIAŁA]
4. **Szablony** — `TemplateBuilder` (3304 l.): CRUD, 5 kategorii, drag&drop pytań, typy (open/select/scale/boolean), publish draft→approved, clone, import-source, AI evaluate-quality, default, archive. [DZIAŁA]
5. **Wnioski / Insights** — generowanie AI z sesji, regenerate, workflow statusów, komentarze, activity log, eksport do Tools/Assessment, widok płaski + raportowy. [DZIAŁA]
6. **InsightViewer** — kanoniczny 2-panelowy podgląd z evidence i material quality; durable guard na częściowe `material_quality_json` (fix 2026-06-09). [DZIAŁA] (8574 l.)
7. **Inicjatywy** — realne inicjatywy + `InitiativeWizardModal` w trybie `generate_from_evidence`. [DZIAŁA]
8. **Tab `pending_review`** — celowo wyłączony („intentionally hidden before client delivery"). [UKRYTE] `InterviewHub.tsx:2689`
9. **InterviewWorkspace (sesja)** — kategorie pytań, lifecycle, tryb recenzenta, AI per pytanie (suggest/improve/explain), ocena jakości AI, eksport MD, notatki, dowody (voice evidence), linked items, Company Facts, podsumowanie sesji. [DZIAŁA] (2959 l.)
10. **Tryby runtime sesji** — single_question / task_list / conversational + rekomendacja AI. [DZIAŁA]
11. **Wywiad konwersacyjny AI** — `ConversationalPanel` (transkrypt z Teresą) + AI parse transkryptu na odpowiedzi z draft-review. [DZIAŁA]
12. **Inference runs** — pipeline generacji wniosków. [DZIAŁA]
13. **Kontekst organizacji + eksport + knowledge search** — [DZIAŁA]
14. **Proces 4-krokowy** — istnieje jako flow tabów; dedykowany przeprojektowany stepper wizualny (redesign 2026-06-06) NIE zbudowany. [DZIAŁA jako flow / redesign brak]
15. **Szablony ankietowe (survey, VTS/Elkomtech)** — zwykłe szablony wywiadu; seed `seed-elkomtech-survey-templates.mjs` (idempotentny) — **untracked**. [DZIAŁA]

---

## MODUŁ: NARZĘDZIA (Tools)

### Library — `/discovery-tools` (+ `/strategic`, `/operational`, `/digital`, `/process-automation`, `/strategic/megatrends`)
**Komponent:** `DiscoveryToolsHub.tsx` (4655 l.); workspace `src/components/DiscoveryTools/`. **Serwer:** `tools.routes.ts`, katalog SSOT `KnownToolsService.ts`. **Gating:** ProductionModuleGate (zablokowane na consultify.ai).

1. **Biblioteka 31 narzędzi** (10 strategicznych, 10 operacyjnych, 10 digital, 1 automation) + 5 licencjonowanych assessmentów (DRD/SIRI/ADMA/CMMI/LEAN) jako kategoria. [DZIAŁA]
2. **Licznik real vs stub:** **14 launchable (SHIP)** / **17 z `isComingSoon: true`** (start sesji zablokowany). SHIP: dynamic-swot, market-forces, growth-paths, portfolio-priority, risk-uncertainty, process-automation, sop-builder, a3-problem-solving, smed-planner, dms-builder, inventory-autopilot, ai-discovery, pain-explorer, rpa-scanner. `KnownToolsService.ts:199-217`
3. **Głębokość treści kroków:** 5 strategicznych z pełnymi dedykowanymi fazami UI; 5 operacyjnych z krokami domenowymi; 3 digital SHIP na `GenericDomainStep` (generyczny formularz); string „Step content not implemented yet" usunięty — elegancki guard + smoke test. [DZIAŁA dla SHIP / STUB dla 17 coming-soon]
4. **ToolWorkspace (runner sesji)** — stepper, generacja pełnej sesji AI, karty propozycji accept/reject/rethink (governance), InlineAssist, gating ukończenia, żądanie review. [DZIAŁA]
5. **Sesje** — lista ze statusami/progresem/confidence. [DZIAŁA]
6. **Outputs** — agregacja: assessment_report / report_builder / presentation_deck z trasowalnością. [DZIAŁA]
7. **Inicjatywy z narzędzi** — `GenerateInitiativesModal`. [DZIAŁA]
8. **Megatrend Analysis** — `/discovery-tools/strategic/megatrendy` → `MegatrendsWorkspace` (radar trendów, baseline branżowy, AI insights). [DZIAŁA]
9. **Dokument/raport narzędzia** — ToolDocumentView / KnownToolDetailView. [DZIAŁA]

### Assessment — `/assessment/*`
**Komponent:** `AssessmentHub.tsx` + `AssessmentSessionEditorView.tsx`. **Serwer:** `assessment-workflow-v2.routes.ts` (43 handlery).

10. **Hub: 3 taby (Assessment / Reports / Initiatives)** z lifecycle (DRAFT→IN_REVIEW→AWAITING_APPROVAL→APPROVED…). [DZIAŁA — zablokowany na public prod]
11. **Tworzenie assessmentu** — frameworki DRD / SIRI / ADMA / CMMI / LEAN. [DZIAŁA]
12. **Edytor sesji (Workflow v2)** — dedykowane edytory DRD/SIRI/ADMA/CMMI/Lean; lock/unlock, manage panel, permissions. [DZIAŁA]
13. **Raporty** — modal, template picker, import zewnętrznych, statusy APPROVED/FINAL. [DZIAŁA]
14. **Generacja inicjatyw z assessmentu** — `InitiativesGenerationWizardModal`. [ZA FLAGĄ `assessmentInitiativesWizard`, default false]
15. **AssessmentAuditsWorkspace, AuditHistoryView** — brak montażu w trasach. [UKRYTE/MARTWY KOD — do potwierdzenia]

---

## MODUŁ: AUDYTY (Audit Orchestrator)

**Trasy:** `/audit-programs` → `AuditsHub`; publiczny showcase `/audits` (marketing).
**Komponenty:** `src/components/Audit/`. **Serwer:** `audit-programs.routes.ts` (7 handlerów) + `auditProgramService.ts`.
**Status:** ZA FLAGĄ (closed beta — sidebar zablokowany dla wszystkich; URL bezpośredni działa; public prod zablokowane).
**Uwaga terminologiczna:** to NIE runner DRD/SIRI/ADMA/Lean (te w Tools→Assessment) — to orkiestrator programów audytowych opartych o szablony wywiadów (fan-out ankiet).

1. **Lista programów** — paginacja serwerowa, wyszukiwarka, filtr statusu. [DZIAŁA*]
2. **Kreator programu (4 kroki)** — Objective+preset → Templates → Assignees → Review+Create. [DZIAŁA*]
3. **Presety** — `iso27001`, `new-company` + quick-launcher. [DZIAŁA*]
4. **Dashboard programu** — status, liczniki, wskaźnik ukończenia. [DZIAŁA*]
5. **Generuj ankiety (fan-out)** — przydziały szablon×osoba przez kanoniczny `interviewAssignmentService.create`, idempotentne. [DZIAŁA*]
6. **Completion rollup** — {generated,total,done,percent,byStatus}. [DZIAŁA*]
7. **Edycja/usuwanie programu** — [DZIAŁA*]
8. **Public showcase `/audits`** — strona pokazowa bez logiki. [DZIAŁA, publiczna]

(*) kodowo kompletne end-to-end, ale moduł za zamkniętą betą.
