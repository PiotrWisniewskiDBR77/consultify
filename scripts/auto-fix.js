#!/usr/bin/env node
/**
 * Auto-Fix Script
 * 
 * Analizuje błędy z testów, lint i typecheck,
 * używa AI do generowania poprawek i automatycznie je stosuje.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.findIndex(arg => arg.startsWith(`--${name}=`));
  return idx !== -1 ? args[idx].split('=')[1] : null;
};

const testOutput = getArg('test-output') || '';
const lintOutput = getArg('lint-output') || '';
const typecheckOutput = getArg('typecheck-output') || '';
const testFailed = getArg('test-failed') === 'true';
const lintFailed = getArg('lint-failed') === 'true';
const typecheckFailed = getArg('typecheck-failed') === 'true';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AUTO_FIX_TAG = process.env.AUTO_FIX_TAG || '[AUTO-FIX]';

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY nie jest ustawione');
  process.exit(1);
}

/**
 * Wywołuje OpenAI API do generowania poprawek
 */
async function callOpenAI(prompt) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Jesteś ekspertem od programowania TypeScript/JavaScript i React. 
Twoim zadaniem jest analizować błędy i generować konkretne poprawki kodu.
Odpowiadaj TYLKO poprawionym kodem lub instrukcjami jak naprawić błąd.
Jeśli błąd jest w konkretnym pliku, podaj pełną ścieżkę i poprawiony kod.
Format odpowiedzi:
FILE: <ścieżka_pliku>
<poprawiony_kod>

lub jeśli potrzebne są tylko małe zmiany:
FILE: <ścieżka_pliku>
LINE: <numer_linii>
REPLACE: <stary_kod>
WITH: <nowy_kod>`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('❌ Błąd podczas wywołania OpenAI:', error.message);
    throw error;
  }
}

/**
 * Parsuje output testów i wyciąga informacje o błędach
 */
function parseTestErrors(output) {
  if (!output || !testFailed) return [];
  
  const errors = [];
  const lines = output.split('\n');
  
  // Szukamy błędów w formacie Vitest/Jest
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Format: FAIL tests/path/to/file.test.js
    if (line.includes('FAIL') && line.includes('.test.') || line.includes('.spec.')) {
      const fileMatch = line.match(/FAIL\s+(.+\.(test|spec)\.(js|ts|tsx|jsx))/);
      if (fileMatch) {
        errors.push({
          type: 'test',
          file: fileMatch[1],
          message: line,
          context: lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 10)).join('\n')
        });
      }
    }
    
    // Format: Error: ... at file.js:123:45
    const errorMatch = line.match(/Error:.*at\s+(.+):(\d+):(\d+)/);
    if (errorMatch) {
      errors.push({
        type: 'test',
        file: errorMatch[1],
        line: parseInt(errorMatch[2]),
        message: line,
        context: lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join('\n')
      });
    }
  }
  
  return errors;
}

/**
 * Parsuje output ESLint i wyciąga błędy
 */
function parseLintErrors(output) {
  if (!output || !lintFailed) return [];
  
  const errors = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Format: /path/to/file.js
    //   123:45  error  Rule message  rule-name
    const lintMatch = line.match(/^(.+\.(js|ts|tsx|jsx))\s*$/);
    if (lintMatch) {
      const file = lintMatch[1];
      // Szukamy następnych linii z błędami dla tego pliku
      let i = lines.indexOf(line) + 1;
      while (i < lines.length && lines[i].match(/^\s+\d+:\d+\s+(error|warning)/)) {
        const errorLine = lines[i];
        const errorMatch = errorLine.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([a-z-]+)/);
        if (errorMatch) {
          errors.push({
            type: 'lint',
            file: file,
            line: parseInt(errorMatch[1]),
            column: parseInt(errorMatch[2]),
            severity: errorMatch[3],
            message: errorMatch[4],
            rule: errorMatch[5],
            context: errorLine
          });
        }
        i++;
      }
    }
  }
  
  return errors;
}

/**
 * Parsuje output TypeScript i wyciąga błędy
 */
function parseTypecheckErrors(output) {
  if (!output || !typecheckFailed) return [];
  
  const errors = [];
  const lines = output.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Format: file.ts(123,45): error TS2345: Message
    const tsErrorMatch = line.match(/^(.+\.(ts|tsx))\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);
    if (tsErrorMatch) {
      errors.push({
        type: 'typecheck',
        file: tsErrorMatch[1],
        line: parseInt(tsErrorMatch[3]),
        column: parseInt(tsErrorMatch[4]),
        severity: tsErrorMatch[5],
        code: tsErrorMatch[6],
        message: tsErrorMatch[7],
        context: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join('\n')
      });
    }
  }
  
  return errors;
}

/**
 * Stosuje poprawki do plików
 */
function applyFixes(fixes) {
  let appliedCount = 0;
  
  for (const fix of fixes) {
    try {
      if (fix.type === 'file_replace') {
        // Pełna zamiana pliku
        writeFileSync(fix.file, fix.content, 'utf8');
        console.log(`✅ Zastosowano poprawkę w ${fix.file}`);
        appliedCount++;
      } else if (fix.type === 'line_replace') {
        // Zamiana konkretnej linii
        const content = readFileSync(fix.file, 'utf8');
        const lines = content.split('\n');
        
        if (fix.line > 0 && fix.line <= lines.length) {
          lines[fix.line - 1] = fix.newLine;
          writeFileSync(fix.file, lines.join('\n'), 'utf8');
          console.log(`✅ Zastosowano poprawkę w ${fix.file}:${fix.line}`);
          appliedCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Błąd podczas stosowania poprawki w ${fix.file}:`, error.message);
    }
  }
  
  return appliedCount;
}

/**
 * Parsuje odpowiedź AI i wyciąga poprawki
 */
function parseAIResponse(response) {
  const fixes = [];
  const lines = response.split('\n');
  
  let currentFile = null;
  let currentContent = [];
  let inFileBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Format: FILE: path/to/file.ts
    const fileMatch = line.match(/^FILE:\s*(.+)$/);
    if (fileMatch) {
      // Zapisz poprzedni plik jeśli był
      if (currentFile && currentContent.length > 0) {
        fixes.push({
          type: 'file_replace',
          file: currentFile,
          content: currentContent.join('\n')
        });
      }
      
      currentFile = fileMatch[1].trim();
      currentContent = [];
      inFileBlock = true;
      continue;
    }
    
    // Format: LINE: 123
    const lineMatch = line.match(/^LINE:\s*(\d+)$/);
    if (lineMatch && currentFile) {
      const lineNum = parseInt(lineMatch[1]);
      i++; // Przejdź do REPLACE
      
      if (i < lines.length && lines[i].startsWith('REPLACE:')) {
        const oldCode = lines[i].replace('REPLACE:', '').trim();
        i++;
        
        if (i < lines.length && lines[i].startsWith('WITH:')) {
          const newCode = lines[i].replace('WITH:', '').trim();
          fixes.push({
            type: 'line_replace',
            file: currentFile,
            line: lineNum,
            oldLine: oldCode,
            newLine: newCode
          });
        }
      }
      continue;
    }
    
    // Zbierz zawartość pliku
    if (inFileBlock && currentFile && line.trim() && !line.startsWith('FILE:') && !line.startsWith('LINE:')) {
      currentContent.push(line);
    }
  }
  
  // Zapisz ostatni plik
  if (currentFile && currentContent.length > 0) {
    fixes.push({
      type: 'file_replace',
      file: currentFile,
      content: currentContent.join('\n')
    });
  }
  
  return fixes;
}

/**
 * Główna funkcja
 */
async function main() {
  console.log('🔧 Rozpoczynam automatyczną poprawę błędów...\n');
  
  // Zbierz wszystkie błędy
  const testErrors = parseTestErrors(testOutput);
  const lintErrors = parseLintErrors(lintOutput);
  const typecheckErrors = parseTypecheckErrors(typecheckOutput);
  
  const allErrors = [...testErrors, ...lintErrors, ...typecheckErrors];
  
  if (allErrors.length === 0) {
    console.log('✅ Brak błędów do naprawienia');
    return;
  }
  
  console.log(`📊 Znaleziono ${allErrors.length} błędów:`);
  console.log(`   - Testy: ${testErrors.length}`);
  console.log(`   - Lint: ${lintErrors.length}`);
  console.log(`   - TypeCheck: ${typecheckErrors.length}\n`);
  
  // Grupuj błędy po plikach
  const errorsByFile = {};
  for (const error of allErrors) {
    if (!errorsByFile[error.file]) {
      errorsByFile[error.file] = [];
    }
    errorsByFile[error.file].push(error);
  }
  
  let totalFixes = 0;
  
  // Przetwarzaj każdy plik
  for (const [file, errors] of Object.entries(errorsByFile)) {
    console.log(`\n📝 Przetwarzam ${file}...`);
    
    // Sprawdź czy plik istnieje
    if (!existsSync(file)) {
      console.log(`⚠️  Plik ${file} nie istnieje, pomijam`);
      continue;
    }
    
    // Przeczytaj zawartość pliku
    let fileContent;
    try {
      fileContent = readFileSync(file, 'utf8');
    } catch (error) {
      console.error(`❌ Nie można odczytać pliku ${file}:`, error.message);
      continue;
    }
    
    // Przygotuj prompt dla AI
    const errorSummary = errors.map(e => {
      if (e.type === 'lint') {
        return `Lint error w linii ${e.line}: ${e.message} (${e.rule})`;
      } else if (e.type === 'typecheck') {
        return `TypeScript error w linii ${e.line}: ${e.message} (${e.code})`;
      } else {
        return `Test error: ${e.message}`;
      }
    }).join('\n');
    
    const prompt = `Napraw następujące błędy w pliku ${file}:

${errorSummary}

Aktualna zawartość pliku:
\`\`\`
${fileContent}
\`\`\`

Wygeneruj poprawiony kod. Jeśli możesz naprawić tylko konkretne linie, użyj formatu LINE/REPLACE/WITH. Jeśli potrzebna jest większa zmiana, podaj cały poprawiony plik.`;
    
    try {
      console.log(`🤖 Wywołuję AI do analizy błędów...`);
      const aiResponse = await callOpenAI(prompt);
      
      console.log(`📥 Odpowiedź AI otrzymana, parsuję poprawki...`);
      const fixes = parseAIResponse(aiResponse);
      
      if (fixes.length === 0) {
        console.log(`⚠️  Nie udało się wygenerować poprawek dla ${file}`);
        console.log(`Odpowiedź AI:\n${aiResponse.substring(0, 500)}...`);
        continue;
      }
      
      const applied = applyFixes(fixes);
      totalFixes += applied;
      
      console.log(`✅ Zastosowano ${applied} poprawek w ${file}`);
      
      // Małe opóźnienie, żeby nie przeciążać API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Błąd podczas przetwarzania ${file}:`, error.message);
    }
  }
  
  // Oznacz, że poprawki zostały zastosowane
  if (totalFixes > 0) {
    writeFileSync('.auto-fix-applied', `Applied ${totalFixes} fixes at ${new Date().toISOString()}\n`, 'utf8');
    console.log(`\n✅ Zastosowano łącznie ${totalFixes} poprawek`);
  } else {
    console.log(`\n⚠️  Nie udało się zastosować żadnych poprawek`);
  }
}

// Uruchom
main().catch(error => {
  console.error('❌ Krytyczny błąd:', error);
  process.exit(1);
});

