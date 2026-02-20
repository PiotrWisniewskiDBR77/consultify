# Wave 4 — prompty do odpalenia rownolegle (Cursor x2) + Codex (Bundle 04)

Odpal te 3 prompty jednoczesnie:
- **Prompt A** -> Cursor (Agent mode, Opus) — Initiatives AI (T032-T033)
- **Prompt B** -> Cursor (Agent mode, Opus) — Help plumbing (T071, T073)
- **Prompt C** -> Codex — Tools hub + library (Bundle 04)

Kazdy agent pracuje na SWOIM branchu. Po skonczeniu — raport wg `PROMPT_TEMPLATE_V2.md`.

Uwaga: prompty sa zgodne z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` (PostgreSQL, strict TS, FunnelEventName, i18n rules, nie edytujemy progress.md).

---

## PROMPT A — Cursor Agent 1 -> Bundle 08 (Initiatives AI) — T032-T033

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 08 — Initiatives: AI authoring + gate readiness**:
- **T032 — AI Support for Initiative, Task, and Decision Authoring**
- **T033 — AI Readiness and Stage-Gate Validation for Initiatives**

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T032" i "## T033")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-08-initiatives-ai

## Krok 2: Implementacja (V2 deliverables)

### T032 — AI Authoring
- Field-level AI: Generate, Improve, Shorten, Expand, Formal tone dla pol tekstowych (inicjatywy/taski/decyzje)
- Whole-card draft: szkielet karty initiative/task/decision w standardzie Consultify
- Preview → apply, undo, audit trail
- Bez markdown w output, wynik gotowy do wklejenia

### T033 — Stage-Gate Readiness
- Readiness model: kanoniczna lista wymagan per status/gate (DRAFT, PENDING_REVIEW, REVIEW, PLANNING, APPROVED, SCHEDULED)
- Kazdy requirement: blocking vs warning, rekomendowane akcje, kto powinien zrobic
- UI: checklista gotowosci przed gate, widoczne braki
- Mapowanie do istniejacych statusow/gate'ow inicjatywy

## Pliki startowe (podpowiedz)
- src/components/Initiatives/* (InitiativeDetailModal, initiative cards)
- server/src/services/ai/* (orchestrator, prompts)
- src/store/* (initiative state)

## Zasady (MUST)
- DB = PostgreSQL. Migracje w server/migrations/*.sql — natywny PostgreSQL. Ostatni numer: 557.
- i18n: EN+PL minimum. Klucze na koncu translation.json, prefix initiatives.* lub aiAuthoring.*
- Jesli dodajesz analytics events -> rozszerz FunnelEventName w src/services/funnelAnalytics.ts
- NIE edytuj docs/plans/v2-delivery/progress.md
- UI: docs/ui-standards/README.md, N-mode, lucide-react

## Testy
npm run verify:quick

## Raport koncowy
Wypelnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## PROMPT B — Cursor Agent 2 -> Bundle 22 (Help) — SLICE T071 + T073

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 22 — Help plumbing — SLICE** (T071 + T073).
Uwaga: T072 (Context-Sensitive Help Navigation) jest juz zrobione w pilocie.

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-22-help-t071-t073

## Krok 2: Implementacja (V2 deliverables)

### T071 — Connect Help Docs to AI Context Engine
- Retrieval -> AI context injection: dla pytan "product/how-to" AI pobiera kontekst z KB i dolacza do promptu
- Wykorzystaj istniejace buildHelpDocsContext (server/src/services/ai/helpDocsContext.ts)
- Kontekst: snippets/excerpts (limitowane znakami), lista citations (KB1/KB2/KB3)
- Citation policy: jesli AI odpowiada o workflow/UI -> cytuje KB; jesli brak dopasowania -> "docs do not cover this yet"
- Guardrails przeciw halucynacjom, token control, caching (krotki TTL)

### T073 — Contextual Micro-Video Help System
- Trigger: "first time in module" (per user)
- Playback UX: modal/popover, autoplay OFF, CTA: Watch / Skip / Don't show again
- Video registry: moduleId -> video URL + title + duration
- Tracking: view started/completed/skipped, stan per user (help events lub user prefs)

## Pliki startowe (podpowiedz)
- server/src/services/ai/helpDocsContext.ts
- server/src/services/ai/aiOrchestrator.ts (lub podobny)
- src/components/HelpSidePanel*, src/config/moduleHelpContent.ts
- src/config/videoTutorialsContent.ts (jesli istnieje)

## Zasady (MUST)
- DB = PostgreSQL. Migracje jesli potrzebne — ostatni numer 557.
- i18n: EN+PL, klucze na koncu, prefix help.*
- Jesli dodajesz analytics -> FunnelEventName
- NIE edytuj progress.md

## Testy
npm run verify:quick

## Raport koncowy
Wypelnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## PROMPT C — Codex -> Bundle 04 (Tools hub + library) — T018-T021

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 04 — Tools: hub + library UI + knowledge linking**:
- **T018 — Known Tools Module (library + education, N-mode)**
- **T019 — Development of First 10 Consulting Tools**
- **T020 — Tool-Linked Knowledge Base**
- **T021 — Visual Tool Library Interface**

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T018" ... "## T021")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-04-tools-hub

## Wazne deliverables (minimum V2)
- T018: Katalog narzedzi (lista + detail), nazwa/opis/kiedy uzywac/wejscia-wyjscia/kroki, tagi/kategorie
- T019: 10 pierwszych narzedzi jako tool_sessions, draft initiatives przez Tools -> Initiatives, spójny UX N-mode
- T020: KB per tool — artykul "How to use" per narzedzie (top 10), struktura: Purpose/when to use, kroki, przyklady, FAQ
- T021: Modul hub Tools w menu, wizualna biblioteka (tabela), filtrowanie po kategorii, 1 klik do tool session

## Pliki startowe (podpowiedz)
- src/components/Discovery/* (DiscoveryToolsHub, tool views)
- src/routes/AppRoutes.tsx, routeConfig.ts
- server/src/routes/*, server/src/services/*
- docs/ui-standards/03-modules/module-hub-standard.md

## Zasady (MUST)
- DB = PostgreSQL. Migracje natywny PostgreSQL. Ostatni numer: 557.
- i18n: EN+PL, klucze na koncu, prefix tools.*
- Jesli analytics -> FunnelEventName
- NIE edytuj progress.md
- UI: docs/ui-standards/README.md, N-mode

## Testy
npm run verify:quick

## Raport koncowy
Wypelnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## Po zakonczeniu pracy agentow

Gdy agent zglosi gotowosc ("in_review"):

1. Sprawdz branch: git switch bundle-XX-nazwa
2. Uruchom testy: npm run verify:quick (i test:protect jesli dotyczy)
3. Manual QA z checklisty
4. Merge: git switch main && git pull && git merge bundle-XX-nazwa --no-edit
5. Jesli konflikty w translation.json — rozwiaz recznie (klucze na koncu)
6. Push: git push origin main
7. Zaktualizuj progress.md centralnie: Status -> merged
