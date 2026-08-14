/**
 * Audits — agregator tras modułu metodycznego.
 *
 * Montowany pod `/api/audits` (liczba mnoga), świadomie obok starszego
 * `/api/audit` (liczba pojedyncza), które obsługuje orkiestrator programów i
 * platformowy dziennik zdarzeń. Rozdzielenie przestrzeni jest celowe: stary
 * prefiks pozostaje działający dla obecnego huba, a nowy niesie kernel
 * metodyczny. Zlanie ich w jeden prefiks wymusiłoby zmianę kontraktu żywego UI
 * w tym samym kroku, w którym powstaje nowy model — a to dwie różne zmiany.
 *
 * Wszystkie podtrasy dziedziczą uwierzytelnienie, dostęp do organizacji i
 * ograniczanie tempa z tego pliku, więc żadna z nich nie może przez pomyłkę
 * wystawić się bez ochrony.
 */

import { Router } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';

import actionsRoutes from './actions.routes.js';
import aiRoutes from './ai.routes.js';
import criteriaRoutes from './criteria.routes.js';
import evidenceRoutes from './evidence.routes.js';
import findingsRoutes from './findings.routes.js';
import outputsRoutes from './outputs.routes.js';
import packsRoutes from './packs.routes.js';
import programsRoutes from './programs.routes.js';
import proposalsRoutes from './proposals.routes.js';
import reportsRoutes from './reports.routes.js';
import sourcesRoutes from './sources.routes.js';
import trailRoutes from './trail.routes.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// Library — źródła i pakiety
router.use('/sources', sourcesRoutes);
router.use('/packs', packsRoutes);

// Processes — programy i praca merytoryczna
router.use('/programs', programsRoutes);
router.use('/criteria', criteriaRoutes);
router.use('/evidence', evidenceRoutes);
router.use('/findings', findingsRoutes);
router.use('/actions', actionsRoutes);

// Outputs / Deliverables / Initiatives
router.use('/outputs', outputsRoutes);
router.use('/reports', reportsRoutes);
router.use('/proposals', proposalsRoutes);

// Teresa i ścieżka audytowa
router.use('/ai', aiRoutes);
router.use('/trail', trailRoutes);

export default router;
