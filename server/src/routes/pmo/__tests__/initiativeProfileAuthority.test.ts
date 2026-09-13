/** @vitest-environment node */
import {describe,it,expect,vi} from 'vitest';
import {assertConfiguredProfileAuthority} from '../definitionApprovalAdapter';
import {configuredCardProfile} from '../../../domain/initiatives-execution/configureInitiativeCards';
import {INITIATIVE_CARD_KEYS} from '../../../../../src/contracts/initiatives-execution/cardRegistry';
const profile=()=>configuredCardProfile({id:'t',updatedAt:'2026-09-12',sectionConfig:{initiativeCardProfile:{profileKey:'technology',version:1,policy:{policyId:'current-policy',policyVersion:4},cards:INITIATIVE_CARD_KEYS.map((cardKey,position)=>({cardKey,position,included:true,requiredness:'OPTIONAL',requiredFields:[],reviewRequired:true,reviewerIds:['reviewer']}))}}});
const actor={userId:'owner',organizationId:'org',applicationRole:'OWNER',isImpersonating:false};
const initiative={initiativeId:'initiative',projectId:'project'};
describe('configured reviewer authorization resolver',()=>{
 const setup=()=>({resolvePolicy:vi.fn(async()=>({policyId:'current-policy',version:4})),reader:{listDefinitionApprovalMembers:vi.fn(async()=>[{id:'reviewer',name:'Reviewer',role:'MEMBER'}])},authorize:vi.fn(async()=>true)});
 it('requires current project membership and capability even for a named template ID',async()=>{const deps=setup();await assertConfiguredProfileAuthority(deps as any,actor,initiative,profile());expect(deps.reader.listDefinitionApprovalMembers).toHaveBeenCalledWith('org','project');expect(deps.authorize).toHaveBeenCalledWith(expect.objectContaining({userId:'reviewer',applicationRole:'MEMBER'}),'project','initiative.review');deps.authorize.mockResolvedValue(false);await expect(assertConfiguredProfileAuthority(deps as any,actor,initiative,profile())).rejects.toThrow('CARD_PROFILE_REVIEWER_UNAVAILABLE');});
 it('denies removed membership before looking up a global or fallback capability',async()=>{const deps=setup();deps.reader.listDefinitionApprovalMembers.mockResolvedValue([]);await expect(assertConfiguredProfileAuthority(deps as any,actor,initiative,profile())).rejects.toThrow('CARD_PROFILE_REVIEWER_UNAVAILABLE');expect(deps.authorize).not.toHaveBeenCalled();});
 it('denies stale policy before approving template authority',async()=>{const deps=setup();deps.resolvePolicy.mockResolvedValue({policyId:'current-policy',version:5});await expect(assertConfiguredProfileAuthority(deps as any,actor,initiative,profile())).rejects.toThrow('CARD_PROFILE_POLICY_CONFLICT');expect(deps.authorize).not.toHaveBeenCalled();});
});
