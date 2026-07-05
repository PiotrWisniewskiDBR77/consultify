# Chart export provisioning (DOCX/PDF) — C5

Status as of 2026-07-04: **chart rasterization works today**, both locally
and in the Railway production image, via `@napi-rs/canvas` (prebuilt
binaries, no native build / no system cairo·pango·jpeg required). This
document records the current state, the one fragile coupling worth fixing,
and what was verified.

## What renders charts

`server/src/services/documentStudio/documentChartRasterizer.ts` →
`renderChartBlockToPng(block)`:

1. Prefers `@napi-rs/canvas` (`createCanvas`) + `chart.js/auto`, rendering
   the chart to an off-screen canvas and returning a PNG `Buffer`.
2. Falls back to `chartjs-node-canvas` (native `canvas`/cairo build) only if
   `@napi-rs/canvas` fails to load — this path is not expected to work on
   Railway since neither `canvas` nor its system libs are installed there,
   but it costs nothing to keep as a defensive second attempt.
3. Returns `null` if both fail, or if the chart block payload is empty/
   malformed. Callers (`documentDocxRenderer.ts`, `documentPdfRenderer.ts`)
   treat `null` as fail-soft: they emit a `chart_raster_failed` QA warning
   and fall through to a typographic `[Figure N chart placeholder — ...]`
   line instead of crashing the export.

Both `bar`/`line`/`area`/`scatter`/`pie`/`donut` chart kinds are supported
(`chartTypeForKind` maps `donut`→`doughnut`, `area`→`line` with fill).

## C5 fix shipped in this change

Chart.js v4 auto-selects `DomPlatform` vs `BasicPlatform` via
`_isDomSupported()`, which just checks for a global `window`/`document`.
Under Vitest (environment: `jsdom`) those globals exist even though the
canvas passed in is `@napi-rs/canvas`'s canvas, not a real DOM canvas — so
Chart.js picked `DomPlatform`, called `canvas.getAttribute(...)`, and threw
(`@napi-rs/canvas` doesn't implement that DOM method). The catch in
`renderChartBlockToPng` swallowed the error and returned `null`, so **every
chart silently degraded to a placeholder under test**, while production
(plain Node, no jsdom global) rendered real PNGs the whole time. The two
environments diverged silently — the golden tests (`documentDocxGolden.
test.ts`, `documentPdfGolden.test.ts`) were asserting the *test-only*
placeholder behavior as if it were the real contract.

Fix: `NapiChartCanvas.renderToBuffer` now passes `platform:
ChartJSModule.BasicPlatform` explicitly, bypassing environment detection
entirely. This is strictly more correct (removes an environment-dependent
branch) and makes Vitest and production render identically. Verified via a
standalone `tsx` script (outside Vitest, outside jsdom) and via the Vitest
suite — both now produce a real embedded image.

## Deploy topology (Dockerfile.api) — verified, one fragile coupling

`Dockerfile.api`'s `backend-builder` stage:
1. `npm ci` at **root** `package.json` into `/app/node_modules` — this
   installs `@napi-rs/canvas` and `chart.js`, both declared as root
   `dependencies` (not dev).
2. Layers `server/package.json`'s dependencies into the *same*
   `/app/node_modules` (sweep + hard-fail if any declared server dep is
   missing after install).
3. Copies that merged `/app/node_modules` to `/app/server/node_modules` in
   the final runtime image (`COPY --from=backend-builder /app/node_modules
   /app/server/node_modules`).

Because `@napi-rs/canvas` and `chart.js` are root dependencies, they are
present in the merged tree and therefore present in the runtime image today
— confirmed by inspecting the Dockerfile and by resolving both packages
from `server/node_modules` in this repo's local checkout.

**The fragile part:** `documentChartRasterizer.ts` imports `@napi-rs/canvas`
directly, but `server/package.json` does not declare it (only root does).
`chart.js` IS declared in both. This works only because of the root→server
install order above — it is not self-documenting and not verified anywhere
before this change.

**Why it wasn't fixed by adding it to `server/package.json` in this change:**
`server/package-lock.json` already contains `@napi-rs/canvas` as a
*transitive* entry (pinned at an old `0.1.80`, pulled in by some other
package) but does **not** list it in the lockfile's root `dependencies` map.
Declaring it directly in `server/package.json` desyncs `package.json` from
`package-lock.json` — confirmed with `npm ci --omit=dev --ignore-scripts
--dry-run`, which hard-fails with `EUSAGE ... does not satisfy`. Fixing that
requires regenerating `server/package-lock.json` via `npm install`, which
this task's guardrails explicitly forbid (shared `node_modules` across
concurrent agent sessions). `Dockerfile.api`'s `npm ci || npm install`
fallback would technically recover from this by re-resolving the lock at
build time, but that defeats the point of `npm ci`'s determinism and
depends on registry access during the Docker build.

**What was done instead (safe, no install required):** added a build-time
guard in `Dockerfile.api` (mirroring the existing `cookie-parser`/
`pptxgenjs`/`rrule` checks) that fails the image build loudly if
`@napi-rs/canvas` is absent from the final `node_modules`, instead of
silently shipping a build where every chart export degrades to a text
placeholder.

## Recommendation for Piotr / ops

Low-risk, do during a normal dependency-bump pass (not blocking):
add `@napi-rs/canvas` to `server/package.json`'s `dependencies` (same
version as root, currently `^1.0.1`) and run `npm install` inside
`server/` to regenerate `server/package-lock.json` so the coupling is
explicit and `npm ci` stays deterministic without relying on install
order across two package.json files. This is a mechanical, low-risk
change — no code changes required, just a lockfile regeneration — but it
does need an actual `npm install` run, which is why it wasn't done here.

## What was NOT needed

No SVG rendering path, no `sharp`/`@resvg/resvg-js` raster conversion, and
no `optionalDependencies` declaration were needed — the existing
`@napi-rs/canvas` + `chart.js` raster path already produces real PNGs for
both DOCX (`ImageRun`) and PDF (`doc.image()`) with zero native builds.
