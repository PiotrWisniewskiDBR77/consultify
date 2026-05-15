import type { Request, Response } from 'express';

function resolveCorrelationId(req: Request): string | null {
  const correlationId =
    (req as Request & { correlationId?: string }).correlationId || req.get('X-Correlation-ID');
  return typeof correlationId === 'string' && correlationId.trim() ? correlationId : null;
}

export function sendApiUnknownRouteNotFound(req: Request, res: Response): void {
  res.status(404).json({
    status: 'fail',
    error: {
      code: 'API_ROUTE_NOT_FOUND',
      message: 'The requested API endpoint does not exist.',
      timestamp: new Date().toISOString(),
    },
    correlationId: resolveCorrelationId(req),
  });
}

export function sendApiGatewayRateLimitedResponse(req: Request, res: Response): void {
  res.status(429).json({
    status: 'fail',
    error: {
      code: 'API_RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please retry later.',
      timestamp: new Date().toISOString(),
    },
    correlationId: resolveCorrelationId(req),
  });
}

export function sendApiMethodNotAllowed(req: Request, res: Response, allowMethods: string[]): void {
  res.setHeader('Allow', allowMethods.join(', '));
  res.status(405).json({
    status: 'fail',
    error: {
      code: 'API_METHOD_NOT_ALLOWED',
      message: 'The requested API method is not allowed for this endpoint.',
      timestamp: new Date().toISOString(),
    },
    correlationId: resolveCorrelationId(req),
  });
}

