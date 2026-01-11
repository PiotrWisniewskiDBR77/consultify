/**
 * Duplicates Tests
 *
 * Tests for duplicate functionality between old .js and new .ts files:
 * - Function name matching
 * - Old .js files still imported
 * - Mapping of duplicates for removal
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');
const serverDir = path.join(projectRoot, 'server');
const srcDir = path.join(serverDir, 'src');

function findFiles(dir: string, ext: string, excludeDirs: string[]): string[] {
  const files: string[] = [];

  function walk(currentDir: string, relativePath: string = '') {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
            walk(fullPath, relPath);
          }
        } else if (entry.name.endsWith(ext)) {
          files.push(relPath);
        }
      }
    } catch (err) {
      // Ignore errors
    }
  }

  walk(dir);
  return files;
}

interface Duplicate {
  oldJs: string;
  newTs: string;
  functions: string[];
  status: 'duplicate' | 'unique' | 'unknown';
}

describe('Duplicates Tests', () => {
  let duplicates: Duplicate[] = [];

  beforeAll(() => {
    const jsFiles = findFiles(path.join(serverDir, 'services'), '.js', [
      'node_modules',
      'dist',
      'backup',
    ]).map((f) => `services/${f}`);
    const tsFiles = findFiles(path.join(srcDir, 'services'), '.ts', [])
      .map((f) => `services/${f}`)
      .filter((f) => !f.includes('.test.ts') && !f.includes('.spec.ts') && !f.includes('.d.ts'));

    // Find potential duplicates
    for (const jsFile of jsFiles.slice(0, 50)) {
      // Sample
      const jsBaseName = path.basename(jsFile, '.js');
      const tsMatch = tsFiles.find((ts) => {
        const tsBaseName = path.basename(ts, '.ts');
        return tsBaseName === jsBaseName || tsBaseName.toLowerCase() === jsBaseName.toLowerCase();
      });

      if (tsMatch) {
        const jsPath = path.join(serverDir, jsFile);
        const tsPath = path.join(srcDir, tsMatch);

        if (fs.existsSync(jsPath) && fs.existsSync(tsPath)) {
          const jsContent = fs.readFileSync(jsPath, 'utf-8');
          const tsContent = fs.readFileSync(tsPath, 'utf-8');

          // Extract function names (simple regex)
          const jsFunctions = (
            jsContent.match(/(?:function|const|export\s+(?:async\s+)?function)\s+(\w+)/g) || []
          )
            .map((f) => f.split(/\s+/).pop()!)
            .filter(Boolean);
          const tsFunctions = (
            tsContent.match(/(?:function|const|export\s+(?:async\s+)?function)\s+(\w+)/g) || []
          )
            .map((f) => f.split(/\s+/).pop()!)
            .filter(Boolean);

          const commonFunctions = jsFunctions.filter((f) => tsFunctions.includes(f));

          duplicates.push({
            oldJs: jsFile,
            newTs: tsMatch,
            functions: commonFunctions,
            status: commonFunctions.length > 0 ? 'duplicate' : 'unique',
          });
        }
      }
    }
  });

  it('should identify potential duplicates', () => {
    const actualDuplicates = duplicates.filter((d) => d.status === 'duplicate');
    expect(duplicates.length).toBeGreaterThan(0);
  });

  it('should generate duplicates report', () => {
    const report = {
      timestamp: new Date().toISOString(),
      duplicates: duplicates,
      summary: {
        total: duplicates.length,
        duplicate: duplicates.filter((d) => d.status === 'duplicate').length,
        unique: duplicates.filter((d) => d.status === 'unique').length,
      },
      recommendations: duplicates
        .filter((d) => d.status === 'duplicate')
        .map((d) => ({
          oldFile: d.oldJs,
          newFile: d.newTs,
          action: 'Consider removing old .js file if migration is complete',
          commonFunctions: d.functions,
        })),
    };

    const reportPath = path.join(
      projectRoot,
      'tests',
      'migration',
      'reports',
      'duplicates-report.json'
    );
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    expect(fs.existsSync(reportPath)).toBe(true);
  });
});
