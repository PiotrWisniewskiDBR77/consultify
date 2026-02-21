# Wave 12 — 3 paczki (Cursor x3) — AI Context Governance + CV matching + SuperAdmin ops (T118–T122, T067, T108)

Odpal te 3 prompty jednocześnie (3 agentów). Każdy agent pracuje na **SWOIM branchu** i na końcu raportuje wg `PROMPT_TEMPLATE_V2.md`.

**Ostatni numer migracji (prefix cyfrowy w `server/migrations/`)**: `20260220`

Zarezerwowane numery migracji (jeśli potrzebne):
- Agent A: `20260227_*`
- Agent B: `20260228_*`
- Agent C: `20260301_*`

---

## PROMPT A — Cursor Agent 1 → Bundle 30G — T118–T122 (External web context + org/user governance + consolidation)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 30G — AI Context Governance & Architecture Hardening**:
- T118 — External Knowledge & Internet Context Management
- T119 — Organizational Context Governance
- T120 — Individual Context Governance (private mode)
- T121 — Extended org controls (per-project, per-document, DLP-lite)
- T122 — Architecture consolidation & dependency review (SSOT, route hygiene)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T118"..."## T122")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-30g-ai-context-governance

## Krok 2: Implementacja (V2 minimal, scope-safe)

### T118 — Web search governance (V2)
- Enforcement `internetEnabled` (org policy + regulatory mode) we wszystkich ścieżkach:
  - light web search (chat intent)
  - deep research service
  - tool `search_web`
- Domain policy + SSRF safety + cache/cooldown.
- Unified citations + audit trail (min. chat trace; prefer DB log jeśli proste).

### T119 — Org context governance (V2)
- SSOT polityki per org (prefer `organization_ai_settings.context_policy_json`):
  - toggles per category (ORG_PROFILE/TERMINOLOGY/PATTERNS/STRATEGY/DOCUMENTS)
  - runtime enforcement w `AIContextBuilder` (fail-soft, default bardziej restrykcyjny)
- PII redaction zgodnie z global sensitivity.
- Audit trail: contextHash + categories_used.
- Minimalny Admin UX: “Context Governance” + preview “what AI sees”.

### T120 — User privacy + private mode (V2)
- Private mode session-scoped: bez persistence/memory updates/web-sources snapshots.
- Preview/export/delete user memory + retention enforcement.
- Guardrails: PII nie zapisuje się do memory.

### T121 — Per-project/per-document controls (V2)
- Per-project overrides (mogą tylko ZAOSTRZAĆ politykę).
- Per-document ai_visibility + sensitivity + (minimal) HITL approval dla requires_approval.
- Audit: doc usage per chat run (used + blocked).

### T122 — Consolidation (V2)
- Przegląd `server/src/Gateway.ts` pod duplikaty mountów i stuby w prod:
  - wybierz kanoniczne ścieżki + aliasy dla legacy (bez breaking changes)
  - dodaj małe guardrails (np. wykrywanie duplicate mounts w startupChecks) jeśli ma sens

### Migracje
- Jeśli dodajesz/zmieniasz DB: użyj `20260227_*`.

### Pliki startowe (grounded w repo)
- `server/src/routes/ai.routes.ts`
- `server/src/services/aiPolicyEngine.ts`
- `server/src/services/aiContextBuilder.ts`
- `server/src/services/ai/deepResearchService.ts`, `server/src/services/ai/deepThinkingOrchestrator.ts`
- `server/src/services/ai/toolDefinitions.ts`
- `server/src/services/ai/enterpriseSecurity.ts`
- Knowledge layer: `server/src/services/KnowledgeService.ts`
- `server/src/Gateway.ts`

## Zasady (MUST)
- Default security posture: bardziej restrykcyjny przy braku polityki.
- Brak SSRF (blokuj private IP/localhost), brak PII w web queries.
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick
npm run test:protect (dotykasz policy/security)

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

---

## PROMPT B — Cursor Agent 2 → Bundle 20C — T067 (CV-based competency mapping + matching)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 20C — CV-based matching engine** (T067).

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T067")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-20c-cv-matching

## Krok 2: Implementacja

### T067 — Kluczowe deliverables (V2)
- CV ingestion (PDF/DOCX/TXT) + status pipeline: uploaded → extracted → mapped → ready.
- Extraction: normalizacja sekcji (experience/skills/education), minimalizacja danych do AI.
- Competency mapping na taxonomy z T065:
  - competencyId, inferredLevel (1–5), confidence, evidence snippets
  - ręczna korekta + approval
- Matching engine do initiative requirements (T065):
  - ranking + explainability + missing evidence
- Prywatność: redakcja PII w logach i promptach; kontrola retencji/usuwania.

### Migracje
- Jeśli dodajesz tabele (cv_uploads/cv_mappings itp.): użyj `20260228_*`.

### Pliki startowe (podpowiedź)
- PDF parsing: patrz istniejące importy PDF (np. `server/src/routes/pdf-import.routes.ts`, `server/src/services/pdfParserService.ts`)
- Competencies: T065 model + requirements
- UI: najpierw minimalny N‑mode artefakt “Candidate profile” (może być w Admin/Team)

## Zasady (MUST)
- Brak auto-decyzji: zawsze human approval przed użyciem.
- i18n: PL+EN dla UI.
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

---

## PROMPT C — Cursor Agent 3 → Bundle 30B — T108 (SuperAdmin control plane + system testing framework)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 30B — SuperAdmin control plane + testing framework hardening** (T108).

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T108")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-30b-superadmin-control-testing

## Krok 2: Implementacja

### T108 — Kluczowe deliverables (V2)
- SuperAdmin completeness: brak martwych modułów, spójne kontrakty API (error codes/validation).
- Guardrails high‑risk actions:
  - confirmation + reason + audit trail
  - impersonation: banner + audit + easy exit
- Test support API: bootstrap/cleanup bezpiecznie gated (test env + secret header).
- “No stubs in production”: upewnij się, że krytyczne ścieżki nie wystawiają 501 w prod.
- Deploy gates: smoke suite stabilna (jeśli trzeba – minimalne naprawy kontraktów pod e2e).

### Migracje
- Jeśli dodajesz audit/guardrails tables: użyj `20260301_*`.

### Pliki startowe (grounded w repo)
- UI: `src/views/superadmin/SuperAdminView.tsx`
- Backend:
  - `server/src/routes/superadmin.routes.ts`
  - `server/src/middleware/superAdmin.middleware.ts`
  - `server/src/routes/testSupport.routes.ts`
- E2E: `tests/e2e/smoke/deploy-gate-*`

## Zasady (MUST)
- Bezpieczeństwo: żadnych sekretów w UI/logach; maskowanie.
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick
npm run test:protect

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

