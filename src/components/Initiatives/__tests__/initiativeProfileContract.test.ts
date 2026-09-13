/** @vitest-environment node */
import {describe,it,expect} from 'vitest';
import {configuredCardProfile} from '../../../../server/src/domain/initiatives-execution/configureInitiativeCards';
import {INITIATIVE_CARD_KEYS} from '@/contracts/initiatives-execution/cardRegistry';
const configured=()=>({id:'template-1',updatedAt:'2026-09-12T00:00:00Z',sectionConfig:{initiativeCardProfile:{profileKey:'technology',version:1,policy:{policyId:'policy-1',policyVersion:3},cards:INITIATIVE_CARD_KEYS.map((cardKey,position)=>({cardKey,position,included:true,requiredness:'REQUIRED',requiredFields:['evidence'],reviewRequired:true,reviewerIds:['reviewer-1']}))}}});
describe('configured profile authority contract',()=>{
 it('preserves the explicit policy and named reviewers in the hashed profile',()=>{
  const p=configuredCardProfile(configured());expect(p).toMatchObject({policy:{policyId:'policy-1',policyVersion:3},cards:expect.arrayContaining([expect.objectContaining({reviewerIds:['reviewer-1']})])});
  const changed=configured();changed.sectionConfig.initiativeCardProfile.cards[0].reviewerIds=['reviewer-2'];expect(configuredCardProfile(changed).contentHash).not.toBe(p.contentHash);
 });
 it('rejects a required review without a named reviewer',()=>{const value=configured();value.sectionConfig.initiativeCardProfile.cards[0].reviewerIds=[];expect(()=>configuredCardProfile(value)).toThrow('CARD_PROFILE_CONFIGURATION_MISSING');});
 it('rejects missing governance policy instead of guessing a baseline',()=>{const value=configured();delete (value.sectionConfig.initiativeCardProfile as any).policy;expect(()=>configuredCardProfile(value)).toThrow('CARD_PROFILE_CONFIGURATION_MISSING');});
});
