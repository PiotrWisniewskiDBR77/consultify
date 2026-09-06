import fs from 'node:fs';

const files = fs
  .readFileSync(0, 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean);

function extractMockCallSpan(text, startIdx) {
  // startIdx points at "vi.mock(" — find the matching closing ")" by paren balance,
  // starting the count from the "(" right after "vi.mock".
  const openParenIdx = text.indexOf('(', startIdx);
  let depth = 0;
  for (let i = openParenIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return text.slice(startIdx); // unbalanced — return rest as fallback
}

const gaps = [];
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const marker = "vi.mock('react-router-dom'";
  let searchFrom = 0;
  let found = false;
  let anyBlockHasUseLocation = false;
  while (true) {
    const idx = text.indexOf(marker, searchFrom);
    if (idx === -1) break;
    found = true;
    const block = extractMockCallSpan(text, idx);
    const hasUseLocation = block.includes('useLocation');
    const hasActualSpread = /\.\.\.\s*(actual|actualModule|mod|original)\b/.test(block);
    if (hasUseLocation || hasActualSpread) anyBlockHasUseLocation = true;
    searchFrom = idx + marker.length;
  }
  if (found && !anyBlockHasUseLocation) {
    gaps.push(f);
  }
}

console.log(`total mock files: ${files.length}`);
console.log(`gaps (mock factory lacks useLocation): ${gaps.length}`);
gaps.forEach((g) => console.log(g));
