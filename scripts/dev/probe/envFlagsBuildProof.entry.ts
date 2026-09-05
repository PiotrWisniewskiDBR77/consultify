/**
 * Probnik build-time dla scripts/check-flags-env-static.mjs (dyzur 2026-09-05).
 *
 * NIE jest importowany przez zadną trase aplikacji — istnieje wyłącznie po
 * to, żeby check-flags-env-static.mjs mógł zbudować go esbuildem (bundle,
 * platform browser, `--define:import.meta.env=...`) i sprawdzić, że TRZY
 * naprawione flagi (jeden per rodzaj rozstrzygania w readme dyżuru:
 * prosty `parsed === null ? false : parsed`, `?? ... ?? false` z cache,
 * i `?? ... ?? false` bez cache) faktycznie odczytują `import.meta.env`
 * po zbudowaniu — nie tylko w `vitest` (który ma inny mechanizm wstrzykiwania
 * `import.meta.env` niż `vite build`/esbuild produkcyjny).
 */
import { isAssessmentDocxEnabled } from '../../../src/utils/assessmentDocxFlag';
import { isFinanceValuePanelsEnabled } from '../../../src/utils/financeValuePanelsFlag';
import { isInitiativeBridgeEnabled } from '../../../src/utils/initiativeBridgeFlag';

(globalThis as unknown as { __ENV_FLAGS_PROBE_RESULT__?: unknown }).__ENV_FLAGS_PROBE_RESULT__ = {
  assessmentDocx: isAssessmentDocxEnabled(),
  financeValuePanels: isFinanceValuePanelsEnabled(),
  initiativeBridge: isInitiativeBridgeEnabled(),
};
