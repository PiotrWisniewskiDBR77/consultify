# System testowania silników Tools (analogiczny do metody wczorajszego agenta) — 07-08

Cel: potwierdzić, że 11 silników **odpala i produkuje autentyczny insight** na realnych danych — dwuwarstwowo, jak wczorajszy agent (smoke-test offline + live na staging + panel).

## Warstwa A — offline (deterministyczna, zero API/DB) ✅ DZIAŁA
`src/config/__toolsEngineHarnessA.mts`. Per narzędzie: fixture (worked-example z doktryny) → adapter → `build{Tool}ConclusionPrompt` → assert **grounded** (non-null, >500 znaków = silnik policzył metryki i zbudował konkluzję).
```
npx tsx src/config/__toolsEngineHarnessA.mts
→ 11/11 PASS ✅ WSZYSTKIE SILNIKI ODPALAJĄ
```
Odtworzone dwukrotnie (po przerwie środowiska) — za każdym razem 11/11, potwierdzenie deterministyczności.

## Warstwa B — live na staging (kontrakt DB + Teresa-level)
`src/config/__toolsHarnessB_live.mts`. Per narzędzie: `POST /tools` → `PUT /tools/:id` (fill fixturą) → `GET` (readback: sekcje persystują z właściwymi kluczami?) → adapter+silnik na ODCZYTANYCH z DB danych → grounded? → cleanup.
```
STAGING_API_URL="https://api.staging.consultify.app/api" STAGING_JWT="<bearer>" \
  npx tsx src/config/__toolsHarnessB_live.mts
```
- **Auth:** JWT demo usera + User-Agent (WAF). Token: railway login / staging.
- **Bez JWT** → dry-run (drukuje plan, nie uderza w API).
- **PRZED uruchomieniem:** sprawdź tier LLM (lekcja `finding_demo_llm_tier_glm_flaky`).
- **NIE na demo.** Wszystkie sesje mają prefiks `[HARNESS-TEST]`.

### B-AI (jakość insightu) — żywy pass w apce
Kontrakt DB (B powyżej) potwierdza że silnik dostaje dane. Jakość insightu z realnego LLM = przejście narzędzia w UI (`npm run dev:staging`, port 3000) LUB panel 4 sceptyków na wygenerowanej treści. Bramka wizualna Piotra.

## Cleanup (demo=twarz)
`server/scripts/cleanup-test-tool-sessions.ts` — kasuje TYLKO sesje z prefiksem `[HARNESS-TEST]`, na jawnie wybranym targecie, po potwierdzeniu.

## Stan (po odtworzeniu — patrz finding_ephemeral_worktree_loses_uncommitted_between_turns)
- ✅ Kontrakt kluczy: 11× `{TOOL}_STEPS` wpięte w useToolStore (blocker §3 rozwiązany).
- ✅ Warstwa A: 11/11 PASS, zweryfikowane 2× niezależnie.
- ✅ Warstwa B + cleanup: napisane, dry-run OK.
- ✅ Asystent SIRI/ADMA/DRD zmiany 2,3,4,5 z 6 zrobione (zostaje 1+6).
- ⏭ Do uruchomienia: staging token (railway) + warstwa B live + B-AI/panel.
