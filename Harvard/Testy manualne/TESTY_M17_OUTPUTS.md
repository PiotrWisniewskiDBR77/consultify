# TESTY — M17 Outputs (Outputs Library)

> **Moduł:** M17 Outputs (`/presentations`, alias `/reports`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** pełne pokrycie E2E biblioteki artefaktów — rejestr (7 zakładek), trust-state (5 filarów), review/publish flow, bramka eksportu za aprobatą, lineage, akcje wierszowe, public share viewer, integracje cross-module (Canvas→Outputs, Inicjatywy→Outputs).
> **Cel:** agent piszący i testujący moduł ma na tej podstawie dogłębnie przetestować wszystkie ścieżki od UI przez Network aż do bazy — z weryfikacją kluczowej zależności `ENABLE_V8_GLOBAL` jako single point of failure.
> **Data:** 2026-06-16
> **Karta audytu:** `Harvard/modules/M17-outputs/KARTA_AUDYTU.md` (54/100 Alpha) · **Teczka:** `Harvard/wdrozenie-100/M17-outputs.md`

**Legenda:** **[MANUAL]** = wymaga ręcznej weryfikacji (przeglądarka incognito / bezpośredni URL / curl); **[FLAG]** = zależne od flagi środowiskowej lub roli; **[DB]** = dowód obejmuje wiersz/kolumnę w bazie danych.

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### 0.1 Mapa komponentów

| Warstwa | Komponent / Plik | Stan / Zależność |
|---|---|---|
| Shell hubowy | `ReportsAndPresentationsHub.tsx` | router: `/presentations` + `/reports`; 7 zakładek `RapTab` |
| Zakładki agregowane | `OutputsAggregateTabContent.tsx` | All / Mine / Needs review — `GET /api/artifacts?view=...` |
| Zakładki per-typ | `ReportsTabContent.tsx`, `PresentationsTabContent.tsx`, `SheetsTabContent.tsx`, `TemplatesTabContent.tsx` | `GET /api/artifacts?outputType=...` |
| Trust-state | `TrustStatePreviewSection.tsx` | 5 filarów z `ArtifactGovernanceSummary` |
| Hook danych | `useRapData.ts` (`useArtifactOutputsList`, `useReports`, `usePresentations`, `useSheetOutputs`, `useTemplates`, `useRapActions`) | fetch + mapowanie |
| Nawigacja | `artifactNavigation.ts` (`resolveArtifactOpenPath`) | kieruje do edytora natywnego |
| BE rejestr | `server/src/routes/artifacts.routes.ts` (29 endpointów) | `artifactRegistryService.ts` |
| BE export | `server/src/routes/report-builder.routes.ts` (93 endpointy) + `presentations.routes.ts` | quality-gate serwer |
| BE public | `presentations.routes.ts:624` — `GET /shared/:token` | `toPublicDeckRow()` — whitelist pól |
| BE Canvas | `work-canvas.routes.ts:4424` — `POST /drafts/:draftId/register-in-outputs` | `registerArtifactOrigin` |
| Flagi | `v8FeatureGate.middleware.ts` — `v8OutputsGate = createV8ModuleGate('outputs')` | `ENABLE_V8_GLOBAL=true` wymagane |
| Beta | `betaAccess.ts` — `MODULE_PRESENTATIONS: 'open'` | beta badge, dostęp **nieblokowany** |

### 0.2 ENABLE_V8_GLOBAL — single point of failure

**Kluczowa zasada:** cała biblioteka artefaktów (7 zakładek, trust-state, review/publish, eksport) stoi za flagą `ENABLE_V8_GLOBAL`. Bez niej każde wywołanie `GET /api/artifacts` zwraca `404 { error: "V8 features not available", code: "V8_DISABLED" }`. FE łapie ten błąd i wyświetla panel błędu z retry — **nie** niemą pustkę. Architektura gateowania:

```
Gateway.ts:746-747  →  v8FeatureGate (pre-auth, global ENABLE_V8_GLOBAL)
artifacts.routes.ts  →  verifyToken → requireV8OrgContext → v8OutputsGate (createV8ModuleGate('outputs'))
```

**Dwie warstwy bramki:** pre-auth sprawdza tylko `ENABLE_V8_GLOBAL`; post-auth sprawdza V8 dla orga. Na dev/staging bez ustawionych flag org możliwy implicit fallback (dev-only).

### 0.3 Trust-state — 5 filarów P18

Zdefiniowane w `TrustStatePreviewSection.tsx` i `ArtifactGovernanceSummary` w `types.ts`:

| # | Filar | Pole w governance | Wartości |
|---|-------|-------------------|----------|
| 1 | **Visibility** (widoczność) | `visibilityScope` | `private` / `project` / `organization` / `review_shared` / `demo` |
| 2 | **Validation** (walidacja) | `validationState` | `validated` / `pending` / `attention_required` |
| 3 | **Execution** (wykonanie) | `executionState` | `running` / `completed` / inne |
| 4 | **Review** (recenzja/publikacja) | `publishState` | `private_draft` / `reviewable_share` / `in_review` / `approved` / `published` |
| 5 | **Export ledger** (historia eksportów) | `exportHistory[]` | liczba eksportów + ostatni status |

Dodatkowo panel pokazuje: Lineage (originLinks + sourceRefs), Artifact ID, Execution run ID, Access control, Trust boundary (executionAuthority + reviewAuthority), Validation checks.

### 0.4 Bramka eksportu — dwie warstwy

| Warstwa | Gdzie | Co chroni | Obejście |
|---|---|---|---|
| **Quality-gate** (serwer) | `report-builder.routes.ts:180`, `presentations.routes.ts:1444` | gotowość techniczna (REPORT_NOT_READY 409, QUALITY_GATE_BLOCKED 422) | Brak — twarda |
| **Publish-approval** (UI tylko) | `OutputsAggregateTabContent.tsx:1000-1004` — `disabled` prop | `validationState` ∈ {pending, attention_required} LUB `publishState` ≠ private_draft → wyłącza przycisk | **L-01**: bezpośrednie API `curl` obchodzi (P2) |

Wyrażenie disable: `item.governance?.validationState === 'pending' || item.governance?.validationState === 'attention_required' || (!!item.governance?.publishState && item.governance.publishState !== 'private_draft')`.

### 0.5 Taksonomia zakładek (7)

```
RapTab: outputs_all | outputs_mine | outputs_review | outputs_documents | presentations | outputs_sheets | templates
```

Zakładki agregowane (All/Mine/Review) czytają `GET /api/artifacts?limit=200` (+ `view=mine`/`view=review`).
Zakładka Documents: `GET /api/artifacts?outputType=report&limit=200`.
Zakładka Presentations: `GET /api/artifacts?outputType=presentation&limit=200`.
Zakładka Sheets: `GET /api/artifacts?outputType=sheet&limit=200`.
Zakładka Templates: trzy równoległe requesty po typie + `artifactFamily=template`.

### 0.6 Zasada weryfikacji E2E

**Każdy test funkcjonalny MUSI być potwierdzony w zakładce Network DevTools.** Sama zmiana wyglądu przycisku lub listy to NIE dowód. Dowód = request + response HTTP lub wiersz w DB.

---

## Setup środowiska testowego

1. Uruchom dev server FE (port `:3000`) + BE (port `:3001`).
2. Zaloguj się jako **OWNER DBR77** (pełne prawa: review/publish + dostęp do beta modules).
3. Otwórz DevTools → **Network** (filtr: `artifacts`), **Console** (zero błędów = wymóg).
4. **[FLAG]** Przed testami §2–§7: ustaw `ENABLE_V8_GLOBAL=true` w środowisku BE i zrestartuj serwer. Weryfikacja: `curl localhost:3001/api/artifacts -H "Authorization: Bearer <token>"` zwraca 200 (nie 404).
5. Przygotuj drugie konto: **USER** (rola nieadmin) — do testów role-gating.
6. Miej pod ręką: istniejące artefakty w bazie (przynajmniej 1 dokument + 1 prezentacja), lub utwórz via Canvas → register-in-outputs.

---

## §1 ENABLE_V8_GLOBAL OFF — degradacja graceful [FLAG]

> **Cel:** upewnić się, że moduł bez flagi nie wysypuje błędów 500 ani białego ekranu — pokazuje panel błędu z retry.

### §1.1 Widok modułu przy wyłączonej fladze

**Przygotowanie:** wyłącz `ENABLE_V8_GLOBAL` w `.env` BE, zrestartuj.

1. Otwórz `/presentations` jako zalogowany OWNER.
2. **Asercja UI:** strona **nie** jest pusta (biały ekran = FAIL). Oczekiwany widok: panel błędu z komunikatem „failed to load" lub zbliżonym (nie dedykowane „moduł wyłączony" — to P3 L-08).
3. Sprawdź, że widoczny jest przycisk „Retry" lub odpowiednik.
4. **Asercja Network:** żadne wywołanie `GET /api/artifacts` **nie** zwróciło 200. Oczekiwane: 404 `{error: "V8 features not available", code: "V8_DISABLED"}`.
5. **Asercja Console:** zero błędów JS / uncaught exceptions. Dozwolone: ostrzeżenia sieciowe 404.

### §1.2 Przycisk Retry

1. W stanie §1.1 kliknij przycisk Retry (jeśli istnieje).
2. **Asercja:** ponowne wywołanie `GET /api/artifacts` w Network (nowy request).
3. Nadal 404 — panel błędu pozostaje (nie zapętla się w nieskończoność).
4. **Console:** zero nowych błędów.

### §1.3 Brak 500 na BE przy wyłączonej fladze [FLAG]

1. Wywołaj `curl -s localhost:3001/api/artifacts -H "Authorization: Bearer <token>"` z poprawnym tokenem.
2. **Asercja:** odpowiedź `404` z `code: "V8_DISABLED"` — **nie** 500.
3. Wywołaj też bez tokena → oczekiwane 401/403 (pre-auth gate).

### §1.4 Beta status modułu (informacyjny)

1. Sprawdź sidebar — przy MODULE_PRESENTATIONS beta status = `'open'` w `betaAccess.ts`.
2. **Asercja:** brak ikony kłódki, link nawigacyjny dostępny. (Moduł NIE jest `closed` w beta.)
3. Wejdź na `/presentations` bezpośrednim URL bez logowania → oczekiwane przekierowanie na login (nie 500).

---

## §2 ENABLE_V8_GLOBAL ON — rejestr artefaktów [FLAG]

> **Cel:** weryfikacja listy artefaktów, 7 zakładek, filtrowania, sortowania i widoków.

**Przygotowanie:** ustaw `ENABLE_V8_GLOBAL=true`, zrestartuj BE.

### §2.1 Ładowanie modułu i pierwsza zakładka (All)

1. Otwórz `/presentations`.
2. **Asercja Network:** `GET /api/artifacts?limit=200` z kodem 200. Sprawdź w response: `{ data: [...] }` — tablica obiektów.
3. **Asercja UI:** lista artefaktów wyświetlona w `FilterableTable` (kanoniczny komponent §27).
4. Każdy wiersz zawiera kolumny: Tytuł, Typ, Status, Właściciel, Visibility, Source, Review, Exports, Data.
5. Spinner ładowania widoczny przed pojawieniem się danych.
6. **Console:** zero błędów.

### §2.2 Zakładki taksonomii (7)

Dla każdej zakładki:

| Zakładka | ID | Oczekiwany endpoint |
|---|---|---|
| All | `outputs_all` | `GET /api/artifacts?limit=200` |
| Mine | `outputs_mine` | `GET /api/artifacts?limit=200&view=mine` |
| Needs review | `outputs_review` | `GET /api/artifacts?limit=200&view=review` |
| Documents | `outputs_documents` | `GET /api/artifacts?outputType=report&limit=200` |
| Presentations | `presentations` | `GET /api/artifacts?outputType=presentation&limit=200` |
| Sheets | `outputs_sheets` | `GET /api/artifacts?outputType=sheet&limit=200` |
| Templates | `templates` | 3× równoległe `GET /api/artifacts?...artifactFamily=template&outputType=...` |

**Kroki:** kliknij każdą zakładkę → sprawdź Network → sprawdź, że lista aktualizuje się.
**Asercja:** każde przełączenie → nowy request z właściwymi parametrami. Zero błędów 500.

### §2.3 Filtrowanie po typie artefaktu

1. W zakładce All → kliknij filtr kolumny „Typ".
2. Wybierz `document` → lista filtruje do wierszy `kind=document`.
3. Wybierz `presentation` → tylko prezentacje.
4. Wybierz `sheet` → tylko arkusze.
5. Usuń filtr → pełna lista.
6. **Asercja:** filtrowanie działa po stronie FE (bez dodatkowego API request — dane są w `filteredData`).

### §2.4 Filtrowanie po statusie

1. Kliknij filtr kolumny „Status" → dostępne opcje: `draft`, `generated`, `editing`, `ready`, `exported`, `shared`, `archived`.
2. Wybierz `ready` → lista filtruje.
3. **Asercja:** kolory statusów: draft=`bg-slate-400`, editing=`bg-amber-400`, ready=`bg-emerald-400` — sprawdź brak hardkodowanych hex (L-07, P2).

### §2.5 Filtrowanie po visibility

1. Kliknij filtr „Visibility" (kolumna `visibilityScope`).
2. Sprawdź dostępność opcji: `private`, `project`, `organization`, `review_shared`, `demo`.
3. Wybierz `organization` → lista filtruje.

### §2.6 Filtrowanie po publishState (Review)

1. W zakładce `outputs_review` (Needs review) — sprawdź, czy lista zawiera tylko artefakty z odpowiednim `view=review`.
2. Opcjonalnie: filtr kolumny Review.

### §2.7 Sortowanie po dacie

1. Kliknij nagłówek kolumny „Data" (jest `sortable: true`).
2. **Asercja:** lista sortuje się rosnąco/malejąco.
3. **Ważne: L-06 P3** — sortowanie **nie** jest persystowane po reloadzie. Sprawdź: przeładuj stronę → sortowanie reset. Odnotuj jako KNOWN ISSUE.

### §2.8 Widok siatki vs lista

1. Sprawdź, czy Hub ma przełącznik `viewMode` (table/grid).
2. Kliknij ikony grid/table.
3. **Asercja:** lista przełącza między `FilterableTable` (wiersze) a `GridView` (kafelki).
4. **Console:** zero błędów przy przełączaniu.

### §2.9 Pusty stan (brak artefaktów)

1. Użyj konta / organizacji bez żadnych artefaktów LUB zakładki „Mine" jako nowy user.
2. **Asercja UI:** wyświetlony komunikat `emptyMessage` = "Brak outputów" (lub EN: "No outputs").
3. **Asercja:** brak białego ekranu, brak spinnera w nieskończoność.

### §2.10 E2E — struktura response GET /api/artifacts [FLAG][DB]

1. Otwórz Network → znajdź `GET /api/artifacts?limit=200` → skopiuj response.
2. **Asercja struktury:** `{ data: [ { artifact_id, title, output_type, status, organization_id, ... } ] }`.
3. **Asercja org-scope:** każdy element w `data` ma `organization_id` = orgId zalogowanego usera. Zero wierszy z innej org.
4. **[DB]** Opcjonalnie: sprawdź w bazie `SELECT artifact_id, organization_id FROM v8_output_artifacts LIMIT 5` — tylko wiersze własnej org.

### §2.11 Deep-link ?tab= i ?artifactId=

1. Otwórz `/presentations?tab=templates` → **asercja**: otwiera się zakładka Templates.
2. Otwórz `/presentations?tab=outputs_mine` → zakładka Mine.
3. Otwórz `/presentations?artifactId=<id>` (gdzie `<id>` = istniejący artyfakt) → **asercja**: panel preview artefaktu otwarty po prawej.
4. Stary format `?deck=<id>` → **asercja**: automatyczne przepisanie na `?artifactId=<id>` (redirect replace — sprawdź w URL bar).

---

## §3 Trust-state — 5 filarów P18

> **Cel:** weryfikacja, że każdy z 5 filarów trust-state jest wyświetlany poprawnie w panelu preview artefaktu oraz że badge'e mają właściwe kolory semantyczne.

### §3.1 Otwieranie panelu preview

1. Kliknij wiersz artefaktu w zakładce All → panel preview pojawia się po prawej stronie (`TableWithPreviewLayout`).
2. **Asercja:** widoczna sekcja „Trust state" (nagłówek uppercase, `text-[10px]`).
3. Panel zawiera 5 wierszy filarów + dodatkowe pola (Lineage, Artifact ID, Execution run, itd.).

### §3.2 Filar 1 — Visibility

1. Sprawdź wiersz „Visibility" w panelu preview.
2. **Asercja badge:** dla `organization` → chip niebieski (`bg-blue-500`); dla `private` → szary (`bg-slate-400`); dla `review_shared` → bursztynowy (`bg-amber-500`).
3. Tekst badge wyświetla display-name (np. „Organization" zamiast `organization`).

### §3.3 Filar 2 — Validation

1. Sprawdź wiersz „Validation" w panelu preview.
2. **Asercja badge:** `validated` → zielony (`bg-emerald-500`); `pending` → bursztynowy (`bg-amber-500`); `attention_required` → różowy/rose (`bg-rose-500`).
3. Test artefaktu ze stanem `pending` — badge amber z etykietą „Pending".
4. Test artefaktu ze stanem `attention_required` — badge rose z etykietą „Attention Required".

### §3.4 Filar 3 — Execution

1. Sprawdź wiersz „Execution" w panelu preview.
2. **Asercja:** `running` → chip niebieski; `completed` → zielony.
3. Jeśli `executionRunId` jest ustawione — pojawia się przycisk „Trace".
4. Kliknij „Trace" → **asercja**: wywoływane `onTrace({executionRunId, lineagePaths})`. Sprawdź Console/Network, czy jest wywołanie lub akcja UI (np. modal lineage).

### §3.5 Filar 4 — Review (publishState)

1. Sprawdź wiersz „Review" w panelu preview.
2. **Asercja badge:** `private_draft` → szary; `in_review` → bursztynowy; `approved` → zielony; `published` → niebieski.
3. Jeśli `reviewGateCount > 0` — wyświetlana jest liczba w nawiasach `(N gates)`.

### §3.6 Filar 5 — Export ledger (historia eksportów)

1. Sprawdź wiersz „Export trace" w panelu preview.
2. **Asercja:** dla artefaktu bez eksportów — „—". Dla artefaktu z eksportami — `"N · <ostatni status>"` (np. „2 · Completed").
3. Sprawdź sekcję Exports — jeśli `exportFormats` niepuste → wyświetla formaty uppercase (np. „PDF, PPTX").

### §3.7 Lineage

1. Sprawdź wiersz „Lineage" w panelu preview.
2. **Asercja:** jeśli `originLinks.length > 0` → wyświetla `"N origins"` lub `"N origins · M sources"`.
3. Jeśli brak → „—".

### §3.8 Trust boundary i Access control

1. Sprawdź wiersz „Trust boundary" — wyświetla: `"Execution: Execution spine · Review: Artifact review"` (wg TRUST_AUTHORITY_LABELS).
2. Sprawdź „Access control" — `canManageAccess=true` → „Can manage"; `false` → „Read only"; brak → „—".

### §3.9 Filtrowanie po trust-state (publishState) [FLAG]

1. W zakładce All — kliknij filtr kolumny „Review".
2. Wybierz artefakty `in_review` → lista filtruje.
3. **Asercja:** filteredData zawiera tylko artefakty z `governance.publishState === 'in_review'`.

### §3.10 E2E — payload trust-state [FLAG]

1. Kliknij wiersz artefaktu → Network: `GET /api/artifacts/<id>` lub analogiczny endpoint.
2. **Asercja response:** zawiera obiekt `governance` z polami: `visibilityScope`, `validationState`, `executionState`, `publishState`, `exportHistory`, `originLinks`, `originSummary`.
3. **Sprawdź, że `organization_id` NIE jest ujawniane w odpowiedzi publicznej** — tylko w autentycznym endpointcie.

---

## §4 Promote / rejestracja artefaktu — 5 typów encji + 3 ścieżki

> **Cel:** weryfikacja, że artefakt może być zarejestrowany w Outputs Library z różnych źródeł (Canvas, studia) oraz że `buildActionTargetPayload` kieruje do właściwego edytora.

### §4.1 Typy encji — identyfikacja z kodu

Z `artifacts.routes.ts:buildActionTargetPayload` — 5 typów `originRuntime`:
1. **`report`** → openPath: `/reports/builder/<id>`; exportPath: `/api/report-builder/<id>/export/pdf`
2. **`presentation`** → openPath: `/presentations/builder/<id>`; exportPath: `/api/presentations/decks/<id>/download`
3. **`report_template`** → openPath: `/reports/builder?tab=templates&templateArtifactId=<id>&edit=true`
4. **`presentation_template`** → openPath: `/presentations/wizard?templateArtifactId=<id>`
5. **`sheet`** → openPath: `null`; exportPath: `/api/table-platform/tables/<id>/export/xlsx`
6. **`native_artifact`** (Canvas) → authority: `artifact_registry`; openPath: z governance.openPath

### §4.2 Akcja „Otwórz" (resolveArtifactOpenPath) — 3 originRuntime

Dla każdego dostępnego artefaktu w liście:

**Typ report:**
1. Kliknij dwukrotnie wiersz artefaktu `kind=document` (lub akcja „Otwórz" w Menu 1/2/3).
2. **Asercja:** nawigacja do `/reports/builder/<originRecordId>`.
3. **Network:** `GET /api/artifacts/<id>/action-target` → response zawiera `openPath: "/reports/builder/<id>"`.

**Typ presentation:**
1. Kliknij akcję Otwórz na artefakcie `kind=presentation`.
2. **Asercja:** nawigacja do `/presentations/builder/<originRecordId>`.

**Typ sheet:**
1. Kliknij akcję Otwórz na artefakcie `kind=sheet`.
2. **Asercja:** `resolveArtifactOpenPath` dla sheet = `getArtifactPath('sheet', id)`. Sprawdź dokąd nawiguje (Tabele Studio lub Workspace).

### §4.3 Rejestracja z Canvas → Outputs [MANUAL][FLAG]

> Wymaga działającego Canvas z istniejącym draftem.

1. Otwórz Canvas (`/work-canvas` lub split-view w chacie).
2. Utwórz lub otwórz draft z treścią.
3. Wywołaj akcję „Register in Outputs" (Canvas → przycisk lub menu).
4. **Asercja Network:** `POST /work-canvas/drafts/<draftId>/register-in-outputs` → 200.
5. **Asercja response:** `{ readBack: { target: "outputs_library", artifactId: "...", status: "registered" } }`.
6. Przejdź do `/presentations` → zakładka All.
7. **Asercja:** nowy artefakt widoczny na liście z `sourceType=work_canvas`.
8. **[DB]** Opcjonalnie: `SELECT * FROM v8_output_artifacts WHERE origin_runtime='native_artifact' ORDER BY created_at DESC LIMIT 1` → wiersz istnieje.

### §4.4 Akcje wierszowe — Menu 1/2/3

Dla artefaktu z `kind=document` lub `kind=presentation` sprawdź dostępne akcje:

1. Hover nad wierszem → pojawia się Menu akcji.
2. Dostępne pozycje: Otwórz, Podgląd, Discuss (Teresa), Save as template, Eksport PDF/PPTX, Archiwizuj.
3. **Akcja „Discuss (Teresa)":** kliknij → otwiera chat z kontekstem artefaktu (sprawdź URL lub stan chatu).
4. **Akcja „Save as template":** kliknij → dialog nazwy szablonu. Wypełnij nazwę. Kliknij Zapisz. **Asercja Network:** `POST /api/artifacts/<id>/save-as-template` → 201. Response: `{ data: { artifactId: "...", artifactFamily: "template" } }`.
5. **[DB]** Sprawdź, że nowy artyfakt pojawia się w zakładce Templates.

### §4.5 Akcja „Archiwizuj" [FLAG]

1. Kliknij akcję Archiwizuj dla wybranego artefaktu.
2. **Asercja:** modal potwierdzenia (jeśli istnieje) lub bezpośrednia akcja.
3. **Asercja Network:** `PATCH /api/artifacts/<id>` lub dedykowany endpoint archiwizacji → 200.
4. **Asercja UI:** artefakt znika z zakładek All/Mine; pojawia się w zakładce ze statusem `archived` (lub filtrem archived).

### §4.6 Duplicate do Draft [FLAG]

1. Sprawdź, czy istnieje akcja „Duplicate" / „Utwórz kopię" dla artefaktu.
2. Jeśli tak: kliknij → **Asercja Network:** wywołanie `duplicateArtifactToCanvasDraft` (`/work-canvas/drafts` lub podobny).
3. Nowy draft z kopiowaną treścią artefaktu.

### §4.7 Registry C7 — weryfikacja rejestracji w v8_output_artifacts [DB]

1. Utwórz nowy artefakt przez Canvas register-in-outputs (§4.3).
2. **[DB]** Query: `SELECT artifact_id, output_type, artifact_family, origin_runtime, origin_record_id, organization_id, visibility_scope FROM v8_output_artifacts WHERE origin_runtime='native_artifact' ORDER BY created_at DESC LIMIT 1`.
3. **Asercja:** `output_type='report'`, `artifact_family='document'`, `origin_runtime='native_artifact'`, `organization_id` = orgId zalogowanego usera.
4. Sprawdź `origin_links` w `v8_artifact_origin_links` — wiersz z `origin_runtime='native_artifact'`, `origin_record_id=<draftId>`.

### §4.8 E2E — endpoint /api/artifacts/:id/action-target [FLAG]

1. Wybierz artefakt z `artifactId` z listy.
2. **Network:** `GET /api/artifacts/<artifactId>/action-target` → 200.
3. **Asercja response struktury:**
```json
{
  "artifactId": "...",
  "originRuntime": "report|presentation|sheet|native_artifact|...",
  "originRecordId": "...",
  "openPath": "/reports/builder/<id>",
  "exportPath": "/api/report-builder/<id>/export/pdf",
  "deletePath": "...",
  "reviewPath": "/api/artifacts/<id>/start-review",
  "authority": "report_builder|presentations_runtime|..."
}
```

---

## §5 Bramka eksportu za aprobatą

> **Cel:** weryfikacja dwuwarstwowej bramki — UI disable + quality-gate serwer (uwaga L-01: publish-approval jest tylko UI).

### §5.1 Export — artefakt z validationState=pending (UI gate)

1. Znajdź lub utwórz artefakt z `governance.validationState === 'pending'`.
2. Kliknij wiersz → panel preview.
3. **Asercja UI:** przycisk „Start review" (lub przycisk eksportu jeśli widoczny) jest **wyłączony** (`disabled`, `opacity-50`, `cursor-not-allowed`).
4. Wyrażenie disable: `validationState === 'pending' || validationState === 'attention_required' || (!!publishState && publishState !== 'private_draft')`.
5. **Asercja:** hover nad disabled przyciskiem — żadna akcja nie uruchamia się.

### §5.2 Export — artefakt z publishState=draft (UI gate FE)

1. Znajdź artefakt z `governance.publishState === 'in_review'` lub `'reviewable_share'`.
2. **Asercja UI:** przycisk Start review wyłączony (bo `publishState !== 'private_draft'`).
3. Sprawdź akcję eksportu (jeśli dostępna w menu wiersza) — przycisk eksportu powinien być wyłączony.

### §5.3 Export — artefakt approved (eksport dostępny)

1. Znajdź artefakt z `governance.publishState === 'approved'` lub `'published'`.
2. **Asercja UI:** przycisk eksportu **aktywny**.
3. Kliknij eksport PDF (lub PPTX).
4. **Asercja Network:** `GET /api/report-builder/<id>/export/pdf` lub `GET /api/presentations/decks/<id>/download` → 200 lub 202 (pending generation).
5. Plik pobierany przez przeglądarkę.

### §5.4 Quality-gate serwer — eksport niedojrzałego artefaktu [FLAG]

1. Wywołaj export bezpośrednio przez API (curl/fetch) dla artefaktu, który **nie jest technicznie gotowy**:
```bash
curl -X GET "localhost:3001/api/report-builder/<id>/export/pdf" \
  -H "Authorization: Bearer <token>"
```
2. **Asercja:** odpowiedź `409 REPORT_NOT_READY_FOR_EXPORT` lub `422 QUALITY_GATE_BLOCKED`.
3. **Asercja:** NIE 200 — serwer nie pozwala na eksport.

### §5.5 [MANUAL] L-01 — obejście publish-approval przez bezpośredni API [FLAG]

> **Uwaga:** To jest znany P2 — testujemy obecny stan dla udokumentowania luki.

1. Znajdź artefakt z `publishState='draft'` (nie-approved) ale `validationState='validated'` (quality OK).
2. Sprawdź `exportPath` z `/api/artifacts/<id>/action-target`.
3. Wywołaj bezpośrednio endpoint eksportu z curl:
```bash
curl -X GET "localhost:3001<exportPath>" -H "Authorization: Bearer <token>"
```
4. **Asercja obecnego stanu (L-01):** jeśli quality OK, serwer **zwraca 200** (nie blokuje). To jest znana luka P2 — publish-approval jest tylko UI.
5. **Odnotuj:** FAIL jako znana luka L-01, nie błąd krytyczny (org-scope i quality nadal chronią).

### §5.6 E2E — approval workflow (Approve & Publish dla template) [FLAG]

> Ten flow dotyczy szablonów (artifactFamily=template). Dla zwykłych artefaktów review flow w §6.

1. W zakładce Templates — wybierz szablon w stanie `draft`.
2. Kliknij akcję „Publish" lub „Approve & Publish" (role-gated: tylko ADMIN/OWNER).
3. **Asercja Network (krok 1 — start-review):** `POST /api/artifacts/<id>/start-review` → 200 `{ data: { publishState: "reviewable_share" } }`.
4. **Asercja Network (krok 2 — publish):** `POST /api/artifacts/<id>/publish` → 200 `{ data: { publishState: "published" } }`.
5. **Asercja UI:** zakładka Templates → szablon ma status `published`, widoczność `organization`.
6. **[DB]** `SELECT publish_state, visibility_scope FROM v8_output_artifacts WHERE artifact_id='<id>'` → `publish_state='published'`, `visibility_scope='organization'`.

### §5.7 Role-gating publish — tylko ADMIN/OWNER [FLAG]

1. Zaloguj się jako USER (rola zwykła, nie ADMIN/OWNER).
2. Spróbuj wykonać `POST /api/artifacts/<id>/publish` bezpośrednio.
3. **Asercja:** odpowiedź `403 "Only admins/owners can publish organization templates"`.
4. UI: jeśli przycisk Publish widoczny dla non-admin → FAIL (brak role-gating na froncie).

---

## §6 Review i Publish

> **Cel:** pełna weryfikacja start-review → approve → publish flow z asercjami UI + Network + DB.

### §6.1 Start Review — przycisk w preview

1. Kliknij artefakt z `publishState='private_draft'` i `validationState='validated'`.
2. W panelu preview → kliknij przycisk **„Start review"** (aktywny).
3. **Asercja Network:** `POST /api/artifacts/<artifactId>/start-review` → 200.
4. **Asercja response:** `{ data: { publishState: "reviewable_share", ... } }`.
5. **Asercja UI po sukcesie:** przycisk Start review staje się disabled (publishState zmieniony); odśwież listę → artefakt ma nowy stan review.
6. **[DB]** `SELECT publish_state FROM v8_output_artifacts WHERE artifact_id='<id>'` → `reviewable_share` lub `in_review`.

### §6.2 Start Review — walidacja prerequisite (validationState musi być validated)

1. Kliknij artefakt z `validationState='pending'`.
2. **Asercja UI:** przycisk „Start review" wyłączony (disabled).
3. Bezpośrednie API: `POST /api/artifacts/<id>/start-review`.
4. **Asercja:** odpowiedź `409 "cannot enter review before artifact validation passes"` (z kodu `artifacts.routes.ts:798`).

### §6.3 Template review — auto-assign adminów jako reviewers [FLAG]

1. Utwórz lub znajdź szablon org-scope (`template.scope='org'`).
2. Wywołaj `POST /api/artifacts/<id>/start-review` bez ciała `reviewers`.
3. **Asercja (kod `artifacts.routes.ts:750`):** serwer automatycznie przypisuje ADMIN/OWNER org jako reviewerów.
4. **Asercja response:** `{ data: { ..., reviewers: ["user_id_1", "user_id_2"] } }`.

### §6.4 Rollback posture — V8_TEMPLATES_REVIEW_ENABLED=false [FLAG]

1. Tymczasowo ustaw `V8_TEMPLATES_REVIEW_ENABLED=false` w env BE.
2. Wywołaj `POST /api/artifacts/<id>/start-review` dla szablonu.
3. **Asercja:** odpowiedź `503 "Template review is temporarily disabled (rollback posture)"`.
4. Przywróć flagę po teście.

### §6.5 Publish — pełny flow dla szablonu org-scope [FLAG]

Kontynuacja §6.1 (artefakt w stanie `reviewable_share` lub `in_review`):

1. Zalogowany jako ADMIN/OWNER.
2. `POST /api/artifacts/<id>/publish` z body `{ "reviewType": "peer_review" }`.
3. **Asercja sequence stanów (kod `artifacts.routes.ts:1075-1084`):**
   - Jeśli `currentState=reviewable_share` → przejście do `in_review` automatycznie.
   - Następnie: `submitReviewGate` z `result='approved'`.
   - Następnie: `transitionPublishState` do `approved` → `published`.
4. **Asercja final response:** `publishState='published'`, `visibilityScope='organization'`.
5. **[DB]** `SELECT publish_state, visibility_scope, last_transition_at FROM v8_output_artifacts WHERE artifact_id='<id>'`.
6. **Asercja UI:** szablon pojawia się w Templates z statusem `active`, widoczność `organization`.

### §6.6 Publish — błąd gdy brak publish record [FLAG]

1. Wywołaj `POST /api/artifacts/<id>/publish` dla artefaktu, który NIE miał `start-review`.
2. **Asercja:** `409 "Publish record missing. Start review first."`.

### §6.7 Publish — tylko org-scope templates [FLAG]

1. Spróbuj opublikować artefakt z `template.scope='user'` (nie org).
2. **Asercja:** `409 "Only organization/system templates can be published."`.

### §6.8 Rollback posture — V8_TEMPLATES_PUBLISH_ENABLED=false [FLAG]

1. Ustaw `V8_TEMPLATES_PUBLISH_ENABLED=false`.
2. `POST /api/artifacts/<id>/publish`.
3. **Asercja:** `503 "Template publishing is temporarily disabled"`.

### §6.9 Wycofanie publikacji / unpublish

1. Sprawdź, czy istnieje akcja unpublish/wycofania publikacji w UI (menu wiersza lub panel).
2. Jeśli tak: kliknij → **Asercja Network:** endpoint archive lub status-change.
3. Jeśli brak: odnotuj jako brak funkcji (nie bug — MVP może nie mieć unpublish).

### §6.10 Audit trail review akcji

1. Po wykonaniu start-review lub publish — sprawdź Network: wywołanie `req.emitAuditEvent` skutkuje logiem audytowym.
2. **[DB]** Opcjonalnie: `SELECT * FROM audit_events WHERE resource_id='<artifactId>' ORDER BY created_at DESC LIMIT 3` → wiersze `action='start_review'` lub `action='publish'`.

---

## §7 Lineage (historia i provenance)

> **Cel:** weryfikacja, że panel preview artefaktu poprawnie wyświetla historię pochodzenia, links i powiązania.

### §7.1 Wyświetlenie lineage w panelu preview

1. Kliknij artefakt — panel preview.
2. Sekcja trust-state → wiersz „Lineage".
3. **Asercja:** jeśli artefakt ma `originLinks` → `"N origins"` lub `"N origins · M sources"` (gdzie N/M > 0).
4. Jeśli brak — `"—"`.

### §7.2 Identyfikacja źródeł — wiersz Source

1. Sprawdź wiersz „Source" w panelu preview.
2. **Asercja:** wyświetla `originSummary.type` sformatowany (np. „Work Canvas" dla `work_canvas`, „Report Builder" dla `report`).

### §7.3 Przyciski trace — lineagePaths [FLAG]

1. Dla artefaktu z `executionRunId` → widoczny przycisk „Trace".
2. Kliknij „Trace" → **Asercja:** wywoływane `onTrace({executionRunId, lineagePaths})`.
3. `lineagePaths` zawiera: `runPath`, `toolUsagePath`, `outputsPath`.
4. Sprawdź, czy nawigacja do ścieżek linku jest dostępna (modal lub nowa zakładka).

### §7.4 Origin links — endpoint [FLAG]

1. **Network:** `GET /api/artifacts/<id>` z rozbudowanym trust payload (wywołanie z preview).
2. **Asercja response:** pole `governance.originLinks` = tablica obiektów `{ linkId, originRuntime, originRecordId, isPrimaryOrigin }`.
3. **[DB]** `SELECT * FROM v8_artifact_origin_links WHERE artifact_id='<id>'` → odpowiada tablicy w response.

### §7.5 Lineage Canvas → Outputs (end-to-end)

1. Zarejestruj Canvas draft w Outputs (§4.3).
2. W Outputs Library kliknij nowy artefakt → panel preview → lineage.
3. **Asercja:** `Source = "Work Canvas"` (z `originSummary.sourceType='work_canvas'`).
4. **Asercja:** `originLinks` zawiera rekord z `originRuntime='native_artifact'`.

---

## §8 Public Share Viewer (`/presentations/shared/:token`) [MANUAL][FLAG]

> **Cel:** weryfikacja, że publiczny widok nie ujawnia wrażliwych danych (P1 naprawiony w `1b67579d7a`).

### §8.1 Dostęp bez autentykacji

1. Znajdź `share_token` dla decku z `presentation_decks` (lub utwórz share link przez DeckBuilder).
2. Otwórz `/presentations/shared/<token>` **bez logowania** (incognito lub wyloguj).
3. **Asercja UI:** widoczne slajdy prezentacji.
4. **Asercja Network:** `GET /api/presentations/shared/<token>` → 200 `{ success: true, data: {...} }`.

### §8.2 Sanityzacja danych — brak PII organizacyjnych [MANUAL][FLAG]

1. Sprawdź response `GET /api/presentations/shared/<token>` w Network.
2. **Asercja (fix `1b67579d7a`):** response **NIE zawiera**: `organization_id`, `confidentiality`, `share_token`, `share_created_by`, `created_by`, `updated_by`.
3. `PUBLIC_DECK_DENY_FIELDS` = `{organization_id, confidentiality, share_token, share_created_by, created_by, updated_by}` — sprawdź każde pole.
4. **Asercja pozytywna:** response zawiera dane slajdów (`deck_json`), tytuł, metadane prezentacji.

### §8.3 Wygasły token → 404

1. Użyj wygasłego lub nieistniejącego tokena.
2. **Asercja:** `404 "Shared presentation not found"` — NIE 410 (brak revoke, L-03 P2 — odnotuj jako KNOWN ISSUE).

### §8.4 Rate-limiting (L-03) [MANUAL][FLAG]

1. Wywołaj >30 requestów/minutę na `/api/presentations/shared/<token>` (np. przez curl w pętli).
2. **Asercja obecnego stanu (L-03):** brak rate-limitu → wszystkie zapytania 200. Odnotuj jako KNOWN ISSUE P2.
3. Porównaj z `/api/public/artifacts/:token` (Canvas public) — ma 30/min limit.

---

## §9 Cross-module

### §9.1 M02 Canvas → M17 Outputs

Omówiony w §4.3. Weryfikacja pełna:
1. Canvas draft z treścią → register-in-outputs.
2. Outputs Library → widoczny nowy artefakt.
3. Kliknij „Otwórz" → wraca do Canvas draftu (ścieżka przez `resolveArtifactOpenPath` → `openPath` z governance lub `getArtifactPath`).

### §9.2 M13 Inicjatywy → M17 Outputs

1. Otwórz inicjatywę w `/initiatives`.
2. Sprawdź, czy panel inicjatywy zawiera sekcję „Outputs" lub „Artefakty".
3. Jeśli tak: kliknij artefakt → **Asercja Network:** `GET /api/artifacts?sourceInitiativeId=<id>&limit=N`.
4. Przejdź do linku → otwiera M17 Outputs Library z filtrem `sourceInitiativeId`.

### §9.3 M19 Prezentacje → M17 Outputs

1. Otwórz prezentację w DeckBuilder (`/presentations/builder/<id>`).
2. Sprawdź, czy widoczna jest opcja „Zarejestruj w Outputs" lub artefakt jest automatycznie synchronizowany.
3. W Outputs Library → zakładka Presentations → artefakt widoczny.
4. **Asercja:** `originRuntime='presentation'`, `openPath='/presentations/builder/<id>'`.

### §9.4 M17 → Eksport (PDF, DOCX, PPTX)

1. Kliknij akcję eksportu dla artefaktu `kind=document` → sprawdź flow (§5.3).
2. Kliknij akcję eksportu dla artefaktu `kind=presentation` (PPTX).
3. Kliknij akcję eksportu dla artefaktu `kind=sheet` (XLSX) — `exportPath='/api/table-platform/tables/<id>/export/xlsx'`.
4. **Asercja:** każdy eksport wywołuje właściwy endpoint, plik pobierany lub toast o generowaniu.

### §9.5 Teresa → Outputs (ENABLE_DELIVERABLES_LIGHT) [FLAG]

1. Ustaw `ENABLE_DELIVERABLES_LIGHT=true` + `VITE_ENABLE_DELIVERABLES_LIGHT=true`.
2. W chacie Teresa wygeneruj deliverable (deck/dokument).
3. **Asercja Network:** event `deliverables:draft-ready` lub `metadata.deliverable` w payload chatu.
4. W Outputs Library → nowy artefakt widoczny (zarejestrowany przez event handler).
5. Jeśli flaga OFF — artefakt **nie** pojawia się w Outputs Library (oczekiwane, nie błąd).

---

## §10 Mapa epików — ZERO niepokrytych

| Epik (teczka) | Sekcja testów | Status pokrycia |
|---|---|---|
| E1 — Bramka aprobaty serwerowo (L-01, P2) | §5.5 (L-01 MANUAL), §5.4 (quality-gate) | pokryty (L-01 = KNOWN ISSUE) |
| E2 — Bezpieczeństwo: beta-guard (L-02) | §10.1 niżej | pokryty |
| E2 — Bezpieczeństwo: rate-limit share (L-03) | §8.4 | pokryty (KNOWN ISSUE) |
| E2 — Bezpieczeństwo: public viewer sanityzacja | §8.2 | pokryty (NAPRAWIONY) |
| E3 — Fix testów (L-04/L-05) | §11 regresja | informacyjny |
| E4 — Kanony §27: persistKey (L-06) | §10.2 niżej | pokryty (KNOWN ISSUE) |
| E4 — Kanony §27: EntityStatusChip (L-07) | §10.3 niżej | pokryty (KNOWN ISSUE) |
| E4 — Baner v8 OFF (L-08) | §1.1 | pokryty (KNOWN ISSUE) |
| E4 — i18n 96× isPolish (L-09) | §10.4 niżej | pokryty |
| E1/E2 — Org-scope rejestr (brak IDOR) | §2.10 | pokryty |
| S1 lista z rejestru | §2.1 | pokryty |
| S2 filtry+liczniki | §2.3–2.6 | pokryty |
| S3 bramka eksportu | §5.1–5.5 | pokryty |
| S4 review/publish | §6.1–6.10 | pokryty |
| S5 trust-state 5 filarów | §3.1–3.10 | pokryty |
| S6 akcje wierszowe | §4.2–4.5 | pokryty |
| S7 public share viewer | §8.1–8.4 | pokryty |

---

## §10 Przekrojowe

### §10.1 Beta-guard — direct URL bez logowania [MANUAL][FLAG]

> **L-02:** Beta-lock dla M17 jest tylko nawigacyjny — direct URL może ominąć sidebar plate.

1. Wyloguj się z aplikacji.
2. Otwórz `/presentations` w przeglądarce.
3. **Asercja:** przekierowanie na login (oczekiwane — brak auth) — nie 500, nie pusta strona.
4. Zaloguj się jako USER zwykły (nie ADMIN).
5. Wejdź na `/presentations` bezpośrednio.
6. **Asercja (L-02):** moduł dostępny (bo beta status = `'open'`, nie `'closed'`). Sidebar badge beta widoczny.
7. **Uwaga:** M17 aktualnie NIE jest `closed` w betaAccess.ts (MODULE_PRESENTATIONS: 'open'). Beta-guard route dotyczy bardziej hipotetycznego scenariusza zamknięcia. Odnotuj stan.

### §10.2 Persistencja szerokości kolumn — brak persistKey (L-06) [FLAG]

1. Zmień szerokość kolumny w `FilterableTable` (drag kolumny, jeśli UI to obsługuje).
2. Przeładuj stronę.
3. **Asercja (L-06 KNOWN ISSUE P3):** szerokości resetują się do domyślnych. Odnotuj jako zidentyfikowaną lukę.
4. Sprawdź: wywołanie `FilterableTable` w `OutputsAggregateTabContent.tsx:1020` — brak prop `persistKey`.

### §10.3 EntityStatusChip (L-07) — hardkodowane kolory [FLAG]

1. Sprawdź kolumny Status i Typ w liście artefaktów.
2. **Asercja (L-07 KNOWN ISSUE P2):** kolory statusów wyświetlane jako surowe klasy Tailwind (`bg-slate-400`, `bg-emerald-400`, `bg-amber-400`) w DOM — **brak** komponentu `EntityStatusChip`.
3. Inspekcja DOM: `<span>` z klasami kolorów zamiast chipa.
4. Odnotuj jako zidentyfikowaną lukę do refaktoryzacji.

### §10.4 i18n — PL / EN

1. Zmień język na angielski (ustawienia aplikacji lub `localStorage.i18nextLng='en'`).
2. Odśwież `/presentations`.
3. **Asercja:** wszystkie etykiety w angielskim (zakładki All/Mine/Needs review, kolumny Title/Status/Owner, przyciski Start review/Export).
4. Zmień na polski.
5. **Asercja:** etykiety po polsku (gdzie klucz i18n istnieje).
6. **Znana luka (L-09):** 96× `isPolish ? 'PL' : 'EN'` inline zamiast `t()` — niektóre etykiety mogą nie reagować na zmianę języka. Odnotuj wszystkie przypadki.

### §10.5 Dark mode

1. Przełącz na dark mode.
2. **Asercja:** tło listy ciemne, tekst jasny; badge trust-state zachowują swoje warianty (`dark:text-emerald-300`, `dark:text-amber-300`); brak białych prostokątów na ciemnym tle.
3. Panel preview po prawej — tło ciemne, tekst czytelny.

### §10.6 Persistencja — reload

1. Przejdź do `/presentations` → kliknij zakładkę `templates`.
2. Przeładuj stronę.
3. **Asercja:** zakładka może resetować się do `outputs_all` lub `presentations` (initial tab z URL/pathname). Sprawdź `parseRapTabFromQuery` + `?tab=` query param.
4. Otwórz `/presentations?tab=templates` → przeładuj → **asercja**: pozostaje na zakładce templates (deep link działa).

### §10.7 A11y (dostępność)

1. Sprawdź `aria-label` na przyciskach eksportu i akcji wierszowych.
2. Nawigacja klawiaturą po liście artefaktów (Tab, Enter).
3. Panel preview — dostępny klawiaturowo.
4. **Asercja:** brak pułapki fokusa (focus trap nie blokuje powrotu).

### §10.8 Zero błędów w konsoli

1. Przejdź przez wszystkie 7 zakładek.
2. Otwórz kilka artefaktów w preview.
3. Wykonaj Start review na jednym artefakcie.
4. **Asercja:** Console — zero `Error`, zero `Uncaught`, zero failed network requests (poza oczekiwanymi 404 przy v8 OFF).

### §10.9 Brak cross-org IDOR [FLAG]

1. Jeśli dostępne dwa konta w różnych organizacjach:
2. Pobierz `artifactId` artefaktu z Org A.
3. Wywołaj `GET /api/artifacts/<artifactId>` jako user z Org B.
4. **Asercja:** odpowiedź `404` — nie ujawnia danych Org A.
5. Pula dostępna: `:1891,1944` w `artifactRegistryService.ts` — `WHERE organization_id=?`.

---

## §11 Testy automatyczne (regresja)

### §11.1 Uruchomienie istniejącej suity

```bash
cd server
npx jest --testPathPattern="artifact" --verbose 2>&1 | tail -40
```

**Oczekiwany wynik (znany stan):** 330 PASS / 30 FAIL (harness defects):
- 1 FAIL: mock-drift react-i18next (T1)
- 25 FAIL: stale testy middleware `v8FeatureGate.middleware.test.ts` (T2, D-01)
- 4 FAIL: fixture gap `tp_tables` (T3)

**Asercja:** nie ma nowych FAIL poza wskazanymi 30. Wszelkie dodatkowe FAIL → raportuj z plikiem i linią.

### §11.2 Znane FAIL — weryfikacja root cause

1. Uruchom tylko stale testy middleware:
```bash
npx jest --testPathPattern="v8FeatureGate.middleware.test" --verbose
```
2. **Asercja:** FAIL z `res.status is not a function` — zgadza się z opisem T2.
3. Odnotuj jako decyzja otwarta (D-01): „skasować czy przywrócić hardening cofnięty w 9b794bb7f0?".

### §11.3 Brakujący test serwer — bramka eksportu publish-approval (L-04)

1. Sprawdź, czy istnieje test: `export draft artifact → 403`.
2. **Asercja:** NIE istnieje (luka T4 — brak testu serwerowego bramki aprobaty).
3. Odnotuj jako P0-test do dodania.

---

## §12 Format raportu + Definition of Done

### Format raportu

Dla każdego punktu testowego podaj:
- **Kroki:** (numerowana lista)
- **Oczekiwane:** (konkretna asercja)
- **Faktyczne:** (obserwowany wynik)
- **Status:** PASS / FAIL / KNOWN ISSUE / N/A
- **Dowód:** screenshot UI + zrzut Network (request + response) + [DB] wiersz gdzie wskazano

Dla FAIL: `plik:linia`, opis przyczyny, priorytet (P0/P1/P2/P3), propozycja fixu.
Dla KNOWN ISSUE: wskaż numer luci (L-01..L-09) z `Harvard/wdrozenie-100/M17-outputs.md`.

### Definition of Done

- [ ] 1. §1 — V8 OFF degraduje graceful (panel błędu, nie biały ekran, zero 500) PASS
- [ ] 2. §2 — 7 zakładek ładuje właściwe dane z `/api/artifacts` PASS; filtry i sortowanie działają
- [ ] 3. §3 — 5 filarów trust-state wyświetlonych z właściwymi kolorami badge i etykietami PASS
- [ ] 4. §4 — Canvas → Outputs register-in-outputs PASS (Network + DB wiersz)
- [ ] 5. §5 — quality-gate serwer blokuje eksport niedojrzałego artefaktu (409/422) PASS; L-01 udokumentowany
- [ ] 6. §6 — start-review → publish flow dla template PASS (Network + DB publishState='published')
- [ ] 7. §7 — lineage wyświetlony poprawnie w preview PASS
- [ ] 8. §8 — public viewer bez organization_id / confidentiality w response PASS (fix 1b67579d7a potwierdzony)
- [ ] 9. §9 — cross-module Canvas→M17 i M19→M17 ścieżki działają
- [ ] 10. §10.9 — zero cross-org IDOR (odpowiedź 404 dla obcego artifactId) PASS
- [ ] 11. §11 — suita automatyczna: nie więcej niż 30 FAIL (brak nowych regresji)
- [ ] 12. Zero błędów w konsoli JS przez cały czas testów
- [ ] 13. PL i EN — etykiety zmieniają się przy zmianie języka (poza znane L-09 inline)
- [ ] 14. Dark mode — brak artefaktów wizualnych (białe prostokąty, nieczytelny tekst) PASS
- [ ] 15. KNOWN ISSUES udokumentowane: L-01 (publish-approval FE-only), L-03 (brak rate-limit share), L-06 (brak persistKey), L-07 (brak EntityStatusChip), L-08 (generyczny komunikat v8 OFF), L-09 (isPolish inline)

---

*Specyfikacja pokrywa 7 epiki (E1–E4), 7 scenariuszy krytycznych (S1–S7), 29 endpointów BE, 5 filarów trust-state, 6 typów originRuntime, ścieżki cross-module Canvas/Inicjatywy/Prezentacje/Eksport. Kluczowa zależność: `ENABLE_V8_GLOBAL` musi być ustawiona przed testami §2–§9.*
