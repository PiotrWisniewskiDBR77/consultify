#!/usr/bin/env tsx
import pg from 'pg';

async function main() {
  const client = new pg.Client(process.env.DATABASE_URL);
  await client.connect();

  const res = await client.query(`
    SELECT fs.source_file_name, fs.statement_type, fsv.original_label, fsv.value
    FROM financial_statement_values fsv
    JOIN financial_statements fs ON fsv.statement_id = fs.id
    WHERE fsv.mapping_status = 'unmapped'
      AND fsv.is_non_financial = false
      AND (fsv.evidence_json::jsonb->>'periodIndex')::int = 0
    ORDER BY fs.source_file_name, fs.statement_type, fsv.original_label
  `);

  const byDoc = new Map<string, string[]>();
  for (const r of res.rows) {
    const key = `${r.source_file_name} | ${r.statement_type}`;
    if (!byDoc.has(key)) byDoc.set(key, []);
    byDoc.get(key)!.push(`  ${r.original_label} = ${r.value}`);
  }

  for (const [key, lines] of byDoc) {
    console.log(`\n${key} (${lines.length} unmapped):`);
    for (const l of lines) console.log(l);
  }

  console.log(`\nTotal unmapped: ${res.rows.length}`);
  await client.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
