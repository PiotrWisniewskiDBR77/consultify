/**
 * INI-05 — one place every Portfolio/Resources/Roadmap mutation asks
 * "may this actor edit this initiative right now" through.
 *
 * This module does NOT implement a capability rule of its own. It is a thin
 * wrapper over the INI-04 canonical matrix
 * (`server/src/services/initiative/initiativeCapabilityMatrix.ts`, CODE_GO_FROZEN
 * — imported here, never modified) so that portfolio-membership, resource, and
 * roadmap/dependency writers all resolve the SAME decision (role profile +
 * status/terminal freeze) instead of eight independent inline copies.
 *
 * `computeInitiativeCapabilities().cards.canEditCards` is the general
 * "may edit this initiative's content" capability — it already folds in
 * admin override, RACI Accountable/Responsible, and terminal-status freeze.
 * There is no narrower "canManageTeam"/"canManageRoadmap" token in the INI-04
 * contract, so this is the "właściwa capability" the INI-05 brief asks for
 * (task text: "canEdit; canManageTeam lub właściwa capability").
 */
import {
  computeInitiativeCapabilities,
  resolveInitiativeCapabilityContext,
} from './initiativeCapabilityMatrix.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

export interface Ini005CapabilityDenial {
  status: number;
  body: {
    error: string;
    code: string;
    currentStatus?: string;
    roles?: string[];
  };
}

export interface Ini005CapabilityVerdict {
  allowed: boolean;
  denial: Ini005CapabilityDenial | null;
  effectiveRoles: string[];
}

/**
 * Resolve whether `actorId` may mutate `initiativeId` right now, and (on
 * denial) the exact 403 body every INI-05 write route should return.
 *
 * Fails closed: if the initiative can't be found in this org, or the actor id
 * is missing, this denies — it never falls through to "allow" on an error.
 */
export async function assertCanEditInitiative(params: {
  organizationId: string;
  initiativeId: string;
  actorId: string | null | undefined;
  actorRoleHint?: string | null;
}): Promise<Ini005CapabilityVerdict> {
  const { organizationId, initiativeId, actorId, actorRoleHint } = params;

  if (!actorId) {
    return {
      allowed: false,
      effectiveRoles: [],
      denial: {
        status: 401,
        body: { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      },
    };
  }

  const statusRow = await queryHelpers
    .queryOne<{ status?: string }>(
      `SELECT status FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId]
    )
    .catch(() => null);
  if (!statusRow) {
    return {
      allowed: false,
      effectiveRoles: [],
      denial: {
        status: 404,
        body: { error: 'Initiative not found', code: 'INITIATIVE_NOT_FOUND' },
      },
    };
  }

  const ctx = await resolveInitiativeCapabilityContext(
    organizationId,
    initiativeId,
    actorId,
    actorRoleHint
  );
  const decision = computeInitiativeCapabilities({
    status: String(statusRow.status || 'DRAFT'),
    effectiveRoles: ctx.effectiveRoles,
  });

  if (!decision.cards.canEditCards) {
    return {
      allowed: false,
      effectiveRoles: ctx.effectiveRoles,
      denial: {
        status: 403,
        body: {
          error: decision.isTerminal
            ? 'Initiative is in a terminal status and cannot be edited'
            : 'Your role does not have edit capability on this initiative',
          code: decision.isTerminal
            ? 'INITIATIVE_TERMINAL_STATUS_FROZEN'
            : 'CAPABILITY_REQUIRED',
          currentStatus: String(statusRow.status || 'DRAFT').toUpperCase(),
          roles: ctx.effectiveRoles,
        },
      },
    };
  }

  return { allowed: true, denial: null, effectiveRoles: ctx.effectiveRoles };
}
