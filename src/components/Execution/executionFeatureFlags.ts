/**
 * M14 — Execution cockpit feature flags (default OFF, live-safe).
 *
 * New cockpit surfaces ship behind flags so they land in code without
 * changing the live cockpit until a deliberate flip + pixel-verify.
 * Resolution order (first wins): URL query → localStorage → Vite build
 * env → default false.
 *
 * DEC-120/A7: the `intelligence`, `whatIfSandbox`, and `changeSignals`
 * flags were removed as phantoms — each had real resolution logic here but
 * zero real callers (ExecutionIntelligencePanel/ExecutionWhatIfSandbox/
 * ExecutionChangeSignalsPanel were never mounted anywhere reachable; a
 * stale source-anchor test claimed otherwise but had already drifted false
 * before this batch — see the removed
 * ExecutionHub.r14-panel-relocation.source-anchor.test.ts). `profileSource`
 * is kept on the signature for future flags even though no live flag
 * currently reads it.
 */

import { isPublicProductionHost } from '@/utils/publicProduction';
import { type DemoAcceptanceProfileSource } from '@/utils/demoAcceptanceProfile';

type FlagKeys = { query: string; localStorage: string; env: string };

const FLAGS = {
  ganttBaseline: {
    query: 'ff_ganttBaseline',
    localStorage: 'ff.exec_gantt_baseline',
    env: 'VITE_EXEC_GANTT_BASELINE_ENABLED',
  },
  rolloutStages: {
    query: 'ff_rolloutStages',
    localStorage: 'ff.exec_rollout_stages',
    env: 'VITE_EXEC_ROLLOUT_STAGES_ENABLED',
  },
  benefits: {
    query: 'ff_benefits',
    localStorage: 'ff.exec_benefits',
    env: 'VITE_EXEC_BENEFITS_ENABLED',
  },
  // #77 / Z94 — Kokpit menedżera „pełna wizja McKinsey" (Summary one-look).
  // Nowa zakładka jednego spojrzenia (on-time / wartość vs plan / obłożenie /
  // TOP ryzyka / decyzje-do-podjęcia). Default OFF do akceptu Piotra (reguła #7).
  summaryOneLook: {
    query: 'ff_summaryOneLook',
    localStorage: 'ff.exec_summary_onelook',
    env: 'VITE_EXEC_SUMMARY_ONELOOK_ENABLED',
  },
  // DEC-2026-08-25-63 — four Execution management reports and their unified
  // generator. The surface remains OFF everywhere (including demo) until an
  // explicit query/localStorage/env opt-in is provided.
  execReportsIntelligence: {
    query: 'ff_execReportsIntel',
    localStorage: 'ff.exec_reports_intel',
    env: 'VITE_EXEC_REPORTS_INTELLIGENCE_ENABLED',
  },
} as const satisfies Record<string, FlagKeys>;

export type ExecutionFlag = keyof typeof FLAGS;

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

function readQuery(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(key));
  } catch {
    return null;
  }
}

function readLocalStorage(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readEnv(key: string): boolean {
  try {
    const env = (import.meta.env as unknown as Record<string, string>);
    return parseFlag(env?.[key]) === true;
  } catch {
    return false;
  }
}

/** True when the given execution cockpit feature is enabled (default OFF). */
export function isExecutionFlagEnabled(
  flag: ExecutionFlag,
  profileSource?: DemoAcceptanceProfileSource
): boolean {
  const keys = FLAGS[flag];
  const fromQuery = readQuery(keys.query);
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage(keys.localStorage);
  if (fromLs !== null) return fromLs;
  if (readEnv(keys.env)) return true;
  // ★ Rule #7 (CLAUDE.md): brand-new, not-yet-screenshotted cockpit surface stays
  // OFF everywhere — including demo — until Piotr accepts a clean dev-render.
  // Does NOT inherit the D-D "ON except public prod" fallback below.
  //
  // POMIAR 1.12-R4 (06.09.2026, org DBR77) — dlaczego domyślna wartość ZOSTAJE `false`,
  // mimo że zlecenie dopuszczało przełączenie na ON po zrzucie:
  //   • Wszystkie cztery raporty (`reports-intelligence/`) czytają WYŁĄCZNIE szkielet
  //     `runtime-v1`: `listExecutionCases` / `readExecutionWork` / `readExecutionMilestones`
  //     (WorkIntelligenceReport), `listManagementSignals` / `listInterventions`
  //     (ControlLoopReport), `readOperationalAllocations` (ResourcesCapacityReport).
  //     Dla DBR77 te endpointy zwracają 0 rekordów (pomiar HTTP), więc włączenie flagi
  //     pokazuje cztery PUSTE raporty — a nie brakującą funkcję.
  //   • Zrzut, który daje zlecenie 1.12-R4, dotyczy NOWEGO ekranu Raporty (migawki na
  //     realnych danych: /api/tasks, /api/decisions, /api/raid, /api/initiatives), a NIE
  //     tych czterech komponentów. Domyślne ON byłoby więc włączeniem czegoś, czego nikt
  //     nie obejrzał — dokładnie kształt, przed którym stoi reguła #7.
  //   • Wejście do nich to DODATKOWY chip w Menu 3, które na zakładce „Praca" ma już 11
  //     presetów (kanon dopuszcza ≤3) — przy 1440 px chip wypada poza ekran
  //     (evidence/1-12-r4/05-menu3-chipy-flaga-on.png).
  // Warunek zdjęcia tej linii: przepiąć te cztery raporty na realne dane (pakiet R1)
  // ALBO zrobić ich własny czysty zrzut i dostać akcept właściciela.
  if (flag === 'execReportsIntelligence') return false;
  // D-D (2026-06-29): verified-ready M14 cockpit (Intelligence/What-If/Rollout/
  // Benefits/ganttBaseline) defaults ON everywhere EXCEPT public production
  // (consultify.ai). Demo/stage/dev → ON; prod stays env-gated (D-G = no prod).
  // Reversible: drop this line to restore default-OFF.
  return !isPublicProductionHost(typeof window !== 'undefined' ? window.location.hostname : '');
}

export const EXECUTION_FLAG_KEYS = FLAGS;
