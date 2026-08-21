/** @vitest-environment node */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const tsx = path.resolve(process.cwd(), 'node_modules/.bin/tsx');
const script = path.resolve(process.cwd(), 'server/scripts/seed-wave3-initiatives-owner-review.ts');
function run(command: string, url: string, confirm?: string, manifest?: string) {
  return spawnSync(tsx, [script, command], { cwd: process.cwd(), env: { ...process.env, INITIATIVES_OWNER_FIXTURE_DATABASE_URL: url, ...(confirm ? { INITIATIVES_OWNER_FIXTURE_CONFIRM: confirm } : {}), ...(manifest ? { INITIATIVES_OWNER_FIXTURE_MANIFEST: manifest } : {}) }, encoding: 'utf8' });
}
describe('Wave 3 Initiatives owner fixture guard', () => {
  it('rejects non-local host', () => { const r = run('readback', 'postgresql://u:p@example.com/consultify_w3_initiatives_owner_x'); expect(r.status).not.toBe(0); expect(r.stderr).toContain('database host example.com is not local'); });
  it('rejects wrong prefix', () => { const r = run('readback', 'postgresql://u:p@127.0.0.1/consultify'); expect(r.status).not.toBe(0); expect(r.stderr).toContain('database name must match consultify_w3_initiatives_owner_'); });
  it('requires literal YES', () => { for (const command of ['seed','reset']) { const r = run(command, 'postgresql://u:p@127.0.0.1/consultify_w3_initiatives_owner_guard', undefined, path.join(os.tmpdir(), `never-${command}.json`)); expect(r.status).not.toBe(0); expect(r.stderr).toContain('requires INITIATIVES_OWNER_FIXTURE_CONFIRM=YES'); } });
  it('requires manifest', () => { const r = run('seed', 'postgresql://u:p@127.0.0.1/consultify_w3_initiatives_owner_guard', 'YES'); expect(r.status).not.toBe(0); expect(r.stderr).toContain('INITIATIVES_OWNER_FIXTURE_MANIFEST is required for seed'); });
  it('refuses overwrite', () => { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'w3-ini-manifest-')); const m=path.join(dir,'m.json'); fs.writeFileSync(m,'{"existing":true}\n',{mode:0o600}); try { const r=run('seed','postgresql://u:p@127.0.0.1/consultify_w3_initiatives_owner_guard','YES',m); expect(r.status).not.toBe(0); expect(r.stderr).toContain('overwrite is refused'); expect(fs.readFileSync(m,'utf8')).toBe('{"existing":true}\n'); } finally { fs.rmSync(dir,{recursive:true,force:true}); } });
});
