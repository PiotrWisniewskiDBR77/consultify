# Final Implementation Contract — Program partnerski (Position 29/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: approved(scope) (P29-A canon frozen; docs-only)
Last updated: 2026-03-30 (P29-A scope closure)

## 1. Executive summary
- **Intent**: Portal+LP; darmowe konto partnera z limitami; AI‑driven narzędzia; rozliczanie i zachęcanie do partnerstwa.
- **Primary users**: partnerzy + operatorzy programu (platform/tenant ops zależnie od modelu).
- **Success metric**: jawny lifecycle partnera (**onboard→activate→earn→payout**) + spójność partner-facing vs operator truth (opcjonalne sub‑fazy: apply/enable/grow jako copy/UX, ale nie osobne “źródła prawdy”).

## 2. Scope
### 2.1 In-scope
- Partner portal + lifecycle + earnings/enablement w zakresie planu.
- Operator control tower zgodny z planem.

### 2.2 Out-of-scope / non-goals
- Pełny marketplace/app-store parity.

### 2.3 P29-A canon (partner lifecycle + ledger boundaries)

Poniższy kanon jest **zamrożonym kontraktem** dla Partner Program jako produktu runtime (portal partnera + operator truth) i jest podstawą dla P29-B/P29-C. Celem jest jedna prawda o: lifecycle, earnings, payout i wyjątkach — bez równoległych “org/admin/settings” prawd.

#### 2.3.1 Partner lifecycle (onboard → activate → earn → payout) — one state machine

**Lifecycle jest jawny, trwały i współdzielony** między portalem partnera i operatorem (brak sprzecznych statusów).

Minimalne stany (kanoniczne nazwy; UI może użyć copy-friendly etykiet, ale mapowanie jest stałe):

- **onboard**: partner uzupełnia profil programu i wymagane dane (np. public listing, payout settings, wymagania formalne).
- **activate**: partner jest aktywowany do programu (ma dostęp do narzędzi referral + może zacząć “earn”).
- **earn**: partner ma włączone naliczanie i widzi ledger earnings + dostępność do payout (z wyjątkami: hold/review).
- **payout**: partner składa request payout; operator wykonuje approval + wypłatę; partner widzi payout history i outcome.

**Optional sub‑phases (non-canonical):**

- UI/plan może używać etapów typu **apply / enable / grow** jako **sub‑fazy** w ramach `onboard` i/lub `earn` (np. “apply” jako część onboard checklist; “enable/grow” jako część earn/enablement).
- Te sub‑fazy **nie są** równoległą maszyną stanów ani drugim źródłem prawdy: nie mogą powodować sprzecznych statusów partner vs operator i muszą mapować się 1:1 do kanonicznego stanu lifecycle.

**Invariants (must hold):**

- **One truth**: dokładnie jeden status lifecycle dla `partner_org_id`, widoczny w obu powierzchniach (partner + operator).
- **No silent transitions**: każdy transition ma jawnego aktora (partner action / operator action / system) i jest auditowany.
- **Onboard completeness gate**: `activate` jest możliwe wyłącznie po spełnieniu minimalnych wymagań onboard (wymienione w checklist w 2.3.7).

#### 2.3.2 Ledger semantics (earnings + payouts) — auditable by design

**Earnings ledger to księga zdarzeń, nie “magiczne saldo”.** Ledger jest podstawą wszelkich widoków: earnings summary, available-to-payout, payout history, operator reconciliation.

Minimalny model semantyczny (pojęcia, nie implementacja):

- **Ledger entry** jest **append-only** (nie edytujemy historycznych rekordów; korekty są nowymi wpisami).
- Każdy wpis ma:
  - `partner_org_id` (kanoniczna tożsamość partnera; pochodzi z Organization SSOT P30),
  - `type` (enum; patrz niżej),
  - `amount` + `currency`,
  - `occurred_at` (czas zdarzenia biznesowego) + `recorded_at` (czas zapisu),
  - `source_ref` (referencja źródła naliczenia: np. `referred_org_id`, faktura/subscription id, campaign link id),
  - `actor` (partner/operator/system) + `actor_id` (jeśli dotyczy),
  - `correlation_id` / `idempotency_key` (zapobieganie duplikatom),
  - `reason_code` + `note` (dla korekt/hold/wyjątków).

**Ledger entry types (bounded enum):**

- `accrual.posted` — naliczenie zarobku.
- `accrual.adjustment` — korekta (dodatnia/ujemna) z powodem.
- `accrual.reversal` — odwrócenie naliczenia (np. chargeback / fraud / anulowanie).
- `hold.placed` — blokada środków (częściowa lub całościowa) z powodem i właścicielem decyzji.
- `hold.released` — zdjęcie blokady.
- `payout.requested` — partner zgłasza payout request (z podsumowaniem).
- `payout.approved` — operator zatwierdza payout (approval gate).
- `payout.executed` — payout wysłany do providera (z `provider_tx_id`).
- `payout.failed` — payout failed (z error taxonomy) + automatyczny hold (domyślnie).
- `payout.reconciled` — operator reconcile: potwierdzona finalność (jeśli provider rozlicza async).

**Balance semantics (derived, never stored as “truth”):**

- `gross_earned` = suma `accrual.posted` + `accrual.adjustment` − `accrual.reversal`
- `paid_out` = suma payoutów zakończonych sukcesem (`payout.executed` potwierdzone `payout.reconciled`, lub równoważna finalność)
- `available_to_payout` = `gross_earned` − `paid_out` − `held_amount`
- `held_amount` jest wynikiem aktywnych holdów i ich zakresu.

#### 2.3.3 Roles & permissions (partner vs operator) — explicit and non-overlapping

Partner Program definiuje role modułowe; nie redefiniuje ról tenantowych z Admin/Settings.

| Role | Surface | Can do | Must not |
| --- | --- | --- | --- |
| **Partner member** | Partner portal | read status, read earnings summary, read payout history, manage own profile fields as allowed | request payout, change public listing visibility beyond allowed policy, see other partners |
| **Partner admin** | Partner portal | all Partner member + create campaign links, request payout, edit public listing/company info within policy | approve/execute payouts, edit org identity keys owned by P30 |
| **Partner ops (tenant)** | Admin (P32) | no default scope (tenant Admin is not operator of the partner program) | approve payouts, edit cross-tenant partner ledger |
| **Partner ops (platform)** | Superadmin (P33) / operator tower | place/release hold, approve payouts, execute payouts, reconcile, create adjustments with reason | impersonate partner to do hidden edits; bypass audit; rewrite ledger history |

**Permission invariant:** payout-related actions (`hold.*`, `payout.*`, `accrual.adjustment`, `accrual.reversal`) are operator-only and must be gated and audited.

#### 2.3.4 Boundaries vs Organization / Settings / Admin / Superadmin (no parallel org truth)

Partner Program **consumes** the foundations and must not fork their truths.

| Concern | Owner (contract) | Partner Program (29) | Rule |
| --- | --- | --- | --- |
| **Org identity** (name, industry, branding, resolved context) | Organization (P30) | read-only; may show in partner portal | No duplicate org profile store; use P30 reuse fields / org context |
| **Tenant/user preferences taxonomy** | Settings (P31) | may have module settings (Partner Program) but must not become a second settings root | No parallel “Settings for partner” outside P31 taxonomy; partner module settings are module-scoped |
| **Tenant membership & roles** | Admin (P32) | partner program does not manage tenant members | No parallel membership tables; partner portal manages only partner-program module roles within partner org |
| **Cross-tenant operator actions** (payout approvals, fraud holds) | Superadmin (P33) | operator truth lives in platform control plane | P29 operator actions must follow P33 guardrails model (approval + confirmation + immutable audit) |

**No parallel org truth rule (hard):** partner onboarding collects **program-specific** data only (e.g. payout method token, listing preferences, specialization tags). Anything that is org identity (companyName/branding) is edited in P30 and only surfaced here.

#### 2.3.5 Audit / provenance expectations for payouts

Payouts are money-moving actions and must satisfy **auditability by design**:

- **Append-only ledger**: payout lifecycle is represented by ledger events; history is immutable.
- **Approval gate**: `payout.approved` requires platform operator role (P33) and must capture:
  - approver identity,
  - approval timestamp,
  - snapshot of payout request inputs (amount/currency, destination tokenized method, partner status),
  - reason / policy reference if manual override occurred.
- **Provider provenance**: `payout.executed` stores `provider_tx_id` and provider outcome fields (masked where sensitive).
- **Reconciliation**: async providers require a reconciliation event; payout is not “final” until reconciled.
- **Dual-control expectation (bounded)**: for high-value payouts or first payout, require a second approval or explicit “elevated risk” confirmation (P33 guardrails-style) — implementation in P29-B.
- **Audit event stream**: every operator write emits an audit event (actor, action, before/after summary, correlation_id); audit log is immutable per P33.

#### 2.3.6 Degraded / error posture (partner-safe + operator-safe)

Degraded behavior is part of the contract (no “silent fail”):

- **Missing payout settings**: partner sees explicit CTA “Complete payout settings to request payout”; request action is disabled; API returns stable error code.
- **Hold/review**: partner sees status “On hold” with non-sensitive reason category + remediation step; operator sees full reason + policy trace.
- **Provider failure**: partner sees payout attempt outcome + next step; operator sees provider error class + retry/reconcile options; default policy places a hold after repeated failures.
- **Duplicate request / idempotency**: repeated submit returns the existing `payout.requested` reference (no double booking).
- **Ledger unavailable**: reads may show last known snapshot with `degraded: true` and timestamp; writes fail closed (no payout action without ledger/audit availability).
- **Permissions**: 403 with guidance (“Payout approvals are managed by platform operators”) and no partial UI success state.

#### 2.3.7 Acceptance checklist (P29-A scope approval)

- Lifecycle states are explicit and mapped: **onboard → activate → earn → payout**.
- Partner portal and operator tower share **one** lifecycle status truth (no contradictions).
- Ledger semantics are defined: append-only entries, bounded enums, derived balances (no “magic saldo”).
- Roles/permissions are explicit; payout/hold/adjustment are operator-only and gated.
- Boundaries vs **P30/P31/P32/P33** are explicit; no parallel org truth or parallel settings/admin trees.
- Payout audit/provenance expectations are stated (approval gate + provider tx + reconciliation + immutable audit).
- Degraded/error posture is explicit (missing payout settings, holds, provider failure, idempotency, ledger outage).

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
- **Goal**: lifecycle canon **onboard→activate→earn→payout** z jedną prawdą partner+operator (sub‑fazy apply/enable/grow są dozwolone wyłącznie jako UI/enablement copy mapujące się do kanonu).
- **Inputs required**: status model + earnings ledger schema + holds/exceptions rules.
- **Acceptance**: scope zatwierdzony; non-goals jawne; messaging i remediation posture spisane.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze partner lifecycle state machine (apply→activate→enable→grow→earn).
  - Freeze earnings ledger schema + holds/exceptions + audit requirements.
  - Freeze partner messaging + remediation rules (bounded).
- **DoD**:
  - Approved(scope): partner+operator see one truth; earnings are audytowalne by design.

#### P29-B — Portal + operator tower truth alignment closure
- **Goal**: partner widzi to samo co operator; enablement i earnings są audytowalne.
- **Acceptance**: end-to-end partner działa; exceptional path (hold/review) ma jasne kroki.
- **Evidence**: integracyjne testy + staging demo (happy + exceptional).
- **Tasks**:
  - Implement end-to-end partner journey and ensure portal vs operator tower alignment.
  - Implement exceptional path (hold/review) with clear remediation and audit.
  - Add integration/regression tests and run staging demos (happy + exceptional).
- **Staging proof script (click-by-click)**:
  1. As a partner: apply and submit required info; verify state moves to a clear next step.
  2. As operator: approve/activate; verify partner portal and operator tower show the same status.
  3. Complete one enablement step and confirm “what next” is explicit (bounded).
  4. Accrue/see earnings in partner view and verify operator sees the same ledger entry.
  5. Trigger an exceptional path (hold/review) and verify partner messaging + operator resolution + audit.
- **DoD**:
  - Portal and operator tower never disagree; exceptional paths are recoverable and audytowalne.

#### P29-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P29-A/B/C.
  - Validate rollback: disable accrual/payout; preserve status read-only + audit.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

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
| P29-A | approved(scope) | `6b1fe7dfbe` | n/a (docs-only) | n/a (docs-only) | Canon frozen: lifecycle + ledger semantics + boundaries + audit + degraded + checklist |
| P29-B |  |  |  |  |  |
| P29-C |  |  |  |  |  |

