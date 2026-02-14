# Agent 2: Infrastruktura weryfikacji (Anti-ściema)

**Rola:** Skrypty wykrywające placeholdery, blokada duplikatów, naprawa audit, integracja CI.

**Priorytet:** DRUGI — startuje po zakończeniu Agent 1.

---

## Zadania (w kolejności)

### Zadanie 2.1: Skrypt quality-check.ts

**Utwórz plik:** `scripts/testing/quality-check.ts`

**Cel:** Skanuje pliki testowe, wykrywa placeholdery (brak importu z src/server), raportuje % autentyczności.

**Zawartość (szkielet):**

```typescript
#!/usr/bin/env npx tsx
/**
 * Test Quality Check - wykrywa placeholdery
 * Użycie: npx tsx scripts/testing/quality-check.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();
const testDirs = ['tests/', 'server/tests/'];

function isRealTest(content: string): boolean {
  // Import z src/ lub server/
  const hasSrcImport =
    /from\s+['"]@\//.test(content) ||
    /from\s+['"]\.\.\/.*server\//.test(content) ||
    /from\s+['"].*server\/src\//.test(content) ||
    /import\s+.*from\s+['"]@\//.test(content);
  return hasSrcImport;
}

function isPlaceholder(content: string): boolean {
  // Wzorzec: const obj = {...}; expect(obj.prop)
  const placeholderPattern = /const\s+\w+\s*=\s*\{[^}]*\}[\s\S]{0,200}expect\s*\(\s*\w+\.\w+/;
  return placeholderPattern.test(content) && !isRealTest(content);
}

function scan(): void {
  let real = 0,
    placeholder = 0,
    other = 0;

  for (const dir of testDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (!fs.existsSync(fullPath)) continue;

    const files = findTestFiles(fullPath);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (isRealTest(content)) real++;
      else if (isPlaceholder(content)) placeholder++;
      else other++;
    }
  }

  const total = real + placeholder + other;
  const authenticity = total > 0 ? ((real / total) * 100).toFixed(1) : '0';

  console.log('\n📊 Test Quality Report');
  console.log('====================');
  console.log(`REAL: ${real}`);
  console.log(`PLACEHOLDER: ${placeholder}`);
  console.log(`OTHER: ${other}`);
  console.log(`AUTHENTICITY: ${authenticity}%`);
  console.log('');

  const threshold = 25;
  if (parseFloat(authenticity) < threshold) {
    console.log(`⚠️  Autentyczność < ${threshold}% (cel: ${threshold}%+)`);
    process.exit(1);
  }
  process.exit(0);
}

function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  const walk = (d: string) => {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        walk(full);
      } else if (e.isFile() && /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(e.name)) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results;
}

scan();
```

**Dodaj do `package.json` w scripts:**

```json
"test:quality-check": "npx tsx scripts/testing/quality-check.ts"
```

**Weryfikacja:** `npm run test:quality-check` — zwraca exit 0 lub 1.

---

### Zadanie 2.2: Skrypt block-duplicates.sh

**Utwórz plik:** `scripts/testing/block-duplicates.sh`

**Zawartość:**

```bash
#!/bin/bash
# Blokuje commit z plikami zawierającymi " 2", " 3" w nazwie (duplikaty)
dupes=$(git diff --cached --name-only 2>/dev/null | grep -E '\s[2-9]\.[a-zA-Z]+$' || true)
if [ -n "$dupes" ]; then
  echo "❌ BLOCKED: Duplikaty w nazwach plików:"
  echo "$dupes"
  echo "Usuń te pliki lub odblokuj z staging."
  exit 1
fi
exit 0
```

**Weryfikacja:** `chmod +x scripts/testing/block-duplicates.sh`

---

### Zadanie 2.3: Integracja block-duplicates w pre-commit

**Plik:** `.husky/pre-commit`

**Dodać na początku (przed lint-staged):**

```bash
# Blokada duplikatów
./scripts/testing/block-duplicates.sh || exit 1
```

**Weryfikacja:** `git add "tests/unit/foo test 2.ts"` (jeśli taki plik istnieje) → `git commit` powinien zablokować. Jeśli nie ma takiego pliku — sprawdź że skrypt się wykonuje: `./scripts/testing/block-duplicates.sh` → exit 0.

---

### Zadanie 2.4: Naprawa run-audit.ts (usunięcie hardcoded)

**Plik:** `scripts/testing/run-audit.ts`

**Obecna linia 380:**

```typescript
${summary.levels.map((l) => `| ${l.name.padEnd(13)} | ${String(l.files).padEnd(5)} | ~96%     | ${l.passRate.padEnd(9)} | Automated audit |`).join('\n')}
```

**Zmiana:** Zastąp `~96%` wartością z parsowania coverage. Opcje:

**Opcja A (prosta):** Użyj `N/A` jeśli nie ma pliku coverage:

```typescript
const coveragePath = path.join(projectRoot, 'coverage', 'coverage-summary.json');
let coveragePercent = 'N/A';
if (fs.existsSync(coveragePath)) {
  try {
    const cov = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
    coveragePercent = cov.total?.statements?.pct != null ? `${cov.total.statements.pct}%` : 'N/A';
  } catch {
    /* keep N/A */
  }
}
// W mapie:
`| ${l.name.padEnd(13)} | ${String(l.files).padEnd(5)} | ${coveragePercent.padEnd(7)} | ${l.passRate.padEnd(9)} | Automated audit |`;
```

**Uwaga:** Vitest z v8 może generować `coverage/coverage-final.json` (Istanbul) — wtedy trzeba użyć `nyc` lub innego narzędzia do summary. Dla prostoty: jeśli plik nie istnieje, używaj `N/A`. Nie używaj hardcoded `~96%`.

**Opcja B (minimalna):** Zamień `~96%` na `N/A` — przynajmniej nie kłamie.

**Weryfikacja:** `grep -n "96" scripts/testing/run-audit.ts` — nie powinno zwracać linii z hardcoded coverage.

---

### Zadanie 2.5: Job test-quality-check w CI

**Plik:** `.github/workflows/test-suite.yml`

**Dodać nowy job** (po `lint-typecheck`, przed lub równolegle z `unit-tests`):

```yaml
test-quality-check:
  name: 🛡️ Test Quality (Anti-Placeholder)
  runs-on: ubuntu-latest
  needs: lint-typecheck
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    - run: npm ci
    - run: npm run test:quality-check
```

**Uwaga:** Na początku `test:quality-check` może failować (autentyczność < 25%). W takim przypadku możesz:

- Tymczasowo obniżyć próg w quality-check.ts do 15%
- Lub dodać `continue-on-error: true` do joba do czasu aż Agent 3 podniesie autentyczność

---

### Zadanie 2.6: Skrypt verify-integrity.js

**Utwórz plik:** `scripts/testing/verify-integrity.js`

**Cel:** Szybka weryfikacja że nie ma "ściemy" — sprawdza hardcoded, duplikaty.

**Zawartość:**

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

let errors = [];

// 1. run-audit nie ma hardcoded 96
const runAudit = fs.readFileSync('scripts/testing/run-audit.ts', 'utf-8');
if (runAudit.includes('~96%') || runAudit.includes('| ~96%')) {
  errors.push('run-audit.ts: hardcoded ~96% coverage found');
}

// 2. Brak duplikatów
const { execSync } = require('child_process');
const dupes = execSync(
  'find tests/ server/tests/ -type f \\( -name "* 2.*" -o -name "* 3.*" \\) 2>/dev/null || true',
  { encoding: 'utf-8' }
).trim();
if (dupes) {
  errors.push('Duplicate files found: ' + dupes.split('\n').length);
}

if (errors.length > 0) {
  console.error('❌ Integrity check failed:', errors);
  process.exit(1);
}
console.log('✅ Integrity check passed');
process.exit(0);
```

**Dodaj do package.json:**

```json
"test:integrity": "node scripts/testing/verify-integrity.js"
```

---

## Kryteria ukończenia (Agent 2)

- [ ] `scripts/testing/quality-check.ts` istnieje
- [ ] `npm run test:quality-check` działa (exit 0 lub 1)
- [ ] `scripts/testing/block-duplicates.sh` istnieje
- [ ] `.husky/pre-commit` wywołuje block-duplicates
- [ ] `run-audit.ts` nie zawiera hardcoded `~96%`
- [ ] `.github/workflows/test-suite.yml` ma job `test-quality-check`
- [ ] `scripts/testing/verify-integrity.js` istnieje
- [ ] `npm run test:integrity` działa
- [ ] `package.json` ma `test:quality-check` i `test:integrity`

---

## Raportowanie

```
AGENT 2 - RAPORT UKOŃCZENIA
Data: [DATA]
- quality-check: [DZIAŁA/FAIL]
- block-duplicates w pre-commit: [TAK/NIE]
- run-audit hardcoded usunięty: [TAK/NIE]
- CI job dodany: [TAK/NIE]
- Problemy: [OPIS LUB BRAK]
```
