/**
 * Shared Method Kernel — backend runtime barrel.
 *
 * Route/controller code in server/src should import kernel services from
 * HERE (not from the individual service files), mirroring the pattern of
 * src/method-core/contracts/index.ts on the frontend side.
 */

export { MethodEventStore, methodEventStore } from './MethodEventStore.js';
export type { AppendEventInput } from './MethodEventStore.js';

export { MethodPackRegistry, methodPackRegistry } from './MethodPackRegistry.js';
export type { MethodPackRecord, RegisterMethodPackInput } from './MethodPackRegistry.js';

export { MethodSessionService } from './MethodSessionService.js';
export type {
  CreateSessionInput,
  CreateSessionRefusal,
  CreateSessionResult,
  PackReadinessLookup,
} from './MethodSessionService.js';

export { TeresaProposalService, teresaProposalService } from './TeresaProposalService.js';
export type { CreatePreviewInput } from './TeresaProposalService.js';
