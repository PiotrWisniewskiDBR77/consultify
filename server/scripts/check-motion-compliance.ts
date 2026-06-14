/**
 * Motion compliance — egzekwuje docs/ui-standards/00-foundation/visual-language.md §9.
 *
 * Kanon motion (Apple/Google enterprise, "mniej znaczy więcej"):
 *   - czas trwania ≤ 320ms (snappy; tier "slow" 240-320ms tylko dla drawer/panel/
 *     layout-shift wg §9.1; HARD violation = >320ms, czyli 500/700/1000ms),
 *   - transitions SCOPED (transition-colors/opacity/transform/shadow),
 *     NIE `transition-all` (animuje layout-triggery → jank),
 *   - zero bounce/spring jako default (animate-bounce, animate-ping dekoracyjny).
 *
 * Tryb domyślny = RAPORT długu (exit 0, drukuje skalę + najgorsze pliki).
 * Tryb ratchet  = --budget <plik.json>: FAIL jeśli liczby przekroczą baseline
 *                 (NIE wolno dokładać nowych naruszeń; dług tylko maleje).
 *
 * Run:
 *   npx tsx server/scripts/check-motion-compliance.ts
 *   npx tsx server/scripts/check-motion-compliance.ts --top 15
 *   npx tsx server/scripts/check-motion-compliance.ts --budget docs/ui-standards/.motion-baseline.json
 *
 * Reference: visual-language.md §9, CANON.md §6 (doc↔kod binding).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Category = 'transitionAll' | 'slowDuration' | 'bounce';

interface Hit {
  file: string;
  category: Category;
  count: number;
}

const PATTERNS: Record<Category, { re: RegExp; label: string }> = {
  // transition-all (nie scoped) — łapie className="... transition-all ..."
  transitionAll: { re: /\btransition-all\b/g, label: 'transition-all (nie scoped)' },
  // HARD violation = >320ms (500/700/1000). duration-300 dozwolone dla
  // drawer/panel/layout-shift wg §9.1 "slow" tier — nie liczone.
  slowDuration: { re: /\bduration-(500|700|1000)\b/g, label: 'duration >320ms' },
  // bounce/ping (dekoracyjne, zakazane jako default)
  bounce: { re: /\banimate-(bounce|ping)\b/g, label: 'animate-bounce/ping' },
};

function parseArgs(argv: string[]) {
  let root = 'src';
  let top = 12;
  let budget: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--top') top = Number(argv[++i]) || 12;
    else if (argv[i] === '--budget') budget = argv[++i];
  }
  return { root, top, budget };
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

function main(): number {
  const { root, top, budget } = parseArgs(process.argv.slice(2));
  const rootAbs = resolve(process.cwd(), root);
  if (!existsSync(rootAbs)) {
    console.error(`[motion] root nie istnieje: ${root}`);
    return 2;
  }

  const files = walk(rootAbs);
  const hits: Hit[] = [];
  const totals: Record<Category, number> = { transitionAll: 0, slowDuration: 0, bounce: 0 };

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const cat of Object.keys(PATTERNS) as Category[]) {
      const m = content.match(PATTERNS[cat].re);
      if (m && m.length) {
        hits.push({ file: file.replace(process.cwd() + '/', ''), category: cat, count: m.length });
        totals[cat] += m.length;
      }
    }
  }

  const grand = totals.transitionAll + totals.slowDuration + totals.bounce;

  console.log('\n[motion] Zgodność z visual-language.md §9 (Apple/Google: scoped, ≤320ms, zero bounce)\n');
  for (const cat of Object.keys(PATTERNS) as Category[]) {
    console.log(`  ${PATTERNS[cat].label.padEnd(28)} ${totals[cat]}`);
  }
  console.log(`  ${'RAZEM naruszeń'.padEnd(28)} ${grand}\n`);

  // Najgorsze pliki (suma naruszeń)
  const byFile = new Map<string, number>();
  for (const h of hits) byFile.set(h.file, (byFile.get(h.file) || 0) + h.count);
  const worst = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
  if (worst.length) {
    console.log(`  Top ${worst.length} plików (suma naruszeń):`);
    for (const [f, c] of worst) console.log(`    ${String(c).padStart(4)}  ${f}`);
    console.log('');
  }

  // Tryb ratchet: porównaj z baseline
  if (budget) {
    const budgetAbs = resolve(process.cwd(), budget);
    if (!existsSync(budgetAbs)) {
      console.error(`[motion] --budget plik nie istnieje: ${budget} (utwórz baseline z aktualnych liczb)`);
      return 2;
    }
    const base = JSON.parse(readFileSync(budgetAbs, 'utf8')) as Record<Category, number>;
    let failed = false;
    for (const cat of Object.keys(PATTERNS) as Category[]) {
      if (totals[cat] > (base[cat] ?? Infinity)) {
        console.error(`  ✗ ${PATTERNS[cat].label}: ${totals[cat]} > baseline ${base[cat]} — DODANO nowe naruszenie`);
        failed = true;
      }
    }
    if (failed) {
      console.error('\n[motion] FAIL — dług motion może tylko maleć. Napraw nowe naruszenia.\n');
      return 1;
    }
    console.log('[motion] OK — brak nowych naruszeń względem baseline.\n');
  } else {
    console.log('[motion] Tryb raportu (informacyjny). Ratchet: --budget <baseline.json>.\n');
  }

  return 0;
}

process.exit(main());
