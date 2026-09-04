#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(resolve(process.cwd(), 'package.json'));
const ts = require('typescript');
const mode = process.argv[2] ?? '--check';
const requested = process.argv.slice(3).map((file) => resolve(process.cwd(), file));
if (!requested.length) throw new Error('Pass one or more route files.');

const result = { eligible: [], noReq: [], changedFiles: [] };

for (const file of requested) {
  const source = readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edits = [];

  function visit(node, functions = []) {
    const nextFunctions = ts.isFunctionLike(node) ? [...functions, node] : functions;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'mapAppErrorResponse' &&
      node.arguments.length >= 2 &&
      ts.isIdentifier(node.arguments[1]) &&
      node.arguments[1].text === 'undefined'
    ) {
      const owner = nextFunctions.at(-1);
      const hasReq = owner?.parameters.some(
        (parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === 'req'
      );
      const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
      const entry = `${relative(process.cwd(), file)}:${line}`;
      if (hasReq) {
        result.eligible.push(entry);
        edits.push({ start: node.arguments[1].getStart(tree), end: node.arguments[1].getEnd() });
      } else {
        result.noReq.push(entry);
      }
    }
    ts.forEachChild(node, (child) => visit(child, nextFunctions));
  }
  visit(tree);

  if (mode === '--apply' && edits.length) {
    let output = source;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      output = `${output.slice(0, edit.start)}req${output.slice(edit.end)}`;
    }
    writeFileSync(file, output);
    result.changedFiles.push(relative(process.cwd(), file));
  }
}

console.log(JSON.stringify(result, null, 2));
