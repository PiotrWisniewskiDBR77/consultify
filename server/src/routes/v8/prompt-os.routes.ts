import type { Response } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import * as promptOsRuntimeService from '../../services/v8/promptOsRuntimeService.js';
import {
  CreatePresetParamsSchema,
  CreateReleaseBundleParamsSchema,
  EvaluateGateParamsSchema,
  PurposeFamilyValues,
  SetCanaryConfigParamsSchema,
} from '../../types/promptOsRuntime.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

function parseLimit(raw: unknown, fallback: number = 100): number {
  const parsed = Number.parseInt(String(raw ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 500);
}

function handlePromptOsError(
  err: unknown,
  res: Response,
  fallbackMessage: string
): Response | null {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: fallbackMessage,
      code: 'VALIDATION_ERROR',
      details: err.issues,
    });
  }

  if (err instanceof Error) {
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: 'Resource not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    if (err.message.includes('Cannot activate')) {
      return res.status(409).json({
        error: 'Cannot activate in the current state',
        code: 'PROMPT_OS_ACTIVATION_CONFLICT',
      });
    }
    if (err.message.includes('already rolled back')) {
      return res.status(409).json({
        error: 'Already rolled back',
        code: 'PROMPT_OS_ROLLBACK_CONFLICT',
      });
    }
  }

  return null;
}

async function requireBundleForOrg(bundleId: string, organizationId: string, res: Response) {
  const bundle = await promptOsRuntimeService.getBundle(bundleId);
  if (!bundle || bundle.organizationId !== organizationId) {
    res.status(404).json({
      error: `Release bundle ${bundleId} not found`,
      code: 'BUNDLE_NOT_FOUND',
    });
    return null;
  }
  return bundle;
}

router.get(
  '/runtime/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const bundleLimit = parseLimit(req.query.bundleLimit, 200);

    const [presets, bundles] = await Promise.all([
      promptOsRuntimeService.listPresetsByOrganization(organizationId),
      promptOsRuntimeService.listBundlesByOrganization(organizationId, bundleLimit),
    ]);

    const activeBundleCount = bundles.filter((b) => b.status === 'active').length;

    return res.json({
      data: {
        contract: 'prompt-os-runtime-v8',
        purposeFamiliesSupported: PurposeFamilyValues,
        presetCount: presets.length,
        bundleCount: bundles.length,
        activeBundleCount,
      },
      meta: { version: 'v8' },
    });
  })
);

router.get(
  '/presets',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const data = await promptOsRuntimeService.listPresetsByOrganization(organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.get(
  '/presets/:presetId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const preset = await promptOsRuntimeService.getPreset(req.params.presetId, organizationId);
    if (!preset) {
      return res.status(404).json({
        error: `Preset ${req.params.presetId} not found`,
        code: 'PRESET_NOT_FOUND',
      });
    }
    return res.json({ data: preset, meta: { version: 'v8' } });
  })
);

router.post(
  '/presets',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    try {
      const body = { ...req.body, organizationId };
      const parsed = CreatePresetParamsSchema.parse(body);
      const data = await promptOsRuntimeService.createPreset(parsed);
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handlePromptOsError(err, res, 'Invalid preset parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

router.get(
  '/bundles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const limit = parseLimit(req.query.limit, 100);
    const data = await promptOsRuntimeService.listBundlesByOrganization(organizationId, limit);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.get(
  '/bundles/:bundleId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const bundle = await requireBundleForOrg(req.params.bundleId, organizationId, res);
    if (!bundle) return;
    return res.json({ data: bundle, meta: { version: 'v8' } });
  })
);

router.post(
  '/bundles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    try {
      const body = { ...req.body, organizationId };
      const parsed = CreateReleaseBundleParamsSchema.parse(body);
      const preset = await promptOsRuntimeService.getPreset(parsed.presetId, organizationId);
      if (!preset) {
        return res.status(400).json({
          error: `Preset ${parsed.presetId} not found for this organization`,
          code: 'PRESET_NOT_FOUND',
        });
      }
      const data = await promptOsRuntimeService.createReleaseBundle(parsed);
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handlePromptOsError(err, res, 'Invalid release bundle parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/bundles/:bundleId/activate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const bundle = await requireBundleForOrg(req.params.bundleId, organizationId, res);
    if (!bundle) return;

    try {
      const data = await promptOsRuntimeService.activateBundle(bundle.bundleId);
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handlePromptOsError(err, res, 'Activation failed');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/bundles/:bundleId/rollback',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const bundle = await requireBundleForOrg(req.params.bundleId, organizationId, res);
    if (!bundle) return;

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) {
      return res.status(400).json({
        error: 'reason is required',
        code: 'VALIDATION_ERROR',
      });
    }

    try {
      const data = await promptOsRuntimeService.rollbackBundle(bundle.bundleId, reason, userId);
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handlePromptOsError(err, res, 'Rollback failed');
      if (handled) return handled;
      throw err;
    }
  })
);

router.get(
  '/bundles/:bundleId/eval-gates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const bundle = await requireBundleForOrg(req.params.bundleId, organizationId, res);
    if (!bundle) return;

    const data = await promptOsRuntimeService.getGatesByBundle(bundle.bundleId);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/bundles/:bundleId/eval-gates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const bundle = await requireBundleForOrg(req.params.bundleId, organizationId, res);
    if (!bundle) return;

    try {
      const body = { ...req.body, bundleId: bundle.bundleId };
      const parsed = EvaluateGateParamsSchema.parse(body);
      const data = await promptOsRuntimeService.evaluateGate(parsed);
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handlePromptOsError(err, res, 'Invalid eval gate parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

router.get(
  '/bundles/:bundleId/canary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const bundle = await requireBundleForOrg(req.params.bundleId, organizationId, res);
    if (!bundle) return;

    const data = await promptOsRuntimeService.getCanaryConfig(bundle.bundleId);
    if (!data) {
      return res.status(404).json({
        error: `No canary config for bundle ${bundle.bundleId}`,
        code: 'CANARY_NOT_FOUND',
      });
    }
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/bundles/:bundleId/canary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const bundle = await requireBundleForOrg(req.params.bundleId, organizationId, res);
    if (!bundle) return;

    try {
      const body = { ...req.body, bundleId: bundle.bundleId };
      const parsed = SetCanaryConfigParamsSchema.parse(body);
      const data = await promptOsRuntimeService.setCanaryConfig(parsed);
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handlePromptOsError(err, res, 'Invalid canary parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

export default router;
