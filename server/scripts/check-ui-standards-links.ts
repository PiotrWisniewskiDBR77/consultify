/**
 * CI gate: UI/UX standards doc-link integrity.
 *
 * Egzekwuje CANON.md §3.2 (integralność referencji): każdy względny link `.md`
 * w `docs/ui-standards/` musi wskazywać istniejący plik. Łapie klasę błędu
 * "usunięto/przeniesiono dokument, zostawiono martwy link" — dokładnie ten,
 * który zepsuł graf referencji 2026-06-14.
 *
 * Run:
 *   npx tsx server/scripts/check-ui-standards-links.ts
 *   npx tsx server/scripts/check-ui-standards-links.ts --root docs/ui-standards --quiet
 *
 * Args:
 *   --root    Katalog do skanowania (domyślnie docs/ui-standards).
 *   --quiet   Tylko linia podsumowania.
 *
 * Exit codes:
 *   0 — wszystkie linki resolwują.
 *   1 — wykryto co najmniej jeden martwy link.
 *   2 — błąd argumentów / runtime.
 *
 * Reference: docs/ui-standards/CANON.md §3 Governance
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

interface BrokenLink {
  source: string;
  link: string;
  resolved: string;
}

function parseArgs(argv: string[]): { root: string; quiet: boolean } {
  let root = 'docs/ui-standards';
  let quiet = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--quiet') quiet = true;
  }
  return { root, quiet };
}

function walkMarkdown(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkMarkdown(full, acc);
    else if (entry.toLowerCase().endsWith('.md')) acc.push(full);
  }
  return acc;
}

// Matches markdown inline links: [text](target)
const LINK_RE = /\]\(([^)]+)\)/g;

function extractMdLinks(content: string): string[] {
  const links: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(content)) !== null) {
    links.push(m[1].trim());
  }
  return links;
}

function isCheckableRelativeMdLink(link: string): boolean {
  if (!link) return false;
  if (link.startsWith('#')) return false; // pure anchor
  if (/^[a-z]+:\/\//i.test(link)) return false; // http(s):, etc.
  if (link.startsWith('mailto:')) return false;
  const path = link.split('#')[0]; // strip anchor
  if (!path) return false;
  return path.toLowerCase().endsWith('.md');
}

function main(): number {
  const { root, quiet } = parseArgs(process.argv.slice(2));
  const rootAbs = resolve(process.cwd(), root);
  if (!existsSync(rootAbs)) {
    console.error(`[check-ui-standards-links] root nie istnieje: ${root}`);
    return 2;
  }

  const files = walkMarkdown(rootAbs);
  const broken: BrokenLink[] = [];
  let checked = 0;

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const link of extractMdLinks(content)) {
      if (!isCheckableRelativeMdLink(link)) continue;
      checked++;
      const targetPath = link.split('#')[0];
      const resolved = resolve(dirname(file), targetPath);
      if (!existsSync(resolved)) {
        broken.push({
          source: file.replace(process.cwd() + '/', ''),
          link,
          resolved: resolved.replace(process.cwd() + '/', ''),
        });
      }
    }
  }

  if (broken.length > 0 && !quiet) {
    console.error('\n[check-ui-standards-links] MARTWE LINKI:\n');
    for (const b of broken) {
      console.error(`  ✗ ${b.source}`);
      console.error(`      → "${b.link}"  (brak: ${b.resolved})`);
    }
    console.error('');
  }

  const summary = `[check-ui-standards-links] ${files.length} plików · ${checked} linków .md sprawdzonych · ${broken.length} martwych`;
  if (broken.length > 0) {
    console.error(summary + ' — FAIL');
    return 1;
  }
  console.log(summary + ' — OK');
  return 0;
}

process.exit(main());
