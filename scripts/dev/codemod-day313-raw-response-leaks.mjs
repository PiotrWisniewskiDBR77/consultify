#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  'server/src/routes/table-platform.routes.ts',
  'server/src/routes/data-collection.routes.ts',
];

let changed = 0;
for (const relative of files) {
  const file = resolve(process.cwd(), relative);
  let source = readFileSync(file, 'utf8');
  let loggerWindow = 0;
  source = source
    .split('\n')
    .map((line) => {
      if (/logger\.\w+\(/.test(line)) loggerWindow = 3;
      const isLeak =
        /(?:error|message|details):\s*(?:\((?:err|error|e) as Error\)|(?:err|error|e))\.message/.test(
          line
        ) && !(loggerWindow > 0 && !/res\.|\.json\(/.test(line));
      if (loggerWindow > 0) loggerWindow -= 1;
      if (!isLeak) return line;

      const rewritten = line
        .replace(
          /error:\s*'[^']+',\s*details:\s*\(e as Error\)\.message/,
          "...mapAppErrorResponse(e, undefined, 'error')"
        )
        .replace(
          /error:\s*\(e as Error\)\.message/,
          "...mapAppErrorResponse(e, undefined, 'error')"
        );
      if (rewritten === line) throw new Error(`Unsupported leak shape in ${relative}: ${line}`);
      changed += 1;
      return rewritten;
    })
    .join('\n');

  if (relative.endsWith('data-collection.routes.ts') && !source.includes("middleware/appErrorMapper")) {
    source = source.replace(
      "import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';",
      "import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';\nimport { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';"
    );
  }
  writeFileSync(file, source);
}

if (changed !== 0 && changed !== 35) {
  throw new Error(`Expected exactly 35 response leak rewrites, got ${changed}`);
}

console.log(
  changed === 0
    ? 'No day-313 raw response leaks remain.'
    : `Rewrote ${changed} raw response leaks in ${files.length} files.`
);
