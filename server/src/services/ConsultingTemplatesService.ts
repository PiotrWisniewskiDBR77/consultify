import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import { QueryAdapter } from '../utils/QueryAdapter.js';

type TemplateRow = {
  id: string;
  slug: string;
  name: string;
  name_pl: string;
  category: string;
  archetype: string;
  description: string;
  description_pl: string;
  tags_json: string;
  output_mapping_json: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ConsultingTemplateItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  archetype: string;
  description: string;
  tags: string[];
  outputMapping: {
    reportSections: string[];
    deckSlides: string[];
    initiativeCategories: string[];
  };
  isActive: boolean;
  sortOrder: number;
};

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

class ConsultingTemplatesService {
  private async getDb(): Promise<IDatabase> {
    return getDatabase();
  }

  async listTemplates(params: {
    lang?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ templates: ConsultingTemplateItem[]; total: number }> {
    const db = await this.getDb();
    const qa = new QueryAdapter(db);
    const lang = params.lang === 'pl' ? 'pl' : 'en';

    let where = 'WHERE is_active = true';
    const queryParams: unknown[] = [];
    let paramIdx = 0;

    if (params.category) {
      paramIdx++;
      where += ` AND category = $${paramIdx}`;
      queryParams.push(params.category);
    }
    if (params.search) {
      paramIdx++;
      where += ` AND (name ILIKE $${paramIdx} OR name_pl ILIKE $${paramIdx} OR description ILIKE $${paramIdx})`;
      queryParams.push(`%${params.search}%`);
    }

    const limit = params.limit || 100;
    const offset = params.offset || 0;

    const countResult = await qa.get<{ count: string }>(
      `SELECT COUNT(*) as count FROM consulting_templates ${where}`,
      queryParams
    );
    const total = parseInt(countResult?.count || '0', 10);

    paramIdx++;
    const limitParam = paramIdx;
    paramIdx++;
    const offsetParam = paramIdx;

    const rows = await qa.all<TemplateRow>(
      `SELECT * FROM consulting_templates ${where} ORDER BY sort_order ASC LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...queryParams, limit, offset]
    );

    const templates = rows.map((row) => this.mapRow(row, lang));
    return { templates, total };
  }

  async getTemplate(slug: string, lang?: string): Promise<ConsultingTemplateItem | null> {
    const db = await this.getDb();
    const qa = new QueryAdapter(db);
    const row = await qa.get<TemplateRow>('SELECT * FROM consulting_templates WHERE slug = $1', [
      slug,
    ]);
    if (!row) return null;
    return this.mapRow(row, lang === 'pl' ? 'pl' : 'en');
  }

  private mapRow(row: TemplateRow, lang: string): ConsultingTemplateItem {
    return {
      id: row.id,
      slug: row.slug,
      name: lang === 'pl' ? row.name_pl : row.name,
      category: row.category,
      archetype: row.archetype,
      description: lang === 'pl' ? row.description_pl : row.description,
      tags: safeJsonParse(row.tags_json, []),
      outputMapping: safeJsonParse(row.output_mapping_json, {
        reportSections: [],
        deckSlides: [],
        initiativeCategories: [],
      }),
      isActive: row.is_active,
      sortOrder: row.sort_order,
    };
  }
}

export default new ConsultingTemplatesService();
