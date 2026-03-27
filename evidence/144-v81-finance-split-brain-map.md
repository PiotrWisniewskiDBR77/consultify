# V8.1 Finance Split-Brain Map

Date: 2026-03-26
Lane: `Finance`
Taxonomy: `T2`
Status: `active`

## Why this lane is promotable

Finance already has a governed V8 runtime surface, but the live module still mixes route authority
and data authority across V8 and legacy seams.

## Current split-brain map

1. Route and shell authority
   - canonical alias `/finance` exists in `src/routes/routeConfig.ts`
   - live shell protection and AppView resolution still favored `/economics`
   - chat navigation still targeted `/economics`

2. Governed V8 runtime strip
   - `src/components/Economics/FinanceHub.tsx`
   - `src/services/api/v8/finance.ts`
   - governed `GET /api/v8/finance/dashboard`

3. Legacy tab data plane
   - `src/components/Economics/hooks/useFinanceData.ts`
   - `src/services/api.ts`
   - active tab bodies still read legacy finance/economics endpoints

4. Backend surface depth mismatch
   - `server/src/routes/v8/finance.routes.ts` exposes a narrow V8 read bridge
   - broader ingest / models / budgets / valuations behavior still lives on legacy paths

## Bounded first packet

Start with `finance entry route shell parity`:

- make `/finance` the canonical route authority
- preserve `/economics` as compatibility
- align RouterSync, AppView mapping, and chat navigation before touching ingest or mutations
