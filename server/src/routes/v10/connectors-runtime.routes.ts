import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import verifyToken, { requireOrganization } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  connectorsRuntimeService,
  type ConnectorsRuntimeService,
} from '../../services/v10/connectors/connectorsRuntimeService.js';
import { ConnectorsRegistryNotFoundError } from '../../services/v10/connectors/connectorsRegistryService.js';
import {
  ConnectorsRuntimeBackendError,
  ConnectorsRuntimeInputError,
} from '../../models/v10/pipelines/ConnectorsFetchPipeline.js';
import {
  ConnectorsFetchRequestSchema,
  ConnectorsAuthCompleteRequestSchema,
  ConnectorsAuthStartRequestSchema,
  ConnectorsReadSourceRequestSchema,
  ConnectorsSearchRequestSchema,
  ConnectorsTokenRefreshRequestSchema,
  ConnectorsSessionConnectRequestSchema,
  ConnectorsSessionDisconnectRequestSchema,
} from '../../types/v10/connectors-runtime.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  ConnectorsRuntimeAuthChallengeNotFoundError,
  ConnectorsRuntimeSessionInputError,
  ConnectorsRuntimeSessionNotFoundError,
  ConnectorsRuntimeSourceNotFoundError,
  ConnectorsRuntimeTokenVaultError,
} from '../../services/v10/connectors/connectorsRuntimeService.js';
import { respondWithData, runtimeMeta, withRuntimeScope, scopeFromAuthRequest } from './runtimeRouteUtils.js';

export const V10_CONNECTORS_RUNTIME_CONTRACT = 'connectors_runtime_wave_a_v1';

function handleConnectorsRuntimeError(error: unknown, res: Response) {
  if (error instanceof ConnectorsRuntimeInputError) {
    return res.status(error.status).json({
      code: error.code,
      error: error.message,
      meta: runtimeMeta(V10_CONNECTORS_RUNTIME_CONTRACT),
    });
  }
  if (error instanceof ConnectorsRuntimeBackendError) {
    return res.status(error.status).json({
      code: error.code,
      error: error.message,
      httpStatus: error.httpStatus,
      meta: runtimeMeta(V10_CONNECTORS_RUNTIME_CONTRACT),
    });
  }
  if (error instanceof ConnectorsRegistryNotFoundError) {
    return res.status(error.status).json({
      code: error.code,
      error: error.message,
      meta: runtimeMeta(V10_CONNECTORS_RUNTIME_CONTRACT),
    });
  }
  if (error instanceof ConnectorsRuntimeSessionInputError) {
    return res.status(error.status).json({
      code: error.code,
      error: error.message,
      meta: runtimeMeta(V10_CONNECTORS_RUNTIME_CONTRACT),
    });
  }
  if (error instanceof ConnectorsRuntimeSessionNotFoundError) {
    return res.status(error.status).json({
      code: error.code,
      error: error.message,
      meta: runtimeMeta(V10_CONNECTORS_RUNTIME_CONTRACT),
    });
  }
  if (error instanceof ConnectorsRuntimeAuthChallengeNotFoundError) {
    return res.status(error.status).json({
      code: error.code,
      error: error.message,
      meta: runtimeMeta(V10_CONNECTORS_RUNTIME_CONTRACT),
    });
  }
  if (error instanceof ConnectorsRuntimeSourceNotFoundError) {
    return res.status(error.status).json({
      code: error.code,
      error: error.message,
      meta: runtimeMeta(V10_CONNECTORS_RUNTIME_CONTRACT),
    });
  }
  if (error instanceof ConnectorsRuntimeTokenVaultError) {
    return res.status(error.status).json({
      code: error.code,
      error: error.message,
      meta: runtimeMeta(V10_CONNECTORS_RUNTIME_CONTRACT),
    });
  }
  throw error;
}

export function createConnectorsRuntimeRouter(
  service: ConnectorsRuntimeService = connectorsRuntimeService
) {
  const router = Router();

  router.use(verifyToken);
  router.use(requireOrganization);

  router.post(
    '/fetch',
    validateBody(ConnectorsFetchRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_CONNECTORS_RUNTIME_CONTRACT, () => service.fetch(req.body));
      } catch (error) {
        return handleConnectorsRuntimeError(error, res);
      }
    })
  );

  router.post(
    '/search',
    validateBody(ConnectorsSearchRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_CONNECTORS_RUNTIME_CONTRACT, () =>
          service.search(withRuntimeScope(req))
        );
      } catch (error) {
        return handleConnectorsRuntimeError(error, res);
      }
    })
  );

  router.post(
    '/sources/read',
    validateBody(ConnectorsReadSourceRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_CONNECTORS_RUNTIME_CONTRACT, () =>
          service.readSource(withRuntimeScope(req))
        );
      } catch (error) {
        return handleConnectorsRuntimeError(error, res);
      }
    })
  );

  router.get(
    '/catalog',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const persona = typeof req.query.persona === 'string' ? req.query.persona : null;
      const includePlanned =
        typeof req.query.includePlanned === 'string'
          ? req.query.includePlanned !== 'false'
          : true;
      return await respondWithData(res, V10_CONNECTORS_RUNTIME_CONTRACT, () =>
        service.listCatalog({ persona, includePlanned })
      );
    })
  );

  router.get(
    '/sessions',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_CONNECTORS_RUNTIME_CONTRACT, () =>
          service.listSessions(scopeFromAuthRequest(req))
        );
      } catch (error) {
        return handleConnectorsRuntimeError(error, res);
      }
    })
  );

  router.get(
    '/connectors/:connectorId',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_CONNECTORS_RUNTIME_CONTRACT, () =>
          service.getConnector(req.params.connectorId)
        );
      } catch (error) {
        return handleConnectorsRuntimeError(error, res);
      }
    })
  );

  router.post(
    '/connectors/:connectorId/connect',
    validateBody(ConnectorsSessionConnectRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_CONNECTORS_RUNTIME_CONTRACT, () =>
          service.connectConnector({
            ...withRuntimeScope(req),
            connectorId: req.params.connectorId,
          })
        );
      } catch (error) {
        return handleConnectorsRuntimeError(error, res);
      }
    })
  );

  router.post(
    '/connectors/:connectorId/auth/start',
    validateBody(ConnectorsAuthStartRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_CONNECTORS_RUNTIME_CONTRACT, () =>
          service.startAuth({
            ...withRuntimeScope(req),
            connectorId: req.params.connectorId,
          })
        );
      } catch (error) {
        return handleConnectorsRuntimeError(error, res);
      }
    })
  );

  router.post(
    '/connectors/:connectorId/auth/complete',
    validateBody(ConnectorsAuthCompleteRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_CONNECTORS_RUNTIME_CONTRACT, () =>
          service.completeAuth({
            ...withRuntimeScope(req),
            connectorId: req.params.connectorId,
          })
        );
      } catch (error) {
        return handleConnectorsRuntimeError(error, res);
      }
    })
  );

  router.post(
    '/connectors/:connectorId/tokens/refresh',
    validateBody(ConnectorsTokenRefreshRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_CONNECTORS_RUNTIME_CONTRACT, () =>
          service.refreshTokens({
            ...withRuntimeScope(req),
            connectorId: req.params.connectorId,
          })
        );
      } catch (error) {
        return handleConnectorsRuntimeError(error, res);
      }
    })
  );

  router.post(
    '/connectors/:connectorId/disconnect',
    validateBody(ConnectorsSessionDisconnectRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
      try {
        return await respondWithData(res, V10_CONNECTORS_RUNTIME_CONTRACT, () =>
          service.disconnectConnector({
            ...withRuntimeScope(req),
            connectorId: req.params.connectorId,
          })
        );
      } catch (error) {
        return handleConnectorsRuntimeError(error, res);
      }
    })
  );

  router.get(
    '/contract',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
      return res
        .status(200)
        .json({
          data: {
            contract: V10_CONNECTORS_RUNTIME_CONTRACT,
            searchPath: '/api/v10/connectors-runtime/search',
            readSourcePath: '/api/v10/connectors-runtime/sources/read',
            catalogPath: '/api/v10/connectors-runtime/catalog',
            detailPath: '/api/v10/connectors-runtime/connectors/:connectorId',
            sessionsPath: '/api/v10/connectors-runtime/sessions',
            authStartPath: '/api/v10/connectors-runtime/connectors/:connectorId/auth/start',
            authCompletePath: '/api/v10/connectors-runtime/connectors/:connectorId/auth/complete',
            tokenRefreshPath: '/api/v10/connectors-runtime/connectors/:connectorId/tokens/refresh',
          },
          meta: runtimeMeta(V10_CONNECTORS_RUNTIME_CONTRACT),
        });
    })
  );

  return router;
}

export default createConnectorsRuntimeRouter();

