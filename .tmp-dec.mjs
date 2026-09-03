import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('docs/program/grafika/odbior.sqlite');
const cols = db.prepare("PRAGMA table_info(decyzje)").all();
console.log(cols.map(c=>c.name).join(' | '));
const ids = ['plan-scenario-d1','results-vnext-teresa-kpi-deviation','admin-command-attention-queue','execution-tab-resources','prezentacje-template-states'];
for (const id of ids) {
  const rows = db.prepare("SELECT * FROM decyzje WHERE ekran = ?").all(id);
  console.log('\n===== ' + id + ' ===== (' + rows.length + ')');
  for (const r of rows) console.log(JSON.stringify(r, null, 1));
}
