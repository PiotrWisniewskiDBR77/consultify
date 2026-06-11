# M13 — Inicjatywy — Dowód Faz 5+6 (KANON+SEC)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `bfdb999147`) · **Agent:** KANON+SEC · **Tryb:** READ-ONLY
**Zakres:** wyłącznie sekcja „MODUŁ: INICJATYWY" z `INV_D` (poz. 1–19).
**Wejścia kanonów:** `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` §27 (A–S), `docs/standards/CARD_CONTENT_FORMULA.md`, `docs/initiatives/INITIATIVE_FORMULA.md`.

---

# FAZA 5 — KANONY

## 5.1 §27 TABLE_AND_PREVIEW_CANON — tabela „Portfolio inicjatyw"

**Powierzchnia:** widok `viewMode==='table'` → `PortfolioListView`
(`src/components/Portfolio/PortfolioListView.tsx`), opakowany w `TableWithPreviewLayout`
(`InitiativesHub.tsx:1465-1497`). Preview = `InitiativePreviewV3Body/Footer`.

**Ustalenie architektoniczne:** to **ręczna `<table>`** (`PortfolioListView.tsx:398`), nie
`FilterableTable`. Komentarz w pliku przyznaje to świadomie (`PortfolioListView.tsx:79-85`).
Per §2 / §27.A „tymczasowo dozwolone, jeśli spełnia A–S wizualnie" — więc audytuję A–S na powierzchni.

### Tabela §27 A–S (powierzchnia: Portfolio inicjatyw)

| Pkt | Kryterium | Wynik | Dowód / odstępstwo |
|---|---|---|---|
| **A0** Preview JEST | single-click → boczny preview | PASS | `InitiativesHub.tsx:1468-1495` (TableWithPreviewLayout + renderPreview) |
| **A0** Cross-module draft zostaje w źródle | draft nie wyrzuca do modułu | N/A | Portfolio = moduł docelowy; źródłem jest Wywiad (poza zakresem tej tabeli) |
| **A0** Filtry kolumn SĄ | lejek status/priorytet/owner | PASS | `PortfolioListView.tsx:220-268, 379-390` (FilterDropdown: status, priority, owner) |
| **A0** Sort JEST | klik nagłówka + chevron | PASS | `PortfolioListView.tsx:309-314, 350-357` (name/status/priority/plannedEndDate/updatedAt) |
| **A0** Resize JEST | drag granicy kolumn | **FAIL (P1)** | `table-fixed` + sztywne `w-*` (`:398, 410-432`); `resizable:false` w ColumnDef (`:226,242,263`). Brak zero-sum resize. |
| **A0** Sticky header JEST | `position:sticky` | PASS | `PortfolioListView.tsx:399` (`sticky top-0 z-10`) |
| **A0** Popover „widoczne kolumny" | portalowy TableSettingsPopover | **FAIL (P1)** | Brak. Zero `Settings2`/`TableSettingsPopover`. Brak modelu hide/show kolumn → brak persistencji widoczności (§6/§16). |
| **A0** Kebab ⋮ z treścią | dół ≥2, góra kontekst | CZĘŚĆ. (P1) | `RowActionsMenu` jest (`:598-702`); DÓŁ = Open·(Open full)·Edit·Archive·Delay (OK). **GÓRA kontekst PUSTA we wszystkich statusach** (`:604-608 actions:[]`) — narusza §9 (góra ma się różnić per status: DRAFT→„Wyślij do przeglądu", PENDING→„Zatwierdź"). |
| **A0** Pasek bulk z akcjami | ≥1 akcja poza Clear | PASS (w Menu 3) | bulk w hubie `InitiativesHub.tsx` (selectedIds→Menu 3); „AI: Analizuj zaznaczenie" `:1816` |
| **A0** Stany empty/loading/error | nie blank | CZĘŚĆ. (P2) | Empty JEST (`:711-715`), ale **1 wariant** (brak rozróżnienia „brak danych" vs „brak dla filtra", §10/§22). Loading/Error obsłużone w hubie, nie w tabeli. |
| **A** SSOT komponentu | FilterableTable | **FAIL (P1, świadome)** | ręczna `<table>` `:398`; nie FilterableTable. Reużywa prymitywy chipów (plus). |
| **A** persistKey | filtry+sort persyst. | PASS | `persistKey="initiatives.portfolio"` (`:478`); zapis filtrów+sortu `:93-112, 185-187` |
| **A** brak StatusPill/statusColors | chipy c.* | PASS | import z `chips` (`:30-35`); brak StatusPill |
| **E** Nagłówek typografia | 11px uppercase slate-500 | PASS | `PortfolioListView.tsx:367` |
| **E** Wyrównanie wg roli | tytuł L / chipy L+kropka / liczby R | PASS (z uwagą) | tytuł L, status/priority L; brak kolumn liczbowych. Wszystkie `<th>` `text-left` `:366`. |
| **F** Status = EntityStatusChip | statusChipTone→c.* | **CZĘŚĆ. (P2)** | Status renderowany jako `<select>` z **kropką sygnałową** `statusChipTone()` (`:440-441, 478-480`) — kolor poprawny (c.*), ale to inline-editor, **nie `EntityStatusChip`**. Świadome (edycja inline statusu w wierszu). |
| **F** Priority chip | PriorityChip | PASS | `:507-508` |
| **F** Termin = jedna kolumna DueChip | nie DUE+OVERDUE | PASS | `:539-548` (jeden DueChip) |
| **F** Puste komórki `—` | nie blank | PASS | `:510, 534, 547, 580, 586` |
| **G** Wiersz monochrom., selected accent | brak tła statusu | PASS | `:450-454` (selected = `bg-primary-500/8` + inset 4px) |
| **H** Kebab 3 strefy | góra/dół/danger | CZĘŚĆ. (P1) | dół+danger OK; góra pusta (j.w.). Delete/Archive/Restore/Delay = `disabled „Wkrótce (backend)"` (`:641-697`) — slot widoczny (OK §9), ale **brak realnych endpointów Delete/Delay** w UI tej tabeli. |
| **I** Preview anatomia | header/details/AI/relations/actions | PASS (oddz. audyt KOD) | `InitiativePreviewV3` body+footer; status preview = neutralny slate-pill `:109-112` (nie EntityStatusChip — dopuszczalne, neutral) |
| **K** Kolory sygnałowe | brak biało-czerwieni | PASS | health-dot przez `getHealthInfo` (helper); status-dot c.* |
| **O** Filtry/sort/resize | — | patrz A0 (resize FAIL) | — |
| **R** i18n PL/EN | useTranslation | PASS | wszystkie etykiety `t(...)` `:409-431` |
| **S** Bramki/dowód | tsc/dowód wizualny | N/A (ten agent) | dowód wizualny = Faza 4 (inny agent) |

### Wzorzec korupcji „rose" (hardkodowane palety status-chip)
- **Tabela Portfolio:** CZYSTA. Status przez `statusChipTone()` (c.*), nie rose. ✅
- **Reszta modułu Inicjatywy — SKAŻONA (P2, poza tabelą Portfolio):**
  - `InitiativeFullView.tsx` — kilkanaście hardkodów `bg-blue-500/20`, `text-rose-400`,
    `bg-rose-600` (`:84,108,113-114,394,401,538-540,549,795,834,1030,1143,1193`).
  - `InitiativeDrawer.tsx:301` — własny `getStatusColor()` + `bg-blue/rose` (`:493,623-652,817`).
  - `InitiativeConflictsPanel.tsx:27-28` — `bg-rose-500/15` (komponent = MARTWY KOD, INV poz.19).
  - `InitiativesHub.tsx:169` `text-blue-500 bg-blue-500/10`; error-state `:1293-1301` rose (akceptowalne — to alarm).
  - `InitiativeScrollView.tsx:320` — `bg-rose-500/10` dla criticalRaids (semantycznie OK = alarm).
  - **GridView (kafle) — CZYSTY:** `InitiativeGridCard.tsx:18,165-167` używa `EntityStatusChip`. ✅

**Werdykt §27:** Tabela Portfolio = **funkcjonalnie kompletna ale z odstępstwami P1**: brak
resize, brak popover widoczności kolumn, ręczna `<table>` zamiast FilterableTable, pusta strefa
kontekstowa kebaba (statyczna we wszystkich statusach), status jako `<select>` zamiast EntityStatusChip.
Skażenie „rose"/hardkodów statusu **NIE w tabeli Portfolio**, lecz w widokach pełnej karty/drawera (P2).

---

## 5.2 CARD_CONTENT_FORMULA — walidatory na próbce inicjatyw

**Walidator:** `docs/qa/runs/2026-06-10/vts-card-audit-validator.cjs` (§B3) — uruchomiony live na
prod DB, `organization_id='vts'`. **Próbka: 15 inicjatyw** (≥5 wymagane) + 10 wniosków kontekstowo.
Wynik pełny: `/tmp/vts_card_audit_result.json`.

### Inicjatywy (15) — macierz FAIL (walidator §B3)
| Walidator | FAIL / 15 | Karty |
|---|---|---|
| `raid_mix` (R≥2∧A≥1∧D≥1, każdy z prob+impact+mitigation) | **11/15** | IN1,IN2,IN3,IN5,IN6,IN8,IN9,IN11,IN13,IN14,IN15 (głównie: 1 RAID niekompletny — brak mitigation/prob/impact) |
| `depends_on` (zależności w tabeli `initiative_dependencies`) | **13/15** | wszystkie poza IN10,IN15 — **0 zależności w DB** (portfel nie-MECE w warstwie relacji) |
| `description_len` (400–750 słów) | 7/15 | IN1,IN4,IN7,IN9,IN10,IN12,IN15 (przekroczenie, np. 782–840 słów) |
| `kpi_baseline_target` | 5/15 | IN1,IN2,IN6,IN10,IN14 (KPI bez targetu lub bez baseline/„do ustalenia") |
| `sizing_present` | 3/15 | IN2,IN3,IN13 |
| `success_count` (≥4) | 3/15 | IN1,IN2,IN3 |
| `summary_len` (40–90 słów) | 2/15 | IN7(92),IN9(98) |
| `html_entities` (encje HTML w prozie) | 3/15 | IN1,IN2,IN3 (`&quot;`/`&amp;` — defekt zapisu) |
| `lang_pl` (0 EN-prozy) | 1/15 | IN15 |
| `scope_out_mece` | 1/15 | IN11 |

**Najlepsze karty:** IN4/IN5/IN8/IN10/IN12 (20/22 PASS). **Najsłabsze:** IN1 (16/22), IN2 (16/22).
Średnia ~18,9/22 PASS na walidatorach maszynowych → **żadna karta nie osiąga progu „komplet"** §B3
(każda ma ≥1 twardy FAIL). Dominujące systemowe braki: **RAID niekompletny** (brak miksu/mitigation)
i **brak `depends_on`** (graf zależności portfela pusty mimo zakładki Analysis/graf zależności, INV poz.6).

### Wnioski (10, kontekstowo) — 10–13/15 PASS; nie były przedmiotem M13, raportowane informacyjnie.

**Werdykt formuły:** treść inicjatyw VTS jest blisko standardu, ale **walidatory §B3 nie przechodzą
na żadnej karcie** — głównie `raid_mix` (11/15) i `depends_on` (13/15). To dług treści/danych, nie kodu;
nie blokuje tieru kodowego, ale `material/RAID` niekompletność dotykała w przeszłości crashy rendererów
(por. `finding_interview_material_quality_crash`). `html_entities` na IN1–IN3 = realny defekt zapisu/escapingu.

---

# FAZA 6 — BEZPIECZEŃSTWO

## 6.1 Trzy warstwy gatingu

| Warstwa | Stan | Dowód |
|---|---|---|
| **Sidebar** | Inicjatywy CORE (otwarte, public prod) | INV preambuła; brak beta-locka na module |
| **Route (FE)** | brak beta-guarda (CORE) | — |
| **API (BE)** główny router | `apiAuthRateLimiter` + `verifyToken` + `requireOrgAccess()` + `demoContextMiddleware` | `pmo/initiatives.routes.ts:88-95`; mount `Gateway.ts:459` (`gatewayVerifyToken` + `trialEntryGuard`) |
| **API (BE)** additive | `verifyToken` + `requireOrgAccess()` | `initiatives-additive.routes.ts:37-38`; mount `Gateway.ts:464` |
| **API (BE)** governance (v4) | **TYLKO `verifyToken`** — BRAK `requireOrgAccess()` | `initiative-governance.routes.ts:14`; mount `Gateway.ts:906` (`/api/initiatives-v4`) **bez `gatewayVerifyToken` ani `trialEntryGuard`** |

### Blokada pilota (VTS) — egzekwowana serwerowo? **NIE (P1).**
- Cała blokada tworzenia/bulk jest **wyłącznie po stronie klienta**: `isPilotParticipantRole(currentUser?.role)`
  w `InitiativesHub.tsx:54,197` bramkuje przyciski/modale (`:572,847,868,968,1082,1214-1218,1330,1735,1986`).
- Serwer **nie ma żadnego gatingu pilota**: `grep pilot` w `InitiativeController.ts` i
  `pmo/initiatives.routes.ts` → 0 trafień. `createInitiative` (`:537-545`) sprawdza tylko `orgId`.
- **Skutek:** pilot VTS może obejść blokadę bezpośrednim wywołaniem `POST /api/initiatives`
  (oraz bulk/generator) — UI-only lock.

## 6.2 Org-scope na endpointach — przegląd (cross-org IDOR = potwierdzony wątek systemowy)

**Pochodzenie org:** główny router + additive biorą `req.user.organizationId` (token), nigdy z URL —
**poprawnie** (`InitiativeController.ts:512,734,1133...`; `initiatives-additive.routes.ts:40-43`).

### Sprawdzone endpointy GET/PATCH/DELETE/status/governance

| Plik / handler | Wzorzec scope | Werdykt |
|---|---|---|
| `InitiativeController.getInitiativeById` | `getInitiativeDetailRead(id, orgId)` → `WHERE id=? AND organization_id=?` (`:157`) | ✅ scoped |
| `updateInitiative` (PUT/PATCH) | guard SELECT `id=? AND organization_id=?` (`:743,987`) | ✅ |
| `updateInitiativeStatus` + submit/approve/reject/block/unblock/complete/move/archive | każdy: SELECT `... organization_id=?` PRZED UPDATE `WHERE id=?` (`:2815,2890,2938,2985,3149,3221`) | ✅ guard-then-mutate |
| `deleteMilestone`/`updateMilestone` | JOIN initiatives `i.organization_id=?` przed mutacją (`:3640-3645,3716-3722`) | ✅ |
| `deleteStakeholder`/`deleteWatcher` | JOIN `i.organization_id=?` (`:4760-4765,4880+`) | ✅ |
| KPI/RAID/budget/tools/resources/comments (sub-zasoby) | wzorzec verify-in-org (próbka spójna) | ✅ (spot-check) |
| `initiatives-additive` (suggested-changes, propose) | `initiativeExistsInOrg()` + serwis z `organizationId` (`:46-52,89,127`) | ✅ wzorcowe |
| `initiative-governance` **goals/initiatives link** | — | **❌ IDOR P0** |
| `initiative-governance` **decisions link** | — | **❌ IDOR P0** |

**Łącznie:** ~30+ by-id endpointów sprawdzonych; **wszystkie w głównym kontrolerze + additive są
org-scoped**. **Bez scope: 5 metod serwisu governance.**

### Potwierdzony cross-org IDOR (governance v4) — P0
`server/src/services/initiativeGovernanceService.ts` — metody przyjmujące `goalId`/`initiativeId`/
`decisionId` z URL **bez żadnego parametru `orgId`**, zapytania bez filtra org:
- `linkGoalToInitiative(goalId, initiativeId)` `:119-128` — INSERT do `goal_initiative_links` bez org-checku.
  Route: `POST /api/initiatives-v4/goals/:goalId/initiatives` (`routes:100-121`).
- `getGoalInitiatives(goalId)` `:130-138` — SELECT bez org. Route `GET .../goals/:goalId/initiatives` (`:123-132`).
- `unlinkGoalFromInitiative(goalId, initiativeId)` `:184-190` — DELETE bez org. Route `DELETE .../goals/:goalId/initiatives/:initiativeId` (`:134-146`).
- `linkDecisionToInitiative(initiativeId, decisionId)` `:540-549` — INSERT do `initiative_decision_links` bez org. Route `POST .../initiatives/:initiativeId/decisions` (`:287-308`).
- `getInitiativeDecisions(initiativeId)` `:551-559` — SELECT bez org. Route `GET .../initiatives/:initiativeId/decisions` (`:310-319`).

**Atak:** użytkownik org B podaje `goalId`/`initiativeId`/`decisionId` org A → odczyt powiązań,
wpięcie/odpięcie celu-inicjatywy, wpięcie decyzji do cudzej inicjatywy. **Wzorzec poprawny istniał**
(`getGoalRollup` `:140-159` filtruje `i.organization_id=$2`) ale **nie zastosowano** w metodach link/get.

### Drugi wektor — spoofowalne org w governance — P1
`requireUser()` (`initiative-governance.routes.ts:18-22`) przyjmuje org z nagłówka
`x-organization-id` i query `?organizationId=` jako fallback. Router **nie ma `requireOrgAccess()`**,
a mount `/api/initiatives-v4` (`Gateway.ts:906`) **nie ma `gatewayVerifyToken`**. To pozwala
podstawić dowolny org dla metod, które org używają (goals create/get/update, gates) — łączy się z IDOR.

### Gate methods — uwaga P2
`createGovernanceGate(orgId, {initiativeId})` `:432-459` zapisuje gate pod org **wołającego** bez
weryfikacji, że `initiativeId` należy do org (gate-osierocony, niski wpływ). `getGovernanceGates`/
`evaluateGate` są poprawnie scoped (`:461-477`).

## 6.3 Capabilities serwerowo (archive / status / bulk / governance approve)
- **Status/archive transitions:** egzekwowane przez guard statusu + org (`updateInitiativeStatus` itd.),
  ale **brak kontroli ról/uprawnień capability** (np. kto może approve) na poziomie route — `requireOrgRole('user')`
  to minimalny próg; aprobata gate'u/approve inicjatywy nie wymaga osobnego capability poza org-membership.
- **Bulk:** brak osobnego serwerowego endpointu bulk z capability — bulk realizowany per-rekord przez FE.
- **Pilot capability:** brak (patrz 6.1) — P1.

## 6.4 PII / sekrety w logach
- Nie stwierdzono logowania tokenów/sekretów w przejrzanych ścieżkach inicjatyw.
- Walidator §B3 łączy się z **prod DB** (`.env.local DATABASE_URL`) — to narzędzie audytowe, nie runtime;
  poza zakresem runtime-loga, ale warto trzymać poza CI bez sekretów.

---

# TOP FINDINGI BEZPIECZEŃSTWA

- **[P0]** Cross-org IDOR w governance v4 (`initiativeGovernanceService.ts`): `linkGoalToInitiative`,
  `getGoalInitiatives`, `unlinkGoalFromInitiative`, `linkDecisionToInitiative`, `getInitiativeDecisions`
  — brak filtra `organization_id`. Odczyt/zapis powiązań cel↔inicjatywa i decyzja↔inicjatywa między orgami.
- **[P1]** Brak `requireOrgAccess()` na routerze governance + spoofowalny org (`x-organization-id`/query)
  + mount `/api/initiatives-v4` bez `gatewayVerifyToken` (`Gateway.ts:906`).
- **[P1]** Blokada pilota VTS **tylko po stronie klienta** — `POST /api/initiatives`/bulk/generator
  obchodzą plate; serwer nie ma gatingu pilota.
- **[P2]** `createGovernanceGate` nie weryfikuje, że `initiativeId` należy do org (gate-osierocony).
- **[P2]** Brak osobnych capability serwerowych dla approve/transition (tylko `requireOrgRole('user')`).

# TOP ODSTĘPSTWA §27 (KANON)
- **[P1]** Tabela Portfolio: brak resize kolumn + brak portalowego popover „widoczne kolumny"; ręczna `<table>` zamiast FilterableTable.
- **[P1]** Kebab: strefa kontekstowa (GÓRA) pusta/statyczna we wszystkich statusach (narusza §9 — góra ma się różnić per status).
- **[P2]** Status w tabeli jako `<select>` zamiast `EntityStatusChip` (kolor c.* OK); empty-state 1-wariantowy.
- **[P2]** Hardkodowane palety `rose`/`blue` w `InitiativeFullView`/`InitiativeDrawer`/`InitiativeConflictsPanel` (poza tabelą Portfolio; ConflictsPanel = martwy kod).

# WYNIK WALIDATORÓW FORMUŁY
15 inicjatyw VTS: **0/15 przechodzi komplet §B3.** Dominujące FAIL: `raid_mix` 11/15, `depends_on` 13/15,
`description_len` 7/15, `kpi_baseline_target` 5/15, `html_entities` 3/15. Najlepsze 20/22, najsłabsze 16/22.

**Ścieżka pliku:** `Harvard/modules/M13-inicjatywy/evidence/f56_kanon_sec.md`
