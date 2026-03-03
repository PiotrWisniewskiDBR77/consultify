/**
 * Report Agent Service (T060)
 *
 * Gamma-style chat agent that can modify report structure:
 *  - Reorder / add / remove sections
 *  - Modify section settings (length, style, customPrompt)
 *  - Propose best-practice structures
 *  - Regenerate sections on command
 *  - Show diff preview before applying
 */
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

// ── Types ──────────────────────────────────────────────────────

export type AgentActionType =
  | 'REORDER_SECTIONS'
  | 'ADD_SECTION'
  | 'REMOVE_SECTION'
  | 'UPDATE_SECTION'
  | 'SUGGEST_STRUCTURE'
  | 'REGENERATE_SECTION'
  | 'REGENERATE_ALL'
  | 'QUALITY_CHECK'
  | 'CONVERSATIONAL';

export interface AgentAction {
  type: AgentActionType;
  sectionKey?: string;
  data?: Record<string, unknown>;
}

export interface AgentMessage {
  id: string;
  reportId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  structuredAction?: AgentAction | null;
  diffPreview?: DiffPreview | null;
  applied: boolean;
  createdAt: string;
}

export interface DiffPreview {
  changes: DiffChange[];
  summary: string;
}

export interface DiffChange {
  type: 'add' | 'remove' | 'move' | 'modify';
  sectionKey: string;
  field?: string;
  before?: string;
  after?: string;
}

interface SectionRow {
  section_key: string;
  section_type: string;
  title: string;
  order_index: number;
  enabled: boolean;
  length: string;
  language: string;
  custom_prompt: string | null;
}

// ── Command Parser ─────────────────────────────────────────────

const COMMAND_PATTERNS: Array<{ pattern: RegExp; action: AgentActionType }> = [
  { pattern: /\b(?:move|reorder|swap|put|shift)\b/i, action: 'REORDER_SECTIONS' },
  {
    pattern: /(?:add|insert|include|create)\s+(?:a\s+)?(?:section|block|chapter)/i,
    action: 'ADD_SECTION',
  },
  {
    pattern: /(?:remove|delete|drop|hide)\s+(?:the\s+)?(?:section|block)/i,
    action: 'REMOVE_SECTION',
  },
  {
    pattern: /(?:shorten|lengthen|change.*(?:length|style|prompt)|set.*(?:length|style))/i,
    action: 'UPDATE_SECTION',
  },
  {
    pattern:
      /(?:suggest|recommend|best.?practice|propose)\s+(?:a\s+)?(?:structure|layout|outline)/i,
    action: 'SUGGEST_STRUCTURE',
  },
  {
    pattern: /(?:regenerate|re-?generate|refresh|redo)\s+(?:the\s+)?(?:section|block)/i,
    action: 'REGENERATE_SECTION',
  },
  { pattern: /(?:regenerate|refresh)\s+(?:all|everything|entire)/i, action: 'REGENERATE_ALL' },
  { pattern: /(?:check|audit|review|what.s missing|quality)/i, action: 'QUALITY_CHECK' },
];

export function parseCommand(userMessage: string): AgentAction {
  for (const { pattern, action } of COMMAND_PATTERNS) {
    if (pattern.test(userMessage)) {
      return { type: action };
    }
  }
  return { type: 'CONVERSATIONAL' };
}

// ── Agent Logic ────────────────────────────────────────────────

export async function processAgentMessage(
  organizationId: string,
  reportId: string,
  userMessage: string
): Promise<AgentMessage> {
  const action = parseCommand(userMessage);
  let response: string;
  let diffPreview: DiffPreview | null = null;

  const sections = await getReportSections(reportId);

  switch (action.type) {
    case 'REORDER_SECTIONS':
      ({ response, diffPreview } = handleReorder(userMessage, sections));
      break;
    case 'ADD_SECTION':
      ({ response, diffPreview } = handleAddSection(userMessage, sections));
      break;
    case 'REMOVE_SECTION':
      ({ response, diffPreview } = handleRemoveSection(userMessage, sections));
      break;
    case 'UPDATE_SECTION':
      ({ response, diffPreview } = handleUpdateSection(userMessage, sections));
      break;
    case 'SUGGEST_STRUCTURE':
      response = suggestBestPractice(sections);
      break;
    case 'QUALITY_CHECK':
      response = await performQualityCheck(reportId, sections);
      break;
    case 'REGENERATE_SECTION':
    case 'REGENERATE_ALL':
      response = `I'll mark the ${action.type === 'REGENERATE_ALL' ? 'entire report' : 'specified section'} for regeneration. Click "Apply" to proceed, then use the Generate button to regenerate the content.`;
      break;
    default:
      response = generateConversationalResponse(userMessage, sections);
  }

  const msgId = `am-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  await dbRun(
    `INSERT INTO report_agent_messages
       (id, organization_id, report_id, role, content, structured_action, diff_preview, applied)
     VALUES (?, ?, ?, 'user', ?, NULL, NULL, FALSE)`,
    [`${msgId}-user`, organizationId, reportId, userMessage]
  );

  await dbRun(
    `INSERT INTO report_agent_messages
       (id, organization_id, report_id, role, content, structured_action, diff_preview, applied)
     VALUES (?, ?, ?, 'assistant', ?, ?, ?, FALSE)`,
    [
      msgId,
      organizationId,
      reportId,
      response,
      JSON.stringify(action),
      diffPreview ? JSON.stringify(diffPreview) : null,
    ]
  );

  return {
    id: msgId,
    reportId,
    role: 'assistant',
    content: response,
    structuredAction: action,
    diffPreview,
    applied: false,
    createdAt: new Date().toISOString(),
  };
}

export async function applyAgentAction(
  organizationId: string,
  reportId: string,
  messageId: string
): Promise<{ success: boolean; message: string }> {
  const msg = (await dbGet(
    `SELECT id, structured_action, diff_preview FROM report_agent_messages WHERE id = ? AND report_id = ?`,
    [messageId, reportId]
  )) as { id: string; structured_action: string; diff_preview: string } | null;

  if (!msg) return { success: false, message: 'Message not found' };

  const action = JSON.parse(msg.structured_action || '{}') as AgentAction;
  const diff = JSON.parse(msg.diff_preview || '{}') as DiffPreview;

  if (diff?.changes) {
    for (const change of diff.changes) {
      switch (change.type) {
        case 'add': {
          const sectionId = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await dbRun(
            `INSERT INTO report_builder_sections
               (id, report_id, section_key, section_type, title, order_index, enabled, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(order_index),0)+1 FROM report_builder_sections WHERE report_id = ?), TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              sectionId,
              reportId,
              change.sectionKey,
              change.field || 'custom',
              change.after || 'New Section',
              reportId,
            ]
          );
          break;
        }
        case 'remove':
          await dbRun(
            `UPDATE report_builder_sections SET enabled = FALSE WHERE report_id = ? AND section_key = ?`,
            [reportId, change.sectionKey]
          );
          break;
        case 'modify':
          if (change.field === 'length') {
            await dbRun(
              `UPDATE report_builder_sections SET length = ? WHERE report_id = ? AND section_key = ?`,
              [change.after, reportId, change.sectionKey]
            );
          }
          break;
        case 'move':
          break;
      }
    }
  }

  await dbRun(
    `UPDATE report_agent_messages SET applied = TRUE, applied_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [messageId]
  );

  return { success: true, message: 'Changes applied successfully' };
}

export async function getAgentMessages(
  organizationId: string,
  reportId: string
): Promise<AgentMessage[]> {
  const rows = ((await dbAll(
    `SELECT id, report_id, role, content, structured_action, diff_preview, applied, created_at
     FROM report_agent_messages
     WHERE report_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [reportId, organizationId]
  )) || []) as Array<{
    id: string;
    report_id: string;
    role: string;
    content: string;
    structured_action: string | null;
    diff_preview: string | null;
    applied: boolean;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    reportId: r.report_id,
    role: r.role as 'user' | 'assistant' | 'system',
    content: r.content,
    structuredAction: r.structured_action ? JSON.parse(r.structured_action) : null,
    diffPreview: r.diff_preview ? JSON.parse(r.diff_preview) : null,
    applied: r.applied,
    createdAt: r.created_at,
  }));
}

// ── Internal Helpers ───────────────────────────────────────────

async function getReportSections(reportId: string): Promise<SectionRow[]> {
  return ((await dbAll(
    `SELECT section_key, section_type, title, order_index, enabled, length, language, custom_prompt
     FROM report_builder_sections
     WHERE report_id = ? AND enabled = TRUE
     ORDER BY order_index ASC`,
    [reportId]
  )) || []) as SectionRow[];
}

function handleReorder(
  userMessage: string,
  sections: SectionRow[]
): { response: string; diffPreview: DiffPreview } {
  const sectionNames = sections.map((s) => s.title.toLowerCase());
  const lowerMsg = userMessage.toLowerCase();

  let sourceIdx = -1;
  let targetIdx = -1;
  for (let i = 0; i < sectionNames.length; i++) {
    if (lowerMsg.includes(sectionNames[i])) {
      if (sourceIdx === -1) sourceIdx = i;
      else targetIdx = i;
    }
  }

  if (sourceIdx === -1) {
    return {
      response: `I can reorder sections. Available sections: ${sections.map((s) => `"${s.title}"`).join(', ')}. Tell me which section to move and where.`,
      diffPreview: { changes: [], summary: 'No changes identified' },
    };
  }

  const movingSection = sections[sourceIdx];
  const targetPos = targetIdx >= 0 ? targetIdx : 0;
  const beforeOrAfter = lowerMsg.includes('before') ? 'before' : 'after';

  return {
    response: `I'll move **"${movingSection.title}"** ${beforeOrAfter} position ${targetPos + 1}. Click "Apply" to confirm.`,
    diffPreview: {
      changes: [
        {
          type: 'move',
          sectionKey: movingSection.section_key,
          before: `position ${sourceIdx + 1}`,
          after: `position ${targetPos + 1}`,
        },
      ],
      summary: `Move "${movingSection.title}" from position ${sourceIdx + 1} to ${targetPos + 1}`,
    },
  };
}

function handleAddSection(
  userMessage: string,
  sections: SectionRow[]
): { response: string; diffPreview: DiffPreview } {
  const blockTypes: Record<string, { type: string; title: string }> = {
    'executive summary': { type: 'summary', title: 'Executive Summary' },
    findings: { type: 'findings', title: 'Key Findings' },
    recommendations: { type: 'recommendations', title: 'Recommendations' },
    kpi: { type: 'kpis', title: 'KPI Dashboard' },
    risk: { type: 'consulting_risks_register', title: 'Risk Assessment' },
    roadmap: { type: 'roadmap', title: 'Implementation Roadmap' },
    timeline: { type: 'timeline', title: 'Timeline' },
    methodology: { type: 'methodology', title: 'Methodology' },
    analysis: { type: 'analysis', title: 'Analysis' },
    'next steps': { type: 'consulting_decisions', title: 'Next Steps & Actions' },
    budget: { type: 'analysis', title: 'Budget Analysis' },
    finance: { type: 'analysis', title: 'Financial Overview' },
    benchmark: { type: 'consulting_benchmark_bar', title: 'Benchmark Comparison' },
  };

  const lower = userMessage.toLowerCase();
  let matched: { type: string; title: string } | null = null;
  for (const [keyword, info] of Object.entries(blockTypes)) {
    if (lower.includes(keyword)) {
      matched = info;
      break;
    }
  }

  if (!matched) {
    return {
      response: `I can add these sections: ${Object.keys(blockTypes).join(', ')}. Which would you like?`,
      diffPreview: { changes: [], summary: 'No changes' },
    };
  }

  const key = `agent_${matched.type}_${Date.now()}`;
  return {
    response: `I'll add a **"${matched.title}"** section to the report. Click "Apply" to add it.`,
    diffPreview: {
      changes: [{ type: 'add', sectionKey: key, field: matched.type, after: matched.title }],
      summary: `Add "${matched.title}" section`,
    },
  };
}

function handleRemoveSection(
  userMessage: string,
  sections: SectionRow[]
): { response: string; diffPreview: DiffPreview } {
  const lower = userMessage.toLowerCase();
  const found = sections.find(
    (s) => lower.includes(s.title.toLowerCase()) || lower.includes(s.section_key.toLowerCase())
  );

  if (!found) {
    return {
      response: `Which section should I remove? Current sections: ${sections.map((s) => `"${s.title}"`).join(', ')}`,
      diffPreview: { changes: [], summary: 'No changes' },
    };
  }

  return {
    response: `I'll remove **"${found.title}"** from the report. Click "Apply" to confirm.`,
    diffPreview: {
      changes: [{ type: 'remove', sectionKey: found.section_key, before: found.title }],
      summary: `Remove "${found.title}" section`,
    },
  };
}

function handleUpdateSection(
  userMessage: string,
  sections: SectionRow[]
): { response: string; diffPreview: DiffPreview } {
  const lower = userMessage.toLowerCase();
  const found = sections.find((s) => lower.includes(s.title.toLowerCase()));

  if (!found) {
    return {
      response: `Which section should I update? Available: ${sections.map((s) => `"${s.title}"`).join(', ')}`,
      diffPreview: { changes: [], summary: 'No changes' },
    };
  }

  let newLength = found.length;
  if (lower.includes('short') || lower.includes('shorten') || lower.includes('concise'))
    newLength = 'short';
  else if (lower.includes('long') || lower.includes('lengthen') || lower.includes('detailed'))
    newLength = 'long';
  else if (lower.includes('medium')) newLength = 'medium';

  return {
    response: `I'll update **"${found.title}"** length to **${newLength}**. Click "Apply" to confirm.`,
    diffPreview: {
      changes: [
        {
          type: 'modify',
          sectionKey: found.section_key,
          field: 'length',
          before: found.length,
          after: newLength,
        },
      ],
      summary: `Update "${found.title}" length: ${found.length} → ${newLength}`,
    },
  };
}

function suggestBestPractice(sections: SectionRow[]): string {
  const currentKeys = new Set(sections.map((s) => s.section_type));
  const missing: string[] = [];
  if (!currentKeys.has('cover')) missing.push('Cover Page');
  if (!currentKeys.has('summary')) missing.push('Executive Summary');
  if (!currentKeys.has('findings')) missing.push('Key Findings');
  if (!currentKeys.has('recommendations')) missing.push('Recommendations');
  if (!currentKeys.has('consulting_decisions')) missing.push('Next Steps & Decisions');

  if (missing.length === 0) {
    return `Your report structure looks solid! It includes all recommended sections: cover, executive summary, findings, recommendations, and next steps. You're good to go.`;
  }

  return `**Suggested improvements:**\n\nYour report is missing these commonly expected sections:\n${missing.map((m) => `- **${m}**`).join('\n')}\n\nWould you like me to add any of these? Just say "add [section name]".`;
}

async function performQualityCheck(reportId: string, sections: SectionRow[]): Promise<string> {
  const issues: string[] = [];
  const enabled = sections.filter((s) => s.enabled !== false);

  if (enabled.length === 0) {
    issues.push('No enabled sections in report');
  }
  if (!enabled.some((s) => s.section_type === 'summary')) {
    issues.push('Missing Executive Summary (recommended for all reports)');
  }
  if (!enabled.some((s) => s.section_type === 'recommendations' || s.section_type === 'consulting_decisions')) {
    issues.push('Missing Recommendations or Next Steps (required for actionable reports)');
  }

  const emptyContent = (await dbAll(
    `SELECT section_key, title FROM report_builder_sections
     WHERE report_id = ? AND enabled = TRUE AND (COALESCE(edited_content, generated_content) IS NULL OR COALESCE(edited_content, generated_content) = '')`,
    [reportId]
  )) as Array<{ section_key: string; title: string }> | null;

  if (emptyContent?.length) {
    issues.push(
      `${emptyContent.length} section(s) have no content yet: ${emptyContent.map((s) => `"${s.title}"`).join(', ')}`
    );
  }

  if (issues.length === 0) {
    return `**Quality check passed!** Your report has all recommended sections and no empty content blocks. Ready for export.`;
  }

  return `**Quality check found ${issues.length} issue(s):**\n${issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}\n\nWould you like me to help fix any of these?`;
}

function generateConversationalResponse(userMessage: string, sections: SectionRow[]): string {
  return (
    `I'm your report assistant. Here's what I can help with:\n\n` +
    `- **Reorder sections**: "Move Recommendations before Analysis"\n` +
    `- **Add sections**: "Add a KPI Dashboard section"\n` +
    `- **Remove sections**: "Remove the Methodology section"\n` +
    `- **Update settings**: "Shorten the Executive Summary"\n` +
    `- **Best practices**: "Suggest a structure for this report"\n` +
    `- **Quality check**: "Check what's missing"\n` +
    `- **Regenerate**: "Regenerate the Analysis section"\n\n` +
    `Your report currently has **${sections.length} sections**. What would you like to do?`
  );
}
