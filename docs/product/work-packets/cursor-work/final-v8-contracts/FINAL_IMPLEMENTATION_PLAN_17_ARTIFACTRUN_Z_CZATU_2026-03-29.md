# Final Implementation Contract — ArtifactRun z czatu (Position 17/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Chat/Teresa pracuje z aplikacją (głos+tekst): rozumie ekran, robi pracę w UI i bazach.
- **Primary users**: użytkownicy pracujący w chat; operatorzy governance.
- **Success metric**: jedno jawne ask → plan → approve → materialize → rerun/refresh, z rozdzieleniem approval (run) vs review (artifact).

## 2. Scope
### 2.1 In-scope
- Visible planning przed tworzeniem.
- Governed approval uruchomienia.
- Materializacja w trwały artefakt + traceability + rerun/failure truth.

### 2.2 Out-of-scope / non-goals
- „Wszystkie feature’y chatu”.
- Zastąpienie artifact review (to osobny trust layer).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_CHAT_ARTIFACTRUN_2026-03-29.md`
- Module card: `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_CHAT_ARTIFACTRUN.md`
- Cluster brief: `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: **KIMI-style artifact-native chat behavior** (wprost jako standard w module cardach i rodzinie AI OS).  
  **Missing input**: brak zlinkowanych referencji KIMI opisujących konkretne UX/flow/akcje „100% KIMI” → nie zgadujemy.

## 5. Evidence plan (DoD)
- Acceptance: user widzi plan, approve’uje run, dostaje artefakt z lineage; rerun i failure są widoczne; approval ≠ review.
- Evidence: staging scenariusze (happy + fail + rerun) + testy integracyjne run lifecycle.

