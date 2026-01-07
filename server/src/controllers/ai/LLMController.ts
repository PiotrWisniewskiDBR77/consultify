/**
 * LLM Controller
 * API handlers for LLM provider management and testing
 */

import { Request, Response } from 'express';
import { all as dbAll } from '../../utils/DbPromise.js';
import { llmService } from '../../services/ai/llmService.js';
import axios from 'axios';

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
            const providers = await dbAll('SELECT * FROM llm_providers WHERE visibility = ? OR visibility = ?', ['public', 'free']);
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
                endpoint
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
                    endpoint: target
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
                    endpoint: target
                });
            }
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }
}

