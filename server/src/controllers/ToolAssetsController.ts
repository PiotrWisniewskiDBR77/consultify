import type { Request, Response } from 'express';

import ToolAssetsService from '../services/ToolAssetsService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class ToolAssetsController {
  getAssetsByTool = asyncHandler(async (req: Request, res: Response) => {
    const toolSlug = (req.params as any)?.toolSlug;
    if (!toolSlug) return res.status(400).json({ error: 'toolSlug is required' });
    const assets = await ToolAssetsService.getAssetsByTool(toolSlug);
    res.json({ assets });
  });

  getAuditReport = asyncHandler(async (_req: Request, res: Response) => {
    const report = await ToolAssetsService.getAuditReport();
    res.json(report);
  });

  updateAssetStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const toolSlug = (req.params as any)?.toolSlug;
    const assetType = (req.params as any)?.assetType;
    if (!toolSlug || !assetType)
      return res.status(400).json({ error: 'toolSlug and assetType are required' });
    const result = await ToolAssetsService.updateAssetStatus(toolSlug, assetType, req.body);
    if (!result) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset: result });
  });
}

export default new ToolAssetsController();
