# Stability sign-off — 2026-06-09 (~03:55Z)

Dowodowo, nie deklaratywnie. Co zostało zweryfikowane jako stabilne.

## PROD (`consultify.ai`) — po migracji addytywnej
| Sprawdzenie | Wynik |
|-------------|-------|
| `/api/health` | **200** (db + redis connected) |
| 5xx / FATAL / uncaught od migracji (03:33Z) | **brak** |
| Schemat AI naprawiony | `SELECT internet_enabled FROM ai_policies WHERE org='vts'` → **OK** (wcześniej „does not exist") |
| Ewidencja AI (`ai_usage_logs`) | kolumna `error_message` dodana → INSERT odblokowany. (0 wierszy = INSERT był ZAWSZE zepsuty; ruch VTS zacznie logować) |
| Snapshot przed zmianą | `PROD-schema-snapshot-pre-migration.txt` (rollback ref) |

**Zastrzeżenie (jakość, nie stabilność):** ModelRouter `integer=boolean` to fix KODU — na prodzie nadal degraduje routing na hardcoded fallback (czat działa). Zniknie po skoordynowanym deployu kodu.

## STAGING (`consultify-staging`) — pełny naprawiony build (railway up)
| Sprawdzenie | Wynik |
|-------------|-------|
| Boot / health | czysty / 200 |
| My Work (BUG-22) | renderuje się, 18 sygnałów, **0 błędów konsoli** (commandDock naprawiony) |
| Smoke: chat, interview, narzędzia, settings | wszystkie ładują się, **0 błędów/wyjątków konsoli** |
| web-vitals (BUG-21) | route 401 (nie 404) |
| i18n mobile (BUG-16) | Initiatives/More + Inicjatywy/Więcej |
| Schemat | zero błędów „does not exist" |

## Werdykt
- **Naprawiony build = stabilny** (zweryfikowany na staging end-to-end).
- **Prod = stabilny** po migracji; pełna jakość AI po deployu kodu.
- Brak otwartych regresji od moich zmian.

## Czego NIE dało się zweryfikować (wymaga kont VTS / ruchu)
- PII gate USER→403 / ADMIN→200 (org `atelier` na staging ma v8 OFF; potrzeba konta USER+ADMIN na org z v8 ON).
- Voice 403-fallback na żywym koncie ze stale org.
- Live INSERT do `ai_usage_logs` (brak ruchu nocą).
→ To jest zakres **Fazy 4** (post-deploy GO-gate) — `PHASE-4-TEST-PLAN.md`.
