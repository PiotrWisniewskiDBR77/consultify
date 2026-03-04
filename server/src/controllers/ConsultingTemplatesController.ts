import type { Request, Response } from 'express';

import ConsultingTemplatesService from '../services/ConsultingTemplatesService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const firstParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

class ConsultingTemplatesController {
  listTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const lang = firstParam(req.query.lang) || 'en';
    const category = firstParam(req.query.category);
    const search = firstParam(req.query.search);
    const limit = parseInt(firstParam(req.query.limit) || '100', 10);
    const offset = parseInt(firstParam(req.query.offset) || '0', 10);

    const result = await ConsultingTemplatesService.listTemplates({
      lang,
      category,
      search,
      limit,
      offset,
    });

    res.json(result);
  });

  getTemplate = asyncHandler(async (req: Request, res: Response) => {
    const slug = (req.params as any)?.slug as string | undefined;
    const lang = firstParam(req.query.lang) || 'en';
    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const template = await ConsultingTemplatesService.getTemplate(slug, lang);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  });
}

export default new ConsultingTemplatesController();
