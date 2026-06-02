# Presentations Manual Retest Instructions — 2026-05-06

Status: `READY_FOR_MANUAL`
Owner: CTO / Delivery Owner
Tester role: AI Tester / QA Manual
Scope: Presentations runtime coded yesterday/today (wizard + deck builder + export + AI edits + outputs read-back)

## 1) Source of truth used for this instruction

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/manual_Tests/README_TEST_PROCESS.md`
- `DRD/testy_antygravity/Piotr/05_UI_TOAST_AND_CORNER_NOTIFICATION_PROTOCOL.md`
- `DRD/testy_antygravity/ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md`
- `consultify/docs/testing/PRESENTATION_GENERATOR_MANUAL_TEST_BACKLOG.md`

## 2) Quick automation snapshot before manual

Executed now:

- `npm run smoke:v3:presentations-runtime` -> PASS
- `playwright ... tier0-core-workflows ... --grep "Presentations module renders"` -> PASS

Interpretation:
- Runtime contract checks are green.
- Manual must validate end-user behavior, degraded UX honesty, and read-back persistence.

## 3) Decision vocabulary (mandatory in report)

- Result: `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`
- Severity: `P0`, `P1`, `P2`, `P3`

Use these definitions from source-of-truth:
- `P0`: silent execution, hidden learning, fake success in critical path, crash/hang, tenant leak
- `P1`: broken core flow, missing save/read-back, 500/503 without honest degraded UX, blocked main action

## 4) Evidence protocol (mandatory for each test case)

For every case capture:

1. UI evidence (screen/clip).
2. Toast/banner evidence (especially right-bottom notifications).
3. Network/API evidence (method + URL + status + short payload summary).
4. Console evidence (clean or errors).
5. Refresh resistance (state after hard refresh).

If there is visible error without right-bottom toast: mark explicitly `error bez toastu w PDR`.

## 5) Manual retest cases (execute in order)

## Gate A — Wizard & Generation core

### PRES-A1: Template + sources to generated deck
- Open Presentations wizard.
- Pick `Digital Transformation Read Deck`.
- Select artifacts (Interview/DRD/Initiatives).
- Move across steps and return back.
- Generate deck.
- Hard refresh and reopen deck.

Expected:
- Selection persists.
- No raw internals (`[object Object]`, raw JSON, stack).
- Deck visible after refresh in builder.

Fail conditions:
- Cannot generate/open deck -> `BLOCKED_P1`
- Fake success toast but missing deck/read-back -> `P1`

### PRES-A2: Org template visibility
- Clone system template to org template (if role allows).
- Return to wizard.
- Verify org template marker and generation from org template.

Expected:
- Template appears and is distinguishable.
- No silent fallback to generic template without message.

## Gate B — Governance & AI edits

### PRES-B1: Proposal -> approval -> execution -> audit
- Open generated deck.
- Ask AI Agent to modify one section.
- Confirm proposal/diff appears.
- Reject first proposal, refresh.
- Create second proposal, accept, refresh.

Expected:
- Reject does not change deck.
- Accept changes deck and survives refresh.
- Governance is visible (no silent execution).

Fail conditions:
- AI edit auto-applies without approval -> `P0`
- Approved change lost after refresh -> `P1`

## Gate C — Export & quality

### PRES-C1: Export happy path
- Export PPTX, PDF, PNG.
- Confirm files download and have expected structure.

Expected:
- PPTX/PDF/PNG export works from real deck endpoints.
- PNG comes as zip.
- Toasts are consistent with actual backend result.

### PRES-C2: Blocked export honesty
- Use deck with intentional quality blockers.
- Attempt export.

Expected:
- Honest blocked state (banner/toast + reason).
- No fake downloaded file.

Fail conditions:
- Export says success while failed backend -> `P0/P1`

## Gate D — Outputs and cross-module persistence

### PRES-D1: Outputs library read-back
- After generation/export, open Outputs/registry.
- Locate presentation and open it.
- Hard refresh and open again.

Expected:
- Artifact remains visible and accessible.
- Metadata readable.
- No tenant/ACL leak.

## 6) Final release decision logic for this round

- `PASS`: no P0/P1 and all core gates A/B/C/D pass.
- `PASS_WITH_P2`: no P0/P1, only non-blocking UX debt.
- `BLOCKED_P1`: any core gate blocked or misleading/fake success in core path.
- `INCONCLUSIVE`: cannot conclude due to environment/account instability (must include evidence).

## 7) Copy-ready prompt for tester

Use the prompt below exactly (replace env/account values before sending):

```text
ŚCIEŻKA TESTOWA: A
RUN_ID: PRES-RETEST-2026-05-06-01

Pracujesz jako AI Tester dla Consultify. Wykonaj WYŁĄCZNIE manualny retest modułu Presentations według poniższych zasad.

ŹRÓDŁA PRAWDY (obowiązkowo):
1) DRD/UI_UX_SOURCE_OF_TRUTH.md
2) DRD/manual_Tests/README_TEST_PROCESS.md
3) DRD/testy_antygravity/Piotr/05_UI_TOAST_AND_CORNER_NOTIFICATION_PROTOCOL.md
4) consultify/docs/testing/PRESENTATION_GENERATOR_MANUAL_TEST_BACKLOG.md

ŚRODOWISKO:
- URL: <WSTAW_URL>
- Konto: <WSTAW_LOGIN>
- Hasło: <WSTAW_HASLO>
- Rola: <WSTAW_ROLE>

ZASADY RAPORTOWANIA:
- Używaj tylko: PASS / PASS_WITH_P2 / BLOCKED_P1 / INCONCLUSIVE
- Severity: P0/P1/P2/P3
- Dla każdego przypadku zbierz:
  - UI evidence
  - Toast/banner evidence (szczególnie prawy dolny róg, 5-8s obserwacji po akcji)
  - Network/API evidence (method + URL + status + payload summary)
  - Console evidence
  - Refresh resistance
- Jeśli błąd widoczny bez toasta: wpisz dosłownie „error bez toastu w PDR”.

WYKONAJ SCENARIUSZE:

[PRES-A1] Template + sources -> generated deck
1. Otwórz Presentations wizard.
2. Wybierz „Digital Transformation Read Deck”.
3. Wybierz źródła (Interview/DRD/Initiatives).
4. Przejdź dalej i wróć między krokami.
5. Wygeneruj deck.
6. Zrób hard refresh i otwórz deck ponownie.
Oczekiwane: brak raw internals, trwałość wyboru i deck po refreshu.

[PRES-A2] Org template visibility
1. Jeśli rola pozwala, sklonuj system template do org.
2. Sprawdź widoczność/oznaczenie w wizardze.
3. Wygeneruj deck z org template.
Oczekiwane: brak cichego fallbacku.

[PRES-B1] Governance AI edit
1. Otwórz deck builder.
2. Poproś AI o zmianę sekcji.
3. Odrzuć propozycję, odśwież, sprawdź brak mutacji.
4. Zrób drugą propozycję, zaakceptuj, odśwież, sprawdź trwałość.
Oczekiwane: proposal -> approval -> execution -> audit; brak silent execution.

[PRES-C1] Export happy path
1. Eksportuj PPTX, PDF, PNG.
2. Zweryfikuj pobrane pliki.
Oczekiwane: poprawne formaty, spójne komunikaty sukcesu.

[PRES-C2] Blocked export honesty
1. Wymuś quality blocker (jeśli możliwe).
2. Spróbuj eksportu.
Oczekiwane: uczciwy błąd/blocked, brak fake download.

[PRES-D1] Outputs read-back
1. Wejdź do Outputs/registry.
2. Znajdź wygenerowaną prezentację.
3. Otwórz ją po refreshu.
Oczekiwane: pełna read-back trwałość.

FORMAT ODPOWIEDZI:
1) Executive verdict (PASS/PASS_WITH_P2/BLOCKED_P1/INCONCLUSIVE)
2) Tabela wyników PRES-A1..PRES-D1 (status + severity + 1-linijkowy komentarz)
3) Findings: najpierw P0/P1, potem P2/P3
4) Evidence index (UI/toast/network/console/refresh)
5) Finalna rekomendacja GO / NO-GO / GO_WITH_RISK
```
