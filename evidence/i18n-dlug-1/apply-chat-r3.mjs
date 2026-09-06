import fs from 'node:fs';

const ROOT = process.cwd();
const plPath = `${ROOT}/public/locales/pl/translation.json`;
const enPath = `${ROOT}/public/locales/en/translation.json`;
const translations = JSON.parse(
  fs.readFileSync(`${ROOT}/evidence/i18n-dlug-1/chat-r3-translations.json`, 'utf8')
);

const pl = JSON.parse(fs.readFileSync(plPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === undefined) cur[p] = {};
    if (typeof cur[p] !== 'object' || cur[p] === null) {
      throw new Error(`Path segment collides with a leaf: ${path} at ${p}`);
    }
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (last in cur) {
    throw new Error(`Leaf key ALREADY EXISTS (would overwrite): ${path}`);
  }
  cur[last] = value;
}

let applied = 0;
const errors = [];
for (const [key, { en: enValue, pl: plValue }] of Object.entries(translations)) {
  try {
    setPath(pl, key, plValue);
    setPath(en, key, enValue);
    applied++;
  } catch (e) {
    errors.push(`${key}: ${e.message}`);
  }
}

if (errors.length) {
  console.log(errors.join('\n'));
  process.exit(1);
}

fs.writeFileSync(plPath, JSON.stringify(pl, null, 2) + '\n', 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
console.log(`applied=${applied} errors=0`);
