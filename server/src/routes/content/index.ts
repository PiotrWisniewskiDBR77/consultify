// @ts-nocheck
/**
 * Content Module Routes Index
 * Exports all content-related routes
 */

import { Router } from 'express';
import emailTemplatesRoutes from './email-templates.routes.js';

const router = Router();

// Mount email templates routes under /emails
router.use('/emails', emailTemplatesRoutes);

export default router;
