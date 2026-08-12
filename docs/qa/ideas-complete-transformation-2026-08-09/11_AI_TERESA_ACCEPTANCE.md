# E10 — AI and Teresa acceptance

Candidate: HEAD `deb103fcde`, base `origin/demo` @ `9d17cac114`. Canon:
`docs/standards/idea-workspace/09_AI_I_TERESA.md`. DoD: doc 11 §4 E10 ("no silent AI mutation;
visible and actual scope match; unsupported claims marked; every request terminates in
proposal/result/error/cancel; Teresa uses same action ID and confirmation/audit rules").

## 1. Four-state summary

| State | Result |
|---|---|
| Code exists | Yes — 231/231 registry actions carry a `teresa: {}` block (mandatory, R9); AI-scope changes in `UnifiedChatPanel.tsx` + `IdeaAINudgeStrip.tsx` (Wave 5) |
| Mounted in a real consumer | Yes — both files are the live chat panel and nudge strip, not new dead files |
| Executed at runtime | NOT VERIFIED |
| Persisted and read back | N/A for most of this epic (AI proposals are typically ephemeral until explicitly applied); NOT VERIFIED for anything that does persist |

## 2. Evidence from this program's git history and this session's own re-run

- Wave 5 (`111868e07a`) commit body: "E10 ... opened with real audits and targeted fixes across AI
  scope honesty." Files touched, verified by `git show --stat`: `src/components/AIChat/
  UnifiedChatPanel.tsx` (+/-67 lines), `src/components/MyWork/IdeaAINudgeStrip.tsx` (+/-76 lines),
  `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx` (+/-120 lines, test file extended alongside the
  gating logic it exercises).
- This session re-ran that test file directly: **8/11 pass, 3 fail.** The 3 failures are the exact,
  pre-existing, previously-documented class this program's own instructions list by name
  (`dp5HeuristicAiGating` — i18n test-setup gap, `AIActionsPopover` renders raw i18n keys like
  `myWorkMindmap.aiGen.mapSummary` instead of resolved strings under the test's i18n mock).
  `00_PROGRAM_STATUS_AND_VERSION.md`'s E00 section independently root-caused this same failure on
  the pre-forward-port stale branch, confirming it predates this program's AI-scope changes rather
  than being introduced by them. Not fixed by this task (out of scope, explicitly flagged as
  pre-existing by this task's own instructions).
- Registry-level Teresa parity: every one of the 231 actions in `15_ALL_ACTIONS_INVENTORY.csv`
  carries `teresa_callable=yes`, meaning each has a `description` (and, where applicable,
  `parameters`) block feeding `src/actions/teresaActionManifest.ts` (verified present, R9 passing).
  This satisfies the *structural* half of "Teresa uses same action ID" — the manifest is generated
  from the same registry entries the UI calls, not a hand-maintained parallel list — but does not
  prove Teresa has actually invoked any of them at runtime.
- The E02-PILOT-WB-EDGE ledger row (already cited in `06_WHITEBOARD_ACCEPTANCE.md`) is the one
  concrete, dated case in this program's history of a Teresa-parity gap being found (registry
  wired, but Teresa unable to invoke 5 whiteboard-edge actions because no bus receiver existed) and
  then closed in a follow-up commit (`43fb54eb4c`) — cited here as the pattern this epic exists to
  catch, not as proof the pattern is now fully eliminated elsewhere.
- Undo-kind discipline (registry-wide, cross-checked against the DoD's "no silent AI mutation"):
  the 20 actions with `undo.kind: 'proposal'` in `15_ALL_ACTIONS_INVENTORY.csv` are the AI-generation
  actions (map expand, gap analysis, theme-finding, etc.) — their undo mechanism is explicitly a
  review/accept-reject UI (e.g. `AIProposalDiffModal`, `IdeaProposalReview`), not an automatic
  undo stack. This is a structural, registry-enforced proposal-first pattern, consistent with the
  DoD language, verified by reading the `undo.evidence` field directly rather than assumed from the
  `kind` label alone.

## 3. Explicitly NOT VERIFIED

- No runtime session where Teresa (the chat assistant) actually invoked a registered idea action and
  its result was observed end-to-end exists in this program's history.
- "Unsupported claims marked" and "every request terminates in proposal/result/error/cancel" as a
  *behavioral* guarantee (not just a type-level one) has not been exercised against a live model
  call in this program.
- E12's confidentiality gate (which blocks AI prompts for restricted ideas) is mock-tested (6/6
  pass, see `03B_DATA_AND_MIGRATION_REPORT.md`) but not run against Teresa's actual invocation path.

## 4. Verdict

**OPENED, NOT CLOSED** — unchanged from `00_PROGRAM_STATUS_AND_VERSION.md`'s E10 row. Structural
Teresa-parity (one action ID, one manifest, one description block) is enforced registry-wide and
machine-checked (R9); the epic's behavioral DoD (silent-mutation prevention, scope-match, terminal-
state coverage under a real model call) has not been runtime-verified.

---

**Re-verified at `6fec03f7a0` (stream S11-DOCS, 2026-08-12):** one
directly-relevant item landed this wave — RISK-30 gave 6/6 bus-dispatch sites
plus the lane UI-closure branch a truthful `confirmed` acknowledgement instead
of an unconditional `{ok:true}`, closing part of the "silent-mutation
prevention" gap this verdict names. **Residual, stated plainly (not part of
this fix): 58 other UI-closure sites still degrade to `confirmed:false` with
no chat message, and `UnifiedChatPanel.tsx` only posts a correction when
`result.message` is set — so a silent `confirmed:false` still leaves the
model's already-streamed "done" reply unchallenged on screen.** See
`16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-30. **Verdict otherwise unchanged:
OPENED, NOT CLOSED** — no real-model-call runtime verification happened this
wave.
