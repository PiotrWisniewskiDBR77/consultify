import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import { QueryAdapter } from '../utils/QueryAdapter.js';

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

type SeedKnownTool = {
  id: string;
  toolType: string;
  displayName: string;
  libraryCategory: 'strategic' | 'operational' | 'digital' | 'automation';
  descriptionEn: string;
  descriptionPl: string;
  whatYouGetEn: string[];
  whatYouGetPl: string[];
  tags: string[];
  icon: string | null;
  sortOrder: number;
};

const SQLITE_KNOWN_TOOLS_SEED: SeedKnownTool[] = [
  {
    id: 'tool-known-dynamic-swot',
    toolType: 'dynamic-swot',
    displayName: 'Dynamic SWOT',
    libraryCategory: 'strategic',
    descriptionEn: 'AI-powered SWOT that ends with actionable takeaways and initiative concepts.',
    descriptionPl:
      'SWOT wspierany przez AI, kończący się konkretnymi wnioskami i koncepcjami inicjatyw.',
    whatYouGetEn: ['Key takeaways', 'Risks & unknowns', 'Draft initiatives'],
    whatYouGetPl: ['Najważniejsze wnioski', 'Ryzyka i niewiadome', 'Draft inicjatyw'],
    tags: ['strategy', 'swot', 'diagnosis'],
    icon: 'Target',
    sortOrder: 101,
  },
  {
    id: 'tool-known-market-forces',
    toolType: 'market-forces',
    displayName: 'Market Forces (Porter)',
    libraryCategory: 'strategic',
    descriptionEn: 'Porter 5 Forces analysis translated into strategic risks and initiatives.',
    descriptionPl: 'Analiza 5 sił Portera przełożona na ryzyka strategiczne i inicjatywy.',
    whatYouGetEn: ['Force scorecard', 'Strategic levers', 'Draft initiatives'],
    whatYouGetPl: ['Scorecard 5 sił', 'Dźwignie strategiczne', 'Draft inicjatyw'],
    tags: ['strategy', 'porter', 'competition'],
    icon: 'TrendingUp',
    sortOrder: 102,
  },
  {
    id: 'tool-known-growth-paths',
    toolType: 'growth-paths',
    displayName: 'Growth Paths (Ansoff)',
    libraryCategory: 'strategic',
    descriptionEn:
      'Ansoff matrix to explore growth options and select viable paths with risk framing.',
    descriptionPl: 'Macierz Ansoffa do wyboru ścieżek wzrostu wraz z oceną ryzyk.',
    whatYouGetEn: ['Option map', 'Risk framing', 'Draft initiatives'],
    whatYouGetPl: ['Mapa opcji', 'Ocena ryzyk', 'Draft inicjatyw'],
    tags: ['strategy', 'ansoff', 'growth'],
    icon: 'ArrowRight',
    sortOrder: 103,
  },
  {
    id: 'tool-known-value-chain',
    toolType: 'value-chain',
    displayName: 'Value Chain Analysis',
    libraryCategory: 'strategic',
    descriptionEn:
      'Map activities and identify cost/value drivers to target improvements and initiatives.',
    descriptionPl: 'Mapa łańcucha wartości i identyfikacja dźwigni kosztu/wartości pod inicjatywy.',
    whatYouGetEn: ['Activity map', 'Hotspots', 'Draft initiatives'],
    whatYouGetPl: ['Mapa aktywności', 'Hotspoty', 'Draft inicjatyw'],
    tags: ['strategy', 'value-chain', 'operating-model'],
    icon: 'Map',
    sortOrder: 104,
  },
  {
    id: 'tool-known-portfolio-priority',
    toolType: 'portfolio-priority',
    displayName: 'Portfolio Prioritization',
    libraryCategory: 'strategic',
    descriptionEn: 'Prioritize initiatives and bets using impact/effort and constraints.',
    descriptionPl:
      'Priorytetyzacja inicjatyw i zakładów (impact/effort) z uwzględnieniem ograniczeń.',
    whatYouGetEn: ['Priority matrix', 'Top picks', 'Draft initiatives'],
    whatYouGetPl: ['Macierz priorytetów', 'Top wybory', 'Draft inicjatyw'],
    tags: ['strategy', 'prioritization', 'portfolio'],
    icon: 'ListTodo',
    sortOrder: 105,
  },
  {
    id: 'tool-known-risk-uncertainty',
    toolType: 'risk-uncertainty',
    displayName: 'Risk & Uncertainty',
    libraryCategory: 'strategic',
    descriptionEn: 'Structure risks, unknowns and mitigations before committing to initiatives.',
    descriptionPl: 'Strukturyzacja ryzyk, niewiadomych i mitigacji przed zatwierdzeniem inicjatyw.',
    whatYouGetEn: ['Risk register', 'Unknowns', 'Mitigations'],
    whatYouGetPl: ['Rejestr ryzyk', 'Niewiadome', 'Mitigacje'],
    tags: ['strategy', 'risk', 'uncertainty'],
    icon: 'AlertTriangle',
    sortOrder: 106,
  },
  {
    id: 'tool-known-capability-mapper',
    toolType: 'capability-mapper',
    displayName: 'Capability Mapper',
    libraryCategory: 'strategic',
    descriptionEn:
      'Map capabilities, maturity, and gaps to build a focused transformation roadmap.',
    descriptionPl: 'Mapa kompetencji i luk do zbudowania ukierunkowanego roadmapu transformacji.',
    whatYouGetEn: ['Capability map', 'Gap analysis', 'Draft initiatives'],
    whatYouGetPl: ['Mapa kompetencji', 'Analiza luk', 'Draft inicjatyw'],
    tags: ['strategy', 'capabilities', 'roadmap'],
    icon: 'Users',
    sortOrder: 107,
  },
  {
    id: 'tool-known-sop-builder',
    toolType: 'sop-builder',
    displayName: 'SOP Builder',
    libraryCategory: 'operational',
    descriptionEn:
      'Create clear standard operating procedures that improve repeatability and quality.',
    descriptionPl: 'Tworzenie SOP (standardów pracy) zwiększających powtarzalność i jakość.',
    whatYouGetEn: ['SOP draft', 'Checklist', 'Training-ready steps'],
    whatYouGetPl: ['Draft SOP', 'Checklist', 'Kroki do szkolenia'],
    tags: ['operations', 'sop', 'standard-work'],
    icon: 'CheckCircle2',
    sortOrder: 203,
  },
  {
    id: 'tool-known-a3-problem-solving',
    toolType: 'a3-problem-solving',
    displayName: 'A3 Problem Solving',
    libraryCategory: 'operational',
    descriptionEn: 'A3/PDCA problem solving translated into a concrete improvement plan.',
    descriptionPl: 'Rozwiązywanie problemów A3/PDCA przełożone na konkretny plan usprawnień.',
    whatYouGetEn: ['A3 summary', 'Root causes', 'Countermeasures'],
    whatYouGetPl: ['Podsumowanie A3', 'Przyczyny źródłowe', 'Countermeasures'],
    tags: ['operations', 'a3', 'root-cause'],
    icon: 'FileText',
    sortOrder: 201,
  },
  {
    id: 'tool-known-vsm-builder',
    toolType: 'vsm-builder',
    displayName: 'VSM Builder',
    libraryCategory: 'operational',
    descriptionEn: 'Value Stream Mapping to visualize flow, waste, and improvement priorities.',
    descriptionPl:
      'Mapowanie strumienia wartości (VSM) do wizualizacji przepływu, marnotrawstw i priorytetów usprawnień.',
    whatYouGetEn: ['Current-state map', 'Waste hotspots', 'Future-state actions'],
    whatYouGetPl: ['Mapa stanu obecnego', 'Hotspoty marnotrawstw', 'Akcje stanu przyszłego'],
    tags: ['operations', 'lean', 'vsm'],
    icon: 'Workflow',
    sortOrder: 202,
  },
  // Toolsets from Bundle 05 (T022–T024) — keep short/usable for SQLite demo
  {
    id: 'tool-known-constraint-control',
    toolType: 'constraint-control',
    displayName: 'Constraint Control (TOC)',
    libraryCategory: 'operational',
    descriptionEn: 'Identify and manage the system constraint to improve throughput and delivery.',
    descriptionPl:
      'Identyfikuj i zarządzaj wąskim gardłem (TOC), aby poprawić przepustowość i terminowość.',
    whatYouGetEn: ['Constraint hypothesis', 'Buffer policy', 'Action list'],
    whatYouGetPl: ['Hipoteza constraintu', 'Polityka buforów', 'Lista działań'],
    tags: ['operations', 'toc', 'throughput'],
    icon: 'Shield',
    sortOrder: 204,
  },
  {
    id: 'tool-known-decision-engine',
    toolType: 'decision-engine',
    displayName: 'Decision Engine',
    libraryCategory: 'operational',
    descriptionEn: 'Make trade-offs explicit with criteria, weights, and defensible decisions.',
    descriptionPl: 'Uczyń trade-offy jawne przez kryteria, wagi i obronne decyzje.',
    whatYouGetEn: ['Criteria set', 'Scored options', 'Decision rationale'],
    whatYouGetPl: ['Zestaw kryteriów', 'Scoring opcji', 'Uzasadnienie decyzji'],
    tags: ['operations', 'decision', 'prioritization'],
    icon: 'GitBranch',
    sortOrder: 205,
  },
  {
    id: 'tool-known-control-tower',
    toolType: 'control-tower',
    displayName: 'Control Tower',
    libraryCategory: 'operational',
    descriptionEn: 'Build an operational control tower: KPIs, thresholds, ownership, and cadence.',
    descriptionPl: 'Zbuduj control tower: KPI, progi, ownership i rytm zarządzania.',
    whatYouGetEn: ['KPI set', 'Thresholds', 'Operating cadence'],
    whatYouGetPl: ['Zestaw KPI', 'Progi', 'Cadence'],
    tags: ['operations', 'kpi', 'governance'],
    icon: 'Radar',
    sortOrder: 206,
  },
  {
    id: 'tool-known-automation-pipeline',
    toolType: 'automation-pipeline',
    displayName: 'Automation Pipeline',
    libraryCategory: 'operational',
    descriptionEn: 'Create a repeatable pipeline for spotting, sizing, and delivering automation.',
    descriptionPl: 'Zbuduj powtarzalny pipeline wykrywania, sizingu i dostarczania automatyzacji.',
    whatYouGetEn: ['Automation backlog', 'Sizing rules', 'Delivery checklist'],
    whatYouGetPl: ['Backlog automatyzacji', 'Reguły sizingu', 'Checklist delivery'],
    tags: ['operations', 'automation', 'pipeline'],
    icon: 'Zap',
    sortOrder: 207,
  },
  // Digital examples (T023)
  {
    id: 'tool-known-robotics-feasibility',
    toolType: 'robotics-feasibility',
    displayName: 'Robotics Feasibility',
    libraryCategory: 'digital',
    descriptionEn: 'Assess feasibility, prerequisites, and ROI for robotics in operations.',
    descriptionPl: 'Oceń wykonalność, prerekwizyty i ROI robotyki w operacjach.',
    whatYouGetEn: ['Feasibility score', 'Prerequisites', 'Pilot plan'],
    whatYouGetPl: ['Feasibility score', 'Prerekwizyty', 'Plan pilota'],
    tags: ['digital', 'robotics', 'automation'],
    icon: 'Bot',
    sortOrder: 301,
  },
  {
    id: 'tool-known-logistics-automation',
    toolType: 'logistics-automation',
    displayName: 'Logistics Automation',
    libraryCategory: 'digital',
    descriptionEn: 'Identify automation opportunities across warehousing and logistics flows.',
    descriptionPl: 'Zidentyfikuj możliwości automatyzacji w magazynie i logistyce.',
    whatYouGetEn: ['Opportunity map', 'Prerequisites', 'Roadmap'],
    whatYouGetPl: ['Mapa okazji', 'Prerekwizyty', 'Roadmapa'],
    tags: ['digital', 'logistics', 'warehouse'],
    icon: 'Truck',
    sortOrder: 302,
  },
  {
    id: 'tool-known-rpa-scanner',
    toolType: 'rpa-scanner',
    displayName: 'RPA Scanner',
    libraryCategory: 'digital',
    descriptionEn: 'Scan processes for RPA suitability and build a prioritized automation backlog.',
    descriptionPl: 'Skanuj procesy pod RPA i zbuduj priorytetyzowany backlog automatyzacji.',
    whatYouGetEn: ['Candidate list', 'Sizing fields', 'Backlog'],
    whatYouGetPl: ['Lista kandydatów', 'Sizing', 'Backlog'],
    tags: ['digital', 'rpa', 'backoffice'],
    icon: 'Scan',
    sortOrder: 303,
  },
  {
    id: 'tool-known-ai-discovery',
    toolType: 'ai-discovery',
    displayName: 'AI Discovery',
    libraryCategory: 'digital',
    descriptionEn:
      'Identify AI use-cases, prerequisites, and risk controls to move from idea to pilot.',
    descriptionPl: 'Zidentyfikuj use-case’y AI, prerekwizyty i kontrolę ryzyk — od idei do pilota.',
    whatYouGetEn: ['Use-case shortlist', 'Prerequisites', 'Pilot plan'],
    whatYouGetPl: ['Shortlista use-case', 'Prerekwizyty', 'Plan pilota'],
    tags: ['digital', 'ai', 'use-cases'],
    icon: 'Sparkles',
    sortOrder: 304,
  },
  {
    id: 'tool-known-process-automation',
    toolType: 'process-automation',
    displayName: 'Process Automation (Speed Tool)',
    libraryCategory: 'automation',
    descriptionEn:
      'Canonical method to identify, map, measure, redesign and justify process automation.',
    descriptionPl:
      'Kanoniczna metoda identyfikacji, mapowania, pomiaru, redesignu i uzasadnienia automatyzacji procesu.',
    whatYouGetEn: ['Process map', 'Baseline vs target', 'Economics & payback', 'Initiative set'],
    whatYouGetPl: ['Mapa procesu', 'Baseline vs target', 'Ekonomia i payback', 'Zestaw inicjatyw'],
    tags: ['automation', 'process', 'roi'],
    icon: 'Zap',
    sortOrder: 401,
  },
];

class KnownToolsService {
  private db: IDatabase | null = null;
  private ensuredSqliteSeed = false;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  private async ensureToolsSeedOnce(): Promise<void> {
    if (this.ensuredSqliteSeed) return;
    this.ensuredSqliteSeed = true;

    const db = await this.getDb();
    const q = new QueryAdapter(db);

    // Seed if empty (PostgreSQL; schema from migrations).
    try {
      const row = await q.get<{ total: number }>(
        `SELECT COUNT(*) as total FROM tools WHERE is_active = 1 AND tool_type IS NOT NULL`,
        []
      );
      const total = Number((row as any)?.total || 0);
      if (total > 0) return;

      for (const tool of SQLITE_KNOWN_TOOLS_SEED) {
        const descriptionTranslations = JSON.stringify({
          en: tool.descriptionEn,
          pl: tool.descriptionPl,
        });
        const libraryContentTranslations = JSON.stringify({
          en: { whatYouGet: tool.whatYouGetEn },
          pl: { whatYouGet: tool.whatYouGetPl },
        });
        const tagsJson = JSON.stringify(tool.tags || []);

        await q.run(
          `INSERT INTO tools (
            id, name, tool_type, display_name, category, library_category,
            description, description_translations, library_content_translations,
            icon, is_licensed, is_active, is_coming_soon, tags_json, sort_order
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?, ?
          ) ON CONFLICT (id) DO NOTHING`,
          [
            tool.id,
            tool.toolType,
            tool.toolType,
            tool.displayName,
            'analysis',
            tool.libraryCategory,
            tool.descriptionEn,
            descriptionTranslations,
            libraryContentTranslations,
            tool.icon,
            0,
            1,
            0,
            tagsJson,
            tool.sortOrder,
          ]
        );
      }
    } catch {
      // ignore
    }
  }

  async listKnownTools(params: {
    lang?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: KnownToolListItem[]; total: number; limit: number; offset: number }> {
    await this.ensureToolsSeedOnce();
    const db = await this.getDb();
    const q = new QueryAdapter(db);
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

    const countRow = await q.get<{ total: unknown }>(
      `SELECT COUNT(*) as total FROM tools ${whereSql}`,
      args
    );
    const total = Number((countRow as any)?.total || 0);

    const rows = await q.all<ToolRow>(
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
    await this.ensureToolsSeedOnce();
    const db = await this.getDb();
    const q = new QueryAdapter(db);
    const lang = normalizeLanguage(langRaw);
    const toolType = String(toolTypeOrName || '').trim();
    if (!toolType) return null;

    const row = await q.get<ToolRow>(
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
