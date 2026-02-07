/**
 * SSO Routes - Single Sign-On endpoint
 */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

router.get('/config', asyncHandler(async (req: Request, res: Response) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain required' });
  const config = await dbGet<any>(`
    SELECT provider, entity_id, sso_url, certificate FROM sso_configs WHERE domain = ? AND is_active = 1
  `, [domain]);
  if (!config) return res.json({ ssoEnabled: false });
  res.json({ ssoEnabled: true, provider: config.provider, ssoUrl: config.sso_url });
}));

router.post('/saml/callback', asyncHandler(async (req: Request, res: Response) => {
  const { SAMLResponse } = req.body;
  if (!SAMLResponse) return res.status(400).json({ error: 'SAMLResponse required' });
  logger.info('[SSO] SAML callback received');
  // In production, validate SAML assertion
  res.json({ success: true, message: 'SAML authentication processing' });
}));

router.post('/oidc/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state } = req.body;
  if (!code) return res.status(400).json({ error: 'Authorization code required' });
  logger.info('[SSO] OIDC callback received');
  res.json({ success: true, message: 'OIDC authentication processing' });
}));

export default router;
