# K2 v3 — signed freeze receipt

This receipt resolves the self-reference boundary without claiming that a Git commit contains its own SHA.

- Exact base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.
- Final product, test, and evidence content commit: `e5a7636bc01029a9e344acc570e86963a0b29f62`.
- Freeze commit containing `FREEZE.md`: `f8ebbd408185ddc5cf5d9903fcb457cc82371103`.
- Freeze tree: `d0d3c385c23950ccf834e9f511f3e60ef4c71aff`.
- Branch: `codex/b-k2-superadmin-i18n-20260915`.
- Required backup ref: `refs/heads/backup/codex/b-k2-superadmin-i18n-20260915`.

The receipt commit itself adds only this identity record. Product, locale, tests, evidence, and freeze content are byte-identical to the tree identified above, except for this new receipt file.
