export type ConnectorsFetchPipelineRunId = string & {
  readonly __brand: 'ConnectorsFetchPipelineRunId';
};

export function unsafeConnectorsFetchPipelineRunId(value: string): ConnectorsFetchPipelineRunId {
  return String(value) as ConnectorsFetchPipelineRunId;
}

export type ConnectorsFetchPipelineOutput = {
  readonly requestId: ConnectorsFetchPipelineRunId;
  readonly now: string;
  readonly url: string;
  readonly status: 'succeeded' | 'fallback';
  readonly endpointState: 'ok' | 'missing_endpoint' | 'not_implemented' | 'backend_error';
  readonly httpStatus: number | null;
  readonly snippet: string;
};

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'localhost' || normalized.endsWith('.local')) return true;
  if (/^127\./.test(normalized) || normalized === '::1') return true;
  if (/^10\./.test(normalized) || /^192\.168\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  return false;
}

export class ConnectorsRuntimeInputError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = 'ConnectorsRuntimeInputError';
    this.code = code;
    this.status = status;
  }
}

export class ConnectorsRuntimeBackendError extends Error {
  readonly code: string;
  readonly status: number;
  readonly httpStatus: number | null;

  constructor(code: string, message: string, status = 502, httpStatus: number | null = null) {
    super(message);
    this.name = 'ConnectorsRuntimeBackendError';
    this.code = code;
    this.status = status;
    this.httpStatus = httpStatus;
  }
}

export async function runConnectorsFetchPipeline(input: {
  readonly requestId: ConnectorsFetchPipelineRunId;
  readonly url: string;
  readonly now: string;
}): Promise<ConnectorsFetchPipelineOutput> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.url);
  } catch {
    throw new ConnectorsRuntimeInputError(
      'CONNECTORS_RUNTIME_INVALID_URL',
      'Connectors runtime requires a valid absolute URL'
    );
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new ConnectorsRuntimeInputError(
      'CONNECTORS_RUNTIME_UNSUPPORTED_PROTOCOL',
      'Only http and https URLs are supported'
    );
  }

  if (isPrivateHostname(parsedUrl.hostname)) {
    throw new ConnectorsRuntimeInputError(
      'CONNECTORS_RUNTIME_BLOCKED_HOST',
      'Private, localhost, and local network hosts are blocked'
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'consultify-connectors-runtime/1.0',
        Accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.5',
      },
    });
    const text = await response.text();
    const snippet =
      text.trim().slice(0, 500) || `Fetched ${parsedUrl.toString()} (${response.status})`;

    if ([404, 405, 501].includes(response.status)) {
      return {
        requestId: input.requestId,
        now: input.now,
        url: parsedUrl.toString(),
        status: 'fallback',
        endpointState: response.status === 501 ? 'not_implemented' : 'missing_endpoint',
        httpStatus: response.status,
        snippet: `Fallback scaffold: upstream endpoint is unavailable (${response.status}).`,
      };
    }

    if (response.status >= 500) {
      throw new ConnectorsRuntimeBackendError(
        'CONNECTORS_RUNTIME_UPSTREAM_5XX',
        `Upstream connector endpoint returned ${response.status}`,
        502,
        response.status
      );
    }

    if (!response.ok) {
      throw new ConnectorsRuntimeBackendError(
        'CONNECTORS_RUNTIME_UPSTREAM_ERROR',
        `Upstream connector endpoint returned ${response.status}`,
        502,
        response.status
      );
    }

    return {
      requestId: input.requestId,
      now: input.now,
      url: parsedUrl.toString(),
      status: 'succeeded',
      endpointState: 'ok',
      httpStatus: response.status,
      snippet,
    };
  } catch (error) {
    if (
      error instanceof ConnectorsRuntimeInputError ||
      error instanceof ConnectorsRuntimeBackendError
    ) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ConnectorsRuntimeBackendError(
        'CONNECTORS_RUNTIME_TIMEOUT',
        'Upstream connector endpoint timed out',
        504,
        null
      );
    }
    throw new ConnectorsRuntimeBackendError(
      'CONNECTORS_RUNTIME_NETWORK_FAILURE',
      error instanceof Error ? error.message : 'Connector runtime request failed',
      502,
      null
    );
  } finally {
    clearTimeout(timer);
  }
}
