/**
 * WhatsApp Service Proxy
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Standardized PascalCase wrapper for WhatsAppService
 */

import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadWhatsAppService = createCachedLazyService('../../services/whatsappService.js');

/**
 * Export a proxy object that awaits the service on each call.
 */
const WhatsAppService = {
    sendNewFeedbackAlert: async (data: { userId?: string; userEmail?: string; type: string; message: string }) => {
        const service = await loadWhatsAppService();
        return (service as any).sendNewFeedbackAlert(data);
    },
    sendNotification: async (to: string, template: string, vars: any) => {
        const service = await loadWhatsAppService();
        return (service as any).sendNotification(to, template, vars);
    }
};

export default WhatsAppService;
