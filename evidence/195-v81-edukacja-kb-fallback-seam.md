# V8.1 Evidence - Edukacja KB Fallback Seam

Date: 2026-03-26
Lane: `Edukacja`
Taxonomy: `T4`
Packet: `Packet 1`

## Goal

Close the smallest real edukacja split on the active docs surface by replacing a dead fallback contract with the
mounted KB fallback used by the rest of the product.

## What changed

1. `src/hooks/useDocs.ts`
   - adds one mounted legacy KB base constant: `/api/kb`
   - replaces all `/api/knowledge-base/*` fallback calls with `/api/kb/*`
   - keeps the public V8 KB bridge as primary and the V8 KB client as the second hop
2. `tests/hooks/useDocs.test.tsx`
   - adds regression for categories fallback continuity
   - adds regression for articles fallback continuity

## Why it matters

Before this packet, the active docs education surface had a final fallback that did not match the mounted KB runtime.
That meant public edukacja/help continuity could still degrade into a dead endpoint assumption.

After this packet, the bounded read chain is coherent:

`/api/public/kb-v8/* -> V8 KB client -> /api/kb/*`

## Verification

- `npx vitest run tests/hooks/useDocs.test.tsx`
