/** @vitest-environment node */
import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const createProposal=vi.fn();
vi.mock('../../../server/src/services/myWork/agentApprovedMaterializationService.js',()=>({
  createMaterializationProposal:createProposal,
  decideMaterializationProposal:vi.fn(),
  getAgentPlanSourceIdentity:vi.fn(),
  materializeApprovedProposal:vi.fn(),
}));

describe('MYW agent materialization route contract',()=>{
  let app:any;
  beforeAll(async()=>{
    const {default:router}=await import('../../../server/src/routes/my-work/agent-materialization.routes.js');
    app=express(); app.use(express.json()); app.use((req:any,_res,next)=>{req.userId='user-1';req.organizationId='org-1';next();}); app.use(router);
  });
  it('rejects caller-supplied tenant/requester fields before service invocation',async()=>{
    const response=await request(app).post('/agent-materialization/proposals').send({organizationId:'foreign',requesterId:'foreign',
      sourcePlanId:'plan',sourceVersion:1,sourceHash:'a'.repeat(64),targetKind:'task',content:{title:'x'},
      idempotencyKey:'key',expiresAt:new Date(Date.now()+60_000).toISOString()});
    expect(response.status).toBe(400); expect(createProposal).not.toHaveBeenCalled();
  });
  it('derives tenant/requester exclusively from mounted auth context',async()=>{
    createProposal.mockResolvedValueOnce({proposal:{proposal_id:'p1'},replayed:false});
    const response=await request(app).post('/agent-materialization/proposals').send({sourcePlanId:'plan',sourceVersion:1,
      sourceHash:'a'.repeat(64),targetKind:'task',content:{title:'x'},idempotencyKey:'key',expiresAt:new Date(Date.now()+60_000).toISOString()});
    expect(response.status).toBe(201);
    expect(createProposal).toHaveBeenCalledWith(expect.objectContaining({organizationId:'org-1',requesterId:'user-1'}));
  });
});
