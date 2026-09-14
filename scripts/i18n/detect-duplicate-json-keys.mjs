#!/usr/bin/env node
/**
 * Wykrywacz duplikatów kluczy JSON na DOWOLNYM poziomie zagnieżdżenia.
 *
 * Powód istnienia (H1e task 3, 14.09.2026): `public/locales/{en,pl}/translation.json`
 * miały ZASTANY duplikat `initiatives.analysis` — dwa osobne bloki `"analysis": {...}`
 * wewnątrz `"initiatives": {...}`. `JSON.parse` (standardowe zachowanie V8, tak samo
 * `python3 -m json.tool`) po cichu ZJADA pierwszy blok i zostawia drugi — żaden
 * dotychczasowy test i18n tego nie łapie, bo wszystkie operują na WYNIKU
 * `JSON.parse` (na obiekcie, w którym duplikat już nie istnieje).
 *
 * Ten moduł parsuje SUROWY tekst JSON własnym parserem rekursywnym (nie
 * `JSON.parse`) i zgłasza KAŻDĄ parę kluczy powtórzoną w tym samym obiekcie,
 * z numerami linii obu wystąpień — na dowolnym poziomie zagnieżdżenia, nie
 * tylko na najwyższym.
 *
 * Użycie CLI: `node scripts/i18n/detect-duplicate-json-keys.mjs <plik.json...>`
 * (kod wyjścia 1, jeśli znaleziono duplikat — do ręcznego audytu).
 * Użycie z testu: `import { findDuplicateKeys } from './detect-duplicate-json-keys.mjs'`.
 */

/**
 * @typedef {{ path: string; key: string; firstLine: number; secondLine: number }} DuplicateKey
 */

/**
 * @param {string} text Surowy tekst pliku JSON.
 * @returns {DuplicateKey[]}
 */
export function findDuplicateKeys(text) {
  let i = 0;
  let line = 1;
  /** @type {DuplicateKey[]} */
  const duplicates = [];

  const len = text.length;

  function advance() {
    const c = text[i];
    i += 1;
    if (c === '\n') line += 1;
    return c;
  }

  function skipWs() {
    while (i < len) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        advance();
      } else {
        break;
      }
    }
  }

  function parseString() {
    if (text[i] !== '"') {
      throw new Error(`Oczekiwano '"' w linii ${line}, pozycja ${i}`);
    }
    advance(); // otwierający cudzysłów
    let out = '';
    while (true) {
      if (i >= len) throw new Error(`Nieoczekiwany koniec pliku wewnątrz stringa (linia ${line})`);
      const c = advance();
      if (c === '\\') {
        const esc = advance();
        // Wystarczy zachować dosłownie do porównania kluczy — nie musimy
        // dekodować \uXXXX, klucze i18n nie używają escape'ów unicode.
        out += `\\${esc}`;
        continue;
      }
      if (c === '"') break;
      out += c;
    }
    return out;
  }

  function parseLiteral() {
    const start = i;
    while (i < len && !/[,\]}\s]/.test(text[i])) advance();
    return text.slice(start, i);
  }

  function parseArray(pathPrefix) {
    advance(); // '['
    skipWs();
    if (text[i] === ']') {
      advance();
      return;
    }
    while (true) {
      parseValue(pathPrefix);
      skipWs();
      const c = advance();
      if (c === ']') break;
      if (c !== ',') throw new Error(`Oczekiwano ',' lub ']' w linii ${line}`);
      skipWs();
    }
  }

  function parseObject(pathPrefix) {
    advance(); // '{'
    skipWs();
    /** @type {Map<string, number>} */
    const seenAt = new Map();
    if (text[i] === '}') {
      advance();
      return;
    }
    while (true) {
      skipWs();
      const keyLine = line;
      const key = parseString();
      skipWs();
      if (text[i] !== ':') throw new Error(`Oczekiwano ':' w linii ${line}`);
      advance();
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      if (seenAt.has(key)) {
        duplicates.push({
          path,
          key,
          firstLine: /** @type {number} */ (seenAt.get(key)),
          secondLine: keyLine,
        });
      } else {
        seenAt.set(key, keyLine);
      }
      parseValue(path);
      skipWs();
      const c = advance();
      if (c === '}') break;
      if (c !== ',') throw new Error(`Oczekiwano ',' lub '}' w linii ${line}`);
      skipWs();
    }
  }

  function parseValue(pathPrefix) {
    skipWs();
    const c = text[i];
    if (c === '{') return parseObject(pathPrefix);
    if (c === '[') return parseArray(pathPrefix);
    if (c === '"') return parseString();
    return parseLiteral();
  }

  skipWs();
  parseValue('');
  return duplicates;
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Użycie: node scripts/i18n/detect-duplicate-json-keys.mjs <plik.json...>');
    process.exit(2);
  }
  const { readFileSync } = await import('node:fs');
  let anyDuplicate = false;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const duplicates = findDuplicateKeys(text);
    if (duplicates.length === 0) {
      console.log(`OK  ${file} — 0 duplikatów`);
      continue;
    }
    anyDuplicate = true;
    console.log(`DUPLIKATY w ${file}:`);
    for (const d of duplicates) {
      console.log(`  ${d.path} — linia ${d.firstLine} i linia ${d.secondLine}`);
    }
  }
  process.exit(anyDuplicate ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
