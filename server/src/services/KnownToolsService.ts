import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';

type ToolRow = {
  id: string;
  name: string;
  tool_type?: string | null;
  display_name: string;
  category: string;
  library_category?: string | null;
  description?: string | null;
  description_translations?: string | null;
  library_content_translations?: string | null;
  icon?: string | null;
  is_licensed?: number | null;
  is_active?: number | null;
  is_coming_soon?: number | null;
  tags_json?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
};

export type KnownToolListItem = {
  id: string;
  toolType: string;
  name: string;
  libraryCategory: string | null;
  description: string;
  whatYouGet: string[];
  tags: string[];
  icon: string | null;
  isLicensed: boolean;
  isComingSoon: boolean;
  sortOrder: number;
  createdAt: string | null;
};

export type KnownToolDetail = KnownToolListItem & {
  whenToUse: string;
  inputs: string[];
  steps: string[];
  outputs: string[];
  commonMistakes: string[];
  example: string;
  nextSteps: string[];
  kbArticleSlug: string;
};

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeLanguage(lang: string | undefined): 'en' | 'pl' {
  return lang === 'pl' ? 'pl' : 'en';
}

function pickTranslation(
  rawTranslationsJson: string | null | undefined,
  lang: 'en' | 'pl',
  fallback: string
): string {
  const translations = safeJsonParse<Record<string, string>>(rawTranslationsJson, {});
  return translations[lang] || translations.en || fallback;
}

function pickLibraryContent(rawJson: string | null | undefined, lang: 'en' | 'pl') {
  const translations = safeJsonParse<Record<string, any>>(rawJson, {});
  const en = translations?.en && typeof translations.en === 'object' ? translations.en : {};
  const picked =
    translations?.[lang] && typeof translations[lang] === 'object' ? translations[lang] : {};
  return { ...en, ...picked };
}

class KnownToolsService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  async listKnownTools(params: {
    lang?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: KnownToolListItem[]; total: number; limit: number; offset: number }> {
    const db = await this.getDb();
    const lang = normalizeLanguage(params.lang);
    const limit = Math.min(50, Math.max(1, Number(params.limit || 20)));
    const offset = Math.max(0, Number(params.offset || 0));

    const where: string[] = ['is_active = 1', 'tool_type IS NOT NULL'];
    const args: any[] = [];

    if (params.category) {
      where.push('library_category = ?');
      args.push(params.category);
    }

    if (params.search && params.search.trim()) {
      where.push('(LOWER(display_name) LIKE ? OR LOWER(name) LIKE ?)');
      const q = `%${params.search.toLowerCase().trim()}%`;
      args.push(q, q);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRow = await db.get<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM tools ${whereSql}`,
      args
    );
    const total = countRow?.total || 0;

    const rows = await db.all<ToolRow>(
      `SELECT id, name, tool_type, display_name, library_category, description, description_translations,
              library_content_translations, icon, is_licensed, is_coming_soon, tags_json, sort_order, created_at
         FROM tools
         ${whereSql}
         ORDER BY sort_order ASC, display_name ASC
         LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    );

    const items: KnownToolListItem[] = (rows || []).map((row) => {
      const toolType = row.tool_type || row.name;
      const description = pickTranslation(
        row.description_translations,
        lang,
        row.description || ''
      );
      const content = pickLibraryContent(row.library_content_translations, lang);
      const whatYouGet = Array.isArray(content.whatYouGet) ? content.whatYouGet : [];
      const tags = safeJsonParse<string[]>(row.tags_json, []);
      return {
        id: row.id,
        toolType,
        name: row.display_name,
        libraryCategory: row.library_category || null,
        description,
        whatYouGet,
        tags,
        icon: row.icon || null,
        isLicensed: Boolean(row.is_licensed),
        isComingSoon: Boolean(row.is_coming_soon),
        sortOrder: Number(row.sort_order || 0),
        createdAt: row.created_at || null,
      };
    });

    return { items, total, limit, offset };
  }

  async getKnownTool(toolTypeOrName: string, langRaw?: string): Promise<KnownToolDetail | null> {
    const db = await this.getDb();
    const lang = normalizeLanguage(langRaw);
    const toolType = String(toolTypeOrName || '').trim();
    if (!toolType) return null;

    const row = await db.get<ToolRow>(
      `SELECT id, name, tool_type, display_name, library_category, description, description_translations,
              library_content_translations, icon, is_licensed, is_coming_soon, tags_json, sort_order, created_at
         FROM tools
        WHERE is_active = 1
          AND (tool_type = ? OR name = ?)
        LIMIT 1`,
      [toolType, toolType]
    );

    if (!row) return null;

    const resolvedToolType = row.tool_type || row.name;
    const description = pickTranslation(row.description_translations, lang, row.description || '');
    const content = pickLibraryContent(row.library_content_translations, lang);

    const detail: KnownToolDetail = {
      id: row.id,
      toolType: resolvedToolType,
      name: row.display_name,
      libraryCategory: row.library_category || null,
      description,
      whatYouGet: Array.isArray(content.whatYouGet) ? content.whatYouGet : [],
      tags: safeJsonParse<string[]>(row.tags_json, []),
      icon: row.icon || null,
      isLicensed: Boolean(row.is_licensed),
      isComingSoon: Boolean(row.is_coming_soon),
      sortOrder: Number(row.sort_order || 0),
      createdAt: row.created_at || null,
      whenToUse: typeof content.whenToUse === 'string' ? content.whenToUse : '',
      inputs: Array.isArray(content.inputs) ? content.inputs : [],
      steps: Array.isArray(content.steps) ? content.steps : [],
      outputs: Array.isArray(content.outputs) ? content.outputs : [],
      commonMistakes: Array.isArray(content.commonMistakes) ? content.commonMistakes : [],
      example: typeof content.example === 'string' ? content.example : '',
      nextSteps: Array.isArray(content.nextSteps) ? content.nextSteps : [],
      kbArticleSlug: `tools-${resolvedToolType}-how-to`,
    };

    return detail;
  }
}

export default new KnownToolsService();
