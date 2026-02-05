/**
 * AI Suggestions API Routes
 *
 * Endpoints for AI-powered maturity level and technology suggestions
 */

import { NextFunction, Request, Response, Router } from 'express';

import { verifyToken as authenticateToken } from '../middleware/auth.middleware.js';
import { aiSuggestionService } from '../services/aiSuggestionService.js';

const router = Router();

/**
 * POST /api/ai-suggestions/generate
 * Generate AI-powered suggestions based on assessment data
 */
router.post(
  '/generate',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { framework, organizationContext, currentScores, targetScores, focusAreas } = req.body;

      // Validate required fields
      if (!framework || !organizationContext || !currentScores) {
        return res.status(400).json({
          error: 'Missing required fields: framework, organizationContext, currentScores',
        });
      }

      // Validate framework
      const validFrameworks = ['DRD', 'SIRI', 'ADMA'];
      if (!validFrameworks.includes(framework)) {
        return res.status(400).json({
          error: `Invalid framework. Must be one of: ${validFrameworks.join(', ')}`,
        });
      }

      const suggestions = await aiSuggestionService.generateSuggestions({
        framework,
        organizationContext,
        currentScores,
        targetScores,
        focusAreas,
      });

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/ai-suggestions/enhanced
 * Generate AI-enhanced suggestions using LLM
 */
router.post(
  '/enhanced',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        framework,
        organizationContext,
        currentScores,
        targetScores,
        focusAreas,
        additionalContext,
      } = req.body;

      // Validate required fields
      if (!framework || !organizationContext || !currentScores) {
        return res.status(400).json({
          error: 'Missing required fields: framework, organizationContext, currentScores',
        });
      }

      const suggestions = await aiSuggestionService.getAISuggestions(
        {
          framework,
          organizationContext,
          currentScores,
          targetScores,
          focusAreas,
        },
        additionalContext
      );

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/ai-suggestions/technologies
 * Get technology recommendations only
 */
router.post(
  '/technologies',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { framework, organizationContext, currentScores, focusAreas } = req.body;

      if (!framework || !organizationContext || !currentScores) {
        return res.status(400).json({
          error: 'Missing required fields',
        });
      }

      const suggestions = await aiSuggestionService.generateSuggestions({
        framework,
        organizationContext,
        currentScores,
        focusAreas,
      });

      res.json({
        success: true,
        data: {
          technologies: suggestions.technologySuggestions,
          roadmap: suggestions.prioritizedRoadmap,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/ai-suggestions/gap-analysis
 * Get gap analysis only
 */
router.post(
  '/gap-analysis',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { framework, organizationContext, currentScores, targetScores } = req.body;

      if (!framework || !currentScores) {
        return res.status(400).json({
          error: 'Missing required fields',
        });
      }

      const suggestions = await aiSuggestionService.generateSuggestions({
        framework,
        organizationContext: organizationContext || { industry: 'default', size: 'medium' },
        currentScores,
        targetScores,
      });

      res.json({
        success: true,
        data: {
          gapAnalysis: suggestions.gapAnalysis,
          levelSuggestions: suggestions.levelSuggestions,
          overallRecommendation: suggestions.overallRecommendation,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ai-suggestions/benchmarks/:industry/:framework
 * Get industry benchmarks
 */
router.get(
  '/benchmarks/:industry/:framework',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { industry, framework } = req.params;

      // Simplified benchmark data - in production this would come from a database
      const benchmarks: Record<string, Record<string, { average: number; top: number }>> = {
        manufacturing: {
          DRD: { average: 2.3, top: 4.2 },
          SIRI: { average: 2.5, top: 4.5 },
          ADMA: { average: 2.4, top: 4.3 },
        },
        retail: {
          DRD: { average: 2.8, top: 4.5 },
          SIRI: { average: 2.2, top: 3.8 },
          ADMA: { average: 2.6, top: 4.1 },
        },
        healthcare: {
          DRD: { average: 2.5, top: 4.0 },
          SIRI: { average: 2.0, top: 3.5 },
          ADMA: { average: 2.3, top: 3.8 },
        },
        finance: {
          DRD: { average: 3.2, top: 4.8 },
          SIRI: { average: 2.8, top: 4.2 },
          ADMA: { average: 3.0, top: 4.5 },
        },
        logistics: {
          DRD: { average: 2.6, top: 4.3 },
          SIRI: { average: 2.7, top: 4.4 },
          ADMA: { average: 2.8, top: 4.5 },
        },
      };

      const industryData = benchmarks[industry.toLowerCase()] || benchmarks.manufacturing;
      const frameworkData = industryData[framework.toUpperCase()] || industryData.DRD;

      res.json({
        success: true,
        data: {
          industry,
          framework,
          benchmark: frameworkData,
          allIndustries: Object.keys(benchmarks),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ai-suggestions/technology-catalog
 * Get available technology catalog
 */
router.get(
  '/technology-catalog',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category } = req.query;

      // Technology catalog - simplified version
      const catalog = {
        dataManagement: [
          { name: 'Azure Data Lake', category: 'Data Platform', complexity: 'high' },
          { name: 'Apache Kafka', category: 'Data Integration', complexity: 'medium' },
          { name: 'Snowflake', category: 'Data Warehouse', complexity: 'medium' },
        ],
        aiMaturity: [
          { name: 'MLflow', category: 'ML Platform', complexity: 'high' },
          { name: 'Azure OpenAI', category: 'AI Services', complexity: 'low' },
          { name: 'TensorFlow', category: 'ML Framework', complexity: 'high' },
        ],
        processes: [
          { name: 'UiPath', category: 'RPA', complexity: 'medium' },
          { name: 'Camunda', category: 'BPM', complexity: 'medium' },
          { name: 'Power Automate', category: 'Automation', complexity: 'low' },
        ],
        digitalProducts: [
          { name: 'Azure IoT Hub', category: 'IoT Platform', complexity: 'high' },
          { name: 'Azure Digital Twins', category: 'Digital Twin', complexity: 'high' },
          { name: 'PTC ThingWorx', category: 'IoT Platform', complexity: 'high' },
        ],
        culture: [
          { name: 'LinkedIn Learning', category: 'Learning', complexity: 'low' },
          { name: 'Microsoft Teams', category: 'Collaboration', complexity: 'low' },
          { name: 'Miro', category: 'Collaboration', complexity: 'low' },
        ],
      };

      if (category && typeof category === 'string') {
        const categoryData = catalog[category as keyof typeof catalog];
        if (!categoryData) {
          return res.status(404).json({
            error: `Category not found: ${category}`,
            availableCategories: Object.keys(catalog),
          });
        }
        return res.json({
          success: true,
          data: { [category]: categoryData },
        });
      }

      res.json({
        success: true,
        data: catalog,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
