import { run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export type StreamableHttpProviderConfig = {
  baseUrl: string;
  mcpPath?: string; // default: /mcp
  headers?: Record<string, string>;
};

export type McpJsonRpcRequest = {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: unknown;
};

export type McpJsonRpcResponse<T = unknown> = {
  jsonrpc: '2.0';
  id: string;
  result?: T;
  error?: { code?: number; message?: string; data?: unknown };
};

function normalizeBaseUrl(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const noTrailing = raw.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(noTrailing)) return `https://${noTrailing}`;
  return noTrailing;
}

function buildUrl(cfg: StreamableHttpProviderConfig): string {
  const baseUrl = normalizeBaseUrl(cfg.baseUrl);
  const mcpPath = String(cfg.mcpPath || '/mcp').trim() || '/mcp';
  if (!baseUrl) return '';
  return `${baseUrl}${mcpPath.startsWith('/') ? '' : '/'}${mcpPath}`;
}

function safeJsonParse(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

export function parseStreamableHttpConfig(raw: unknown): StreamableHttpProviderConfig | null {
  const cfg = safeJsonParse(raw);
  const baseUrl = String((cfg as any).baseUrl || (cfg as any).mes_base_url || '').trim();
  if (!baseUrl) return null;
  const mcpPath = String((cfg as any).mcpPath || (cfg as any).mcp_path || '/mcp').trim();
  const headers =
    (cfg as any).headers && typeof (cfg as any).headers === 'object'
      ? ((cfg as any).headers as any)
      : undefined;
  return { baseUrl, mcpPath, headers };
}

export async function mcpJsonRpc<T = unknown>(input: {
  providerId: string;
  url: string;
  orgId: string;
  userId?: string | null;
  method: string;
  params?: unknown;
  headers?: Record<string, string>;
}): Promise<T> {
  const request: McpJsonRpcRequest = {
    jsonrpc: '2.0',
    id: `req-${Date.now()}`,
    method: input.method,
    params: input.params,
  };

  const started = Date.now();
  let success = 1;
  let errorMessage: string | null = null;
  let responseJson: any = null;

  try {
    const res = await fetch(input.url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(input.headers || {}),
      },
      body: JSON.stringify(request),
    });

    const text = await res.text();
    responseJson = text ? JSON.parse(text) : null;

    if (!res.ok) {
      success = 0;
      errorMessage = `HTTP ${res.status}`;
      throw new Error(`MCP HTTP error ${res.status}`);
    }

    const rpc = responseJson as McpJsonRpcResponse<T>;
    if (rpc?.error) {
      success = 0;
      errorMessage = rpc.error.message || 'MCP error';
      throw new Error(rpc.error.message || 'MCP error');
    }

    return rpc?.result as T;
  } catch (e: any) {
    success = 0;
    errorMessage = errorMessage || e?.message || 'mcp_call_failed';
    throw e;
  } finally {
    const latencyMs = Math.max(0, Date.now() - started);
    await dbRun(
      `INSERT INTO mcp_audit_logs (id, user_id, organization_id, tool_name, request_json, response_json, success, error_message, latency_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        `mcp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        input.userId || null,
        input.orgId,
        input.method,
        JSON.stringify({ providerId: input.providerId, url: input.url, request }),
        responseJson ? JSON.stringify(responseJson) : null,
        success,
        errorMessage,
        latencyMs,
      ]
    ).catch(() => null);
  }
}

export async function listRemoteTools(input: {
  providerId: string;
  orgId: string;
  userId?: string | null;
  config: StreamableHttpProviderConfig;
  extraHeaders?: Record<string, string>;
}): Promise<unknown> {
  const url = buildUrl(input.config);
  if (!url) throw new Error('Invalid provider config (baseUrl/mcpPath)');
  return await mcpJsonRpc({
    providerId: input.providerId,
    url,
    orgId: input.orgId,
    userId: input.userId,
    method: 'tools/list',
    params: {},
    headers: { ...(input.config.headers || {}), ...(input.extraHeaders || {}) },
  });
}

export async function callRemoteTool(input: {
  providerId: string;
  orgId: string;
  userId?: string | null;
  config: StreamableHttpProviderConfig;
  toolName: string;
  args: Record<string, unknown>;
  extraHeaders?: Record<string, string>;
}): Promise<unknown> {
  const url = buildUrl(input.config);
  if (!url) throw new Error('Invalid provider config (baseUrl/mcpPath)');
  return await mcpJsonRpc({
    providerId: input.providerId,
    url,
    orgId: input.orgId,
    userId: input.userId,
    method: 'tools/call',
    params: { name: input.toolName, arguments: input.args || {} },
    headers: { ...(input.config.headers || {}), ...(input.extraHeaders || {}) },
  });
}

export function makeIrisHeaders(
  cfg: Record<string, unknown>,
  factoryId?: string | null
): Record<string, string> {
  const token = String((cfg as any).mes_api_token || (cfg as any).MES_API_TOKEN || '').trim();
  const defaultFactory = String(
    (cfg as any).factory_id || (cfg as any).MES_FACTORY_ID || ''
  ).trim();
  const fid = String(factoryId || defaultFactory || '').trim();

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (fid) headers['X-Factory-Id'] = fid;
  return headers;
}

export function makeMarketplaceHeaders(cfg: Record<string, unknown>): Record<string, string> {
  const token = String((cfg as any).marketplace_token || (cfg as any).token || '').trim();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default {
  parseStreamableHttpConfig,
  listRemoteTools,
  callRemoteTool,
  makeIrisHeaders,
  makeMarketplaceHeaders,
};
