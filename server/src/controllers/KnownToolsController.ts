import type { Request, Response } from 'express';

import KnownToolsService from '../services/KnownToolsService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const firstParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

class KnownToolsController {
  listKnownTools = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const lang = firstParam(req.query.lang) || 'en';
    const category = firstParam(req.query.category);
    const search = firstParam(req.query.search);
    const limit = parseInt(firstParam(req.query.limit) || '20', 10);
    const offset = parseInt(firstParam(req.query.offset) || '0', 10);

    const result = await KnownToolsService.listKnownTools({
      lang,
      category,
      search,
      limit,
      offset,
    });

    res.json(result);
  });

  getKnownTool = asyncHandler(async (req: Request, res: Response) => {
    const toolType = (req.params as any)?.toolType as string | undefined;
    const lang = firstParam(req.query.lang) || 'en';
    if (!toolType) {
      return res.status(400).json({ error: 'toolType is required' });
    }

    const tool = await KnownToolsService.getKnownTool(toolType, lang);
    if (!tool) {
      return res.status(404).json({ error: 'Known tool not found' });
    }

    res.json({ tool });
  });
}

export default new KnownToolsController();
