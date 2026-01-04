import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

// Helper to promisify db.all
const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Helper to promisify db.get
const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Helper to promisify db.run
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
};

// ===== INSIGHTS ENDPOINTS =====

// Get all insights for a project
router.get('/projects/:projectId/insights', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { category, status } = req.query;
    
    let query = 'SELECT * FROM project_insights WHERE project_id = ?';
    const params = [projectId];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const insights = await dbAll(query, params);
    
    // Parse JSON fields
    const parsedInsights = insights.map(insight => ({
      ...insight,
      content: JSON.parse(insight.content || '{}'),
      source: insight.source ? JSON.parse(insight.source) : null,
      related_insights: insight.related_insights ? JSON.parse(insight.related_insights) : []
    }));
    
    res.json(parsedInsights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Create a new insight
router.post('/projects/:projectId/insights', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { 
      category, 
      title, 
      content, 
      source, 
      confidence = 'medium',
      status = 'draft',
      session_id,
      pmo_domain,
      related_insights = []
    } = req.body;
    
    const id = uuidv4();
    const userId = req.user?.id || 'system';
    
    await dbRun(`
      INSERT INTO project_insights (
        id, project_id, session_id, category, title, content, 
        source, confidence, status, related_insights, pmo_domain, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, 
      projectId, 
      session_id || null,
      category, 
      title, 
      JSON.stringify(content),
      source ? JSON.stringify(source) : null,
      confidence,
      status,
      JSON.stringify(related_insights),
      pmo_domain || null,
      userId
    ]);
    
    const insight = await dbGet('SELECT * FROM project_insights WHERE id = ?', [id]);
    
    res.status(201).json({
      ...insight,
      content: JSON.parse(insight.content),
      source: insight.source ? JSON.parse(insight.source) : null,
      related_insights: JSON.parse(insight.related_insights || '[]')
    });
  } catch (error) {
    console.error('Error creating insight:', error);
    res.status(500).json({ error: 'Failed to create insight' });
  }
});

// Update an insight
router.patch('/insights/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = await dbGet('SELECT * FROM project_insights WHERE id = ?', [id]);
    
    if (!existing) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    
    const allowedFields = ['title', 'content', 'confidence', 'status', 'pmo_domain', 'related_insights'];
    const setClause = [];
    const params = [];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClause.push(`${field} = ?`);
        if (field === 'content' || field === 'related_insights') {
          params.push(JSON.stringify(updates[field]));
        } else {
          params.push(updates[field]);
        }
      }
    }
    
    if (setClause.length > 0) {
      setClause.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      
      await dbRun(`UPDATE project_insights SET ${setClause.join(', ')} WHERE id = ?`, params);
    }
    
    const updated = await dbGet('SELECT * FROM project_insights WHERE id = ?', [id]);
    
    res.json({
      ...updated,
      content: JSON.parse(updated.content),
      source: updated.source ? JSON.parse(updated.source) : null,
      related_insights: JSON.parse(updated.related_insights || '[]')
    });
  } catch (error) {
    console.error('Error updating insight:', error);
    res.status(500).json({ error: 'Failed to update insight' });
  }
});

// Delete an insight
router.delete('/insights/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dbRun('DELETE FROM project_insights WHERE id = ?', [id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting insight:', error);
    res.status(500).json({ error: 'Failed to delete insight' });
  }
});

// ===== SESSIONS ENDPOINTS =====

// Get all sessions for a project
router.get('/projects/:projectId/sessions', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const sessions = await dbAll(`
      SELECT * FROM interview_sessions 
      WHERE project_id = ? 
      ORDER BY started_at DESC
    `, [projectId]);
    
    const parsedSessions = sessions.map(session => ({
      ...session,
      progress: JSON.parse(session.progress || '{}')
    }));
    
    res.json(parsedSessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Create a new session
router.post('/projects/:projectId/sessions', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { topic } = req.body;
    
    const id = uuidv4();
    const userId = req.user?.id || 'system';
    
    const initialProgress = {
      completed: [],
      current: 'objective',
      remaining: ['stakeholder', 'risk', 'assumption', 'constraint', 'decision', 'dependency', 'success_criteria']
    };
    
    await dbRun(`
      INSERT INTO interview_sessions (id, project_id, user_id, topic, progress)
      VALUES (?, ?, ?, ?, ?)
    `, [id, projectId, userId, topic || 'General Interview', JSON.stringify(initialProgress)]);
    
    const session = await dbGet('SELECT * FROM interview_sessions WHERE id = ?', [id]);
    
    res.status(201).json({
      ...session,
      progress: JSON.parse(session.progress)
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Complete a session
router.patch('/sessions/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    
    await dbRun(`
      UPDATE interview_sessions 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);
    
    const session = await dbGet('SELECT * FROM interview_sessions WHERE id = ?', [id]);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      ...session,
      progress: JSON.parse(session.progress)
    });
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// ===== MESSAGES ENDPOINTS =====

// Get messages for a session
router.get('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const messages = await dbAll(`
      SELECT * FROM interview_messages 
      WHERE session_id = ? 
      ORDER BY created_at ASC
    `, [sessionId]);
    
    const parsedMessages = messages.map(msg => ({
      ...msg,
      detected_insights: msg.detected_insights ? JSON.parse(msg.detected_insights) : []
    }));
    
    res.json(parsedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Add message to session
router.post('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { role, content, detected_insights = [] } = req.body;
    
    const id = uuidv4();
    
    await dbRun(`
      INSERT INTO interview_messages (id, session_id, role, content, detected_insights)
      VALUES (?, ?, ?, ?, ?)
    `, [id, sessionId, role, content, JSON.stringify(detected_insights)]);
    
    const message = await dbGet('SELECT * FROM interview_messages WHERE id = ?', [id]);
    
    res.status(201).json({
      ...message,
      detected_insights: JSON.parse(message.detected_insights || '[]')
    });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// ===== SEED DATA ENDPOINT =====

// Seed demo data for a project
router.post('/projects/:projectId/seed', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Create sample insights
    const sampleInsights = [
      {
        id: uuidv4(),
        category: 'objective',
        title: 'Digital Transformation Initiative',
        content: {
          description: 'Transform core business processes through digital technologies',
          measurable_outcomes: ['30% efficiency improvement', 'Customer satisfaction > 90%'],
          timeframe: '18 months',
          priority: 'high'
        },
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'SCOPE_CHANGE_CONTROL'
      },
      {
        id: uuidv4(),
        category: 'stakeholder',
        title: 'Executive Sponsor - CEO',
        content: {
          name: 'John Smith',
          role: 'CEO',
          influence: 'high',
          interest: 'high',
          engagement_strategy: 'Monthly steering committee meetings',
          communication_frequency: 'Weekly status updates'
        },
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'RESOURCE_RESPONSIBILITY'
      },
      {
        id: uuidv4(),
        category: 'risk',
        title: 'Technology Integration Risk',
        content: {
          description: 'Legacy systems may not integrate smoothly with new platform',
          probability: 'medium',
          impact: 'high',
          mitigation_strategy: 'Phased rollout with extensive testing',
          owner: 'Technical Lead',
          contingency: 'Parallel system operation for 3 months'
        },
        confidence: 'medium',
        status: 'confirmed',
        pmo_domain: 'RISK_ISSUE_MANAGEMENT'
      },
      {
        id: uuidv4(),
        category: 'assumption',
        title: 'Budget Availability',
        content: {
          statement: 'Full budget will be available at project start',
          validation_method: 'Finance approval confirmation',
          impact_if_false: 'Project timeline delay of 2-3 months',
          owner: 'Project Sponsor'
        },
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'GOVERNANCE_DECISION_MAKING'
      },
      {
        id: uuidv4(),
        category: 'constraint',
        title: 'Regulatory Compliance',
        content: {
          description: 'Must comply with GDPR and local data protection laws',
          type: 'regulatory',
          flexibility: 'none',
          impact_on_scope: 'Data handling procedures must be documented'
        },
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'GOVERNANCE_DECISION_MAKING'
      },
      {
        id: uuidv4(),
        category: 'decision',
        title: 'Cloud Platform Selection',
        content: {
          decision: 'Selected AWS as primary cloud provider',
          rationale: 'Best cost-performance ratio, existing expertise',
          alternatives_considered: ['Azure', 'GCP'],
          decision_maker: 'Technical Committee',
          date: '2024-01-15',
          reversibility: 'medium'
        },
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'GOVERNANCE_DECISION_MAKING'
      },
      {
        id: uuidv4(),
        category: 'dependency',
        title: 'HR System Upgrade',
        content: {
          description: 'HR system must be upgraded before employee portal launch',
          type: 'internal',
          dependent_project: 'HR Modernization Project',
          expected_completion: '2024-Q2',
          criticality: 'high',
          alternative_path: 'Manual data migration if delayed'
        },
        confidence: 'medium',
        status: 'draft',
        pmo_domain: 'SCHEDULE_MILESTONES'
      },
      {
        id: uuidv4(),
        category: 'success_criteria',
        title: 'User Adoption Rate',
        content: {
          criterion: '80% of target users actively using the system within 3 months',
          measurement_method: 'System analytics dashboard',
          target_value: '80%',
          current_baseline: '0%',
          verification_date: '2024-09-30'
        },
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'BENEFITS_REALIZATION'
      }
    ];
    
    // Insert insights
    for (const insight of sampleInsights) {
      await dbRun(`
        INSERT INTO project_insights (
          id, project_id, category, title, content, 
          confidence, status, pmo_domain, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        insight.id,
        projectId,
        insight.category,
        insight.title,
        JSON.stringify(insight.content),
        insight.confidence,
        insight.status,
        insight.pmo_domain,
        'system'
      ]);
    }
    
    // Create a sample session
    const sessionId = uuidv4();
    await dbRun(`
      INSERT INTO interview_sessions (id, project_id, user_id, topic, status, progress)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      sessionId,
      projectId,
      'system',
      'Initial Project Discovery',
      'completed',
      JSON.stringify({
        completed: ['objective', 'stakeholder', 'risk'],
        current: null,
        remaining: []
      })
    ]);
    
    res.json({ 
      success: true, 
      message: 'Demo data seeded successfully',
      insights_count: sampleInsights.length,
      sessions_count: 1
    });
  } catch (error) {
    console.error('Error seeding data:', error);
    res.status(500).json({ error: 'Failed to seed demo data' });
  }
});

// Get insight statistics for a project
router.get('/projects/:projectId/stats', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const stats = await dbAll(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft
      FROM project_insights 
      WHERE project_id = ?
      GROUP BY category
    `, [projectId]);
    
    const sessionsCount = await dbGet(`
      SELECT COUNT(*) as count FROM interview_sessions WHERE project_id = ?
    `, [projectId]);
    
    res.json({
      categories: stats,
      total_sessions: sessionsCount?.count || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
