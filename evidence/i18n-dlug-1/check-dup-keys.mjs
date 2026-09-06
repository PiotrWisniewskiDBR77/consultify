import fs from 'node:fs';
import { visit } from 'jsonc-parser';

function findDuplicates(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const dups = [];
  const stack = [{ seen: new Set(), path: [] }];
  let pendingKey = [null];

  visit(text, {
    onObjectBegin: () => {
      const parentPath = stack[stack.length - 1].path;
      const key = pendingKey[pendingKey.length - 1];
      stack.push({ seen: new Set(), path: key !== null ? [...parentPath, key] : parentPath });
      pendingKey.push(null);
    },
    onObjectEnd: () => {
      stack.pop();
      pendingKey.pop();
    },
    onObjectProperty: (property) => {
      const top = stack[stack.length - 1];
      const fullPath = [...top.path, property].join('.');
      if (top.seen.has(property)) {
        dups.push(fullPath);
      } else {
        top.seen.add(property);
      }
      pendingKey[pendingKey.length - 1] = property;
    },
    onArrayBegin: () => {
      const parentPath = stack[stack.length - 1].path;
      const key = pendingKey[pendingKey.length - 1];
      stack.push({ seen: new Set(), path: key !== null ? [...parentPath, key] : parentPath });
      pendingKey.push(null);
    },
    onArrayEnd: () => {
      stack.pop();
      pendingKey.pop();
    },
  });

  return dups;
}

for (const f of [
  'public/locales/pl/translation.json',
  'public/locales/en/translation.json',
]) {
  const dups = findDuplicates(f);
  console.log(f, '-> duplicate keys:', dups.length);
  if (dups.length) console.log(dups.slice(0, 30).join('\n'));
}
