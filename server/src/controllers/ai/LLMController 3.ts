// @ts-nocheck
/**
 * LLM Controller
 * API handlers for LLM provider management and testing
 */

import axios from 'axios';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { llmService } from '../../services/ai/llmService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

export class LLMController {
  /**
   * GET /api/llm/providers
   * List all configured providers
   */
  static async listProviders(req: Request, res: Response) {
    try {
      const providers = await dbAll('SELECT * FROM llm_providers', []);
      return res.json(providers);
    } catch (error: any) {
      console.error('[LLMController] Error listing providers:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/providers/public
   * List public providers (no API key needed or pre-configured)
   */
  static async listPublicProviders(req: Request, res: Response) {
    try {
      const providers = await dbAll(
        'SELECT * FROM llm_providers WHERE visibility = ? OR visibility = ?',
        ['public', 'free']
      );
      return res.json(providers);
    } catch (error: any) {
      console.error('[LLMController] Error listing public providers:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/llm/test
   * Test a provider connection
   */
  static async testProvider(req: Request, res: Response) {
    try {
      const { provider, api_key, model_id, endpoint } = req.body;

      if (!provider) {
        return res.status(400).json({ error: 'Provider is required' });
      }

      const result = await llmService.testConnection({
        provider,
        api_key,
        apiKey: api_key,
        id: model_id,
        endpoint,
      });

      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error: any) {
      console.error('[LLMController] Error testing provider:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/llm/test-ollama
   * Test Ollama connection
   */
  static async testOllama(req: Request, res: Response) {
    try {
      const { endpoint } = req.body;
      const target = endpoint || 'http://localhost:11434';

      try {
        const response = await axios.get(`${target}/api/tags`, { timeout: 5000 });
        return res.json({ success: true, models: response.data.models });
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          error: `Ollama connection failed: ${err.message}`,
          endpoint: target,
        });
      }
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/ollama-models
   * Get available Ollama models
   */
  static async getOllamaModels(req: Request, res: Response) {
    try {
      const { endpoint } = req.query;
      const target = (endpoint as string) || 'http://localhost:11434';

      try {
        const response = await axios.get(`${target}/api/tags`, { timeout: 5000 });
        return res.json(response.data.models || []);
      } catch (err: any) {
        return res.status(400).json({
          error: `Failed to fetch Ollama models: ${err.message}`,
          endpoint: target,
        });
      }
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/llm/providers
   * Create a new provider
   */
  static async createProvider(req: Request, res: Response) {
    try {
      const {
        name,
        provider,
        model_id,
        api_key,
        endpoint,
        tier = 'standard',
        visibility = 'admin',
        is_active = true,
        is_default = false,
        cost_per_1k = 0,
        context_window = 4096,
      } = req.body;

      if (!name || !provider) {
        return res.status(400).json({ error: 'Name and provider are required' });
      }

      const id = uuidv4();
      await dbRun(
        `
                INSERT INTO llm_providers (id, name, provider, model_id, api_key, endpoint, tier, visibility, is_active, is_default, cost_per_1k, context_window, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
        [
          id,
          name,
          provider,
          model_id,
          api_key,
          endpoint,
          tier,
          visibility,
          is_active ? 1 : 0,
          is_default ? 1 : 0,
          cost_per_1k,
          context_window,
        ]
      );

      const newProvider = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [id]);
      return res.status(201).json(newProvider);
    } catch (error: any) {
      console.error('[LLMController] Error creating provider:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/llm/providers/:id
   * Update a provider
   */
  static async updateProvider(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existing = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      const allowedFields = [
        'name',
        'provider',
        'model_id',
        'api_key',
        'endpoint',
        'tier',
        'visibility',
        'is_active',
        'is_default',
        'cost_per_1k',
        'context_window',
      ];
      const setClauses: string[] = [];
      const values: any[] = [];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          setClauses.push(`${field} = ?`);
          values.push(
            typeof updates[field] === 'boolean' ? (updates[field] ? 1 : 0) : updates[field]
          );
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      setClauses.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      await dbRun(`UPDATE llm_providers SET ${setClauses.join(', ')} WHERE id = ?`, values);

      const updated = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [id]);
      return res.json(updated);
    } catch (error: any) {
      console.error('[LLMController] Error updating provider:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/llm/providers/:id
   * Delete a provider
   */
  static async deleteProvider(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const existing = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      await dbRun('DELETE FROM llm_providers WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Provider deleted' });
    } catch (error: any) {
      console.error('[LLMController] Error deleting provider:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/health/status
   * Get AI system health status
   */
  static async getHealthStatus(req: Request, res: Response) {
    try {
      const providers = await dbAll(
        'SELECT id, name, provider, model_id, is_active, visibility, tier FROM llm_providers WHERE is_active = 1',
        []
      );

      // Get usage metrics from last 24 hours
      const metricsRow = (await dbGet(
        `
                SELECT 
                    COUNT(*) as totalRequests,
                    AVG(latency_ms) as avgLatencyMs,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as successRate
                FROM ai_usage_logs 
                WHERE created_at > datetime('now', '-24 hours')
            `,
        []
      )) as { totalRequests: number; avgLatencyMs: number; successRate: number } | null;

      return res.json({
        providers: providers.map((p: any) => ({
          name: p.name,
          type: p.provider,
          status: p.is_active ? 'ACTIVE' : 'INACTIVE',
          visibility: p.visibility || 'admin',
          tier: p.tier || 'standard',
        })),
        metrics: {
          uptime50: metricsRow?.successRate || 100,
          avgLatencyMs: Math.round(metricsRow?.avgLatencyMs || 0),
          totalRequests: metricsRow?.totalRequests || 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[LLMController] Error getting health status:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/health/detailed
   * Get detailed health status of all providers with diagnostics
   */
  static async getDetailedHealth(req: Request, res: Response) {
    try {
      const allProviders = (await dbAll('SELECT * FROM llm_providers', [])) as any[];
      const alerts: any[] = [];

      const providerHealthResults = await Promise.all(
        allProviders.map(async (provider: any) => {
          let status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' = 'unknown';
          let error: any = null;
          let responseTime = 0;
          let rawError: string | null = null;
          const statusCode: number | null = null;

          if (provider.is_active) {
            try {
              const startTime = Date.now();
              const result = await llmService.testConnection({
                provider: provider.provider,
                apiKey: provider.api_key,
                api_key: provider.api_key,
                endpoint: provider.endpoint,
                id: provider.model_id,
              });
              responseTime = Date.now() - startTime;

              if (result.success) {
                status = responseTime < 3000 ? 'healthy' : 'degraded';
              } else {
                status = 'unhealthy';
                rawError = String(result.error || 'Connection failed');
              }
            } catch (e: any) {
              status = 'unhealthy';
              rawError = e.message;
              error = {
                title: 'Connection Error',
                description: e.message,
                action: 'Check API key and endpoint configuration',
                code: 'CONNECTION_ERROR',
              };

              // Add alert for unhealthy providers
              alerts.push({
                severity: 'error',
                provider: provider.name,
                providerId: provider.id,
                title: 'Provider Unhealthy',
                description: e.message,
                action: 'Verify API credentials and network connectivity',
                code: 'PROVIDER_UNHEALTHY',
                timestamp: new Date().toISOString(),
              });
            }
          }

          const statusLabels: Record<string, any> = {
            healthy: { text: 'Zdrowy', textEn: 'Healthy', color: 'green', icon: 'check' },
            degraded: { text: 'Zdegradowany', textEn: 'Degraded', color: 'yellow', icon: 'alert' },
            unhealthy: { text: 'Niezdrowy', textEn: 'Unhealthy', color: 'red', icon: 'x' },
            unknown: { text: 'Nieznany', textEn: 'Unknown', color: 'gray', icon: 'question' },
          };

          return {
            id: provider.id,
            name: provider.name,
            providerId: provider.provider,
            status,
            statusLabel: statusLabels[status],
            isHealthy: status === 'healthy',
            isDegraded: status === 'degraded',
            isUnhealthy: status === 'unhealthy',
            errorCategory: error ? 'connection' : null,
            error,
            rawError,
            statusCode,
            responseTime,
            lastCheck: new Date().toISOString(),
          };
        })
      );

      const healthyCount = providerHealthResults.filter((p) => p.status === 'healthy').length;
      const degradedCount = providerHealthResults.filter((p) => p.status === 'degraded').length;
      const unhealthyCount = providerHealthResults.filter((p) => p.status === 'unhealthy').length;

      return res.json({
        success: true,
        providers: providerHealthResults,
        alerts,
        summary: {
          total: allProviders.length,
          healthy: healthyCount,
          degraded: degradedCount,
          unhealthy: unhealthyCount,
          healthyCount,
          degradedCount,
          unhealthyCount,
          lastCheck: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('[LLMController] Error getting detailed health:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/llm/health/test-provider
   * Test a specific provider's connection
   */
  static async testProviderHealth(req: Request, res: Response) {
    try {
      const { providerId } = req.body;

      const provider = (await dbGet('SELECT * FROM llm_providers WHERE id = ?', [
        providerId,
      ])) as any;
      if (!provider) {
        return res.status(404).json({ success: false, error: 'Provider not found' });
      }

      const startTime = Date.now();
      try {
        const result = await llmService.testConnection({
          provider: provider.provider,
          apiKey: provider.api_key,
          api_key: provider.api_key,
          endpoint: provider.endpoint,
          id: provider.model_id,
        });

        return res.json({
          success: result.success,
          providerId: provider.id,
          providerName: provider.name,
          responseTime: Date.now() - startTime,
          status: result.success ? 'healthy' : 'unhealthy',
          error: result.error || null,
        });
      } catch (e: any) {
        return res.json({
          success: false,
          providerId: provider.id,
          providerName: provider.name,
          responseTime: Date.now() - startTime,
          status: 'unhealthy',
          error: e.message,
        });
      }
    } catch (error: any) {
      console.error('[LLMController] Error testing provider:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/llm/health/test/:capabilityId
   * Test specific AI capability
   */
  static async testCapability(req: Request, res: Response) {
    try {
      const { capabilityId } = req.params;
      const { context, sendAlerts } = req.body;
      const startTime = Date.now();

      // Get active provider
      const provider = (await dbGet(
        'SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY is_default DESC LIMIT 1',
        []
      )) as any;

      if (!provider) {
        return res.json({
          capability: capabilityId,
          status: 'FAILED',
          latency: Date.now() - startTime,
          error: 'No active LLM provider configured',
          details: { skipped: false },
        });
      }

      let testResult = { success: false, details: {} as any, error: '' };

      switch (capabilityId) {
        case 'connection':
          // Test basic connection
          try {
            testResult = await llmService.testConnection({
              provider: provider.provider,
              apiKey: provider.api_key,
              api_key: provider.api_key,
              endpoint: provider.endpoint,
              id: provider.model_id,
            });
          } catch (e: any) {
            testResult.error = e.message;
          }
          break;

        case 'chat_ready':
          // Test chat capability with simple prompt
          try {
            const response = await llmService.call({
              type: 'chat',
              modelConfig: {
                provider: provider.provider,
                apiKey: provider.api_key,
                endpoint: provider.endpoint,
                id: provider.model_id,
              },
              messages: [{ role: 'user', content: 'Say "ready" if you can respond.' }],
              maxTokens: 10,
            });
            testResult.success = !!response?.content;
            testResult.details = { response: response?.content?.substring(0, 100) };
          } catch (e: any) {
            testResult.error = e.message;
          }
          break;

        case 'eyes':
          // Visual context - skip if not supported
          testResult.success = true;
          testResult.details = {
            skipped: true,
            reason: 'Visual context requires multimodal model',
          };
          break;

        case 'memory':
          // RAG test - check if knowledge base is accessible
          testResult.success = true;
          testResult.details = { skipped: true, reason: 'RAG requires knowledge base setup' };
          break;

        case 'hands':
          // MCP Tools test
          testResult.success = true;
          testResult.details = { skipped: true, reason: 'MCP tools require tool server setup' };
          break;

        case 'reasoning':
          // Advanced reasoning test
          try {
            const response = await llmService.call({
              type: 'chat',
              modelConfig: {
                provider: provider.provider,
                apiKey: provider.api_key,
                endpoint: provider.endpoint,
                id: provider.model_id,
              },
              messages: [{ role: 'user', content: 'What is 15 * 7? Reply with just the number.' }],
              maxTokens: 20,
            });
            testResult.success = response?.content?.includes('105');
            testResult.details = { response: response?.content, expected: '105' };
          } catch (e: any) {
            testResult.error = e.message;
          }
          break;

        default:
          testResult.error = `Unknown capability: ${capabilityId}`;
      }

      const result = {
        capability: capabilityId,
        status: testResult.success ? 'SUCCESS' : 'FAILED',
        latency: Date.now() - startTime,
        details: testResult.details,
        error: testResult.error || undefined,
        alertSent: sendAlerts && !testResult.success,
      };

      // Log the test result
      await dbRun(
        `
                INSERT INTO ai_usage_logs (id, user_id, organization_id, provider, model, action, status, latency_ms, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `,
        [
          uuidv4(),
          (req as any).userId || 'system',
          (req as any).organizationId || 'system',
          provider.provider,
          provider.model_id,
          `health_test_${capabilityId}`,
          testResult.success ? 'success' : 'error',
          Date.now() - startTime,
        ]
      );

      return res.json(result);
    } catch (error: any) {
      console.error('[LLMController] Error testing capability:', error);
      return res.status(500).json({
        capability: req.params.capabilityId,
        status: 'FAILED',
        latency: 0,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/llm/analytics
   * Get LLM usage analytics
   */
  static async getAnalytics(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;

      // Total stats
      const totals = (await dbGet(
        `
                SELECT 
                    COUNT(*) as totalCalls,
                    COALESCE(SUM(tokens_used), 0) as totalTokens,
                    COALESCE(AVG(latency_ms), 0) as avgLatency,
                    COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) as errorRate
                FROM ai_usage_logs 
                WHERE created_at > datetime('now', '-' || ? || ' days')
            `,
        [days]
      )) as any;

      // By provider
      const byProviderRows = (await dbAll(
        `
                SELECT 
                    provider,
                    COUNT(*) as calls,
                    COALESCE(SUM(tokens_used), 0) as tokens
                FROM ai_usage_logs 
                WHERE created_at > datetime('now', '-' || ? || ' days')
                GROUP BY provider
            `,
        [days]
      )) as any[];

      const byProvider: Record<string, { calls: number; tokens: number }> = {};
      for (const row of byProviderRows) {
        byProvider[row.provider] = { calls: row.calls, tokens: row.tokens };
      }

      // By day
      const byDayRows = (await dbAll(
        `
                SELECT 
                    date(created_at) as date,
                    COUNT(*) as calls,
                    COALESCE(SUM(tokens_used), 0) as tokens
                FROM ai_usage_logs 
                WHERE created_at > datetime('now', '-' || ? || ' days')
                GROUP BY date(created_at)
                ORDER BY date
            `,
        [days]
      )) as any[];

      return res.json({
        totalCalls: totals?.totalCalls || 0,
        totalTokens: totals?.totalTokens || 0,
        avgLatency: Math.round(totals?.avgLatency || 0),
        errorRate: Math.round((totals?.errorRate || 0) * 100) / 100,
        byProvider,
        byDay: byDayRows.map((r: any) => ({ date: r.date, calls: r.calls, tokens: r.tokens })),
      });
    } catch (error: any) {
      console.error('[LLMController] Error getting analytics:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/logs
   * Get LLM usage logs
   */
  static async getLogs(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = await dbAll(
        `
                SELECT 
                    id, provider, model, action as prompt, 
                    COALESCE(tokens_used, 0) as tokens,
                    COALESCE(latency_ms, 0) as latency,
                    CASE WHEN status = 'error' THEN error_message ELSE NULL END as error,
                    created_at as createdAt
                FROM ai_usage_logs 
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `,
        [limit, offset]
      );

      const countRow = (await dbGet('SELECT COUNT(*) as total FROM ai_usage_logs', [])) as {
        total: number;
      };

      return res.json({
        logs,
        pagination: {
          total: countRow?.total || 0,
          limit,
          offset,
        },
      });
    } catch (error: any) {
      console.error('[LLMController] Error getting logs:', error);
      return res.status(500).json({ error: error.message, logs: [] });
    }
  }

  /**
   * GET /api/llm/providers/health
   * Get health status of all providers
   */
  static async getProvidersHealth(req: Request, res: Response) {
    try {
      const providers = (await dbAll(
        'SELECT * FROM llm_providers WHERE is_active = 1',
        []
      )) as any[];

      const healthResults = await Promise.all(
        providers.map(async (provider: any) => {
          try {
            const result = await llmService.testConnection({
              provider: provider.provider,
              apiKey: provider.api_key,
              api_key: provider.api_key,
              endpoint: provider.endpoint,
              id: provider.model_id,
            });
            return {
              id: provider.id,
              name: provider.name,
              provider: provider.provider,
              status: result.success ? 'healthy' : 'unhealthy',
              latency: result.latency || 0,
              lastCheck: new Date().toISOString(),
            };
          } catch (e: any) {
            return {
              id: provider.id,
              name: provider.name,
              provider: provider.provider,
              status: 'unhealthy',
              error: e.message,
              lastCheck: new Date().toISOString(),
            };
          }
        })
      );

      return res.json({
        providers: healthResults,
        overall: healthResults.every((p) => p.status === 'healthy') ? 'healthy' : 'degraded',
        lastCheck: Date.now(),
      });
    } catch (error: any) {
      console.error('[LLMController] Error getting providers health:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/providers/recommended
   * Get recommended provider for tier
   */
  static async getRecommendedProvider(req: Request, res: Response) {
    try {
      const tier = (req.query.tier as string) || 'standard';

      const provider = (await dbGet(
        `
                SELECT * FROM llm_providers 
                WHERE is_active = 1 AND (tier = ? OR tier = 'standard')
                ORDER BY is_default DESC, tier DESC
                LIMIT 1
            `,
        [tier.toLowerCase()]
      )) as any;

      if (!provider) {
        return res.json({
          success: false,
          recommendation: null,
          reason: 'No active providers available',
        });
      }

      return res.json({
        success: true,
        recommendation: {
          provider: provider.provider,
          model: provider.model_id,
          reason: provider.is_default ? 'Default provider' : `Best available for ${tier} tier`,
        },
      });
    } catch (error: any) {
      console.error('[LLMController] Error getting recommended provider:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/control/usage
   * Get usage statistics for control panel
   */
  static async getUsageStats(req: Request, res: Response) {
    try {
      const today = (await dbGet(
        `
                SELECT 
                    COUNT(*) as calls,
                    COALESCE(SUM(tokens_used), 0) as tokens,
                    COALESCE(AVG(latency_ms), 0) as avgLatency
                FROM ai_usage_logs 
                WHERE date(created_at) = date('now')
            `,
        []
      )) as any;

      const thisMonth = (await dbGet(
        `
                SELECT 
                    COUNT(*) as calls,
                    COALESCE(SUM(tokens_used), 0) as tokens
                FROM ai_usage_logs 
                WHERE created_at >= date('now', 'start of month')
            `,
        []
      )) as any;

      const byProvider = await dbAll(
        `
                SELECT 
                    provider,
                    COUNT(*) as calls,
                    COALESCE(SUM(tokens_used), 0) as tokens
                FROM ai_usage_logs 
                WHERE created_at >= date('now', '-7 days')
                GROUP BY provider
            `,
        []
      );

      return res.json({
        today: {
          calls: today?.calls || 0,
          tokens: today?.tokens || 0,
          avgLatency: Math.round(today?.avgLatency || 0),
        },
        thisMonth: {
          calls: thisMonth?.calls || 0,
          tokens: thisMonth?.tokens || 0,
        },
        byProvider,
      });
    } catch (error: any) {
      console.error('[LLMController] Error getting usage stats:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/costs
   * Get cost statistics
   */
  static async getCosts(req: Request, res: Response) {
    try {
      const providers = (await dbAll(
        'SELECT id, name, provider, cost_per_1k FROM llm_providers',
        []
      )) as any[];

      const usage = (await dbAll(
        `
                SELECT 
                    provider,
                    COALESCE(SUM(tokens_used), 0) as totalTokens
                FROM ai_usage_logs 
                WHERE created_at >= date('now', 'start of month')
                GROUP BY provider
            `,
        []
      )) as any[];

      let totalCost = 0;
      const costByProvider: Record<string, { tokens: number; cost: number }> = {};

      for (const u of usage) {
        const providerConfig = providers.find((p) => p.provider === u.provider);
        const costPer1k = providerConfig?.cost_per_1k || 0;
        const cost = (u.totalTokens / 1000) * costPer1k;
        totalCost += cost;
        costByProvider[u.provider] = {
          tokens: u.totalTokens,
          cost: Math.round(cost * 100) / 100,
        };
      }

      return res.json({
        totalCost: Math.round(totalCost * 100) / 100,
        currency: 'USD',
        period: 'current_month',
        byProvider: costByProvider,
      });
    } catch (error: any) {
      console.error('[LLMController] Error getting costs:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/diagnose
   * Run diagnostic checks on LLM system
   */
  static async diagnose(req: Request, res: Response) {
    try {
      const providers = (await dbAll(
        'SELECT * FROM llm_providers WHERE is_active = 1',
        []
      )) as any[];

      const diagnostics: any[] = [];

      // Check providers
      diagnostics.push({
        check: 'Active Providers',
        status: providers.length > 0 ? 'OK' : 'WARNING',
        message:
          providers.length > 0
            ? `${providers.length} active provider(s)`
            : 'No active providers configured',
        details: providers.map((p) => p.name),
      });

      // Check default provider
      const defaultProvider = providers.find((p) => p.is_default);
      diagnostics.push({
        check: 'Default Provider',
        status: defaultProvider ? 'OK' : 'WARNING',
        message: defaultProvider ? `Default: ${defaultProvider.name}` : 'No default provider set',
      });

      // Check recent errors
      const recentErrors = (await dbGet(
        `
                SELECT COUNT(*) as count FROM ai_usage_logs 
                WHERE status = 'error' AND created_at > datetime('now', '-1 hour')
            `,
        []
      )) as { count: number };

      diagnostics.push({
        check: 'Recent Errors',
        status: (recentErrors?.count || 0) < 5 ? 'OK' : 'WARNING',
        message: `${recentErrors?.count || 0} errors in last hour`,
      });

      // Check latency
      const avgLatency = (await dbGet(
        `
                SELECT AVG(latency_ms) as avg FROM ai_usage_logs 
                WHERE created_at > datetime('now', '-1 hour')
            `,
        []
      )) as { avg: number };

      diagnostics.push({
        check: 'Average Latency',
        status: (avgLatency?.avg || 0) < 5000 ? 'OK' : 'WARNING',
        message: `${Math.round(avgLatency?.avg || 0)}ms average`,
      });

      const overallStatus = diagnostics.every((d) => d.status === 'OK') ? 'HEALTHY' : 'DEGRADED';

      return res.json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        diagnostics,
      });
    } catch (error: any) {
      console.error('[LLMController] Error running diagnostics:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/llm/providers/:id/tier
   * Update provider tier
   */
  static async updateProviderTier(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tier } = req.body;

      if (!tier) {
        return res.status(400).json({ error: 'Tier is required' });
      }

      await dbRun(
        'UPDATE llm_providers SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [tier.toLowerCase(), id]
      );

      const updated = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [id]);
      return res.json(updated);
    } catch (error: any) {
      console.error('[LLMController] Error updating tier:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // ==================== TIER ASSIGNMENTS ====================

  /**
   * GET /api/llm/tiers/assignments
   * Get all tier assignments grouped by tier
   */
  static async getTierAssignments(req: Request, res: Response) {
    try {
      const assignments = (await dbAll(
        `
                SELECT 
                    t.id,
                    t.tier,
                    t.priority,
                    t.is_active,
                    t.provider_id,
                    p.name,
                    p.provider,
                    p.model_id,
                    CASE 
                        WHEN p.is_active = 1 THEN 'healthy'
                        ELSE 'unknown'
                    END as health_status
                FROM llm_tier_assignments t
                JOIN llm_providers p ON t.provider_id = p.id
                WHERE t.is_active = 1
                ORDER BY t.tier, t.priority
            `,
        []
      )) as any[];

      // Group by tier
      const grouped: Record<string, any[]> = {
        BUDGET: [],
        STANDARD: [],
        PREMIUM: [],
        REASONING: [],
      };

      for (const assignment of assignments) {
        if (grouped[assignment.tier]) {
          grouped[assignment.tier].push(assignment);
        }
      }

      return res.json({ assignments: grouped });
    } catch (error: any) {
      console.error('[LLMController] Error getting tier assignments:', error);
      return res.status(500).json({ error: error.message, assignments: {} });
    }
  }

  /**
   * POST /api/llm/tiers/assign
   * Assign a provider to a tier
   */
  static async assignToTier(req: Request, res: Response) {
    try {
      const { providerId, tier, priority = 0 } = req.body;

      if (!providerId || !tier) {
        return res.status(400).json({ error: 'providerId and tier are required' });
      }

      const validTiers = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'];
      if (!validTiers.includes(tier.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid tier' });
      }

      // Check if provider exists
      const provider = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [providerId]);
      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      const id = uuidv4();
      await dbRun(
        `
                INSERT INTO llm_tier_assignments (id, provider_id, tier, priority, is_active)
                VALUES (?, ?, ?, ?, 1)
                ON CONFLICT(provider_id, tier) DO UPDATE SET
                    priority = excluded.priority,
                    is_active = 1,
                    updated_at = CURRENT_TIMESTAMP
            `,
        [id, providerId, tier.toUpperCase(), priority]
      );

      return res.json({ success: true, message: 'Provider assigned to tier' });
    } catch (error: any) {
      console.error('[LLMController] Error assigning to tier:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/llm/tiers/assign
   * Remove a provider from a tier
   */
  static async removeFromTier(req: Request, res: Response) {
    try {
      const { providerId, tier } = req.body;

      if (!providerId || !tier) {
        return res.status(400).json({ error: 'providerId and tier are required' });
      }

      await dbRun(
        `
                DELETE FROM llm_tier_assignments 
                WHERE provider_id = ? AND tier = ?
            `,
        [providerId, tier.toUpperCase()]
      );

      return res.json({ success: true, message: 'Provider removed from tier' });
    } catch (error: any) {
      console.error('[LLMController] Error removing from tier:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/llm/tiers/priority
   * Update priority of a provider in a tier
   */
  static async updateTierPriority(req: Request, res: Response) {
    try {
      const { providerId, tier, priority } = req.body;

      if (!providerId || !tier || priority === undefined) {
        return res.status(400).json({ error: 'providerId, tier, and priority are required' });
      }

      await dbRun(
        `
                UPDATE llm_tier_assignments 
                SET priority = ?, updated_at = CURRENT_TIMESTAMP
                WHERE provider_id = ? AND tier = ?
            `,
        [priority, providerId, tier.toUpperCase()]
      );

      return res.json({ success: true, message: 'Priority updated' });
    } catch (error: any) {
      console.error('[LLMController] Error updating priority:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
