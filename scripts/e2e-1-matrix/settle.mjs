// Route settling for the E2E-1 matrix.
//
// DEC-590 (Wpis 39): run 1 measured module 14 (/admin/people) on a pure spinner
// — the old fixed 4 s networkidle + 700 ms wait returned before React painted the
// real screen, so the surface cells were scored against the loading skeleton. The
// app's ONLY Suspense boundary around <Routes> renders
// DeferredRouteLoadingFallback with data-testid="route-loading-skeleton"
// (src/routes/DeferredRouteLoadingFallback.tsx:42). Waiting for that node to be
// absent is the honest "the screen is here" signal; networkidle alone is not,
// because staging keeps polling connections open and networkidle never fires.
//
// The wait is bounded (SETTLE_TIMEOUT_MS) and NEVER throws: one slow module must
// not abort the whole variant. On timeout it logs an ERROR line and returns
// spinnerGone:false so the cell is scored (and the evidence shows why) instead of
// crashing the run.

export const SPINNER_SELECTOR = '[data-testid="route-loading-skeleton"]';
export const SETTLE_TIMEOUT_MS = 15_000;

// After the spinner is gone, give the network a short capped window and React one
// frame budget so lazy data that lands just after paint is present in the shot.
const NETWORKIDLE_CAP_MS = 4_000;
const FRAME_BUDGET_MS = 300;

export async function settle(page, route, options = {}) {
  const {
    base,
    timeoutMs = SETTLE_TIMEOUT_MS,
    gotoTimeoutMs = 90_000,
    log = () => {},
  } = options;

  const startedAt = Date.now();
  await page.goto(`${base}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: gotoTimeoutMs,
  });

  let spinnerGone = true;
  try {
    await page.waitForSelector(SPINNER_SELECTOR, { state: 'hidden', timeout: timeoutMs });
  } catch (error) {
    spinnerGone = false;
    log(
      `[E2E-1] settle ERROR: spinner still present after ${
        Date.now() - startedAt
      }ms on ${route}: ${String(error).slice(0, 160)}`
    );
  }

  const remaining = Math.max(0, timeoutMs - (Date.now() - startedAt));
  await page
    .waitForLoadState('networkidle', { timeout: Math.min(remaining, NETWORKIDLE_CAP_MS) })
    .catch(() => {});
  await page.waitForTimeout(FRAME_BUDGET_MS);

  const elapsedMs = Date.now() - startedAt;
  log(`[E2E-1] settle ${route} in ${elapsedMs}ms (spinnerGone=${spinnerGone})`);
  return { route, elapsedMs, spinnerGone };
}
