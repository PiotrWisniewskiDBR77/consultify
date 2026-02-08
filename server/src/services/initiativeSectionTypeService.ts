/**
 * InitiativeSectionTypeService
 *
 * Manages initiative section types (the "block library" for initiative cards).
 * Analogous to report_builder_block_types for the Report Builder.
 *
 * Section types define what sections are available in initiative document views.
 * Templates reference section keys via visible_sections JSON to control which
 * sections appear and in what order.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import DbPromise from '../utils/DbPromise.js';

export interface InitiativeSectionType {
  id: string;
  organizationId: string | null;
  key: string;
  name: string;
  namePl: string | null;
  description: string | null;
  descriptionPl: string | null;
  category: 'content' | 'control' | 'meta';
  columnPosition: 'left' | 'right';
  defaultOrder: number;
  icon: string | null;
  iconColor: string | null;
  iconBg: string | null;
  componentKey: string;
  aiPromptTemplate: string | null;
  renderConfig: Record<string, any> | null;
  defaultConfig: Record<string, any> | null;
  isSystem: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSectionTypeParams {
  key: string;
  name: string;
  namePl?: string;
  description?: string;
  descriptionPl?: string;
  category?: 'content' | 'control' | 'meta';
  columnPosition?: 'left' | 'right';
  defaultOrder?: number;
  icon?: string;
  iconColor?: string;
  iconBg?: string;
  componentKey: string;
  aiPromptTemplate?: string;
  renderConfig?: Record<string, any>;
  defaultConfig?: Record<string, any>;
  organizationId?: string;
  createdBy?: string;
}

export interface UpdateSectionTypeParams {
  name?: string;
  namePl?: string;
  description?: string;
  descriptionPl?: string;
  category?: 'content' | 'control' | 'meta';
  columnPosition?: 'left' | 'right';
  defaultOrder?: number;
  icon?: string;
  iconColor?: string;
  iconBg?: string;
  componentKey?: string;
  aiPromptTemplate?: string;
  renderConfig?: Record<string, any>;
  defaultConfig?: Record<string, any>;
  isActive?: boolean;
}

export class InitiativeSectionTypeService {
  private db;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Get all section types (system + org-specific).
   */
  async getAllSectionTypes(organizationId?: string | null): Promise<InitiativeSectionType[]> {
    let sql = `SELECT * FROM initiative_section_types WHERE is_active = 1`;
    const params: any[] = [];

    if (organizationId) {
      sql += ` AND (organization_id IS NULL OR organization_id = ?)`;
      params.push(organizationId);
    } else {
      sql += ` AND organization_id IS NULL`;
    }

    sql += ` ORDER BY column_position, default_order, name`;

    const rows = await DbPromise.all<any>(this.db, sql, params);
    return rows.map((row) => this.parseRow(row));
  }

  /**
   * Get a single section type by ID.
   */
  async getSectionTypeById(id: string): Promise<InitiativeSectionType | null> {
    const sql = `SELECT * FROM initiative_section_types WHERE id = ?`;
    const row = await DbPromise.get<any>(this.db, sql, [id]);
    return row ? this.parseRow(row) : null;
  }

  /**
   * Get a single section type by key.
   */
  async getSectionTypeByKey(key: string, organizationId?: string | null): Promise<InitiativeSectionType | null> {
    let sql = `SELECT * FROM initiative_section_types WHERE key = ? AND is_active = 1`;
    const params: any[] = [key];

    if (organizationId) {
      sql += ` AND (organization_id IS NULL OR organization_id = ?)`;
      params.push(organizationId);
    }

    sql += ` ORDER BY organization_id DESC LIMIT 1`; // Prefer org-specific over system
    const row = await DbPromise.get<any>(this.db, sql, params);
    return row ? this.parseRow(row) : null;
  }

  /**
   * Create a new section type (organization-specific only).
   */
  async createSectionType(params: CreateSectionTypeParams): Promise<InitiativeSectionType> {
    const id = `ist-org-${uuidv4().slice(0, 8)}`;
    const sql = `
      INSERT INTO initiative_section_types (
        id, organization_id, key, name, name_pl, description, description_pl,
        category, column_position, default_order, icon, icon_color, icon_bg,
        component_key, ai_prompt_template, render_config, default_config,
        is_system, is_active, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await DbPromise.run(this.db, sql, [
      id,
      params.organizationId || null,
      params.key,
      params.name,
      params.namePl || null,
      params.description || null,
      params.descriptionPl || null,
      params.category || 'content',
      params.columnPosition || 'left',
      params.defaultOrder || 100,
      params.icon || null,
      params.iconColor || null,
      params.iconBg || null,
      params.componentKey,
      params.aiPromptTemplate || null,
      params.renderConfig ? JSON.stringify(params.renderConfig) : null,
      params.defaultConfig ? JSON.stringify(params.defaultConfig) : null,
      params.createdBy || null,
    ]);

    const created = await this.getSectionTypeById(id);
    if (!created) throw new Error('Failed to create section type');
    return created;
  }

  /**
   * Update a section type (organization-specific only; system types are immutable).
   */
  async updateSectionType(id: string, params: UpdateSectionTypeParams): Promise<InitiativeSectionType> {
    const existing = await this.getSectionTypeById(id);
    if (!existing) throw new Error('Section type not found');
    if (existing.isSystem) throw new Error('Cannot modify system section types');

    const updates: string[] = [];
    const values: any[] = [];

    if (params.name !== undefined) { updates.push('name = ?'); values.push(params.name); }
    if (params.namePl !== undefined) { updates.push('name_pl = ?'); values.push(params.namePl); }
    if (params.description !== undefined) { updates.push('description = ?'); values.push(params.description); }
    if (params.descriptionPl !== undefined) { updates.push('description_pl = ?'); values.push(params.descriptionPl); }
    if (params.category !== undefined) { updates.push('category = ?'); values.push(params.category); }
    if (params.columnPosition !== undefined) { updates.push('column_position = ?'); values.push(params.columnPosition); }
    if (params.defaultOrder !== undefined) { updates.push('default_order = ?'); values.push(params.defaultOrder); }
    if (params.icon !== undefined) { updates.push('icon = ?'); values.push(params.icon); }
    if (params.iconColor !== undefined) { updates.push('icon_color = ?'); values.push(params.iconColor); }
    if (params.iconBg !== undefined) { updates.push('icon_bg = ?'); values.push(params.iconBg); }
    if (params.componentKey !== undefined) { updates.push('component_key = ?'); values.push(params.componentKey); }
    if (params.aiPromptTemplate !== undefined) { updates.push('ai_prompt_template = ?'); values.push(params.aiPromptTemplate); }
    if (params.renderConfig !== undefined) { updates.push('render_config = ?'); values.push(JSON.stringify(params.renderConfig)); }
    if (params.defaultConfig !== undefined) { updates.push('default_config = ?'); values.push(JSON.stringify(params.defaultConfig)); }
    if (params.isActive !== undefined) { updates.push('is_active = ?'); values.push(params.isActive ? 1 : 0); }

    if (updates.length === 0) return existing;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE initiative_section_types SET ${updates.join(', ')} WHERE id = ?`;
    await DbPromise.run(this.db, sql, values);

    const updated = await this.getSectionTypeById(id);
    if (!updated) throw new Error('Failed to update section type');
    return updated;
  }

  /**
   * Soft-delete (deactivate) a section type. System types cannot be deleted.
   */
  async deleteSectionType(id: string): Promise<void> {
    const existing = await this.getSectionTypeById(id);
    if (!existing) throw new Error('Section type not found');
    if (existing.isSystem) throw new Error('Cannot delete system section types');

    await DbPromise.run(
      this.db,
      `UPDATE initiative_section_types SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
  }

  /**
   * Duplicate a system section type to an organization.
   */
  async duplicateSectionType(id: string, organizationId: string, createdBy?: string): Promise<InitiativeSectionType> {
    const source = await this.getSectionTypeById(id);
    if (!source) throw new Error('Source section type not found');

    return this.createSectionType({
      key: `${source.key}_custom`,
      name: `${source.name} (Custom)`,
      namePl: source.namePl ? `${source.namePl} (Własny)` : undefined,
      description: source.description || undefined,
      descriptionPl: source.descriptionPl || undefined,
      category: source.category,
      columnPosition: source.columnPosition,
      defaultOrder: source.defaultOrder,
      icon: source.icon || undefined,
      iconColor: source.iconColor || undefined,
      iconBg: source.iconBg || undefined,
      componentKey: source.componentKey,
      aiPromptTemplate: source.aiPromptTemplate || undefined,
      renderConfig: source.renderConfig || undefined,
      defaultConfig: source.defaultConfig || undefined,
      organizationId,
      createdBy,
    });
  }

  /**
   * Parse a DB row into an InitiativeSectionType object.
   */
  private parseRow(row: any): InitiativeSectionType {
    return {
      id: row.id,
      organizationId: row.organization_id,
      key: row.key,
      name: row.name,
      namePl: row.name_pl,
      description: row.description,
      descriptionPl: row.description_pl,
      category: row.category || 'content',
      columnPosition: row.column_position || 'left',
      defaultOrder: row.default_order || 100,
      icon: row.icon,
      iconColor: row.icon_color,
      iconBg: row.icon_bg,
      componentKey: row.component_key,
      aiPromptTemplate: row.ai_prompt_template,
      renderConfig: row.render_config ? JSON.parse(row.render_config) : null,
      defaultConfig: row.default_config ? JSON.parse(row.default_config) : null,
      isSystem: !!row.is_system,
      isActive: !!row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Dependency Injection for tests.
   */
  setDependencies(deps: { db?: any }) {
    if (deps.db) this.db = deps.db;
  }
}

export default new InitiativeSectionTypeService();
