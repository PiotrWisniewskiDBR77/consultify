import logger from '../../utils/Logger.js';

export type JiraIntegrationConfig = {
  baseUrl: string; // e.g. https://your-domain.atlassian.net
  email: string;
  apiToken: string;
  projectKey: string;
  issueType?: string; // default: Task
  defaultLabels?: string[];
};

export type JiraCreateIssueResult = {
  id: string;
  key: string;
  self?: string;
  browseUrl: string;
};

export type JiraUpdateIssueResult = {
  issueIdOrKey: string;
  browseUrl?: string;
};

function normalizeBaseUrl(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const noTrailing = raw.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(noTrailing)) return `https://${noTrailing}`;
  return noTrailing;
}

function basicAuthHeader(email: string, token: string): string {
  const value = Buffer.from(`${email}:${token}`).toString('base64');
  return `Basic ${value}`;
}

export function parseJiraConfig(raw: unknown): JiraIntegrationConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const cfg: any = raw;
  const baseUrl = normalizeBaseUrl(cfg.baseUrl || cfg.siteUrl || cfg.site_url || cfg.jiraBaseUrl);
  const email = String(cfg.email || cfg.userEmail || cfg.username || '').trim();
  const apiToken = String(cfg.apiToken || cfg.api_token || cfg.token || '').trim();
  const projectKey = String(cfg.projectKey || cfg.project_key || '').trim();
  const issueType = String(cfg.issueType || cfg.issue_type || 'Task').trim();
  const defaultLabels = Array.isArray(cfg.defaultLabels || cfg.default_labels)
    ? (cfg.defaultLabels || cfg.default_labels).map((x: any) => String(x)).filter(Boolean)
    : [];

  if (!baseUrl || !email || !apiToken || !projectKey) return null;
  return { baseUrl, email, apiToken, projectKey, issueType, defaultLabels };
}

export async function createIssueFromTask(input: {
  config: JiraIntegrationConfig;
  task: { id: string; title: string; description?: string | null; status?: string | null };
  deepLinkUrl?: string | null;
}): Promise<JiraCreateIssueResult> {
  const { config, task, deepLinkUrl } = input;

  const url = `${config.baseUrl}/rest/api/3/issue`;
  const summary = task.title || `Task ${task.id}`;
  const descriptionParts: string[] = [];
  if (task.description) descriptionParts.push(String(task.description));
  if (deepLinkUrl) descriptionParts.push(`Consultify: ${deepLinkUrl}`);
  if (descriptionParts.length === 0) descriptionParts.push(`Consultify task: ${task.id}`);

  // Jira Cloud: use ADF (Atlassian Document Format) for description in v3 API.
  // Keep it minimal and robust.
  const adfDescription = {
    type: 'doc',
    version: 1,
    content: descriptionParts.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  };

  const labels = [...(config.defaultLabels || []), 'consultify'].slice(0, 10);

  const payload = {
    fields: {
      project: { key: config.projectKey },
      issuetype: { name: config.issueType || 'Task' },
      summary,
      description: adfDescription,
      labels,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(config.email, config.apiToken),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.warn('[JiraOrgClient] createIssue failed', {
      status: res.status,
      body: body ? body.slice(0, 500) : '',
    });
    throw new Error(`Jira create issue failed (HTTP ${res.status})`);
  }

  const data = (await res.json()) as any;
  const key = String(data?.key || '').trim();
  const id = String(data?.id || '').trim();
  if (!key || !id) throw new Error('Jira create issue returned invalid response');

  return {
    id,
    key,
    self: data?.self,
    browseUrl: `${config.baseUrl}/browse/${key}`,
  };
}

export async function updateIssueFromTask(input: {
  config: JiraIntegrationConfig;
  issueIdOrKey: string;
  task: { id: string; title: string; description?: string | null; status?: string | null };
  deepLinkUrl?: string | null;
}): Promise<JiraUpdateIssueResult> {
  const { config, issueIdOrKey, task, deepLinkUrl } = input;
  const target = String(issueIdOrKey || '').trim();
  if (!target) throw new Error('Jira update issue requires issueIdOrKey');

  const url = `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(target)}`;
  const summary = task.title || `Task ${task.id}`;
  const descriptionParts: string[] = [];
  if (task.description) descriptionParts.push(String(task.description));
  if (deepLinkUrl) descriptionParts.push(`Consultify: ${deepLinkUrl}`);
  if (descriptionParts.length === 0) descriptionParts.push(`Consultify task: ${task.id}`);

  const adfDescription = {
    type: 'doc',
    version: 1,
    content: descriptionParts.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  };

  const labels = [...(config.defaultLabels || []), 'consultify'].slice(0, 10);

  const payload = {
    fields: {
      summary,
      description: adfDescription,
      labels,
    },
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: basicAuthHeader(config.email, config.apiToken),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.warn('[JiraOrgClient] updateIssue failed', {
      issueIdOrKey: target,
      status: res.status,
      body: body ? body.slice(0, 500) : '',
    });
    throw new Error(`Jira update issue failed (HTTP ${res.status})`);
  }

  return {
    issueIdOrKey: target,
    browseUrl: `${config.baseUrl}/browse/${target}`,
  };
}
