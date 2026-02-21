# Wave 10 — 3 paczki (Cursor x3) — AI Prompts SSOT + Interview Conductor + Competencies (T116, T013+T016, T065)

Odpal te 3 prompty jednocześnie (3 agentów). Każdy agent pracuje na **SWOIM branchu** i na końcu raportuje wg `PROMPT_TEMPLATE_V2.md`.

**Ostatni numer migracji (prefix cyfrowy w `server/migrations/`)**: `20260220`

Zarezerwowane numery migracji (jeśli potrzebne):
- Agent A: `20260221_*`
- Agent B: `20260222_*`
- Agent C: `20260223_*`

---

## PROMPT A — Cursor Agent 1 → Bundle 30E — T116 (Centralized AI Prompt Management & Learning System)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 30E — AI Prompts SSOT + Prompt Assembler + Learning loop** (T116).

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T116")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-30e-ai-prompt-ssot

## Krok 2: Implementacja

### T116 — Kluczowe deliverables (V2)
- Jeden kanoniczny registry promptów (SSOT na `ai_system_prompts`): CRUD + filters + versions + rollback (audit + reason).
- Ujednolicenie API: wybierz jeden kanoniczny `/api/ai-prompts/*` i zapewnij aliasy dla legacy route’ów bez breaking changes.
- Prompt Assembler działa realnie (nie `__unavailable__`) i jest używany przez:
  - prompt-assistant preview/test bench
  - produkcyjne endpointy AI (runtime)
- Learning loop end-to-end: feedback → patterns → instruction suggestions → approval/apply → assembler dopina instrukcje org.
- (Minimum) AB experiments na wersjach promptów (guardrails w SuperAdmin).

### Migracje
- Jeśli dodajesz/zmieniasz DB: użyj zarezerwowanego numeru `20260221_*`.

### Pliki startowe (podpowiedź, grounded w repo)
- `server/src/routes/prompt-assistant.routes.ts`
- `server/src/routes/ai-prompts.routes.ts`
- `server/src/routes/ai/ai-prompts.routes.ts`
- `server/src/services/ai/promptAssembler.ts` (obecnie unavailable)
- `server/src/services/ai/learningSystem.ts`, `server/src/services/ai/aiLearningService.ts`, `server/src/jobs/aiLearningJob.ts`
- UI: `src/views/superadmin/AIIntelligenceView.tsx`

## Zasady (MUST)
- DB migracje: natywny PostgreSQL w `server/migrations/*.sql`
- i18n: EN+PL jeśli dodajesz UI copy
- Jeśli dodasz nowe analytics events → dopisz do `src/services/funnelAnalytics.ts`
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick
Jeśli dotykasz auth/policy: npm run test:protect

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

---

## PROMPT B — Cursor Agent 2 → Bundle 03A — T013 + T016 (Interview Conversational + Inference Engine)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 03A — Interview Conversational Conductor + Structured Inference**:
- T013 — Conversational Control Questions (AI interview conductor)
- T016 — Advanced Insight Inference Engine (structured, sponsor-ready)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T013" i "## T016")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-03a-interview-inference

## Krok 2: Implementacja

### T013 — Kluczowe deliverables (V2)
- Conversational mode w obrębie sesji interview: transcript panel + questions task-list + progress.
- Endpointy AI:
  - `POST /interview/sessions/:sessionId/ai-parse` (draft map transcript→answers)
  - `POST /interview/questions/:questionId/ai-suggest` (facts-only starter)
- Review gate: AI nie zapisuje “na twardo” bez akceptacji użytkownika (apply step: PATCH na pytania).
- Statusy i metryki: answered/needs_follow_up + confidence.

### T016 — Kluczowe deliverables (V2)
- Inference run generujący **structured JSON** insighty: evidence[] + confidence + unknowns/counterpoints.
- Storage kompatybilny z istniejącymi insightami (prefer structured content, bez psucia markdown legacy).
- N‑mode “Insight pack”: list + detail + workflow (approve/review/regenerate/export).
- Export gotowy jako input pod T017 (ale T017 nie jest w tej paczce).

### Migracje
- Jeśli dodajesz/zmieniasz DB (np. transcript storage / structured insights): użyj `20260222_*`.

### Pliki startowe (grounded w repo)
- Backend:
  - `server/src/routes/interview.routes.ts`
  - `server/src/controllers/InterviewController.ts`
  - `server/src/services/InterviewInsightService.ts`
- Frontend:
  - `src/components/Interview/InterviewWorkspace.tsx`
  - `src/components/Interview/CategoryChat.tsx`
  - `src/components/Interview/QuestionsList.tsx`
  - `src/views/InterviewView.tsx`

## Zasady (MUST)
- “Facts only” dla answers i summary; rekomendacje jako osobna warstwa (insighty mogą mieć recommendations tylko jeśli jawnie oznaczone).
- i18n: wspieramy 6 języków UI; minimum EN+PL dla nowych kluczy.
- Jeśli dodasz nowe analytics events → dopisz do `src/services/funnelAnalytics.ts`
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

---

## PROMPT C — Cursor Agent 3 → Bundle 20A — T065 (Competency taxonomy + initiative requirements)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 20A — Competency Model Foundation** (T065).

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T065")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-20a-competency-taxonomy

## Krok 2: Implementacja

### T065 — Kluczowe deliverables (V2)
- Jeden kanoniczny model kompetencji (bez równoległych słowników).
- Taxonomy: kategorie + kompetencje + poziomy (np. 1–5).
- Mapping wymagań na inicjatywie:
  - competencyId, minLevel, must-have/nice-to-have, (opcjonalnie) headcount/FTE, justification
  - minimalny UX: “Add requirement” + tabela (InlineTable)
- Admin UX (N‑style): “Competency catalog” (CRUD + search + levels).
- Permissions: edycja katalogu tylko admin/HR/PMO; requirements zgodnie z permissions inicjatywy.

### Migracje
- Jeśli dodajesz tabele: użyj `20260223_*`.

### Pliki startowe (podpowiedź)
- Initiative UI (requirements sekcja): `src/components/Initiatives/*`, `src/components/InitiativeDetailModal.tsx`
- Backend initiatives: `server/src/routes/pmo/initiatives.routes.ts`, `server/src/services/*initiative*`
- Admin/Org: `src/views/OrganizationView.tsx`, `src/components/Organization/*`, `src/views/superadmin/*` (jeśli dotykasz)

## Zasady (MUST)
- i18n: PL+EN dla UI.
- Jeśli dodasz nowe analytics events → dopisz do `src/services/funnelAnalytics.ts`
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

