# DECK-1 / U-43 freeze manifest

**Status: READY FOR CTO REVIEW**

- Base: `85541745e8226562b75ab318e1efe1f8178b5097`
- Candidate: the commit containing this manifest on `codex/deck-1-u43-20260916`
- Decision: DEC-543
- Scope: Deck Builder review wording, review panel, and non-blocking export/present behavior only.
- Rollout: `VITE_DECK_REVIEW_SIMPLE=false` and `ENABLE_DECK_REVIEW_WARNING_ONLY=false` by default.

## Delivered behavior

- One neutral `Review` entry replaces `QA and review` while the rollout flag is enabled.
- Review findings use plain language, expose `Go to slide`, and reserve the critical color for critical findings.
- Internal result codes, priority tokens, exporter metadata wording, and Deck Score are absent from the simplified view.
- Present remains available for a critical review verdict.
- Export quality findings become advisory when the server rollout flag is enabled; the existing export engine remains unchanged.
- Review workflow labels and approval state are localized in English and Polish.

## Verification

- Targeted importer/behavior tests: 5 files, 27 tests passed, `--retry=0`.
- Docker flag guard tests: 4/4 passed; repository guard: 195 flags analyzed, 0 missing.
- Full frontend TSC: base 152 errors / candidate 152 errors. The sole DeckBuilder match is an unchanged baseline `SimpleT` incompatibility at base line 999 / candidate line 1000.
- Full server TSC: base 0 / candidate 0.
- `git diff --check`: passed.
- English light screenshot: `evidence/deck-1-u43-20260916/deck-review-en-light.png`.
- English dark screenshot: `evidence/deck-1-u43-20260916/deck-review-en-dark.png`.
- Screenshot assertion checked for English deck content, `Go to slide`, and absence of Polish fixture copy, harness controls, internal codes, exporter metadata wording, and Deck Score.

## Review notes

- No migration, deployment, staging mutation, Railway change, or protected-branch push was performed.
- EXPORT-1 was treated as measurement context only; no shared export engine work was added.
- Local screenshots prove the built front-end view, not staging behavior.
