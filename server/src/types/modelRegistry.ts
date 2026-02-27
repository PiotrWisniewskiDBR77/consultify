/**
 * Model Registry Types
 * V3-A06: SuperAdmin Model Registry backend extensions
 */

export type ModelKind = 'TEXT_LLM' | 'IMAGE_MODEL' | 'BUSINESS_MODEL';

export type ProviderType = 'direct' | 'aggregator' | 'local' | 'customer_managed';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  streaming: boolean;
  jsonMode: boolean;
  contextWindow: number;
}

export interface ModelRegistryEntry {
  id: string;
  name: string;
  provider: string;
  providerType: ProviderType;
  originVendor: string;
  modelId: string;
  kind: ModelKind;
  isActive: boolean;
  healthStatus: HealthStatus;
  lastHealthCheck?: Date;
  avgLatencyMs?: number;
  costPer1k?: number;
  capabilities: ModelCapabilities;
  executionRegions: string[];
  allowedDataClasses: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PurposeAssignment {
  id: string;
  purpose: string;
  kind: ModelKind;
  registryModelId: string;
  tier?: string;
  priority: number;
  isActive: boolean;
  fallbackModelId?: string;
}

export interface ModelAuditLog {
  id: string;
  action: 'created' | 'updated' | 'deleted' | 'assignment_changed' | 'fallback_used';
  entityType: 'model' | 'assignment' | 'policy';
  entityId: string;
  changedBy: string;
  changedAt: Date;
  changes: Record<string, unknown>;
}

/** Partial requirements for model selection (vision, tools, etc.) */
export interface ModelRequirements {
  vision?: boolean;
  tools?: boolean;
  streaming?: boolean;
  jsonMode?: boolean;
  contextWindow?: number;
}

export interface PurposeRoutingRequest {
  organizationId: string;
  purpose: string;
  requirements?: Partial<ModelRequirements>;
  options?: { preferLocal?: boolean; dataClass?: string };
}

export interface PurposeRoutingResult {
  modelId: string;
  provider: string;
  modelRegistryId: string;
  isFallback: boolean;
  fallbackReason?: string;
}
