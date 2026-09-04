/**
 * Public Mini Assessment Routes (T015)
 * Public endpoints for the self-assessment flow — no auth required.
 * Rate limited to prevent abuse.
 */

import { Request, Response, Router } from 'express';

import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import * as miniAssessmentService from '../services/publicMiniAssessmentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';

const router = Router();

router.use(authRateLimiter);

router.get('/health', (_req, res) => {
  res.json({ success: true });
});

router.post(
  '/start',
  asyncHandler(async (req: Request, res: Response) => {
    const { language, templateId, partnerCode, sourceCampaign, utm } = req.body;
    const result = await miniAssessmentService.createAssessment({
      language,
      templateId,
      partnerCode,
      sourceCampaign,
      utmParams: utm,
    });
    res.status(201).json({ success: true, ...result });
  })
);

router.get(
  '/template/:templateId',
  asyncHandler(async (req: Request, res: Response) => {
    const template = miniAssessmentService.getTemplate(String(req.params.templateId));
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  })
);

router.get(
  '/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const assessment = await miniAssessmentService.getAssessmentByToken(token);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const template = miniAssessmentService.getTemplate(assessment.template_id);
    res.json({
      id: assessment.id,
      token: assessment.token,
      status: assessment.status,
      language: assessment.language,
      template,
      answers: assessment.answers_json ? JSON.parse(assessment.answers_json) : [],
      aiResult:
        assessment.status === 'completed' && assessment.ai_result_json
          ? JSON.parse(assessment.ai_result_json)
          : null,
    });
  })
);

router.post(
  '/:token/draft',
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const { answers } = req.body;
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers array is required' });
    }

    try {
      const result = await miniAssessmentService.saveDraftAnswers({
        token,
        answers,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      if (err.message === 'Assessment not found') {
        return res.status(404).json({ ...mapAppErrorResponse(err, req, 'error') });
      }
      if (err.message === 'Assessment already completed') {
        return res.status(409).json({ ...mapAppErrorResponse(err, req, 'error') });
      }
      throw err;
    }
  })
);

router.post(
  '/:token/submit',
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const { answers, respondentEmail, respondentName } = req.body;
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers array is required' });
    }

    const ipAddress =
      req.ip ||
      req.socket?.remoteAddress ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
    const userAgent = req.headers['user-agent'] || '';

    try {
      const result = await miniAssessmentService.submitAnswers({
        token,
        answers,
        respondentEmail,
        respondentName,
        ipAddress,
        userAgent,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      if (err.message === 'Assessment not found')
        return res.status(404).json({ ...mapAppErrorResponse(err, req, 'error') });
      if (err.message === 'Assessment already completed')
        return res.status(409).json({ ...mapAppErrorResponse(err, req, 'error') });
      throw err;
    }
  })
);

export default router;
