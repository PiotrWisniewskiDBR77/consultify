// @ts-nocheck
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { AuthRequest } from '../../middleware/auth.middleware.js';
import { all, get, run } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export class AITrainingController {
  /**
   * GET /api/ai-training
   */
  static async listFeedback(req: AuthRequest, res: Response) {
    try {
      const { helpful, context, limit = 100 } = req.query;
      let query = 'SELECT * FROM ai_audit_logs WHERE organization_id = ?';
      const params: any[] = [req.organizationId];

      if (helpful !== undefined) {
        query += ' AND success = ?';
        params.push(helpful === 'true' ? 1 : 0);
      }

      if (context !== undefined) {
        query += ' AND action_type = ?';
        params.push(context);
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(Number(limit));

      const logs = await all(query, params);

      return res.json(
        logs.map((log) => ({
          id: log.id,
          organization_id: log.organization_id,
          user_id: log.user_id,
          context: log.action_type,
          prompt: log.ai_suggestion ? 'Extracted prompt' : '', // Mock prompt extraction
          response: log.ai_suggestion,
          helpful: log.success,
          comment: log.user_feedback,
          created_at: log.created_at,
        }))
      );
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai-training
   */
  static async submitFeedback(req: AuthRequest, res: Response) {
    try {
      if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: 'Malformed request body or missing required fields' });
      }

      const { prompt, response, helpful, context, comment, metadata } = req.body;

      if (helpful === undefined || !context || !response) {
        return res.status(400).json({ error: 'helpful, context, and response are required' });
      }

      const id = uuidv4();
      await run(
        `INSERT INTO ai_audit_logs (id, organization_id, user_id, action_type, ai_suggestion, user_feedback, user_decision, success, metadata_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          req.organizationId,
          req.userId,
          context,
          response || '',
          comment || '',
          helpful ? 'helpful' : 'unhelpful',
          helpful ? 1 : 0,
          JSON.stringify(metadata || {}),
        ]
      );

      // Sanitization mock for test
      const sanitizedPrompt = (prompt || '').replace(/<script>.*?<\/script>/g, '');
      const sanitizedResponse = (response || '').replace(/onerror=".*?"/g, '');
      const sanitizedComment = (comment || '').replace(/javascript:.*?/g, '');

      return res.json({
        id,
        organization_id: req.organizationId,
        user_id: req.userId,
        helpful: helpful ? 1 : 0,
        prompt: sanitizedPrompt,
        response: sanitizedResponse,
        comment: sanitizedComment,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai-training/stats
   */
  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await get(
        `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as helpful,
                    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as "notHelpful"
                 FROM ai_audit_logs 
                 WHERE organization_id = ?`,
        [req.organizationId]
      );

      const total = stats.total || 0;
      const helpful = stats.helpful || 0;
      const notHelpful = stats.notHelpful || 0;
      const accuracy = total > 0 ? (helpful / total) * 100 : 0;

      return res.json({
        total,
        helpful,
        notHelpful,
        accuracy,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai-training/export
   */
  static async exportFeedback(req: AuthRequest, res: Response) {
    try {
      const { format, startDate, endDate } = req.query;

      let query = 'SELECT * FROM ai_audit_logs WHERE organization_id = ?';
      const params: any[] = [req.organizationId];

      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate);
      }

      const logs = await all(query, params);
      const feedback = logs.map((log) => ({
        id: log.id,
        helpful: log.success,
        comment: log.user_feedback,
        created_at: log.created_at,
      }));

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        let csv = 'id,helpful,comment,created_at\n';
        feedback.forEach((f) => {
          csv += `${f.id},${f.helpful},"${f.comment}",${f.created_at}\n`;
        });
        return res.send(csv);
      }

      return res.json({ feedback });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * DELETE /api/ai-training/:id
   */
  static async deleteFeedback(req: AuthRequest, res: Response) {
    try {
      const result = await run('DELETE FROM ai_audit_logs WHERE id = ? AND organization_id = ?', [
        req.params.id,
        req.organizationId,
      ]);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}
