# Plan testów — SERIA E (Wspólne wejście / launcher)

> Program: **Generatory Deliverable** (M17 Outputs · M18 Doc · M19 Deck · M20 Table) → zunifikowane generatory.
> Seria E (fala W1) = wspólne wejście: launcher z 3 kaflami typu (Raport / Prezentacja / Tabela) → galeria template → silnik Teresy.
> Flaga FE: `VITE_ENABLE_DELIVERABLES_LIGHT === 'true'`.
>
> Autor: QA. Data: 2026-06-22. Status: gotowy do implementacji w Playwright.
> Plik testowy docelowy (do utworzenia w implementacji): `tests/e2e/deliverables/e-series.spec.ts`.

---

## 0. Rekonesans — fakty z kodu (SSOT dla selektorów)

Zweryfikowane realnie w repo (2026-06-22):

| Element | Lokalizacja w kodzie | Selektor / fakt |
|---|---|---|
| Outputs Hub (M17) | `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx:1092` | kontener `data-testid="reports-presentations-hub"`, trasa `/presentations` |
| Przycisk „New output" (CTA) | render w `src/components/shared/ModuleHub/ModuleNavBar.tsx:493-505` (przez `onNewItem`/`newItemLabel`) | **BRAK `data-testid`** — `<button>` z tekstem z `rap.outputs.cta.new` ("New output" / PL "Nowy"). Dostępny tylko przez tekst. **WYMAGA dodania `data-testid="outputs-new-button"`** |
| Warunek otwarcia launchera | `ReportsAndPresentationsHub.tsx:237-246` (`handleNewItem`) | tylko dla tabów `outputs_all` / `outputs_mine` / `outputs_review`; gdy flaga ON → `setLauncherOpen(true)`; gdy OFF → `navigate('/presentations?tab=templates')` |
| Launcher modal | `src/components/ReportsAndPresentations/OutputsLauncherModal.tsx:213-217` | `role="dialog" aria-modal="true" aria-labelledby="outputs-launcher-title"` |
| Tytuł modala | `OutputsLauncherModal.tsx:235` | `#outputs-launcher-title`; tekst `rap.outputs.launcher.title` ("New output") krok 1, `rap.outputs.launcher.chooseTemplate` ("Choose a template") krok 2 |
| 3 kafle typu | `OutputsLauncherModal.tsx:259-286` (mapa `TYPE_TILES`) | `<button>` z `aria-label` = label typu (Report/Presentation/Table). **BRAK `data-testid`** — **WYMAGA `data-testid="launcher-type-report\|presentation\|table"`** |
| Kafel „Blank" | `OutputsLauncherModal.tsx:361-375` | `aria-label="Blank"` (`rap.outputs.launcher.tpl.blank`). **WYMAGA `data-testid="launcher-template-blank"`** |
| Szablony z API | `OutputsLauncherModal.tsx:378-402` | `<button aria-label={tpl.name}>`; źródło: hook `useDeliverableTemplates(selectedType)`. **WYMAGA `data-testid="launcher-template-{id}"`** |
| Input Teresy | `OutputsLauncherModal.tsx:296-304` | `<input placeholder` z `rap.outputs.launcher.suggestPlaceholder` ("Describe what you need…"); Enter → suggest |
| Przycisk „Teresa zaproponuje" | `OutputsLauncherModal.tsx:305-316` | `aria-label` z `rap.outputs.launcher.suggestBtn` ("Teresa suggests") |
| Wynik sugestii | `OutputsLauncherModal.tsx:320-339` | blok z `rap.outputs.launcher.suggestResult` + przycisk `rap.outputs.launcher.suggestAccept` ("Use this template") |
| Przycisk „wstecz" (krok 2→1) | `OutputsLauncherModal.tsx:226-233` | `aria-label` z `rap.outputs.launcher.back` ("Back"); Escape też cofa krok |
| Przycisk zamknięcia | `OutputsLauncherModal.tsx:244-250` | `aria-label` z `common.close` ("Close"); Escape z kroku 1 zamyka modal; klik w backdrop zamyka |
| Reakcja na wybór | `ReportsAndPresentationsHub.tsx:205-224` (`handleLauncherSelect`) | **NIE nawiguje wprost do edytora** — wywołuje `openChatWithContext({ entityType:'deliverable_launch', entityId:'{type}-{templateId}', contextData:{ teresaPrompt, deliverableType, templateId } })`. Routing do edytora = przez czat (Tryb B, intent-detektory) |
| Flaga (FE) | `src/services/deliverablesGeneration.ts:45-47` | `isDeliverablesLightEnabled()` = `import.meta.env.VITE_ENABLE_DELIVERABLES_LIGHT === 'true'` |
| Edytor doc | `DocumentStudioView` / `/document-studio` | `data-testid="document-tiptap-editor"` |
| Edytor deck | `DeckBuilderMelsView` / `/presentations/:deckId` | `data-testid="deck-builder-mels-root"` |
| Edytor tabela | `PlatformGridView` / `/tabele` lub `/my-work/.../table` | (sprawdzić test-id w `PlatformGridView` — założ `data-testid="platform-grid-view"`, **WYMAGA weryfikacji/dodania**) |

> **WNIOSEK KLUCZOWY (wpływa na E4):** wybór typu+template w launcherze **nie robi `navigate()` do edytora** — montuje opener czatu z `teresaPrompt`. Pełna ścieżka „launcher → edytor" przechodzi przez Teresę (Tryb B) i wymaga realnego LLM. Dlatego część E4 jest weryfikowalna w warstwie launcher→czat deterministycznie, a docelowy edytor — tylko z działającym kluczem LLM (patrz „Wykonalność dziś").

---

## Konwencje wspólne dla wszystkich scenariuszy Auto

**Config:** `playwright.config.ts` — `baseURL` z `E2E_BASE_URL` (domyślnie `http://localhost:3000`), API `E2E_API_URL` (`http://127.0.0.1:3001`), viewport `1680×1050`, projekt `chromium`.

**Auth (helpery z `tests/e2e/smoke/work-canvas-helpers.ts`):**
```ts
import { loginAsOwner, loginAsMember, suppressOnboarding } from '../smoke/work-canvas-helpers';
// w teście:
await loginAsOwner(page);          // seeduje storageState + zwraca token
await suppressOnboarding(page);    // ZAWSZE przed page.goto
await page.goto('/presentations');
```

**Otwarcie taba agregatu (warunek launchera):** launcher otwiera się tylko na tabach `outputs_all/mine/review`. W teście wejść na `/presentations` i przełączyć na tab Outputs (agregat) lub wejść głęboko-linkiem, jeśli istnieje (`?tab=outputs_all`). **WYMAGA weryfikacji** parametru deep-linku tabu agregatu.

**Dark mode (wzór `tests/e2e/smoke/m03-theme-capture.spec.ts`):**
```ts
await page.addInitScript(() => {
  const raw = localStorage.getItem('consultify-storage');
  const s = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  s.state = { ...(s.state || {}), theme: 'dark' };
  localStorage.setItem('consultify-storage', JSON.stringify(s));
});
```

**Screenshoty:** katalog `docs/qa/screens/deliverables-E-2026-06-22/`, nazwa `<seria><sub>-<nr>-<opis>-<light|dark>.png`, np. `E1-01-launcher-open-light.png`.
```ts
await page.screenshot({ path: 'docs/qa/screens/deliverables-E-2026-06-22/E1-01-launcher-open-light.png', fullPage: false });
```

**Helper rekomendowany (do dodania w spec):**
```ts
async function openLauncher(page) {
  // PO dodaniu test-id:
  await page.getByTestId('outputs-new-button').click();
  // DZIŚ (fallback po tekście — kruche):
  // await page.getByRole('button', { name: /new output|nowy/i }).click();
  await expect(page.getByRole('dialog', { name: /new output/i })).toBeVisible();
}
```

---

## E1 — Launcher „Nowy" + 3 kafle typu

**Cel:** Z poziomu Outputs Hub (M17), na tabach agregatu, przycisk „Nowy" otwiera modal launchera z 3 kaflami typu (Raport / Prezentacja / Tabela); wybór kafla przechodzi do kroku galerii (krok 2); działa w light i dark; flaga ON warunkuje launcher (OFF = fallback do `/presentations?tab=templates`).
**FT zadeklarowane:** FT-1 (unit), FT-3 (e2e), FT-8 (sec).

| ID | Tytuł | Typ | Kroki manualne | Oczekiwane | Playwright (selektory + kroki + screenshot) | FT |
|---|---|---|---|---|---|---|
| E1-S01 | Otwórz launcher | oba | 1. Zaloguj jako owner. 2. Wejdź na `/presentations`. 3. Przejdź na tab Outputs (agregat). 4. Kliknij „Nowy / New output". | Otwiera się modal `role=dialog` z tytułem „New output"; widoczne 3 kafle. | `loginAsOwner`+`suppressOnboarding`; goto `/presentations`; otwórz tab agregatu; klik `getByTestId('outputs-new-button')` (dziś: tekst); `expect(page.getByRole('dialog',{name:/new output/i})).toBeVisible()`. Screenshot `E1-01-launcher-open-light.png`. | FT-3 |
| E1-S02 | 3 kafle typu widoczne + etykiety | oba | 1. Otwórz launcher (E1-S01). 2. Obejrzyj kafle. | Dokładnie 3 kafle: Report/Raport, Presentation/Prezentacja, Table/Tabela, każdy z ikoną + hintem. | W otwartym dialogu: `expect(page.getByTestId('launcher-type-report')).toBeVisible()` itd. (dziś: `getByRole('button',{name:'Report'})`); policz kafle = 3. Screenshot `E1-02-three-tiles-light.png`. | FT-3 |
| E1-S03 | Wybór Raport → krok galerii | oba | 1. Otwórz launcher. 2. Kliknij kafel „Raport". | Modal przechodzi do kroku 2: tytuł „Choose a template", widoczny przycisk „wstecz", input Teresy, kafel „Blank". | klik `getByTestId('launcher-type-report')`; `expect(page.getByText(/choose a template/i)).toBeVisible()`; `expect(page.getByTestId('launcher-template-blank')).toBeVisible()`. Screenshot `E1-03-report-step2-light.png`. | FT-3 |
| E1-S04 | Wybór Prezentacja → krok galerii | oba | 1. Otwórz launcher. 2. Kliknij kafel „Prezentacja". | Krok 2 dla typu deck; galeria szablonów deck (board-deck/diagnostic) + Blank. | klik `getByTestId('launcher-type-presentation')`; assert krok 2 + Blank. Screenshot `E1-04-deck-step2-light.png`. | FT-3 |
| E1-S05 | Wybór Tabela → krok galerii | oba | 1. Otwórz launcher. 2. Kliknij kafel „Tabela". | Krok 2 dla typu table; galeria (risk-register/kpi-dashboard) + Blank. | klik `getByTestId('launcher-type-table')`; assert krok 2 + Blank. Screenshot `E1-05-table-step2-light.png`. | FT-3 |
| E1-S06 | Wstecz / Escape cofa krok | oba | 1. Wejdź w krok 2 (E1-S03). 2. Kliknij „wstecz". 3. Ponownie wejdź, naciśnij Escape. | „Wstecz" wraca do kroku 1 (3 kafle). Escape z kroku 2 wraca do kroku 1; Escape z kroku 1 zamyka modal. | klik `getByRole('button',{name:/back/i})`; assert 3 kafle; `page.keyboard.press('Escape')` z kroku 2 → krok 1; z kroku 1 → dialog zamknięty. Screenshot `E1-06-back-to-step1-light.png`. | FT-3 |
| E1-S07 | Zamknięcie (X + backdrop) | oba | 1. Otwórz launcher. 2. Kliknij X. 3. Otwórz ponownie, kliknij tło. | Modal zamyka się w obu przypadkach; brak `role=dialog`. | klik `getByRole('button',{name:/close/i})`; `expect(dialog).toBeHidden()`; reopen; klik w overlay (`page.mouse.click` w róg/tło) → zamknięty. | FT-3 |
| E1-S08 | Dark + light parytet | oba | 1. Powtórz E1-S01..S02 w dark. | Modal czytelny w dark (`dark:bg-navy-900`), kontrast OK, brak crimson-leak. | addInitScript theme='dark'; otwórz launcher; screenshot `E1-08-launcher-open-dark.png` + `E1-08-three-tiles-dark.png`. Porównanie wizualne ręczne. | FT-3 |
| E1-S09 | Flaga OFF → fallback (NIE launcher) | oba | 1. Środowisko z `VITE_ENABLE_DELIVERABLES_LIGHT` != 'true'. 2. Kliknij „Nowy" na tabie agregatu. | NIE otwiera się modal; następuje nawigacja do `/presentations?tab=templates`. | Build z flagą OFF (osobny env); klik CTA; `expect(page).toHaveURL(/tab=templates/)`; `expect(dialog).toHaveCount(0)`. **Wymaga osobnego buildu** (patrz Wykonalność). | FT-3 |
| E1-S10 | Reset kroku przy ponownym otwarciu | Auto | 1. Wejdź w krok 2. 2. Zamknij. 3. Otwórz ponownie. | Launcher zawsze startuje na kroku 1 (efekt reset w `useEffect [open]`). | wejdź krok 2; zamknij; reopen; `expect(page.getByText(/pick what you want/i)).toBeVisible()` (subtitle kroku 1). | FT-1/FT-3 |
| E1-S11 | Unit: warunek `handleNewItem` (flaga + tab) | Auto (unit/component) | — | Dla tabów agregatu + flaga ON → `setLauncherOpen(true)`; flaga OFF → `navigate('/presentations?tab=templates')`; dla innych tabów launcher się nie pokazuje. | Component test (Vitest, `tests/components/...`) mockujący `isDeliverablesLightEnabled` + `navigate`; render Hub, klik CTA per tab. Już istnieje baza: `tests/components/ReportsAndPresentations/OutputsLauncherModal.test.tsx` — rozszerzyć o gałąź flagi. | FT-1 |
| E1-S12 | Sec: brak elewacji uprawnień / member | oba | 1. Zaloguj jako member. 2. Otwórz launcher, wybierz typ. | Member widzi launcher (jeśli ma dostęp do M17) wg gatingu; akcja nie zwraca danych innej org; brak 403 na `useDeliverableTemplates` poza scope. | `loginAsMember`; powtórz E1-S01..S03; sprawdź network (brak cross-org template), brak błędu 500. | FT-8 |

### Selektory do dodania (test-id) — E1
- `data-testid="outputs-new-button"` na przycisku CTA w `ModuleNavBar.tsx:494` (dziś tylko tekst → kruche).
- `data-testid="launcher-type-report|presentation|table"` na kaflach typu w `OutputsLauncherModal.tsx:263-285` (map `TYPE_TILES` → `data-testid={`launcher-type-${tile.type === 'report' ? 'report' : tile.type}`}`; uwaga mapowanie `presentation`→deck wewnętrznie, ale test-id wg `tile.type`).

---

## E2 — Galeria template'ów

**Cel:** Krok 2 launchera renderuje galerię szablonów per typ; „Blank" jest zawsze i zawsze pierwszy; wybór szablonu emituje `onSelect({type, templateId})` (szkielet); przycisk „Teresa zaproponuje" zwraca rekomendację (stub/AI); light/dark.
**FT zadeklarowane:** FT-1 (unit), FT-3 (e2e), FT-7 (a11y/i18n — założenie: zgodność etykiet + role).

| ID | Tytuł | Typ | Kroki manualne | Oczekiwane | Playwright (selektory + kroki + screenshot) | FT |
|---|---|---|---|---|---|---|
| E2-S01 | Galeria zależna od typu | oba | 1. Wejdź w krok 2 dla Raport. 2. Cofnij, wejdź dla Prezentacja. 3. Cofnij, wejdź dla Tabela. | Każdy typ ma swój zestaw szablonów (raport: audit-report/exec-memo; deck: board-deck/diagnostic; tabela: risk-register/kpi-dashboard) — wczytane z API (`useDeliverableTemplates`). | Dla każdego typu: wejdź krok 2; `expect(page.getByRole('button',{name:/audit report/i})).toBeVisible()` (raport) itd. Screenshot `E2-01-gallery-report-light.png`, `E2-01-gallery-deck-light.png`, `E2-01-gallery-table-light.png`. | FT-3 |
| E2-S02 | „Blank" zawsze obecny i pierwszy | oba | 1. Wejdź w krok 2 (dowolny typ). 2. Zlokalizuj „Blank". | Kafel „Blank" widoczny zawsze, jako pierwszy w siatce — także gdy API zwróci listę z własnym blankiem (filtr `!tpl.isBlank` eliminuje duplikat). | `expect(page.getByTestId('launcher-template-blank')).toBeVisible()`; sprawdź że to pierwszy przycisk-szablon w gridzie (bounding-box / kolejność DOM). Screenshot `E2-02-blank-first-light.png`. | FT-3 |
| E2-S03 | Wybór template → szkielet (emit onSelect) | oba | 1. Wejdź w krok 2 (Raport). 2. Kliknij „Audit report". | Modal zamyka się; uruchamia się ścieżka kontekstu z `templateId='audit-report'` (czat z openerem Teresy). | klik szablonu; `expect(dialog).toBeHidden()`; assert że otwarł się czat z kontekstem (sprawdź pojawienie się `UnifiedChatPanel` / pendingPrompt). Screenshot `E2-03-template-selected-light.png`. | FT-3 |
| E2-S04 | „Teresa zaproponuje" (stub/AI) | oba | 1. Wejdź w krok 2. 2. Wpisz w input „audyt procesów IT". 3. Kliknij „Teresa suggests" (lub Enter). | Pojawia się blok rekomendacji z `templateId` + confidence + uzasadnienie + przycisk „Use this template". | wypełnij `getByPlaceholder(/describe what you need/i)`; klik `getByRole('button',{name:/teresa suggests/i})`; `expect(page.getByText(/teresa recommends/i)).toBeVisible({timeout:15000})`. Screenshot `E2-04-suggestion-light.png`. **AI** → patrz Wykonalność (wymaga LLM/stub). | FT-3 |
| E2-S05 | Akceptacja sugestii | oba | 1. Po E2-S04. 2. Kliknij „Use this template". | Modal zamyka się; ścieżka kontekstu uruchomiona z sugerowanym templateId. | klik `getByRole('button',{name:/use this template/i})`; `expect(dialog).toBeHidden()`. | FT-3 |
| E2-S06 | Stan ładowania / błąd galerii | oba | 1. Wejdź w krok 2 przy wolnym/zerwanym API templates. | Loading spinner podczas ładowania; przy błędzie — komunikat błędu, ale „Blank" nadal klikalny (fallback). | Mock route `**/deliverables/templates*` → 500; wejdź krok 2; `expect(page.getByTestId('launcher-template-blank')).toBeEnabled()`; assert komunikat błędu. Screenshot `E2-06-gallery-error-light.png`. | FT-3 |
| E2-S07 | i18n PL/EN etykiet szablonów | oba | 1. PL: etykiety „Raport audytowy"/„Notatka zarządcza" itd. 2. EN: „Audit report"/„Executive memo". | Etykiety lokalizowane (klucze `rap.outputs.launcher.tpl.*`); brak surowych kluczy w UI. | Ustaw `i18n.language` przez storage; assert tekst PL i EN; gate bare-missing (brak `rap.outputs...` jako goły tekst). | FT-7 |
| E2-S08 | Dark + light parytet galerii | oba | 1. Powtórz E2-S01/S02 w dark. | Galeria czytelna w dark; kafle z hover state. | addInitScript dark; screenshot `E2-08-gallery-report-dark.png`. | FT-3 |

### Selektory do dodania (test-id) — E2
- `data-testid="launcher-template-blank"` (`OutputsLauncherModal.tsx:361`).
- `data-testid="launcher-template-{tpl.id}"` na szablonach z API (`OutputsLauncherModal.tsx:381`), żeby uniezależnić od `tpl.name` (lokalizowanej).
- `data-testid="launcher-suggest-input"` / `launcher-suggest-button` / `launcher-suggest-result` dla bloku „Teresa zaproponuje" (dziś tylko placeholder + aria-label).

---

## E3 — Kontrakt „paczka kontekstu" + 3 ścieżki wejścia

**Cel:** Niezależnie od miejsca startu (encja inicjatywy / notatnik / ideas / canvas / czat / „Nowy"), do generatora trafia spójna „paczka kontekstu" (typ + templateId + treść źródłowa). Wybór w launcherze montuje opener czatu z `teresaPrompt` i `contextData`. Paczka musi nieść treść źródłową, nie tylko typ.
**FT zadeklarowane:** FT-1 (unit), FT-2 (integration), FT-3 (e2e), FT-8 (sec).

> **Fakt z kodu:** `handleLauncherSelect` (`ReportsAndPresentationsHub.tsx:205-224`) buduje `contextData = { teresaPrompt, deliverableType, templateId }` i woła `openChatWithContext({ entityType:'deliverable_launch', entityId:'{type}-{templateId}', entityName, contextData })`. Ścieżki z encji używają tych samych przycisków „zrób z tego" (`openChatWithContext`) rozsianych po `InitiativesHub`, `MyWork/*`, `IdeaMapWorkspace`, `CanvasPresentationView`, `UnifiedChatPanel` — **WYMAGA per-encja weryfikacji selektorów przycisków „zrób z tego".**

| ID | Tytuł | Typ | Kroki manualne | Oczekiwane | Playwright (selektory + kroki + screenshot) | FT |
|---|---|---|---|---|---|---|
| E3-S01 | Raport z inicjatywy | oba | 1. Otwórz inicjatywę (M13). 2. Kliknij „zrób raport / zrób z tego → Raport". | Otwiera się czat z openerem Teresy; `contextData` niesie `entityType` inicjatywy + jej treść (tytuł/opis). | goto inicjatywa; klik przycisk „zrób z tego" (selektor **WYMAGA weryfikacji** w `InitiativesHub.tsx`); assert czat otwarty + pendingPrompt zawiera nazwę inicjatywy. Screenshot `E3-01-from-initiative-light.png`. | FT-3 |
| E3-S02 | Deck z notatnika | oba | 1. Otwórz notatkę (M04). 2. Akcja „zrób prezentację". | Czat z openerem deck; paczka niesie treść notatki. | goto notatnik; klik akcji (selektor WYMAGA weryfikacji); assert opener deck. Screenshot `E3-02-from-notebook-light.png`. | FT-3 |
| E3-S03 | Tabela z Ideas | oba | 1. Otwórz Ideas/Mind Map (M06). 2. Akcja „zrób tabelę". | Czat z openerem table; paczka niesie węzły/treść ideas. | goto Ideas; klik akcji (selektor WYMAGA weryfikacji); assert opener table. Screenshot `E3-03-from-ideas-light.png`. | FT-3 |
| E3-S04 | Z canvas | oba | 1. W czacie z canvas (split-view) → akcja „zrób deliverable". | Paczka niesie treść canvasa do generatora. | otwórz czat z canvas; akcja (selektor WYMAGA weryfikacji w `CanvasPresentationView.tsx`); assert kontekst. Screenshot `E3-04-from-canvas-light.png`. | FT-3 |
| E3-S05 | Z czatu (Tryb B, intent) | oba | 1. W czacie wpisz „przygotuj prezentację o X". 2. Wyślij. | Intent-detektor deck/doc/sheet (`UnifiedChatPanel`) rozpoznaje typ; uruchamia generator z intencją jako treścią. | otwórz `UnifiedChatPanel`; wpisz intencję; assert wykryto typ (SSE/payload). **AI** — patrz Wykonalność. Screenshot `E3-05-from-chat-light.png`. | FT-3 |
| E3-S06 | Z „Nowy" (launcher) | oba | 1. Launcher → Raport → Blank. | Montuje opener czatu z `teresaPrompt` = `deliverableKickoffSeed('report')`, `entityId='report-blank'`. | klik Blank w kroku 2 dla Raport; assert czat otwarty z pendingPrompt zawierającym seed raportu. Screenshot `E3-06-from-new-launcher-light.png`. | FT-3 |
| E3-S07 | Paczka niesie TREŚĆ (nie tylko typ) | Auto (unit/integration) | — | `contextData` zawiera `deliverableType`, `templateId` ORAZ treść źródłową (np. opis encji / wycinek rozmowy), nie tylko etykietę typu. | Integration/component test: wyemituj `handleLauncherSelect` i ścieżki z encji, sprawdź payload `openChatWithContext` — pole treści niepuste dla ścieżek E3-S01..S05; dla „Nowy" — seed niepusty. Bazuj na `tests/components/ReportsAndPresentations/deliverableKickoff.test.ts`. | FT-1/FT-2 |
| E3-S08 | Spójność `entityId`/`entityType` | Auto | — | `entityType='deliverable_launch'`, `entityId='{type}-{templateId}'` dla launchera; dla encji — odpowiedni typ encji + id. | Component test asercja kształtu payloadu per ścieżka. | FT-1 |
| E3-S09 | Sec: treść tylko z dostępnej org | oba | 1. Member z dostępem do encji A. 2. Spróbuj zbudować paczkę z encji innej org. | Brak wycieku treści cross-org; paczka budowana tylko z dostępnych zasobów; serwer waliduje scope. | `loginAsMember`; sprawdź network — request po treść encji zwraca 403/404 dla cudzej org. | FT-8 |
| E3-S10 | Dark + light (ścieżki E3-S06 i jedna z encji) | oba | 1. Powtórz E3-S06 i E3-S01 w dark. | Opener/kontekst czatu czytelny w dark. | addInitScript dark; screenshoty `E3-06-from-new-launcher-dark.png`, `E3-01-from-initiative-dark.png`. | FT-3 |

### Selektory do dodania (test-id) — E3
- Przyciski „zrób z tego / zrób deliverable" na encjach: **WYMAGA dodania `data-testid`** (np. `make-deliverable-button` per moduł) — dziś rozsiane po `InitiativesHub`, `MyWork/*`, `IdeaMapWorkspace`, `CanvasPresentationView`, `UnifiedChatPanel`; selektory nie potwierdzone. Każdy E3-S01..S05 jest blokowany do czasu ustalenia/dodania tych test-id.
- Marker kontekstu w czacie po starcie deliverable (np. `data-testid="chat-pending-prompt"` lub atrybut z `entityType`), by Playwright mógł asercjonować że paczka dotarła.

---

## E4 — Routing wyboru → generator/edytor

**Cel:** Po wyborze typu (i ewentualnie po odpowiedzi Teresy w Trybie B) użytkownik trafia do właściwego edytora: doc→`/document-studio` (TipTap), deck→`/presentations/:deckId` (Deck Builder MELS), tabela→grid (`/tabele`). Błąd generacji = uczciwy komunikat (nie biały ekran).
**FT zadeklarowane:** FT-1 (unit), FT-3 (e2e).

> **Uwaga architektoniczna (z kodu):** launcher sam NIE nawiguje do edytora — uruchamia Teresę z openerem. Routing do edytora realizuje się po wygenerowaniu deliverable przez czat. Dlatego E4 dzieli się na: (a) warstwa launcher→czat (deterministyczna), (b) czat→edytor (wymaga LLM). Scenariusze E4-S0x oznaczam typem realizacji.

| ID | Tytuł | Typ | Kroki manualne | Oczekiwane | Playwright (selektory + kroki + screenshot) | FT |
|---|---|---|---|---|---|---|
| E4-S01 | doc → edytor (TipTap) | oba | 1. Launcher → Raport → Blank. 2. W czacie dokończ intencję, wyślij. 3. Poczekaj na wygenerowany dokument. | Po generacji montuje się Document Studio; widoczny edytor `document-tiptap-editor`; trasa `/document-studio`. | przejdź launcher→Raport→Blank; w czacie wyślij intencję; `await expect(page.getByTestId('document-tiptap-editor')).toBeVisible({timeout:60000})`. Screenshot `E4-01-doc-editor-light.png`. **Wymaga LLM** (Tryb B). | FT-3 |
| E4-S02 | deck → builder (MELS) | oba | 1. Launcher → Prezentacja → Blank. 2. Wyślij intencję w czacie. 3. Poczekaj na deck. | Montuje się Deck Builder MELS; `deck-builder-mels-root` widoczny; trasa `/presentations/:deckId`. | analogicznie; `await expect(page.getByTestId('deck-builder-mels-root')).toBeVisible({timeout:60000})`; `expect(page).toHaveURL(/\/presentations\/[\w-]+/)`. Screenshot `E4-02-deck-builder-light.png`. **Wymaga LLM.** | FT-3 |
| E4-S03 | tabela → grid | oba | 1. Launcher → Tabela → Blank. 2. Wyślij intencję. 3. Poczekaj na tabelę. | Montuje się `PlatformGridView`; trasa `/tabele` lub `/my-work/.../table`. | analogicznie; `await expect(page.getByTestId('platform-grid-view')).toBeVisible({timeout:60000})` (test-id **WYMAGA weryfikacji/dodania**). Screenshot `E4-03-table-grid-light.png`. **Wymaga LLM.** | FT-3 |
| E4-S04 | Błąd generacji = uczciwy komunikat | oba | 1. Wymuś błąd generatora (np. brak klucza LLM / 500 na `/deliverables/generations`). 2. Uruchom z launchera. | Użytkownik widzi czytelny komunikat błędu (nie biały ekran, nie surowy stack); możliwość ponowienia. | Mock route `**/deliverables/generations` → 500; uruchom ścieżkę; `expect(page.getByText(/(błąd|error|nie udało)/i)).toBeVisible()`; brak crash (sprawdź `preview_console_logs` — brak uncaught). Screenshot `E4-04-generation-error-light.png`. | FT-3 |
| E4-S05 | Launcher→czat: poprawny opener per typ (deterministyczny) | Auto | 1. Dla każdego typu: launcher → typ → Blank. | Opener czatu zawiera `deliverableKickoffSeed(type)` właściwy dla typu (doc/deck/table) + `deliverableType` zgodny. | Bez LLM: po wyborze asercja, że pendingPrompt/contextData ma poprawny `deliverableType`; reuse `deliverableKickoff.test.ts`. Screenshot `E4-05-opener-per-type-light.png`. | FT-1/FT-3 |
| E4-S06 | Mapowanie typ→API (unit) | Auto (unit) | — | `report→doc`, `presentation→deck`, `table→table` (`toApiType` w `OutputsLauncherModal.tsx:200-201`); generacja woła `/deliverables/generations` z poprawnym `format`. | Unit test na `toApiType` + na `planDeckGeneration/planDocGeneration` (`deliverablesGeneration.ts`) — format zgodny z typem. | FT-1 |
| E4-S07 | Dark parytet edytorów | oba | 1. Powtórz E4-S01/S02 w dark (jeśli LLM dostępny). | Edytory renderują się poprawnie w dark. | addInitScript dark; screenshoty `E4-01-doc-editor-dark.png`, `E4-02-deck-builder-dark.png`. **Wymaga LLM.** | FT-3 |

### Selektory do dodania (test-id) — E4
- `data-testid="platform-grid-view"` na `PlatformGridView` (jeśli brak — **WYMAGA weryfikacji/dodania**) dla E4-S03.
- Marker stanu „generowanie w toku / błąd generacji" w warstwie czatu (np. `data-testid="deliverable-generation-error"`) dla stabilnej asercji E4-S04 (dziś asercja po tekście — kruche, zależne od i18n).

---

## Wykonalność dziś (honest gating)

### Co działa od razu (deterministycznie, bez LLM)
- **E1 (launcher UI):** otwarcie modala, 3 kafle, przejście do kroku 2, wstecz/Escape, zamknięcie, dark/light, reset kroku. **Po dodaniu test-id** (`outputs-new-button`, `launcher-type-*`) — w pełni stabilne. Dziś można uruchomić po tekstach/`aria-label`, ale to kruche (zależne od i18n PL/EN).
- **E2 (galeria, część):** „Blank" zawsze obecny/pierwszy, galeria per typ, loading/error galerii (mock route), i18n etykiet. „Teresa zaproponuje" (E2-S04/S05) wymaga stuba lub LLM.
- **E3 część kontraktowa (E3-S06, S07, S08):** budowa paczki z launchera + asercja kształtu `contextData` — w warstwie component/integration (reuse `deliverableKickoff.test.ts`).
- **E4 część deterministyczna (E4-S04, S05, S06):** błąd generacji (mock 500), opener per typ, mapowanie `toApiType`.

### Co wymaga dodania test-id PRZED automatyzacją (kod źródłowy — poza zakresem tego planu)
| test-id | Plik | Blokuje |
|---|---|---|
| `outputs-new-button` | `ModuleNavBar.tsx:494` | E1-S01..S12 (stabilność) |
| `launcher-type-report\|presentation\|table` | `OutputsLauncherModal.tsx:263` | E1-S02..S05 |
| `launcher-template-blank` + `launcher-template-{id}` | `OutputsLauncherModal.tsx:361/381` | E2-S01..S03 |
| `launcher-suggest-{input\|button\|result}` | `OutputsLauncherModal.tsx:296/305/320` | E2-S04/S05 |
| `make-deliverable-button` (per encja) | `InitiativesHub`, `MyWork/*`, `IdeaMapWorkspace`, `CanvasPresentationView`, `UnifiedChatPanel` | **E3-S01..S05 całkowicie zablokowane** (selektory nie potwierdzone) |
| `platform-grid-view` | `PlatformGridView` | E4-S03 |
| `chat-pending-prompt` / `deliverable-generation-error` | warstwa czatu | E3 (asercja paczki), E4-S04 (stabilność) |

> Dziś, bez tych test-id, E1/E2 da się uruchomić na `getByRole`/`aria-label`/placeholder (kruche), a **E3-S01..S05 (ścieżki z encji) są niewykonalne automatycznie** — selektory przycisków „zrób z tego" nie zostały potwierdzone w rekonesansie i wymagają osobnej inwentaryzacji + test-id.

### Co wymaga flagi / deploya / env
- **Flaga ON:** całe E1/E2/E3-S06/E4 wymaga `VITE_ENABLE_DELIVERABLES_LIGHT='true'` w buildzie FE. Na Railway staging/demo flaga była ustawiana w env build-time (patrz finding „Deliverables VITE flag deploy gap"). **Lokalnie** ustawić w `.env.local` przed `vite build`/dev.
- **E1-S09 (flaga OFF → fallback):** wymaga DRUGIEGO buildu z flagą OFF — nie da się przełączyć runtime (to `import.meta.env`, wstrzykiwane w czasie buildu). Zaplanować jako osobny przebieg/projekt Playwright z innym env, albo zweryfikować w component-teście mockującym `isDeliverablesLightEnabled`.
- **Tab agregatu:** launcher otwiera się tylko na `outputs_all/mine/review`. Deep-link parametru tabu agregatu **WYMAGA weryfikacji** (czy `?tab=outputs_all` istnieje); inaczej test musi kliknąć zakładkę w UI.

### Co wymaga działającego LLM (Tryb B / silnik Teresy)
- **E2-S04/S05** („Teresa zaproponuje") — chyba że istnieje deterministyczny stub `useTemplateSuggestion`; sprawdzić, czy można zmockować route sugestii.
- **E3-S05** (z czatu, intent-detektor) i **całe E4-S01/S02/S03/S07** (czat→edytor) — wymagają realnej generacji deliverable. Zgodnie z findingiem „Deliverables FT-6 pilot blocker": brak ważnego klucza LLM lokalnie blokuje pomiar „mózgu premium". Bez klucza weryfikowalna jest tylko **podłoga deterministyczna** (launcher→opener czatu), nie pełna ścieżka do edytora.
- Rekomendacja: dla E4-S01..S03 albo (a) wpiąć ważny klucz Anthropic (D1) i uruchomić jako `LIVE_PILOT`-podobny przebieg, albo (b) zamockować route `**/deliverables/generations` zwracające gotowy artefakt i zweryfikować sam routing/montaż edytora (tańsze, deterministyczne — zalecane jako pierwsze).

### Środowisko i artefakty
- Uruchomienie: `E2E_BASE_URL`/`E2E_API_URL` na działający stack (dev FE 3000 + API 3001) z flagą ON. Auth przez `loginAsOwner`/`loginAsMember`, zawsze `suppressOnboarding` przed `goto`.
- Screenshoty: `docs/qa/screens/deliverables-E-2026-06-22/` (katalog utworzy spec przez `fs.mkdirSync(...,{recursive:true})`).
- Istniejąca baza testów do reużycia: `tests/components/ReportsAndPresentations/OutputsLauncherModal.test.tsx`, `deliverableKickoff.test.ts`, `OutputsAggregateTabContent.deeplink.test.tsx`, `tests/unit/deliverables/*`.

### Priorytet implementacji (rekomendacja)
1. **Najpierw kod (osobne zadanie):** dodać test-id z tabeli powyżej + zinwentaryzować przyciski „zrób z tego" (E3).
2. **Tura 1 (deterministyczna):** E1 pełne, E2 (bez sugestii), E3-S06/S07/S08, E4-S04/S05/S06. Bez LLM, z mockami route.
3. **Tura 2 (mock generacji):** E4-S01/S02/S03 z zamockowanym `/deliverables/generations`.
4. **Tura 3 (live LLM):** E2-S04/S05, E3-S05, E4-S07 — po wpięciu ważnego klucza Anthropic.
5. **Osobny build:** E1-S09 (flaga OFF).
