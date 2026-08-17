/**
 * UI-CANON G4 — shared types for the automated canon sweep.
 *
 * G4 is the *browser* gate: a truly mounted application, real PostgreSQL and
 * real authentication. Nothing in this harness may use request interception,
 * route stubbing or a mocked database — a surface that cannot be reached
 * honestly is recorded as unreachable, never faked.
 */

export type ViewportName = 'desktop' | 'tablet' | 'mobile';
export type LanguageName = 'pl' | 'en';
export type ThemeName = 'light' | 'dark';

export const VIEWPORTS: Record<ViewportName, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

export const LANGUAGES: LanguageName[] = ['pl', 'en'];
export const THEMES: ThemeName[] = ['light', 'dark'];

/** One of the seven canon states a surface may or may not possess. */
export type StateName =
  | 'loading'
  | 'empty'
  | 'ready'
  | 'error'
  | 'forbidden'
  | 'stale';

/**
 * How a state is reached *honestly*. `route` navigates to a real URL (e.g. a
 * deliberately non-existent resource id, which makes the real backend answer
 * 404) — never a stubbed response.
 */
export interface StateProbe {
  state: StateName;
  /** Deep-link used to provoke the state. Relative to baseURL. */
  path: string;
  /** Substring/regex the rendered surface must show for the state to count. */
  expect?: RegExp;
  /** Why this probe legitimately produces the state (recorded in evidence). */
  rationale: string;
}

export interface SurfaceSpec {
  /** Closure task id, e.g. `CHAT-UI-CANON-001`. */
  taskId: string;
  /** Short key used on the command line: `G4_SURFACE=CHAT`. */
  key: string;
  /** Human module name. */
  module: string;
  /** Canonical deep-link route for the surface. */
  route: string;
  /** Extra in-module routes swept at desktop/pl/light only. */
  secondaryRoutes?: string[];
  /**
   * Per-route ready signal. A secondary route often renders a differently
   * titled screen (e.g. Table Studio under the Materials module), and reusing
   * the module-level signal there would report a false "did not render".
   */
  routeSignals?: Record<string, RegExp>;
  /**
   * Signal that the surface itself (not just the app shell) rendered.
   * Must work in both PL and EN.
   */
  readySignal: RegExp;
  /**
   * Gates that must be opened for the surface to mount, with the exact
   * override used. Recorded verbatim in the evidence file.
   */
  gates: string[];
  /** localStorage feature-flag overrides applied before load. */
  flagOverrides?: Record<string, string>;
  /** Honest, interception-free state probes. */
  stateProbes?: StateProbe[];
  /** States this surface genuinely does not possess (recorded, not skipped). */
  statesNotPresent?: StateName[];
}

export interface AxeViolation {
  id: string;
  impact: string;
  nodes: number;
  help: string;
  /** Up to five concrete CSS selectors, so the finding can be acted on. */
  targets: string[];
}

export interface CellResult {
  viewport: ViewportName;
  language: LanguageName;
  theme: ThemeName;
  route: string;
  surfaceRendered: boolean;
  screenshot: string | null;
  horizontalOverflow: { overflowed: boolean; scrollWidth: number; clientWidth: number };
  axe: { critical: number; serious: number; violations: AxeViolation[] };
  unnamedControls: { count: number; samples: string[] };
  consoleErrors: string[];
}

export interface SurfaceResult {
  taskId: string;
  key: string;
  module: string;
  route: string;
  productSha: string;
  startedAt: string;
  cells: CellResult[];
  deepLink: { ok: boolean; detail: string };
  reload: { ok: boolean; detail: string };
  coldReopen: { ok: boolean; detail: string };
  keyboard: {
    reachableControls: number;
    focusAlwaysVisible: boolean;
    invisibleFocusSamples: string[];
    escapeHandled: string;
    focusReturn: string;
    tabOrderMonotonic: boolean;
  };
  states: Array<{
    state: StateName;
    observed: boolean;
    path: string;
    detail: string;
    screenshot: string | null;
  }>;
  statesNotPresent: StateName[];
  negativeControls: Record<string, string>;
  gates: string[];
}
