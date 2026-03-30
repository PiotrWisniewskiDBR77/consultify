# Final Implementation Contract — Program partnerski (Position 29/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Portal+LP; darmowe konto partnera z limitami; AI‑driven narzędzia; rozliczanie i zachęcanie do partnerstwa.
- **Primary users**: partnerzy + operatorzy programu (platform/tenant ops zależnie od modelu).
- **Success metric**: jawny lifecycle partnera (apply→activate→enable→grow→earn) + spójność partner-facing vs operator truth.

## 2. Scope
### 2.1 In-scope
- Partner portal + lifecycle + earnings/enablement w zakresie planu.
- Operator control tower zgodny z planem.

### 2.2 Out-of-scope / non-goals
- Pełny marketplace/app-store parity.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PARTNER_PROGRAM_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PARTNER_PROGRAM_2026-03-29.md`

### 4.2 Local Softs evidence (concrete artifacts)
- **HubSpot (partners/affiliates as a program surface + enablement posture)**:
  - `Softs/0 Program partnerski/Hubspot 1/www.hubspot.com/partners/affiliates.html` (partner/affiliate entry posture).
- **DigitalOcean (affiliate + referral program posture)**:
  - `Softs/0 Program partnerski/Digitalocean/www.digitalocean.com/affiliates.html` (affiliate program entry).
  - `Softs/0 Program partnerski/Digitalocean/www.digitalocean.com/referral-program.html` (referral program posture).
  - `Softs/0 Program partnerski/Digitalocean/www.digitalocean.com/partners.html` (broader partners posture).
- **Dropbox (referrals + account/billing/admin posture adjacency)**:
  - `Softs/0 Program partnerski/Dropbox 1/www.dropbox.com/business/partners.html` (partners entry posture).
  - `Softs/0 Program partnerski/Dropbox 1/www.dropbox.com/referrals.html` (referrals program entry surface).
  - `Softs/0 Program partnerski/Dropbox 2/help.dropbox.com/billing/dropbox-docsend-referral-program.html` (referral program policy posture).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “real partner lifecycle + earnings + operator truth”, nie “LP + formularz zgłoszenia”.**

- **Lifecycle is explicit and durable (plan + partner programs)**:
  - Apply → activate → enable → progress/tier → earn ma jawne stany i wymagania (bez “tajnej logiki”).
- **Partner-facing ongoing state (HubSpot/DigitalOcean posture)**:
  - Partner widzi swój status, zasady, i co robić dalej (enablement, materiały, tasklist).
- **Earnings/credits posture (referral programs)**:
  - Rozliczenia/credits/commission są policzalne i audytowalne; brak “magicznego salda”.
- **Operator control tower alignment (Wave2)**:
  - Operator widzi tę samą prawdę: wyjątki, blokady, payout holds, policy cues.
- **Bounded marketplace claim (non-goal)**:
  - Program nie udaje app store; komunikaty i UX są zgodne z deklarowanymi limitami.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_PARTNER_PROGRAM_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Partner lifecycle closure | staged journey | “beyond bounded portal lane” | Dopiąć apply→activate→enable→grow→earn jako jeden model stanu | P0 |
| Earnings + operational truth | auditable payouts | “needs broader closure” | Zdefiniować earnings ledger + holds/exceptions + audit | P0 |
| Partner vs operator alignment | one truth | “needs stronger system model” | Ujednolicić partner portal i operator tower (brak sprzecznych statusów) | P0 |
| Enablement packaging | materials + next steps | “portal depth gap” | Zbudować enablement/tasklist jako produkt (bounded) | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Partner przechodzi onboarding i ma widoczny ongoing state; operator widzi to samo; brak sprzecznych prawd.
- Earnings/credits mają jawne reguły, ledger, i stany exceptional (hold, review, payout).
- Enablement ma “co dalej” w portalu (tasklist / materials / CTA) i jest spójne z Help/KB.

### 5.2 Tests
- Integracyjne: apply → approve/activate → partner portal shows status → enablement steps → earnings accrue → operator tower verifies same ledger.
- Regression: policy violation / missing payout info → hold state + clear remediation steps.
- Contract tests: partner status model + earnings ledger schema stabilne; audit trail obecny.

### 5.3 Staging proof checklist
- Demo: 1 partner end-to-end (apply→activate→enable→earn) + operator view.
- Demo: exceptional path (hold/review) + partner messaging + operator resolution.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Partner Program SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P29-A — Partner lifecycle canon + earnings ledger (scope approval)
- **Goal**: staged lifecycle apply→activate→enable→grow→earn z jedną prawdą partner+operator.
- **Inputs required**: status model + earnings ledger schema + holds/exceptions rules.
- **Acceptance**: scope zatwierdzony; non-goals jawne; messaging i remediation posture spisane.
- **Evidence**: scope approval + linkowane SSOT.

#### P29-B — Portal + operator tower truth alignment closure
- **Goal**: partner widzi to samo co operator; enablement i earnings są audytowalne.
- **Acceptance**: end-to-end partner działa; exceptional path (hold/review) ma jasne kroki.
- **Evidence**: integracyjne testy + staging demo (happy + exceptional).

#### P29-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).

### 8.2 Rollout strategy
- Najpierw lifecycle+ledger (P0), potem enablement packaging (P1) i rozbudowa.

### 8.3 Rollback plan
- Wyłącz accrual/payout; zachowaj status read-only + audit; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: sprzeczne statusy partner vs operator (utrata zaufania).
- Ryzyko: earnings bez audytu (compliance).
- Decyzje: minimalny model earnings (credits vs payouts) i jego stany.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P29-A |  |  |  |  |  |
| P29-B |  |  |  |  |  |
| P29-C |  |  |  |  |  |

