# Interview per-answer approval — C-UI AS-IS and bounded plan

## AS-IS

- `OrgAIPolicyTab` loads and writes the canonical organization AI policy, but
  has no Interview answer-approval selector. Its guided form rebuilds a partial
  object, so changing a guided field can drop unrelated and future policy keys.
- `V8InterviewApi` exposes `getAnswerApprovals`, `decideAnswerApprovals` and
  `retryAiAnswerApprovals`, but no mounted Interview UI calls them.
- `InterviewWorkspace` still exposes assignment-wide approve/send-back actions.
  It does not show each answer's frozen submission, next stage, decision or
  sent-back reason.
- `InterviewSingleQuestionRuntime` receives no canonical per-answer approval
  projection, so it cannot explain why one answer is editable or locked.
- `InterviewHub` opens the existing Workspace and uses existing list/preview
  surfaces, but its refresh path does not include per-answer decision results.
- The shared API client does not translate `response.data.messageKey`.
  `retry-ai` therefore needs an explicit UI caller that resolves the returned
  key through i18n and never displays the raw error code.

## Bounded implementation slices

1. Add an EN/PL Interview answer-approval mode selector to
   `OrgAIPolicyTab`. Default to manager when the key is absent. Update only
   `policy.interview.answerApproval={version:1,mode}` while preserving every
   unrelated and future key. Refuse unsupported future answer-approval policy
   versions instead of rewriting them.
2. Load the canonical approval projection in `InterviewWorkspace` using the
   current assignment identity and a generation guard. Managers receive
   per-answer Approve and Send back controls with an explicit reason; 409 keeps
   the draft and refreshes the projection. Respondents see status, next stage
   and sent-back reason, and may retry a pending AI stage.
3. Pass each question's projection into `InterviewSingleQuestionRuntime` so a
   completed sibling remains locked while a returned answer is editable. A
   successful edit/resubmit refreshes the same assignment and question IDs.
4. Keep the existing `InterviewHub` table and preview composition. Refresh its
   existing selected assignment after decisions; do not add a parallel list.
5. Add EN and PL copy for mode choices, per-answer status/actions, reason,
   retry, conflicts and unavailable states. The retry error path must translate
   the server `messageKey`; code-only fallback is a generic localized error.

## Required behavior evidence

- Organization policy round-trip preserves unrelated/future keys and blocks a
  future answer-approval version.
- Manager decisions target one exact question/submission/revision and do not
  change siblings.
- Respondent sees sent-back reason, can edit only returned answers, and
  resubmission preserves completed siblings.
- Retry AI handles unavailable, malformed, 409 and success responses; the
  unavailable case renders translated EN/PL copy, never the raw code.
- Scope switches cannot apply late organization, assignment or decision
  responses to the newly selected entity.
- Focused mounted tests cover light and dark class contracts. Real acceptance
  uses the existing V8 ApiGateway/JWT/PostgreSQL chain and hard reload.

## First RED denominator

- `OrgAIPolicyTab` cannot find the Answer approval mode control and cannot
  perform the preserving policy update.
- `InterviewWorkspace` cannot find the Retry AI review action and therefore
  cannot prove `messageKey` translation.
