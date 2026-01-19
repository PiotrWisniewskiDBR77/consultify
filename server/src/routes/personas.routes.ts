/**
 * Personas Routes - CRUD and marketplace for AI personas
 *
 * @version 1.0.0
 */

import express, { Request, Response, Router } from 'express';
import { v4 as uuid } from 'uuid';

import * as DbPromise from '../utils/DbPromise.js';

const router: Router = express.Router();

interface Persona {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  system_prompt: string;
  instructions?: string;
  starter_prompts?: string[];
  knowledge_sources?: string[];
  capabilities?: string[];
  model_preference?: string;
  temperature?: number;
  max_tokens?: number;
  visibility: 'private' | 'organization' | 'public';
  category?: string;
  tags?: string[];
  created_by: string;
  organization_id?: string;
  usage_count: number;
  rating: number;
  rating_count: number;
  is_featured: number;
  is_verified: number;
  version: number;
  created_at: string;
  updated_at: string;
}

interface PersonaCreateRequest {
  name: string;
  description?: string;
  avatar_url?: string;
  system_prompt: string;
  instructions?: string;
  starter_prompts?: string[];
  knowledge_sources?: string[];
  capabilities?: string[];
  model_preference?: string;
  temperature?: number;
  max_tokens?: number;
  visibility?: 'private' | 'organization' | 'public';
  category?: string;
  tags?: string[];
}

// Helper to parse JSON fields
function parsePersona(row: any): Persona {
  return {
    ...row,
    starter_prompts: row.starter_prompts ? JSON.parse(row.starter_prompts) : [],
    knowledge_sources: row.knowledge_sources ? JSON.parse(row.knowledge_sources) : [],
    capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
    tags: row.tags ? JSON.parse(row.tags) : [],
  };
}

/**
 * GET /personas - List personas
 * Query params: visibility, category, search, featured, page, limit
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'anonymous';
    const orgId = (req as any).user?.organizationId;
    const {
      visibility,
      category,
      search,
      featured,
      page = 1,
      limit = 20,
    } = req.query;

    let query = `
      SELECT p.*, 
             (SELECT COUNT(*) FROM ai_persona_favorites f WHERE f.persona_id = p.id AND f.user_id = ?) as is_favorited
      FROM ai_personas p
      WHERE (
        p.visibility = 'public' 
        OR p.created_by = ?
        ${orgId ? `OR (p.visibility = 'organization' AND p.organization_id = ?)` : ''}
        ${orgId ? `OR p.id IN (SELECT persona_id FROM ai_persona_shares WHERE shared_with_org_id = ?)` : ''}
      )
    `;

    const params: any[] = [userId, userId];
    if (orgId) {
      params.push(orgId, orgId);
    }

    if (visibility && visibility !== 'all') {
      query += ` AND p.visibility = ?`;
      params.push(visibility);
    }

    if (category) {
      query += ` AND p.category = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (featured === 'true') {
      query += ` AND p.is_featured = 1`;
    }

    query += ` ORDER BY p.is_featured DESC, p.rating DESC, p.usage_count DESC`;
    query += ` LIMIT ? OFFSET ?`;
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const rows = await DbPromise.all(query, params, { fallback: true });
    const personas = (rows || []).map(parsePersona);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ai_personas p WHERE p.visibility = 'public' OR p.created_by = ?`;
    const countResult = await DbPromise.get<{ total: number }>(countQuery, [userId], { fallback: true });

    res.json({
      personas,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        hasMore: (Number(page) * Number(limit)) < (countResult?.total || 0),
      },
    });
  } catch (error) {
    console.error('Error listing personas:', error);
    res.status(500).json({ error: 'Failed to list personas' });
  }
});

/**
 * GET /personas/marketplace - Featured marketplace personas
 */
router.get('/marketplace', async (req: Request, res: Response) => {
  try {
    const { category, sort = 'popular' } = req.query;

    let orderBy = 'p.usage_count DESC';
    if (sort === 'rating') orderBy = 'p.rating DESC';
    if (sort === 'newest') orderBy = 'p.created_at DESC';

    let query = `
      SELECT p.*
      FROM ai_personas p
      WHERE p.visibility = 'public'
    `;

    const params: any[] = [];

    if (category) {
      query += ` AND p.category = ?`;
      params.push(category);
    }

    query += ` ORDER BY p.is_featured DESC, ${orderBy} LIMIT 50`;

    const rows = await DbPromise.all(query, params, { fallback: true });
    const personas = (rows || []).map(parsePersona);

    // Get categories with counts
    const categoriesQuery = `
      SELECT category, COUNT(*) as count 
      FROM ai_personas 
      WHERE visibility = 'public' AND category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `;
    const categories = await DbPromise.all(categoriesQuery, [], { fallback: true });

    res.json({
      personas,
      categories: categories || [],
      featured: personas.filter((p) => p.is_featured),
    });
  } catch (error) {
    console.error('Error fetching marketplace:', error);
    res.status(500).json({ error: 'Failed to fetch marketplace' });
  }
});

/**
 * GET /personas/my - User's own personas
 */
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rows = await DbPromise.all(
      `SELECT * FROM ai_personas WHERE created_by = ? ORDER BY updated_at DESC`,
      [userId],
      { fallback: true }
    );

    res.json({ personas: (rows || []).map(parsePersona) });
  } catch (error) {
    console.error('Error fetching user personas:', error);
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

/**
 * GET /personas/favorites - User's favorited personas
 */
router.get('/favorites', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rows = await DbPromise.all(
      `SELECT p.* FROM ai_personas p
       INNER JOIN ai_persona_favorites f ON p.id = f.persona_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [userId],
      { fallback: true }
    );

    res.json({ personas: (rows || []).map(parsePersona) });
  } catch (error) {
    console.error('Error fetching favorite personas:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

/**
 * GET /personas/:id - Get single persona
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || 'anonymous';

    const row = await DbPromise.get(
      `SELECT p.*, 
              (SELECT COUNT(*) FROM ai_persona_favorites f WHERE f.persona_id = p.id AND f.user_id = ?) as is_favorited
       FROM ai_personas p WHERE p.id = ?`,
      [userId, id],
      { fallback: true }
    );

    if (!row) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    // Check access
    const persona = parsePersona(row);
    if (persona.visibility === 'private' && persona.created_by !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ persona });
  } catch (error) {
    console.error('Error fetching persona:', error);
    res.status(500).json({ error: 'Failed to fetch persona' });
  }
});

/**
 * POST /personas - Create new persona
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const orgId = (req as any).user?.organizationId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const data: PersonaCreateRequest = req.body;

    if (!data.name || !data.system_prompt) {
      return res.status(400).json({ error: 'Name and system_prompt are required' });
    }

    const id = `persona_${uuid()}`;
    const now = new Date().toISOString();

    await DbPromise.run(
      `INSERT INTO ai_personas (
        id, name, description, avatar_url, system_prompt, instructions,
        starter_prompts, knowledge_sources, capabilities, model_preference,
        temperature, max_tokens, visibility, category, tags,
        created_by, organization_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || null,
        data.avatar_url || null,
        data.system_prompt,
        data.instructions || null,
        JSON.stringify(data.starter_prompts || []),
        JSON.stringify(data.knowledge_sources || []),
        JSON.stringify(data.capabilities || []),
        data.model_preference || null,
        data.temperature || 0.7,
        data.max_tokens || 4096,
        data.visibility || 'private',
        data.category || null,
        JSON.stringify(data.tags || []),
        userId,
        orgId || null,
        now,
        now,
      ],
      { fallback: false }
    );

    const persona = await DbPromise.get(`SELECT * FROM ai_personas WHERE id = ?`, [id], {
      fallback: true,
    });

    res.status(201).json({ persona: parsePersona(persona) });
  } catch (error) {
    console.error('Error creating persona:', error);
    res.status(500).json({ error: 'Failed to create persona' });
  }
});

/**
 * PUT /personas/:id - Update persona
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const data: Partial<PersonaCreateRequest> = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check ownership
    const existing = await DbPromise.get(`SELECT * FROM ai_personas WHERE id = ?`, [id], {
      fallback: true,
    });

    if (!existing) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    if ((existing as any).created_by !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this persona' });
    }

    // Save version history
    await DbPromise.run(
      `INSERT INTO ai_persona_versions (id, persona_id, version, system_prompt, instructions, capabilities, changed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        id,
        (existing as any).version,
        (existing as any).system_prompt,
        (existing as any).instructions,
        (existing as any).capabilities,
        userId,
      ],
      { fallback: false }
    );

    const updateFields: string[] = [];
    const updateParams: any[] = [];

    if (data.name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(data.name);
    }
    if (data.description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(data.description);
    }
    if (data.avatar_url !== undefined) {
      updateFields.push('avatar_url = ?');
      updateParams.push(data.avatar_url);
    }
    if (data.system_prompt !== undefined) {
      updateFields.push('system_prompt = ?');
      updateParams.push(data.system_prompt);
    }
    if (data.instructions !== undefined) {
      updateFields.push('instructions = ?');
      updateParams.push(data.instructions);
    }
    if (data.starter_prompts !== undefined) {
      updateFields.push('starter_prompts = ?');
      updateParams.push(JSON.stringify(data.starter_prompts));
    }
    if (data.capabilities !== undefined) {
      updateFields.push('capabilities = ?');
      updateParams.push(JSON.stringify(data.capabilities));
    }
    if (data.visibility !== undefined) {
      updateFields.push('visibility = ?');
      updateParams.push(data.visibility);
    }
    if (data.category !== undefined) {
      updateFields.push('category = ?');
      updateParams.push(data.category);
    }
    if (data.tags !== undefined) {
      updateFields.push('tags = ?');
      updateParams.push(JSON.stringify(data.tags));
    }

    updateFields.push('version = version + 1');
    updateFields.push('updated_at = ?');
    updateParams.push(new Date().toISOString());
    updateParams.push(id);

    await DbPromise.run(
      `UPDATE ai_personas SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams,
      { fallback: false }
    );

    const updated = await DbPromise.get(`SELECT * FROM ai_personas WHERE id = ?`, [id], {
      fallback: true,
    });

    res.json({ persona: parsePersona(updated) });
  } catch (error) {
    console.error('Error updating persona:', error);
    res.status(500).json({ error: 'Failed to update persona' });
  }
});

/**
 * DELETE /personas/:id - Delete persona
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const existing = await DbPromise.get(`SELECT created_by FROM ai_personas WHERE id = ?`, [id], {
      fallback: true,
    });

    if (!existing) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    if ((existing as any).created_by !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this persona' });
    }

    await DbPromise.run(`DELETE FROM ai_personas WHERE id = ?`, [id], { fallback: false });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting persona:', error);
    res.status(500).json({ error: 'Failed to delete persona' });
  }
});

/**
 * POST /personas/:id/favorite - Toggle favorite
 */
router.post('/:id/favorite', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const existing = await DbPromise.get(
      `SELECT id FROM ai_persona_favorites WHERE persona_id = ? AND user_id = ?`,
      [id, userId],
      { fallback: true }
    );

    if (existing) {
      await DbPromise.run(
        `DELETE FROM ai_persona_favorites WHERE persona_id = ? AND user_id = ?`,
        [id, userId],
        { fallback: false }
      );
      res.json({ favorited: false });
    } else {
      await DbPromise.run(
        `INSERT INTO ai_persona_favorites (id, persona_id, user_id) VALUES (?, ?, ?)`,
        [uuid(), id, userId],
        { fallback: false }
      );
      res.json({ favorited: true });
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

/**
 * POST /personas/:id/rate - Rate a persona
 */
router.post('/:id/rate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { rating, review } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Upsert rating
    await DbPromise.run(
      `INSERT OR REPLACE INTO ai_persona_ratings (id, persona_id, user_id, rating, review)
       VALUES (
         COALESCE((SELECT id FROM ai_persona_ratings WHERE persona_id = ? AND user_id = ?), ?),
         ?, ?, ?, ?
       )`,
      [id, userId, uuid(), id, userId, rating, review || null],
      { fallback: false }
    );

    // Update aggregate rating
    const stats = await DbPromise.get(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM ai_persona_ratings WHERE persona_id = ?`,
      [id],
      { fallback: true }
    );

    await DbPromise.run(
      `UPDATE ai_personas SET rating = ?, rating_count = ?, updated_at = ? WHERE id = ?`,
      [(stats as any)?.avg_rating || 0, (stats as any)?.count || 0, new Date().toISOString(), id],
      { fallback: false }
    );

    res.json({ 
      rating, 
      averageRating: (stats as any)?.avg_rating || rating,
      totalRatings: (stats as any)?.count || 1,
    });
  } catch (error) {
    console.error('Error rating persona:', error);
    res.status(500).json({ error: 'Failed to rate persona' });
  }
});

/**
 * POST /personas/:id/use - Record persona usage
 */
router.post('/:id/use', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'anonymous';
    const orgId = (req as any).user?.organizationId;
    const { id } = req.params;
    const { conversation_id } = req.body;

    // Record usage
    await DbPromise.run(
      `INSERT INTO ai_persona_usage (id, persona_id, user_id, organization_id, conversation_id)
       VALUES (?, ?, ?, ?, ?)`,
      [uuid(), id, userId, orgId || null, conversation_id || null],
      { fallback: false }
    );

    // Increment usage count
    await DbPromise.run(
      `UPDATE ai_personas SET usage_count = usage_count + 1 WHERE id = ?`,
      [id],
      { fallback: false }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error recording usage:', error);
    res.status(500).json({ error: 'Failed to record usage' });
  }
});

/**
 * POST /personas/:id/duplicate - Duplicate/fork a persona
 */
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const orgId = (req as any).user?.organizationId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const original = await DbPromise.get(`SELECT * FROM ai_personas WHERE id = ?`, [id], {
      fallback: true,
    });

    if (!original) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    const orig = original as any;
    const newId = `persona_${uuid()}`;
    const now = new Date().toISOString();

    await DbPromise.run(
      `INSERT INTO ai_personas (
        id, name, description, avatar_url, system_prompt, instructions,
        starter_prompts, knowledge_sources, capabilities, model_preference,
        temperature, max_tokens, visibility, category, tags,
        created_by, organization_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        `${orig.name} (Copy)`,
        orig.description,
        orig.avatar_url,
        orig.system_prompt,
        orig.instructions,
        orig.starter_prompts,
        orig.knowledge_sources,
        orig.capabilities,
        orig.model_preference,
        orig.temperature,
        orig.max_tokens,
        'private', // Always start as private
        orig.category,
        orig.tags,
        userId,
        orgId || null,
        now,
        now,
      ],
      { fallback: false }
    );

    const newPersona = await DbPromise.get(`SELECT * FROM ai_personas WHERE id = ?`, [newId], {
      fallback: true,
    });

    res.status(201).json({ persona: parsePersona(newPersona) });
  } catch (error) {
    console.error('Error duplicating persona:', error);
    res.status(500).json({ error: 'Failed to duplicate persona' });
  }
});

export default router;
