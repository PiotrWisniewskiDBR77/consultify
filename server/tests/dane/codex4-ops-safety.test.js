/** DRAFT tests: pure safety boundary tests; do NOT claim ApiGateway/login/real-PG proof.
 * Run per file with server/vitest.config.ts after copying draft to the worktree.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rootCertificates } from 'node:tls';
import { assertTarget, parseArgs, writePrivate, verifyBackup, DBR77, E4SafetyError, reportFailure, finish, tlsConfiguration } from '../../../scripts/dane/codex4-ops-safety.mjs';
import { assertClone } from '../../../scripts/dane/sprzatanie-klonow-demo-session-20260912.mjs';
import { assertExistingUser, assertPilotMembership, password14, PILOTS } from '../../../scripts/dane/pilotaz-demo-konta-20260912.mjs';
const tmp = [];
afterEach(() => { vi.restoreAllMocks(); for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
const target = () => ({ version:1, operation:'pilot-accounts', intendedEnvironment:'staging', executionEnvironment:'local-copy', host:'127.0.0.1', port:6455, database:'cx4_pilot', organizationIds:[DBR77] });
const cloneTarget = () => ({ baseDemoOrganizationIds:['ateliertoys-demo'], protectedOrganizationIds:[DBR77], seedEmails:['seed@demo.ateliertoys.com'], expiryCutoff:'2026-01-01T00:00:00.000Z' });
const org = () => ({ id:'ateliertoys-demo-session-a-b', name:'Atelier Toys', organization_type:'DEMO', billing_status:'trial', created_at:'2025-01-01T00:00:00.000Z' });

describe('E4 connection and mode boundaries', () => {
  it('defaults to dry-run and requires a reviewable target and private manifest', () => {
    expect(parseArgs(['--target-manifest=/tmp/target.json','--manifest=/tmp/m.json']).apply).toBe(false);
    expect(() => parseArgs(['--apply'])).toThrow('TARGET_AND_MANIFEST_REQUIRED');
    expect(() => parseArgs(['--apply','--dry-run'])).toThrow('CONFLICTING_MODES');
  });
  it.each(['postgres://u:p@remote.invalid:6455/cx4_pilot','postgres://u:p@localhost:5432/cx4_pilot','postgres://u:p@127.0.0.1:6455/live','postgres://u:p@127.0.0.1:6455/cx4_pilot?host=remote.invalid'])('rejects remote, foreign DB/port and query host override: %s', url => {
    expect(() => assertTarget(url, target(),'pilot-accounts')).toThrow();
  });
  it('binds the reviewed target to connection identity and operation', () => {
    const url='postgres://u:p@127.0.0.1:6455/cx4_pilot';
    expect(assertTarget(url,target(),'pilot-accounts').database).toBe('cx4_pilot');
    expect(() => assertTarget(url,{...target(),database:'cx4_other'},'pilot-accounts')).toThrow('TARGET_DATABASE_MISMATCH');
    expect(() => assertTarget(url,target(),'cleanup-demo-clones')).toThrow('TARGET_CONTRACT_MISMATCH');
    expect(() => assertTarget(url,{...target(),organizationIds:[DBR77,DBR77]},'pilot-accounts')).toThrow();
  });
  it('operator mode needs exact explicit URL and manifest identity, with no default remote values', () => {
    const url='postgres://u:p@review-only.invalid:7777/review_only';
    const t={...target(),host:'review-only.invalid',port:7777,database:'review_only',executionEnvironment:'staging'};
    expect(() => assertTarget(url,t,'pilot-accounts',{target:'staging'})).toThrow('OPERATOR_EXPECTED_IDENTITY_REQUIRED');
    expect(() => assertTarget(url,t,'pilot-accounts',{target:'staging','expected-host':'other.invalid','expected-database':'review_only'})).toThrow('OPERATOR_IDENTITY_MISMATCH');
    const options={target:'staging','expected-host':'review-only.invalid','expected-database':'review_only'};
    expect(() => assertTarget(url,t,'pilot-accounts',options)).toThrow('OPERATOR_TLS_CA_REQUIRED');
    expect(() => assertTarget(url,t,'pilot-accounts',{...options,'tls-ca':'relative.pem'})).toThrow('OPERATOR_TLS_CA_REQUIRED');
    const d=fs.mkdtempSync(path.join(os.tmpdir(),'cx4-ca-test-'));tmp.push(d);
    const ca=path.join(d,'review-ca.pem');fs.writeFileSync(ca,rootCertificates[0]);
    const secure={...options,'tls-ca':ca};
    expect(assertTarget(url,t,'pilot-accounts',secure).database).toBe('review_only');
    expect(tlsConfiguration(secure)).toEqual({ca:rootCertificates[0],rejectUnauthorized:true});
    expect(tlsConfiguration({target:'local'})).toBe(false);
    fs.writeFileSync(ca,'not a certificate');
    expect(() => assertTarget(url,t,'pilot-accounts',secure)).toThrow('OPERATOR_TLS_CA_INVALID');
  });
  it('requires a full backup for apply; a counts manifest is insufficient', async () => {
    await expect(verifyBackup(target())).rejects.toThrow('FULL_BACKUP_REQUIRED');
    await expect(verifyBackup({...target(),backup:{kind:'json-manifest'}})).rejects.toThrow('FULL_BACKUP_REQUIRED');
  });
});

describe('E4 deletion qualification independent of labels', () => {
  it('accepts an expired exact session clone even with branded display name, never selects by name', () => {
    expect(() => assertClone(org(),cloneTarget(),[],false)).not.toThrow();
    expect(() => assertClone({...org(),id:'real-customer-id'},cloneTarget(),[],false)).toThrow('NOT_EXACT_EPHEMERAL_CLONE');
  });
  it.each([DBR77,'*','__system__','__global__','demo-org','ateliertoys-demo'])('protects baseline and template id %s', id => {
    expect(() => assertClone({...org(),id},cloneTarget(),[],false)).toThrow();
  });
  it('does not let a familiar seed email excuse a prior human login', () => {
    expect(() => assertClone(org(),cloneTarget(),[{email:'seed@demo.ateliertoys.com',last_login:'2025-01-01'}],false)).toThrow('HUMAN_MEMBER_PRESENT');
  });
  it('last_login_at alone also protects a previously logged-in person', () => {
    expect(() => assertClone(org(),cloneTarget(),[{email:'seed@demo.ateliertoys.com',last_login:null,last_login_at:'2025-01-01'}],false)).toThrow('HUMAN_MEMBER_PRESENT');
  });
  it.each([{email:'human@dbr77.com',last_login:null},{email:null,last_login:null}])('rejects unknown human identity %#', user => {
    expect(() => assertClone(org(),cloneTarget(),[user],false)).toThrow('HUMAN_MEMBER_PRESENT');
  });
  it('cannot relabel a real human email as an allowed seed', () => {
    expect(() => assertClone(org(), {...cloneTarget(),seedEmails:['human@dbr77.com']}, [{email:'human@dbr77.com',last_login:null}], false)).toThrow('UNPROVEN_SEED_IDENTITY');
  });
  it('holds, payments, template marker and unproven age block deletion', () => {
    expect(() => assertClone(org(),cloneTarget(),[],true)).toThrow('LEGAL_HOLD');
    expect(() => assertClone({...org(),billing_status:'paid'},cloneTarget(),[],false)).toThrow();
    expect(() => assertClone({...org(),is_template:true},cloneTarget(),[],false)).toThrow('TEMPLATE_PROTECTED');
    expect(() => assertClone({...org(),created_at:null},cloneTarget(),[],false)).toThrow('EXPIRY_NOT_PROVEN');
  });
});

describe('E4 private credentials and account identity', () => {
  it('temporary password meets all classes, is fourteen characters, has multiple independent outputs', () => {
    const values=Array.from({length:20},password14);
    expect(new Set(values).size).toBe(20);
    for (const p of values) { expect(p).toHaveLength(14); expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/[2-9]/); expect(p).toMatch(/[!@#$%*_-]/); }
    expect(PILOTS).toHaveLength(4);
  });
  it('never moves existing account across orgs or resolves duplicate email by first result', () => {
    expect(() => assertExistingUser([{organization_id:'other',status:'active'}])).toThrow();
    expect(() => assertExistingUser([{organization_id:DBR77},{organization_id:DBR77}])).toThrow('AMBIGUOUS_EMAIL');
    expect(() => assertExistingUser([{organization_id:DBR77,status:'deleted'}])).toThrow();
  });
  it('private output cannot overwrite prior credentials and has mode0600', () => {
    const d=fs.mkdtempSync(path.join(os.tmpdir(),'cx4-safe-test-'));tmp.push(d);
    const p=path.join(d,'private.json');writePrivate(p,{temporaryPassword:'not-real'});
    expect(fs.statSync(p).mode & 0o777).toBe(0o600);
    expect(() => writePrivate(p,{})).toThrow();
    expect(JSON.parse(fs.readFileSync(p,'utf8')).temporaryPassword).toBe('not-real');
  });
  it('rejects outputs through symlinks into a checkout', () => {
    const d=fs.mkdtempSync(path.join(os.tmpdir(),'cx4-safe-test-'));tmp.push(d);
    fs.mkdirSync(path.join(d,'repo'));fs.writeFileSync(path.join(d,'repo','.git'),'gitdir: nowhere');
    fs.symlinkSync(path.join(d,'repo'),path.join(d,'alias'));
    expect(() => writePrivate(path.join(d,'alias','passwords.json'),{})).toThrow('OUTPUT_INSIDE_CHECKOUT');
  });
});

describe('typed errors and commit ambiguity', () => {
  it('only emits typed safe codes, never raw connection/password errors', () => {
    const messages=[];const spy=vi.spyOn(console,'error').mockImplementation(x=>messages.push(x));const previous=process.exitCode;
    try {reportFailure(new Error('postgres://secret:password@remote/private'));expect(messages.join(' ')).not.toContain('password');expect(messages.join(' ')).toContain('UNCLASSIFIED_FAILURE');reportFailure(new E4SafetyError('HUMAN_MEMBER_PRESENT'));expect(messages.join(' ')).toContain('HUMAN_MEMBER_PRESENT');}
    finally {spy.mockRestore();process.exitCode=previous;}
  });
  it('a lost COMMIT acknowledgement never implies confirmed rollback', async () => {
    const queries=[];const client={query:async sql=>{queries.push(sql);if(sql==='COMMIT')throw Error('network lost');},release:vi.fn()};const pool={end:vi.fn(async()=>{})};
    await expect(finish({client,pool},true)).rejects.toThrow('COMMIT_OUTCOME_UNKNOWN');expect(queries).toEqual(['COMMIT','ROLLBACK']);expect(client.release).toHaveBeenCalled();
  });
});


describe('E4 review corrections — pure, no database acceptance implied', () => {
  it('does not reinstate a deleted membership or change an existing active role', () => {
    const existing={id:'existing',role:'OWNER',organization_id:DBR77};
    expect(() => assertPilotMembership(existing,[])).toThrow('EXISTING_MEMBERSHIP_REQUIRES_REVIEW');
    expect(() => assertPilotMembership(existing,[{role:'OWNER',status:'INACTIVE'}])).toThrow('MEMBERSHIP_REQUIRES_REVIEW');
    const memberships=[{role:'OWNER',status:'ACTIVE'}];
    expect(() => assertPilotMembership(existing,memberships)).not.toThrow();
    expect(memberships).toEqual([{role:'OWNER',status:'ACTIVE'}]);
    expect(() => assertPilotMembership(null,[])).not.toThrow();
  });
  it.each(['host','port','database'])('backup source mismatch %s fails before reading any artifact', async field => {
    const t=target();const backup={host:t.host,port:t.port,database:t.database,kind:'pg_dump-custom-full',sha256:'a'.repeat(64),path:'/does-not-exist'};
    backup[field]=field==='port'?9999:'other';
    await expect(verifyBackup({...t,backup})).rejects.toThrow('FULL_BACKUP_REQUIRED');
  });
  it.each(['release','end','both'])('acknowledged COMMIT survives %s cleanup failure with static warnings', async mode => {
    const spy=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const client={query:vi.fn(async()=>{}),release:()=>{if(mode!=='end')throw Error('private release detail');}};
    const pool={end:async()=>{if(mode!=='release')throw Error('private pool detail');}};
    const result=await finish({client,pool},true);
    expect(result.committed).toBe(true);expect(result.cleanupWarnings.length).toBe(mode==='both'?2:1);
    expect(client.query).toHaveBeenCalledTimes(1);expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(JSON.stringify(spy.mock.calls)).not.toContain('private');
  });
  it('lost COMMIT ACK remains UNKNOWN even when rollback and both resource cleanups fail', async () => {
    vi.spyOn(console,'warn').mockImplementation(()=>{});
    const client={query:async()=>{throw Error('secret connection');},release:()=>{throw Error('release');}};
    const pool={end:async()=>{throw Error('end');}};
    await expect(finish({client,pool},true)).rejects.toThrow('COMMIT_OUTCOME_UNKNOWN');
  });
  it('preserves the original human guard refusal through failed rollback and cleanup', async () => {
    vi.spyOn(console,'warn').mockImplementation(()=>{});
    const refusal=new E4SafetyError('HUMAN_MEMBER_PRESENT');
    const client={query:async()=>{throw Error('rollback');},release:()=>{throw Error('release');}};
    const pool={end:async()=>{throw Error('end');}};
    await expect(finish({client,pool},false,refusal)).rejects.toBe(refusal);
  });
  it('syncs both credential file and parent directory', () => {
    const d=fs.mkdtempSync(path.join(os.tmpdir(),'cx4-durable-test-'));tmp.push(d);
    const sync=vi.spyOn(fs,'fsyncSync');
    writePrivate(path.join(d,'credentials.json'),{test:true});
    expect(sync).toHaveBeenCalledTimes(2);
  });
  it.each(['open','write','file-sync','directory-open','directory-sync'])('durable writer propagates %s failure before caller may COMMIT', async stage => {
    const d=fs.mkdtempSync(path.join(os.tmpdir(),'cx4-durable-test-'));tmp.push(d);
    const failure=new Error('injected storage failure');
    if(stage==='open')vi.spyOn(fs,'openSync').mockImplementationOnce(()=>{throw failure;});
    if(stage==='directory-open'){const realOpen=fs.openSync;vi.spyOn(fs,'openSync').mockImplementationOnce((...args)=>realOpen(...args)).mockImplementationOnce(()=>{throw failure;});}
    if(stage==='write')vi.spyOn(fs,'writeFileSync').mockImplementationOnce(()=>{throw failure;});
    if(stage==='file-sync')vi.spyOn(fs,'fsyncSync').mockImplementationOnce(()=>{throw failure;});
    if(stage==='directory-sync')vi.spyOn(fs,'fsyncSync').mockImplementationOnce(()=>{}).mockImplementationOnce(()=>{throw failure;});
    const commit=vi.fn();
    // Pure ordering example; real runPilot storage-fault rollback remains a runtime gate.
    const precommit=async()=>{writePrivate(path.join(d,'credentials.json'),{});await commit();};
    await expect(precommit()).rejects.toBe(failure);expect(commit).not.toHaveBeenCalled();
  });
});

it('rejects group-readable backup and final symlink artifacts', async () => {
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'cx4-backup-test-'));tmp.push(d);
  const dump=path.join(d,'backup.dump');fs.writeFileSync(dump,'PGDMPfake', {mode:0o644});fs.chmodSync(dump,0o644);
  const t=target(), backup={host:t.host,port:t.port,database:t.database,kind:'pg_dump-custom-full',sha256:'a'.repeat(64),path:dump};
  await expect(verifyBackup({...t,backup})).rejects.toThrow('BACKUP_ARTIFACT_NOT_PRIVATE');
  fs.chmodSync(dump,0o600);const link=path.join(d,'link.dump');fs.symlinkSync(dump,link);
  await expect(verifyBackup({...t,backup:{...backup,path:link}})).rejects.toThrow();
});
