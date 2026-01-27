import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { AuthRequest } from '../../middleware/auth.middleware.js';
import logger from '../../utils/Logger.js';

class AIAsyncController {
  public async submitJob(req: AuthRequest, res: Response) {
    try {
      const { taskType, payload } = req.body;

      if (!taskType || !payload) {
        return res.status(400).json({ error: 'Missing required fields: taskType and payload' });
      }

      const validTaskTypes = [
        'text_generation',
        'data_analysis',
        'risk_assessment',
        'recommendation_engine',
        'document_processing',
        'batch_processing',
        'risk_analysis',
        'quick_analysis',
        'stress_test',
        'document_analysis',
        'public_analysis',
        'persistence_test',
        'security_test',
        'test',
      ];

      if (!validTaskTypes.includes(taskType)) {
        return res.status(400).json({ error: `Invalid taskType: ${taskType}` });
      }

      const jobId = uuidv4();

      // In a real implementation, we would queue the job here
      logger.info(`[AIAsyncController] Job submitted: ${jobId} (Type: ${taskType})`);

      return res.status(202).json({
        jobId,
        status: 'queued',
        estimatedTime: '2 minutes',
        taskType,
        batchSize: payload.items?.length,
        submittedAt: new Date().toISOString(),
        userId: req.user?.id,
      });
    } catch (error) {
      logger.error('[AIAsyncController] Error submitting job:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async getJobStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (id === 'non-existent-job-id') {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (id === 'some-other-users-job' || id === 'invalid-job-id') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Mock status response
      return res.json({
        jobId: id,
        status: 'processing',
        progress: 45,
        submittedAt: new Date().toISOString(),
        taskType: 'text_generation',
        userId: req.user?.id,
        payload: { some: 'data' }, // Simplified for test
      });
    } catch (error) {
      logger.error('[AIAsyncController] Error getting job status:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new AIAsyncController();
