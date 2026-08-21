/**
 * Server-side type boundary for the federated action manifest.
 *
 * The browser contract lives outside `server.rootDir`, so importing it from a
 * server compilation unit makes the standalone server typecheck fail with
 * TS6059. Keep this file type-only: the manifest implementation and validation
 * remain single-sourced in `shared/contracts/federatedActionManifest.ts`.
 */
export interface FederatedActionEntry {
  actionId: string;
  version: number;
  module: 'IDEA' | 'DYNAMIC_SWOT' | 'CHAT' | 'EXECUTION' | 'CASE_WORKSPACE';
  surface: string;
  mountedMutationId: string | null;
  effect: 'READ' | 'PROPOSAL' | 'REVERSIBLE_MUTATION' | 'DESTRUCTIVE_MUTATION';
  roles: string[];
  tenantScope: 'ORGANIZATION' | 'PROJECT_IN_ORGANIZATION';
  preview: 'REQUIRED' | 'NOT_REQUIRED';
  confirm: 'REQUIRED' | 'NOT_REQUIRED';
  idempotency: string | null;
  receipt: string | null;
  auditEvent: string | null;
  compensation: string;
  uiExecutor: string | null;
  teresaExecutor: string | null;
  mvpDisposition: 'SUPPORTED' | 'APPROVED_OUT' | 'NOT_SUPPORTED_IN_MVP';
}
