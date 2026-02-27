/**
 * Integration Hub Service (Enterprise)
 *
 * Export Deep Thinking decisions to external tools.
 * Enables:
 * - Export to Notion
 * - Export to Confluence
 * - Send to Slack
 * - Trigger from Jira/Azure DevOps
 */

import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface ExportResult {
  success: boolean;
  target: string;
  url?: string;
  error?: string;
}

export interface NotionConfig {
  apiKey: string;
  parentPageId?: string;
  databaseId?: string;
}

export interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  spaceKey: string;
  parentPageId?: string;
}

export interface SlackConfig {
  webhookUrl?: string;
  botToken?: string;
  channel: string;
}

export interface DecisionExportPayload {
  sessionId: string;
  title: string;
  summary: string;
  problem: string;
  options: Array<{ id: string; name: string; description: string }>;
  recommendation: string;
  risks: string[];
  nextActions: string[];
  fullReport: string;
  metadata: {
    createdAt: string;
    createdBy: string;
    organizationId: string;
  };
}

export interface ReportBuilderNotionExportPayload {
  reportId: string;
  title: string;
  description?: string;
  sections: Array<{ title: string; content: string }>;
  metadata: {
    createdAt?: string;
    createdBy?: string;
    organizationId?: string;
    sourceType?: string;
    sourceId?: string;
  };
}

// ==========================================
// NOTION EXPORT
// ==========================================

/**
 * Export decision to Notion page
 */
export async function exportToNotion(
  payload: DecisionExportPayload,
  config: NotionConfig
): Promise<ExportResult> {
  try {
    const blocks = buildNotionBlocks(payload);

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: config.databaseId
          ? { database_id: config.databaseId }
          : { page_id: config.parentPageId },
        properties: {
          title: {
            title: [{ text: { content: payload.title } }],
          },
          ...(config.databaseId
            ? {
                Status: { select: { name: 'Decision Made' } },
                Date: { date: { start: payload.metadata.createdAt.split('T')[0] } },
              }
            : {}),
        },
        children: blocks,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error: ${error}`);
    }

    const data = (await response.json()) as any;
    logger.info(`[IntegrationHub] Exported to Notion: ${data.url}`);

    return {
      success: true,
      target: 'notion',
      url: data.url,
    };
  } catch (err: any) {
    logger.error('[IntegrationHub] Notion export failed:', err?.message || err);
    return {
      success: false,
      target: 'notion',
      error: err?.message || 'Unknown error',
    };
  }
}

/**
 * Export Report Builder report to a Notion page.
 */
export async function exportReportToNotion(
  payload: ReportBuilderNotionExportPayload,
  config: NotionConfig
): Promise<ExportResult> {
  try {
    const blocks = buildNotionBlocksFromReport(payload);

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: config.databaseId
          ? { database_id: config.databaseId }
          : { page_id: config.parentPageId },
        properties: {
          title: {
            title: [{ text: { content: payload.title } }],
          },
        },
        children: blocks,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error: ${error}`);
    }

    const data = (await response.json()) as any;
    logger.info(`[IntegrationHub] Exported report to Notion: ${data.url}`);

    return {
      success: true,
      target: 'notion',
      url: data.url,
    };
  } catch (err: any) {
    logger.error('[IntegrationHub] Notion report export failed:', err?.message || err);
    return {
      success: false,
      target: 'notion',
      error: err?.message || 'Unknown error',
    };
  }
}

/**
 * Build Notion blocks from payload
 */
function buildNotionBlocks(payload: DecisionExportPayload): any[] {
  const blocks: any[] = [];

  // Executive Summary
  blocks.push({
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: 'Executive Summary' } }] },
  });
  blocks.push({
    type: 'paragraph',
    paragraph: { rich_text: [{ text: { content: payload.summary } }] },
  });

  // Problem
  blocks.push({
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: 'Problem' } }] },
  });
  blocks.push({
    type: 'paragraph',
    paragraph: { rich_text: [{ text: { content: payload.problem } }] },
  });

  // Options
  blocks.push({
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: 'Options Considered' } }] },
  });
  for (const opt of payload.options) {
    blocks.push({
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          { text: { content: opt.name }, annotations: { bold: true } },
          { text: { content: `: ${opt.description}` } },
        ],
      },
    });
  }

  // Recommendation
  blocks.push({
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: 'Recommendation' } }] },
  });
  blocks.push({
    type: 'callout',
    callout: {
      icon: { emoji: '✅' },
      rich_text: [{ text: { content: payload.recommendation } }],
    },
  });

  // Risks
  if (payload.risks.length > 0) {
    blocks.push({
      type: 'heading_2',
      heading_2: { rich_text: [{ text: { content: 'Risks' } }] },
    });
    for (const risk of payload.risks) {
      blocks.push({
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ text: { content: risk } }] },
      });
    }
  }

  // Next Actions
  if (payload.nextActions.length > 0) {
    blocks.push({
      type: 'heading_2',
      heading_2: { rich_text: [{ text: { content: 'Next Actions' } }] },
    });
    for (const action of payload.nextActions) {
      blocks.push({
        type: 'to_do',
        to_do: {
          rich_text: [{ text: { content: action } }],
          checked: false,
        },
      });
    }
  }

  return blocks;
}

function chunkText(text: string, maxLen = 1800): string[] {
  const s = String(text || '').trim();
  if (!s) return [];
  if (s.length <= maxLen) return [s];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    out.push(s.slice(i, i + maxLen));
    i += maxLen;
  }
  return out;
}

function buildNotionBlocksFromReport(payload: ReportBuilderNotionExportPayload): any[] {
  const blocks: any[] = [];

  // Meta / header
  const metaLines: string[] = [];
  if (payload.metadata.sourceType) metaLines.push(`Source: ${payload.metadata.sourceType}`);
  if (payload.metadata.sourceId) metaLines.push(`Source ID: ${payload.metadata.sourceId}`);
  if (payload.metadata.createdAt) metaLines.push(`Created at: ${payload.metadata.createdAt}`);
  if (payload.reportId) metaLines.push(`Report ID: ${payload.reportId}`);

  if (payload.description) {
    blocks.push({
      type: 'paragraph',
      paragraph: { rich_text: [{ text: { content: String(payload.description) } }] },
    });
  }
  if (metaLines.length) {
    blocks.push({
      type: 'callout',
      callout: {
        icon: { emoji: '📌' },
        rich_text: [{ text: { content: metaLines.join(' • ') } }],
      },
    });
  }

  // Sections
  for (const section of payload.sections || []) {
    const title = String(section.title || 'Section');
    blocks.push({
      type: 'heading_2',
      heading_2: { rich_text: [{ text: { content: title } }] },
    });

    const content = String(section.content || '').trim();
    const parts = content
      ? content
          .split(/\n{2,}/g)
          .map((p) => p.trim())
          .filter(Boolean)
      : [];

    if (parts.length === 0) {
      blocks.push({
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: '(empty)' } }] },
      });
      continue;
    }

    for (const p of parts) {
      for (const chunk of chunkText(p)) {
        blocks.push({
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: chunk } }] },
        });
      }
    }
  }

  // Avoid Notion API block limits by truncating defensively
  return blocks.slice(0, 90);
}

// ==========================================
// CONFLUENCE EXPORT
// ==========================================

/**
 * Export decision to Confluence page
 */
export async function exportToConfluence(
  payload: DecisionExportPayload,
  config: ConfluenceConfig
): Promise<ExportResult> {
  try {
    const body = buildConfluenceBody(payload);
    const auth = Buffer.from(`${config.username}:${config.apiToken}`).toString('base64');

    const response = await fetch(`${config.baseUrl}/rest/api/content`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'page',
        title: payload.title,
        space: { key: config.spaceKey },
        ...(config.parentPageId
          ? {
              ancestors: [{ id: config.parentPageId }],
            }
          : {}),
        body: {
          storage: {
            value: body,
            representation: 'storage',
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Confluence API error: ${error}`);
    }

    const data = (await response.json()) as any;
    const url = `${config.baseUrl}${data._links.webui}`;
    logger.info(`[IntegrationHub] Exported to Confluence: ${url}`);

    return {
      success: true,
      target: 'confluence',
      url,
    };
  } catch (err: any) {
    logger.error('[IntegrationHub] Confluence export failed:', err?.message || err);
    return {
      success: false,
      target: 'confluence',
      error: err?.message || 'Unknown error',
    };
  }
}

/**
 * Build Confluence storage format body
 */
function buildConfluenceBody(payload: DecisionExportPayload): string {
  const optionsList = payload.options
    .map((o) => `<li><strong>${escapeHtml(o.name)}</strong>: ${escapeHtml(o.description)}</li>`)
    .join('');

  const risksList = payload.risks.map((r) => `<li>${escapeHtml(r)}</li>`).join('');

  const actionsList = payload.nextActions
    .map(
      (a) =>
        `<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>${escapeHtml(a)}</ac:task-body></ac:task>`
    )
    .join('');

  return `
<h2>Executive Summary</h2>
<p>${escapeHtml(payload.summary)}</p>

<h2>Problem</h2>
<p>${escapeHtml(payload.problem)}</p>

<h2>Options Considered</h2>
<ul>${optionsList}</ul>

<h2>Recommendation</h2>
<ac:structured-macro ac:name="info">
<ac:rich-text-body><p>${escapeHtml(payload.recommendation)}</p></ac:rich-text-body>
</ac:structured-macro>

<h2>Risks</h2>
<ul>${risksList}</ul>

<h2>Next Actions</h2>
<ac:task-list>${actionsList}</ac:task-list>

<hr/>
<p><em>Generated by Deep Thinking on ${payload.metadata.createdAt}</em></p>
`;
}

// ==========================================
// SLACK EXPORT
// ==========================================

/**
 * Send decision summary to Slack
 */
export async function sendToSlack(
  payload: DecisionExportPayload,
  config: SlackConfig
): Promise<ExportResult> {
  try {
    const blocks = buildSlackBlocks(payload);

    const body = {
      channel: config.channel,
      text: `Deep Thinking Decision: ${payload.title}`,
      blocks,
    };

    const url = config.webhookUrl || 'https://slack.com/api/chat.postMessage';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.botToken) {
      headers['Authorization'] = `Bearer ${config.botToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Slack API error: ${error}`);
    }

    logger.info(`[IntegrationHub] Sent to Slack channel: ${config.channel}`);

    return {
      success: true,
      target: 'slack',
    };
  } catch (err: any) {
    logger.error('[IntegrationHub] Slack send failed:', err?.message || err);
    return {
      success: false,
      target: 'slack',
      error: err?.message || 'Unknown error',
    };
  }
}

/**
 * Build Slack Block Kit blocks
 */
function buildSlackBlocks(payload: DecisionExportPayload): any[] {
  const blocks: any[] = [];

  // Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `🧠 ${payload.title}`, emoji: true },
  });

  // Summary
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Executive Summary:*\n${payload.summary.slice(0, 500)}${payload.summary.length > 500 ? '...' : ''}`,
    },
  });

  // Divider
  blocks.push({ type: 'divider' });

  // Options
  const optionsText = payload.options.map((o) => `• *${o.name}*`).join('\n');
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `*Options Considered:*\n${optionsText}` },
  });

  // Recommendation
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `✅ *Recommendation:*\n${payload.recommendation.slice(0, 300)}` },
  });

  // Context
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Session: \`${payload.sessionId}\` | ${payload.metadata.createdAt.split('T')[0]}`,
      },
    ],
  });

  return blocks;
}

// ==========================================
// HELPERS
// ==========================================

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
