// @ts-nocheck
// @ts-nocheck
/**
 * StudioService - Service for managing Studio documents
 *
 * Handles CRUD operations for visual diagrams and AI workspace
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';

export interface StudioDocument {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  type: string;
  nodes: any[];
  edges: any[];
  viewport?: { x: number; y: number; zoom: number };
  linkedTaskId?: string;
  linkedProjectId?: string;
  linkedInitiativeId?: string;
  isPublic?: boolean;
  shareToken?: string;
  tags?: string[];
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDocumentInput {
  name: string;
  description?: string;
  type?: string;
  nodes?: any[];
  edges?: any[];
  linkedTaskId?: string;
  linkedProjectId?: string;
  linkedInitiativeId?: string;
}

export interface UpdateDocumentInput {
  name?: string;
  description?: string;
  type?: string;
  nodes?: any[];
  edges?: any[];
  viewport?: { x: number; y: number; zoom: number };
  linkedTaskId?: string;
  linkedProjectId?: string;
  linkedInitiativeId?: string;
  isPublic?: boolean;
  tags?: string[];
  createSnapshot?: boolean;
  snapshotReason?: string;
}

export class StudioService {
  /**
   * Get all documents for an organization
   */
  async getDocuments(organizationId: string, userId: string): Promise<StudioDocument[]> {
    const db = getDatabase();

    try {
      const rows = await db.all<any[]>(
        `SELECT 
                    id, organization_id, name, description, type,
                    nodes_json, edges_json, viewport_json,
                    linked_task_id, linked_project_id, linked_initiative_id,
                    is_public, share_token, tags_json,
                    created_by, created_at, updated_at
                FROM studio_documents
                WHERE organization_id = ? OR created_by = ?
                ORDER BY updated_at DESC`,
        [organizationId, userId]
      );

      return rows.map(this.mapRowToDocument);
    } catch (error: any) {
      logger.error('[StudioService] Failed to get documents:', error);
      throw new Error('Failed to get documents');
    }
  }

  /**
   * Get a single document by ID.
   *
   * `organizationId` is REQUIRED and enforced in-app (not just accepted and
   * ignored, as the original implementation did — the caller's org/user was
   * never compared to the row, so any authenticated user who knew/guessed a
   * documentId could read/update/delete another organization's document via
   * GET/PUT/DELETE /studio/documents/:id). A document is visible when it
   * belongs to the caller's organization OR the caller is its creator —
   * mirroring the same `organization_id = ? OR created_by = ?` rule already
   * used by `getDocuments` — so behavior for an authorized caller is
   * unchanged; a cross-org caller now gets `null` (route responds 404,
   * matching the "don't reveal existence" convention already used for
   * `/forms/:formId`).
   */
  async getDocument(
    documentId: string,
    userId: string,
    organizationId: string
  ): Promise<StudioDocument | null> {
    const db = getDatabase();

    try {
      const row = await db.get<any>(
        `SELECT
                    id, organization_id, name, description, type,
                    nodes_json, edges_json, viewport_json,
                    linked_task_id, linked_project_id, linked_initiative_id,
                    is_public, share_token, tags_json,
                    created_by, created_at, updated_at
                FROM studio_documents
                WHERE id = ?`,
        [documentId]
      );

      if (!row) return null;
      if (row.organization_id !== organizationId && row.created_by !== userId) return null;

      return this.mapRowToDocument(row);
    } catch (error: any) {
      logger.error('[StudioService] Failed to get document:', error);
      throw new Error('Failed to get document');
    }
  }

  /**
   * Create a new document
   */
  async createDocument(
    organizationId: string,
    userId: string,
    input: CreateDocumentInput
  ): Promise<StudioDocument> {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    try {
      await db.run(
        `INSERT INTO studio_documents (
                    id, organization_id, name, description, type,
                    nodes_json, edges_json, viewport_json,
                    linked_task_id, linked_project_id, linked_initiative_id,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          organizationId,
          input.name || 'Untitled Diagram',
          input.description || null,
          input.type || 'process_flow',
          JSON.stringify(input.nodes || []),
          JSON.stringify(input.edges || []),
          JSON.stringify({ x: 0, y: 0, zoom: 1 }),
          input.linkedTaskId || null,
          input.linkedProjectId || null,
          input.linkedInitiativeId || null,
          userId,
          now,
          now,
        ]
      );

      logger.info(`[StudioService] Document created: ${id}`);

      return {
        id,
        organization_id: organizationId,
        name: input.name || 'Untitled Diagram',
        description: input.description,
        type: input.type || 'process_flow',
        nodes: input.nodes || [],
        edges: input.edges || [],
        viewport: { x: 0, y: 0, zoom: 1 },
        linkedTaskId: input.linkedTaskId,
        linkedProjectId: input.linkedProjectId,
        linkedInitiativeId: input.linkedInitiativeId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error: any) {
      logger.error('[StudioService] Failed to create document:', error);
      throw new Error('Failed to create document');
    }
  }

  /**
   * Update a document
   */
  async updateDocument(
    documentId: string,
    userId: string,
    organizationId: string,
    input: UpdateDocumentInput
  ): Promise<StudioDocument | null> {
    const db = getDatabase();
    const now = new Date().toISOString();

    try {
      // Get existing document first (org/creator-scoped — see getDocument)
      const existing = await this.getDocument(documentId, userId, organizationId);
      if (!existing) return null;

      // Create snapshot if requested
      if (input.createSnapshot) {
        await this.createSnapshot(
          documentId,
          userId,
          organizationId,
          input.snapshotReason || 'manual'
        );
      }

      // Build update query dynamically
      const updates: string[] = ['updated_at = ?'];
      const values: any[] = [now];

      if (input.name !== undefined) {
        updates.push('name = ?');
        values.push(input.name);
      }
      if (input.description !== undefined) {
        updates.push('description = ?');
        values.push(input.description);
      }
      if (input.type !== undefined) {
        updates.push('type = ?');
        values.push(input.type);
      }
      if (input.nodes !== undefined) {
        updates.push('nodes_json = ?');
        values.push(JSON.stringify(input.nodes));
      }
      if (input.edges !== undefined) {
        updates.push('edges_json = ?');
        values.push(JSON.stringify(input.edges));
      }
      if (input.viewport !== undefined) {
        updates.push('viewport_json = ?');
        values.push(JSON.stringify(input.viewport));
      }
      if (input.linkedTaskId !== undefined) {
        updates.push('linked_task_id = ?');
        values.push(input.linkedTaskId || null);
      }
      if (input.linkedProjectId !== undefined) {
        updates.push('linked_project_id = ?');
        values.push(input.linkedProjectId || null);
      }
      if (input.linkedInitiativeId !== undefined) {
        updates.push('linked_initiative_id = ?');
        values.push(input.linkedInitiativeId || null);
      }
      if (input.isPublic !== undefined) {
        updates.push('is_public = ?');
        values.push(input.isPublic ? 1 : 0);
      }
      if (input.tags !== undefined) {
        updates.push('tags_json = ?');
        values.push(JSON.stringify(input.tags));
      }

      values.push(documentId);

      await db.run(`UPDATE studio_documents SET ${updates.join(', ')} WHERE id = ?`, values);

      logger.info(`[StudioService] Document updated: ${documentId}`);

      return this.getDocument(documentId, userId, organizationId);
    } catch (error: any) {
      logger.error('[StudioService] Failed to update document:', error);
      throw new Error('Failed to update document');
    }
  }

  /**
   * Delete a document. `userId`/`organizationId` are enforced the same way
   * as `getDocument` before the row is removed — the original implementation
   * accepted only `documentId`, so any authenticated caller who knew/guessed
   * a documentId could permanently delete another organization's document.
   */
  async deleteDocument(
    documentId: string,
    userId: string,
    organizationId: string
  ): Promise<boolean> {
    const db = getDatabase();

    try {
      const existing = await this.getDocument(documentId, userId, organizationId);
      if (!existing) return false;

      const result = await db.run('DELETE FROM studio_documents WHERE id = ?', [documentId]);

      if (result.changes && result.changes > 0) {
        logger.info(`[StudioService] Document deleted: ${documentId}`);
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('[StudioService] Failed to delete document:', error);
      throw new Error('Failed to delete document');
    }
  }

  /**
   * Create a snapshot of the document. `organizationId` is enforced via
   * `getDocument` before any snapshot row is written — see that method's
   * comment for why this is required.
   */
  async createSnapshot(
    documentId: string,
    userId: string,
    organizationId: string,
    reason: string = 'manual'
  ): Promise<string> {
    const db = getDatabase();
    const snapshotId = uuidv4();
    const now = new Date().toISOString();

    try {
      // Get current document state (org/creator-scoped — see getDocument)
      const doc = await this.getDocument(documentId, userId, organizationId);
      if (!doc) throw new Error('Document not found');

      // Get next version number
      const versionRow = await db.get<{ maxVersion: number }>(
        'SELECT COALESCE(MAX(version), 0) as "maxVersion" FROM studio_snapshots WHERE document_id = ?',
        [documentId]
      );
      const nextVersion = (versionRow?.maxVersion || 0) + 1;

      await db.run(
        `INSERT INTO studio_snapshots (
                    id, document_id, version, nodes_json, edges_json, viewport_json,
                    snapshot_reason, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          snapshotId,
          documentId,
          nextVersion,
          JSON.stringify(doc.nodes),
          JSON.stringify(doc.edges),
          JSON.stringify(doc.viewport || { x: 0, y: 0, zoom: 1 }),
          reason,
          userId,
          now,
        ]
      );

      logger.info(`[StudioService] Snapshot created: ${snapshotId} (v${nextVersion})`);
      return snapshotId;
    } catch (error: any) {
      logger.error('[StudioService] Failed to create snapshot:', error);
      throw new Error('Failed to create snapshot');
    }
  }

  /**
   * Get document snapshots. `userId`/`organizationId` are enforced via
   * `getDocument` before snapshots are read — the original implementation
   * accepted only `documentId`, so any authenticated caller who knew/guessed
   * a documentId could read another organization's snapshot history.
   */
  async getSnapshots(documentId: string, userId: string, organizationId: string): Promise<any[]> {
    const db = getDatabase();

    try {
      const doc = await this.getDocument(documentId, userId, organizationId);
      if (!doc) return [];

      const rows = await db.all<any[]>(
        `SELECT 
                    id, document_id, version, name,
                    nodes_json, edges_json, viewport_json,
                    snapshot_reason, created_by, created_at
                FROM studio_snapshots
                WHERE document_id = ?
                ORDER BY version DESC`,
        [documentId]
      );

      return rows.map((row) => ({
        id: row.id,
        documentId: row.document_id,
        version: row.version,
        name: row.name,
        nodes: JSON.parse(row.nodes_json || '[]'),
        edges: JSON.parse(row.edges_json || '[]'),
        viewport: JSON.parse(row.viewport_json || '{"x":0,"y":0,"zoom":1}'),
        snapshotReason: row.snapshot_reason,
        createdBy: row.created_by,
        createdAt: row.created_at,
      }));
    } catch (error: any) {
      logger.error('[StudioService] Failed to get snapshots:', error);
      throw new Error('Failed to get snapshots');
    }
  }

  /**
   * Restore document from snapshot. `organizationId` is enforced via
   * `getDocument` against the snapshot's parent document before anything is
   * restored — the original implementation accepted only `userId`, so any
   * authenticated caller who knew/guessed a snapshotId could overwrite
   * another organization's document with that snapshot's contents.
   */
  async restoreSnapshot(
    snapshotId: string,
    userId: string,
    organizationId: string
  ): Promise<StudioDocument | null> {
    const db = getDatabase();

    try {
      const snapshot = await db.get<any>('SELECT * FROM studio_snapshots WHERE id = ?', [
        snapshotId,
      ]);

      if (!snapshot) return null;

      // Verify the snapshot's document belongs to the caller (org/creator-scoped)
      const doc = await this.getDocument(snapshot.document_id, userId, organizationId);
      if (!doc) return null;

      // Create a snapshot of current state before restoring
      await this.createSnapshot(snapshot.document_id, userId, organizationId, 'before_restore');

      // Update document with snapshot data
      return this.updateDocument(snapshot.document_id, userId, organizationId, {
        nodes: JSON.parse(snapshot.nodes_json || '[]'),
        edges: JSON.parse(snapshot.edges_json || '[]'),
        viewport: JSON.parse(snapshot.viewport_json || '{"x":0,"y":0,"zoom":1}'),
      });
    } catch (error: any) {
      logger.error('[StudioService] Failed to restore snapshot:', error);
      throw new Error('Failed to restore snapshot');
    }
  }

  /**
   * Map database row to document object
   */
  private mapRowToDocument(row: any): StudioDocument {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      description: row.description,
      type: row.type,
      nodes: JSON.parse(row.nodes_json || '[]'),
      edges: JSON.parse(row.edges_json || '[]'),
      viewport: JSON.parse(row.viewport_json || '{"x":0,"y":0,"zoom":1}'),
      linkedTaskId: row.linked_task_id,
      linkedProjectId: row.linked_project_id,
      linkedInitiativeId: row.linked_initiative_id,
      isPublic: row.is_public === 1,
      shareToken: row.share_token,
      tags: JSON.parse(row.tags_json || '[]'),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Export singleton instance
export const studioService = new StudioService();
