import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export const MEMBERSHIP_REVOKED_CODE = 'ORG_MEMBERSHIP_REVOKED';
export const MEMBERSHIP_UNVERIFIABLE_CODE = 'ORG_MEMBERSHIP_UNVERIFIABLE';
export const FINANCE_EDIT_FORBIDDEN_CODE = 'FINANCE_EDIT_FORBIDDEN';
const FINANCE_EDIT_ROLES = new Set(['owner','admin','editor','finance_admin','finance_editor']);
export const hasFinanceEditRole=(role:unknown):boolean=>FINANCE_EDIT_ROLES.has(String(role||'').toLowerCase());

/** Strict per-request tenant membership wall. Role claims, including SUPERADMIN, never bypass it. */
export async function requireActiveMembership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const anyReq = req as any;
  const userId = String(anyReq?.v8Context?.userId || anyReq?.user?.id || anyReq?.userId || '').trim();
  const organizationId = String(
    anyReq?.v8Context?.organizationId || anyReq?.user?.organizationId || anyReq?.organizationId || ''
  ).trim();
  if (!userId || !organizationId) {
    res.status(401).json({ success: false, code: MEMBERSHIP_UNVERIFIABLE_CODE });
    return;
  }
  try {
    const membership = await DbPromise.get<{ status?: string }>(
      `SELECT status FROM organization_members WHERE user_id=? AND organization_id=?`,
      [userId, organizationId],
      { fallback: false }
    );
    if (String(membership?.status || '').toUpperCase() !== 'ACTIVE') {
      res.status(403).json({ success: false, code: MEMBERSHIP_REVOKED_CODE });
      return;
    }
  } catch (error) {
    logger.error('[LegacyCutover] membership verification unavailable', error);
    res.status(503).json({ success: false, code: MEMBERSHIP_UNVERIFIABLE_CODE });
    return;
  }
  next();
}

/** Active membership plus the established Finance mutation-role policy. */
export async function requireFinanceEditorMembership(req:AuthRequest,res:Response,next:NextFunction):Promise<void>{
  const anyReq=req as any;
  const userId=String(anyReq?.v8Context?.userId||anyReq?.user?.id||anyReq?.userId||'').trim();
  const organizationId=String(anyReq?.v8Context?.organizationId||anyReq?.user?.organizationId||anyReq?.organizationId||'').trim();
  if(!userId||!organizationId){res.status(401).json({success:false,code:MEMBERSHIP_UNVERIFIABLE_CODE});return;}
  try{
    const membership=await DbPromise.get<{status?:string;role?:string}>(`SELECT status,role FROM organization_members WHERE user_id=? AND organization_id=?`,[userId,organizationId],{fallback:false});
    if(String(membership?.status||'').toUpperCase()!=='ACTIVE'){res.status(403).json({success:false,code:MEMBERSHIP_REVOKED_CODE});return;}
    if(!hasFinanceEditRole(membership?.role)){res.status(403).json({success:false,code:FINANCE_EDIT_FORBIDDEN_CODE});return;}
  }catch(error){logger.error('[Finance] editor membership verification unavailable',error);res.status(503).json({success:false,code:MEMBERSHIP_UNVERIFIABLE_CODE});return;}
  next();
}
