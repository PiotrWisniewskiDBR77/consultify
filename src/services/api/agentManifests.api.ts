/**
 * Agent Manifest API client (HP-4 — manifest-launcher, koncept §4 zadanie
 * "Agent Builder = uruchamianie gotowych 31 manifestów", decyzja Piotra 07-16).
 *
 * Thin wrapper over `GET /api/ai/agent-manifests` (server/src/routes/ai/
 * agent-manifests.routes.ts) — read-only catalog of the 31 Discovery Tool
 * agent manifests (server/src/services/ai/agentRuntime/
 * discoveryAgentManifestCatalog.ts). This endpoint was ALREADY live before
 * HP-4 (M01 wiring) — this client just gives the launcher UI a typed way to
 * call it.
 */
import { apiGet } from './baseClient';

export type AgentManifestStatus = 'built' | 'planned';

export interface AgentManifestSummary {
  id: string;
  sourceType: 'discovery_tool';
  status: AgentManifestStatus;
  displayName: { pl: string; en: string };
  wave: string;
  configDir: string | null;
  /** AGT-011: liczba kroków wygenerowanych przez PlanBuilder (kolumna tabeli szablonów). */
  stepCount?: number;
}

export async function listAgentManifests(filters?: {
  status?: AgentManifestStatus;
  wave?: string;
}): Promise<{ total: number; manifests: AgentManifestSummary[] }> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.wave) params.set('wave', filters.wave);
  const query = params.toString();
  return apiGet<{ total: number; manifests: AgentManifestSummary[] }>(
    `/ai/agent-manifests${query ? `?${query}` : ''}`,
    'Failed to load agent manifests'
  );
}
