/**
 * Ratchet for the materials editor visual standard.
 *
 * This is intentionally a small static guard: user-authored material content
 * may contain images and emoji, but product chrome in these editor/template
 * surfaces must not reintroduce emoji-as-icons or literal legacy raster assets.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const MATERIAL_DIRECTORIES = [
  'src/components/DocumentStudio',
  'src/components/Presentations',
  'src/components/TemplateBuilder',
  'src/components/AIChat/KimiWorkspace',
];
const SOURCE_FILE = /\.(?:tsx?|jsx?)$/;
// Pictographs are never valid operational controls. Miscellaneous Symbols are
// intentionally excluded here because code comments and translated status text
// contain legitimate mathematical/check symbols; the icon registry covers the
// actionable controls themselves.
const EMOJI = /[\u{1F000}-\u{1FAFF}]/u;
// A translation key such as `export.png` is not an asset. Only a path/URL is.
const LEGACY_RASTER_LITERAL =
  /["'`](?:\/|@\/|https?:\/\/)[^"'`\n]+\.(?:png|jpe?g|gif|webp)(?:[?#][^"'`\n]*)?["'`]/i;

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    return SOURCE_FILE.test(entry) ? [path] : [];
  });
}

const violations: string[] = [];
for (const directory of MATERIAL_DIRECTORIES) {
  for (const file of walk(join(ROOT, directory))) {
    const source = readFileSync(file, 'utf8');
    const relativePath = relative(ROOT, file);
    source.split(/\r?\n/).forEach((line, index) => {
      if (EMOJI.test(line)) {
        violations.push(`${relativePath}:${index + 1} emoji is not an operational UI icon`);
      }
      if (LEGACY_RASTER_LITERAL.test(line)) {
        violations.push(
          `${relativePath}:${index + 1} literal raster asset is not allowed in materials chrome`
        );
      }
    });
  }
}

if (violations.length > 0) {
  console.error('Materials visual compliance failed:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log('Materials visual compliance: PASS');
