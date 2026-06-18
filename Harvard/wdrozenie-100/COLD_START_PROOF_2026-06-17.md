# Cold-Start Persistence Proof — 2026-06-17

> Faza 5 Harvard 4. Weryfikacja: dane przeżywają restart Railway (restart = nowy kontener, brak pamięci procesu).

## M18 Document Studio — 6/8 → 8/8 warstw PG

**Migracje:** `780_document_studio_approvals_persistence.sql` + `781_document_studio_wave5_layer2_persistence.sql`
**Commity kodu:** `953955bc2b` (mig + DAO refactor) + `8d2b5d8cf4` (wave5 layer-2)

| DAO | In-memory Maps | PG operacje | Status |
|-----|---------------|-------------|--------|
| `documentApprovalRegistryDao.ts` | 0 | 6 | ✅ PG |
| `documentContentBlockRegistryDao.ts` | 0 | 5 | ✅ PG |
| `documentBrandVoiceRegistryDao.ts` | 0 | 5 | ✅ PG |
| `documentAudienceProfileRegistryDao.ts` | 0 | 5 | ✅ PG |
| `documentSourcePackRegistryDao.ts` | 0 | 5 | ✅ PG |
| `documentShareLinkRegistryDao.ts` | 0 | 8 | ✅ PG |

**Dowód architektoniczny:** 0 `new Map()` w żadnym z 6 DAOs (grep `new Map` = 0 trafień). Dane żyją w tabelach Postgres — przeżywają restart z definicji.

**Dowód live (pending deploy):** Wymaga push Londyn → Railway deploy → CREATE test record → `railway redeploy` → GET record. Do uruchomienia przez Piotra po zgodzie na push.

```bash
# Weryfikacja po push (run against caboose/staging):
curl -H "Authorization: Bearer $TOKEN" \
  "https://staging.consultify.app/api/document-studio/content-blocks?orgId=TEST_ORG" | jq '.length'
# Restart Railway → re-run → same count = PASS
```

---

## M15 Rezultaty — PG-native, brak session state

**Weryfikacja:** `resultsROIService.ts` używa `new Map` tylko do agregacji w ramach żądania (groupBy/reduce pattern). Żadnych Maps jako storage między żądaniami.
Dane: tabele `kpi_metrics`, `roi_tracking`, `initiative_results` — standardowy PG.
**Status:** ✅ Dane przeżywają restart. Brak dodatkowych migracji potrzebnych.

---

## M16 Finanse — PG-native, brak session state

**Weryfikacja:** `financeStatementAnalyticsService.ts` i `financialModelingService.ts` — Maps to agregacja in-request (period buckets, value accumulation). Żadnych Maps jako cache między żądaniami.
Dane: tabele `finance_statements`, `finance_lines`, `finance_values` — standardowy PG.
**Status:** ✅ Dane przeżywają restart.

---

## M21 Meeting — PG-native

**Weryfikacja:** `meetingService.ts` — `INSERT INTO meetings (...)` + `INSERT INTO meeting_follow_ups (...)`. Brak in-memory storage.
**Status:** ✅ Meetings i follow-ups przeżywają restart.

---

## Podsumowanie

| Moduł | Persystencja | Brakujące | Gotowość |
|-------|-------------|-----------|----------|
| M18 Documents | 6/6 DAOs PG | live deploy proof | ⚡ Architektura OK; live proof po deploy |
| M15 Rezultaty | PG-native | — | ✅ Kompletny |
| M16 Finanse | PG-native | — | ✅ Kompletny |
| M21 Meeting | PG-native | — | ✅ Kompletny |

**Akcja:** Live proof M18 = Piotr triggeruje Railway redeploy po push Londyn → staging (caboose) i weryfikuje endpoint.
