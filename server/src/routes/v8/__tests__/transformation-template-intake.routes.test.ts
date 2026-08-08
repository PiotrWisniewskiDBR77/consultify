import express from 'express';
import request from 'supertest';
import { beforeEach,describe,expect,it,vi } from 'vitest';

const start=vi.fn(),convert=vi.fn();
vi.mock('../../../services/v8/transformationPlanningIntakeService.js',()=>({startPlanningIntakeFromTemplate:start,convertTemplatePlanningIntake:convert}));
vi.mock('../../../services/v8/transformationCaseService.js',()=>({TransformationCaseOperationError:class extends Error{constructor(public code:string,public httpStatus:number,message:string){super(message);}}}));
vi.mock('../../../services/v8/transformationFinalOutputService.js',()=>({}));
vi.mock('../../../services/v8/agentCanonicalRunService.js',()=>({}));

async function app(){const {default:router}=await import('../transformation-cases.routes.js');const server=express();server.use(express.json());server.use((req,_res,next)=>{(req as any).v8Context={organizationId:'org-a',userId:'actor-a',userRole:'CONSULTANT',isSuperAdmin:false};next();});server.use('/api/v8/transformation-cases',router);return server;}
describe('template planning intake routes',()=>{beforeEach(()=>vi.clearAllMocks());
  it('requires idempotency and derives tenant/actor for template selection',async()=>{const server=await app();expect((await request(server).post('/api/v8/transformation-cases/planning-intakes/from-template').send({templateId:'tpl-1'})).status).toBe(400);start.mockResolvedValue({intakeId:'intake-1',idempotentReplay:false});const response=await request(server).post('/api/v8/transformation-cases/planning-intakes/from-template').set('Idempotency-Key','template-start-key').send({templateId:'tpl-1',organizationId:'foreign',actorUserId:'attacker'});expect(response.status).toBe(201);expect(start).toHaveBeenCalledWith(expect.objectContaining({templateId:'tpl-1',organizationId:'org-a',actorUserId:'actor-a',idempotencyKey:'template-start-key'}));});
  it('requires a conversion key and exact pinned digest',async()=>{convert.mockResolvedValue({transformationCaseId:'case-1',idempotentReplay:false});const response=await request(await app()).post('/api/v8/transformation-cases/planning-intakes/intake-1/convert-template').set('Idempotency-Key','template-convert-key').send({expectedTemplateDigest:'digest-v1',organizationId:'foreign'});expect(response.status).toBe(200);expect(convert).toHaveBeenCalledWith({intakeId:'intake-1',organizationId:'org-a',actorUserId:'actor-a',idempotencyKey:'template-convert-key',expectedTemplateDigest:'digest-v1'});});
});
