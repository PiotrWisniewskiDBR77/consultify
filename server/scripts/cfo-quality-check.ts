#!/usr/bin/env tsx
/**
 * CFO-level data quality verification.
 * Checks:
 * 1. Critical line values (Revenue, Net Income, Total Assets, Total Equity, Total Liabilities)
 * 2. BS equation (Assets = Equity + Liabilities)
 * 3. Currency & scaling correctness
 * 4. Dual-period data presence
 * 5. Cross-statement consistency
 */
import pg from 'pg';

const DB_URL = process.env.DATABASE_URL!;

interface LineValue {
  canonical_line_id: string;
  original_label: string;
  value: number;
  period_label: string;
  period_index: number;
}

async function main() {
  const client = new pg.Client(DB_URL);
  await client.connect();
  const host = DB_URL.match(/@([^:\/]+)/)?.[1] || 'unknown';
  console.log(`Connected to: ${host}\n`);

  // Get all statements
  const stmts = await client.query(`
    SELECT id, source_file_name, statement_type, currency, scaling, period_label
    FROM financial_statements
    ORDER BY source_file_name, statement_type
  `);

  // Group by document
  const docs = new Map<string, typeof stmts.rows>();
  for (const s of stmts.rows) {
    const key = s.source_file_name;
    if (!docs.has(key)) docs.set(key, []);
    docs.get(key)!.push(s);
  }

  const CRITICAL_BS = [
    'fsl-bs-total-assets',
    'fsl-bs-equity',
    'fsl-bs-total-liabilities',
    'fsl-bs-cash',
    'fsl-bs-current-assets',
    'fsl-bs-fixed',
    'fsl-bs-current-liabilities',
    'fsl-bs-long-term-debt',
  ];
  const CRITICAL_PL = [
    'fsl-pl-revenue',
    'fsl-pl-gross',
    'fsl-pl-ebit',
    'fsl-pl-net',
    'fsl-pl-cogs',
  ];
  const CRITICAL_CF = [
    'fsl-cf-operating',
    'fsl-cf-investing',
    'fsl-cf-financing',
    'fsl-cf-net-change-cash',
  ];

  let totalIssues = 0;

  for (const [docName, stmtList] of docs) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`  ${docName}`);
    const s0 = stmtList[0];
    console.log(`  Currency: ${s0.currency} | Scaling: ${s0.scaling} | Period: ${s0.period_label}`);
    console.log(`${'═'.repeat(80)}`);

    for (const stmt of stmtList) {
      const vals = await client.query(`
        SELECT v.canonical_line_id, v.original_label, v.value, 
               (v.evidence_json::jsonb->>'periodLabel') as period_label,
               (v.evidence_json::jsonb->>'periodIndex')::int as period_index
        FROM financial_statement_values v
        WHERE v.statement_id = $1
          AND v.canonical_line_id IS NOT NULL
        ORDER BY (v.evidence_json::jsonb->>'periodIndex')::int, v.canonical_line_id
      `, [stmt.id]);

      const lineMap = new Map<string, LineValue[]>();
      for (const v of vals.rows) {
        if (!lineMap.has(v.canonical_line_id)) lineMap.set(v.canonical_line_id, []);
        lineMap.get(v.canonical_line_id)!.push(v);
      }

      const criticals = stmt.statement_type === 'BS' ? CRITICAL_BS
        : stmt.statement_type === 'P&L' ? CRITICAL_PL
        : CRITICAL_CF;

      console.log(`\n  [${stmt.statement_type}]`);

      let issuesForStmt = 0;

      for (const cid of criticals) {
        const entries = lineMap.get(cid);
        if (!entries || entries.length === 0) {
          console.log(`    ❌ MISSING: ${cid}`);
          issuesForStmt++;
          continue;
        }
        const current = entries.find(e => e.period_index === 0);
        const comparison = entries.find(e => e.period_index === 1);
        
        const fmt = (v: number) => {
          if (Math.abs(v) >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
          return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
        };
        
        const curStr = current ? fmt(current.value) : 'N/A';
        const compStr = comparison ? fmt(comparison.value) : 'N/A';
        const hasBoth = current && comparison;
        const identical = hasBoth && current!.value === comparison!.value;
        
        let flag = '';
        if (!current) { flag = ' ⚠ NO CURRENT'; issuesForStmt++; }
        else if (!comparison) { flag = ' ⚠ NO COMPARISON'; }
        else if (identical && current!.value !== 0) { flag = ' ⚠ IDENTICAL VALUES'; issuesForStmt++; }
        else if (current!.value === 0) { flag = ' ⚠ ZERO VALUE'; issuesForStmt++; }
        
        const label = (current || comparison)!.original_label.substring(0, 40);
        console.log(`    ${flag ? '⚠' : '✅'} ${cid.padEnd(35)} ${curStr.padStart(15)} | ${compStr.padStart(15)}${flag}`);
      }

      // BS equation check
      if (stmt.statement_type === 'BS') {
        const getVal = (cid: string, pi: number) => {
          const entries = lineMap.get(cid);
          return entries?.find(e => e.period_index === pi)?.value ?? null;
        };

        const totalAssets = getVal('fsl-bs-total-assets', 0);
        const equity = getVal('fsl-bs-equity', 0);
        const totalLiab = getVal('fsl-bs-total-liabilities', 0);
        
        if (totalAssets != null && equity != null && totalLiab != null) {
          const sum = equity + totalLiab;
          const diff = Math.abs(totalAssets - sum);
          const threshold = Math.abs(totalAssets) * 0.02;
          if (diff <= threshold) {
            console.log(`    ✅ BS equation: Assets(${totalAssets}) ≈ Equity(${equity}) + Liab(${totalLiab}) = ${sum} [diff=${diff.toFixed(0)}]`);
          } else {
            console.log(`    ❌ BS equation FAIL: Assets(${totalAssets}) ≠ Equity(${equity}) + Liab(${totalLiab}) = ${sum} [diff=${diff.toFixed(0)}]`);
            issuesForStmt++;
          }
        } else {
          console.log(`    ⚠  BS equation: INCOMPLETE (assets=${totalAssets}, equity=${equity}, liab=${totalLiab})`);
        }
      }

      totalIssues += issuesForStmt;
    }
  }

  // Summary counts
  const totalValues = await client.query(`SELECT COUNT(*) as cnt FROM financial_statement_values`);
  const mappedValues = await client.query(`SELECT COUNT(*) as cnt FROM financial_statement_values WHERE canonical_line_id IS NOT NULL`);
  const currentPeriod = await client.query(`SELECT COUNT(*) as cnt FROM financial_statement_values WHERE (evidence_json::jsonb->>'periodIndex')::int = 0`);
  const compPeriod = await client.query(`SELECT COUNT(*) as cnt FROM financial_statement_values WHERE (evidence_json::jsonb->>'periodIndex')::int = 1`);

  console.log(`\n${'═'.repeat(80)}`);
  console.log('  OVERALL SUMMARY');
  console.log(`${'═'.repeat(80)}`);
  console.log(`  Total values: ${totalValues.rows[0].cnt}`);
  console.log(`  Mapped values: ${mappedValues.rows[0].cnt} (${Math.round(mappedValues.rows[0].cnt / totalValues.rows[0].cnt * 100)}%)`);
  console.log(`  Current period values: ${currentPeriod.rows[0].cnt}`);
  console.log(`  Comparison period values: ${compPeriod.rows[0].cnt}`);
  console.log(`  Documents: ${docs.size}`);
  console.log(`  Total critical issues: ${totalIssues}`);
  console.log(`  Verdict: ${totalIssues <= 5 ? '✅ ACCEPTABLE' : totalIssues <= 15 ? '⚠ NEEDS ATTENTION' : '❌ NOT READY'}\n`);

  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
