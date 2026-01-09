/**
 * Demo Mode Routes
 * API endpoints for demo mode management
 * 
 * Handles enabling/disabling demo mode and providing demo organization info.
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { 
    DEMO_ORG_ID, 
    DEMO_ORG_NAME,
    getDemoOrganization, 
    getDemoStats,
    setUserDemoPreference,
    checkUserDemoPreference
} from '../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

// ==========================================
// DEMO MODE TOGGLE
// ==========================================

/**
 * POST /api/demo/toggle
 * Toggle demo mode on/off for the current user
 */
router.post(
    '/toggle',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.id;
        const { enabled } = req.body;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Unauthorized' 
            });
        }

        const isDemoEnabled = enabled === true || enabled === 'true' || enabled === 1;

        try {
            // Save preference to database
            await setUserDemoPreference(userId, isDemoEnabled);

            if (isDemoEnabled) {
                // Get demo organization details and stats
                const [demoOrganization, stats] = await Promise.all([
                    getDemoOrganization(),
                    getDemoStats(),
                ]);

                logger.info(`[DemoMode] User ${userId} enabled demo mode`);

                return res.json({
                    success: true,
                    isDemoMode: true,
                    demoOrganization: {
                        id: demoOrganization.id,
                        name: demoOrganization.name,
                        slug: demoOrganization.slug,
                        description: demoOrganization.description,
                        branding: demoOrganization.settings?.branding || {
                            primaryColor: '#6366F1',
                            logo: '/assets/demo/acme-logo.png'
                        }
                    },
                    stats,
                    message: 'Tryb demo włączony. Przeglądasz dane firmy Acme Digital Corp.',
                    hints: [
                        'Wszystkie dane są przykładowe i służą celom szkoleniowym',
                        'Możesz eksplorować wszystkie funkcje systemu',
                        'Zmiany nie są zapisywane - tryb jest tylko do odczytu'
                    ]
                });
            } else {
                logger.info(`[DemoMode] User ${userId} disabled demo mode`);

                return res.json({
                    success: true,
                    isDemoMode: false,
                    message: 'Tryb demo wyłączony. Wróciłeś do swoich danych.'
                });
            }
        } catch (error: any) {
            logger.error('[DemoMode] Error toggling demo mode:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to toggle demo mode',
                message: error.message
            });
        }
    })
);

// ==========================================
// DEMO STATUS
// ==========================================

/**
 * GET /api/demo/status
 * Get current demo mode status for the user
 */
router.get(
    '/status',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Unauthorized' 
            });
        }

        try {
            const isDemoEnabled = await checkUserDemoPreference(userId);
            
            if (isDemoEnabled) {
                const [demoOrganization, stats] = await Promise.all([
                    getDemoOrganization(),
                    getDemoStats(),
                ]);

                return res.json({
                    success: true,
                    isDemoMode: true,
                    demoOrganization: {
                        id: demoOrganization.id,
                        name: demoOrganization.name,
                        slug: demoOrganization.slug,
                        description: demoOrganization.description,
                    },
                    stats,
                });
            } else {
                return res.json({
                    success: true,
                    isDemoMode: false,
                });
            }
        } catch (error: any) {
            logger.error('[DemoMode] Error getting demo status:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get demo status',
                message: error.message
            });
        }
    })
);

// ==========================================
// DEMO ORGANIZATION INFO
// ==========================================

/**
 * GET /api/demo/organization
 * Get demo organization details (public info)
 */
router.get(
    '/organization',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const [demoOrganization, stats] = await Promise.all([
                getDemoOrganization(),
                getDemoStats(),
            ]);

            return res.json({
                success: true,
                organization: {
                    id: DEMO_ORG_ID,
                    name: DEMO_ORG_NAME,
                    slug: 'acme-demo',
                    industry: 'Manufacturing & Technology',
                    size: '500-1000 employees',
                    region: 'Europe',
                    description: 'Firma demonstracyjna pokazująca pełne możliwości systemu Consultinity',
                    branding: {
                        primaryColor: '#6366F1',
                        secondaryColor: '#8B5CF6',
                        logo: '/assets/demo/acme-logo.png'
                    }
                },
                stats,
                scenarios: [
                    {
                        name: 'Transformacja Cyfrowa',
                        description: 'Pełny cykl projektu transformacji z inicjatywami, zadaniami i korzyściami',
                        highlight: 'Jak planować i realizować transformację'
                    },
                    {
                        name: 'Ocena Dojrzałości',
                        description: 'Przykładowe wyniki DRD, SIRI i innych frameworków',
                        highlight: 'Jak interpretować wyniki assessment'
                    },
                    {
                        name: 'Śledzenie Korzyści',
                        description: 'Realizacja ROI i zarządzanie korzyściami',
                        highlight: 'Jak mierzyć wartość biznesową'
                    }
                ]
            });
        } catch (error: any) {
            logger.error('[DemoMode] Error getting demo organization:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get demo organization',
                message: error.message
            });
        }
    })
);

// ==========================================
// DEMO TOURS (Educational Guides)
// ==========================================

/**
 * GET /api/demo/tours
 * Get available guided tours for demo mode
 */
router.get(
    '/tours',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const tours = [
            {
                id: 'onboarding',
                name: 'Pierwsze Kroki',
                description: 'Poznaj podstawy platformy Consultinity',
                duration: '5 min',
                steps: 8,
                category: 'beginner'
            },
            {
                id: 'project-management',
                name: 'Zarządzanie Projektem',
                description: 'Jak tworzyć i zarządzać projektami transformacji',
                duration: '10 min',
                steps: 12,
                category: 'core'
            },
            {
                id: 'assessment',
                name: 'Ocena Dojrzałości',
                description: 'Jak przeprowadzić i interpretować ocenę DRD',
                duration: '8 min',
                steps: 10,
                category: 'core'
            },
            {
                id: 'initiatives',
                name: 'Inicjatywy i Roadmapa',
                description: 'Planowanie i śledzenie inicjatyw transformacji',
                duration: '7 min',
                steps: 9,
                category: 'core'
            },
            {
                id: 'benefits',
                name: 'Śledzenie Korzyści',
                description: 'Jak mierzyć ROI i realizację korzyści',
                duration: '6 min',
                steps: 7,
                category: 'advanced'
            },
            {
                id: 'ai-assistant',
                name: 'AI Konsultant',
                description: 'Jak efektywnie korzystać z AI w konsultingu',
                duration: '8 min',
                steps: 10,
                category: 'advanced'
            }
        ];

        return res.json({
            success: true,
            tours,
            categories: {
                beginner: 'Początkujący',
                core: 'Podstawowe',
                advanced: 'Zaawansowane'
            }
        });
    })
);

export default router;
