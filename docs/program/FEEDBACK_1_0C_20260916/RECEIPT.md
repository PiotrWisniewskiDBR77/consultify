# FEEDBACK-1/0c — receipt

Status: **READY FOR CTO REVIEW**

Base: `70d366f158`

Decision: DEC-575. Commit markers cover the frozen modules reported by the repository hook.

## Scope and measured behavior

- The global JSON input sanitizer preserves ampersands, quotes, apostrophes and backticks while it still neutralizes `<` and `>`.
- A RealPG middleware round-trip preserves `R&D "yes" / Q&A / M&A` byte-for-byte. A raw `<script>` remains stored with neutralized delimiters.
- The second Canvas Mermaid renderer now uses `securityLevel: strict`, `htmlLabels: false` and the shared SVG final-context sanitizer.
- Code execution HTML, the My Work long-text renderer and the rich editor sanitize before DOM injection. The rich editor sanitizes again at commit, including content introduced after mount.
- The dormant premium-report template no longer injects raw `content`. The canonical renderer supplies sanitized `safeContent`; a direct legacy compile falls back to escaped text and does not silently drop the section.

## Verification

- Focused sanitizer/component/server suite: **6 files / 125 tests PASS**, `--retry=0`.
- Disposable PostgreSQL 17 (`cx-feedback0c-pg`, local port 6454): **2/2 PASS**.
- Independent skeptical review after two P1 corrections: **READY FOR CTO REVIEW, 0 P0 / 0 P1 / 2 P2**.
- Full TypeScript on the same dependency installation:
  - frontend base `70d366f158`: **RC=2 / 169**; candidate: **RC=2 / 169**; delta 0;
  - server base: **RC=0 / 0**; candidate: **RC=0 / 0**; delta 0.
- Esbuild per changed production TypeScript/TSX file: **6/6 PASS** before the final P1-only correction; server TSC and focused renderer tests cover the added server renderer and final correction.
- Prettier for every changed TS/TSX file and `git diff --check`: PASS.

## Explicit limits

- `server/src/templates/premium-report.hbs` has no confirmed production caller on this base. The template contract is fail-closed and tested, but a live premium-report route remains **EVIDENCE_MISSING**.
- Built artifact packaging for the dormant Handlebars template is not exercised. The renderer checks source and built-runtime candidate paths, but this stays P2 until a production caller exists.
- `canvasMarkdownConversion.ts:170` remains P3 for a separate rich-text round-trip policy review. It is an editing representation; changing it in this security patch could remove supported Canvas extensions.
- Migration `20262280` is intentionally a separate package and follows this code fix.

Zero staging writes, deploys, Railway changes, screenshots or protected refs.
