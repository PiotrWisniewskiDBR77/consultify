import { Pool, type PoolConfig } from 'pg';
import databaseConfig from '../config/DatabaseConfig.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { computeContentHash } from '../method-core/db.js';
import { PostgresMaterialCommandUnitOfWork } from '../domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js';
import { StaffingFieldsSchema, StaffingNotFoundError, writeLegacyStaffing, type StaffingMutation } from '../domain/initiatives-execution/staffingPlans.js';
import { MaterialCommandConflictError, MaterialCommandValidationError, MaterialCommandRuleError } from '../domain/initiatives-execution/materialCommand.js';
import type { Response } from 'express';

import staffingPlanService from '../services/staffingPlanService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const staffingUnitOfWork=new PostgresMaterialCommandUnitOfWork(new Pool(databaseConfig.postgres as PoolConfig|undefined));
/** Local writer boundary: protect legacy OFF too; canonical transaction repeats its own scope check. */
async function handleStaffingWrite(req:AuthenticatedRequest,res:Response,kind:StaffingMutation['kind'],operation:StaffingMutation['operation']):Promise<boolean>{
  const organizationId=req.user?.organizationId,actorId=req.user?.id;
  if(!organizationId||!actorId){res.status(401).json({error:'Unauthorized'});return true;}
  const initiativeId=String(req.params.id),planId=String(req.params.planId||''),roleId=String(req.params.roleId||'');
  const parent=await queryHelpers.queryOne('SELECT id FROM initiatives WHERE id=? AND organization_id=?',[initiativeId,organizationId]);
  if(!parent){res.status(404).json({error:'Staffing plan not found'});return true;}
  if(kind==='role'&&req.body?.assignedUserId){
    const user=await queryHelpers.queryOne('SELECT id FROM users WHERE id=? AND organization_id=?',[req.body.assignedUserId,organizationId]);
    if(!user){res.status(404).json({error:'Staffing plan not found'});return true;}
  }
  const enabled=process.env.ENABLE_INITIATIVE_UNIFIED_WRITE==='true';
  if(!enabled){
    if(!(kind==='plan'&&operation==='create')){
      const plan=await queryHelpers.queryOne('SELECT id FROM staffing_plans WHERE id=? AND initiative_id=? AND organization_id=?',[planId,initiativeId,organizationId]);
      if(!plan){res.status(404).json({error:'Staffing plan not found'});return true;}
    }
    return false;
  }
  const parsed=StaffingFieldsSchema.safeParse(req.body||{});
  if(!parsed.success){res.status(400).json({code:'VALIDATION_FAILED'});return true;}
  const fields=parsed.data;
  if(operation==='create'){if(kind==='plan'&&fields.name)fields.name=fields.name.trim();if(kind==='role'&&fields.roleName)fields.roleName=fields.roleName.trim();}
  const key=req.get('Idempotency-Key')?.trim();
  let capacitySource:unknown;
  if(kind==='capacity'&&!key)capacitySource=await queryHelpers.queryOne(`SELECT (SELECT COALESCE(SUM(allocation_percentage),0) FROM initiative_resources WHERE initiative_id=? AND organization_id=?) AS allocated,(SELECT COALESCE(SUM(r.fte_required),0) FROM staffing_plan_roles r JOIN staffing_plans p ON p.id=r.staffing_plan_id WHERE p.initiative_id=? AND p.organization_id=?) AS required`,[initiativeId,organizationId,initiativeId,organizationId]);
  const base=`staffing-${computeContentHash({organizationId,initiativeId,planId,roleId,kind,operation,key:key||null,...(key?{}:{fields,capacitySource:capacitySource||null})})}`;
  const itemId=kind==='capacity'?initiativeId:operation==='create'?base:kind==='plan'?planId:roleId;
  try{
    const result=await writeLegacyStaffing(staffingUnitOfWork,{organizationId,actorId,initiativeId,planId,kind,operation,fields,itemId,clientRequestId:base,expectedVersion:req.body?.expectedCanonicalVersion,hasIdempotencyKey:Boolean(key)});
    if(operation==='create')res.status(result.status==='APPLIED'?201:200).json(result.response);else res.json({success:true});
  }catch(error){
    if(error instanceof StaffingNotFoundError)res.status(404).json({error:'Staffing plan not found'});
    else if(error instanceof MaterialCommandConflictError)res.status(409).json({code:'VERSION_CONFLICT'});
    else if(error instanceof MaterialCommandRuleError)res.status(error.httpStatus).json({code:error.rule});
    else if(error instanceof MaterialCommandValidationError)res.status(400).json({code:'VALIDATION_FAILED'});
    else throw error;
  }
  return true;
}

export class StaffingPlanController {
  static listPlans = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const plans = await staffingPlanService.listPlans(initiativeId, orgId);
      res.json({ plans });
    }
  );

  static createPlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if(await handleStaffingWrite(req,res,'plan','create'))return;


      const { name, status, plannedStart, plannedEnd, notes } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      const plan = await staffingPlanService.createPlan(
        initiativeId,
        orgId,
        { name: name.trim(), status, plannedStart, plannedEnd, notes },
        userId
      );
      res.status(201).json(plan);
    }
  );

  static getPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const { planId } = req.params as any;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await staffingPlanService.getPlan(planId, orgId);
    if (!result) {
      res.status(404).json({ error: 'Staffing plan not found' });
      return;
    }

    res.json(result);
  });

  static updatePlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { planId } = req.params as any;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if(await handleStaffingWrite(req,res,'plan','update'))return;


      const { name, status, plannedStart, plannedEnd, notes } = req.body;
      await staffingPlanService.updatePlan(planId, orgId, {
        name,
        status,
        plannedStart,
        plannedEnd,
        notes,
      });
      res.json({ success: true });
    }
  );

  static deletePlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { planId } = req.params as any;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if(await handleStaffingWrite(req,res,'plan','delete'))return;


      await staffingPlanService.deletePlan(planId, orgId);
      res.json({ success: true });
    }
  );

  static addRole = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const { planId } = req.params as any;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
      if(await handleStaffingWrite(req,res,'role','create'))return;


    const { roleName, requiredSkills, fteRequired, assignedUserId, startDate, endDate, priority } =
      req.body;
    if (!roleName || typeof roleName !== 'string' || !roleName.trim()) {
      res.status(400).json({ error: 'roleName is required' });
      return;
    }

    const role = await staffingPlanService.addRole(planId, {
      roleName: roleName.trim(),
      requiredSkills,
      fteRequired,
      assignedUserId,
      startDate,
      endDate,
      priority,
    });
    res.status(201).json(role);
  });

  static updateRole = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { planId, roleId } = req.params as any;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if(await handleStaffingWrite(req,res,'role','update'))return;


      const {
        roleName,
        requiredSkills,
        fteRequired,
        fteAllocated,
        assignedUserId,
        startDate,
        endDate,
        priority,
        status,
      } = req.body;
      await staffingPlanService.updateRole(roleId, planId, {
        roleName,
        requiredSkills,
        fteRequired,
        fteAllocated,
        assignedUserId,
        startDate,
        endDate,
        priority,
        status,
      });
      res.json({ success: true });
    }
  );

  static deleteRole = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { planId, roleId } = req.params as any;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if(await handleStaffingWrite(req,res,'role','delete'))return;


      await staffingPlanService.deleteRole(roleId, planId);
      res.json({ success: true });
    }
  );

  static getGaps = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const { planId } = req.params as any;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // SECURITY-C2B-GAPS: validate tenant ownership before reading role gaps.
    if (!(await staffingPlanService.getPlan(planId, orgId))) {
      res.status(404).json({ error: 'Staffing plan not found' });
      return;
    }

    const gaps = await staffingPlanService.computeStaffingGaps(planId, orgId);
    res.json({ gaps });
  });

  static syncCapacity = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if(await handleStaffingWrite(req,res,'capacity','sync'))return;


      await staffingPlanService.syncInitiativeCapacity(initiativeId, orgId);
      res.json({ success: true });
    }
  );
}

export default StaffingPlanController;
