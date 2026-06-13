# WP M22 — AI OS / Internal Tools · dokończenie do 100%

**Pula:** internal · **Karta:** `Harvard/modules/M22-ai-os/KARTA_AUDYTU.md` (ocena 54/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** P1 dead-code + P1 UX deception
**Faza programu:** FAZA 1 (Artifacts 404 + martwy router) → FAZA 3 (szlif) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Najlepiej zabezpieczony moduł aplikacji — podwójny gating FE (`canUseInternalTools` + `InternalToolsGate`) + BE (`internalTools.middleware.ts` domain/role/orgId), org-scope egzekwowany we wszystkich serwisach, zero cross-org IDOR, zero x-*-role abuse. 6 wave-service'ów (5–9 + research) z pełnym wiringiem FE↔BE↔DB + migracjami + unit testami. **Re-audit po Sprintach 1–5:** `_actionDecisionRoutes` zamontowany (commit `f35aa8d7c8` — 1188 l. governance osiągalne); i18n Wave panels PL/EN (commit `b77fd87ae7`). **UWAGA — rozjazd kart:** sekcja 1d karty wciąż opisuje `_actionDecisionRoutes` jako MARTWY import (`Gateway.ts:16`), a nagłówek re-auditu mówi „zamontowany" — wymaga rozstrzygnięcia stanu faktycznego w `Gateway.ts` przed planowaniem. Blokady wyższego tiera: Artifacts panel widoczny mimo 404 przy `ENABLE_V8_GLOBAL=off`, guardy bez routerów, brak route-integration testów, brak §27, Fazy 3+4 deferred.

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 1 + 3)
- **[P1 UX deception] Artifacts panel widoczny przy 404 API** — `Wave5ArtifactRuntimePanel.tsx` zawsze renderowany (za `internalToolsGuard`), ale `router.use(v8OutputsGate)` w `artifacts.routes.ts:38-40` zwraca 404 gdy `ENABLE_V8_GLOBAL != 'true'`; podwójny mount `Gateway.ts:380` (guard-only) + `Gateway.ts:747` (v8FeatureGate+router). Przy INTERNAL_TOOLS on + V8 off: panel aktywny, każdy klik → 404 bez komunikatu. **FAZA 1.** Fix: ukryć panel lub czytelny baner „V8 not enabled".
- **[P2/P3] brak obsługi 404/503** — żaden 404 (AI_EDITOR/V8 off) nie daje user-friendly erroru; cicha pustka. FAZA 3.
- i18n: ActionCenter/ResearchSessionsDock/AIOSHub/Wave5-9 bez `useTranslation` (hardkod EN, częściowo poprawione `b77fd87ae7`); §27 nie zastosowany w żadnej liście. FAZA 4.

### (b) BACKEND / API (FAZA 1 + 3)
- **[P1/P2 dead] `_actionDecisionRoutes`** — `Gateway.ts:16` import z prefiksem `_`, plik `actionDecisions.routes.ts` (1188 l.: PolicyEngine/AsyncJobService/audit-export). Karta wskazuje rozjazd (1d „nigdy nie mountowany" vs re-audit „zamontowany"). **FAZA 1:** zweryfikować realny stan mountu w `Gateway.ts`, potem zdecydować: mount (`/decide`/`/audit/export`/`/jobs/*` → 200) albo usunięcie (tsc `--noUnusedLocals` clean). NIE planować budowy od nowa — kod istnieje.
- **[P3] guardy bez routerów** — `Gateway.ts:388-394`: 7 `internalToolsGuard` na `/api/ai-training`, `/ai-infrastructure`, `/ai-development`, `/ai-budgets`, `/ai-prompts` (duplikat), `/ai-analytics`, `/ai-operations` — guard zarejestrowany, brak routera → 404. Wytnij lub zamontuj. FAZA 3.
- **[P2] OAuth Session Lifecycle symulowany** — `wave7-connectors.routes.ts:80-113` `PATCH /:connectorId` manualny zapis stanów OAuth, brak realnego provider flow. FAZA 3: realny OAuth albo jawny label „Manual / Simulated".
- **[P2] DEV bypass** — `internalTools.middleware.ts:39` `if (NODE_ENV dev/test) return true`; udokumentować + sprawdzić NODE_ENV na staging. FAZA 3.

### (c) INTEGRACJA / TESTY E2E (FAZA 1 + 4)
- **[P0 testowy] brak testu middleware security** (T1) — `internalTools.middleware.ts:72-76` nie testowany jako HTTP gate (404 dla non-dbr77.com). FAZA 1.
- **[P1] brak route-integration testów Wave 6/7/8/9** (T2–T5) — tylko service-unit; brak HTTP-contract + middleware-stack. FAZA 4.
- **[P2] brak unit testu Wave 6** (T6 — jedyna wave bez unit testu); E2E Artifacts-gate przy V8 off (T7). FAZA 4.
- CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate M22 ≈ 0. Dodać `Londyn` (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 1)** Zweryfikować realny mount `_actionDecisionRoutes` w `Gateway.ts`; mount-lub-usuń (decyzja). Usunąć/zamontować 7 guardów bez routerów.
2. **(FAZA 1)** Artifacts przy `ENABLE_V8_GLOBAL=false`: panel ukryty lub czytelny error (SC7).
3. **(FAZA 1)** Test middleware security (T1) — 404 dla domeny spoza whitelist.
4. **(FAZA 3)** OAuth Wave 7 realny lub label „Simulated"; udokumentować DEV bypass; banery 404/503; §27 ActionCenter+ResearchSessions; i18n Wave panels.
5. **(FAZA 4)** Route-integration Wave 6/7/8/9 (T2–T5), unit Wave 6 (T6), E2E Artifacts-gate (T7); trigger CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** `_actionDecisionRoutes` zamontowany lub usunięty (zero martwego importu); guardy bez routerów wyczyszczone; Artifacts działa lub czytelnie zablokowany.
2. **Bezpieczeństwo:** test middleware (non-dbr77 → 404); org-scope (już szczelny); zero żywych P1.
3. **i18n:** `t()` w Wave panels + ActionCenter + ResearchSessions.
4. **Tokeny:** Visual Standard.
5. **§27:** ActionCenter + ResearchSessions przez FilterableTable.
6. **E2E w PR-gate:** SC1–SC7 + route-integration Wave 6/7/8/9 zielone na `Londyn`.

## 5. Weryfikacja
- Artifacts: `ENABLE_V8_GLOBAL=false` → SC7 screenshot „V8 not enabled" lub panel schowany.
- `_actionDecisionRoutes`: jeśli mount → `POST /api/ai/actions/decide` 200; jeśli usunięcie → tsc clean, smoke bez regresji.
- Security: curl non-dbr77.com → 404; Fazy 3/4 z dowodami w `Harvard/modules/M22-ai-os/evidence/`.
- Railway: `INTERNAL_TOOLS_ENABLED=true` na staging, migracje wave5-9, smoke `/api/research/sessions` + `/api/ai-connectors/` → 200.
- Uwaga DB: dev `.env` może wskazywać Railway PROD.

## 6. Zależności
- WYJŚCIE → M02 Canvas (Research compact), M17 Outputs (Artifacts share), M01 Teresa (Wave 6 memory) — Artifacts-gate fix koordynować z M17.
- Niezależne od kręgosłupa (Faza 0) — można równolegle.
- Ryzyko jednym zdaniem: rozjazd karty co do mountu `_actionDecisionRoutes` (1d vs re-audit) wymaga weryfikacji w `Gateway.ts` przed pracą — inaczej grozi planowaniem od zera kodu, który już jest zamontowany.
