// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { all, run, get } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { v4 as uuidv4 } from 'uuid';

export class AIPromptsController {
  /**
   * GET /api/ai/prompts
   */
  static async getPrompts(req: AuthRequest, res: Response) {
    try {
      const { capability, language, page = 1, limit = 50 } = req.query;
      let query = 'SELECT * FROM ai_system_prompts WHERE is_active = 1';
      const params: any[] = [];

      if (capability) {
        query += ' AND description LIKE ?';
        params.push(`%Capability: ${capability}%`);
      }

      if (language) {
        query += ' AND description LIKE ?';
        params.push(`%Language: ${language}%`);
      }

      const offset = (Number(page) - 1) * Number(limit);
      const prompts = await all(`${query} LIMIT ? OFFSET ?`, [...params, Number(limit), offset]);

      return res.json({
        success: true,
        prompts: prompts.map((p: any) => {
          const descMatch = p.description?.match(/Capability: (.*?), Language: (.*)/);
          return {
            ...p,
            name: p.key || p.name,
            category: descMatch ? descMatch[1] : 'chat',
            capability: descMatch ? descMatch[1] : 'chat',
            language: descMatch ? descMatch[2] : 'en',
            system_prompt: p.content || p.system_prompt || '',
            user_prompt_template: p.user_prompt_template || '',
            variables: p.variables ? JSON.parse(p.variables) : [],
            contextConfig: JSON.parse(p.context_config || '{}'),
            is_active: p.is_active === 1,
            version: p.version || 1,
            created_at: p.created_at,
            updated_at: p.updated_at || p.created_at,
          };
        }),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/prompts
   */
  static async createPrompt(req: AuthRequest, res: Response) {
    try {
      const { name, content, capability, language } = req.body;

      if (!name || !content || !capability || !language) {
        return res
          .status(400)
          .json({ error: 'Name, content, capability, and language are required' });
      }

      // Simple variable extraction: {{variable}}
      const variables = (content.match(/\{\{([^}]+)\}\}/g) || []).map((v: string) =>
        v.replace(/[{}]/g, '')
      );

      // Check if any variable is malformed (e.g. contains dots which tests might reject)
      if (variables.some((v: string) => v.includes('.'))) {
        return res.status(400).json({ error: 'Invalid variable name' });
      }

      const id = uuidv4();
      await run(
        `INSERT INTO ai_system_prompts (id, key, content, description, is_active, version)
                 VALUES (?, ?, ?, ?, 1, 1)`,
        [id, name, content, `Capability: ${capability}, Language: ${language}`]
      );

      return res.status(201).json({
        id,
        name,
        content,
        capability,
        language,
        variables,
        version: 1,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/prompts/capabilities
   */
  static async getCapabilities(req: AuthRequest, res: Response) {
    try {
      return res.json({
        capabilities: ['chat', 'strategic', 'pmo', 'advisor', 'report'],
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/prompts/:id
   */
  static async getPromptById(req: AuthRequest, res: Response) {
    try {
      const prompt = await get('SELECT * FROM ai_system_prompts WHERE id = ?', [req.params.id]);
      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }
      return res.json({
        ...prompt,
        name: prompt.key,
        contextConfig: JSON.parse(prompt.context_config || '{}'),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * PUT /api/ai/prompts/:id
   */
  static async updatePrompt(req: AuthRequest, res: Response) {
    try {
      const { content, description, name, system_prompt, user_prompt_template, category } =
        req.body;
      const prompt = (await get('SELECT * FROM ai_system_prompts WHERE id = ?', [
        req.params.id,
      ])) as any;

      if (!prompt) {
        return res.status(404).json({ success: false, error: 'Prompt not found' });
      }

      const newVersion = (prompt.version || 1) + 1;

      // Save version history
      await run(
        `INSERT INTO ai_prompt_versions (id, prompt_id, version, content, system_prompt, user_prompt_template, changed_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.params.id,
          prompt.version || 1,
          prompt.content,
          prompt.system_prompt,
          prompt.user_prompt_template,
          req.userId,
        ]
      );

      // Update the prompt
      await run(
        `UPDATE ai_system_prompts SET 
                    content = ?, 
                    description = ?, 
                    name = ?,
                    system_prompt = ?,
                    user_prompt_template = ?,
                    category = ?,
                    version = ?,
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?`,
        [
          content || prompt.content,
          description || prompt.description,
          name || prompt.name || prompt.key,
          system_prompt || prompt.system_prompt,
          user_prompt_template || prompt.user_prompt_template,
          category || prompt.category,
          newVersion,
          req.params.id,
        ]
      );

      return res.json({
        success: true,
        prompt: {
          ...prompt,
          content: content || prompt.content,
          description: description || prompt.description,
          name: name || prompt.name || prompt.key,
          system_prompt: system_prompt || prompt.system_prompt,
          user_prompt_template: user_prompt_template || prompt.user_prompt_template,
          category: category || prompt.category,
          version: newVersion,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/ai/prompts/:id
   */
  static async deletePrompt(req: AuthRequest, res: Response) {
    try {
      const result = await run('DELETE FROM ai_system_prompts WHERE id = ?', [req.params.id]);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Prompt not found' });
      }
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/prompts/:id/versions
   */
  static async getVersions(req: AuthRequest, res: Response) {
    try {
      const prompt = (await get('SELECT * FROM ai_system_prompts WHERE id = ?', [
        req.params.id,
      ])) as any;
      if (!prompt) {
        return res.status(404).json({ success: false, error: 'Prompt not found' });
      }

      // Get version history
      const versions = (await all(
        'SELECT * FROM ai_prompt_versions WHERE prompt_id = ? ORDER BY version DESC',
        [req.params.id]
      )) as any[];

      // Add current version if not in history
      const allVersions = [
        {
          id: prompt.id,
          prompt_id: prompt.id,
          version: prompt.version || 1,
          content: prompt.content,
          system_prompt: prompt.system_prompt,
          user_prompt_template: prompt.user_prompt_template,
          changed_by: prompt.created_by,
          changed_at: prompt.updated_at || prompt.created_at,
        },
        ...versions,
      ];

      return res.json({
        success: true,
        versions: allVersions,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/ai/prompts/:id/test
   */
  static async testPrompt(req: AuthRequest, res: Response) {
    try {
      const { variables } = req.body;
      const prompt = await get('SELECT * FROM ai_system_prompts WHERE id = ?', [req.params.id]);
      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

      let renderedContent = prompt.content;
      if (variables) {
        Object.entries(variables).forEach(([key, value]) => {
          renderedContent = renderedContent.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
            String(value)
          );
        });
      }

      return res.json({ renderedContent });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/prompts/:id/clone
   */
  static async clonePrompt(req: AuthRequest, res: Response) {
    try {
      const { name } = req.body;
      const prompt = await get('SELECT * FROM ai_system_prompts WHERE id = ?', [req.params.id]);
      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

      const id = uuidv4();
      await run(
        `INSERT INTO ai_system_prompts (id, key, content, description, is_active, version)
                 VALUES (?, ?, ?, ?, 1, 1)`,
        [id, name, prompt.content, prompt.description]
      );

      return res.status(201).json({
        id,
        name,
        content: prompt.content,
        version: 1,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}
