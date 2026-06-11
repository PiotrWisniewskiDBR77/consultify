# M10 — Wywiad · FAZA 5 (KANONY) + FAZA 6 (BEZPIECZEŃSTWO)

Agent: KANON+SEC · Protokół Audytu V1 · branch `feat/deliverables-light` · READ-ONLY · 2026-06-11
Zakres: poz. 1–15 inwentarza `INV_C_wywiad_narzedzia_audyty.md` (sekcja WYWIAD). NIE audytowano M11/M12.

---

## FAZA 5 — KANONY

### 5.1 §27 TABLE_AND_PREVIEW_CANON — tabele listowe M10

Renderer: `src/components/Interview/InterviewHub.tsx` (13 605 l.). Cztery powierzchnie listowe są opakowane w kanoniczny `TableWithPreviewLayout` (preview pane ISTNIEJE — A0 PASS), ale **wnętrze każdej tabeli to ręczny `<table className="table-fixed">`** (nie `FilterableTable`). To dozwolony tymczasowy fallback §27.A („spełnia A–S wizualnie na ResizableTable/ręczna"), ale niesie konkretne odstępstwa.

Importy: `TableWithPreviewLayout` (`InterviewHub.tsx:122`), `FilterDropdown` z ResizableTable (`:106`), 17× `FilterDropdown`, 55× ref. resize, 20× ChevronUp/Down.

| Powierzchnia (§27) | TableWithPreviewLayout | Preview (A0) | Filtry kol. (A0/O) | Sort (A0) | Resize (A0) | Sticky hdr | persistKey (A) | Status-chip = `c.*`/EntityStatusChip (F) | i18n (R) | RC-5 (P) |
|---|---|---|---|---|---|---|---|---|---|---|
| **Sesje (manager)** `:10323` + inner `<table>` `:5043` | ✅ | ✅ | ✅ `setSessionsTableFilters` | ✅ `sessionSortField`/`toggleSessionSort` `:4969,5077` | ✅ | ✅ `:5043` | ❌ brak | ❌ rose/amber hardcode | ❌ `{en,pl}` inline | ❌ raw `<table>` |
| **Przydzielone (manager)** `:12120`/`:12291` + inner `<table>` `:9510` | ✅ | ✅ | ✅ `setTableFilters` | ✅ | ✅ | ✅ | ❌ brak | ❌ rose hardcode | ❌ inline | ❌ raw `<table>` |
| **Szablony** `:12018` + inner `<table>` `:6449` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ brak | ❌ hardcode | ❌ inline | ❌ raw `<table>` |
| **Wnioski/Insights lista** `:10511` + inner `<table>` `:7524` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ brak | ❌ hardcode | ❌ inline | ❌ raw `<table>` |

**Odstępstwa §27 (priorytetyzowane):**

- **[P1] §27.F (🔴) — status chip nie używa `EntityStatusChip`/`statusChipTone`→`c.*`.** Lokalna mapa statusów z hardcodowaną paletą Tailwind (`rose`/`amber`/`emerald`). Dowód: `InterviewHub.tsx:4772-4778` (`sent_back` → `bg-rose-50 text-rose-900 … dot bg-rose-500`), powtórzone `:8587,8635,8643`. 21× `rose-*` w pliku — to dokładnie wzorzec korupcji „rose" z briefu (danger/„do poprawy" malowane Tailwindem zamiast tonem `c.danger`). Łamie też §27.K (czerwień ma być tylko realny alarm; „Sent Back"/„Do poprawy" to stan workflow, nie błąd).
- **[P1] §27.R — i18n hardcoded.** Etykiety jako inline `{ en: 'Sent Back', pl: 'Do poprawy' }` (`:4773`), nie klucze `useTranslation`. Cały plik 13,6 k l. ma tylko ~7 odwołań do `t()`/useTranslation → przeważa hardcode dwujęzyczny rozsiany po komponencie. Brak pojedynczego SSOT tłumaczeń → ryzyko dryfu PL/EN.
- **[P1] §27.A — brak `persistKey`.** 0 wystąpień w pliku → szerokości kolumn / widoczność / filtry NIE persystują per `persistKey` (§5/§16). Każda z 4 tabel resetuje stan po przeładowaniu.
- **[P2] §27.P RC-5 — surowy `<table>` w kodzie.** 5× raw `<table className="table-fixed">` (`:5043, :6449, :7524, :9510, :11305`). Kanon §20 zakazuje surowego `<table>` w nowym kodzie; tu jest świadomy custom-renderer wewnątrz canonicznego layoutu (sticky/filtry/sort/resize zaimplementowane ręcznie), więc funkcjonalnie A0 jest spełnione, ale formalnie RC-5 NIE.
- **[INFO] A0 pozytywy:** preview pane, filtry kolumn (FilterDropdown), sort (z ChevronUp/Down), resize, sticky header — WSZYSTKIE obecne na 4 powierzchniach. Blokujących braków A0 (preview/filtry/sort) NIE ma. To największy plus tej powierzchni.

> Uwaga: pełny per-punkt A–S z dowodem `computed-style` + screenshotami (Faza 6 kanonu §27) wymaga uruchomienia preview na żywo — poza zakresem READ-ONLY agenta. Powyższe to audyt statyczny kod↔kanon.

### 5.2 InsightViewer — kanoniczny podgląd + durable guard

`src/components/Interview/InsightViewer.tsx` (8574 l.). Wieloskładnikowy reader (grid sekcji `:3062` `xl:grid-cols-3`, `:3189` `md:grid-cols-3`) z evidence/material-quality/posture. **Durable guard na częściowe `material_quality_json` POTWIERDZONY** (`:1532-1577`): każde podpole dostaje default — `role_coverage ?? []`, `department_coverage ?? []`, `missing_voices ?? []`, `limitations ?? []`, `recommended_followups ?? []`, plus wyliczane `answer_quality_posture`/`coverage_posture`. To realizuje fix z 2026-06-09 i zaspokaja troskę CARD_CONTENT_FORMULA §A6.2 (niekompletny obiekt = ryzyko crashu) na warstwie renderera. **PASS.**

### 5.3 CARD_CONTENT_FORMULA — wynik walidatorów (próbka 25 kart, LIVE prod)

W kodzie NIE istnieją maszynowe walidatory B3 (formuła jest spec-only w `docs/standards/CARD_CONTENT_FORMULA.md`). Istnieje natomiast działający walidator `docs/qa/runs/2026-06-10/vts-card-audit-validator.cjs` (implementuje §B3) — uruchomiony przeze mnie na żywej bazie PROD (cards VTS wave 2 produkowane przez M10: `generate_from_evidence`). Próbka: **10 wniosków + 15 inicjatyw = 25 kart** (>5 wymagane).

**WNIOSKI (10) — macierz FAIL §B3:**
| Walidator | FAIL | Karty |
|---|---|---|
| `content_sections` | **10/10** | wszystkie (brak nagłówków Obserwacja/Mechanizm/Wpływ/Rekomendacja) |
| `content_len` | **10/10** | wszystkie (790–1146 słów vs limit 350–700 — przekroczenie) |
| `summary_len` | 8/10 | I1-I6,I8,I9 (147–164 słów vs 60–130) |
| `title_len` | 3/10 | I2,I6,I9 (16 słów vs ≤14) |
| `evidence_map_cover` | 3/10 | I3,I4,I5 (snippet >120 zn.) |
| `lang_pl` | 2/10 | I6,I10 (podejrzenie EN-prozy) |
| `material_quality_complete` | 0/10 | ✅ wszystkie komplet (zgodne z A6.2) |

**INICJATYWY (15) — macierz FAIL §B3:**
| Walidator | FAIL | Karty |
|---|---|---|
| `depends_on` | **13/15** | brak zależności w tabeli (WAR — dopuszczalne z `— Pominięto:`, ale brak adnotacji) |
| `raid_mix` | **11/15** | niekompletne wpisy RAID (brak probability/impact/mitigation na części) |
| `description_len` | 7/15 | 775–1144 słów vs 400–750 |
| `kpi_baseline_target` | 5/15 | IN1,IN2,IN6,IN10,IN14 (KPI bez target/baseline) |
| `sizing_present` | 3/15 | IN2,IN3,IN13 |
| `success_count` | 3/15 | IN1,IN2,IN3 (0 kryteriów sukcesu) |
| `html_entities` | 3/15 | IN1,IN2,IN3 (`&quot;` w polach) |
| `scope_out_mece` | 1/15 | IN11 |
| `lang_pl` | 1/15 | IN15 |

**Werdykt walidatorów:** ŻADNA z 25 kart nie przechodzi pełnego B3 (próg PASS ≥90/100 i 0 twardych FAIL — §B4). Najlepsze inicjatywy 20/22 (IN4,IN8,IN10,IN12); najsłabsze wnioski 10/15. **To NIE jest defekt modułu M10 jako kodu** — to jakość TREŚCI wygenerowanych kart (proza/structura), pokrywa się z `project_vts_card_audit` („NIE-GOTOWE"). Pełny dump: `/tmp/vts_card_audit_result.json`. Pozytyw strukturalny: `material_quality_complete` PASS 10/10 → kontrakt renderera (A6.2) jest dotrzymany na danych prod.

### 5.4 Wzorzec hubowy + stany

`InterviewHub` realizuje wzorzec Menu 1/2/3 + taby + dynamic tabs (zgodny). Tab `pending_review` celowo ukryty (`:2689`). Stany empty/loading/error obecne. Główne odstępstwo stanów: i18n (5.1, §27.R).

---

## FAZA 6 — BEZPIECZEŃSTWO

### 6.1 Trzy warstwy gatingu

- **Sidebar:** Interview = CORE/otwarty. W `src/utils/publicProduction.ts:4-6` `INTERVIEW` ∈ `PUBLIC_PRODUCTION_CORE_MENU_IDS` (nie blokowany na consultify.ai); nieobecny w closed-beta `betaAccess.ts`. ✅ zgodnie z założeniem (CORE).
- **Route:** `/discovery`→InterviewHub, montaż standardowy.
- **API:** `interview.routes.ts` — globalny middleware `apiAuthRateLimiter → verifyToken → requireOrgAccess() → demoContextMiddleware` (`:34-37`). Per-handler RBAC: `requirePermission`/`requireAnyPermission` (np. szablony `INTERVIEW_TEMPLATE_MANAGE`, przydziały `INTERVIEW_ASSIGN_MANAGE`, wnioski `INTERVIEW_INSIGHTS_*`). **Per-permission fallback dla admina — POTWIERDZONY działający** (admin ma template/assign/insight via fallback; zgodnie z `finding_interview_rbac_admin_gap` RESOLVED). ✅

> Uwaga arch.: `requireOrgAccess()` (`rbac.middleware.ts:211`) tylko WERYFIKUJE istnienie orgId na żądaniu — NIE scope'uje zapytań. Org-scope musi egzekwować każdy handler/serwis w klauzuli WHERE. Stąd kluczowy przegląd poniżej.

### 6.2 Org-scope na endpointach mutujących — przegląd

Sprawdzone handlery (controller `InterviewController.ts` 8647 l. + serwisy):

| Endpoint | Handler:linia | Org-scope | Werdykt |
|---|---|---|---|
| GET session | `getSession :2540` | `loadInterviewSessionForOrganization(org,id)` | ✅ |
| PATCH session | `updateSession :2658` | org-scoped load | ✅ |
| DELETE session | `deleteSession :2827` | `loadOrgScopedSessionForLifecycle(id,org)` przed delete | ✅ |
| POST sessions/bulk | `bulkSessionLifecycle :2863` | ids spoza org pomijane | ✅ |
| POST approve assign | `approveAssignment :3793` | `WHERE id=? AND organization_id=?` + gate policy | ✅ |
| POST send-back assign | `sendBackAssignment :3586` | org-scoped | ✅ |
| POST escalate assign | `escalateAssignment :4049` | org-scoped | ✅ |
| DELETE assignment | `deleteAssignment :4526` | org-scoped | ✅ |
| GET/USE/DELETE/PATCH template | `:4838/:4883/:5097/:5244` | `canAccessTemplate`/`canManageTemplate` (system=global by design, org=scoped, private=owner) | ✅ |
| POST create insight | `createInsight :7599` | sesje walidowane `WHERE … organization_id=?` (approved/completed) | ✅ |
| PATCH insight | `updateInsight :7791` | `UPDATE … WHERE id=? AND organization_id=?` | ✅ |
| POST regenerate insight | `regenerateInsight :7740` | jawny `SELECT org WHERE id=?` + 403-if-mismatch | ✅ |
| POST export insight | `exportInsight :7877` | load `WHERE id=? AND organization_id=?` | ✅ |
| GET/POST/DELETE insight comments + activity | `:8336/:8376/:8422/:8478` | jawny org-guard + 403 w KAŻDYM | ✅ |
| **GET insight** | **`getInsight :7588`** | **`getById(id)` — BRAK org** | 🔴 **IDOR** |
| **DELETE insight** | **`deleteInsight :7776`** | **`delete(id)` — BRAK org** | 🔴 **IDOR** |

Enterprise (`interview-enterprise.routes.ts`, 23 h.): wszystkie handlery przekazują `identity.orgId` do `interviewEnterpriseService`, a serwis konsekwentnie filtruje `WHERE organization_id=?` (segments/quotas/distributions/diagnostics/findings — `interviewEnterpriseService.ts:157,186,251,271,319,354,410,483,503,511,531`). Drobne: `createSegment` INSERT-uje `session_id` bez weryfikacji, że sesja należy do org — ale odczyty są org-scoped → co najwyżej sierota we własnym scope (P3, nie wyciek). Routes te NIE mają `requireOrgAccess()`, a `requireUser` dopuszcza orgId z nagłówka `x-organization-id`/`?organizationId` (z priorytetem `req.user.organizationId`) — P3 do uporządkowania.

**Bilans org-scope:** sprawdzono ~25 endpointów mutujących/czytających. **23 poprawnie org-scoped, 2 bez scope (getInsight, deleteInsight).**

### 6.3 CROSS-ORG IDOR — POTWIERDZONY (wątek systemowy audytu, znaleziony też w M01/M03)

**Korzeń:** `server/src/services/InterviewInsightService.ts`
- `getById(id) :1616` → `SELECT * FROM interview_insights WHERE id = ?` — bez `organization_id`.
- `delete(id)` → `DELETE FROM interview_insights WHERE id = ?` — bez `organization_id`.

Eksportowane jako `getById`/`deleteInsight` (`:2472`,`:2480`) i wołane bez org w `getInsight :7588` oraz `deleteInsight :7776`.

**Dowód intencjonalności luki:** SĄSIEDNIE handlery na tej samej encji (`regenerateInsight :7744-7755`, `getInsightActivity :8340-8351`, `getInsightComments :8380-8391`, `createInsightComment :8427-8438`, `deleteInsightComment :8482-8493`, `updateInsight`, `exportInsight`) WSZYSTKIE robią jawny `SELECT organization_id … WHERE id=?` + `403 Forbidden` przy niezgodności. Tylko `getInsight` i `deleteInsight` ten guard pominięto → luka przypadkowa, dobrze zlokalizowana.

**Impact:**
- `GET /interview/insights/:id` — dowolny zalogowany user (z `INTERVIEW_INSIGHTS_VIEW`) odczyta PEŁNY wniosek innej organizacji: executive_summary, themes/issues, evidence_map (cytaty z transkryptów wywiadów = dane wrażliwe PII). **Wyciek poufnych danych klienta cross-tenant.**
- `DELETE /interview/insights/:id` — user z `INTERVIEW_INSIGHTS_PUBLISH` USUNIE wniosek innej organizacji (utrata danych cross-tenant). Brak miękkiego undo (twardy `DELETE`).

### 6.4 Capabilities serwerowo

Approve/send-back/escalate/archive/restore przydziału, publish/delete szablonu, delete/publish wniosku — wszystkie chronione `requirePermission` na routach + (w przypadku approve) dodatkowy `evaluateGatePolicy({action:'APPROVE_INTERVIEW'})`. Capability-check jest serwerowy, nie tylko UI. ✅ (z zastrzeżeniem 6.3 — capability istnieje, ale brak org-scope na 2 insight-handlerach).

### 6.5 PII / sekrety w logach

Transkrypty (`interview_transcript`) i evidence-map zawierają dane wrażliwe. Logi M10 (`logInterviewInsightActivity`, `console.warn` np. `:3709,:4128`) logują ID/statusy/komunikaty kontrolne, NIE treść transkryptu/odpowiedzi. Nie znaleziono wycieku transkryptu/sekretu do logów. ✅ (P3: brak twardego audytu wszystkich ścieżek logujących — zalecany follow-up).

---

## FINDINGI (priorytetyzowane)

| # | Pri | Obszar | Opis | Dowód |
|---|---|---|---|---|
| SEC-1 | **P0** | Org-scope / IDOR | `getInsight` czyta wniosek dowolnej org (wyciek PII transkryptów cross-tenant) | `InterviewController.ts:7588` → `InterviewInsightService.ts:1616` |
| SEC-2 | **P0** | Org-scope / IDOR | `deleteInsight` usuwa wniosek dowolnej org (utrata danych cross-tenant, twardy delete) | `InterviewController.ts:7776` → `InterviewInsightService.ts` `delete(id)` |
| KAN-1 | **P1** | §27.F + §27.K | Status-chip hardcodowaną paletą `rose/amber` zamiast `EntityStatusChip`/`c.*` (wzorzec korupcji „rose"); czerwień na stanie workflow „Sent Back" | `InterviewHub.tsx:4772-4778, 8587, 8635, 8643` (21× `rose-*`) |
| KAN-2 | **P1** | §27.R i18n | Etykiety inline `{en,pl}` zamiast `useTranslation`; ~7 `t()` na 13,6k l. → hardcode rozsiany | `InterviewHub.tsx:4773` i in. |
| KAN-3 | **P1** | §27.A persist | Brak `persistKey` na 4 tabelach → szerokości/filtry/widoczność nie persystują | `InterviewHub.tsx` (0× persistKey) |
| KAN-4 | P2 | §27.P RC-5 | 5× surowy `<table>` (custom renderer w canonical layoutcie) | `:5043,6449,7524,9510,11305` |
| CARD-1 | P2 | CARD_CONTENT_FORMULA | 25/25 kart VTS prod nie przechodzi B3 (próg 90); dominują content_sections/len, raid_mix, depends_on, kpi_baseline_target — jakość TREŚCI, nie kodu | `vts-card-audit-validator.cjs` (live), `/tmp/vts_card_audit_result.json` |
| SEC-3 | P3 | Enterprise routes | Brak `requireOrgAccess()`; `requireUser` dopuszcza orgId z nagłówka/query; `createSegment` nie waliduje session∈org | `interview-enterprise.routes.ts:22-34, createSegment` |

---

## Pozytywy (do zachowania)
- A0 (preview/filtry/sort/resize/sticky) obecne na wszystkich 4 tabelach — brak blokujących braków A0.
- InsightViewer durable guard na `material_quality_json` — POTWIERDZONY (`:1532-1577`), `material_quality_complete` PASS 10/10 na prod.
- 23/25 endpointów poprawnie org-scoped; per-permission admin fallback działa; capability-checks serwerowe; gate policy na approve.
- Sąsiednie insight-handlery mają wzorcowy org-guard — wzór do skopiowania na SEC-1/SEC-2.
