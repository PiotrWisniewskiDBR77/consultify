# Agent 3 Execution Memo

> Date: 2026-03-28
> Owner: Agent 3
> Scope: `Ankiety`, `Wnioski w Interview`
> Constraint: excludes `Teresa`, broad communication, general notes system, `Tools`, `Outputs`

## Scope truth
- `Ankiety` in repo are currently a bounded public intake lane built around `SurveyShell`, `PublicMiniAssessmentView`, and `public-mini-assessment` backend routes, not a full survey product.
- The current survey lane supports `ask -> capture -> score`, but not a credible `synthesize -> action` loop; the result looks insight-like, yet is mostly rules-based scoring with templated text.
- `Interview` has a real capture loop: questions, answers, confidence, notes, evidence, review, and approval exist in `InterviewWorkspace`, `InterviewSingleQuestionRuntime`, and `InterviewController`.
- `Wnioski w Interview` are more real than `Ankiety`, but synthesis is still partial because insight generation relies mainly on question answers and does not fully consume the broader evidence captured in the session.
- Current summary output must not be overstated as true research insight; some of it is presentable synthesis, but not yet fully trustworthy structured analysis.

## First packet
- `Ankiety intake truth closure`

## Acceptance proof
- A respondent can open a real survey link, answer required questions, and complete the flow with answers persisted and recoverable.
- After submit, the system produces an honest synthesis layer: either evidence-backed summary or explicitly rules-based output, with no fake "AI insight" positioning.
- Captured survey data is stored in a structured way that can serve as valid input for later interview-grade synthesis.
- An operator can review raw answers plus the main reported challenge or gap, not only a polished result card.
- The flow has a real next step after synthesis: follow-up interview or structured analyst review, rather than a dead-end marketing CTA.

## Blockers / dependencies
- `Ankiety` do not currently have strong standalone product truth in repo; they exist mainly as a shell plus public mini-assessment flow.
- The present survey result layer is too shallow to count as credible insight.
- `Interview` insight generation does not yet use the full capture set, especially broader evidence gathered during sessions.
- Existing survey tests mostly prove route reachability, not a trustworthy end-to-end product loop.
- Downstream `action` is not yet fully credible inside this cluster alone, so the loop is still partially blocked at the final transition.

## Start now or wait
- `wait`
- This cluster has partially real `ask -> capture`, but it still lacks a credible enough `synthesize -> action` loop, and the manager execution order explicitly places it after stronger downstream surfaces are stabilized.
