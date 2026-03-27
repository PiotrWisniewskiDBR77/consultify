# V8.1 Evidence - Landing docs truth Split-Brain Map

Date: 2026-03-26
Lane: `Landing docs truth`
Taxonomy: `T4`
Status: `done`

## Why this lane is promoted now

The public landing implementation and contract files already moved forward, but several canonical docs still claimed that
`ANNA_LP_ASSISTANT_CONTRACT_V8.md` was missing from the repository.

That left a bounded docs split-brain: the file existed, while the landing SSOT and upstream gap analysis still described it
as absent.

## Surface truth before promotion

The landing documentation surface mixed truth in three places:

1. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` exists and is canonical
2. `docs/product/LANDING_V8_SSOT.md` still said the file was missing and required restoration
3. `docs/product/work-packets/WP-W7-ROOF-03_LANDING_SUPERADMIN.md` still treated the file as absent and escalated that as
   an open question

## Bounded packet

This lane is narrowed to one packet:

1. normalize the canonical docs to acknowledge that the Anna LP contract exists
2. preserve the real remaining gap as Anna embedding on landing IA, not file restoration
3. close the documentation split-brain without broadening into a new landing implementation lane
