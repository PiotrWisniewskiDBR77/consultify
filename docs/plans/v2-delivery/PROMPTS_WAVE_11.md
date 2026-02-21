# Wave 11 — 3 paczki (Cursor x3) — System Brain + Survey/Public link + Skills Gap (T117, T014+T015+T017, T066)

Odpal te 3 prompty jednocześnie (3 agentów). Każdy agent pracuje na **SWOIM branchu** i na końcu raportuje wg `PROMPT_TEMPLATE_V2.md`.

**Ostatni numer migracji (prefix cyfrowy w `server/migrations/`)**: `20260220`

Zarezerwowane numery migracji (jeśli potrzebne):
- Agent A: `20260224_*`
- Agent B: `20260225_*`
- Agent C: `20260226_*`

---

## PROMPT A — Cursor Agent 1 → Bundle 30F — T117 (Core Documentation Layer / “system brain” + citations)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 30F — Core Documentation Layer (“system brain”)** (T117).

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T117")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-30f-system-brain-citations

## Krok 2: Implementacja

### T117 — Kluczowe deliverables (V2)
- Core docs registry i ingestion/indexing do RAG:
  - kanon: `knowledge_documents` + `knowledge_chunks` (266), scope=system, orgId=NULL
  - dedupe po hash + version bump przy zmianie treści
  - job/command do reindex + drift detection (stale index vs canonical file)
- Context injection policy:
  - system docs layer jest zawsze dostępna (token-budgeted) dla governance/policy pytań (fail-safe)
- Citations & verification:
  - governance odpowiedzi wymagają min. 1 cytowania `[DOCx]`
  - logi weryfikacji przez `citationVerifier` (fail-open, ale mierzalne)
- SuperAdmin “Core Docs” panel: status indexed/drift + reindex + preview snippets.

### Migracje
- Jeśli dodajesz/zmieniasz DB: użyj `20260224_*`.

### Pliki startowe (grounded w repo)
- `server/src/services/aiContextBuilder.ts`
- `server/src/services/ai/citationVerifier.ts`
- `server/src/services/ai/knowledgeIndexer.ts`, `server/src/services/ragService.ts`
- `docs/product/DOCUMENTATION_REGISTRY.md`
- UI: `src/views/superadmin/*` (AI/System tabs)

## Zasady (MUST)
- Kanoniczny schema RAG: 266 (`knowledge_documents`), legacy tylko jako fallback/compat.
- i18n: PL+EN jeśli dodajesz UI.
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick
npm run test:protect (jeśli dotykasz auth/policy/security)

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

---

## PROMPT B — Cursor Agent 2 → Bundle 03B — T014 + T015 + T017 (Survey shell + Public mini-assessment + Sponsor report)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 03B — Survey UX + Public Self-Assessment + Sponsor Report**:
- T014 — Modern Survey Experience (N‑mode first)
- T015 — External AI Self‑Assessment Link (public mini‑assessment)
- T017 — Sponsor‑Level Analysis Report (N‑mode first, PPTX export)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T014", "## T015", "## T017")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-03b-survey-public-report

## Krok 2: Implementacja

### T014 — Kluczowe deliverables (V2)
- Spójny “survey shell” (progress, autosave, resume) zgodny z N‑mode.
- UX gotowy pod public focus flow (single-question/small blocks) i RTL dla `ar`.

### T015 — Kluczowe deliverables (V2)
- Publiczny URL do mini‑assessmentu (6 języków) + wynik AI + CTA.
- Zapis wyniku jako artefakt, widok wewnętrzny w N‑mode.
- Abuse protection: rate limiting (i ewentualnie captcha jeśli jest infrastruktura).
- Uwaga: w repo jest już placeholder route public mini assessment — teraz ma być realny flow.

### T017 — Kluczowe deliverables (V2)
- Sponsor-level report oparty o dane + approved insights z T016:
  - N‑mode report artifact + workflow (review/approve/utilized)
  - Export PPTX (prefer v2 pipeline jeśli istnieje)
  - Evidence/citations do insight sources (wyważenie: assumptions/unknowns/counterpoints)

### Migracje
- Jeśli dodajesz/zmieniasz DB: użyj `20260225_*`.

### Pliki startowe (podpowiedź)
- Public link routes:
  - `server/src/routes/public-mini-assessment.routes.ts`
  - `server/src/routes/index.ts` / gateway mount (jeśli potrzebne)
- Survey UI (jeśli brak — tworzysz minimalnie nowe view):
  - poszukaj istniejących assessment/survey wizardów w `src/components/assessment/*`
- Reports/PPTX:
  - `server/src/services/assessmentDeckService.ts`, `server/src/services/presentationGeneratorService.ts`
  - `server/src/routes/assessment-reports.routes.ts`, `server/src/routes/presentations.routes.ts`

## Zasady (MUST)
- i18n: 6 języków wspierane przez UI; minimum EN+PL dla nowych kluczy.
- NIE rób “gruntownego UI/UX redesignu” poza survey shell — trzymamy scope.
- Jeśli dodasz nowe analytics events → dopisz do `src/services/funnelAnalytics.ts`
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

---

## PROMPT C — Cursor Agent 3 → Bundle 20B — T066 (Skills Gap Analysis)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 20B — Skills Gap Analysis** (T066).

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T066")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-20b-skills-gap

## Krok 2: Implementacja

### T066 — Kluczowe deliverables (V2)
- Gap computation:
  - requirements z T065 vs supply z user competencies (T043/T067) + unknown coverage
  - statusy covered/partial/missing/unknown
- N‑style UX:
  - widoki: by initiative / by competency / by person
  - Callout “unknown coverage” + CTA do uzupełnienia profili
- Actionability:
  - z gap tworzymy task lub initiative “Enablement/Training” (minimal: task + label)
  - heurystyczne rekomendacje: hire/train/outsource/resequence (bez halucynacji)
- Role gating / prywatność kompetencji.

### Migracje
- Jeśli dodajesz snapshoty/historię: użyj `20260226_*`.

### Pliki startowe (podpowiedź)
- Dane: T065 requirements + user competencies:
  - `server/src/services/*capability*`, `server/src/services/*initiative*`
  - członkostwo projektu: `server/src/routes/pmo/project-members.routes.ts` (jeśli potrzebne)
- UI: Portfolio/Execution/Initiatives (gap w kontekście inicjatyw/projektu)

## Zasady (MUST)
- i18n: PL+EN.
- Jeśli dodasz nowe analytics events → dopisz do `src/services/funnelAnalytics.ts`
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

