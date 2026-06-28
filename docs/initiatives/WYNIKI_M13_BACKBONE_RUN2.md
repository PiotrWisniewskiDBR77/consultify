# WYNIKI — Kręgosłup inicjatyw, RUN 2 (R1–R7)

> Raport końcowy przebiegu wykonawczego planu `INITIATIVE_BACKBONE_NEXT_AGENT_PLAN.md`.
> Data: 2026-06-28 · Branch: `feat/deliverables-w1` · Kontekst+historia: `INITIATIVE_BACKBONE_HANDOFF.md`.

## 1. Zakres i wynik
Wykonano **wszystkie 7 zadań planu (R1–R7)**. Kod + testy zielone, server/FE `tsc` czysto,
deploy staging (migracja) + demo zrobione za zgodą Piotra. **PROD/centerbeam nietknięty.**

**Dowód testowy (autorytatywny):** suita kręgosłupa
`tests/{unit/initiative,unit/initiatives,components/Initiatives,integration/initiatives}`
= **708/708 PASS** (85 plików). ≈ +75 testów dodanych w tym przebiegu nad bazą ~600.

## 2. Zadania — co dostarczono

| # | Zadanie | Kluczowe pliki | Commit(y) | Testy |
|---|---|---|---|---|
| **R1** | F3: 6/6 kart rdzenia renderuje się przez `CardBlockRenderer` | `cards/cardSpecBuilders.ts` (+scope/control/kpis); 5 sekcji: TargetState/FinancialImpact/Kpis/Scope/Control | `03fcdce682`, `0587286f32` | +17 |
| **R2** | Generator emituje `CardSpec` + serwerowa bramka `validateCardSpec` (regen-raz, auto-heal D12) | `initiative/cardSpecSchema.ts` (lustro FE), `initiativeGenerationService.generateSectionCardSpec` | `26374aac0d` | +13 |
| **R2-adopcja** | Osiągalny endpoint `POST /initiatives/:id/generate-section-card` | `routes/initiativeGeneratorBrain.routes.ts` | `6bf3f993d5` | +4 |
| **R3** | Teresa → kolumny typowane (non-destrukcyjne, fail-soft) | `initiative/cardColumnHydration.ts`, `ai/tools/generateInitiative.ts` | `4bb017df19` | +12 |
| **R4** | Migracja `audits` na staging + from-audit strict-404 | `migrations/20260627_audits.sql` (zaaplikowana), E2E L3-BB-16, `from-audit-404.test.ts` | `790a7a6bdd` | +3 |
| **R5** | Proaktywny auto-skan kandydatów + realny LLM | `buildCandidateFromArtifactAI`, `cron/InitiativeCandidateScanCron.ts`, Scheduler job36 (flaga OFF) | `e10af1e3c4` | +11 |
| **R6** | propose-cards UI w kreatorze | `Wizard/useProposeCards.ts`, `Wizard/ProposedCardsPanel.tsx`, wpięcie w `InitiativeCharterWizard` | `e9869888ea` | +7 |
| **R7** | Deploy demo + live-verify + ten raport | `deploy-demo.sh`; handoff | deploy | — |

## 3. Deploye (za zgodą Piotra; PROD wykluczony)
- **Staging (trolley):** `20260627_audits.sql` zaaplikowana i zweryfikowana na żywo —
  kolumny `project_id/title/summary/description/created_by` + indeks `idx_audits_org` +
  tabela `audit_findings` obecne. Bezpieczne celowanie:
  `DOTENV_IGNORE_LOCAL=1 ENV_FILE=.env.staging.local` (potwierdzony host=trolley, **nie** centerbeam).
- **Demo:** HEAD `790a7a6bdd` → `origin/demo` (czysty fast-forward) → Railway build **SUCCESS** →
  https://demo.consultify.ai. Live-verify: `GET /api/health` = **200**; route'y R2/R4/R6
  zamontowane (unauth → 401, czyli istnieją i wjechały z deployem).

## 4. DoD — checklista
- [x] 6/6 kart rdzenia z bloków (R1) — Gantt/RAID celowo bespoke (hybryda)
- [x] Generator emituje `CardSpec` z bramką-recenzentem (R2) + osiągalny endpoint
- [x] Karty hydrowane do kolumn typowanych (R3) — non-destrukcyjne, fail-soft
- [x] audyt→inicjatywa strict 404 na realnym schemacie (R4) — staging zmigrowane
- [x] Kandydaci proaktywni (R5) — cron za flagą, realny LLM seam
- [x] propose-cards w UI (R6)
- [x] Deploy demo + live-verify (R7) + raport WYNIKI (ten plik)
- [ ] **Odbiór uwierzytelniony (R7)** = Piotr (agent nie wprowadza hasła)

## 5. Czeka na Piotra (decyzje, nie kod)
1. **R7 odbiór** — wizualne kliknięcie po demo zalogowany jako Piotr.
2. **R3 mapowania** — czy karty→kolumny autorytatywne (problem_statement / scope_in / scope_out /
   kill_criteria / success_criteria / deliverables / business_value / cost_* / expected_roi) są OK.

## 6. Następne pogłębienia (świadomie ODŁOŻONE — wymagają decyzji/są ryzykowne)
- **R6 funkcjonalnie:** wybrane karty propozycji są dziś trzymane w stanie kreatora, ale NIE
  trafiają do payloadu create (brak pola widoczności sekcji na ścieżce create). Domknięcie wymaga
  (a) decyzji produktowej „jak karta ma się zmaterializować" (widoczna sekcja? pre-fill?) i
  (b) zmiany ścieżki backendu create (kontendowany plik). → decyzja Piotra.
- **R2 konsumpcja w FE:** sekcje budują spec lokalnie (R1); mogłyby preferować serwerowy `CardSpec`
  z `generate-section-card` gdy `ok`, z fallbackiem do buildera per-pole. Additive na 6 sekcjach.
- **Brain structured-fill:** `generateFullInitiative` nadal generuje wolny tekst. Wpięcie
  `generateSectionCardSpec` w pełny-fill jest „gwiazdorskim" payoffem, ALE: blokowy `CardSpec`
  (heading/bullet) nie mapuje się 1:1 na pola, których oczekuje hydracja R3 ({symptom}/{inScope}…).
  Potrzeba albo ekstraktora blok→pole (kruchy), albo decyzji, że hydracja R3 czyta blokowy format.
  → wymaga decyzji architektonicznej Piotra; NIE robione autonomicznie (ryzyko danych).

## 7. Konwencje utrzymane
Shared-branch: commit natychmiast po zieleni, `git add -f tests/`, NIGDY `git add -A`. 5/1-agentowe
rundy na rozłącznych plikach (R1/R6), orchestrator integruje+commituje. Deploy staging-first,
celowanie env potwierdzone przed zapisem. Weryfikacja runtime > deklaracja.
