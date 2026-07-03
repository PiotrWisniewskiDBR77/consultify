/**
 * Create Initiative Tool Handler
 * MUTATION - Requires user approval before execution.
 */

import { v4 as uuidv4 } from 'uuid';

import * as DbPromise from '../../../utils/DbPromise.js';
import { createInitiative as funnelCreateInitiative } from '../../initiative/createInitiativeService.js';

type CreateInitiativeParams = {
  projectId: string;
  title: string;
  description: string;
  priority: string;
  estimatedEffort?: string;
  toolSessionId?: string;
};

type ToolContext = {
  userId?: string;
  organizationId?: string;
};

export async function createInitiative(
  params: CreateInitiativeParams,
  context: ToolContext = {}
): Promise<Record<string, unknown>> {
  const { projectId, title, description, priority, estimatedEffort, toolSessionId } = params;
  const { userId, organizationId } = context;

  // Uspójnienie F1.9 — kanoniczny lejek tworzenia inicjatyw.
  if (process.env.INITIATIVE_FUNNEL_ENABLED === 'true') {
    const orgId = organizationId || '';
    const __r = await funnelCreateInitiative(
      orgId,
      {
        title,
        description: description ?? null,
        projectId: projectId ?? null,
        priority: priority ?? null,
        ownerBusinessId: userId ?? null,
        sourceType: 'tool',
        sourceId: toolSessionId ?? null,
      },
      { validate: false, actor: { id: userId } }
    );
    return {
      id: __r.id,
      status: 'CREATED',
      message: `Initiative "${title}" created successfully`,
    };
  }

  const id = uuidv4();

  try {
    await DbPromise.run(
      `INSERT INTO initiatives (id, project_id, title, description, priority, estimated_effort, status, created_by, organization_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'PROPOSED', ?, ?, datetime('now'))`,
      [
        id,
        projectId,
        title,
        description,
        priority,
        estimatedEffort || null,
        userId || null,
        organizationId || null,
      ],
      { fallback: false }
    );

    return {
      id,
      status: 'CREATED',
      message: `Initiative "${title}" created successfully`,
    };
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('no such table')) {
      return {
        id,
        status: 'SIMULATED',
        message: `Initiative "${title}" would be created (table not yet created)`,
      };
    }
    throw err;
  }
}

export default { createInitiative };
