import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase, RunResult } from '../../database/IDatabase.js';

export interface CategoryRecord {
    id: string;
    name: string;
    slug: string;
    description: string;
    content_type: string;
    parent_id?: string | null;
    sort_order: number;
    color: string;
    icon: string;
    organization_id?: string | null;
    is_active: number;
    created_at?: string;
    updated_at?: string;
    created_by?: string | null;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    description: string;
    contentType: string;
    parentId?: string | null;
    sortOrder: number;
    color: string;
    icon: string;
    organizationId?: string | null;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string | null;
    children?: Category[];
}

export interface CreateCategoryData {
    name: string;
    slug?: string | null;
    description?: string;
    contentType?: string;
    parentId?: string | null;
    sortOrder?: number;
    color?: string;
    icon?: string;
    organizationId?: string | null;
    createdBy?: string | null;
}

export interface UpdateCategoryData {
    name?: string;
    slug?: string;
    description?: string;
    contentType?: string;
    parentId?: string | null;
    sortOrder?: number;
    color?: string;
    icon?: string;
    isActive?: boolean;
}

export interface ListCategoriesOptions {
    contentType?: string | null;
    organizationId?: string | null;
    parentId?: string | null | undefined;
    includeInactive?: boolean;
}

export interface CategoryServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

export class CategoryService {
    private deps: CategoryServiceDependencies;

    constructor(deps?: Partial<CategoryServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4,
        };
    }

    setDependencies(newDeps: Partial<CategoryServiceDependencies>): void {
        this.deps = { ...this.deps, ...newDeps };
    }

    async createCategory(data: CreateCategoryData): Promise<Category> {
        const {
            name,
            slug = null,
            description = '',
            contentType = 'ALL',
            parentId = null,
            sortOrder = 0,
            color = '#6366F1',
            icon = 'folder',
            organizationId = null,
            createdBy = null,
        } = data;

        if (!name) {
            throw new Error('name is required');
        }

        const id = `cat-${this.deps.uuidv4()}`;
        const categorySlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const now = new Date().toISOString();

        try {
            await this.deps.db.run(
                `INSERT INTO content_categories (
                    id, name, slug, description, content_type, parent_id,
                    sort_order, color, icon, organization_id, is_active,
                    created_at, updated_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
                [
                    id,
                    name,
                    categorySlug,
                    description,
                    contentType,
                    parentId,
                    sortOrder,
                    color,
                    icon,
                    organizationId,
                    now,
                    now,
                    createdBy,
                ],
            );
        } catch (err: unknown) {
            const error = err as Error;
            if (error.message.includes('UNIQUE')) {
                throw new Error(`Category with slug '${categorySlug}' already exists`);
            }
            throw err;
        }

        return {
            id,
            name,
            slug: categorySlug,
            description,
            contentType,
            parentId,
            sortOrder,
            color,
            icon,
            organizationId,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            createdBy,
        };
    }

    async getCategoryById(id: string): Promise<Category | null> {
        const row = (await this.deps.db.get<CategoryRecord>('SELECT * FROM content_categories WHERE id = ?', [
            id,
        ])) as CategoryRecord | null;

        if (!row) return null;
        return this._mapCategoryRow(row);
    }

    async listCategories(options: ListCategoriesOptions = {}): Promise<Category[]> {
        const { contentType = null, organizationId = null, parentId = undefined, includeInactive = false } = options;
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (contentType) {
            conditions.push("(content_type = ? OR content_type = 'ALL')");
            params.push(contentType);
        }

        if (organizationId !== null) {
            conditions.push('(organization_id = ? OR organization_id IS NULL)');
            params.push(organizationId);
        }

        if (parentId !== undefined) {
            if (parentId === null) {
                conditions.push('parent_id IS NULL');
            } else {
                conditions.push('parent_id = ?');
                params.push(parentId);
            }
        }

        if (!includeInactive) {
            conditions.push('is_active = 1');
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const rows = (await this.deps.db.all<CategoryRecord>(
            `SELECT * FROM content_categories ${whereClause} ORDER BY sort_order, name`,
            params,
        )) as CategoryRecord[];

        return (rows || []).map((row) => this._mapCategoryRow(row));
    }

    async updateCategory(id: string, updates: UpdateCategoryData): Promise<Category> {
        const allowedFields = [
            'name',
            'slug',
            'description',
            'contentType',
            'parentId',
            'sortOrder',
            'color',
            'icon',
            'isActive',
        ];
        const setClauses: string[] = [];
        const values: unknown[] = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                const dbColumn = this._camelToSnake(key);
                setClauses.push(`${dbColumn} = ?`);
                values.push(key === 'isActive' ? (value ? 1 : 0) : value);
            }
        }

        if (setClauses.length === 0) {
            const existing = await this.getCategoryById(id);
            if (!existing) {
                throw new Error('Category not found');
            }
            return existing;
        }

        setClauses.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);

        const result = (await this.deps.db.run(
            `UPDATE content_categories SET ${setClauses.join(', ')} WHERE id = ?`,
            values,
        )) as RunResult;

        if (result.changes === 0) {
            throw new Error('Category not found');
        }

        const updated = await this.getCategoryById(id);
        if (!updated) {
            throw new Error('Failed to retrieve updated category');
        }
        return updated;
    }

    async deleteCategory(id: string): Promise<boolean> {
        const result = (await this.deps.db.run('DELETE FROM content_categories WHERE id = ?', [id])) as RunResult;

        return result.changes > 0;
    }

    async getCategoryTree(options: ListCategoriesOptions = {}): Promise<Category[]> {
        const categories = await this.listCategories(options);

        const buildTree = (parentId: string | null = null): Category[] => {
            return categories
                .filter((cat) => cat.parentId === parentId)
                .map((cat) => ({
                    ...cat,
                    children: buildTree(cat.id),
                }));
        };

        return buildTree(null);
    }

    private _mapCategoryRow(row: CategoryRecord): Category {
        return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: row.description,
            contentType: row.content_type,
            parentId: row.parent_id ?? null,
            sortOrder: row.sort_order,
            color: row.color,
            icon: row.icon,
            organizationId: row.organization_id ?? null,
            isActive: !!row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            createdBy: row.created_by ?? null,
        };
    }

    private _camelToSnake(str: string): string {
        return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    }
}
