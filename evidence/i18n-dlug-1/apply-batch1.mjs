import fs from 'node:fs';

const ROOT = process.cwd();
const plPath = `${ROOT}/public/locales/pl/translation.json`;
const translations = JSON.parse(fs.readFileSync(`${ROOT}/evidence/i18n-dlug-1/translations-batch1.json`, 'utf8'));

const pl = JSON.parse(fs.readFileSync(plPath, 'utf8'));

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === undefined || typeof cur[p] !== 'object') {
      throw new Error(`Path segment missing/not-object: ${path} at ${p}`);
    }
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (!(last in cur)) {
    throw new Error(`Leaf key missing: ${path}`);
  }
  cur[last] = value;
}

let applied = 0;
const errors = [];
for (const [key, value] of Object.entries(translations)) {
  try {
    setPath(pl, key, value);
    applied++;
  } catch (e) {
    errors.push(`${key}: ${e.message}`);
  }
}

fs.writeFileSync(plPath, JSON.stringify(pl, null, 2) + '\n', 'utf8');
console.log(`applied=${applied} errors=${errors.length}`);
if (errors.length) {
  console.log(errors.join('\n'));
  process.exit(1);
}
