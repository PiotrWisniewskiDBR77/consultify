# Plan testów — SERIA T (Template engine), program „Generatory Deliverable" (fala W3)

> **Status:** plan QA (manual + Playwright). Dokument NIE modyfikuje kodu.
> **Autor:** QA. **Data:** 2026-06-22. **Branch kontekstowy:** `feat/deliverables-w1`.
> **Zakres:** T1 (model + persystencja), T2 (biblioteka DBR77), T3 (user-created CRUD), T4 (Teresa-proponuje).

---

## 0. Rekonesans potwierdzony w kodzie (SSOT dla tego planu)

Wszystkie poniższe fakty zostały zweryfikowane bezpośrednio w repo (nie z pamięci/dokumentów). Liczby linii odnoszą się do stanu na 2026-06-22.

### 0.1 Unified template API

**Plik routera:** `server/src/routes/deliverableTemplates.routes.ts`
**Mount:** `server/src/Gateway.ts:884` → `app.use('/api/deliverables', deliverableTemplatesRoutes);`
**Middleware na CAŁYM routerze:** `router.use(verifyToken)` + `router.use(requireOrgAccess())` (linie 33–34). Czyli **każdy** request bez ważnego Bearer tokena = 401, a bez dostępu do org = blokada z `requireOrgAccess`.

**`getOrgId(req)`** (linia 36) = `req.user.organizationId || req.user.organization_id || ''` — org pochodzi z JWT, nie z body. To jest fundament org-scope: klient NIE może podać cudzego `organization_id`.

**Słownik typów (KLUCZOWE):** `VALID_TYPES = { 'doc', 'deck', 'table' }` (linia 44). To jest vocabular API.
- `doc` → tabela `report_builder_templates`
- `deck` → tabela `presentation_templates`
- `table` → tabela `tp_base_templates`
- **UWAGA:** UI w `OutputsLauncherModal` mówi „Report / Presentation / Table" — to etykiety prezentacyjne. API żąda `doc|deck|table`. W testach API używaj `doc|deck|table`.

Endpointy (zweryfikowane):

| Metoda | Ścieżka | Walidacja / kontrakt | Sukces | Błędy |
|---|---|---|---|---|
| GET | `/api/deliverables/templates?type=` | `type ∈ {doc,deck,table}` (linia 49) | `200 { templates: [...] }` | `400 { error: "Invalid type. Must be doc\|deck\|table." }`; `500 { error: "Failed to load templates" }` |
| POST | `/api/deliverables/templates` | body `{ type, name, description?, meta? }`; `type` wymagany+valid (74); `name` non-empty (78), ≤200 zn. (82) | `201 { template }` | `400` (invalid type / name); `500 { error: "Failed to create template" }` |
| GET | `/api/deliverables/templates/:id` | org-scope w `getDeliverableTemplate(id, orgId)` | `200 { template }` | `404 { error: "Template not found" }`; `500` |
| PUT | `/api/deliverables/templates/:id` | body `{ name?, description?, meta? }`; jeśli `name` podane → non-empty (127), ≤200 (131) | `200 { template }` | `403 { error: <TemplateForbiddenError.message> }` (145); `404 { error: <TemplateNotFoundError.message> }` (149); `400`; `500` |
| DELETE | `/api/deliverables/templates/:id` | org-scope | `204` (brak body) | `404 { error: "Template not found" }` (gdy `deleted===false`, 202); `403 { error: <TemplateForbiddenError.message> }` (208); `500` |
| POST | `/api/deliverables/templates/suggest` | body `{ intent, type, useLlm? }`; `intent` non-empty (166), ≤1000 (170); `type` valid (174); `useLlm` boolean jeśli podane (178) | `200 { suggestion: TemplateSuggestion \| null }` | `400` (walidacja); **NIGDY 500** — fail-open: błąd serwisu → `200 { suggestion: null }` (192–194) |

**WAŻNE dla T1-S04 / T3-S05 (cross-org 403):**
403 NIE pochodzi z hardkodowanego stringa „Cross-org". Pochodzi z `TemplateForbiddenError` rzucanego przez serwis (`updateDeliverableTemplate` / `deleteDeliverableTemplate`), a router mapuje go na `403` z `err.message` (linie 145–147, 208–210). **WYMAGA potwierdzenia treści message** w serwisie (patrz „Selektory/Endpointy do potwierdzenia" w T1). Asercja powinna sprawdzać `status === 403`, a treść message traktować jako miękką (zawiera/regex), nie literalną.

**Kształt `suggestion`** (do potwierdzenia w serwisie `suggestTemplate`, patrz blok T4): wg rekonesansu `{ templateId, confidence: 'high'|'medium'|'low', reasoning }`. Asercje muszą tolerować `null` (fail-open + brak dopasowania).

### 0.2 UI — `OutputsLauncherModal`

**Plik:** `src/components/ReportsAndPresentations/OutputsLauncherModal.tsx`

- Modal 2-krokowy. **Krok 1** = wybór typu (Report / Presentation / Table). **Krok 2** = galeria szablonów + input sugestii Teresy.
- Krok 2 — kuratorowane szablony (hardkodowane per typ):
  - Report (`doc`): `blank`, `audit-report`, `exec-memo`
  - Presentation (`deck`): `blank`, `board-deck`, `diagnostic`
  - Table (`table`): `blank`, `risk-register`, `kpi-dashboard`
- Karty szablonów: `<button>` z `aria-label={tpl.name}` (lub i18n label dla Blank). **BRAK `data-testid`** → **WYMAGA dodania test-id** (rekomendacja: `data-testid="launcher-template-{id}"`).
- Kafelki typu (krok 1): `<button>` z `aria-label={label}`. **BRAK `data-testid`** → **WYMAGA dodania test-id** (`data-testid="launcher-type-{doc|deck|table}"`).
- Input sugestii Teresy: `placeholder="Describe what you need…"` (i18n key `rap.outputs.launcher.suggestPlaceholder`), `maxLength=1000`. **BRAK `data-testid`** → **WYMAGA** (`data-testid="launcher-suggest-input"`).
- Przycisk: label „Teresa suggests" (i18n `rap.outputs.launcher.suggestBtn`), `aria-label` = ten sam string, `disabled` podczas ładowania. **BRAK `data-testid`** → **WYMAGA** (`data-testid="launcher-suggest-btn"`).
- Wynik sugestii: pojawia się gdy `suggestion!==null && !loading`; zawiera label „Teresa recommends", `templateId`, `confidence`, `reasoning` oraz przycisk „Use this template". **BRAK `data-testid`** → **WYMAGA** (`data-testid="launcher-suggest-result"`, `data-testid="launcher-suggest-accept"`).

### 0.3 Flaga

`VITE_ENABLE_DELIVERABLES_LIGHT` — czytana w `src/services/deliverablesGeneration.ts` (`isDeliverablesLightEnabled()` → `import.meta.env.VITE_ENABLE_DELIVERABLES_LIGHT === 'true'`). Gatuje lekki runtime generacji (plan→generate→poll). **Galeria szablonów / API templates są niezależne od tej flagi** — flaga gatuje montaż szkieletu z draftu (W1), nie samo API/galerię. Na staging/demo flaga musi być `=true` w build env Railway (znany blocker, patrz MEMORY: „Deliverables VITE flag deploy gap").

### 0.4 Infra Playwright

- Config: `playwright.config.ts`. Viewport `1680×1050`, project `chromium`, test timeout 60s, action 15s, nav 30s.
- Helpery: `tests/e2e/smoke/work-canvas-helpers.ts`:
  - `loginAsOwner(page): Promise<string>` — zwraca **token** (ADMIN). Strategia: `E2E_OWNER_EMAIL`/`PASSWORD` → `/api/test-support/bootstrap` (role ADMIN, klucz `TEST_SUPPORT_KEY`) → `register-demo`. Seeduje localStorage.
  - `loginAsMember(page): Promise<string>` — jak wyżej, role USER.
  - `suppressOnboarding(page): Promise<void>` — interceptuje `GET /api/preferences` + seeduje flagi tour. **MUSI być wołane PRZED `page.goto()`**.
- URL-e: `E2E_BASE_URL` (frontend, domyślnie `http://localhost:3000`), `E2E_API_URL` (backend, domyślnie `http://127.0.0.1:3001`).
- Konwencja screenshotów: `docs/qa/screens/deliverables-T-2026-06-22/<id>.png`.

### 0.5 Tabele (org-scope DDL)

| typ API | tabela | org column | flaga systemowa | migracja |
|---|---|---|---|---|
| `deck` | `presentation_templates` | `organization_id` (nullable) | `is_system` (default TRUE) | `568_presentations_brand_kits_templates.sql` |
| `doc` | `report_builder_templates` | `organization_id` (nullable) | `is_system`, `is_public` | `503_report_builder.sql` |
| `table` | `tp_base_templates` | `organization_id` (dod. w 785) | `created_by IS NULL` = system | `721_templates.sql`, `785_tp_base_templates_org_scope.sql` |

Reguła list (org-scope): system/public widoczne dla wszystkich, user-owned tylko dla `organization_id = orgId`. To jest baza testów T1-S04 i T3-S05.

---

## 0.6 Wspólny boilerplate Playwright (referencja dla wszystkich T*)

```ts
import { test, expect } from '@playwright/test';
import { loginAsOwner, loginAsMember, suppressOnboarding } from '../smoke/work-canvas-helpers';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const SCREENS = 'docs/qa/screens/deliverables-T-2026-06-22';
const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

// Helper: utwórz template przez API i zwróć id (sprzątanie w afterEach)
async function createTemplate(req, token, type: 'doc'|'deck'|'table', name: string, meta = {}) {
  const r = await req.post(`${API}/api/deliverables/templates`, {
    ...auth(token),
    data: { type, name, description: 'qa-fixture', meta },
  });
  expect(r.status()).toBe(201);
  return (await r.json()).template.id;
}
```

---

## T1 — Model template per typ + persystencja

**Cel:** udowodnić, że template (per typ `doc|deck|table`) tworzy się, czyta, przeżywa reload i jest twardo izolowany do organizacji (cross-org = 403). To jest fundament całej serii — bez wiarygodnej persystencji i org-scope reszta nie ma sensu.
**FT:** FT-1 (UI/flow), FT-2 (CRUD persyst PG), FT-8 (cross-org 403).

| ID | Tytuł | Typ | Kroki | Oczekiwane | Playwright | FT |
|---|---|---|---|---|---|---|
| **T1-S01** | Utwórz template (per 3 typy) | API | 1. `loginAsOwner` → token. 2. POST `/templates` dla `doc`, potem `deck`, potem `table` z unikalnym `name`. | Każdy `201`, body `{ template }` z `id`, `name` = wysłana, `organization_id` = org ownera, `is_system=false`. | `for (const type of ['doc','deck','table']) { const r = await request.post(\`${API}/api/deliverables/templates\`, { ...auth(token), data:{ type, name:\`qa-${type}-${Date.now()}\` }}); expect(r.status()).toBe(201); const b = await r.json(); expect(b.template.id).toBeTruthy(); expect(b.template.name).toContain(type); }` | FT-2 |
| **T1-S02** | Odczyt utworzonego (single + list) | API | 1. Utwórz `doc` (T1-S01 fixture). 2. GET `/templates/:id`. 3. GET `/templates?type=doc`. | (2) `200 { template }` z tym id. (3) `200 { templates:[...] }` zawiera utworzony id. | `const id = await createTemplate(request, token, 'doc', name); const s = await request.get(\`${API}/api/deliverables/templates/${id}\`, auth(token)); expect(s.status()).toBe(200); const l = await request.get(\`${API}/api/deliverables/templates?type=doc\`, auth(token)); const list = (await l.json()).templates; expect(list.some(t=>t.id===id)).toBe(true);` | FT-2 |
| **T1-S03** | Persystencja po reload (świeży klient) | API | 1. Owner tworzy `deck`. 2. Drugi, niezależny `request` context z tym samym tokenem (symuluje reload/nowy klient). 3. GET listy. | Template nadal obecny → dowód, że poszedł do PG, nie do pamięci procesu. | `const id = await createTemplate(req1, token, 'deck', name); const ctx2 = await playwright.request.newContext(); const l = await ctx2.get(\`${API}/api/deliverables/templates?type=deck\`, auth(token)); expect((await l.json()).templates.some(t=>t.id===id)).toBe(true); await ctx2.dispose();` | FT-2 |
| **T1-S03b** | Persystencja po reload (UI) | Manual | 1. Owner: otwórz launcher, krok 2, sprawdź że user-template z T1-S01 widoczny w galerii. 2. F5 / reload aplikacji. 3. Otwórz launcher ponownie. | Template nadal w galerii po reloadzie (gdy UI listuje user-templates — patrz blok „do potwierdzenia"). Screenshot. | n/d (manual; jeśli UI listuje API templates → Auto z `launcher-template-{id}` po dodaniu test-id) | FT-1, FT-2 |
| **T1-S04** | Org-scope: cross-org GET nie widzi cudzego | API | 1. `loginAsOwner` (orgA) tworzy `doc`. 2. `loginAsMember` musi być z **innej org** — jeśli helper daje tę samą org, użyj 2. tokena z innej org (patrz „do potwierdzenia"). 3. GET listy `doc` jako orgB. | Template orgA NIE występuje na liście orgB. | `const idA = await createTemplate(req, tokenA, 'doc', name); const l = await req.get(\`${API}/api/deliverables/templates?type=doc\`, auth(tokenB)); expect((await l.json()).templates.some(t=>t.id===idA)).toBe(false);` | FT-8 |
| **T1-S05** | Org-scope: cross-org PUT = 403 | API | 1. orgA tworzy `doc` → `idA`. 2. orgB robi PUT `/templates/idA` z `{name:'hacked'}`. | `403`. Body `{ error }` (z `TemplateForbiddenError.message`). Po próbie GET orgA pokazuje nazwę niezmienioną. | `const idA = await createTemplate(req, tokenA, 'doc', n); const p = await req.put(\`${API}/api/deliverables/templates/${idA}\`, { ...auth(tokenB), data:{ name:'hacked' }}); expect(p.status()).toBe(403); const after = await req.get(\`${API}/api/deliverables/templates/${idA}\`, auth(tokenA)); expect((await after.json()).template.name).toBe(n);` | FT-8 |
| **T1-S06** | Org-scope: cross-org DELETE = 403 | API | 1. orgA tworzy `deck` → `idA`. 2. orgB robi DELETE `/templates/idA`. | `403`. Template nadal istnieje (GET orgA = 200). | `const idA = await createTemplate(req, tokenA, 'deck', n); const d = await req.delete(\`${API}/api/deliverables/templates/${idA}\`, auth(tokenB)); expect(d.status()).toBe(403); const g = await req.get(\`${API}/api/deliverables/templates/${idA}\`, auth(tokenA)); expect(g.status()).toBe(200);` | FT-8 |
| **T1-S07** | Walidacja: zły typ = 400 | API | GET `/templates?type=foo`; POST `/templates` z `type:'foo'`. | Oba `400`, error mówi `Must be doc\|deck\|table`. | `const g = await req.get(\`${API}/api/deliverables/templates?type=foo\`, auth(token)); expect(g.status()).toBe(400); const p = await req.post(\`${API}/api/deliverables/templates\`, {...auth(token), data:{type:'foo', name:'x'}}); expect(p.status()).toBe(400);` | FT-2 |
| **T1-S08** | Walidacja: pusty/za długi name = 400 | API | POST z `name:''`; POST z `name` 201 znaków. | Oba `400`. | `const e = await req.post(...,{data:{type:'doc',name:''}}); expect(e.status()).toBe(400); const long = await req.post(...,{data:{type:'doc',name:'x'.repeat(201)}}); expect(long.status()).toBe(400);` | FT-2 |
| **T1-S09** | Auth gate: brak tokena = 401 | API | GET `/templates?type=doc` bez nagłówka Authorization. | `401` (z `verifyToken`). | `const r = await req.get(\`${API}/api/deliverables/templates?type=doc\`); expect(r.status()).toBe(401);` | FT-8 |

**Selektory/Endpointy do potwierdzenia (T1):**
- **Treść `TemplateForbiddenError.message`** — sprawdzić w serwisie (prawdopodobnie `server/src/services/deliverableTemplates.service.ts` lub sąsiednim). Asercja na message = miękka, dopóki nie potwierdzone.
- **Czy `is_system`/`organization_id` są zwracane w response `template`** — od tego zależy asercja w T1-S01. Jeśli nie zwracane, ogranicz asercję do `id`+`name`.
- **Dwie różne organizacje w E2E** — `loginAsOwner`/`loginAsMember` mogą lądować w TEJ SAMEJ org (bootstrap/register-demo). Dla T1-S04/05/06 potrzebne 2 RÓŻNE org. **WYMAGA potwierdzenia** czy `/api/test-support/bootstrap` pozwala wymusić nową org per wywołanie (np. param `orgName`/`fresh`). Jeśli nie — testy cross-org = **API blocked** do czasu rozszerzenia test-support (oznacz honest-skip).
- **Czy UI (krok 2 galerii) listuje user-created API templates** obok hardkodowanych — od tego zależy wykonalność T1-S03b.

---

## T2 — Biblioteka DBR77 (kuratorowana)

**Cel:** udowodnić, że kuratorowana biblioteka DBR77 jest kompletna (≥1 szablon per typ), że wybór szablonu generuje **sensowny szkielet** (golden, nie pusty placeholder), oraz że galeria działa w PL/EN i dark. To „twarz" jakości serii — szkielet musi wyglądać jak materiał DBR77.
**FT:** FT-1 (flow), FT-2 (dane szablonu), FT-6 (golden — sensowny szkielet).

| ID | Tytuł | Typ | Kroki | Oczekiwane | Playwright | FT |
|---|---|---|---|---|---|---|
| **T2-S01** | Galeria DBR77 renderuje się (krok 2) | UI | 1. `suppressOnboarding` → `loginAsOwner` → goto strony z launcherem. 2. Otwórz launcher. 3. Wybierz typ Report. | Krok 2 pokazuje karty: Blank, Audit report, Executive memo. Screenshot `T2-S01`. | `await suppressOnboarding(page); await loginAsOwner(page); await page.goto(BASE+'/<launcher-route>'); /* otwórz modal */ await page.getByRole('button',{name:/Report/i}).click(); await expect(page.getByRole('button',{name:'Audit report'})).toBeVisible(); await page.screenshot({path:\`${SCREENS}/T2-S01.png\`});` | FT-1 |
| **T2-S02** | ≥1 kuratorowany per typ (3 typy) | UI | Dla Report/Presentation/Table przejdź do kroku 2 i policz karty (poza Blank). | Report: audit-report, exec-memo. Presentation: board-deck, diagnostic. Table: risk-register, kpi-dashboard. Każdy typ ≥1 non-blank. Screenshoty per typ. | Pętla po 3 typach; po wejściu w krok 2 `expect(page.getByRole('button',{name:<oczekiwana karta>})).toBeVisible()`. **Stabilniej po dodaniu** `data-testid="launcher-template-{id}"`. | FT-1, FT-2 |
| **T2-S03** | Użycie template → szkielet | UI | 1. Krok 2 Report → klik „Audit report". 2. Potwierdź/start (jeśli wymaga). 3. Obserwuj otwarcie szkieletu/draftu. | Powstaje deliverable ze strukturą szablonu (sekcje audytu), nie pustka. Screenshot stanu szkieletu `T2-S03`. **Zależne od flagi** `VITE_ENABLE_DELIVERABLES_LIGHT=true`. | `await page.getByRole('button',{name:'Audit report'}).click(); /* start */ await expect(page.getByText(/<sekcja audytu>/i)).toBeVisible({timeout:15000}); await page.screenshot({path:\`${SCREENS}/T2-S03.png\`});` | FT-1, FT-6 |
| **T2-S04** | Jakość szkieletu (golden) | Manual | Otwórz szkielet z każdego kuratorowanego szablonu (6). Oceń wg karty FT-6: czy sekcje mają sensowne nagłówki, kolejność, placeholdery treści, brak loremów/„TODO". | Każdy szkielet = struktura godna DBR77 (nazwane sekcje per typ deliverable). Brak pustych/duplikujących się sekcji. Screenshot per szablon. | n/d (manual golden — ocena jakościowa; po dodaniu test-id część automatyzowalna jako „liczba sekcji ≥ N") | FT-6 |
| **T2-S05** | PL/EN galerii | Manual/Auto | 1. Ustaw UI na PL → otwórz galerię. 2. Przełącz na EN → otwórz ponownie. | Nazwy/etykiety kart + placeholder/przycisk Teresy tłumaczone (brak surowych i18n keys typu `rap.outputs.launcher.*`). Screenshoty PL i EN. | Auto: ustaw locale (np. localStorage `i18nextLng`), `await expect(page.getByText(/<PL string>/)).toBeVisible()`; brak `getByText('rap.outputs')`. | FT-1 |
| **T2-S06** | Dark mode galerii | Manual/Auto | Włącz dark → otwórz krok 2 galerii. | Karty czytelne, kontrast OK, brak białych prostokątów / niewidocznego tekstu. Screenshot `T2-S06-dark`. | Auto: `page.emulateMedia({colorScheme:'dark'})` lub toggle aplikacji; screenshot do wizualnej oceny. | FT-1 |
| **T2-S07** | Galeria niezależna od user-org (kuratorowane = system) | API | GET `/templates?type=doc` jako dowolny owner. | Lista zawiera kuratorowane/system templates niezależnie od org (is_system/created_by NULL). | `const l = await req.get(\`${API}/api/deliverables/templates?type=doc\`, auth(token)); const list=(await l.json()).templates; expect(list.length).toBeGreaterThan(0);` (po potwierdzeniu, że API zwraca też hardkodowane DBR77 — patrz „do potwierdzenia") | FT-2 |

**Selektory/Endpointy do potwierdzenia (T2):**
- **Route, na której montuje się `OutputsLauncherModal`** (z jakiego widoku/przycisku otwierany) — potrzebne do `page.goto` + sekwencji otwarcia modala. **WYMAGA ustalenia ścieżki + selektora triggera.**
- **Czy kuratorowane DBR77 (`audit-report` itd.) pochodzą z API (`is_system` rows) czy są HARDKODOWANE w komponencie.** Recon mówi: hardkodowane w `OutputsLauncherModal` (krok 2). Jeśli tak → T2-S07 testuje TYLKO system rows z PG, a obecność kart kuratorowanych weryfikuje się wyłącznie w UI (T2-S01/02). To rozjazd do zaadresowania — **oznacz jawnie**.
- **`data-testid="launcher-template-{id}"`** na kartach — **WYMAGA dodania test-id** (obecnie tylko `aria-label={tpl.name}`).
- **Co dokładnie generuje „użycie template"** przy fladze ON (montaż draftu vs nawigacja `/prezentacje`) — wpływa na asercję T2-S03/04.

---

## T3 — User-created templates (CRUD)

**Cel:** użytkownik tworzy własny template (z draftu), edytuje, usuwa, używa — i template jest widoczny TYLKO w jego org. Pełny cykl życia + izolacja.
**FT:** FT-1, FT-2, FT-3 (CRUD UI), FT-8 (org-scope).

| ID | Tytuł | Typ | Kroki | Oczekiwane | Playwright | FT |
|---|---|---|---|---|---|---|
| **T3-S01** | Utwórz template z draftu | oba | UI: z istniejącego draftu/deliverable „Zapisz jako template". API: POST `/templates` z `meta` z draftu. | `201 { template }`; pojawia się na liście user-templates org. | API: `const id = await createTemplate(req, token, 'doc', name, {sections:[...]}); const l = await req.get(\`${API}/api/deliverables/templates?type=doc\`, auth(token)); expect((await l.json()).templates.some(t=>t.id===id)).toBe(true);` | FT-1, FT-2 |
| **T3-S02** | Edytuj template | oba | API: PUT `/templates/:id` z `{name:'nowa', description, meta}`. | `200 { template }` z nową nazwą; GET potwierdza zmianę. | `const id=await createTemplate(...); const p=await req.put(\`${API}/api/deliverables/templates/${id}\`,{...auth(token),data:{name:'edited-'+id}}); expect(p.status()).toBe(200); const g=await req.get(\`${API}/api/deliverables/templates/${id}\`,auth(token)); expect((await g.json()).template.name).toBe('edited-'+id);` | FT-2, FT-3 |
| **T3-S03** | Usuń template | oba | API: DELETE `/templates/:id`; potem GET `/:id`. | DELETE `204`; następny GET `404`; znika z listy. | `const id=await createTemplate(...); const d=await req.delete(\`${API}/api/deliverables/templates/${id}\`,auth(token)); expect(d.status()).toBe(204); const g=await req.get(\`${API}/api/deliverables/templates/${id}\`,auth(token)); expect(g.status()).toBe(404);` | FT-2, FT-3 |
| **T3-S04** | Użyj user-template → szkielet | UI | Krok 2 galerii → wybierz własny template (jeśli UI listuje user-templates) → start. | Powstaje deliverable wg `meta` user-template. Screenshot `T3-S04`. Zależne od flagi ON + od tego czy galeria listuje user rows. | Po dodaniu `launcher-template-{id}`: `await page.locator(\`[data-testid="launcher-template-${id}"]\`).click();` + asercja szkieletu. | FT-1 |
| **T3-S05** | Widoczny tylko w org | API | orgA tworzy `table` → `idA`; orgB GET listy `table`. | orgB NIE widzi `idA`. (Wymaga 2 org — patrz T1 „do potwierdzenia".) | jak T1-S04, typ `table`. | FT-8 |
| **T3-S06** | Edycja system template = 403 | API | PUT/DELETE na id szablonu systemowego/DBR77 (is_system / created_by NULL). | `403` (TemplateForbiddenError — „Cannot modify system template" wg recon). | `const l=await req.get(\`${API}/api/deliverables/templates?type=doc\`,auth(token)); const sys=(await l.json()).templates.find(t=>t.is_system||t.isSystem); /* jeśli istnieje */ const p=await req.put(\`${API}/api/deliverables/templates/${sys.id}\`,{...auth(token),data:{name:'x'}}); expect(p.status()).toBe(403);` | FT-8 |
| **T3-S07** | Dark mode CRUD UI | Manual | W dark: ekran „zapisz jako template" + edycja + lista user-templates. | Czytelność, kontrast, brak artefaktów. Screenshot `T3-S07-dark`. | n/d (manual; po dodaniu test-id częściowo auto) | FT-3 |

**Selektory/Endpointy do potwierdzenia (T3):**
- **UI „Zapisz jako template" z draftu** — gdzie jest trigger (Studio/Canvas/Outputs)? **WYMAGA ustalenia ścieżki + selektora.** Recon nie wskazał konkretnego przycisku „Save as template" w `OutputsLauncherModal` (to launcher, nie editor). Jeśli zapis-z-draftu nie ma jeszcze UI → T3-S01 UI = **blocked**, robimy tylko API.
- **Czy galeria (krok 2) listuje user-created templates** (a nie tylko hardkodowane DBR77) — krytyczne dla T3-S04. **WYMAGA potwierdzenia.** Jeśli NIE — T3-S04 UI = blocked.
- **Treść 403 dla system template** — potwierdzić message.
- 2 różne org — jak w T1.

---

## T4 — Teresa proponuje template z intencji

**Cel:** z intencji w języku naturalnym („zrób audyt") Teresa proponuje konkretny template; akceptacja montuje szkielet, odrzucenie wraca do Blank; działa PL/EN. Endpoint jest fail-open (błąd → `null`, nigdy 500), więc test musi tolerować `null`.
**FT:** FT-1, FT-2, FT-6.

| ID | Tytuł | Typ | Kroki | Oczekiwane | Playwright | FT |
|---|---|---|---|---|---|---|
| **T4-S01** | „zrób audyt" → sugestia (API kontrakt) | API | POST `/templates/suggest` `{intent:'zrób audyt firmy', type:'doc'}`. | `200`. `suggestion === null` LUB `{templateId, confidence∈{high,medium,low}, reasoning:string}`. Dla sensownej intencji audytu oczekiwany `templateId` powiązany z audit (golden — patrz „do potwierdzenia" o trafności). | `const r=await req.post(\`${API}/api/deliverables/templates/suggest\`,{...auth(token),data:{intent:'zrób audyt firmy',type:'doc'}}); expect(r.status()).toBe(200); const s=(await r.json()).suggestion; if(s){ expect(['high','medium','low']).toContain(s.confidence); expect(typeof s.reasoning).toBe('string'); }` | FT-2, FT-6 |
| **T4-S02** | Walidacja suggest: pusty intent / zły typ / za długi | API | POST z `intent:''`; z `type:'foo'`; z `intent` 1001 zn.; z `useLlm:'yes'`. | Każdy `400`. | `for (const data of [{intent:'',type:'doc'},{intent:'x',type:'foo'},{intent:'x'.repeat(1001),type:'doc'},{intent:'x',type:'doc',useLlm:'yes'}]) { const r=await req.post(\`${API}/api/deliverables/templates/suggest\`,{...auth(token),data}); expect(r.status()).toBe(400); }` | FT-2 |
| **T4-S03** | Fail-open: brak 500 | API | POST poprawny body przy niedostępnym LLM (`useLlm:true`) lub edge intent. | `200` (NIGDY 500); `suggestion` może być `null`. | `const r=await req.post(\`${API}/api/deliverables/templates/suggest\`,{...auth(token),data:{intent:'???',type:'deck',useLlm:true}}); expect(r.status()).toBe(200);` | FT-2 |
| **T4-S04** | UI: wpisz intencję → „Teresa suggests" → wynik | UI | 1. Krok 2 galerii. 2. Wpisz „zrób audyt" w input (placeholder „Describe what you need…"). 3. Klik „Teresa suggests". | Pojawia się box wyniku „Teresa recommends" z templateId/confidence/reasoning + przycisk „Use this template". Screenshot `T4-S04`. | Po dodaniu test-id: `await page.locator('[data-testid="launcher-suggest-input"]').fill('zrób audyt'); await page.locator('[data-testid="launcher-suggest-btn"]').click(); await expect(page.locator('[data-testid="launcher-suggest-result"]')).toBeVisible({timeout:15000}); await page.screenshot({path:\`${SCREENS}/T4-S04.png\`});` (przejściowo: `getByRole('button',{name:'Teresa suggests'})`) | FT-1, FT-6 |
| **T4-S05** | UI: akceptuj sugestię → szkielet | UI | Z wyniku T4-S04 klik „Use this template" → start. | Wybrany zostaje sugerowany template, montuje się szkielet (flaga ON). Screenshot `T4-S05`. | `await page.locator('[data-testid="launcher-suggest-accept"]').click();` + asercja szkieletu/wyboru karty. | FT-1, FT-6 |
| **T4-S06** | UI: odrzuć → Blank | UI | Z wyniku zignoruj sugestię, wybierz „Blank" → start. | Powstaje pusty szkielet (Blank), nie szablon sugerowany. Screenshot `T4-S06`. | klik karty Blank (`launcher-template-blank`) zamiast accept; asercja pustego szkieletu. | FT-1 |
| **T4-S07** | PL/EN sugestii | Manual/Auto | Intencja PL i EN; etykiety inputu/przycisku/wyniku w obu locale. | Brak surowych i18n keys; `reasoning` w sensownym języku. Screenshoty PL/EN. | jak T2-S05 + wywołanie suggest. | FT-1 |

**Selektory/Endpointy do potwierdzenia (T4):**
- **Trafność sugestii (golden)** — czy „zrób audyt"/`type:doc` deterministycznie mapuje na `audit-report`. Zależy od `suggestTemplate` (heurystyka vs LLM). **WYMAGA przejrzenia serwisu** (prawdopodobnie `server/src/services/deliverableTemplates.service.ts`). Bez LLM (`useLlm:false`) heurystyka powinna być deterministyczna → asercja golden możliwa; z LLM = niedeterministyczne, asercja miękka.
- **`data-testid` dla suggest input/btn/result/accept** — **WYMAGA dodania test-id** (obecnie tylko placeholder + aria-label).
- **Czy `useLlm` jest wpięte w UI** (czy przycisk woła z LLM czy heurystyką) — wpływa na T4-S04 timeout i determinizm.
- **Ścieżka launchera** (jak w T2).

---

## Wykonalność dziś (uczciwie)

### Gotowe do uruchomienia OD ZARAZ (API, bez UI/flagi/deploya)
Wszystko przez `page.request` / `request` context z tokenem z `loginAsOwner`:
- **T1-S01, S02, S03, S07, S08, S09** — CRUD + persystencja + walidacja + auth-gate. Router i kontrakty potwierdzone w kodzie. Wymaga tylko działającego backendu (`E2E_API_URL`) i migracji 503/568/721/785.
- **T2-S07** — obecność system rows na liście (z zastrzeżeniem: jeśli DBR77 są hardkodowane w UI, a nie w PG, ten test mierzy tylko realne system rows).
- **T3-S01, S02, S03** — pełny CRUD user-template przez API.
- **T4-S01, S02, S03** — kontrakt suggest + walidacja + fail-open. To najbezpieczniejsze testy (endpoint nigdy nie zwraca 500).

### Wymaga rozszerzenia test-infra (API, ale dziś prawdopodobnie BLOCKED)
- **T1-S04/S05/S06, T3-S05 (cross-org 403/izolacja)** — wymagają **dwóch RÓŻNYCH organizacji**. `loginAsOwner`/`loginAsMember` mogą lądować w tej samej org. **Blocker:** trzeba potwierdzić/rozszerzyć `/api/test-support/bootstrap`, by wymusić świeżą org per wywołanie. Do tego czasu — honest-skip z notatką, NIE fałszywy zielony.
- **T3-S06 (system template 403)** — wykonalne API gdy lista zwraca jakikolwiek wiersz z `is_system=true`/`created_by NULL` z poprawnym `id`; w przeciwnym razie skip.

### Wymaga dodania `data-testid` + ustalenia ścieżki launchera (UI)
- **T2-S01/S02/S03, T3-S04/S07, T4-S04/S05/S06** — UI. Dziś działają tylko przez kruche `getByRole({name: aria-label})`. **WYMAGA dodania test-id** (`launcher-type-*`, `launcher-template-{id}`, `launcher-suggest-{input,btn,result,accept}`) — w osobnym PR (ten plan kodu NIE zmienia). Dodatkowo **WYMAGA ustalenia route + triggera otwarcia `OutputsLauncherModal`**.

### Wymaga flagi + deploya (UI generacja szkieletu)
- **T2-S03/S04, T3-S04, T4-S05/S06 (montaż szkieletu)** — zależne od `VITE_ENABLE_DELIVERABLES_LIGHT=true`. Lokalnie ustaw w `.env.local`; na staging/demo to znany blocker (flaga tylko w `.env.local`, OFF na Railway). Sama galeria i wybór karty działają bez flagi; montaż draftu — nie.

### Wymaga oceny człowieka (golden, niedeterministyczne)
- **T2-S04 (jakość szkieletu), T4-S01 trafność, T2-S05/S06/T3-S07/T4-S07 (PL/EN + dark)** — manual golden. Automatyzacja częściowa: liczba sekcji / brak surowych i18n keys / screenshot do wizualnej akceptacji. Trafność LLM-suggest = asercja miękka; heurystyka (`useLlm:false`) = potencjalnie twarda po przejrzeniu `suggestTemplate`.

### Najpilniejsze do odblokowania pełnej serii (rekomendacja QA)
1. Potwierdzić/dodać świeżą-org w test-support → odblokowuje 4 testy org-scope (rdzeń FT-8).
2. Dodać `data-testid` w `OutputsLauncherModal` → odblokowuje stabilne UI T2/T3/T4.
3. Ustalić route+trigger launchera → warunek konieczny każdego testu UI.
4. Przejrzeć `suggestTemplate` (heurystyka vs LLM) → decyduje czy T4-S01 może być golden auto.
