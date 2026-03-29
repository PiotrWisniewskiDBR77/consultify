# 539 - V8.1 Surveys must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Ankiety` / `SurveyShell` must-have closure for the current wave

## Scope truth

- `Ankiety` already had:
  - resume to first unanswered question
  - autosave
  - focus mode
  - progress tracking
- The remaining must-have gap sat in the shell contract:
  - submit lifecycle could get stuck
  - locked mode was implicit rather than explicit

## Problem before closeout

- `SurveyShell` set `isSubmitting=true` before `onSubmit`, but never reset it afterward.
- If the submit callback resolved without replacing the entire screen, the submit button could remain stuck in a loading/disabled state.
- `locked` mode disabled inputs, but did not clearly tell the user the survey was intentionally read-only.

## What landed

### 1. Honest submit lifecycle

- `src/components/Survey/SurveyShell.tsx`
  - `onSubmit` now supports sync or async callbacks
  - `handleSubmit()` now awaits `Promise.resolve(onSubmit(...))`
  - `isSubmitting` is reset in `finally`

This keeps the shell honest even when submit completes in-place.

### 2. Explicit read-only contract

- `src/components/Survey/SurveyShell.tsx`
  - now shows a visible read-only banner when `locked`
  - tells the user that review is available, but answering and submitting are disabled

## Automated verification

Passed:

- `npx vitest run tests/components/Survey/SurveyShell.capture-resume.test.tsx`

Coverage includes:

- resume on first unanswered question
- autosave uses the latest answer snapshot
- submit button re-enables after submit callback resolves
- locked mode shows an explicit read-only banner

## Manual acceptance checklist

- Open a survey with partially completed answers and confirm it resumes on the first unanswered question.
- Answer a question and confirm autosave persists the latest value.
- Submit a completed survey and confirm the shell does not remain stuck in loading after submit resolves.
- Open the survey in `locked` mode and confirm the module clearly explains it is read-only.

## Residual risk

- This closeout covers the survey shell contract, not broader assessment orchestration or reporting semantics.
- It does not claim deeper backend submission governance beyond the current callback contract.

## Status

- `Ankiety` no longer risk leaving the user stuck in a permanent submit-loading state.
- `Ankiety` no longer hide read-only authority behind disabled inputs alone.
- Current closure status at time of write: code landed, focused tests green, pre-ratification snapshot.
- Current authority: final Wave 1 module ratification is recorded in `548-v81-wave1-final-module-gate-ratification.md`.
