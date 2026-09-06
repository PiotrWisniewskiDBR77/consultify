import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';

export type Mode = { kind: 'dry-run' | 'apply' | 'rollback'; manifest?: string };
export type ManifestEntry = { table: string; idColumn: string; id: string; action: 'archive' | 'delete'; before: Record<string, unknown>; backupCsv?: string };
export type Manifest = { version: 1; script: string; organizationId: string; organizationName: string; createdAt: string; entries: ManifestEntry[] };

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
export const EVIDENCE_DIR = path.join(REPO_ROOT, 'evidence', 'higiena-danych');

export function parseCli(argv = process.argv.slice(2)): { org: string; mode: Mode } {
  const org = argv.find((x) => x.startsWith('--org='))?.slice(6);
  const rollback = argv.find((x) => x.startsWith('--rollback='))?.slice(11);
  const selected = Number(argv.includes('--dry-run')) + Number(argv.includes('--apply')) + Number(Boolean(rollback));
  if (!org || selected !== 1) throw new Error('Użycie: --org=<nazwa|uuid> oraz dokładnie jedno: --dry-run | --apply | --rollback=<manifest.json>');
  return { org, mode: rollback ? { kind: 'rollback', manifest: rollback } : { kind: argv.includes('--apply') ? 'apply' : 'dry-run' } };
}

export function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('Brak jawnego DATABASE_URL');
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
}

export async function resolveOrg(c: PoolClient, needle: string) {
  const r = await c.query<{ id: string; name: string }>(
    `SELECT id,name FROM organizations WHERE id=$1 OR name ILIKE $2 ORDER BY (id=$1) DESC, length(name) LIMIT 2`,
    [needle, `%${needle}%`]
  );
  if (r.rows.length !== 1) throw new Error(`Organizacja "${needle}": oczekiwano dokładnie 1 wyniku, jest ${r.rows.length}`);
  return r.rows[0]!;
}

export const qi = (v: string) => `"${v.replace(/"/g, '""')}"`;
export const iso = () => new Date().toISOString().replace(/[:.]/g, '-');
export function ensureEvidence() { fs.mkdirSync(EVIDENCE_DIR, { recursive: true }); }
export function writeManifest(name: string, manifest: Manifest): string {
  ensureEvidence(); const p = path.join(EVIDENCE_DIR, `${name}-${iso()}-manifest.json`);
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n'); return p;
}
export function readManifest(p: string, expected: string): Manifest {
  const m = JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')) as Manifest;
  if (m.version !== 1 || m.script !== expected || !Array.isArray(m.entries)) throw new Error('Manifest nie pasuje do skryptu');
  return m;
}
export function csvCell(v: unknown): string { const s = String(v ?? ''); return `"${s.replace(/"/g, '""')}"`; }
export function writeBackupCsv(table: string, rows: Record<string, unknown>[]): string {
  ensureEvidence(); const p = path.join(EVIDENCE_DIR, `${table}-${iso()}.csv`);
  fs.writeFileSync(p, 'snapshot_json\n' + rows.map((r) => csvCell(JSON.stringify(r))).join('\n') + '\n'); return p;
}
export async function columns(c: PoolClient, table: string): Promise<string[]> {
  return (await c.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER' ORDER BY ordinal_position`, [table])).rows.map(x => x.column_name);
}
export async function restore(c: PoolClient, manifest: Manifest): Promise<number> {
  let n = 0;
  for (const e of [...manifest.entries].reverse()) {
    const cols = await columns(c, e.table); const present = cols.filter(k => Object.prototype.hasOwnProperty.call(e.before, k));
    if (e.action === 'delete') {
      const vals = present.map(k => e.before[k]);
      const q = await c.query(`INSERT INTO ${qi(e.table)} (${present.map(qi).join(',')}) VALUES (${present.map((_,i)=>`$${i+1}`).join(',')}) ON CONFLICT (${qi(e.idColumn)}) DO NOTHING`, vals);
      n += q.rowCount ?? 0;
    } else {
      const sets = present.filter(k => k !== e.idColumn).map((k,i)=>`${qi(k)}=$${i+1}`);
      const vals = present.filter(k => k !== e.idColumn).map(k=>e.before[k]); vals.push(e.id);
      const q = await c.query(`UPDATE ${qi(e.table)} SET ${sets.join(',')} WHERE ${qi(e.idColumn)}=$${vals.length}`, vals); n += q.rowCount ?? 0;
    }
  }
  return n;
}
export async function runMain(name: string, fn: (c: PoolClient, org: {id:string;name:string}, mode: Mode)=>Promise<void>) {
  const cli=parseCli(); const p=pool(); const c=await p.connect();
  try { const org=await resolveOrg(c,cli.org); console.log(`PLAN · ${name} · ${org.name} (${org.id}) · ${cli.mode.kind}`); await fn(c,org,cli.mode); }
  finally { c.release(); await p.end(); }
}
