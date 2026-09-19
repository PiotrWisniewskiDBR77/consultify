// Failure classification for the E2E-1 matrix (QD6, "lekcja 17.09").
//
// A red cell has two very different causes: the PRODUCT is broken, or the
// HARNESS CONTRACT is stale (a selector that no longer matches, a surface this
// module never had, a control that is legitimately not interactable). Before
// this module both landed in one number (`nonPassingCells`), so a renamed
// `data-testid` read exactly like a 500 on a view — and the nightly report
// could not be triaged without opening every screenshot.
//
// Classification is evidence-based and deliberately biased toward PRODUCT:
// anything the app itself reported (5xx, 4xx, console error, a write attempted
// while only viewing) is PRODUCT; CONTRACT requires positive evidence that the
// harness expectation — not the app — was wrong; ENV covers causes outside both
// (a route that never settled, a flag profile that differs between variants).
// Cross-variant evidence upgrades confidence: a surface missing in EVERY variant
// of a locale is a contract question, the same surface missing in ONE of four is
// a product defect.

import { createHash } from 'node:crypto';

import { MODULES, parseVariant, routeMatchesModule } from './contract.mjs';
import { appConsoleErrors } from './consoleNoise.mjs';

export const CLASSES = Object.freeze({
  PRODUCT: 'PRODUCT',
  CONTRACT: 'CONTRACT',
  ENV: 'ENV',
});

/** Worst-first; used to pick the single status label of a run/aggregate. */
export const CLASS_SEVERITY = Object.freeze(['PRODUCT', 'ENV', 'CONTRACT']);

const CONFIDENCE = Object.freeze({ HIGH: 'high', LOW: 'low' });

const SERVER_ERROR = / -> 5\d\d(?:\s|$)/;
const CLIENT_ERROR = / -> 4\d\d(?:\s|$)/;
const INTERACTION_TIMEOUT =
  /timeout \d+ms exceeded|waiting for|not interactable|intercept|locator\./i;
// Browser-level connectivity failure: the request never reached any server, so
// it is neither app logic nor a stale harness expectation. Measured 18.09 on the
// local stack (09-execution scored PRODUCT on net::ERR_INTERNET_DISCONNECTED).
const NETWORK_UNREACHABLE =
  /net::ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NETWORK_CHANGED|ADDRESS_UNREACHABLE|CONNECTION_REFUSED|CONNECTION_RESET)/i;

/** Routes whose spinner never disappeared within the settle budget. */
export function stuckRoutes(result) {
  const stuck = new Set();
  for (const module of result?.modules || []) {
    for (const run of module.settle || []) {
      if (run && run.spinnerGone === false) stuck.add(run.route || module.route);
    }
  }
  return stuck;
}

/**
 * Stable fingerprint of the captured flag snapshots. Flags are CAPTURED, never
 * toggled (staging is read-only for this station), so the flag axis enters the
 * matrix as an explanation: two variants with different profiles are not
 * comparable, and their differences are ENV, not PRODUCT.
 *
 * Both snapshots count. The 18.09 local run measured `flags.runtime` = {} while
 * `/api/v8/admin/flags` returned 9 flags, so a runtime-only fingerprint hashed
 * an empty map for every variant and could never explain anything.
 */
function flagEntries(result) {
  const entries = [];
  const collect = (prefix, source) => {
    if (!source || typeof source !== 'object') return;
    for (const key of Object.keys(source)) entries.push([`${prefix}${key}`, source[key]]);
  };
  collect('runtime.', result?.flags?.runtime);
  collect('v8.', result?.flags?.v8);
  return entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

export function flagMap(result) {
  return Object.fromEntries(flagEntries(result));
}

export function flagProfile(result) {
  const entries = flagEntries(result);
  if (!entries.length) return 'none';
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0, 12);
}

/** Which flags differ between two profiles (for the report). */
export function flagDiff(a, b) {
  const left = flagMap(a);
  const right = flagMap(b);
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const diff = [];
  for (const key of [...keys].sort()) {
    const l = JSON.stringify(left[key] ?? null);
    const r = JSON.stringify(right[key] ?? null);
    if (l !== r) diff.push({ flag: key, a: left[key] ?? null, b: right[key] ?? null });
  }
  return diff;
}

/** Locale of a variant key; 'unknown' keeps a partial/local run classifiable. */
export function localeOf(variantKeyString) {
  try {
    return parseVariant(String(variantKeyString || '')).locale;
  } catch {
    return 'unknown';
  }
}

/**
 * Group key for cross-variant comparison. Two axes cannot be compared blindly:
 * control labels are rendered text (locale-dependent) and a role/org may
 * legitimately not see a surface at all (authorization). Groups are therefore
 * scoped to one principal AND one locale, which leaves the theme as the free
 * axis — and a surface that exists in one theme but not the other is a defect,
 * not a contract question.
 */
export function groupKey(principal, locale, cell) {
  return `${principal}|${locale}|${cell.module}|${cell.kind}|${cell.control || '__surface__'}`;
}

export function buildGroups(results, localeFor, principalFor) {
  const groups = new Map();
  for (const result of results) {
    const locale = localeFor(result);
    const principal = principalFor(result);
    for (const cell of result.cells || []) {
      const key = groupKey(principal, locale, cell);
      const group = groups.get(key) || { key, total: 0, nonPassing: 0 };
      group.total += 1;
      if (cell.status !== 'PASS') group.nonPassing += 1;
      groups.set(key, group);
    }
  }
  return groups;
}

/**
 * Classify ONE cell. `ctx` carries everything the cell cannot know by itself:
 *   - stuckRoute: the module's settle never reported spinnerGone
 *   - flagMinority: this variant's flag profile is not the run's majority
 *   - group: { total, nonPassing } across comparable variants (aggregate only)
 *   - module: the contract module (for the menu1 route assertion)
 * Returns null for PASS.
 */
export function classifyCell(cell, ctx = {}) {
  if (!cell || cell.status === 'PASS') return null;

  const httpErrors = cell.httpErrors || [];
  const consoleErrors = appConsoleErrors(cell.consoleErrors);

  if (cell.status === 'BLOCKED') {
    return verdict(
      CLASSES.PRODUCT,
      CONFIDENCE.HIGH,
      'a view attempted a domain write (blocked before network)'
    );
  }
  if (httpErrors.some((entry) => SERVER_ERROR.test(entry))) {
    return verdict(CLASSES.PRODUCT, CONFIDENCE.HIGH, `server error on view: ${first(httpErrors)}`);
  }
  if (consoleErrors.length && consoleErrors.every((entry) => NETWORK_UNREACHABLE.test(entry))) {
    return verdict(
      CLASSES.ENV,
      CONFIDENCE.HIGH,
      `the browser never reached a server: ${first(consoleErrors)}`
    );
  }
  if (consoleErrors.length) {
    return verdict(
      CLASSES.PRODUCT,
      CONFIDENCE.HIGH,
      `uncaught console error: ${first(consoleErrors)}`
    );
  }
  if (httpErrors.some((entry) => CLIENT_ERROR.test(entry))) {
    return verdict(CLASSES.PRODUCT, CONFIDENCE.HIGH, `API 4xx on view: ${first(httpErrors)}`);
  }

  if (ctx.stuckRoute) {
    return verdict(
      CLASSES.ENV,
      CONFIDENCE.HIGH,
      'route never settled (spinner present after the settle budget) — cells scored against a skeleton'
    );
  }
  if (ctx.flagMinority) {
    return verdict(
      CLASSES.ENV,
      CONFIDENCE.HIGH,
      'flag profile differs from the majority of the run — variant not comparable'
    );
  }

  // Group evidence only counts when at least two comparable variants were
  // observed; a lone variant cannot tell a stale selector from a missing feature.
  const comparable = ctx.group && ctx.group.total > 1 ? ctx.group : null;
  if (comparable && comparable.nonPassing < comparable.total) {
    return verdict(
      CLASSES.PRODUCT,
      CONFIDENCE.HIGH,
      `the same control is fine in ${comparable.total - comparable.nonPassing}/${comparable.total} comparable variants (same principal and locale, other theme)`
    );
  }

  if (cell.status === 'MISSING') {
    return verdict(
      CLASSES.CONTRACT,
      comparable ? CONFIDENCE.HIGH : CONFIDENCE.LOW,
      comparable
        ? `surface absent in all ${comparable.total} comparable variants — selector or product contract, not a regression`
        : 'surface absent; single-variant evidence cannot separate a stale selector from a missing feature'
    );
  }

  if (cell.kind === 'menu1' && ctx.module && cell.routeAfter) {
    if (!routeMatchesModule(cell.routeAfter, ctx.module)) {
      return verdict(
        CLASSES.PRODUCT,
        CONFIDENCE.HIGH,
        `navigation landed on ${cell.routeAfter} instead of ${ctx.module.route}`
      );
    }
  }

  if (INTERACTION_TIMEOUT.test(String(cell.note || ''))) {
    return verdict(
      CLASSES.CONTRACT,
      comparable ? CONFIDENCE.HIGH : CONFIDENCE.LOW,
      'control not interactable within the harness budget and the app reported no error'
    );
  }

  return verdict(
    CLASSES.PRODUCT,
    CONFIDENCE.LOW,
    'non-PASS with no harness-contract evidence — counted as a product defect by default'
  );
}

function verdict(klass, confidence, reason) {
  return Object.freeze({ class: klass, confidence, reason });
}

function first(list) {
  return String(list[0] ?? '').slice(0, 160);
}

/** Classify every cell of one variant result; returns counts + per-cell verdicts. */
export function classifyResult(
  result,
  { locale, principal = 'unknown', groups = null, flagMinority = false } = {}
) {
  const stuck = stuckRoutes(result);
  const stuckModules = new Set();
  for (const module of result?.modules || []) {
    if ((module.settle || []).some((run) => run && run.spinnerGone === false))
      stuckModules.add(module.id);
  }
  const moduleById = new Map(MODULES.map((module) => [module.id, module]));
  const counts = { PRODUCT: 0, CONTRACT: 0, ENV: 0 };
  const cells = (result?.cells || []).map((cell) => {
    const verdictForCell = classifyCell(cell, {
      stuckRoute: stuckModules.has(cell.module) || stuck.has(cell.routeAfter),
      flagMinority,
      group: groups ? groups.get(groupKey(principal, locale, cell)) || null : null,
      module: moduleById.get(cell.module) || null,
    });
    if (verdictForCell) counts[verdictForCell.class] += 1;
    return { ...cell, ...(verdictForCell ? { classification: verdictForCell } : {}) };
  });
  return { cells, counts, nonPassing: cells.filter((cell) => cell.status !== 'PASS').length };
}

/** Worst class present, or null when nothing is classified. */
export function worstClass(counts) {
  for (const klass of CLASS_SEVERITY) if (counts?.[klass]) return klass;
  return null;
}

export { CONFIDENCE };
