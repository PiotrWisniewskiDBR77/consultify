# M6 W81 navigation and scrollbar freeze

Status: **READY FOR CTO REVIEW**

- Base: `df3428e7e027124a60dfdc0b7ae1ba3a76c4facc`
- Product HEAD: `6a5f31bbe2b42c13394d9434364eaa7df385f43d`
- Branch: `codex/a-m6-w81-nav-scroll-20260915`
- Replayed product commits only: `da0639b0a1`, `95897bf5df`, `dd63930f9c`, `3be223c278`, `35ab487899`, `6cbc1265be`.

## W81 result

- `src/index.css` contains one canonical `.no-scrollbar` definition using Firefox `scrollbar-width: none` and WebKit `::-webkit-scrollbar { display: none; }` rules. The seven existing consumers remain scrollable.
- `ModuleNavBar` wraps its left and right clusters below 1360 px. At 1280 px the three Initiative view positions, including `Load`, all three view-mode controls, and the primary CTA remain rendered and reachable.
- At wider viewports the canonical single-row layout remains active.
- The F9 constraint remains green: Initiative Menu 3 still contains no more than three pills.

## Evidence

- Targeted replay and W81 regression suite: `8` files, `40/40 PASS`, `--retry=0`, one worker.
- The dedicated 1280 render asserts all three tabs, `Load`, three view controls, CTA visibility, wrapping semantics, and horizontal tab reachability.
- The CSS regression counts exactly seven existing `no-scrollbar` uses and checks one Firefox/WebKit definition.
- esbuild import checks: `11/11` changed browser/server importers emitted successfully.
- Commit hooks passed canonical list, visual, flag, language, and MVP-final ratchets.
- Base canonical type-check reference: frontend `193`, server `22` diagnostics.
- Candidate frontend type-check: **TIMEOUT_120 / NOT_PROVEN**; stopped after 120 seconds under W20 and not rerun. No diagnostic comparison is claimed.
- Candidate server type-check: **NOT_RUN / NOT_PROVEN** to avoid further disk and process pressure after the frontend timeout.
- `git diff --check`: clean.
- Disk checkpoint after the timeout: `29 GiB` free, above the `20 GiB` stop threshold.

## Open evidence

- Browser screenshots: **NOT_PROVEN**; no runtime was started.
- Staging, deployment, and production readback were not performed.

No protected ref, staging, deployment, or `OD_CODEXA.md` change was made.
