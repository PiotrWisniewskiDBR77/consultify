# N3 — plan-version status labels: canon repair (2026-08-12)

Packet N3, repair worker acting on a same-day audit's findings (`VISUAL_TRIADA_SPEC_A_LEDGER.csv`
rows `CW-03-009-M4` and `CW-RT-031-M4b`). Scope: `src/utils/enumLabels.ts` only.

## Finding 1 — status labels contradicted the canon (FIXED)

### Canon quote

- `docs/product/case-workspace/03_INTERACTION_RESPONSIVE_ACCESSIBILITY.md:66`:
  > Autosave states are `Zapisywanie`, `Zapisano`, `Błąd zapisu`. Plan lifecycle states are
  > `Szkic`, `Do przeglądu`, `Opublikowany`, `Wycofany`. They are rendered independently.

- `docs/product/case-workspace/04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:228`:
  > UX mapping is `Szkic | Do przeglądu | Opublikowany | Wycofany`. Rejection is a review
  > decision and returns the version to Draft or withdraws it; it is not a competing lifecycle
  > state.

Both docs are the numbered Case Workspace SSOT set (`00_INDEX.md`-style series 00–14) and are
the same two docs the audit itself cited, independently reproduced live. The audit's claim is
verbatim-accurate: it is not a paraphrase or a stretch. Confirmed **before** touching a string.

### Full status set — before / after / provenance

| Status | PL before | PL after | Canon says | Verdict |
|---|---|---|---|---|
| DRAFT | `Szkic` | `Szkic` (unchanged) | `Szkic` | already correct |
| IN_REVIEW | `W recenzji` | **`Do przeglądu`** | `Do przeglądu` | **fixed** (audit's finding) |
| PUBLISHED | `Zatwierdzony` | **`Opublikowany`** | `Opublikowany` | **fixed** (audit's finding) |
| SUPERSEDED | `Zastąpiony` | `Zastąpiony` (unchanged) | not named in the 4-value UX mapping quoted above, but matches `docs/product/case-workspace/prototype-w2-v0/js/labels.js:54` (`plan_status_superseded: "Zastąpiony"`) | already correct |
| WITHDRAWN | `Wycofany` | `Wycofany` (unchanged) | `Wycofany` | already correct |

Only the two statuses the audit named were actually wrong. DRAFT/SUPERSEDED/WITHDRAWN already
matched canon, so the object is now internally coherent with no further drift — checked all
five, not just the two flagged.

**Also changed, not requested by the audit:** `PUBLISHED`'s **English** value, `en: 'Approved'`
→ `en: 'Published'`. Reasoning: with the PL side now saying "Opublikowany" (= "Published"),
leaving the EN side as "Approved" would embed a semantic contradiction (approval vs. publication
are different concepts in this domain — see `PROPOSAL_STATUS_LABELS.APPROVED` elsewhere in the
same file) into the very object being repaired. This is safe to change with zero rendering
risk: grep confirms all three call sites of `planVersionStatusLabel(...)` in the whole repo pass
`isPolish=true` literally, so the `en` branch is currently unreachable dead code with no visual
impact today.

### One tension worth flagging, not acted on

`docs/product/case-workspace/prototype-w2-v0/js/labels.js:55` (an HTML/JS mockup, not one of the
numbered canon docs) has `plan_status_in_review: { pl: "W przeglądzie" }` — a *third* variant,
neither the old `"W recenzji"` nor the canon's `"Do przeglądu"`. Per `CLAUDE.md`'s own rule
("Sam napis FINAL/MASTER/KANON… nie daje mu pierwszeństwa"), a prototype file's incidental label
does not outrank the two numbered SSOT docs that state the mapping explicitly and are cited
directly by the acceptance ledgers as the requirement source. Went with the numbered docs;
flagging the prototype's third variant so a future doc-hygiene pass can reconcile or archive it.

### Consumers of the changed labels — full sweep

```
grep -rln "planVersionStatusLabel\|PLAN_VERSION_STATUS_LABELS" --include="*.ts" --include="*.tsx" src server
```
returns exactly three files:
- `src/utils/enumLabels.ts` (the definition, edited)
- `src/components/CaseWorkspace/CaseDetailScreen.tsx` — three call sites, all `isPolish=true`:
  - line 946: transient toast, `` `Plan nr ${n} ma teraz status: ${label}.` `` → now reads
    "Plan nr 1 ma teraz status: Do przeglądu." / "...: Opublikowany."
  - line 980: replan-draft confirmation, `` `...treść wersji nr ${n} (${label.toLowerCase()})` ``
    → "(do przeglądu)" / "(opublikowany)". Note: this parenthetical already had a pre-existing
    grammatical-gender mismatch with "wersji" (feminine) before this change (e.g. old
    "zatwierdzony" was also masculine) — not introduced by this fix, not touched, out of scope.
  - line 1401: right-panel pill, `` `nr ${n} · ${label}` `` → "nr 1 · Opublikowany"
- `src/components/CaseWorkspace/PlanView.tsx` — one call site, line 422, `isPolish=true`:
  main plan-header pill, `` `Plan: ${label} (wersja ${v})` `` → "Plan: Opublikowany (wersja 1)"

**No other module in the repo renders `planVersionStatusLabel`/`PLAN_VERSION_STATUS_LABELS`.**
`enumLabels.ts` is shared far more broadly (`CasesListScreen.tsx`, `PlanGraphCanvas.tsx`,
`RealizacjaView.tsx`, `RezultatyView.tsx`, `DiscoveryTools/KnownToolDetailView.tsx`,
`MyWork/NotificationDetailView.tsx`, `MyWork/shared/RelatedItemsList.tsx` all import from it),
but every one of those imports a *different* export (`planNodeTypeLabel`, `planEdgeTypeLabel`,
`humanizeEnum`, `linkedTypeLabel`, etc.) — none of them touch `PLAN_VERSION_STATUS_LABELS` or
call `planVersionStatusLabel`. This edit has zero impact outside the two Case Workspace files
named above.

Both `CaseDetailScreen.tsx` and `PlanView.tsx` are outside this packet's allowlist (owned by
sibling packets) and were **not edited** — only read, to trace the call sites and confirm the
sentence-level rendering reads naturally.

### Live evidence (real UI, real backend, real Postgres — no mocks)

Backend: `127.0.0.1:3001` (PID 11390, coordinator-owned, health-checked `HTTP 200` before use,
never restarted). Frontend: Vite already running at `127.0.0.1:4501` (coordinator-owned, reused
as-is). Isolated Chrome MCP tab (own tab id, closed at the end), `location`/tab URL re-verified
via the tab-context return value immediately before every capture — no cross-case jump observed
despite the browser-hazard warning.

Two real cases in the local Postgres (`case_workspace_test`, DB `127.0.0.1:55432`), found via a
read-only query scoped to the logged-in user's own org (`cw-local-org`) so the UI's org-access
check would actually resolve them:

```sql
SELECT pv.case_id, pv.case_plan_version_id, pv.plan_number, pv.version, pv.status
FROM case_plan_versions pv JOIN case_core cc ON cc.case_id = pv.case_id
WHERE pv.status IN ('IN_REVIEW','PUBLISHED') AND cc.organization_id = 'cw-local-org';
```

1. **PUBLISHED**, case `case-eaccd54e-f4e2-4812-8df9-c597d9f93997` (the exact case the audit
   itself used — `Zlecenie B 06b70681`), plan #1 v1.
   URL: `http://127.0.0.1:4501/zlecenia/case-eaccd54e-f4e2-4812-8df9-c597d9f93997?zakladka=plan&widok-planu=prosty`
   DOM read (`document.body.innerText` filtered to the line starting `Plan:`):
   ```
   "Plan: Opublikowany (wersja 1)"
   ```
   Screenshot confirms the pill visually, crimson-free, standard pill styling.

2. **IN_REVIEW**, case `case-d01d9771-4acf-4249-9458-1b77eb24c2b0` (`Transformacja d9966768`),
   plan #1 v2 — its only/current plan, so no version-selector workaround was needed (the sibling
   case `case-eaccd54e-...` also has an IN_REVIEW plan #2, but that case's Plan tab has no
   reachable UI control to switch off its client-pinned plan #1, a pre-existing, separately
   tracked gap — CUSTOMER_JOURNEY_LEDGER.csv `CW-JRN-03` — not something this packet needed to
   fix or route around by mutating data).
   URL: `http://127.0.0.1:4501/zlecenia/case-d01d9771-4acf-4249-9458-1b77eb24c2b0?zakladka=plan&widok-planu=prosty`
   DOM read:
   ```
   "Plan: Do przeglądu (wersja 1)"
   ```
   Screenshot confirms the pill visually.

Both reads are **read-only against existing fixture data** — no case, plan, or proposal was
created, mutated, published, or withdrawn to produce this evidence, in keeping with the "zero
test records" hygiene rule.

The CaseDetailScreen toast (`Plan nr X ma teraz status: ...`) and the replan-confirmation string
were traced by reading the source (see consumer list above) but **not independently
screenshotted** — reproducing them live would require triggering a real propose/publish/replan
action against the shared coordinator-owned backend, which risks mutating fixture state relied on
by sibling packets and by the ledgers' own cited evidence runs. The two right-panel/header pill
renders above are the same user-visible surface class the audit's own FAIL rows
(`CW-03-009-M4`, `CW-RT-031-M4b`) captured, so this is considered sufficient proof of the fix
without that added risk. Flagged under "could not verify" in the final report.

## Finding 2 — right-panel "Comments" section: adjudication (NOT fixed, per instructions)

**Correction note:** an earlier draft of this section reasoned abstractly, before actually
reading §10.2/§11.2/§18.1 in full, and concluded (wrongly) that §13's per-archetype table
overrides the shell default and that Case Workspace was compliant. Having now read every cited
section verbatim, that draft was wrong and is replaced below with the verified reading. Flagging
the correction rather than silently fixing it, per the project's own "verify the real thing, not
your assumption" rule.

### What the shell canon actually says (verbatim, three independent citations)

`Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`:

- **§10.2** (`SPEC-A — ARTEFAKT, wspólne dla A–E`), line 771:
  > **Prawy panel `⑪`:** `㉝`accordion — sekcje w stałej kolejności: **Akcje 2rz.**
  > (`①`eksport▸/udostępnij) · **Właściwości** (...) · **Powiązania** (...) · **Komentarze** ·
  > **Historia/AI** (`sparkles`).

  And immediately below, line 784: **"Reguła: archetyp zmienia TYLKO centrum + Menu 2 + rail.
  Cała reszta powłoki = wspólna."** (rule: an archetype changes ONLY the center + Menu 2 + rail;
  the rest of the shell is shared/common.)

- **§11.2** (`SPEC-A — ARTEFAKT, build-ready`), line 917:
  > **Prawy panel `⑪` — sekcje `㉝`accordion (stała kolejność):**
  > 1. Akcje ... 2. Właściwości ... 3. Powiązania ... **4. Komentarze — wątek (`㊲`avatar + L3 +
  > L5-czas)** ... 5. Historia / AI ...

  And explicitly, line 934: **"Zakaz: archetyp NIE zmienia powłoki (Menu1/panel/kebab/stany
  identyczne). Inicjatywa C-L i arkusz C-S = ta sama powłoka."** (Prohibition: an archetype does
  NOT change the shell — Menu1/panel/kebab/states are identical.)

- **§18.1 DoD Artefaktu**, a red-checklist **MUST** line, line 1527:
  > - [ ] Prawy panel: sekcje w kolejności **Akcje·Właściwości·Powiązania·Komentarze·Historia/AI**

Three independent places in the same document — a narrative description (§10.2), a build-ready
spec with explicit dimensions (§11.2), and an enforceable MUST checklist item (§18.1) — all name
"Komentarze" as the fourth of five fixed-order accordion sections, and two of the three
(§10.2, §11.2) explicitly forbid archetypes from changing the panel at all.

### Cross-check against §13.1 (Archetyp C — REKORD)

§13.1's per-artifact table (Initiative, Task, Decision, KPI, Insight, Idea, RAID, Milestone,
Change Request, Stage Gate, Action Proposal — **"Zlecenie"/Case is not even a row in this
table**) has a column titled **"Prawy panel — sekcje kluczowe"** ("right panel — KEY sections").
None of its 11 rows lists "Komentarze". But **none of them lists "Akcje" either** — and §10.2/
§11.2/§18.1 mandate Akcje as unconditionally as they mandate Komentarze. If §13.1's silence on a
section meant "this archetype doesn't have it," Akcje would be missing from every Archetype-C
artifact too, which nothing else in the document supports and which would itself violate the
explicit "Zakaz" quoted above. The coherent reading: §13.1's "sekcje kluczowe" column lists only
the *differentiating* content per artifact (what varies inside "Właściwości", plus genuinely
extra domain sections like "Podzadania"/"Opcje"/"Formuła"), not a full re-enumeration of the
already-declared-common shell. **This resolves the audit's "possible contradiction" — there
isn't one.** §13.1 not naming Comments doesn't cancel the twice-stated narrative rule plus the
MUST checklist item; it's simply out of that column's scope, exactly as "Akcje" is.

### What Case Workspace's own header claims vs. what it actually does

`CaseDetailScreen.tsx`'s header comment (lines 12–20, read directly) states:

> Co z tego wynika wprost (ARTIFACT_ANATOMY_STANDARD.md §10.2/§11.2): ... prawy panel to accordion
> o stałej kolejności Akcje · Właściwości · Powiązania · **Źródła i założenia** · Historia
> (**Komentarze jawnie pominięte**) ...

This cites §10.2/§11.2 as the *source* of a fixed-order panel with Comments **explicitly
omitted** — but §10.2 and §11.2, read directly, say the opposite: a fixed-order panel with
Komentarze **explicitly included** as section 4, and an explicit prohibition on archetypes
changing the panel at all. The comment's citation does not support its own claim.

### Verdict

**The canon does not contradict itself.** §13.1's silence on Comments for Archetype C is not an
override — it's a table scoped to differentiating content, consistent with its also omitting the
equally-mandatory "Akcje" section from every row. Read together, §10.2 + §11.2 + §18.1 are
unambiguous and mutually reinforcing: **Archetype C, class L (which is what `CaseDetailScreen.tsx`
itself declares itself to be, line 2: "archetyp C 'Rekord', klasa L") is required to carry a
Comments/"Komentarze" section**, as the fourth of five fixed accordion sections, identical to
every other archetype. Case Workspace's substitution of "Źródła i założenia" in that slot is a
real, verifiable gap against §10.2/§11.2's narrative rule and against §18.1's MUST checklist item
— not a legitimate, canon-sanctioned exception. The header comment's own citation is the tell:
it points at the two sections that actually mandate the opposite of what it does.

**Recommendation:** the coordinator should treat this as a genuine, open DoD gap for
`CaseDetailScreen.tsx` (§18.1's MUST line, "Prawy panel: sekcje w kolejności
Akcje·Właściwości·Powiązania·Komentarze·Historia/AI"), not as an already-settled design choice.
Whether the fix is to *add* a genuine Komentarze section alongside the existing "Źródła i
założenia" (most consistent with the canon's fixed five-section order — "Źródła i założenia"
would then need to move or become a sub-section of "Właściwości"/"Powiązania" rather than
occupying Comments' canonical slot) is a product/design call for the coordinator, not something
this packet decided or implemented. **No `CaseDetailScreen.tsx` edit was made** — it is outside
this packet's allowlist and owned by a sibling packet; this section is adjudication only.

## Regression test

**Not added.** The allowlist for this packet is exactly `src/utils/enumLabels.ts` plus this
evidence directory — no test file location is in scope, and `enumLabels.ts` has no existing
co-located test file to extend (the one precedent in the repo, `tests/unit/finance/
valuationEnumLabels.test.ts`, covers a different enum-labels module entirely and lives outside
the allowlist). Adding a new test file under `tests/` would require `git add -f` per the
project's test-file convention and would step outside the allowlist boundary this packet was
given. Flagging for the coordinator: a cheap, natural home would be a new
`tests/unit/caseWorkspace/enumLabels.test.ts` asserting `planVersionStatusLabel('IN_REVIEW', true)
=== 'Do przeglądu'` and `planVersionStatusLabel('PUBLISHED', true) === 'Opublikowany'` against the
five-status set, but creating it was out of this packet's scope.

## Typecheck

```
NODE_OPTIONS="--max-old-space-size=8192" ./node_modules/.bin/tsc --noEmit
EXIT=0
```
No output before the exit marker — clean pass, not an OOM-crash-as-success (per the project's own
known trap, the exit code was captured and checked, not inferred from silence).

## Could not verify

- The two toast/banner strings in `CaseDetailScreen.tsx` (lines 946, 980) were traced by source
  reading and are mechanically certain to use the same corrected `PLAN_VERSION_STATUS_LABELS`
  object (same function, same import), but were not independently screenshotted live — see
  reasoning above (avoiding a mutating action against shared fixture data).
- Whether any other, currently-dormant caller of `planVersionStatusLabel` with `isPolish=false`
  exists in code paths not yet written (e.g. a future i18n toggle) — today's grep is exhaustive
  for the current codebase, but can't attest to future call sites.
