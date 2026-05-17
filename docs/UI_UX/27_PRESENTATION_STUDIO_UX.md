---
uiux_doc_id: UIUX_PRESENTATION_STUDIO
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Presentation Studio — UX contract (Gamma-class Presentation Artifact Engine)

## Purpose

Zdefiniować docelowy UX dla `Consultify Presentation Studio`: tworzenie profesjonalnych prezentacji enterprise jako **żywych artifactów konsultingowych** (źródła, wersje, diff, approval, governance, eksport), z jakością UX/visual benchmarkowaną do Gamma.

## Applies To

- Moduł `Prezentacje` / `Presentation Studio`
- Presentation template registry (template’y decków)
- Deck builder/editor + AI edit loop
- Export: PPTX/PDF/web share
- Powiązania z Documents/Tables/Tasks/CRM/Research/Interview/KPI/Risk/Decisions

## Must

- **MUST**: Prezentacja jest **artifactem**, nie “zestawem slajdów”:
  - ma `PresentationArtifact` (metadata, sekcje, slajdy, design system, status, confidentiality),
  - ma wersje, diff i audit trail,
  - ma ownership, permissions i approval workflow.
- **MUST**: AI to nie tylko generator — AI jest operatorem decku:
  - planuje narrację i strukturę,
  - generuje slajdy i layouty w kontrolowanej taksonomii,
  - wykonuje QA (narracja/dane/źródła/visual),
  - proponuje edycje jako `proposal → diff → approve/reject → version`.
- **MUST**: Deck jest powiązany z danymi i procesem Consultify:
  - source pack z Research/Interview/Docs/Tables/Tasks/CRM/KPI/Risk/Decision log,
  - każdy ważny claim/liczba ma `SourceReference`,
  - braki danych i claimy bez źródeł są jawnie oznaczone.
- **MUST**: System rozróżnia deck:
  - **do prezentowania** (speaking deck),
  - **do czytania** (reading deck),
  i zachowuje to jako intencję artifactu.
- **MUST**: Template registry:
  - statusy (draft/approved/deprecated), wersje, owner,
  - obejmuje: strukturę, layout rules, design system, source rules, approval/export rules.
- **MUST**: Brand & design system jest egzekwowany (nie “ładne przypadkowo”):
  - spójne fonty/kolory/logo/spacing,
  - confidentiality labels/watermark zgodnie z polityką.
- **MUST**: Layout Generation Engine używa **kontrolowanej** listy layoutów (taxonomia) i waliduje czytelność:
  - nie generuje losowych układów,
  - unika przeładowania i niespójnych marginów.
- **MUST**: Diff/approval obejmuje co najmniej:
  - treść (text),
  - dane/wykresy,
  - layout,
  - źródła,
  - kolejność slajdów/sekcji,
  - ton/audience.
- **MUST**: Eksport:
  - **PPTX jest krytyczny** (enterprise standard) i musi być edytowalny,
  - PDF jest gotowy do wysyłki,
  - web/share link jest kontrolowany uprawnieniami i poufnością.
- **MUST NOT**: “Kopia Gamma 1:1”. Gamma jest benchmarkiem jakości i płynności, ale Consultify wygrywa przez governance + consulting execution + integracje.

## Should

- **SHOULD**: Siedem trybów pracy (docelowo):
  1) generate without template,
  2) plan template,
  3) generate from approved template,
  4) AI edit existing presentation,
  5) convert artifacts → presentation,
  6) convert presentation → other artifacts (doc/table/tasks/roadmap),
  7) presentation as live project artifact (aktualizacje z danych).
- **SHOULD**: Gamma-class quality gate jako checklist QA: szybkość pierwszego draftu, key message per slide, czytelność, źródła, brak pustych slajdów, export quality.

## Acceptance Criteria

- [ ] Prompt → outline/plan (widoczny przed generacją) → source pack → deck draft → QA → AI edits (proposal/diff/approve) → versioned artifact.
- [ ] Co najmniej: source per slide + oznaczenia claimów bez źródeł.
- [ ] PPTX export: otwieralny i edytowalny w PowerPoint; PDF gotowy do wysyłki.
- [ ] Deck ma `reading vs speaking` intent i nie miesza tych trybów bez jawnej decyzji.
- [ ] Diff pokazuje zmiany w: treści, układzie i źródłach.

## Related Sources

- `DRD/consultify/docs/UI_UX/44_AI_OUTPUT_TRUST.md`
- `DRD/consultify/docs/UI_UX/53_TRACEABILITY_AND_SOURCE_UI.md`
- `DRD/consultify/docs/UI_UX/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`
- `DRD/consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md`
- `DRD/consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_SPRINT_PLAN_2026-05-08.md`

