import { v8Get } from './client';

export interface V8MultiplayerResourceMapping {
  mappingId: string;
  resourceType: string;
  roomGranularity: string;
  embeddedIn: string | null;
  surfaceAware: boolean;
  organizationId: string;
  createdAt: string;
}

export const V8MultiplayerApi = {
  getWorkspaceMapping: () =>
    v8Get<{ mapping: V8MultiplayerResourceMapping | null; resourceType: string }>(
      '/multiplayer/resource-mappings/workspace',
    ),
};
