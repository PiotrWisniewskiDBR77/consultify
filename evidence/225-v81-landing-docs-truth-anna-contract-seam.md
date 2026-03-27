# V8.1 Evidence - Landing docs truth Anna Contract Seam

Date: 2026-03-26
Lane: `Landing docs truth`
Taxonomy: `T4`
Packet: `anna contract docs truth`

## Goal

Close the bounded landing documentation seam where canonical docs still describe `ANNA_LP_ASSISTANT_CONTRACT_V8.md` as
missing, despite the contract already existing in the repository.

## What changed

1. `docs/product/LANDING_V8_SSOT.md`
   - removes stale "file missing" claims
   - reframes the dependency correctly as Anna landing embedding, not contract restoration
2. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md`
   - removes stale future-tense references to `LANDING_V8_SSOT.md`
   - aligns related-doc references with the current repository state
3. `docs/product/work-packets/WP-W7-ROOF-03_LANDING_SUPERADMIN.md`
   - closes the stale missing-file assessment
   - keeps only the real residual gap: embedding Anna coherently into landing IA

## Why it matters

Before this packet, the repository contained both the canonical contract file and canonical docs claiming that the file did
not exist. That made landing guidance internally contradictory.

After this packet, the docs agree that the contract exists and that the remaining work is implementation/embedding, not
restoration.

## Verification

- doc-only packet; no runtime or UI tests required
