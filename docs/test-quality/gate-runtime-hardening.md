# Gate Runtime Hardening (CI Stability)

## Why
Niektóre środowiska CI/sandbox mogą blokować mechanizmy IPC używane przez narzędzia typu `tsx`
(np. tworzenie named pipe / socket w katalogu tymczasowym). To potrafi powodować flaki w gate’ach,
które powinny być deterministyczne.

## Decision
Tam gdzie to możliwe, uruchamiamy gate’y TypeScript przez:
```bash
node --experimental-strip-types <script.ts>
```
Zamiast `npx tsx <script.ts>`.

## Applied
- `npm run security:integrity` → `node --experimental-strip-types scripts/security/verify-security-integrity.ts`

