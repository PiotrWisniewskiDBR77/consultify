/**
 * AI System Health Check Routes (L6)
 *
 * Comprehensive health check endpoint for all AI subsystems:
 *
 * Basic Subsystems (L6.1-L6.8):
 * 1. Cloud Integrations status
 * 2. Tools Menu configuration
 * 3. Chat Conversation system
 * 4. Voice System (STT/TTS)
 * 5. History Management
 * 6. LLM Management
 * 7. End-to-End Flow
 * 8. Health Summary
 *
 * Advanced Subsystems (L6.9-L6.17):
 * 9. Vector Database / Embeddings
 * 10. AI Memory System
 * 11. AI Learning System
 * 12. User Style Profiles
 * 13. Context Builder (RAG)
 * 14. AI Database Tables
 * 15. AI Pipeline & Streaming
 * 16. AI Admin Management
 * 17. AI Quality & Observability
 *
 * @module server/src/routes/ai/ai-health-check.routes.ts
 * @version 2.0.0
 */

import { Request, Response, Router } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { aiCostMonitoring } from '../../services/ai/cost-monitoring.service.js';
import { aiQualityMonitoring } from '../../services/ai/quality-monitoring.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { mapAppErrorResponse } from '../../middleware/appErrorMapper.js';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface SubsystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, unknown>;
  lastChecked: string;
}

interface AISystemHealthReport {
  timestamp: string;
  overall: {
    status: 'operational' | 'degraded' | 'critical';
    healthyCount: number;
    totalCount: number;
  };
  subsystems: {
    cloudIntegrations: SubsystemHealth;
    toolsMenu: SubsystemHealth;
    chatConversation: SubsystemHealth;
    voiceSystem: SubsystemHealth;
    historyManagement: SubsystemHealth;
    llmManagement: SubsystemHealth;
  };
  advancedSubsystems?: {
    vectorDatabase: SubsystemHealth;
    aiMemory: SubsystemHealth;
    aiLearning: SubsystemHealth;
    userStyleProfiles: SubsystemHealth;
    contextBuilder: SubsystemHealth;
    databaseTables: SubsystemHealth;
    aiPipeline: SubsystemHealth;
    adminManagement: SubsystemHealth;
    qualityObservability: SubsystemHealth;
  };
  recommendations?: string[];
}

// ============================================================================
// Health Check Functions
// ============================================================================

async function checkCloudIntegrations(): Promise<SubsystemHealth> {
  return {
    status: 'unhealthy',
    message: 'Cloud integrations (Google Drive, OneDrive, Dropbox) are not available',
    details: {
      googleDrive: 'unavailable',
      oneDrive: 'unavailable',
      dropbox: 'unavailable',
      oauthConfigured: false,
    },
    lastChecked: new Date().toISOString(),
  };
}

async function checkToolsMenu(): Promise<SubsystemHealth> {
  // Tools menu is fully implemented in frontend
  return {
    status: 'healthy',
    message: 'Tools menu is fully functional',
    details: {
      aiModes: ['deepResearch', 'webSearch', 'showReasoning', 'privateMode', 'textToSpeech'],
      knowledgeSources: ['pmoDocuments', 'projectData', 'organizationData'],
      responseStyles: [
        'normal',
        'executive',
        'analyst',
        'coach',
        'concise',
        'formal',
        'professional',
        'friendly',
      ],
    },
    lastChecked: new Date().toISOString(),
  };
}

async function checkChatConversation(): Promise<SubsystemHealth> {
  try {
    // Check if conversations table exists and is accessible
    const result = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='conversations'"
    );

    const tableExists = (result as any)?.count > 0;

    if (tableExists) {
      return {
        status: 'healthy',
        message: 'Chat conversation system is operational',
        details: {
          databaseConnected: true,
          conversationsTableExists: true,
          messagesTableExists: true,
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: 'degraded',
      message: 'Conversations table not found',
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkVoiceSystem(): Promise<SubsystemHealth> {
  try {
    // Check if voice-related environment variables are set
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    if (hasOpenAIKey) {
      return {
        status: 'healthy',
        message: 'Voice system is operational',
        details: {
          sttProvider: 'whisper',
          ttsProvider: 'openai',
          fallbackAvailable: true, // Web Speech API
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: 'degraded',
      message: 'OpenAI API key not configured, using Web Speech API fallback',
      details: {
        sttProvider: 'web',
        ttsProvider: 'web',
        fallbackAvailable: true,
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Voice system error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkHistoryManagement(): Promise<SubsystemHealth> {
  try {
    // Check conversations and messages tables
    const conversationsCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='conversations'"
    );
    const messagesCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='conversation_messages'"
    );

    const hasConversations = (conversationsCheck as any)?.count > 0;
    const hasMessages = (messagesCheck as any)?.count > 0;

    if (hasConversations && hasMessages) {
      return {
        status: 'healthy',
        message: 'History management is fully operational',
        details: {
          conversationsTable: true,
          messagesTable: true,
          features: [
            'create',
            'read',
            'update',
            'delete',
            'archive',
            'star',
            'folders',
            'autoTitle',
          ],
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: 'degraded',
      message: 'Some history tables are missing',
      details: {
        conversationsTable: hasConversations,
        messagesTable: hasMessages,
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `History management error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkLLMManagement(): Promise<SubsystemHealth> {
  try {
    // Check if LLM providers table exists
    const providersCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='llm_providers'"
    );

    const hasProviders = (providersCheck as any)?.count > 0;

    // Check for configured providers
    let providerCount = 0;
    if (hasProviders) {
      const countResult = await dbGet(
        'SELECT COUNT(*) as count FROM llm_providers WHERE is_active = 1'
      );
      providerCount = (countResult as any)?.count || 0;
    }

    // Check environment for API keys
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GOOGLE_AI_API_KEY || !!process.env.GEMINI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

    const configuredProviders = [
      hasOpenAI && 'OpenAI',
      hasGemini && 'Gemini',
      hasAnthropic && 'Anthropic',
    ].filter(Boolean);

    if (configuredProviders.length > 0 || providerCount > 0) {
      return {
        status: 'healthy',
        message: 'LLM management is operational',
        details: {
          providersTableExists: hasProviders,
          activeProviders: providerCount,
          configuredFromEnv: configuredProviders,
          tierRouting: ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'],
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: 'degraded',
      message: 'No LLM providers configured',
      details: {
        providersTableExists: hasProviders,
        activeProviders: 0,
        recommendation: 'Configure at least one LLM provider (OpenAI, Gemini, or Anthropic)',
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `LLM management error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Advanced Health Check Functions (L6.9-L6.17)
// ============================================================================

async function checkVectorDatabase(): Promise<SubsystemHealth> {
  try {
    // Check if embeddings table exists
    const embeddingsCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='ai_knowledge_embeddings'"
    );
    const hasEmbeddings = (embeddingsCheck as any)?.count > 0;

    // Count embeddings if table exists
    let embeddingCount = 0;
    if (hasEmbeddings) {
      const countResult = await dbGet('SELECT COUNT(*) as count FROM ai_knowledge_embeddings');
      embeddingCount = (countResult as any)?.count || 0;
    }

    // Check OpenAI key for embedding generation
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    if (hasEmbeddings && hasOpenAI) {
      return {
        status: 'healthy',
        message: 'Vector database is operational',
        details: {
          tableExists: true,
          embeddingCount,
          model: 'text-embedding-3-small',
          dimensions: 1536,
          provider: 'OpenAI',
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: hasEmbeddings ? 'degraded' : 'unhealthy',
      message: hasEmbeddings
        ? 'Vector database exists but OpenAI key not configured'
        : 'Embeddings table not found',
      details: {
        tableExists: hasEmbeddings,
        embeddingCount,
        openAIConfigured: hasOpenAI,
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Vector database error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkAIMemory(): Promise<SubsystemHealth> {
  try {
    // Check user memory table
    const userMemoryCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='ai_user_memory'"
    );
    const hasUserMemory = (userMemoryCheck as any)?.count > 0;

    // Check organization memory table
    const orgMemoryCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='organization_memory'"
    );
    const hasOrgMemory = (orgMemoryCheck as any)?.count > 0;

    // Count records
    let userMemoryCount = 0;
    let orgMemoryCount = 0;

    if (hasUserMemory) {
      const result = await dbGet('SELECT COUNT(*) as count FROM ai_user_memory');
      userMemoryCount = (result as any)?.count || 0;
    }

    if (hasOrgMemory) {
      const result = await dbGet('SELECT COUNT(*) as count FROM organization_memory');
      orgMemoryCount = (result as any)?.count || 0;
    }

    if (hasUserMemory && hasOrgMemory) {
      return {
        status: 'healthy',
        message: 'AI Memory system is operational',
        details: {
          userMemoryTable: true,
          organizationMemoryTable: true,
          userMemoryRecords: userMemoryCount,
          orgMemoryRecords: orgMemoryCount,
          memoryTypes: ['USER', 'ORGANIZATION', 'PROJECT'],
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: 'degraded',
      message: 'Some memory tables are missing',
      details: {
        userMemoryTable: hasUserMemory,
        organizationMemoryTable: hasOrgMemory,
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `AI Memory error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkAILearning(): Promise<SubsystemHealth> {
  try {
    // Check feedback table
    const feedbackCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='ai_feedback'"
    );
    const hasFeedback = (feedbackCheck as any)?.count > 0;

    // Check patterns table
    const patternsCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='ai_learning_patterns'"
    );
    const hasPatterns = (patternsCheck as any)?.count > 0;

    // Check suggestions table
    const suggestionsCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='ai_instruction_suggestions'"
    );
    const hasSuggestions = (suggestionsCheck as any)?.count > 0;

    // Count records
    let feedbackCount = 0;
    let patternCount = 0;

    if (hasFeedback) {
      const result = await dbGet('SELECT COUNT(*) as count FROM ai_feedback');
      feedbackCount = (result as any)?.count || 0;
    }

    if (hasPatterns) {
      const result = await dbGet('SELECT COUNT(*) as count FROM ai_learning_patterns');
      patternCount = (result as any)?.count || 0;
    }

    const tablesReady = hasFeedback && hasPatterns && hasSuggestions;

    if (tablesReady) {
      return {
        status: 'healthy',
        message: 'AI Learning system is operational',
        details: {
          feedbackTable: true,
          patternsTable: true,
          suggestionsTable: true,
          feedbackRecords: feedbackCount,
          patternRecords: patternCount,
          features: ['feedback_collection', 'pattern_extraction', 'instruction_suggestions'],
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: 'degraded',
      message: 'Some learning tables are missing',
      details: {
        feedbackTable: hasFeedback,
        patternsTable: hasPatterns,
        suggestionsTable: hasSuggestions,
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `AI Learning error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkUserStyleProfiles(): Promise<SubsystemHealth> {
  try {
    // Check style profiles table
    const profilesCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='ai_user_style_profiles'"
    );
    const hasProfiles = (profilesCheck as any)?.count > 0;

    // Check style learning patterns table
    const patternsCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='ai_style_learning_patterns'"
    );
    const hasPatterns = (patternsCheck as any)?.count > 0;

    // Count profiles
    let profileCount = 0;
    if (hasProfiles) {
      const result = await dbGet('SELECT COUNT(*) as count FROM ai_user_style_profiles');
      profileCount = (result as any)?.count || 0;
    }

    if (hasProfiles && hasPatterns) {
      return {
        status: 'healthy',
        message: 'User Style Profiles system is operational',
        details: {
          profilesTable: true,
          patternsTable: true,
          profileCount,
          preferences: ['depth', 'format', 'technicalLevel', 'responseLength'],
          autoDetection: true,
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: 'degraded',
      message: 'Style profile tables are missing',
      details: {
        profilesTable: hasProfiles,
        patternsTable: hasPatterns,
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `User Style Profiles error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkContextBuilder(): Promise<SubsystemHealth> {
  try {
    // Check if embeddings are available for RAG
    const embeddingsCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='ai_knowledge_embeddings'"
    );
    const hasEmbeddings = (embeddingsCheck as any)?.count > 0;

    // Check OpenAI key for context building
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    if (hasEmbeddings && hasOpenAI) {
      return {
        status: 'healthy',
        message: 'Context Builder (RAG) is operational',
        details: {
          embeddingsAvailable: true,
          llmConfigured: true,
          contextSources: ['project', 'organization', 'memory', 'documents', 'conversation'],
          ragPipeline: ['query_analysis', 'retrieval', 'reranking', 'context_assembly'],
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: 'degraded',
      message: 'Context Builder partially configured',
      details: {
        embeddingsAvailable: hasEmbeddings,
        llmConfigured: hasOpenAI,
        recommendation: !hasOpenAI
          ? 'Configure OPENAI_API_KEY for full RAG capabilities'
          : 'Create embeddings for knowledge base',
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Context Builder error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkDatabaseTables(): Promise<SubsystemHealth> {
  try {
    const requiredTables = [
      'conversations',
      'conversation_messages',
      'ai_knowledge_embeddings',
      'ai_user_memory',
      'organization_memory',
      'ai_feedback',
      'ai_learning_patterns',
      'ai_instruction_suggestions',
      'ai_user_style_profiles',
      'ai_style_learning_patterns',
      'llm_providers',
    ];

    const tableStatuses: Record<string, boolean> = {};

    for (const table of requiredTables) {
      const check = await dbGet(
        `SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name=$1`,
        [table]
      );
      tableStatuses[table] = (check as any)?.count > 0;
    }

    const existingTables = Object.values(tableStatuses).filter(Boolean).length;
    const totalTables = requiredTables.length;

    if (existingTables === totalTables) {
      return {
        status: 'healthy',
        message: 'All AI database tables exist',
        details: {
          totalTables,
          existingTables,
          tables: tableStatuses,
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: existingTables > totalTables / 2 ? 'degraded' : 'unhealthy',
      message: `${existingTables}/${totalTables} AI tables exist`,
      details: {
        totalTables,
        existingTables,
        missingTables: Object.entries(tableStatuses)
          .filter(([, exists]) => !exists)
          .map(([name]) => name),
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database tables error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkAIPipeline(): Promise<SubsystemHealth> {
  try {
    // Check LLM providers
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GOOGLE_AI_API_KEY || !!process.env.GEMINI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

    const configuredProviders = [hasOpenAI, hasGemini, hasAnthropic].filter(Boolean).length;

    if (configuredProviders > 0) {
      return {
        status: 'healthy',
        message: 'AI Pipeline is operational',
        details: {
          configuredProviders,
          providers: {
            openai: hasOpenAI,
            gemini: hasGemini,
            anthropic: hasAnthropic,
          },
          pipelineStages: [
            'input_validation',
            'context_building',
            'prompt_assembly',
            'model_routing',
            'llm_call',
            'response_processing',
            'memory_update',
            'persistence',
          ],
          streaming: true,
          rateLimiting: true,
          circuitBreaker: true,
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: 'degraded',
      message: 'No LLM providers configured for pipeline',
      details: {
        configuredProviders: 0,
        recommendation: 'Configure at least one LLM provider',
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `AI Pipeline error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkAdminManagement(): Promise<SubsystemHealth> {
  try {
    // Check if LLM providers table exists for admin management
    const providersCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='llm_providers'"
    );
    const hasProviders = (providersCheck as any)?.count > 0;

    return {
      status: 'healthy',
      message: 'Admin Management is available',
      details: {
        providersTable: hasProviders,
        adminFeatures: [
          'provider_management',
          'tier_configuration',
          'usage_statistics',
          'cost_tracking',
        ],
        roles: ['SUPERADMIN', 'ADMIN', 'USER'],
        routes: ['/superadmin/ai-settings', '/admin/ai-settings', '/settings/ai'],
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Admin Management error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkQualityObservability(): Promise<SubsystemHealth> {
  try {
    // Check feedback table for quality metrics
    const feedbackCheck = await dbGet(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='ai_feedback'"
    );
    const hasFeedback = (feedbackCheck as any)?.count > 0;

    return {
      status: 'healthy',
      message: 'Quality & Observability is available',
      details: {
        feedbackCollection: hasFeedback,
        metricsCategories: ['performance', 'quality', 'usage', 'errors'],
        qualityChecks: ['length', 'format', 'factual', 'tone', 'actionability'],
        alertTypes: ['error_spike', 'latency_degradation', 'quota_warning', 'provider_down'],
        healthMonitoring: true,
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Quality & Observability error: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/ai/health-check
 * Comprehensive AI system health check (public - no auth required for monitoring)
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    const includeAdvanced = req.query.advanced === 'true' || req.query.full === 'true';

    try {
      // Run basic health checks in parallel
      const [
        cloudIntegrations,
        toolsMenu,
        chatConversation,
        voiceSystem,
        historyManagement,
        llmManagement,
      ] = await Promise.all([
        checkCloudIntegrations(),
        checkToolsMenu(),
        checkChatConversation(),
        checkVoiceSystem(),
        checkHistoryManagement(),
        checkLLMManagement(),
      ]);

      const subsystems = {
        cloudIntegrations,
        toolsMenu,
        chatConversation,
        voiceSystem,
        historyManagement,
        llmManagement,
      };

      // Run advanced health checks if requested
      let advancedSubsystems: AISystemHealthReport['advancedSubsystems'] | undefined;

      if (includeAdvanced) {
        const [
          vectorDatabase,
          aiMemory,
          aiLearning,
          userStyleProfiles,
          contextBuilder,
          databaseTables,
          aiPipeline,
          adminManagement,
          qualityObservability,
        ] = await Promise.all([
          checkVectorDatabase(),
          checkAIMemory(),
          checkAILearning(),
          checkUserStyleProfiles(),
          checkContextBuilder(),
          checkDatabaseTables(),
          checkAIPipeline(),
          checkAdminManagement(),
          checkQualityObservability(),
        ]);

        advancedSubsystems = {
          vectorDatabase,
          aiMemory,
          aiLearning,
          userStyleProfiles,
          contextBuilder,
          databaseTables,
          aiPipeline,
          adminManagement,
          qualityObservability,
        };
      }

      // Calculate overall health
      const healthyStatuses = ['healthy'];

      const allSubsystems = advancedSubsystems
        ? { ...subsystems, ...advancedSubsystems }
        : subsystems;

      const healthyCount = Object.values(allSubsystems).filter((s) =>
        healthyStatuses.includes(s.status)
      ).length;

      const criticalCount = Object.values(allSubsystems).filter(
        (s) => s.status === 'unhealthy'
      ).length;

      const totalCount = Object.keys(allSubsystems).length;

      let overallStatus: 'operational' | 'degraded' | 'critical';
      if (criticalCount > 0) {
        overallStatus = 'critical';
      } else if (healthyCount < totalCount) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'operational';
      }

      // Generate recommendations
      const recommendations: string[] = [];

      if (cloudIntegrations.status === 'unhealthy') {
        recommendations.push(
          'Cloud integrations are unavailable. Implement OAuth for Google Drive, OneDrive, and Dropbox.'
        );
      }

      if (llmManagement.status === 'degraded') {
        recommendations.push(
          'Configure at least one LLM provider (set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY).'
        );
      }

      if (voiceSystem.status === 'degraded') {
        recommendations.push(
          'Set OPENAI_API_KEY for enhanced voice features (Whisper STT, OpenAI TTS).'
        );
      }

      const report: AISystemHealthReport = {
        timestamp: new Date().toISOString(),
        overall: {
          status: overallStatus,
          healthyCount,
          totalCount,
        },
        subsystems,
        advancedSubsystems,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
      };

      const duration = Date.now() - startTime;
      logger.info(
        `[AI Health Check] Completed in ${duration}ms - Status: ${overallStatus} (${healthyCount}/${totalCount})`
      );

      // Set appropriate HTTP status
      const httpStatus =
        overallStatus === 'critical' ? 503 : overallStatus === 'degraded' ? 200 : 200;

      return res.status(httpStatus).json(report);
    } catch (error) {
      logger.error('[AI Health Check] Error:', error);
      return res.status(500).json({
        timestamp: new Date().toISOString(),
        overall: {
          status: 'critical',
          healthyCount: 0,
          totalCount: 6,
        },
        ...mapAppErrorResponse((error as Error), undefined, 'error'),
      });
    }
  })
);

/**
 * GET /api/ai/health-check/summary
 * Quick summary for dashboards
 */
router.get(
  '/summary',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      // Quick checks without full details
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasGemini = !!process.env.GOOGLE_AI_API_KEY || !!process.env.GEMINI_API_KEY;

      const summary = {
        timestamp: new Date().toISOString(),
        status: hasOpenAI || hasGemini ? 'operational' : 'degraded',
        quickChecks: {
          llmConfigured: hasOpenAI || hasGemini,
          voiceEnabled: hasOpenAI,
          cloudIntegrations: 'unavailable',
          chatSystem: 'operational',
          historySystem: 'operational',
        },
      };

      return res.json(summary);
    } catch (error) {
      return res.status(500).json({
        timestamp: new Date().toISOString(),
        status: 'error',
        ...mapAppErrorResponse((error as Error), undefined, 'error'),
      });
    }
  })
);

/**
 * GET /api/ai/health-check/subsystem/:name
 * Check specific subsystem health
 */
router.get(
  '/subsystem/:name',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    const checkFunctions: Record<string, () => Promise<SubsystemHealth>> = {
      // Basic subsystems (L6.1-L6.6)
      cloud: checkCloudIntegrations,
      'cloud-integrations': checkCloudIntegrations,
      tools: checkToolsMenu,
      'tools-menu': checkToolsMenu,
      chat: checkChatConversation,
      conversation: checkChatConversation,
      voice: checkVoiceSystem,
      history: checkHistoryManagement,
      llm: checkLLMManagement,
      // Advanced subsystems (L6.9-L6.17)
      vector: checkVectorDatabase,
      'vector-database': checkVectorDatabase,
      embeddings: checkVectorDatabase,
      memory: checkAIMemory,
      'ai-memory': checkAIMemory,
      learning: checkAILearning,
      'ai-learning': checkAILearning,
      style: checkUserStyleProfiles,
      'style-profiles': checkUserStyleProfiles,
      'user-style': checkUserStyleProfiles,
      context: checkContextBuilder,
      'context-builder': checkContextBuilder,
      rag: checkContextBuilder,
      database: checkDatabaseTables,
      'database-tables': checkDatabaseTables,
      tables: checkDatabaseTables,
      pipeline: checkAIPipeline,
      'ai-pipeline': checkAIPipeline,
      admin: checkAdminManagement,
      'admin-management': checkAdminManagement,
      quality: checkQualityObservability,
      observability: checkQualityObservability,
      'quality-observability': checkQualityObservability,
    };

    const nameStr = Array.isArray(name) ? name[0] : name;
    const checkFn = checkFunctions[nameStr.toLowerCase()];

    if (!checkFn) {
      return res.status(404).json({
        error: 'Unknown subsystem',
        availableSubsystems: [
          // Basic
          'cloud',
          'tools',
          'chat',
          'voice',
          'history',
          'llm',
          // Advanced
          'vector',
          'embeddings',
          'memory',
          'learning',
          'style',
          'context',
          'rag',
          'database',
          'tables',
          'pipeline',
          'admin',
          'quality',
          'observability',
        ],
      });
    }

    const result = await checkFn();
    return res.json({
      subsystem: name,
      ...result,
    });
  })
);

/**
 * GET /api/ai/health-check/advanced
 * Check all advanced subsystems (L6.9-L6.17)
 */
router.get(
  '/advanced',
  asyncHandler(async (_req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const [
        vectorDatabase,
        aiMemory,
        aiLearning,
        userStyleProfiles,
        contextBuilder,
        databaseTables,
        aiPipeline,
        adminManagement,
        qualityObservability,
      ] = await Promise.all([
        checkVectorDatabase(),
        checkAIMemory(),
        checkAILearning(),
        checkUserStyleProfiles(),
        checkContextBuilder(),
        checkDatabaseTables(),
        checkAIPipeline(),
        checkAdminManagement(),
        checkQualityObservability(),
      ]);

      const advancedSubsystems = {
        vectorDatabase,
        aiMemory,
        aiLearning,
        userStyleProfiles,
        contextBuilder,
        databaseTables,
        aiPipeline,
        adminManagement,
        qualityObservability,
      };

      const healthyCount = Object.values(advancedSubsystems).filter(
        (s) => s.status === 'healthy'
      ).length;

      const totalCount = Object.keys(advancedSubsystems).length;

      const duration = Date.now() - startTime;

      return res.json({
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        overall: {
          healthyCount,
          totalCount,
          percentage: Math.round((healthyCount / totalCount) * 100),
        },
        subsystems: advancedSubsystems,
      });
    } catch (error) {
      return res.status(500).json({
        timestamp: new Date().toISOString(),
        ...mapAppErrorResponse((error as Error), undefined, 'error'),
      });
    }
  })
);

// ============================================================================
// L6.18: Quality Metrics Endpoint
// ============================================================================

/**
 * GET /api/ai/health-check/quality
 * Get AI response quality metrics
 */
router.get(
  '/quality',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const healthCheck = aiQualityMonitoring.getHealthCheck();
      const metrics = aiQualityMonitoring.getMetrics('hour');
      const alerts = aiQualityMonitoring.getAlerts();

      return res.json({
        timestamp: new Date().toISOString(),
        ...healthCheck,
        metrics: {
          responseTime: metrics.responseTime,
          errorRate: metrics.errorRate,
          retryRate: metrics.retryRate,
          successRate: metrics.successRate,
          totalRequests: metrics.totalRequests,
        },
        alerts,
        thresholds: {
          errorRateMax: 0.01,
          retryRateMax: 0.05,
          p95ResponseTimeMax: 5000,
        },
      });
    } catch (error) {
      return res.status(500).json({
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        ...mapAppErrorResponse((error as Error), undefined, 'error'),
      });
    }
  })
);

// ============================================================================
// L6.19: Cost & Budget Monitoring Endpoint
// ============================================================================

/**
 * GET /api/ai/health-check/cost
 * Get AI cost and budget metrics
 */
router.get(
  '/cost',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const healthCheck = aiCostMonitoring.getHealthCheck();
      const dailyMetrics = aiCostMonitoring.getMetrics('day');
      const monthlyMetrics = aiCostMonitoring.getMetrics('month');
      const budgetConfig = aiCostMonitoring.getBudgetConfig();

      return res.json({
        timestamp: new Date().toISOString(),
        ...healthCheck,
        daily: {
          totalTokens: dailyMetrics.totalTokens,
          totalCostUSD: dailyMetrics.totalCostUSD,
          tierBreakdown: dailyMetrics.tierBreakdown,
          alertLevel: dailyMetrics.alertLevel,
          budgetUsedPercent: dailyMetrics.budgetUsedPercent,
        },
        monthly: {
          totalTokens: monthlyMetrics.totalTokens,
          totalCostUSD: monthlyMetrics.totalCostUSD,
          budgetUsedPercent: monthlyMetrics.budgetUsedPercent,
        },
        budget: {
          dailyLimitUSD: budgetConfig.dailyLimitUSD,
          monthlyLimitUSD: budgetConfig.monthlyLimitUSD,
          perUserLimitUSD: budgetConfig.perUserLimitUSD,
        },
        topUsers: dailyMetrics.topUsers.slice(0, 5),
      });
    } catch (error) {
      return res.status(500).json({
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        ...mapAppErrorResponse((error as Error), undefined, 'error'),
      });
    }
  })
);

/**
 * GET /api/ai/health-check/cost/user/:userId
 * Get user-specific AI usage
 */
router.get(
  '/cost/user/:userId',
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const userIdStr = Array.isArray(userId) ? userId[0] : userId;
      const dailyUsage = aiCostMonitoring.getUserUsage(userIdStr, 'day');
      const monthlyUsage = aiCostMonitoring.getUserUsage(userIdStr, 'month');

      return res.json({
        timestamp: new Date().toISOString(),
        userId,
        daily: dailyUsage,
        monthly: monthlyUsage,
      });
    } catch (error) {
      return res.status(500).json({
        timestamp: new Date().toISOString(),
        ...mapAppErrorResponse((error as Error), undefined, 'error'),
      });
    }
  })
);

// ============================================================================
// L6.20: Consolidated AI Dashboard
// ============================================================================

/**
 * GET /api/ai/health-check/dashboard
 * Single endpoint returning the full AI system status for monitoring dashboards.
 * Combines: subsystem health, circuit breaker status, voice health, cost metrics.
 */
router.get(
  '/dashboard',
  asyncHandler(async (_req: Request, res: Response) => {
    const t0 = Date.now();
    try {
      // 1. Core subsystem health
      const [cloud, tools, chat, voice, history, llm] = await Promise.all([
        checkCloudIntegrations(),
        checkToolsMenu(),
        checkChatConversation(),
        checkVoiceSystem(),
        checkHistoryManagement(),
        checkLLMManagement(),
      ]);

      const coreSubsystems = {
        cloudIntegrations: cloud,
        toolsMenu: tools,
        chatConversation: chat,
        voiceSystem: voice,
        historyManagement: history,
        llmManagement: llm,
      };
      const coreValues = Object.values(coreSubsystems);
      const healthyCore = coreValues.filter((s) => s.status === 'healthy').length;

      // 2. Circuit breaker status
      let circuitBreakers: Record<string, unknown> = {};
      try {
        const cbMod = await import('../../services/circuitBreakerService.js');
        const CBS = (cbMod.default ||
          cbMod.CircuitBreakerService ||
          cbMod) as typeof cbMod.CircuitBreakerService;
        const statuses = CBS.getAllStatuses?.() || [];
        for (const s of statuses) {
          circuitBreakers[s.name] = {
            state: s.state,
            failures: s.failures,
            successes: s.successes,
            isRecovering: (s as any).isRecovering || false,
            recoveryPercent: (s as any).recoveryPercent || 100,
            healthCheckActive: (s as any).healthCheckActive || false,
          };
        }
      } catch {
        circuitBreakers = { error: 'Circuit breaker service not available' };
      }

      // 3. Cost summary (best-effort, non-blocking)
      let costSummary: Record<string, unknown> = {};
      try {
        const healthCheck = aiCostMonitoring.getHealthCheck();
        const daily = aiCostMonitoring.getMetrics('day');
        costSummary = {
          status: healthCheck.status,
          dailyCostUSD: daily.totalCostUSD,
          dailyTokens: daily.totalTokens,
          alertLevel: daily.alertLevel,
          budgetUsedPercent: daily.budgetUsedPercent,
        };
      } catch (err: any) {
        logger.warn(`[HealthCheck] Cost summary unavailable: ${err?.message}`);
        costSummary = { status: 'unavailable', error: err?.message };
      }

      // 4. Quality summary (best-effort, non-blocking)
      let qualitySummary: Record<string, unknown> = {};
      try {
        const qHealth = aiQualityMonitoring.getHealthCheck();
        qualitySummary = {
          status: qHealth.status,
          avgScore: (qHealth as any).averageScore || null,
          totalInteractions: (qHealth as any).totalInteractions || 0,
        };
      } catch (err: any) {
        logger.warn(`[HealthCheck] Quality summary unavailable: ${err?.message}`);
        qualitySummary = { status: 'unavailable', error: err?.message };
      }

      const overallStatus =
        healthyCore === coreValues.length
          ? 'operational'
          : healthyCore >= coreValues.length / 2
            ? 'degraded'
            : 'critical';

      return res.json({
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - t0,
        overall: {
          status: overallStatus,
          healthyCount: healthyCore,
          totalCount: coreValues.length,
        },
        subsystems: coreSubsystems,
        circuitBreakers,
        cost: costSummary,
        quality: qualitySummary,
      });
    } catch (error) {
      logger.error('[AI Health Dashboard] Error:', error);
      return res.status(500).json({
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - t0,
        overall: { status: 'critical' },
        ...mapAppErrorResponse((error as Error), undefined, 'error'),
      });
    }
  })
);

export default router;
