/**
 * Jira Connector — reads issues from Jira Cloud via REST API v3.
 * Uses native fetch (Node 18+); no jira package required.
 */

import type {
  IConnector,
  ExternalSchema,
  ExternalRecord,
  FetchOptions,
} from '../connectorFramework.js';
import logger from '../../../utils/Logger.js';

const MAX_ISSUES = 10_000;
const PAGE_SIZE = 100;

interface JiraConfig {
  domain: string;
  email: string;
  apiToken: string;
  jql?: string;
  project?: string;
}

function parseConfig(config: Record<string, unknown>): JiraConfig {
  const domain = config.domain as string | undefined;
  const email = config.email as string | undefined;
  const apiToken = config.apiToken as string | undefined;
  if (!domain || typeof domain !== 'string') {
    throw new Error('config.domain is required (e.g. "mycompany" for mycompany.atlassian.net)');
  }
  if (!email || typeof email !== 'string') {
    throw new Error('config.email is required');
  }
  if (!apiToken || typeof apiToken !== 'string') {
    throw new Error('config.apiToken is required');
  }
  return {
    domain: domain.replace(/\.atlassian\.net$/i, ''),
    email,
    apiToken,
    jql: config.jql as string | undefined,
    project: config.project as string | undefined,
  };
}

function authHeader(email: string, apiToken: string): string {
  const encoded = Buffer.from(`${email}:${apiToken}`).toString('base64');
  return `Basic ${encoded}`;
}

function baseUrl(domain: string): string {
  return `https://${domain}.atlassian.net/rest/api/3`;
}

const JIRA_TYPE_MAP: Record<string, string> = {
  string: 'singleLineText',
  number: 'number',
  datetime: 'date',
  date: 'date',
  option: 'singleSelect',
  array: 'multiSelect',
  user: 'singleLineText',
  priority: 'singleSelect',
  status: 'singleSelect',
  issuetype: 'singleSelect',
  resolution: 'singleSelect',
  project: 'singleLineText',
  progress: 'number',
  timetracking: 'singleLineText',
  watches: 'number',
  votes: 'number',
  comments: 'longText',
  issuelinks: 'longText',
  worklog: 'longText',
  attachment: 'attachment',
};

function mapJiraFieldType(schema?: { type?: string; items?: string }): string {
  if (!schema?.type) return 'singleLineText';
  if (schema.type === 'array' && schema.items === 'option') return 'multiSelect';
  return JIRA_TYPE_MAP[schema.type] ?? 'singleLineText';
}

async function jiraGet(url: string, email: string, apiToken: string): Promise<unknown> {
  const resp = await fetch(url, {
    headers: {
      Authorization: authHeader(email, apiToken),
      Accept: 'application/json',
    },
  });

  if (resp.status === 401 || resp.status === 403) {
    const text = await resp.text();
    throw new Error(`Jira authentication failed (${resp.status}): ${text}`);
  }
  if (resp.status === 429) {
    throw new Error('Jira API rate limit exceeded. Try again later.');
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Jira API error ${resp.status}: ${text}`);
  }

  return resp.json();
}

function flattenIssue(issue: Record<string, unknown>): Record<string, unknown> {
  const fields = issue.fields as Record<string, unknown> | undefined;
  if (!fields) return { key: issue.key };

  const flat: Record<string, unknown> = { key: issue.key, id: issue.id };

  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) {
      flat[key] = null;
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      // Extract display values from Jira objects (status, priority, user, etc.)
      flat[key] = obj.displayName ?? obj.name ?? obj.value ?? obj.key ?? JSON.stringify(value);
    } else if (Array.isArray(value)) {
      flat[key] = value
        .map((v) => {
          if (typeof v === 'object' && v !== null) {
            const o = v as Record<string, unknown>;
            return o.displayName ?? o.name ?? o.value ?? JSON.stringify(v);
          }
          return String(v);
        })
        .join(', ');
    } else {
      flat[key] = value;
    }
  }

  return flat;
}

export const jiraConnector: IConnector = {
  type: 'jira',

  async testConnection(
    config: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cfg = parseConfig(config);
      await jiraGet(`${baseUrl(cfg.domain)}/myself`, cfg.email, cfg.apiToken);
      return { success: true };
    } catch (e) {
      logger.warn('[JiraConnector] testConnection failed', {
        error: (e as Error).message,
      });
      return { success: false, error: (e as Error).message };
    }
  },

  async fetchSchema(config: Record<string, unknown>): Promise<ExternalSchema> {
    const cfg = parseConfig(config);

    const data = (await jiraGet(
      `${baseUrl(cfg.domain)}/field`,
      cfg.email,
      cfg.apiToken
    )) as Array<{
      id: string;
      name: string;
      schema?: { type?: string; items?: string };
      custom: boolean;
    }>;

    const fields = data
      .filter((f) => !f.id.startsWith('customfield_') || f.custom)
      .map((f) => ({
        name: f.name,
        externalType: f.schema?.type ?? 'string',
        inferredType: mapJiraFieldType(f.schema),
        sample: undefined,
      }));

    // Always include the issue key as a field
    fields.unshift({
      name: 'Key',
      externalType: 'string',
      inferredType: 'singleLineText',
      sample: undefined,
    });

    return {
      tables: [{ name: 'Issues', fields }],
    };
  },

  async fetchRecords(
    config: Record<string, unknown>,
    options?: FetchOptions
  ): Promise<ExternalRecord[]> {
    const cfg = parseConfig(config);
    const jql = cfg.jql
      || (cfg.project ? `project = "${cfg.project}" ORDER BY created DESC` : 'ORDER BY created DESC');

    const allRecords: ExternalRecord[] = [];
    let startAt = options?.offset ?? 0;
    const maxResults = Math.min(options?.limit ?? MAX_ISSUES, MAX_ISSUES);

    do {
      const params = new URLSearchParams({
        jql,
        maxResults: String(Math.min(PAGE_SIZE, maxResults - allRecords.length)),
        startAt: String(startAt),
      });

      const page = (await jiraGet(
        `${baseUrl(cfg.domain)}/search?${params.toString()}`,
        cfg.email,
        cfg.apiToken
      )) as {
        issues: Array<Record<string, unknown>>;
        total: number;
        startAt: number;
        maxResults: number;
      };

      for (const issue of page.issues) {
        allRecords.push({
          externalId: (issue.key as string) ?? (issue.id as string),
          data: flattenIssue(issue),
        });
      }

      startAt += page.issues.length;

      if (page.issues.length === 0 || startAt >= page.total || allRecords.length >= maxResults) {
        break;
      }
    } while (allRecords.length < maxResults);

    return allRecords;
  },
};

export default jiraConnector;
