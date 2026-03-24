import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const messagesDir = path.join(root, "messages");

const defaultLocale = "en";
const locales = ["en", "pl", "de", "ja", "ar", "es"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectKeys(obj, prefix = "") {
  const keys = [];
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const next = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        keys.push(...collectKeys(v, next));
      } else {
        keys.push(next);
      }
    }
  }
  return keys;
}

function diffKeys(sourceKeys, targetKeys) {
  const sourceSet = new Set(sourceKeys);
  const targetSet = new Set(targetKeys);
  const missing = sourceKeys.filter((k) => !targetSet.has(k));
  const extra = targetKeys.filter((k) => !sourceSet.has(k));
  return { missing, extra };
}

function main() {
  const sourcePath = path.join(messagesDir, `${defaultLocale}.json`);
  if (!fs.existsSync(sourcePath)) {
    console.error(`Missing source locale file: ${sourcePath}`);
    process.exit(1);
  }

  const source = readJson(sourcePath);
  const sourceKeys = collectKeys(source).sort();

  let hasErrors = false;

  for (const locale of locales) {
    const filePath = path.join(messagesDir, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`Missing locale file: ${filePath}`);
      hasErrors = true;
      continue;
    }

    const target = readJson(filePath);
    const targetKeys = collectKeys(target).sort();
    const { missing, extra } = diffKeys(sourceKeys, targetKeys);

    if (missing.length || extra.length) {
      hasErrors = true;
      console.error(`\n[i18n] Key drift for locale '${locale}':`);
      if (missing.length) {
        console.error(`- Missing (${missing.length})`);
        for (const k of missing.slice(0, 50)) console.error(`  - ${k}`);
        if (missing.length > 50) console.error(`  ... and ${missing.length - 50} more`);
      }
      if (extra.length) {
        console.error(`- Extra (${extra.length})`);
        for (const k of extra.slice(0, 50)) console.error(`  - ${k}`);
        if (extra.length > 50) console.error(`  ... and ${extra.length - 50} more`);
      }
    }
  }

  if (hasErrors) {
    console.error("\n[i18n] Failed. English (en) must remain the source-of-truth, and all locales must match its keys.");
    process.exit(1);
  }

  console.log(`[i18n] OK. All ${locales.length} locales match '${defaultLocale}' keys (${sourceKeys.length} keys).`);
}

main();

