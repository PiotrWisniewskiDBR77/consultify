/**
 * Help Chat Routes
 * AI-powered help assistant using knowledge base
 *
 * Endpoints:
 * - POST /api/help/chat - Send message to help chatbot
 * - POST /api/help/feedback - Submit feedback for response
 */

import { Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

// ==================== VALIDATORS ====================

const HelpChatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
});

const HelpFeedbackSchema = z.object({
  content_type: z.enum(['chat', 'article', 'faq']),
  content_id: z.string(),
  is_helpful: z.boolean(),
  comment: z.string().optional(),
});

// ==================== HELP CHAT ====================

router.post(
  '/chat',
  verifyToken,
  validateBody(HelpChatMessageSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { message, context, history } = req.body;

    try {
      // Get AI Pipeline
      const aiPipeline = await import('../services/ai/AIPipeline.js').then((m) => {
        const AIPipelineClass = (m as any).AIPipeline;
        return new AIPipelineClass();
      });

      // Build system prompt for help context
      const systemPrompt = buildHelpSystemPrompt(context);

      // Format conversation history
      const formattedHistory = (history || []).map((h: { role: string; content: string }) => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content,
      }));

      // Call AI with help knowledge context
      const response = await aiPipeline.process({
        type: 'chat',
        capability: 'help',
        userId: req.userId!,
        organizationId: req.organizationId!,
        prompt: message,
        messages: formattedHistory,
        options: {
          systemInstruction: systemPrompt,
        },
        stream: false,
      });

      const responseText = (response as any).text || (response as any).content || '';

      // Extract sources if RAG was used
      const sources = extractSources(response);

      logger.info(`[HelpChat] User ${req.userId} asked: "${message.slice(0, 50)}..."`);

      return res.json({
        message: responseText,
        sources,
      });
    } catch (err: any) {
      logger.error('[HelpChat] Error:', err);
      return res.status(500).json({
        error: err.message,
        message: getErrorMessage(req.body.context),
      });
    }
  })
);

// ==================== HELP FEEDBACK ====================

router.post(
  '/feedback',
  verifyToken,
  validateBody(HelpFeedbackSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { content_type, content_id, is_helpful, comment } = req.body;

    try {
      // Log feedback (could be stored in database for analysis)
      logger.info(
        `[HelpFeedback] User ${req.userId} - ${content_type}:${content_id} - helpful: ${is_helpful}`,
        {
          comment,
        }
      );

      // Optionally store in database
      // await dbRun(`
      //     INSERT INTO help_feedback (user_id, content_type, content_id, is_helpful, comment, created_at)
      //     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      // `, [req.userId, content_type, content_id, is_helpful, comment || null]);

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[HelpFeedback] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ==================== MODULE KNOWLEDGE BASE ====================

const MODULE_KNOWLEDGE: Record<
  string,
  { description: string; features: string[]; tips: string[] }
> = {
  dashboard: {
    description:
      'The central command center showing transformation progress, KPIs, and quick actions.',
    features: [
      'Real-time transformation maturity score',
      'Initiative progress tracking with status indicators',
      'Active assessment status overview',
      'Recent activity timeline',
      'Quick access to pending tasks',
      'AI-powered insights and recommendations',
    ],
    tips: [
      'Click on any card to see detailed information',
      'Use the AI Command tab to ask questions about your data',
      'Generate PDF reports directly from the Report tab',
      'Customize visible widgets in Settings > Preferences',
    ],
  },
  assessment: {
    description:
      'AI-powered digital maturity assessment using industry frameworks (CMMI, LEAN, Industry 4.0).',
    features: [
      'Multi-framework assessment (CMMI, LEAN 4.0, ISO standards)',
      'Automated maturity scoring with AI analysis',
      'Gap analysis and improvement recommendations',
      'Benchmark comparison with industry standards',
      'Historical trend tracking',
    ],
    tips: [
      'Complete all sections for accurate maturity scoring',
      'Use the AI Assistant to explain technical terms',
      'Export assessments as PDF for stakeholder presentations',
      'Schedule regular re-assessments to track progress',
    ],
  },
  initiatives: {
    description:
      'Create and manage digital transformation initiatives with full lifecycle tracking.',
    features: [
      'Initiative creation with AI-suggested templates',
      'Stage-gate workflow management',
      'Resource allocation and budget tracking',
      'Risk and dependency management (RAID log)',
      'KPI tracking and milestone management',
      'Team assignment and collaboration',
    ],
    tips: [
      'Start with Quick Assessment results to prioritize initiatives',
      'Link related initiatives to track dependencies',
      'Use templates for common transformation patterns',
      'Set clear success criteria before starting execution',
    ],
  },
  roadmap: {
    description:
      'Strategic planning timeline showing all initiatives, milestones, and dependencies.',
    features: [
      'Visual timeline with drag-and-drop scheduling',
      'Dependency visualization',
      'Resource conflict detection',
      'Milestone tracking across initiatives',
      'AI-powered schedule optimization',
    ],
    tips: [
      'Zoom in/out to see different time horizons',
      'Click on initiatives to see details',
      'Use AI optimization to resolve scheduling conflicts',
      'Export roadmap for executive presentations',
    ],
  },
  reports: {
    description: 'Generate comprehensive management reports and status updates.',
    features: [
      'Automated report generation',
      'Executive summary dashboards',
      'Custom report templates',
      'Scheduled report delivery',
      'Multi-format export (PDF, PowerPoint, Excel)',
    ],
    tips: [
      'Schedule weekly reports for stakeholders',
      'Use templates for consistent formatting',
      'Include AI insights for recommendations',
    ],
  },
  settings: {
    description: 'Configure your profile, organization settings, and preferences.',
    features: [
      'Profile management',
      'Organization settings',
      'Billing and subscription',
      'Security settings (MFA, sessions)',
      'Notification preferences',
      'Integration configuration',
    ],
    tips: [
      'Enable two-factor authentication for security',
      'Configure notifications to stay informed',
      'Review billing usage regularly',
    ],
  },
  ai_chat: {
    description: 'Interactive AI assistant for data analysis, recommendations, and automation.',
    features: [
      'Natural language queries about your data',
      'Context-aware recommendations',
      'Document analysis and summarization',
      'Code and report generation',
      'Integration with all platform modules',
    ],
    tips: [
      'Be specific in your questions for better results',
      'Reference specific initiatives or assessments',
      'Use follow-up questions to drill down',
      'Ask for explanations if AI responses are unclear',
    ],
  },
};

// ==================== HELPER FUNCTIONS ====================

function buildHelpSystemPrompt(context?: string): string {
  const basePrompt = `You are the Consultinity Help Assistant, an AI-powered guide for the Consultinity enterprise PMO platform.

ROLE: Help users understand features, troubleshoot issues, and maximize platform value.

PLATFORM OVERVIEW:
Consultinity is an enterprise PMO (Project Management Office) platform for digital transformation. It combines:
- AI-powered assessments using CMMI, LEAN, ISO frameworks
- Initiative lifecycle management with stage-gate workflows
- Strategic roadmap planning and visualization
- Executive dashboards and reporting
- Team collaboration and resource management

KEY MODULES:
1. Dashboard - Central command center with KPIs and insights
2. Assessment Hub - Multi-framework maturity assessments
3. Initiatives - Project portfolio management
4. Roadmap - Strategic timeline visualization
5. Reports - Automated management reporting
6. Settings - Profile and organization configuration
7. AI Chat - Intelligent assistant for data analysis

COMMUNICATION STYLE:
- Be concise, professional, and actionable
- Use step-by-step instructions when explaining processes
- Reference specific UI elements (e.g., "Click the blue '+' button in the top right")
- Provide keyboard shortcuts when relevant
- If uncertain, acknowledge it and suggest alternatives
- Adapt tone to user's apparent expertise level`;

  if (context && MODULE_KNOWLEDGE[context.toLowerCase()]) {
    const module = MODULE_KNOWLEDGE[context.toLowerCase()];
    return `${basePrompt}

CURRENT CONTEXT: User is in the ${context.toUpperCase()} module.

MODULE DETAILS:
${module.description}

Key Features:
${module.features.map((f) => `• ${f}`).join('\n')}

Pro Tips:
${module.tips.map((t) => `💡 ${t}`).join('\n')}

Focus your answers on this module's functionality. Reference related modules when helpful.`;
  }

  return basePrompt;
}

function extractSources(response: any): Array<{ id: string; type: string; title: string }> {
  // Extract sources from RAG response if available
  const sources: Array<{ id: string; type: string; title: string }> = [];

  if (response.sources && Array.isArray(response.sources)) {
    for (const source of response.sources) {
      sources.push({
        id: source.id || `source-${Date.now()}`,
        type: source.type || 'help',
        title: source.title || source.name || 'Help article',
      });
    }
  }

  // Check for citations in metadata
  if (response.metadata?.citations) {
    for (const citation of response.metadata.citations) {
      sources.push({
        id: citation.id,
        type: citation.type || 'help',
        title: citation.title,
      });
    }
  }

  return sources;
}

function getErrorMessage(context?: string): string {
  // Return appropriate error message based on language
  // In production, this would use i18n
  return 'I apologize, but I encountered an error while processing your question. Please try again or contact support if the issue persists.';
}

export default router;
