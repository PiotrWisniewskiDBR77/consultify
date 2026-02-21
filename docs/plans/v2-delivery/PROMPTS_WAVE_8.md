# Wave 8 — prompty do odpalenia równolegle (Cursor x4) + Codex (Bundle 16)

Odpal te 5 promptów jednocześnie:
- **Prompt A** → Cursor — Financial Modeling (T054)
- **Prompt B** → Cursor — Automated Reporting (T062)
- **Prompt C** → Codex — Enterprise Valuation (T055–T057)
- **Prompt D** → Cursor — Organization UX + Megatrend (T063–T064)
- **Prompt E** → Cursor — Landing Docs + Website (T094–T095)

Każdy agent pracuje na SWOIM branchu. Po skończeniu — raport wg `PROMPT_TEMPLATE_V2.md`.

Uwaga: prompty zgodne z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` (PostgreSQL, strict TS, FunnelEventName, i18n rules, nie edytujemy progress.md).

**Ostatni numer migracji:** 570. Użyj 571, 572, 573, 574, 575.

---

## PROMPT A — Cursor Agent 1 → Bundle 15 — T054

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 15 — Financial Modeling of Initiatives** (T054):
- Zintegrowany model finansowy: P&L + Balance Sheet + Cash Flow (spójne powiązania)
- Economic events engine (revenue, COGS, capex, depreciation, debt, tax, working capital)
- Consistency checks: Assets = Liabilities + Equity, ΔCash = OCF + ICF + FCF
- Financial Model workspace: Inputs, Events timeline, Outputs (P&L/BS/CF), Validation panel
- Workflow: DRAFT → REVIEW → APPROVED

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T054")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-15-financial-modeling

## Krok 2: Implementacja (V2 deliverables)

### T054 — Financial Modeling
- Tabele: financial_models, financial_model_events, financial_model_outputs, financial_model_validations
- Economic events: revenue, COGS, capex, depreciation, debt drawdown/repayment, interest, tax, WC changes
- Walidacje: bilans domknięty, cash tie-out, retained earnings
- UI: Financial Model workspace (Inputs, Events, Outputs, Validation)
- Integracja z T053 (budżet), T046 (ROI), T027 (raporty)

## Pliki startowe (podpowiedź)
- server/src/services/budgetingService.ts
- server/src/services/financialAnalysisService.ts
- server/src/routes/economics.routes.ts
- src/components/Benefits/* (FinancialAnalysisWorkspace, BudgetWorkspace)

## Zasady (MUST)
- DB = PostgreSQL. Migracje w server/migrations/*.sql — natywny PostgreSQL. Ostatni numer: 570.
- i18n: EN+PL minimum. Klucze na końcu translation.json, prefix finance.model.*
- Jeśli dodajesz analytics events → rozszerz FunnelEventName w src/services/funnelAnalytics.ts
- NIE edytuj docs/plans/v2-delivery/progress.md
- UI: docs/ui-standards/README.md, N-mode, lucide-react

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## PROMPT B — Cursor Agent 2 → Bundle 19 — T062

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 19 — Automated Recurring and Event-Triggered Reporting** (T062):
- Schedule definitions: time-based (daily/weekly/monthly/cron) + event-triggered (delay, risk, budget threshold)
- Deliverable: report (PDF/DOCX) lub presentation (PPTX) z template
- Recipients & delivery: in-app notification, email
- Execution history & audit
- UI: Reporting Automation workspace (lista schedule, create/edit, Run now)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T062")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-19-automated-reporting

## Krok 2: Implementacja (V2 deliverables)

### T062 — Automated Reporting
- Wykorzystaj: scheduledReportService, scheduled-reports.routes.ts
- Trigger evaluation: periodic job (np. co 15–60 min) skanujący sygnały
- Triggers: delay threshold, risk high, budget 80/90/100%, milestone (TBD)
- Generacja: Report Builder (T060) + Presentation Generator (T058)
- Throttling: max 1/24h per project per trigger type

## Pliki startowe (podpowiedź)
- server/src/services/scheduledReportService.ts (jeśli istnieje)
- server/src/routes/scheduled-reports.routes.ts
- server/src/services/reportAgentService.ts, reportQualityGatesService.ts
- server/src/services/presentationGeneratorService.ts

## Zasady (MUST)
- DB = PostgreSQL. Migracje w server/migrations/*.sql — natywny PostgreSQL. Ostatni numer: 570.
- i18n: EN+PL minimum. Klucze na końcu translation.json, prefix reports.automation.*
- Jeśli dodajesz analytics events → rozszerz FunnelEventName w src/services/funnelAnalytics.ts
- NIE edytuj docs/plans/v2-delivery/progress.md
- UI: docs/ui-standards/README.md, N-mode, lucide-react

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## PROMPT C — Codex → Bundle 16 — T055–T057

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 16 — Enterprise Valuation** (T055–T057):
- **T055** — Enterprise Valuation Module (DCF + comps, sensitivity, deck-ready)
- **T056** — Valuation Improvement Advisory (action-to-initiative)
- **T057** — Valuation Negotiation Argument Builder (pro/contra, objections)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T055", "## T056", "## T057")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-16-valuation

## Ważne deliverables (minimum V2)

### T055 — Enterprise Valuation
- DCF: FCFF, WACC, terminal value (Gordon + exit multiple)
- Multiples: trading comps (manual inputs)
- Sensitivity: 2D table, tornado, scenarios
- Guided flow: Source → Assumptions → Results → Sensitivity → Export
- Źródło prognoz: T054 (model) lub T053 (budżet) lub manual

### T056 — Valuation Improvement Advisory
- "How to improve valuation" — compliant, action-to-initiative
- Value drivers, rekomendacje

### T057 — Negotiation Argument Builder
- Pro/contra, objections & rebuttals
- Deck-ready output

## Pliki startowe (podpowiedź)
- server/src/services/financialAnalysisService.ts
- server/src/services/budgetingService.ts
- src/components/Benefits/*
- server/src/routes/economics.routes.ts

## Zasady (MUST)
- DB = PostgreSQL. Migracje natywny PostgreSQL. Ostatni numer: 570.
- i18n: EN+PL, klucze na końcu, prefix valuation.*
- Jeśli analytics → FunnelEventName
- NIE edytuj progress.md
- UI: docs/ui-standards/README.md, N-mode

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## PROMPT D — Cursor Agent 3 → Bundle 20 (slice) — T063–T064

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 20 (slice) — Organization UX + Megatrend relocation** (T063–T064):
- **T063** — Organization Module: UX i visual redesign (premium IA, N-style, conversion-ready)
- **T064** — Megatrend Analysis: relokacja Tools → Strategy (canonical, zero feature loss)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T063", "## T064")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-20-organization-megatrend

## Krok 2: Implementacja (V2 deliverables)

### T063 — Organization UX Redesign
- Jeden "Organization workspace": Context (profile/goals/strategy) + Administration (members, billing, limits, domains, branding)
- N-style layout: page-first, building blocks (Callout, ToggleBlock, EmptyStateInline, InlineTable)
- Zgodność z docs/ui-standards (Tech Sexy: monochromatic chrome, outline icons)
- Pliki: OrganizationView.tsx, OrganizationSettings.tsx, OrganizationProfileView.tsx

### T064 — Megatrend Relocation
- Canonical: Tools → Strategy → Megatrends (np. /discovery-tools/strategic/megatrends)
- Redirect: /context/megatrends, /organization/megatrends → canonical
- Jeden Megatrends workspace, reużycie w Tools (bez duplikacji)
- MegatrendScannerModule → wyodrębniony wspólny komponent

## Pliki startowe (podpowiedź)
- src/views/OrganizationView.tsx, OrganizationSidebar.tsx
- src/components/settings/OrganizationSettings.tsx
- src/views/admin/OrganizationProfileView.tsx
- src/views/ContextBuilder/ContextBuilderView.tsx
- docs/ui-standards/README.md, 02-components/building-blocks.md

## Zasady (MUST)
- DB = PostgreSQL. Migracje tylko jeśli nowe tabele — ostatni numer: 570.
- i18n: EN+PL minimum. Prefix organization.*, megatrends.*
- Analytics: org_workspace_opened, megatrends_opened, megatrends_redirect_used → FunnelEventName
- NIE edytuj docs/plans/v2-delivery/progress.md
- UI: docs/ui-standards/README.md, N-mode, lucide-react

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## PROMPT E — Cursor Agent 4 → Bundle 27 — T094–T095

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 27 — Landing Documentation + Website Content** (T094–T095):
- **T094** — Documentation Section na landing (trust, deep links, search entrypoint)
- **T095** — Full Website Content Replacement & Visual Update (market story, brand consistency)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T094", "## T095")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-27-landing-docs-website

## Krok 2: Implementacja (V2 deliverables)

### T094 — Documentation Section
- Sekcja "Documentation" na ProductEntryPage / PublicLandingPage
- Shortcuts: Getting Started, Security, API Reference, Changelog, Legal Center
- Real routes: /docs, /docs/security, /docs/api, /docs/changelog, /legal
- Search CTA → /docs/search?q=...
- Analytics: landing_docs_section_viewed, landing_docs_cta_clicked, landing_docs_search_used

### T095 — Website Content & Visual Update
- Messaging: transformation AI consulting system (spójna narracja)
- Update: HeroSection, InfoSections, TrustStrip, BecomePartnerView, AppPricingView, ChangelogView
- Brand consistency: brak miksów IRIS/TechnoLex/Consultify
- Aktualne screeny/visuale zgodne z UI V2
- Spójne CTA do demo/trial

## Pliki startowe (podpowiedź)
- src/views/ProductEntryPage.tsx
- src/views/PublicLandingPage.tsx
- src/views/BecomePartnerView.tsx
- src/views/AppPricingView.tsx
- src/views/ChangelogView.tsx
- docs/ui-standards/README.md

## Zasady (MUST)
- Brak migracji DB (tylko UI/content).
- i18n: EN+PL minimum. Prefix landing.*
- Analytics → FunnelEventName (landing_docs_*)
- NIE edytuj docs/plans/v2-delivery/progress.md
- UI: Tech Sexy, mobile-first, zero dead links

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## Po zakończeniu pracy agentów

Gdy agent zgłosi gotowość ("in_review"):

1. Sprawdź branch: git switch bundle-XX-nazwa
2. Uruchom testy: npm run verify:quick (i test:protect jeśli dotyczy)
3. Manual QA z checklisty
4. Merge: git switch main && git pull && git merge bundle-XX-nazwa --no-edit
5. Jeśli konflikty w translation.json — rozwiąż ręcznie (klucze na końcu)
6. Migracje: sprawdź numerację (571–575)
7. Push: git push origin main
8. Zaktualizuj progress.md centralnie: Status → merged
