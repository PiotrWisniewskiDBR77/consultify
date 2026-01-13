import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { all, run, get } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export class AIMemoryController {
  /**
   * List user memories
   */
  static async listMemories(req: AuthRequest, res: Response) {
    try {
      const { source } = req.query;
      let query = 'SELECT * FROM ai_user_memory WHERE user_id = ?';
      const params: any[] = [req.userId];

      if (source) {
        query += ' AND source = ?';
        params.push(source);
      }

      const memories = await all(query, params);
      return res.json({ memories });
    } catch (err: any) {
      logger.error('[AIMemoryController] listMemories error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get formatted memory context
   */
  static async getContext(req: AuthRequest, res: Response) {
    try {
      const memories = await all('SELECT * FROM ai_user_memory WHERE user_id = ?', [req.userId]);

      const context = memories.reduce((acc: any, m: any) => {
        acc[m.key] = m.value;
        return acc;
      }, {});

      return res.json({ context });
    } catch (err: any) {
      logger.error('[AIMemoryController] getContext error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Create or update a memory
   */
  static async updateMemory(req: AuthRequest, res: Response) {
    try {
      const { key } = req.params;
      const { value, source, confidence, metadata } = req.body;

      await run(
        `INSERT INTO ai_user_memory (id, user_id, organization_id, key, value, source, confidence, metadata, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(user_id, key) DO UPDATE SET
                    value = excluded.value,
                    source = excluded.source,
                    confidence = excluded.confidence,
                    metadata = excluded.metadata,
                    updated_at = CURRENT_TIMESTAMP`,
        [
          uuidv4(),
          req.userId,
          req.organizationId,
          key,
          value,
          source || 'explicit',
          confidence || 1.0,
          JSON.stringify(metadata || {}),
        ]
      );

      const updated = await get('SELECT * FROM ai_user_memory WHERE user_id = ? AND key = ?', [
        req.userId,
        key,
      ]);
      return res.json(updated);
    } catch (err: any) {
      logger.error('[AIMemoryController] updateMemory error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}
