/**
 * ideaAISuggestionsService — AI suggestions orchestrator for Idea Workspace.
 *
 * Collects company context (assessments, interviews, KPIs, initiatives)
 * and generates contextual suggestions via LLM structured output.
 */

import logger from '../utils/Logger.js';
import organizationContextService from './organizationContext/OrganizationContextService.js';

interface CompanyContext {
  initiatives: Array<{ id: string; title: string; status: string; level: string }>;
  assessmentScores: Array<{
    framework: string;
    dimension: string;
    score: number;
    maxScore: number;
  }>;
  interviewInsights: Array<{ topic: string; insight: string; frequency: number }>;
  kpiHighlights: Array<{ name: string; target: number; actual: number; status: string }>;
}

interface SuggestionContext {
  title: string;
  seedText: string;
  currentNodes: Array<{ id: string; type?: string; label?: string }>;
  currentEdges: Array<{ source: string; target: string }>;
  activeTool: string;
}

interface AISuggestion {
  id: string;
  category:
    | 'branch_suggestions'
    | 'row_suggestions'
    | 'connection_suggestions'
    | 'risk_flags'
    | 'framework_recommendations'
    | 'topics'
    | 'findings'
    | 'next_steps';
  text: string;
  detail?: string;
  confidence: number;
  source?: string;
  actionType?: 'add_node' | 'add_edge' | 'add_column' | 'use_tool' | 'info';
  actionPayload?: Record<string, unknown>;
}

interface SuggestionsResult {
  suggestions: AISuggestion[];
  companyContextUsed: boolean;
}

export async function buildCompanyContext(
  userId: string,
  orgId: string,
  queryHelpers: any
): Promise<CompanyContext> {
  const ctx: CompanyContext = {
    initiatives: [],
    assessmentScores: [],
    interviewInsights: [],
    kpiHighlights: [],
  };

  try {
    const resolved = await organizationContextService.buildResolvedContext(orgId);
    ctx.interviewInsights = resolved.signals.interviewInsights.map((insight) => ({
      topic: 'organization_context',
      insight,
      frequency: 1,
    }));
    resolved.operations.gaps.forEach((gap) => {
      const description = String(gap.description || gap.category || '').trim();
      if (!description) return;
      ctx.interviewInsights.push({
        topic: 'open_gap',
        insight: description,
        frequency: 1,
      });
    });
  } catch {
    /* context resolver may be unavailable during rollout */
  }

  try {
    const initiatives = await queryHelpers.query(
      `SELECT id, title, status, level FROM initiatives WHERE organization_id = ? ORDER BY updated_at DESC LIMIT 20`,
      [orgId]
    );
    ctx.initiatives = (initiatives || []).map((i: any) => ({
      id: String(i.id),
      title: String(i.title || ''),
      status: String(i.status || ''),
      level: String(i.level || ''),
    }));
  } catch {
    /* table may not exist */
  }

  try {
    const assessments = await queryHelpers.query(
      `SELECT framework_id as "frameworkId", dimension_scores as "dimensionScores"
       FROM assessment_reports
       WHERE organization_id = ? AND status = 'COMPLETED'
       ORDER BY updated_at DESC LIMIT 5`,
      [orgId]
    );
    for (const a of assessments || []) {
      try {
        const scores =
          typeof a.dimensionScores === 'string' ? JSON.parse(a.dimensionScores) : a.dimensionScores;
        if (scores && typeof scores === 'object') {
          for (const [dim, val] of Object.entries(scores)) {
            const score = typeof val === 'number' ? val : (val as any)?.score;
            if (typeof score === 'number') {
              ctx.assessmentScores.push({
                framework: String(a.frameworkId || ''),
                dimension: dim,
                score,
                maxScore: (val as any)?.maxScore || 5,
              });
            }
          }
        }
      } catch {
        /* parse error */
      }
    }
  } catch {
    /* table may not exist */
  }

  try {
    const insights = await queryHelpers.query(
      `SELECT topic, insight_text as "insightText", COUNT(*) as frequency
       FROM interview_insights
       WHERE organization_id = ?
       GROUP BY topic, insight_text
       ORDER BY frequency DESC
       LIMIT 15`,
      [orgId]
    );
    ctx.interviewInsights = [
      ...ctx.interviewInsights,
      ...(insights || []).map((i: any) => ({
        topic: String(i.topic || ''),
        insight: String(i.insightText || ''),
        frequency: Number(i.frequency) || 1,
      })),
    ];
  } catch {
    /* table may not exist */
  }

  try {
    const kpis = await queryHelpers.query(
      `SELECT name, target_value as "targetValue", actual_value as "actualValue", status
       FROM kpi_entries
       WHERE organization_id = ?
       ORDER BY updated_at DESC LIMIT 10`,
      [orgId]
    );
    ctx.kpiHighlights = (kpis || []).map((k: any) => ({
      name: String(k.name || ''),
      target: Number(k.targetValue) || 0,
      actual: Number(k.actualValue) || 0,
      status: String(k.status || ''),
    }));
  } catch {
    /* table may not exist */
  }

  return ctx;
}

export async function generateSuggestions(
  ideaId: string,
  context: SuggestionContext,
  mode: 'passive' | 'on_demand' | 'batch',
  prompt: string | undefined,
  userId: string,
  orgId: string,
  queryHelpers: any,
  language: string
): Promise<SuggestionsResult> {
  const companyCtx = await buildCompanyContext(userId, orgId, queryHelpers);
  const hasCompanyData =
    companyCtx.initiatives.length > 0 ||
    companyCtx.assessmentScores.length > 0 ||
    companyCtx.interviewInsights.length > 0 ||
    companyCtx.kpiHighlights.length > 0;

  const existingLabels = context.currentNodes
    .map((n) => n.label || '')
    .filter(Boolean)
    .slice(0, 50);

  // Język odpowiedzi z TREŚCI (tytuł/opis/etykiety), flaga UI tylko jako fallback.
  const { resolveResponseLanguage, languageInstruction } = await import('./ai/responseLanguage.js');
  const respLang = resolveResponseLanguage({
    requested: language,
    samples: [context.title, context.seedText, ...existingLabels],
  });
  const isPl = respLang === 'pl';

  const systemPrompt = `You are a consulting AI assistant helping to develop business ideas and strategies.
You generate actionable suggestions for an idea workspace.
The user is working on: "${context.title}"
Description: "${(context.seedText || '').slice(0, 2000)}"
Active tool: ${context.activeTool}
Existing nodes: ${existingLabels.join(', ')}
${
  hasCompanyData
    ? `\nCompany context:
- ${companyCtx.initiatives.length} active initiatives
- Assessment scores: ${companyCtx.assessmentScores
        .slice(0, 5)
        .map((s) => `${s.framework}/${s.dimension}: ${s.score}/${s.maxScore}`)
        .join(', ')}
- Interview insights: ${companyCtx.interviewInsights
        .slice(0, 5)
        .map((i) => `"${i.insight}" (${i.frequency}x)`)
        .join(', ')}
- KPI highlights: ${companyCtx.kpiHighlights
        .slice(0, 5)
        .map((k) => `${k.name}: ${k.actual}/${k.target} (${k.status})`)
        .join(', ')}`
    : ''
}

${languageInstruction(respLang)}
Return a JSON array of suggestions. Each suggestion has:
- category: one of "branch_suggestions", "row_suggestions", "risk_flags", "framework_recommendations", "topics", "findings", "next_steps"
- text: short actionable text (max 100 chars)
- detail: explanation (max 200 chars)
- confidence: 0.0-1.0
- source: what data this is based on (e.g. "SIRI assessment", "interview data", "KPI gap")
Generate 6-10 diverse suggestions. Prioritize suggestions grounded in company data when available.`;

  const userMessage = prompt
    ? `User asks: "${prompt}"\n\nGenerate suggestions relevant to this question.`
    : `Generate suggestions for the current workspace state.`;

  try {
    const { llmService } = await import('./ai/llmService.js');
    const modelRouter = (await import('./ai/modelRouter.js')).default;
    const modelCfg = await modelRouter.select({
      capability: 'chat',
      organizationId: orgId,
      options: { tier: 'STANDARD' },
    });

    const response = await llmService.call({
      type: 'text',
      modelConfig: modelCfg,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      maxTokens: 2000,
    });

    const content = String((response as any)?.content || (response as any)?.message?.content || '');
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    }

    const suggestions: AISuggestion[] = (Array.isArray(parsed) ? parsed : parsed?.suggestions || [])
      .slice(0, 12)
      .map((s: any, idx: number) => ({
        id: `ai-sug-${Date.now()}-${idx}`,
        category: s.category || 'topics',
        text: String(s.text || '').slice(0, 200),
        detail: s.detail ? String(s.detail).slice(0, 400) : undefined,
        confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0.7,
        source: s.source ? String(s.source) : undefined,
        actionType: s.actionType || 'info',
        actionPayload: s.actionPayload || undefined,
      }));

    return { suggestions, companyContextUsed: hasCompanyData };
  } catch (err: any) {
    logger.error('[ideaAISuggestionsService] LLM error:', err?.message);
    return {
      suggestions: generateFallbackSuggestions(context, companyCtx, isPl),
      companyContextUsed: hasCompanyData,
    };
  }
}

function generateFallbackSuggestions(
  context: SuggestionContext,
  companyCtx: CompanyContext,
  isPl: boolean
): AISuggestion[] {
  const ts = Date.now();
  const suggestions: AISuggestion[] = [];

  if (companyCtx.assessmentScores.length > 0) {
    const weakest = [...companyCtx.assessmentScores].sort(
      (a, b) => a.score / a.maxScore - b.score / b.maxScore
    )[0];
    if (weakest) {
      suggestions.push({
        id: `fb-${ts}-1`,
        category: 'risk_flags',
        text: isPl
          ? `Niski wynik: ${weakest.dimension} (${weakest.score}/${weakest.maxScore})`
          : `Low score: ${weakest.dimension} (${weakest.score}/${weakest.maxScore})`,
        detail: isPl
          ? `Assessment ${weakest.framework} wskazuje na lukę w tym obszarze`
          : `${weakest.framework} assessment indicates a gap in this area`,
        confidence: 0.85,
        source: `${weakest.framework} assessment`,
      });
    }
  }

  if (companyCtx.interviewInsights.length > 0) {
    const top = companyCtx.interviewInsights[0];
    suggestions.push({
      id: `fb-${ts}-2`,
      category: 'row_suggestions',
      text: isPl ? `Dodaj: ${top.insight.slice(0, 60)}` : `Add: ${top.insight.slice(0, 60)}`,
      detail: isPl
        ? `Wspomniane ${top.frequency}x w wywiadach (temat: ${top.topic})`
        : `Mentioned ${top.frequency}x in interviews (topic: ${top.topic})`,
      confidence: 0.8,
      source: 'interview data',
    });
  }

  if (companyCtx.kpiHighlights.length > 0) {
    const atRisk = companyCtx.kpiHighlights.find(
      (k) => k.status === 'at_risk' || k.actual < k.target * 0.7
    );
    if (atRisk) {
      suggestions.push({
        id: `fb-${ts}-3`,
        category: 'risk_flags',
        text: isPl
          ? `KPI zagrożone: ${atRisk.name} (${atRisk.actual}/${atRisk.target})`
          : `KPI at risk: ${atRisk.name} (${atRisk.actual}/${atRisk.target})`,
        confidence: 0.9,
        source: 'KPI data',
      });
    }
  }

  suggestions.push(
    {
      id: `fb-${ts}-4`,
      category: 'topics',
      text: isPl
        ? 'Analiza interesariuszy i ich wpływu'
        : 'Stakeholder analysis and impact assessment',
      detail: isPl ? 'Zidentyfikuj kluczowych interesariuszy' : 'Identify key stakeholders',
      confidence: 0.75,
    },
    {
      id: `fb-${ts}-5`,
      category: 'next_steps',
      text: isPl ? 'Zdefiniuj kryteria sukcesu i metryki' : 'Define success criteria and metrics',
      confidence: 0.8,
    },
    {
      id: `fb-${ts}-6`,
      category: 'framework_recommendations',
      text: isPl ? 'Rozważ użycie analizy SWOT' : 'Consider using SWOT analysis',
      detail: isPl
        ? 'Strukturyzacja mocnych/słabych stron, szans i zagrożeń'
        : 'Structure strengths, weaknesses, opportunities, threats',
      confidence: 0.7,
      source: 'consulting templates',
    }
  );

  return suggestions;
}

// B4 WIRED (W4): when the premium deliverables tier is active, generateTableAction
// calls generateTableSchema(intent, { orgId }) to produce a TYPED schema
// (singleSelect+colors / number / currency / date) + seed-rows, and returns it as
// a `schema_enrich` action. Gated behind ENABLE_DELIVERABLES_PREMIUM (B5 resolver).
// FAIL-OPEN: any premium failure falls back to the standard LLM-operations path.
export async function generateTableAction(
  ideaId: string,
  naturalLanguage: string,
  tableSchema: Array<{ key: string; header: string; type: string }>,
  userId: string,
  orgId: string,
  language: string
): Promise<{ type: string; [key: string]: any }> {
  // Język odpowiedzi z TREŚCI komendy i nagłówków tabeli (akcje `summarize` / `add_rows`
  // zwracają tekst dla użytkownika), flaga UI jako fallback.
  const { resolveResponseLanguage, languageInstruction } = await import('./ai/responseLanguage.js');
  const respLang = resolveResponseLanguage({
    requested: language,
    samples: [naturalLanguage, ...tableSchema.map((c) => String(c?.header || ''))],
  });
  const isPl = respLang === 'pl';

  // ── B4: Premium schema enrichment (flag-gated, fail-open) ──────────────────
  try {
    const { resolveDeliverableTier } = await import('./deliverableGenerationTier.js');
    if (resolveDeliverableTier({ orgId }) === 'PREMIUM') {
      const { generateTableSchema } = await import('./tableSchemaGeneratorService.js');
      const schema = await generateTableSchema(naturalLanguage, { orgId, userId });
      // Only use the premium schema if it produced meaningful output (quality gate
      // is internal to generateTableSchema; fallbackUsed=true means STANDARD path).
      if (!schema.fallbackUsed && schema.fields.length > 0) {
        return {
          type: 'schema_enrich',
          fields: schema.fields,
          seedRows: schema.seedRows,
          conditionalFormatting: schema.conditionalFormatting ?? [],
          hasFormulas: schema.hasFormulas ?? false,
          sheets: schema.sheets,
          tierUsed: schema.tierUsed,
        };
      }
    }
  } catch {
    // FAIL-OPEN: premium path failed → fall through to standard LLM-operations path.
  }

  // ── STANDARD: LLM-operations path (sort / filter / add_column / …) ─────────
  const systemPrompt = `You are a table operations assistant. Given a natural language command and a table schema, return a JSON action object.
Table schema: ${JSON.stringify(tableSchema)}

Possible action types:
- { "type": "sort", "column": "key", "direction": "asc"|"desc" }
- { "type": "filter", "column": "key", "operator": "contains"|"equals"|"gt"|"lt", "value": "..." }
- { "type": "group", "column": "key" }
- { "type": "add_column", "key": "...", "header": "...", "columnType": "text"|"number"|"select"|... }
- { "type": "add_rows", "rows": [{ "label": "...", "status": "...", ... }] }
- { "type": "summarize", "summary": "..." }

Return exactly one JSON action object.

${languageInstruction(respLang)}`;

  try {
    const { llmService } = await import('./ai/llmService.js');
    const modelRouter = (await import('./ai/modelRouter.js')).default;
    const modelCfg = await modelRouter.select({
      capability: 'chat',
      organizationId: orgId,
      options: { tier: 'BUDGET' },
    });

    const response = await llmService.call({
      type: 'text',
      modelConfig: modelCfg,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: naturalLanguage },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    const rawContent = String(
      (response as any)?.content || (response as any)?.message?.content || ''
    );
    const content = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    return JSON.parse(content);
  } catch {
    return {
      type: 'error',
      message: isPl ? 'Nie udało się przetworzyć polecenia' : 'Failed to process command',
    };
  }
}

export async function generateAIFill(
  columnPrompt: string,
  rows: Array<{ id: string; data: Record<string, any> }>,
  userId: string,
  orgId: string,
  queryHelpers: any,
  language: string
): Promise<Array<{ rowId: string; value: string }>> {
  const companyCtx = await buildCompanyContext(userId, orgId, queryHelpers);

  // Język odpowiedzi z TREŚCI (polecenie kolumny + dane wierszy), flaga UI jako fallback.
  const { resolveResponseLanguage, languageInstruction } = await import('./ai/responseLanguage.js');
  const respLang = resolveResponseLanguage({
    requested: language,
    samples: [columnPrompt, ...rows.slice(0, 20).map((r) => JSON.stringify(r?.data || {}))],
  });

  const systemPrompt = `You are an AI column filler. For each row, generate a value based on the prompt and row data.
Prompt: "${columnPrompt}"
${
  companyCtx.assessmentScores.length > 0
    ? `Company assessment data available: ${companyCtx.assessmentScores
        .slice(0, 5)
        .map((s) => `${s.dimension}: ${s.score}/${s.maxScore}`)
        .join(', ')}`
    : ''
}
${languageInstruction(respLang)}
Return a JSON array: [{ "rowId": "...", "value": "..." }]`;

  const rowsDesc = rows
    .slice(0, 30)
    .map((r) => `Row ${r.id}: ${JSON.stringify(r.data)}`)
    .join('\n');

  try {
    const { llmService } = await import('./ai/llmService.js');
    const modelRouter = (await import('./ai/modelRouter.js')).default;
    const modelCfg = await modelRouter.select({
      capability: 'chat',
      organizationId: orgId,
      options: { tier: 'STANDARD' },
    });

    const response = await llmService.call({
      type: 'text',
      modelConfig: modelCfg,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rowsDesc },
      ],
      temperature: 0.5,
      maxTokens: 2000,
    });

    const rawContent = String(
      (response as any)?.content || (response as any)?.message?.content || ''
    );
    const content = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(content);
    return (Array.isArray(parsed) ? parsed : parsed?.results || []).map((r: any) => ({
      rowId: String(r.rowId || r.row_id || ''),
      value: String(r.value || ''),
    }));
  } catch {
    return rows.map((r) => ({ rowId: r.id, value: '—' }));
  }
}
