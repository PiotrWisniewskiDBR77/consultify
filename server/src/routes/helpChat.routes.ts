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
import { buildHelpDocsContext, isProductOrHowToQuery } from '../services/ai/helpDocsContext.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

// ==================== VALIDATORS ====================

const HelpChatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.string().optional(),
  language: z
    .string()
    .transform((lang) => {
      if (!lang) return 'en';
      const base = lang.split('-')[0].toLowerCase();
      // 'jp' accepted for one release as a legacy input alias (S23-LOCALE,
      // 2026-08-12: 'jp' was not valid BCP47 for Japanese, migrated to 'ja').
      const mappedBase = base === 'jp' ? 'ja' : base;
      const validLangs = ['pl', 'en', 'de', 'es', 'ja', 'ar'];
      return validLangs.includes(mappedBase) ? mappedBase : 'en';
    })
    .optional(),
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
    const { message, context, history, language } = req.body;

    try {
      // Get AI Pipeline
      const aiPipeline = await import('../services/ai/AIPipeline.js').then((m) => {
        const AIPipelineClass = (m as any).AIPipeline;
        return new AIPipelineClass();
      });

      // Retrieve relevant KB docs and inject into system instruction (kept compact)
      const kb = await buildHelpDocsContext({
        query: message,
        moduleId: context || null,
        surface: 'help',
        maxArticles: 3,
        maxCharsPerArticle: 1200,
      });

      const isProduct = kb.isProductQuestion || isProductOrHowToQuery(message);

      // Build system prompt with citation policy awareness and language instruction
      let systemPrompt = buildHelpSystemPrompt(context, isProduct, language);
      if (kb.systemInstructionAddon) {
        systemPrompt += kb.systemInstructionAddon;
      }

      // When no KB docs matched a product question, append explicit fallback instruction
      if (isProduct && kb.citations.length === 0) {
        systemPrompt +=
          '\n\nIMPORTANT: No matching documentation was found for this product question. ' +
          'Acknowledge that the docs do not cover this topic yet, then help from general platform knowledge. ' +
          'Do NOT invent documentation links or article names.\n';
      }

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
      const ragSources = extractSources(response);
      const kbSources = (kb.citations || []).map((c) => ({
        id: c.id,
        type: 'kb',
        title: c.title,
        link: c.link,
      }));
      const sources = [...kbSources, ...ragSources].filter(Boolean);

      logger.info(`[HelpChat] User ${req.userId} asked: "${message.slice(0, 50)}..."`);

      return res.json({
        message: responseText,
        sources,
        isProductQuestion: isProduct,
      });
    } catch (err: any) {
      logger.error('[HelpChat] Error:', err);
      return res.status(500).json({
        error: 'HelpChat request failed',
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
      logger.info(
        `[HelpFeedback] User ${req.userId} - ${content_type}:${content_id} - helpful: ${is_helpful}`,
        {
          comment,
        }
      );

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[HelpFeedback] Error', { err, correlationId: (req as any).correlationId });
      return res
        .status(500)
        .json({ error: 'Failed to submit feedback', code: 'HELP_FEEDBACK_SUBMIT_FAILED' });
    }
  })
);

// ==================== MODULE KNOWLEDGE BASE ====================

/**
 * Module context hints — used ONLY as lightweight orientation when no KB articles match.
 * These are NOT authoritative product documentation; the system prompt must treat them
 * as "[Platform context — not a KB source]" so the model never cites them as documentation.
 */
const MODULE_CONTEXT_HINTS: Record<string, string> = {
  dashboard: 'Central command center: transformation progress, KPIs, quick actions.',
  assessment: 'AI-powered digital maturity assessment (CMMI, LEAN, Industry 4.0 frameworks).',
  initiatives: 'Create and manage transformation initiatives with lifecycle tracking.',
  roadmap: 'Strategic timeline with milestones, dependencies, and scheduling.',
  reports: 'Generate management reports and status updates.',
  settings: 'Profile, organization settings, billing, security.',
  ai_chat: 'Interactive AI assistant for data analysis, recommendations.',
};

// ==================== HELPER FUNCTIONS ====================

function buildHelpSystemPrompt(
  context?: string,
  isProductQuestion?: boolean,
  language?: string
): string {
  const languageMap: Record<string, string> = {
    pl: 'Polish (Polski)',
    en: 'English',
    de: 'German (Deutsch)',
    es: 'Spanish (Español)',
    ja: 'Japanese (日本語)',
    jp: 'Japanese (日本語)',
    ar: 'Arabic (العربية)',
  };
  const langCode = (language || 'en').split('-')[0];
  const langName = languageMap[langCode] || 'English';

  const basePrompt = `You are Teresa, the Consultify Help Assistant — an AI-powered guide for the Consultify enterprise PMO platform.

ROLE: Help users understand features, troubleshoot issues, and maximize platform value.

PLATFORM OVERVIEW:
Consultify is an enterprise PMO (Project Management Office) platform for digital transformation. It combines:
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
- Adapt tone to user's apparent expertise level

CITATION POLICY:
- When KB documentation is provided, cite relevant articles inline as [KB1], [KB2], etc.
- Only cite articles that actually appear in the KB context below.
- NEVER fabricate documentation URLs, article titles, or menu paths.
- If documentation does not cover the question, clearly state: "Our documentation does not cover this topic yet."

[LANGUAGE INSTRUCTION: You MUST always respond in ${langName}. This is the user's chosen application language and takes absolute priority. Even if the user writes their message in a different language, your response must be in ${langName}. This is non-negotiable.]`;

  if (context && MODULE_CONTEXT_HINTS[context.toLowerCase()]) {
    return `${basePrompt}

CURRENT CONTEXT: User is in the ${context.toUpperCase()} module.
[Platform context — not a KB source]: ${MODULE_CONTEXT_HINTS[context.toLowerCase()]}
Focus your answers on this module. Only cite KB articles ([KB1], [KB2], …) that appear in the knowledge base section below.`;
  }

  return basePrompt;
}

function extractSources(response: any): Array<{ id: string; type: string; title: string }> {
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

function getErrorMessage(_context?: string): string {
  return 'I apologize, but I encountered an error while processing your question. Please try again or contact support if the issue persists.';
}

export default router;
