/**
 * Discovery Agent Manifest Routes (M01 wiring — HP-2/HP-3, read-only).
 *
 * Endpoints:
 * - GET /api/ai/agent-manifests            -> full 31-entry catalog (optional
 *   ?status=built|planned and/or ?wave=wave-1|wave-2|wave-3|reference filters)
 * - GET /api/ai/agent-manifests/:id        -> single manifest by id
 *
 * Read-only, non-executing — mirrors the pattern of the existing
 * `GET /api/ai/agent-audit/agents` registry-list endpoint. Does NOT invoke any
 * agent or LLM call; it only exposes catalog metadata for a future Plan-mode
 * UI. Intentionally NOT wired into `/api/ai/chat/stream` function-calling —
 * see the M01 wiring report for the risk rationale.
 */
import { Router } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { buildPlanFromManifest } from '../../services/ai/agentPlan/planBuilderService.js';
import {
  DiscoveryAgentManifestStatus,
  getDiscoveryAgentManifest,
  listDiscoveryAgentManifests,
} from '../../services/ai/agentRuntime/discoveryAgentManifestCatalog.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

const VALID_STATUSES: readonly DiscoveryAgentManifestStatus[] = ['built', 'planned'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rawStatus = String(req.query?.status || '').trim();
    const status = VALID_STATUSES.includes(rawStatus as DiscoveryAgentManifestStatus)
      ? (rawStatus as DiscoveryAgentManifestStatus)
      : undefined;
    const rawWave = String(req.query?.wave || '').trim();
    const wave = rawWave || undefined;

    const manifests = listDiscoveryAgentManifests({ status, wave });

    // AGT-011: liczba kroków dla zakładki "Szablony" (kolumna "liczba kroków"
    // wspólna dla procesów i gotowych analiz) — używa tego samego
    // PlanBuilder, którego POST /api/ai/agent-plan woła przy manifestId.
    // Addytywne pole — nie zmienia istniejących konsumentów (AgentManifestLauncher).
    const withStepCount = manifests.map((manifest) => ({
      ...manifest,
      stepCount: buildPlanFromManifest(manifest).length,
    }));

    return res.json({
      success: true,
      total: withStepCount.length,
      manifests: withStepCount,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params?.id || '').trim();
    const manifest = id ? getDiscoveryAgentManifest(id) : null;
    if (!manifest) {
      return res.status(404).json({ success: false, error: 'Manifest not found' });
    }
    return res.json({ success: true, manifest });
  })
);

export default router;
