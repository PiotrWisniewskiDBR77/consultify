import fs from 'node:fs';
import path from 'node:path';

function repoRoot() {
  return process.cwd();
}

function isProbablyDuplicateFilename(filePath: string) {
  const base = path.basename(filePath);
  return /\s\d+\.[a-z0-9]+$/i.test(base) || /\sCopy\./i.test(base) || base.endsWith('.icloud');
}

function safeMkdirp(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function walk(dir: string, onFile: (filePath: string) => void) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.git') continue;
      if (ent.name === '_quarantine') continue;
      walk(p, onFile);
    } else if (ent.isFile()) {
      onFile(p);
    }
  }
}

function moveFilePreservingStructure(fromAbs: string, toBaseAbs: string) {
  const rel = path.relative(repoRoot(), fromAbs);
  const toAbs = path.join(toBaseAbs, rel);
  safeMkdirp(path.dirname(toAbs));
  fs.renameSync(fromAbs, toAbs);
}

function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const quarantineBase = path.join(repoRoot(), '_quarantine', `icloud-duplicates-${timestamp}`);
  safeMkdirp(quarantineBase);

  const roots = ['src', 'server/src', 'views', 'packages', 'apps'];
  const moved: string[] = [];

  for (const r of roots) {
    const abs = path.join(repoRoot(), r);
    if (!fs.existsSync(abs)) continue;
    walk(abs, (p) => {
      if (!isProbablyDuplicateFilename(p)) return;
      // Extra safety: never touch package-lock or env files
      const base = path.basename(p);
      if (base.startsWith('.env')) return;
      if (base === 'package-lock.json') return;
      moveFilePreservingStructure(p, quarantineBase);
      moved.push(path.relative(repoRoot(), p));
    });
  }

  console.log(`Moved ${moved.length} file(s) to: ${path.relative(repoRoot(), quarantineBase)}`);
  if (moved.length) {
    console.log('First 20:');
    moved.slice(0, 20).forEach((p) => console.log(`- ${p}`));
    console.log('\nUndo: move them back from the quarantine folder.');
  }
}

main();
