/**
 * pmoDomains Routes
 * API endpoints for PMO Domain Registry and Standards Mapping
 *
 * PMO Standards Compliance (per PMO_STANDARDS_COMPLIANCE.md):
 * - ISO 21500:2021 - Foundation (methodology-neutral)
 * - PMI PMBOK 7th Edition - 8 Performance Domains
 * - PRINCE2 - 7 Themes for governance
 */
import { Response, Router } from 'express';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/**
 * PMO Domains following Consultinity's Meta-PMO Framework
 * Each domain maps to ISO 21500, PMBOK 7, and PRINCE2
 */
const PMO_DOMAINS = [
  {
    id: 'GOVERNANCE_DECISION_MAKING',
    name: 'Governance & Decision Making',
    description: 'Strategic oversight and decision authority structures',
    iso21500Mapping: 'Governance',
    pmbokMapping: 'Stakeholder Performance Domain',
    prince2Mapping: 'Organization Theme',
    status: 'active',
  },
  {
    id: 'SCOPE_CHANGE_CONTROL',
    name: 'Scope & Change Control',
    description: 'Requirements management and change request processing',
    iso21500Mapping: 'Scope Management',
    pmbokMapping: 'Planning Performance Domain',
    prince2Mapping: 'Change Theme',
    status: 'active',
  },
  {
    id: 'SCHEDULE_MILESTONES',
    name: 'Schedule & Milestones',
    description: 'Timeline management, dependencies, and milestone tracking',
    iso21500Mapping: 'Schedule Management',
    pmbokMapping: 'Delivery Performance Domain',
    prince2Mapping: 'Plans Theme',
    status: 'active',
  },
  {
    id: 'RISK_ISSUE_MANAGEMENT',
    name: 'Risk & Issue Management',
    description: 'Risk identification, assessment, and issue resolution',
    iso21500Mapping: 'Risk Management',
    pmbokMapping: 'Uncertainty Performance Domain',
    prince2Mapping: 'Risk Theme',
    status: 'active',
  },
  {
    id: 'RESOURCE_RESPONSIBILITY',
    name: 'Resource & Responsibility',
    description: 'Team allocation, roles, and capacity management',
    iso21500Mapping: 'Resource Management',
    pmbokMapping: 'Team Performance Domain',
    prince2Mapping: 'Organization Theme',
    status: 'active',
  },
  {
    id: 'PERFORMANCE_MONITORING',
    name: 'Performance Monitoring',
    description: 'KPIs, metrics, and progress reporting',
    iso21500Mapping: 'Performance Evaluation',
    pmbokMapping: 'Measurement Performance Domain',
    prince2Mapping: 'Progress Theme',
    status: 'active',
  },
  {
    id: 'BENEFITS_REALIZATION',
    name: 'Benefits Realization',
    description: 'Value tracking and business case validation',
    iso21500Mapping: 'Benefits Realization',
    pmbokMapping: 'Development Approach Performance Domain',
    prince2Mapping: 'Business Case Theme',
    status: 'active',
  },
];

/**
 * Standards mapping structure
 */
const STANDARDS_MAPPING = {
  iso21500: {
    name: 'ISO 21500:2021',
    description: 'Foundation (methodology-neutral)',
    domains: [
      'Governance',
      'Scope Management',
      'Schedule Management',
      'Cost Management',
      'Risk Management',
      'Resource Management',
      'Quality Management',
      'Communications',
      'Procurement',
      'Stakeholder Management',
      'Integration',
      'Benefits Realization',
      'Performance Evaluation',
    ],
  },
  pmbok7: {
    name: 'PMI PMBOK 7th Edition',
    description: '8 Performance Domains',
    domains: [
      'Stakeholder Performance Domain',
      'Team Performance Domain',
      'Development Approach Performance Domain',
      'Planning Performance Domain',
      'Project Work Performance Domain',
      'Delivery Performance Domain',
      'Measurement Performance Domain',
      'Uncertainty Performance Domain',
    ],
  },
  prince2: {
    name: 'PRINCE2',
    description: '7 Themes for governance',
    themes: [
      'Business Case Theme',
      'Organization Theme',
      'Quality Theme',
      'Plans Theme',
      'Risk Theme',
      'Change Theme',
      'Progress Theme',
    ],
  },
};

/**
 * GET /api/pmo-domains
 * List all PMO domains
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      success: true,
      data: PMO_DOMAINS,
    });
  })
);

/**
 * GET /api/pmo-domains/standards-mapping
 * Get standards mapping reference
 */
router.get(
  '/standards-mapping',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      success: true,
      data: STANDARDS_MAPPING,
    });
  })
);

/**
 * GET /api/pmo-domains/projects/:projectId
 * Get project-specific domain configuration
 */
router.get(
  '/projects/:projectId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;

    // Return default domains for project (all active)
    const projectDomains = PMO_DOMAINS.map((domain) => ({
      ...domain,
      projectId,
      isEnabled: true,
      customConfiguration: null,
    }));

    return res.json({
      success: true,
      data: projectDomains,
    });
  })
);

/**
 * GET /api/pmo-domains/:domainId
 * Get single domain details
 */
router.get(
  '/:domainId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { domainId } = req.params;
    const domain = PMO_DOMAINS.find((d) => d.id === domainId);

    if (!domain) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    return res.json({
      success: true,
      data: domain,
    });
  })
);

export default router;
