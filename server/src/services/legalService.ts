/**
 * Legal Service
 * T093: Legal Agreements — versioning, acceptance tracking, publishing
 * Database: PostgreSQL (pg Pool)
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type LegalDocType =
  | 'TOS'
  | 'PRIVACY'
  | 'AUP'
  | 'AI_POLICY'
  | 'COOKIES'
  | 'DPA'
  | 'SUBSCRIPTION'
  | 'SLA'
  | 'REFUND'
  | 'SECURITY'
  | 'CUSTOMER_SECURITY'
  | 'SUBPROCESSORS';

export const REQUIRED_DOC_TYPES: LegalDocType[] = ['TOS', 'PRIVACY'];
export const REQUIRED_IF_AI: LegalDocType[] = ['AI_POLICY', 'AUP'];
export const ORG_ADMIN_DOC_TYPES: LegalDocType[] = ['DPA'];

export interface LegalDocumentRow {
  id: string;
  doc_type: string;
  type?: string;
  version: string;
  title: string;
  name?: string;
  content_md?: string;
  content?: string;
  effective_from?: string;
  effective_date?: string;
  expires_at?: string;
  is_active: boolean | number;
  status?: string;
  change_summary?: string;
  scope_type?: string;
  scope_value?: string;
  previous_version_id?: string;
  created_by?: string;
  published_by?: string;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  requires_acceptance?: boolean | number;
  requires_reaccept_from?: string;
}

export interface LegalAcceptanceRow {
  id: string;
  user_id: string;
  organization_id?: string;
  document_id: string;
  document_type: string;
  document_version: string;
  accepted_at: string;
  ip_address?: string;
  user_agent?: string;
  scope?: string;
}

export interface ActiveDocument {
  id: string;
  docType: string;
  version: string;
  title: string;
  effectiveFrom: string | null;
  changeSummary?: string;
}

export interface FullDocument extends ActiveDocument {
  contentMd: string;
  expiresAt?: string;
  scopeType?: string;
  createdAt?: string;
}

export interface UserAcceptance {
  docType: string;
  version: string;
  acceptedAt: string;
  documentId: string;
  scope: string;
}

export interface PendingResult {
  required: ActiveDocument[];
  dpaPending: boolean;
  dpaDoc: ActiveDocument | null;
  isOrgAdmin: boolean;
  hasAnyPending: boolean;
}

// ==========================================
// HELPERS
// ==========================================

function normalizeDocType(row: LegalDocumentRow): string {
  return (row.doc_type || row.type || '').toUpperCase();
}

function normalizeTitle(row: LegalDocumentRow): string {
  return row.title || row.name || row.doc_type || '';
}

function normalizeContent(row: LegalDocumentRow): string {
  return row.content_md || row.content || '';
}

function normalizeEffectiveFrom(row: LegalDocumentRow): string | null {
  return row.effective_from || row.effective_date || null;
}

function isRowActive(row: LegalDocumentRow): boolean {
  if (row.is_active === true || row.is_active === 1) return true;
  if (row.status === 'active') return true;
  return false;
}

function toActiveDocument(row: LegalDocumentRow): ActiveDocument {
  return {
    id: row.id,
    docType: normalizeDocType(row),
    version: row.version,
    title: normalizeTitle(row),
    effectiveFrom: normalizeEffectiveFrom(row),
    changeSummary: row.change_summary || undefined,
  };
}

function toFullDocument(row: LegalDocumentRow): FullDocument {
  return {
    ...toActiveDocument(row),
    contentMd: normalizeContent(row),
    expiresAt: row.expires_at || undefined,
    scopeType: row.scope_type || 'global',
    createdAt: row.created_at || undefined,
  };
}

// ==========================================
// SERVICE
// ==========================================

class LegalService {
  /**
   * Get all active documents (one per docType, latest version)
   */
  async getActiveDocuments(): Promise<ActiveDocument[]> {
    try {
      const rows = await dbAll<LegalDocumentRow>(
        `SELECT * FROM legal_documents
         WHERE (is_active = TRUE OR status = 'active')
         ORDER BY COALESCE(doc_type, UPPER(type)), version DESC`,
        [],
        { fallback: false }
      );

      const byType = new Map<string, LegalDocumentRow>();
      for (const row of rows) {
        const dt = normalizeDocType(row);
        if (!byType.has(dt)) {
          byType.set(dt, row);
        }
      }

      return Array.from(byType.values()).map(toActiveDocument);
    } catch (error) {
      logger.error('[LegalService] getActiveDocuments error:', error);
      return [];
    }
  }

  /**
   * Get a single active document by docType with full content
   */
  async getActiveDocumentByType(docType: string): Promise<FullDocument | null> {
    try {
      const upperType = docType.toUpperCase();
      const row = await dbGet<LegalDocumentRow>(
        `SELECT * FROM legal_documents
         WHERE (COALESCE(doc_type, UPPER(type)) = ?)
           AND (is_active = TRUE OR status = 'active')
         ORDER BY version DESC
         LIMIT 1`,
        [upperType],
        { fallback: false }
      );

      if (!row) return null;
      return toFullDocument(row);
    } catch (error) {
      logger.error('[LegalService] getActiveDocumentByType error:', error);
      return null;
    }
  }

  /**
   * Get all acceptances for a user
   */
  async getUserAcceptances(userId: string): Promise<UserAcceptance[]> {
    try {
      const rows = await dbAll<LegalAcceptanceRow>(
        `SELECT * FROM legal_document_acceptances
         WHERE user_id = ?
         ORDER BY accepted_at DESC`,
        [userId],
        { fallback: false }
      );

      return rows.map((r) => ({
        docType: (r.document_type || '').toUpperCase(),
        version: r.document_version,
        acceptedAt: r.accepted_at,
        documentId: r.document_id,
        scope: r.scope || 'USER',
      }));
    } catch (error) {
      logger.error('[LegalService] getUserAcceptances error:', error);
      return [];
    }
  }

  /**
   * Get pending (required but not yet accepted) documents for a user
   */
  async getPendingDocuments(
    userId: string,
    organizationId?: string,
    userRole?: string
  ): Promise<PendingResult> {
    const activeDocs = await this.getActiveDocuments();
    const acceptances = await this.getUserAcceptances(userId);

    const acceptedMap = new Map<string, UserAcceptance>();
    for (const a of acceptances) {
      const key = a.docType;
      const existing = acceptedMap.get(key);
      if (!existing || a.acceptedAt > existing.acceptedAt) {
        acceptedMap.set(key, a);
      }
    }

    const isAdmin =
      userRole === 'owner' ||
      userRole === 'administrator' ||
      userRole === 'ADMIN' ||
      userRole === 'OWNER' ||
      userRole === 'SUPERADMIN';

    const required: ActiveDocument[] = [];
    let dpaPending = false;
    let dpaDoc: ActiveDocument | null = null;

    for (const doc of activeDocs) {
      const dt = doc.docType as LegalDocType;

      const isRequired = REQUIRED_DOC_TYPES.includes(dt) || REQUIRED_IF_AI.includes(dt);
      const isDPA = ORG_ADMIN_DOC_TYPES.includes(dt);

      if (!isRequired && !isDPA) continue;

      const acceptance = acceptedMap.get(dt);
      const isAccepted = acceptance && acceptance.version === doc.version;

      if (isDPA) {
        if (!isAccepted) {
          dpaPending = true;
          dpaDoc = doc;
        }
        continue;
      }

      if (!isAccepted) {
        required.push(doc);
      }
    }

    return {
      required,
      dpaPending,
      dpaDoc,
      isOrgAdmin: isAdmin,
      hasAnyPending: required.length > 0 || (dpaPending && isAdmin),
    };
  }

  /**
   * Record acceptance of documents
   */
  async acceptDocuments(
    userId: string,
    docTypes: string[],
    scope: 'USER' | 'ORG_ADMIN',
    ipAddress?: string,
    userAgent?: string,
    organizationId?: string
  ): Promise<{ accepted: string[]; errors: string[] }> {
    const accepted: string[] = [];
    const errors: string[] = [];

    for (const docType of docTypes) {
      try {
        const doc = await this.getActiveDocumentByType(docType);
        if (!doc) {
          errors.push(`No active document found for type: ${docType}`);
          continue;
        }

        const existingAcceptance = await dbGet<LegalAcceptanceRow>(
          `SELECT * FROM legal_document_acceptances
           WHERE user_id = ? AND document_id = ?`,
          [userId, doc.id],
          { fallback: false }
        );

        if (existingAcceptance) {
          await dbRun(
            `UPDATE legal_document_acceptances
             SET document_version = ?, accepted_at = CURRENT_TIMESTAMP,
                 ip_address = ?, user_agent = ?, scope = ?,
                 organization_id = ?, document_type = ?
             WHERE id = ?`,
            [
              doc.version,
              ipAddress || null,
              userAgent || null,
              scope,
              organizationId || null,
              doc.docType,
              existingAcceptance.id,
            ]
          );
        } else {
          const id = uuidv4();
          await dbRun(
            `INSERT INTO legal_document_acceptances
             (id, user_id, document_id, document_type, document_version,
              accepted_at, ip_address, user_agent, scope, organization_id)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
            [
              id,
              userId,
              doc.id,
              doc.docType,
              doc.version,
              ipAddress || null,
              userAgent || null,
              scope,
              organizationId || null,
            ]
          );
        }

        accepted.push(docType);
      } catch (error) {
        logger.error(`[LegalService] acceptDocuments error for ${docType}:`, error);
        errors.push(`Failed to accept ${docType}`);
      }
    }

    return { accepted, errors };
  }

  // ==========================================
  // SUPERADMIN METHODS
  // ==========================================

  async getAllDocuments(): Promise<LegalDocumentRow[]> {
    try {
      const rows = await dbAll<LegalDocumentRow>(
        `SELECT * FROM legal_documents ORDER BY COALESCE(doc_type, UPPER(type)), version DESC`,
        [],
        { fallback: false }
      );
      return rows;
    } catch (error) {
      logger.error('[LegalService] getAllDocuments error:', error);
      return [];
    }
  }

  async getDocumentById(id: string): Promise<LegalDocumentRow | null> {
    try {
      const row = await dbGet<LegalDocumentRow>(
        `SELECT * FROM legal_documents WHERE id = ?`,
        [id],
        { fallback: false }
      );
      return row || null;
    } catch (error) {
      logger.error('[LegalService] getDocumentById error:', error);
      return null;
    }
  }

  async publishDocument(data: {
    docType: string;
    version: string;
    title: string;
    contentMd: string;
    effectiveFrom: string;
    changeSummary?: string;
    scopeType?: string;
    scopeValue?: string;
    createdBy: string;
  }): Promise<LegalDocumentRow> {
    const id = uuidv4();
    const upperType = data.docType.toUpperCase();

    // Deactivate previous active version of this docType
    await dbRun(
      `UPDATE legal_documents
       SET is_active = FALSE, status = 'archived'
       WHERE (COALESCE(doc_type, UPPER(type)) = ?)
         AND (is_active = TRUE OR status = 'active')`,
      [upperType]
    );

    const previousDoc = await dbGet<LegalDocumentRow>(
      `SELECT id FROM legal_documents
       WHERE COALESCE(doc_type, UPPER(type)) = ?
       ORDER BY version DESC LIMIT 1`,
      [upperType],
      { fallback: false }
    );

    await dbRun(
      `INSERT INTO legal_documents
       (id, type, doc_type, name, title, version, content, content_md,
        status, is_active, effective_date, effective_from,
        change_summary, scope_type, scope_value, previous_version_id,
        created_by, published_by, created_at, updated_at, published_at,
        requires_acceptance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?,
               'active', TRUE, ?, ?,
               ?, ?, ?, ?,
               ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
               TRUE)`,
      [
        id,
        upperType,
        upperType,
        data.title,
        data.title,
        data.version,
        data.contentMd,
        data.contentMd,
        data.effectiveFrom,
        data.effectiveFrom,
        data.changeSummary || null,
        data.scopeType || 'global',
        data.scopeValue || null,
        previousDoc?.id || null,
        data.createdBy,
        data.createdBy,
      ]
    );

    const doc = await this.getDocumentById(id);
    return doc!;
  }

  async toggleDocumentActive(id: string): Promise<LegalDocumentRow | null> {
    const doc = await this.getDocumentById(id);
    if (!doc) return null;

    const newActive = !isRowActive(doc);
    const newStatus = newActive ? 'active' : 'archived';

    if (newActive) {
      const docType = normalizeDocType(doc);
      await dbRun(
        `UPDATE legal_documents
         SET is_active = FALSE, status = 'archived'
         WHERE COALESCE(doc_type, UPPER(type)) = ? AND id != ?
           AND (is_active = TRUE OR status = 'active')`,
        [docType, id]
      );
    }

    await dbRun(
      `UPDATE legal_documents SET is_active = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newActive, newStatus, id]
    );

    return this.getDocumentById(id);
  }
}

export const legalService = new LegalService();
export default legalService;
