# TESTY — M18 Dokumenty (Document Studio)

> **Moduł:** M18 Document Studio (`/document-studio[/:artifactId]`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** trzy tryby autoringu (Mode1 Intake, Mode2 Template Architect, Mode3 Generate z szablonu), edytor proposalowy 6 poziomów (local/section/global/methodology/source/transformative), QA-gate eksportu (serwerowy 403), persistencja write-through DAO (NAPRAWIONA 2026-06-13: commity `953955bc2b` + `8d2b5d8cf4`, migracje `780`+`781`), wersje/snapshoty/rollback, komentarze, approvals, content-blocks, share-linki, warianty audiencji, cross-module M10/M13/M17.
> **Cel:** agent testujący wykonuje każdy krok i raportuje PASS/FAIL z dowodem (screenshot UI + zrzut payloadu Network + stan DB), ze szczególnym naciskiem na weryfikację trwałości danych po restarcie serwera (cold-start proof — kluczowy cel Fazy 3 wdrożenia).
> **Bazuje na:** `Harvard/wdrozenie-100/M18-dokumenty.md` · `Harvard/modules/M18-dokumenty/KARTA_AUDYTU.md` · `Harvard/podzial/inventory/INV_E_outputs_studia_meeting.md` (sekcja DOKUMENTY poz.1-9) · kod `src/components/DocumentStudio/` + `server/src/routes/document-studio.routes.ts` (96 endpointów) · teczka R3 KOREKTA ZAOSTRZONA (2026-06-13)
> **Legenda:** `[MANUAL]` = ręczna weryfikacja bez automatyzacji; `[FLAG]` = zależne od roli/flagi/capability; `[DB]` = dowód = wiersz/kolumna w bazie; `[L-xx]` = otwarta luka z rejestru teczki; `[EPIK-n]` = pokrycie epiku z sekcji F teczki
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny

### Mapa komponentów

| Komponent | Plik | Odpowiedzialność |
|---|---|---|
| `DocumentStudioView` | `src/components/DocumentStudio/DocumentStudioView.tsx` | Kontener główny, routing faz (intake→outline→document), dwie zakładki: Generate + Plan template; ręczny header (nie MELS — L-07) |
| `DocumentStudioIntakeForm` | `DocumentStudioIntakeForm.tsx` | Formularz Mode1 i Mode3; pola: title, description (wymagane ≥10 znaków), documentType, language, density, goal, audience; picker szablonu (Mode3) |
| `DocumentStudioOutlinePanel` | `DocumentStudioOutlinePanel.tsx` | Podgląd konspektu po zaplanowaniu, zatwierdzenie przed generacją |
| `DocumentStudioDocumentPanel` | `DocumentStudioDocumentPanel.tsx` (~2033 l.) | Shell MELS (reużywa `ExecutiveModuleShell`), centralne płótno dokumentu, prawa szyna narzędzi (Sources/Properties/QA/AI Editor/History/Comments/ShareLinks/Variants/Approvals/ContentBlocks/AccessHistory); eksport MD/DOCX/PDF; snapshoty/rollback |
| `DocumentStudioEditorPanel` | `DocumentStudioEditorPanel.tsx` (~517 l.) | Edytor proposalowy 6 zakresów (scope), approve/reject, audit trail AI |
| `DocumentStudioQaPanel` | `DocumentStudioQaPanel.tsx` (~206 l.) | Raport QA (Brand QA + Language QA), wynik per kategoria, findings per severity, bramka blocking |
| `DocumentStudioTemplateArchitectView` | `DocumentStudioTemplateArchitectView.tsx` (~403 l.) | Mode2: formularz draftu szablonu, lista szablonów (ad-hoc `<ul>` — L-08), approve/deprecate, audit |

### Stan globalny i przepływ

```
URL: /document-studio              → View (faza='intake', tab='generate')
URL: /document-studio/:artifactId  → View (faza='document', resume z DB)

State (lokalny w DocumentStudioView):
  phase: 'intake' | 'outline' | 'document'
  intake: DocumentIntake | null
  outline: DocumentOutline | null
  useLlm: boolean
  activeTemplateId: string | null
  approvedTemplates: DocumentTemplate[]
  artifactId: string | null
  schema: DocumentSchema | null
  planning / generating / loadingArtifact: boolean
  error: string | null
```

### Endpointy kluczowe (z dokumentacji `document-studio.routes.ts`)

| Endpoint | Metoda | Opis |
|---|---|---|
| `/api/document-studio/plan` | POST | Zaplanuj konspekt z intake (Mode1) |
| `/api/document-studio/generate` | POST | Wygeneruj artefakt dokumentu |
| `/api/document-studio/templates` | GET | Lista szablonów |
| `/api/document-studio/templates/plan` | POST | Wygeneruj draft szablonu (Mode2) |
| `/api/document-studio/templates/:id/approve` | POST | Zatwierdź szablon (L-05: brak roli serwerowo!) |
| `/api/document-studio/templates/:id/deprecate` | POST | Deprecjonuj szablon |
| `/api/document-studio/:id/export/:format` | GET | Eksport (md/docx/pdf); 403 `qa_blocking` bez QA; `?qaOverride=true` dla uprawnionych |
| `/api/document-studio/:id/editor/proposals/local` | POST | Propozycja lokalna (scope=local) |
| `/api/document-studio/:id/editor/proposals/section` | POST | Propozycja sekcji |
| `/api/document-studio/:id/editor/proposals/global` | POST | Propozycja globalna |
| `/api/document-studio/:id/editor/proposals/methodology` | POST | Propozycja metodologii |
| `/api/document-studio/:id/editor/proposals/source` | POST | Propozycja źródłowa |
| `/api/document-studio/:id/editor/proposals/transformative` | POST | Propozycja transformacyjna |
| `/api/document-studio/:id/editor/proposals/:pid/approve` | POST | Zatwierdź propozycję |
| `/api/document-studio/:id/editor/proposals/:pid/reject` | POST | Odrzuć propozycję |
| `/api/document-studio/:id/snapshots` | GET/POST | Wersje/snapshoty |
| `/api/document-studio/:id/snapshots/:vid/rollback` | POST | Rollback do wersji |
| `/api/document-studio/:id/qa` | GET | Raport QA |
| `/api/document-studio/:id/share-links` | GET/POST | Share-linki |
| `/api/document-studio/share-links/resolve` | POST | Publiczny konsument share-linka (bez auth) |
| `/api/document-studio/:id/comments` | GET/POST | Komentarze |
| `/api/document-studio/:id/approvals` | GET/POST | Approvals governance |

### Zasada weryfikacji E2E (obowiązkowa)

Każda akcja wywołuje żądanie sieciowe — sama zmiana wyglądu UI to NIE dowód działania. Dla każdego testu:
1. Otwórz DevTools → Network (filtr `/api/document-studio`).
2. Wykonaj akcję.
3. Potwierdź żądanie: metoda HTTP + URL + status response (2xx vs 4xx).
4. Sprawdź body request (payload) i body response (schema/error).
5. Dla testów persistencji: po reload/restart sprawdź `GET /api/document-studio/:id` → dane trwają.

### Kluczowy kontekst — persistencja (NAPRAWIONA L-01)

Commity `953955bc2b` (approvals) + `8d2b5d8cf4` (content-blocks/brand-voice/audience-profiles/source-packs/share-links) z 2026-06-13 przepisały 6 warstw z `new Map()` na Postgres (migracje `780`+`781`). **Cold-start proof na staging to R6 — celem Fazy 3.** Testując persistencję:
- **Przeżywają restart (✅):** editor-state, wersje/snapshoty, komentarze, szablony.
- **Powinny przeżywać po naprawie (weryfikuj!):** approvals, content-blocks, brand-voice, audience-profiles, source-packs, share-links.

### Gating i role

- **Beta-closed:** moduł zablokowany nawigacyjnie; bezpośredni URL `/document-studio` omija bramkę (L-06 — brak beta-guarda na route).
- **Backend:** mount bez `v8FeatureGate` → zawsze ON na BE (inaczej niż M17).
- **Override QA eksportu:** tylko role SUPERADMIN/OWNER/ADMIN/PM/MANAGER (`canOverrideQa`, `documentStudioService.ts:672`).
- **Template approve/deprecate:** serwerowo bez gatingu roli (L-05) — każdy zalogowany może zatwierdzić.

---

## Setup środowiska testowego

1. Dev server FE `:3000`, BE `:3001` — uruchomione jednocześnie.
2. Zaloguj się jako OWNER organizacji DBR77 (`piotr.wisniewski@dbr77.com`).
3. DevTools → Network (filtr `document-studio`) + Console (0 błędów = wymóg).
4. Otwórz `/document-studio` bezpośrednio przez URL (moduł beta-closed nawigacyjnie — dostęp przez URL).
5. Dla testów cold-start: dostęp do terminala z `docker compose restart api` lub do Railway staging (restart usługi).
6. Przygotuj dane testowe:
   - **Brief krótki:** „Raport z wywiadu AI dla zarządu Apator, kwiecień 2026" (dla Mode1)
   - **Brief minimalny (10 znaków):** „test brief" (granica walidacji)
   - **Brief za krótki (9 znaków):** „za krotki" (powinien blokować submit)
   - **Brief długi:** akapit 500+ słów (test graniczny generacji)
   - **Typ dokumentu:** Interview Summary Report
   - **Organizacja:** DBR77
   - **Dla Mode2:** brief szablonu „Executive brief dla komitetu sterującego — styl McKinsey, PL, 5 sekcji"
   - **Dla Mode3:** zatwierdzony szablon z Mode2 (utwórz go jako pierwszy krok)

---

## 1. Nawigacja i wejście do modułu

### 1.1 Beta-gating i dostęp [FLAG][L-06]
- Otwórz sidebar → upewnij się, że M18 Dokumenty ma badge BETA lub jest ukryty/zablokowany.
- Wejdź bezpośrednio na `/document-studio` przez pasek adresu.
- **Asercja:** moduł się ładuje (nie pokazuje ekranu „beta plate"); URL nie jest przekierowywany.
- **[L-06 weryfikacja]:** Potwierdź, że brak `beta-guard` na route — bezpośredni URL zawsze działa dla zalogowanego usera.

### 1.2 Widok startowy (faza=intake, tab=generate)
- Strona pokazuje dwie zakładki: **Generate** (aktywna) + **Plan template**.
- Formularz intake jest widoczny (DocumentStudioIntakeForm).
- Lista zatwierdzonych szablonów jest załadowana (Network: `GET /api/document-studio/templates?status=approved` — 200 lub pusty array).
- Konsola: zero błędów.
- **[L-07 weryfikacja]:** Potwierdź, że header jest ręcznie budowany (NIE ExecutiveModuleShell), szukaj `<tabs>` / ręcznych klas, nie komponentu MELS.

### 1.3 Resume z URL (`/document-studio/:artifactId`) [DB]
- Wejdź na `/document-studio/<istniejący_artifactId>` (z poprzedniego testu lub z danych seed).
- Network: `GET /api/document-studio/:artifactId` → 200 z `{ schema: DocumentSchema }`.
- Faza przeskakuje do `document` — pokazuje DocumentStudioDocumentPanel.
- **Asercja:** tytuł dokumentu widoczny, sekcje załadowane, żaden loader nie wisi.
- **Negatywny:** wejdź na `/document-studio/nieistniejacy-id` → stan error z komunikatem, brak crashu.

---

## 2. Mode1 — Intake → Outline → Document [EPIK-5]

### 2.1 Formularz Intake — pola i walidacja

#### 2.1.1 Pole Title (opcjonalne)
- Wpisz „Test Document M18" → pole title przyjmuje tekst.
- Wyczyść pole → brak błędu walidacji (title opcjonalne).

#### 2.1.2 Pole Description (wymagane, ≥10 znaków)
- Zostaw puste → przycisk Submit wyłączony (`isValid = false`).
- Wpisz 9 znaków („za krotki") → przycisk nadal wyłączony.
- Wpisz 10 znaków („test brief") → przycisk aktywny.
- **Asercja:** `isValid = description.trim().length >= 10 && !loading` — potwierdź w kodzie (`DocumentStudioIntakeForm.tsx:103`).

#### 2.1.3 Document Type (opcjonalne, auto-detect domyślnie)
- Dropdown: sprawdź, że 14 typów + „Auto-detect" się ładuje.
- Wybierz „Interview Summary Report".

#### 2.1.4 Language (PL / EN)
- Domyślna wartość: `pl` — sprawdź.
- Przełącz na `en` → wartość zmieniona.

#### 2.1.5 Density
- 4 opcje: concise / standard / detailed / comprehensive — wyświetlane.
- Domyślna: standard.

#### 2.1.6 Goal
- 5 opcji: inform / decide / approve / recommend / align.
- Domyślna: inform.

#### 2.1.7 Audience (opcjonalne, string CSV)
- Wpisz „zarząd, board" → po submicie parsowane do `["zarząd", "board"]` (split po przecinku + trim).
- Sprawdź w payloadzie: `intake.audience = ["zarząd", "board"]`.
- Zostaw puste → `intake.audience = undefined` (nie `[]`).

#### 2.1.8 Toggle „Use LLM" (`useLlm`)
- Domyślne: `false` (sprawdź checkbox w UI).
- Zaznacz → `useLlm = true` — w payloadzie `POST /plan` pojawi się `useLlm: true`.

### 2.2 Planowanie konspektu (faza intake → outline) [E2E]

#### 2.2.1 Happy path — bez LLM
- Wypełnij: description = brief testowy, type = Interview Summary Report, language = pl, density = standard.
- Kliknij Submit (useLlm = false).
- **Network:** `POST /api/document-studio/plan` → payload `{ intake: {...}, useLlm: false }` → 200 `{ outline, llmRefined: false }`.
- Faza zmienia się na `outline` — OutlinePanel widoczny.
- **Asercja:** konspekt zawiera sekcje z tytułami; `llmRefined` = false widoczne w UI (jeśli renderowane).
- Loading spinner widoczny podczas planowania, znika po odpowiedzi.

#### 2.2.2 Happy path — z LLM (streaming lub sync)
- Zaznacz „Use LLM", kliknij Submit.
- **Network:** `POST /api/document-studio/plan` → `useLlm: true`.
- Konspekt bardziej rozbudowany (LLM).
- **Asercja:** odpowiedź `llmRefined: true` (lub backend decyduje bez flagi w response — odnotuj).

#### 2.2.3 Walidacja intake po stronie serwera
- Wyślij intake z description = 1 znak przez devtools bezpośrednio (`POST /api/document-studio/plan` z `intake.description='a'`).
- **Asercja:** 400 z `{ error: 'intake is required' }` lub analogicznym błędem walidacji.

#### 2.2.4 Błąd sieci podczas planowania
- Symuluj błąd (np. wyłącz network w DevTools, kliknij Submit).
- **Asercja:** stan error pojawia się w UI, faza wraca do `intake`, brak crashu aplikacji.

### 2.3 Outline Panel — przegląd i zatwierdzenie

#### 2.3.1 Przegląd konspektu
- Lista sekcji widoczna z numerami i tytułami.
- Każda sekcja pokazuje `purpose` (jeśli ustawione).

#### 2.3.2 Przycisk „Generuj" / „Generate"
- Kliknij → przejście do fazy `document`, wywołanie generacji.

#### 2.3.3 Przycisk „Wróć" / „Back to intake"
- Kliknij → faza wraca do `intake`, outline tracone (local state), formularz pusty lub prefillowany.

### 2.4 Generacja dokumentu (faza outline → document) [E2E]

#### 2.4.1 Happy path — generacja
- Po zatwierdzeniu outline kliknij Generuj.
- **Network:** `POST /api/document-studio/generate` → payload:
  ```json
  {
    "intake": { ... },
    "outline": { ... },
    "useLlm": true/false,
    "templateId": null
  }
  ```
- Response 201: `{ artifactId, schema: DocumentSchema, titleSnapshot }`.
- URL zmienia się na `/document-studio/:artifactId` (navigate with replace/push).
- DocumentStudioDocumentPanel załadowany z wygenerowanym dokumentem.
- **Asercja:** tytuł dokumentu w nagłówku, sekcje renderowane (heading/paragraph/list/callout).

#### 2.4.2 Generacja z `useLlm=true` vs `useLlm=false`
- Z `useLlm=false`: schema generowana deterministycznie (szybka, placeholder-ish).
- Z `useLlm=true`: schema zawiera realną prozę (LLM).
- **Asercja wizualna:** w obu przypadkach dokument jest wyświetlany bez crashu.

#### 2.4.3 Błąd `template_not_usable` (400)
- Wyślij generate z `templateId` niedostępnego/niezatwierdzonego szablonu.
- **Network:** 400 `{ error: 'template_not_usable' }`.
- **Asercja:** UI pokazuje komunikat błędu, faza nie przechodzi.

#### 2.4.4 Brief graniczny — bardzo długi (500+ słów)
- Wpisz opis 500+ słów w polu description.
- Kliknij Submit → planowanie + generacja.
- **Asercja:** brak timeout UI (spinner widoczny do końca), 200/201 lub sensowny błąd serwera (500), brak crashu.

---

## 3. Mode2 — Template Architect [EPIK-5]

### 3.1 Zakładka „Plan template"
- Kliknij zakładkę „Plan template" (tab='templates').
- `DocumentStudioTemplateArchitectView` widoczny.
- **Network przy wejściu:** `GET /api/document-studio/templates` (bez filtra statusu) → lista wszystkich szablonów.
- [L-08 weryfikacja]: Lista szablonów renderowana jako `<ul>/<li>` (nie FilterableTable) — odnotuj jako znane ograniczenie.

### 3.2 Formularz draftu szablonu

#### 3.2.1 Pola formularza
- Name: wpisz „McKinsey Executive Brief v1".
- Purpose: wpisz brief ≥8 znaków (walidacja: `purpose.trim().length < 8` blokuje submit).
- Document Type: wybierz „Steering Committee Report".
- Audience: wpisz „board, investors".
- Language: PL.
- „Use LLM Refiner" toggle.

#### 3.2.2 Walidacja — purpose za krótki
- Wpisz purpose = „za kr" (6 znaków) → przycisk „Draft template" disabled lub kliknięcie nie wysyła żądania.
- **Asercja:** form handler sprawdza `purpose.trim().length < 8`, brak `POST /api/document-studio/templates/plan`.

#### 3.2.3 Happy path — draft szablonu [E2E]
- Wypełnij formularz, kliknij „Draft template".
- Loading state: `drafting=true`, przycisk zmienia się w spinner.
- **Network:** `POST /api/document-studio/templates/plan` → payload z `{ name, purpose, documentType, audience: [...], language, useLlm }`.
- Response 200: `{ template: DocumentTemplate }` z `status='draft'`.
- Nowy szablon pojawia się na liście (odświeżenie automatyczne po `refresh()`).
- Wybranie szablonu z listy → `selectedTemplateId` ustawione, szczegóły szablonu widoczne (blueprint sekcji, formatting summary).

### 3.3 Zatwierdzanie szablonu [E2E][FLAG][L-05]

#### 3.3.1 Approve jako OWNER
- Zaznacz stworzony szablon (status=draft).
- Kliknij „Approve".
- **Network:** `POST /api/document-studio/templates/:templateId/approve` → 200 `{ template }` z `status='approved'`.
- Badge statusu na liście zmienia się na `approved` (zielony).
- `onTemplateApproved` callback wołany → szablon pojawia się w pickerze Mode3 w zakładce Generate.

#### 3.3.2 [L-05] Approve jako zwykły member (brak gatingu roli)
- Zaloguj się jako zwykły member organizacji (nie admin/owner).
- Wejdź bezpośrednio na `/document-studio`, tab „Plan template".
- Kliknij Approve dla istniejącego szablonu draft.
- **Asercja (aktualna luka L-05):** request przechodzi — 200 (brak 403). Odnotuj w raporcie jako `[FLAG][L-05] KNOWN BUG: brak roli serwerowo`.
- Oczekiwane zachowanie po fixie L-05: 403 dla roli bez ADMIN/OWNER.

#### 3.3.3 Deprecate szablonu
- Kliknij „Deprecate" dla szablonu (status=approved lub draft).
- **Network:** `POST /api/document-studio/templates/:templateId/deprecate` → 200 `{ template }` z `status='deprecated'`.
- Badge zmienia się na `deprecated` (szary).
- Szablon znika z pickera Mode3 (tylko `status='approved'` widoczny).

#### 3.3.4 Audit trail szablonu
- Kliknij na zatwierdzony szablon → szczegóły.
- **Network:** `GET /api/document-studio/templates/:templateId/audit` → lista wpisów audytu.
- Wpisy dla: `template_planned`, `template_approved` (lub `template_deprecated`).

---

## 4. Mode3 — Generate z zatwierdzonego szablonu [EPIK-5][L-04]

### 4.1 Picker szablonu w zakładce Generate
- Przejdź do zakładki „Generate" (tab='generate').
- W formularzu intake pojawia się sekcja „Template" tylko gdy `approvedTemplates.length > 0`.
- Jeśli lista szablonów pusta → sekcja szablonu niewidoczna, tryb = Mode1.
- **[L-08]:** Prawdopodobnie dropdown lub proste `<select>` — nie FilterableTable.

### 4.2 Wybór szablonu → Mode3 switch
- Wybierz zatwierdzony szablon z pickera.
- `inTemplateMode = true` (selectedTemplateId ustawione).
- Pola formularza prefillowane z metadanych szablonu (documentType, language, density, audience).
- **Asercja:** pola uzupełnione automatycznie; użytkownik może je nadpisać.

### 4.3 Generacja z szablonu [E2E]
- Wypełnij wymagane pola (description ≥10 znaków).
- Kliknij Submit.
- **Uwaga:** Mode3 ma `useLlm:false` wymuszony (L-04) — outline krok jest pominięty (generate bezpośrednio bez `POST /plan`).
- **Network:** `POST /api/document-studio/generate` → payload zawiera `templateId: "<id>"`, `useLlm: false`.
- Response 201: `{ artifactId, schema }` — schema jest **placeholder-szkielet** (nie pełna proza LLM).
- **[L-04 weryfikacja]:** Sprawdź w response, czy treść sekcji to rzeczywista proza vs placeholder (np. `[TODO: section content]` lub skrócone bloki). Odnotuj w raporcie.
- DocumentStudioDocumentPanel załadowany.

### 4.4 Walidacja brakujących źródeł
- Zmodyfikuj (przez devtools/API) szablon tak, by wymagał źródła które nie jest dostarczone.
- Wygeneruj z tego szablonu.
- **Network:** `POST /api/document-studio/generate` → 400 `{ error: 'template_not_usable' }` lub `MissingRequiredSourceError`.
- **Asercja UI:** komunikat błędu zawiera informację o brakującym źródle, brak crashu.

---

## 5. DocumentStudioDocumentPanel — shell MELS i płótno dokumentu

### 5.1 Layout i nawigacja

#### 5.1.1 Shell MELS
- Sprawdź czy `ExecutiveModuleShell` jest użyty wewnątrz `DocumentStudioDocumentPanel` (zaimportowany z `@/components/shared/ExecutiveModuleShell`).
- **Asercja:** tak — `DocumentPanel` używa MELS, ale `DocumentStudioView` nie (L-07 dotyczy View, nie Panel).
- Lewa szyna: konspekt (outline sidebar) z listą sekcji; klik sekcji = scroll do niej.
- Centrum: płótno dokumentu (renderowanie sekcji: heading, paragraph, list, callout, JSON fallback).
- Prawa szyna: toolbox (zakładki narzędzi).

#### 5.1.2 Sekcje dokumentu — renderowanie typów bloków
- **Heading:** `block.type='heading'` → `<div className="font-semibold">` z `block.content.text`.
- **Paragraph:** `block.type='paragraph'` → `<p>` z `block.content.text`.
- **List (bulleted):** `block.type='list'` + `style!='numbered'` → `<ul>`.
- **List (numbered):** `block.type='list'` + `style='numbered'` → `<ol>`.
- **Callout:** `block.type='callout'` → `<div className="italic border-primary-500/30">`.
- **Assumption block:** `block.isAssumption=true` → amber border + label „Assumption — needs source".
- **Asercja:** każdy typ renderuje się bez crashu; JSON fallback (`<pre>`) pojawia się tylko dla nieznanych typów.

#### 5.1.3 Breadcrumb / nawigacja powrotu
- Przycisk „Start over" / „Nowy dokument" widoczny.
- Kliknięcie: confirm dialog lub bezpośredni powrót do fazy intake.
- URL wraca do `/document-studio` (bez artifactId).

### 5.2 Prawa szyna — przegląd zakładek

Sprawdź, że każda zakładka prawej szyny jest klikalana i ładuje dane:

| Zakładka | Endpoint | Sprawdź |
|---|---|---|
| Sources / Properties | — | Metadane dokumentu (title, type, density, goal, audience, sourcePackId) |
| QA | `GET /api/document-studio/:id/qa` | Raport QA (lub prompt do uruchomienia) |
| AI Editor | — | DocumentStudioEditorPanel |
| History | `GET /api/document-studio/:id/snapshots` | Lista wersji |
| Comments | `GET /api/document-studio/:id/comments` | Wątki komentarzy |
| Share Links | `GET /api/document-studio/:id/share-links` | Lista share-linków |
| Variants | — | Warianty audiencji |
| Approvals | `GET /api/document-studio/:id/approvals` | Lista approval requests |
| Content Blocks | — | Lista content bloków org |
| Access History | `GET /api/document-studio/:id/access-history` | Historia dostępu |

---

## 6. Edytor proposalowy — 6 zakresów (scopes) [EPIK-5]

### 6.1 Opis zakresów (zidentyfikowane z kodu + API)

| Scope (ID) | Endpoint | Opis |
|---|---|---|
| `local` | `/editor/proposals/local` | Zmiana lokalnego bloku (sectionId + blockId + instruction) |
| `section` | `/editor/proposals/section` | Przepisanie całej sekcji |
| `global` | `/editor/proposals/global` | Globalna zmiana dokumentu |
| `methodology` | `/editor/proposals/methodology` | Zmiana metodologii/podejścia |
| `source` | `/editor/proposals/source` | Dodanie/zmiana źródeł |
| `transformative` | `/editor/proposals/transformative` | Transformatywna restrukturyzacja |

### 6.2 Panel edytora — UI

- Otwórz zakładkę „AI Editor" w prawej szynie.
- Dropdown „Scope" pokazuje 6 opcji.
- Pole instrukcji (textarea) — wpisz komendę.
- Dropdown „Target" pokazuje listę bloków edytowalnych (`editableTargets` = paragraph/heading/list blocks ze schematu; format: `{index}.{blockIndex} {sectionTitle}`).
- Dla scope=`local`: target + sectionTargetId wymagane.
- Toggle „Use LLM" (`useLlm` w EditorPanel, domyślnie `false`).
- Przycisk „Submit" — aktywny gdy `instruction.trim().length > 0` i nie ładuje.

### 6.3 Tworzenie propozycji [E2E]

#### 6.3.1 Scope local
- Wybierz scope=`local`, wybierz blok z dropdownu, wpisz instrukcję „Dodaj akapit o ryzyku".
- Kliknij Submit.
- **Network:** `POST /api/document-studio/:id/editor/proposals/local` → payload `{ sectionId, blockId, instruction, useLlm }` → 200 `{ proposal: DocumentEditorProposal }`.
- `pendingProposal` ustawione → UI pokazuje propozycję z diff (stara vs nowa treść).
- Przyciski: „Approve" i „Reject" aktywne.

#### 6.3.2 Scope section
- Scope=`section`, wybierz sekcję (sectionTargetId), instrukcja „Rozbuduj o case study".
- **Network:** `POST /api/document-studio/:id/editor/proposals/section` → 200.
- Propozycja widoczna.

#### 6.3.3 Scope global
- Scope=`global`, instrukcja „Zmień ton na bardziej formalny".
- **Network:** `POST /api/document-studio/:id/editor/proposals/global` → 200.

#### 6.3.4 Scope methodology
- Instrukcja „Dodaj metodologię PDCA do sekcji 3".
- **Network:** `POST /api/document-studio/:id/editor/proposals/methodology` → 200.

#### 6.3.5 Scope source
- Instrukcja „Dodaj źródło — raport McKinsey".
- **Network:** `POST /api/document-studio/:id/editor/proposals/source` → 200.

#### 6.3.6 Scope transformative
- Instrukcja „Przekształć strukturę na exec summary + appendix".
- **Network:** `POST /api/document-studio/:id/editor/proposals/transformative` → 200.

### 6.4 Approve propozycji [E2E][DB]

- Mając `pendingProposal`, kliknij „Approve".
- **Network:** `POST /api/document-studio/:id/editor/proposals/:pid/approve` → 200 `{ schema: DocumentSchema }` (zaktualizowany schema).
- `onSchemaUpdated(nextSchema)` wołany → płótno dokumentu odświeżone.
- Audit trail zapisany: `GET /api/document-studio/:id/editor/audit` → wpis `action='proposal_approved'`.
- **[DB]:** Sprawdź w audit trail zakładce, że wpis pojawia się.

### 6.5 Reject propozycji [E2E]

- Kliknij „Reject" dla pendingProposal.
- **Network:** `POST /api/document-studio/:id/editor/proposals/:pid/reject` → 200.
- `pendingProposal` wraca do null, płótno bez zmian.
- Audit: wpis `action='proposal_rejected'`.

### 6.6 Audit trail AI [E2E]

- Kliknij „Load audit trail" (lub przycisk odświeżenia w EditorPanel).
- **Network:** `GET /api/document-studio/:id/editor/audit` → 200 `{ auditTrail: DocumentAuditEntry[] }`.
- Każdy wpis: `action`, `timestamp`, `actorId`.
- Akcje w PL (`isPolish=true`): `proposal_created` → „utworzono_propozycje", itd. (funkcja `formatAuditAction`).
- W EN: surowe kody action.

### 6.7 Negatywne — błędy EditorPanel

- Wyślij propozycję z pustą instrukcją (próba przez devtools) → błąd 400 od serwera; UI nie crashuje.
- Wyślij ze scope=`local` bez sectionId → 400 lub serwer zwraca błąd walidacji.

---

## 7. QA Gate i eksport [EPIK-5][S6]

### 7.1 Uruchomienie raportu QA

- Otwórz zakładkę QA w prawej szynie.
- Przycisk „Run QA" / „Uruchom QA" widoczny (init state: brak raportu).
- Kliknij przycisk.
- **Network:** `GET /api/document-studio/:id/qa` → 200 `{ report: DocumentQaReport }`.
- Raport: dwie kategorie (Brand QA + Language QA), każda z score 0-100, pola `blocking`, `summary`, `findings[]`.

### 7.2 Raport QA — wyświetlanie wyników

#### 7.2.1 Wynik nieblokujący (score ≥70, `blocking=false`)
- Score ≥90: zielony kolor (`text-emerald-600`).
- Score 70-89: amber (`text-amber-600`).
- Brak tagu „blocking" w UI.

#### 7.2.2 Wynik blokujący (`blocking=true`)
- Score <70 → czerwony (`text-danger-600`).
- Tag „blocking" widoczny (badge uppercase `BLOCKING`).
- Findings lista: severity `high/medium/low` ze stylami (danger/amber/slate).
- Klik na finding → scroll/link do sekcji/bloku (sprawdź czy `finding.sectionId`/`finding.blockId` działają jako anchor).

### 7.3 Bramka eksportu — 403 bez QA [E2E][S6][KRYTYCZNE]

#### 7.3.1 Eksport bez przeprowadzenia QA
- Kliknij przycisk Eksport (np. „Export PDF") przed uruchomieniem raportu QA lub gdy raport ma `blocking=true`.
- **Network:** `GET /api/document-studio/:id/export/pdf` → **403** `{ error: 'qa_blocking', report: {...} }`.
- **Asercja:** `QaBlockingError` rzucony w `api.ts:207` (`body.error === 'qa_blocking' && body.report`).
- UI pokazuje komunikat błędu z informacją „QA blocking findings prevent export".
- Plik NIE jest pobierany.

#### 7.3.2 Eksport po przejściu QA (score nieblokujący)
- Upewnij się, że QA raport jest nieblokujący (`blocking=false` w obu kategoriach).
- Kliknij Eksport PDF.
- **Network:** `GET /api/document-studio/:id/export/pdf` → 200 `{ url: '...' }` lub response z payload eksportu.
- Plik jest pobierany / link do pobrania widoczny.

#### 7.3.3 Eksport DOCX [E2E]
- Kliknij Eksport DOCX → `GET /api/document-studio/:id/export/docx` → 200.
- Asercja: plik .docx pobierany.

#### 7.3.4 Eksport Markdown [E2E]
- Kliknij Eksport Markdown → `GET /api/document-studio/:id/export/markdown` → 200.
- Asercja: plik .md pobierany.

#### 7.3.5 QA Override — autoryzowany [E2E][FLAG]
- Zaloguj się jako OWNER/ADMIN.
- Dokument z blokującym QA.
- Kliknij „Export with QA override" (lub analogiczny przycisk dostępny dla uprawnionych ról).
- **Network:** `GET /api/document-studio/:id/export/pdf?qaOverride=true` → 200 (bypass QA gate).
- Audit log: wpis `qa_override_export` zapisany (`documentStudioService.ts:668-686`).
- **Asercja:** eksport działa mimo blokującego QA.

#### 7.3.6 QA Override — nieautoryzowany [E2E][FLAG]
- Zaloguj się jako zwykły member (nie OWNER/ADMIN/PM/MANAGER).
- Spróbuj eksportu z `qaOverride=true` przez devtools (Network → prawa kliknij request → copy as fetch → dodaj param).
- **Network:** 403 `{ error: 'qa_override_unauthorized' }` → `QaOverrideUnauthorizedError`.
- Audit log: wpis `qa_override_denied` (niezależnie od próby eksportu, `documentStudioService.ts:672`).

---

## 8. Persistencja — weryfikacja cold-start (KRYTYCZNY FIX L-01) [DB][EPIK-1]

### 8.1 Warstwy persistowane (editor-state, wersje, komentarze, szablony) — cold-start proof

**Cel:** Potwierdzić, że naprawa L-01 (`953955bc2b`+`8d2b5d8cf4`) działa na staging.

#### 8.1.1 Editor-state przeżywa restart [DB][MANUAL]
1. Otwórz dokument, wykonaj propozycję AI, zatwierdź (approve).
2. Sprawdź `GET /api/document-studio/:id` → schema zaktualizowana.
3. Zrestartuj serwer API (`docker compose restart api` lub Railway redeploy).
4. Odczekaj do restartu.
5. Wejdź na `/document-studio/:artifactId`.
6. **Network:** `GET /api/document-studio/:artifactId` → 200 z tymi samymi danymi.
7. **Asercja:** schemat dokumentu identyczny jak przed restartem.
8. **[DB]:** Sprawdź tabelę `document_editor_state` (migracja `20260603`) — wiersz istnieje.

#### 8.1.2 Wersje/snapshoty przeżywają restart [DB][MANUAL]
1. Utwórz snapshot: `POST /api/document-studio/:id/snapshots` → 201 `{ snapshot }`.
2. Zrestartuj serwer.
3. `GET /api/document-studio/:id/snapshots` → lista zawiera wcześniej utworzony snapshot.
4. **[DB]:** Tabela `document_version_snapshots` (migracja 776 l.6) — wiersz istnieje.

#### 8.1.3 Komentarze przeżywają restart [DB][MANUAL]
1. Dodaj komentarz: `POST /api/document-studio/:id/comments` → 200.
2. Sprawdź `GET /api/document-studio/:id/comments` → lista zawiera komentarz.
3. Zrestartuj serwer.
4. `GET /api/document-studio/:id/comments` → lista nadal zawiera komentarz.
5. **[DB]:** Tabela `document_comments` (migracja 776 l.24) — wiersz istnieje.

#### 8.1.4 Szablony przeżywają restart [DB][MANUAL]
1. Utwórz i zatwierdź szablon (Mode2).
2. Zrestartuj serwer.
3. `GET /api/document-studio/templates` → szablon nadal na liście z `status='approved'`.
4. **[DB]:** Tabela szablonów (migracja 769) — wiersz istnieje.

### 8.2 Warstwy naprawione wave5 (approvals, content-blocks, brand-voice, audience-profiles, source-packs, share-links) [DB][MANUAL]

**Cel:** Zweryfikować naprawę L-01 — 6 warstw przepisanych Map→Postgres (mig.780+781).

#### 8.2.1 Share-linki przeżywają restart [DB][MANUAL]
1. Utwórz share-link: `POST /api/document-studio/:id/share-links` z `{ accessScope: 'read' }` → 201.
2. Zapisz `shareLinkId` i `token`.
3. Zrestartuj serwer.
4. `GET /api/document-studio/:id/share-links` → link nadal na liście.
5. `GET /api/document-studio/share-links/:shareLinkId` → 200 (nie 404).
6. **[DB]:** Sprawdź tabelę `document_share_links` (migracja 781) — wiersz istnieje.
7. **Oczekiwane:** PASS (naprawione). Jeśli FAIL → L-01 nie wdrożona na tym środowisku.

#### 8.2.2 Approvals przeżywają restart [DB][MANUAL]
1. Utwórz approval request: `POST /api/document-studio/:id/approvals` → 201.
2. Zrestartuj serwer.
3. `GET /api/document-studio/:id/approvals` → approval nadal widoczny.
4. **[DB]:** Tabela `document_approvals` (migracja 780).

#### 8.2.3 Content-blocks przeżywają restart [DB][MANUAL]
1. Pobierz listę content bloków org.
2. Jeśli puste — utwórz przez API.
3. Zrestartuj, sprawdź listę.
4. **[DB]:** Tabela z migracji 781.

### 8.3 Edycja w dwóch zakładkach — conflict handling [MANUAL]

1. Otwórz `/document-studio/:artifactId` w zakładce A.
2. Otwórz ten sam URL w zakładce B.
3. W zakładce A utwórz i zatwierdź propozycję AI → schema się zmienia.
4. W zakładce B spróbuj edytować dokument.
5. **Asercja:** brak crashu; zakładka B albo wykrywa konflikt (stale schema), albo operuje na swojej lokalnej kopii (odnotuj zachowanie).
6. Po odświeżeniu zakładki B: schema powinna być aktualna (z zatwierdzoną propozycją z A).

---

## 9. Wersje/snapshoty i rollback [S7]

### 9.1 Tworzenie snapshot

- Otwórz dokument, kliknij zakładkę „History" / „Wersje" w prawej szynie.
- Kliknij „Create snapshot" lub analogiczny przycisk.
- **Network:** `POST /api/document-studio/:id/snapshots` → payload `{ label?: '...', reason?: '...' }` → 201 `{ snapshot }`.
- Snapshot pojawia się na liście (versionNumber asc).
- `snapshot.versionId`, `snapshot.label`, `snapshot.capturedAt` widoczne.

### 9.2 Lista wersji

- **Network:** `GET /api/document-studio/:id/snapshots` → 200 lista snapshotów.
- Jeśli brak snapshotów → pusta lista, brak crashu.
- Wiele snapshotów — posortowane rosnąco po `versionNumber`.

### 9.3 Podgląd diff

- Zaznacz snapshot na liście.
- **Network:** `GET /api/document-studio/:id/snapshots/:versionId` → 200 z danymi snapshotu.
- Kliknij „Compare with live" lub analogiczne.
- **Network:** `GET /api/document-studio/:id/diff` → 200 `{ diff: DocumentSchemaDiffResponse }`.
- Diff panel w UI: zaznaczony tekst dodany (zielony) / usunięty (czerwony) lub podobna reprezentacja.
- „Live schema matches the selected snapshot structurally" — komunikat gdy brak różnic.

### 9.4 Rollback do snapshot [E2E][DB]

- Zaznacz starszy snapshot na liście.
- Kliknij „Rollback".
- **Network:** `POST /api/document-studio/:id/snapshots/:versionId/rollback` → payload `{ reason?: '...' }` → 200.
- Płótno dokumentu odświeżone — treść wrócona do stanu ze snapshotu.
- Nowy snapshot tworzony automatycznie po rollbacku (zapis stanu przed rollbackiem).
- **[DB]:** Tabela `document_version_snapshots` — nowy wiersz z `reason='rollback'`.

---

## 10. Komentarze i wątki [DB]

### 10.1 Dodawanie komentarza

- Zakładka „Comments" w prawej szynie.
- Pole tekstowe z placeholder „Add document-level review comment…".
- Wpisz komentarz, kliknij „Add comment".
- **Network:** `POST /api/document-studio/:id/comments` → 200.
- Komentarz pojawia się na liście jako wątek (`thread.root.body`).

### 10.2 Lista wątków

- **Network przy otwarciu zakładki:** `GET /api/document-studio/:id/comments` → lista `CommentThread[]`.
- Każdy wątek: `thread.root.body`, `thread.root.createdAt`, `thread.root.actorId`.
- Usunięty komentarz: `'Deleted comment'` (fallback, `thread.root.body || 'Deleted comment'`).

### 10.3 Persistencja komentarzy po reload [DB]

- Dodaj komentarz, odśwież stronę, wejdź na ten sam `/document-studio/:id`.
- Zakładka Comments: komentarz nadal widoczny.
- **[DB]:** Tabela `document_comments` (mig.776 l.24) — wiersz istnieje.

---

## 11. Share-linki i publiczny konsument [S8][DB]

### 11.1 Tworzenie share-linka

- Zakładka „Share Links" w prawej szynie.
- Kliknij „New share link" lub formularz z polami: `accessScope` (dropdown: `comment/read/...`), `expiresAt` (data opcjonalna), `label` (opcjonalny).
- Kliknij „Create".
- **Network:** `POST /api/document-studio/:id/share-links` → payload `{ accessScope: 'read', expiresAt?, label? }` → 201 `{ shareLink }`.
- Link pojawia się na liście z `shareLinkId`, `label`, status runtime.
- Token share-linka widoczny lub kopiowany.

### 11.2 Lista share-linków

- `GET /api/document-studio/:id/share-links` → lista `DocumentShareLink[]`.
- Każdy: `shareLinkId`, `label`, `accessScope`, `expiresAt`, `runtimeStatus`.

### 11.3 Publiczny konsument (bez auth) [E2E][SEC]

- Skopiuj token share-linka.
- Wyloguj się (lub nowe okno incognito).
- Wyślij `POST /api/document-studio/share-links/resolve` → body `{ token: '<token>', consumerFingerprint?: '...' }`.
- **Network:** 200 `{ document: {...} }` — odpowiedź zawiera **tylko 5 pól whitelisty** (sanitizowany — NIE cały wiersz).
- **[SEC L-06]:** Sprawdź, czy `organizationId` jest w odpowiedzi publicznej (po naprawie SEC-4a nie powinien być).
- **Asercja:** brak `organizationId` w public response (naprawiony 2026-06-13: commit `6689e0a194`).

### 11.4 Revoke share-linka [E2E]

- Zaznacz link, kliknij „Revoke".
- **Network:** `POST /api/document-studio/share-links/:shareLinkId/revoke` → body `{ reason?: '...' }` → 200 (idempotent).
- Status linka zmienia się na `revoked`.
- Po revoke: `POST /api/document-studio/share-links/resolve` z tym tokenem → 404 lub 403.

### 11.5 Rate-limit na public share-resolve [SEC][FLAG][L-06]

- Wyślij 20+ requestów do `POST /api/document-studio/share-links/resolve` w krótkim czasie.
- **Asercja (po naprawie SEC-4b):** od określonego limitu → 429 Too Many Requests.
- Jeśli FAIL (429 nie zwracane) → odnotuj jako L-06 otwarta luka.

---

## 12. Approvals workflow [DB]

### 12.1 Tworzenie approval request

- Zakładka „Approvals" w prawej szynie.
- Kliknij „Request approval" lub analogiczny przycisk.
- **Network:** `POST /api/document-studio/:id/approvals` → 201 z `{ approvalRequest }`.
- Request pojawia się na liście ze statusem `pending`.

### 12.2 Decyzja — approve i reject [E2E][FLAG]

- Jako OWNER/ADMIN (lub wymagana rola) otwórz listę approvals.
- Dla pending approval: przyciski „Approve" + „Reject" widoczne.
- Kliknij „Approve":
  - Pole opcjonalnego komentarza (textarea, placeholder „Optional reviewer comment").
  - **Network:** `POST /api/document-studio/:id/approvals/:approvalId/decisions` → payload `{ kind: 'approve', comment?: '...' }` → 200.
  - Status approval: `approved`.
- Kliknij „Reject" (dla innego approval):
  - **Network:** `POST /api/document-studio/:id/approvals/:approvalId/decisions` → `{ kind: 'reject' }` → 200.
  - Status: `rejected`.

### 12.3 Cancel approval request [E2E]

- Kliknij „Cancel" dla pending approval (tylko requester może anulować lub ADMIN).
- **Network:** `POST /api/document-studio/:id/approvals/:approvalId/cancel` → 200.
- Status: `cancelled`.

### 12.4 Audit approvals [DB][MANUAL]

- `GET /api/document-studio/:id/approvals/:approvalId/audit` → lista wpisów.
- Wpisy: `approval_requested`, `approval_decision_approved` / `rejected`, `approval_cancelled`.

---

## 13. Content Blocks [DB]

### 13.1 Lista content bloków organizacji

- Zakładka „Content Blocks" w prawej szynie.
- **Network:** wywołanie pobierające bloki org → lista `ContentBlockTemplate[]`.
- Każdy blok: `contentBlockId`, `name`, `blockType`, `status`.

### 13.2 Instantiate content block

- Kliknij „Instantiate" dla bloku.
- **Network:** `POST /api/document-studio/content-blocks/:contentBlockId/instantiate` → 200 `{ block, template }`.
- Blok dodany do schematu dokumentu (lub zwrócony jako preview — sprawdź zachowanie).

### 13.3 Insert content block do dokumentu

- Kliknij „Insert" dla bloku.
- **Network:** `POST /api/document-studio/:id/content-blocks/:contentBlockId/insert` → 200.
- Schemat dokumentu zaktualizowany: nowy blok widoczny w sekcji.

---

## 14. Warianty audiencji [DB]

### 14.1 Lista wariantów

- Zakładka „Variants" w prawej szynie.
- **Network:** wywołanie pobierające audience profiles organizacji → lista `DocumentVariantSummary[]`.
- Każdy wariant: `profile.profileId`, `profile.name`, `profile.audienceLabels`, `profile.version`, `plan`.
- Jeśli pusta lista: komunikat „No audience variants configured" lub podobny.

### 14.2 Podgląd wariantu

- Kliknij „Preview" dla wariantu.
- **Network:** `GET /api/document-studio/:id/variants/:profileId` → 200 `{ schema: DocumentSchema, provenance }`.
- Toast: np. „{title}: {N} sections kept, {M} sections dropped, {K} blocks dropped".
- Podgląd wariantu w UI (nie zastępuje głównego dokumentu — read-only view).

---

## 15. Access History [FLAG]

### 15.1 Wyświetlenie historii dostępu

- Zakładka „Access History".
- **Network:** `GET /api/document-studio/:id/access-history` → lista `DocumentAccessHistoryEntry[]`.
- Każdy wpis: `actorId`, `action`, `timestamp`, IP (jeśli rejestrowane).
- Wpisy z bieżącej sesji testowej widoczne (generate, view, export, approve itd.).

---

## 16. Cross-module — ścieżki integracji [EPIK-5]

### 16.1 M17 Outputs → M18 (wejście) [E2E]

- Wejdź na `/presentations` (M17 Outputs).
- Kliknij „New AI document" lub „Nowy dokument AI".
- **Asercja:** SPA-nawigacja do `/document-studio` — URL zmienia się, moduł załadowany.
- **Network:** brak twardego przeładowania; brak błędów konsoli przy przejściu.

### 16.2 M18 → M17 Outputs (rejestracja artefaktu) [E2E][FLAG]

- Utwórz dokument (Mode1, pełny flow).
- Wejdź na M17 Outputs (`/presentations`, zakładka Documents).
- **Asercja:** nowy artefakt dokumentu pojawia się na liście (za `ENABLE_V8_GLOBAL` — jeśli flag ON na środowisku).
- **Network:** `GET /api/artifacts?type=document` → lista zawiera nowy `artifactId`.
- Jeśli `ENABLE_V8_GLOBAL=false` → rejestracja wołana ale Outputs nie wyświetla (404 z V8 gate) — odnotuj.

### 16.3 M10 Wywiad → M18 (generacja z wniosków) [FLAG][MANUAL]

- W module M10 Wywiad: otwórz zakończony wywiad, sprawdź czy istnieje akcja „Utwórz dokument" lub CTA linkujące do `/document-studio`.
- **Asercja:** jeśli CTA istnieje — kliknięcie prefilluje intake w Document Studio (description = streszczenie wniosków z wywiadu, lub `sourceRefs` z ID wywiadu).
- Jeśli CTA nie istnieje — odnotuj jako gap cross-module (zależność programowa SPEC_ZADANIE_01 / L-11).

### 16.4 M13 Inicjatywy → M18 (dokumentacja inicjatywy) [FLAG][MANUAL]

- W module M13 Inicjatywy: otwórz inicjatywę, sprawdź czy istnieje akcja „Dokumentuj" lub CTA do Document Studio.
- Jeśli CTA istnieje — kliknięcie otwiera Document Studio z prefillowanym intake (tytuł inicjatywy, sourceRefs).
- Jeśli brak — odnotuj gap (L-11 zakres).

### 16.5 M18 → M02 Canvas (relacja) [FLAG][MANUAL]

- W czacie (M01/M02 Canvas): odpowiedź w kształcie dokumentu powinna emitować chip „Otwórz jako dokument" (commit `5115dbe679` — B4 feature).
- Kliknij chip → nawigacja do `/document-studio` lub `/document-studio/:artifactId`.
- **Asercja:** dokument z czatu załadowany w Document Studio.
- Sprawdź relację vs Canvas: Document Studio = standalone authoring surface; Canvas = inline preview w czacie. Nie powinny być tym samym (odnotuj czy URL/artefakt różni się).

---

## 17. Testy przekrojowe

### 17.1 Beta-gating poprawność [FLAG]

- Jako zalogowany user (nieadmin) wejdź na `/document-studio` bezpośrednio.
- **Asercja:** moduł się ładuje (beta-guard na route NIE blokuje — L-06 otwarta luka).
- Sprawdź sidebar: M18 Dokumenty = badge BETA lub ukryte/zablokowane.
- Potwierdź, że blokada jest TYLKO nawigacyjna.

### 17.2 i18n — PL i EN [L-09]

- Przełącz język na EN (Settings → Language → English).
- Wejdź na `/document-studio`.
- **Sprawdź (wymagane pola w EN):**
  - Etykiety formularza intake (Description, Language, Density, Goal, Audience).
  - Opcje dropdownów (document types, density, goal).
  - Przyciski (Generate, Plan, Submit, Export, Approve, Reject).
  - Toasty i komunikaty błędów.
  - Audit actions (surowe kody action w EN, nie polskie tłumaczenia).
- **Asercja:** brak hardkodowanych polskich stringów w widoku EN.
- Przełącz na PL → wszystkie etykiety po polsku (audit actions tłumaczone przez `formatAuditAction`).
- **[L-09 weryfikacja]:** `useTranslation` używane w EditorPanel i QaPanel; View/IntakeForm/DocumentPanel prawdopodobnie EN-only. Zidentyfikuj i odnotuj wszystkie hardkodowane EN stringy w UI.

### 17.3 Dark mode [MANUAL]

- Przełącz na dark mode.
- Sprawdź czytelność:
  - Formularz intake: pola, etykiety, dropdowny.
  - Płótno dokumentu: sekcje, bloki, nagłówki, listy, callout (border-primary-500/30 — sprawdź czytelność).
  - Assumption blocks (amber border w dark).
  - QA panel: severity styles (danger/amber/slate w dark).
  - Template list: badge statusów (amber/emerald/slate).
  - Editor panel: dropdown scope, textarea, audit trail.
- Brak białych prostokątów, brak nieczytelnego tekstu, brak wylania kolorów.
- **[L-10 weryfikacja]:** ~40 klas Tailwind sky/emerald/amber/rose — sprawdź czy mają odpowiedniki dark: (dark:text-emerald-300 itp.).

### 17.4 A11y (dostępność)

- Formularz intake: pola z `<label>` lub `aria-label`, błędy walidacji z `role="alert"` lub opisem.
- Przyciski: `aria-label` lub czytelny tekst, nie tylko ikona.
- Spinner loading: `aria-busy="true"` lub `role="status"`.
- Focus trap: modals (jeśli są) zatrzymują focus.
- Nawigacja klawiaturą: Tab przez formularz, Enter submit, Esc cancel.
- Screen reader: tytuł dokumentu, struktury sekcji.

### 17.5 Stany graniczne UI (error/loading/empty)

- **Loading state:** spinner podczas `planning`, `generating`, `loadingArtifact` — brak podwójnych kliknięć (przycisk disabled w trakcie).
- **Error state:** komunikat błędu z opcją retry (lub powrót do intake) — bez białego ekranu.
- **Empty states:** brak szablonów → „No templates yet." lub analogiczne; brak komentarzy → „No comments yet."; brak share-linków → „No share links yet." (sprawdź stringi).
- **[L-08 silentfail]:** `refreshApprovedTemplates` w View swallows error → `setApprovedTemplates([])`. Gdy API szablonów zwróci 500 → sekcja pickerMode3 znika (nie crash, nie error message). Odnotuj.

### 17.6 Zero błędów w konsoli

- Podczas całej sesji testowej (wszystkie powyższe sekcje) konsola = 0 błędów.
- Warningi React (missing key, prop-types, useEffect deps) — zanotuj ale nie blokują PASS.
- Network 4xx inne niż testowane (np. 403 QA gate) = nie liczą się jako błędy jeśli UI obsługuje je poprawnie.

### 17.7 Kombinacje i stress

- Utwórz 5 propozycji AI bez zatwierdzania, potem zatwierdź wszystkie → każda powinna mieć osobny `pendingProposal` workflow lub UI jasno wskazuje, że tylko jedna propozycja może być pending.
- Otwórz eksport w trakcie generowania propozycji → export request powinien czekać lub serwer zwraca aktualny stan schematu.

---

## 18. Testy regresji — testy automatyczne

### 18.1 Uruchom istniejące testy [MANUAL]

```bash
# Z katalogu projektu:
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify

# Testy FE
npx vitest run src/components/DocumentStudio/__tests__/

# Testy BE
npx vitest run server/src/services/documentStudio/__tests__/

# Testy routes BE
npx vitest run server/src/routes/__tests__/document-studio-share-links.routes.test.ts
npx vitest run server/src/routes/__tests__/document-studio-assets.routes.test.ts
```

Oczekiwane: **889 PASS / 0 FAIL** (baselie z audytu 2026-06-11).

### 18.2 Znane luki testowe [L-02][L-03]

Poniższe NIE są pokryte testami automatycznymi (do dopisania):

| Luka | ID | Opis | Priorytet |
|---|---|---|---|
| S4 DAO+PG cold-start | L-02 | Test używa `vi.mock` na DAO — nie dotyka realnego PG; nie wykryje 6/8 in-memory | P0-test |
| S6 HTTP 403 route | L-03 | Bramka testowana na serwisie, nie HTTP; `grep qa_blocking` w testach = 0 | P0-test |
| E2E S1 w PR-gate | L-02 | `test-suite.yml` tylko `[main,develop]`; brak na branchu Londyn | P1 |

Weryfikuj ręcznie w tej specyfikacji (§7.3, §8).

---

## 19. Mapa epików → sekcje specyfikacji

| Epik (teczka F) | Story | Sekcje testów |
|---|---|---|
| **EPIK 1** — Trwałość 6/8 warstw (P1) | 1.1 approvals/share-links cold-start; 1.2 cold-start 3 trwałych warstw | §8.1, §8.2, §11.4, §12 |
| **EPIK 2** — Bezpieczeństwo | 2.1 template role-gating; 2.2 beta-guard + rate-limit + organizationId | §3.3.2 (L-05), §11.3 (SEC-4a), §11.5 (SEC-4b), §17.1 (L-06) |
| **EPIK 3** — Treść Mode3 | 3.1 Mode3 useLlm:true lub jawny szkielet | §4.3 (L-04) |
| **EPIK 4** — Testy prawdy | 4.1 S4 realny DAO+PG; 4.2 S6 HTTP 403 | §18.2 (L-02, L-03); §7.3 (manual E2E) |
| **EPIK 5** — Kanony | 5.1 MELS na View; i18n; tokeny; lista szablonów FilterableTable | §1.2 (L-07), §17.2 (L-09), §17.3 (L-10), §3.1 (L-08) |
| **EPIK 6** — Higiena migracji | 6.1 duplikat mig.776 | nie testowane manualnie — task dla dewelopera (D-03) |

---

## 20. Format raportu z testów

Dla każdego punktu/podpunktu powyżej:

```
### §X.Y — [Tytuł testu]
**Kroki:** [opis wykonanych kroków]
**Oczekiwane:** [asercja z tej specyfikacji]
**Faktyczne:** [co się stało]
**Status:** PASS / FAIL / SKIP (z powodem) / [FLAG] (znana luka)
**Dowód:**
  - Screenshot UI: [ścieżka lub opis]
  - Network payload: [metoda + URL + status + body kluczowe pola]
  - DB/state: [tabela + kolumna + wartość, jeśli [DB]]
**Przy FAIL:** plik:linia, opis przyczyny, propozycja fixu
```

---

## Definition of Done (DoD)

**Moduł M18 Document Studio zalicza Fazę 4 (żywa weryfikacja) gdy:**

1. **S1** Mode1 intake→outline→document działa E2E — Network potwierdzony (PASS §2.2, §2.4).
2. **S2** Mode2 Template Architect — draft, approve, deprecate działają E2E (PASS §3.3).
3. **S3** Mode3 z szablonu — generacja działa, `useLlm=false` potwierdzone lub D-02 zrealizowana (PASS §4.3).
4. **S4** Cold-start proof — editor-state + wersje + komentarze + szablony przeżywają restart na staging (PASS §8.1); 6 wave5 warstw przeżywa restart jeśli mig.780+781 zastosowane (PASS §8.2).
5. **S5** Edytor proposalowy 6 zakresów działa, approve/reject zaktualizowane schema (PASS §6.3-6.5).
6. **S6** Bramka eksportu: 403 bez QA (PASS §7.3.1), eksport po QA działa (PASS §7.3.2), qaOverride role-gated (PASS §7.3.5, §7.3.6).
7. **S7** Wersje/rollback działają, snapshot przeżywa restart (PASS §9, §8.1.2).
8. **S8** Share-link: create/revoke/public-consume, `organizationId` nie w response publicznym (PASS §11.1-11.4).
9. Cross-module: M17→M18 wejście działa (PASS §16.1).
10. Zero błędów w konsoli podczas całej sesji (PASS §17.6).
11. i18n: PL i EN — bez hardkodowanych stringów w testowanych ścieżkach (PASS §17.2).
12. Dark mode: czytelny (PASS §17.3).

**Blokery twardego DoD:**
- S4 cold-start na staging (`staging` = caboose Railway) musi być zweryfikowany ręcznie po restarcie.
- S6 HTTP 403 musi być potwierdzony przez Network (nie mock).

---

## Testy manualne — Generatory Deliverable (premium DOC quality) — 2026-06-23

> **Sekcja NOWA, dołożona obok istniejącej paczki (§0-§20 wyżej testują EXISTING Document Studio).** Ta paczka testuje warstwę **„Generatory Deliverable" premium DOC** (fala W4): AI-struktura bloków (B3) + content-gen treści — czy raport jest *bogaty* (KPI/callout/tabela/wykres/listy) i *wypełniony realną treścią* (bez kaskady placeholderów), w jakości Kimi/Claude.
> **SSOT:** rubryka [`Harvard/wdrozenie-100/DELIVERABLES_QUALITY_RUBRIC.md`](../wdrozenie-100/DELIVERABLES_QUALITY_RUBRIC.md) §3 (RAPORT/doc) + §6 (karta odbioru) · parametry grafiki [`DELIVERABLES_GRAPHIC_PARAMETERS.md`](../wdrozenie-100/DELIVERABLES_GRAPHIC_PARAMETERS.md) · scenariusze [`docs/qa/deliverables/scenarios/M18_REPORTS.md`](../../docs/qa/deliverables/scenarios/M18_REPORTS.md) (30 doc) + [`VTS_GOLDEN.md`](../../docs/qa/deliverables/scenarios/VTS_GOLDEN.md) (head-to-head) · plany B-series/R-series/X-series.
> **Teczka:** [`Harvard/wdrozenie-100/M18-dokumenty.md`](../wdrozenie-100/M18-dokumenty.md) → sekcja „Generatory Deliverable — premium DOC" (EPIK-G1..G7, GL-01/GL-02).
> **Legenda dodatkowa:** `[FLAG]` = wymaga flagi premium ON · `[NOW]` = wykonalne dziś przez harness · `[BLOCKED-UI]` = wymaga wpięcia premium w UI + deploy (dziś niewykonalne z UI) · `[H2H]` = head-to-head vs referencja.

### MD-0. Preconditions — jak włączyć premium DOC

**Ścieżka A — harness (Scoring-auto, wykonalne DZIŚ) `[NOW]`:**
1. Zdobądź ważny klucz LLM ze stagingu Railway (lokalnie brak = mierzysz podłogę deterministyczną).
2. Z katalogu projektu uruchom runner FT-6 (plain-node, NIE vitest — SDK structured pada pod vitest):
   ```bash
   cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
   ANTHROPIC_API_KEY=<klucz-staging> ENABLE_DELIVERABLES_PREMIUM=true \
     node --import tsx scripts/deliverables/live-pilot-ft6.mts
   ```
   - Runner ustawia `DOTENV_IGNORE_LOCAL=1` → **NIE dotyka `.env.local` (= PROD centerbeam)**, nie inicjalizuje DB. Bezpieczne.
   - Wynik: JSON do `docs/qa/deliverables/runs/<data>-live-pilot-<model>.json` z `byModule[doc].avgScorePct`, `rows[].scorePct/passed/failures/sample.blockTypes/totalBlocks`.
3. **Asercja wstępna (inaczej `test.skip` z powodem):** w wynikowym JSON `rows[doc].tierUsed === 'PREMIUM'` i `fallbackUsed === false`. Jeśli `STANDARD`/`fallbackUsed:true` → mierzysz PODŁOGĘ, nie mózg — popraw klucz/flagę przed oceną jakości.

**Ścieżka B — żywy UI `[BLOCKED-UI]`:** dziś **niewykonalna**. Flaga `ENABLE_DELIVERABLES_PREMIUM` default OFF (`deliverableGenerationTier.ts`), premium niewpięte w chat→canvas→studio; intake Document Studio mówi „deterministic first draft". Te kroki opisane, by były gotowe po: (a) flaga ON na Railway, (b) wpięcie w UI, (c) deploy + live-verify w przeglądarce.

**Dane złote (golden):** używaj scenariuszy z `M18_REPORTS.md` (S01 memo / S06 diagnoza HR / S16 raport diagnostyczny 8 sekcji / S19 redesign procesu) oraz VTS doc (diagnoza gotowości AI VTS, 8 sekcji) z `VTS_GOLDEN.md`.

### MD-1 [NOW][FLAG] — Bogactwo bloków: pełny raport (KPI + callouty + tabela + wykres + listy)

- **Cel:** premium B3 buduje raport z ≥5 distinct typów bloków (nie ściana prozy) — EPIK-G1, rubryka K3/K5/K6.
- **Wejście:** golden **S16** („Pełny raport diagnostyczny Apator", 8 sekcji) LUB VTS doc (8 sekcji).
- **Kroki:**
  1. Uruchom runner FT-6 (MD-0 ścieżka A) z premium ON.
  2. Otwórz wynikowy JSON → `rows[]` gdzie `module==='doc'` i `id` zawiera `S16`.
  3. Odczytaj `sample.blockTypes`, `sample.sections`, `sample.totalBlocks`.
- **Oczekiwane (rubryka §3 + M18_REPORTS S16, bramka ≥85%):**
  - `sections` ∈ [7, 9].
  - `sample.blockTypes` zawiera ≥5 distinct typów, w tym ≥1 `kpi`, ≥1 `table`, ≥1 `callout`, ≥1 `bulletList` (wykres `chart` opcjonalny dla raportu diagnostycznego, ale w S16 golden referencyjny ma `chart`).
  - `sample.totalBlocks` znacząco > liczba sekcji (bogactwo, nie 1 blok/sekcja).
  - `scorePct ≥ 85%`, `passed:true` (lub fail tylko na miękkim kryterium liczbowym).
  - **Referencja z sesji 2026-06-22 (Sonnet 4.6):** S16 = 8 sekcji, **68 bloków**, 9 typów (heading/text/kpi/callout/bulletList/table/chart/numberedList/image), **100% PASS**.
- **Dowód:** wycinek JSON (`rows[doc S16].sample`) + ścieżka pliku run.

### MD-2 [NOW][FLAG][KRYTYCZNE] — BRAK kaskady placeholderów (regresja buga GL-01)

- **Cel:** wykryć bug GL-01 (per-section content schema `z.record` niespełnialny → circuit-breaker OPEN → reszta dokumentu kaskaduje do PLACEHOLDER, **podczas gdy structural scorer dalej pokazuje 100%**). To jest „zielony scorer maskuje martwy mózg" — patrz teczka H'/GL-01.
- **Jak go rozpoznać (TELL):** struktura zielona (typy bloków OK, scorePct strukturalny wysoki) **ALE** treść bloków to zaślepki: `"This section is awaiting content"`, `[TODO]`, puste `content.text`, powtarzający się ten sam stub w wielu blokach, tabele z samymi `—`.
- **Kroki:**
  1. Uruchom runner na golden ≥6 sekcji (S16 lub VTS doc) z premium ON.
  2. Otwórz **pełny artefakt** (nie tylko `sample` ze scoringu) — JSON artefaktu zawiera treść bloków (np. `docs/qa/deliverables/runs/2026-06-22-VTS-generated.json` jako wzorzec poprawny).
  3. Przejrzyj treść KAŻDEJ sekcji od pierwszej do ostatniej (kaskada zaczyna się po sekcji, na której pękł circuit-breaker — zwykle środek/koniec).
  4. Sprawdź `rows[doc].error` — czy pusty (nie timeout/circuit-breaker).
- **Oczekiwane (po naprawie GL-01):**
  - **0 bloków z treścią-zaślepką** w CAŁYM dokumencie (od sekcji 1 do ostatniej).
  - Treść późnych sekcji równie bogata jak wczesnych (brak „urwania" w połowie).
  - `rows[doc].error` pusty; `sample.totalBlocks` niezerowy.
  - Generowanie per-sekcja zakończone w rozsądnym czasie (po naprawie 247s→27s na sekcję; patrz caveat wydajności MD-6).
- **Przy FAIL (kaskada wróciła):** zanotuj numer sekcji, od której zaczyna się placeholder; sprawdź log circuit-breakera; to regresja GL-01 — schema content-gen wróciła do `z.record`/strict. Plik/mechanizm: `documentBlockContentGenerator.ts` (JSON-string schema + tolerant parser).
- **Dowód:** wycinek treści sekcji pierwszej + ostatniej (porównanie bogactwa) + `rows[doc].error` pusty.

### MD-3 [NOW][FLAG] — Kalibracja liczby bloków (regresja buga GL-02; memo vs raport)

- **Cel:** B3 dobiera liczbę bloków do typu/rozmiaru — memo proste, raport bogaty (EPIK-G1 Story G1.2, bug GL-02).
- **Kroki:** uruchom runner; porównaj `sample.totalBlocks` dla S01 (memo) vs S16 (raport).
- **Oczekiwane (M18_REPORTS):**
  - S01 memo: `blocks` ∈ [5, 7] (proste), 1 sekcja, **bez** `chart`/nadmiaru `kpi`.
  - S16 raport: dziesiątki bloków, 7-9 sekcji.
  - **Rezydualny znany sygnał (miękki, nie blokujący):** w sesji 2026-06-22 S01 dał **11 bloków** (lekka over-production na Sml) — odnotuj jako miękki fail kalibracji, NIE jako placeholder/regresję mózgu.
- **Dowód:** `rows[doc S01].sample.totalBlocks` + `rows[doc S16].sample.totalBlocks`.

### MD-4 [NOW][FLAG] — Grounding (cytowania) + i18n PL/EN

- **Cel:** EPIK-G3 — cytowania wskazują dostarczone źródło (nie zmyślone), `citations[]` osobno od prozy; treść w żądanym języku.
- **Kroki:**
  1. Golden z `minCitations` / źródłem (np. VTS doc — źródło = ankieta wave 2); 2 runy `language:'PL'` i `'EN'`.
  2. Sprawdź `rows[doc].artifact.citations` i treść nagłówków.
- **Oczekiwane (VTS_GOLDEN doc, kryteria 10/ rubryka K7/M2):**
  - `citations[]`/`source_refs[]` obecne i **osobno** od akapitów (nie wplecione), wskazują realne źródło.
  - PL run: nagłówki/treść po polsku; EN run: po angielsku (`anyTextContains` per język).
- **Dowód:** wycinek `artifact.citations` + 2 JSON-y (PL/EN).

### MD-5 [BLOCKED-UI][FLAG] — Render bloków w UI (recharts/tabela/KPI/callout, dark+light)

- **Cel:** EPIK-G4 — premium-wygenerowane bloki renderują się wizualnie w `DocumentTipTapEditor`, spójne dark/light (rubryka G1-G5; R-series R1-S03..S06, R3).
- **Status:** `[BLOCKED-UI]` — wymaga premium wpiętego w UI. Wykonaj po EPIK-G7.
- **Kroki (po wpięciu):**
  1. Wygeneruj raport premium (S16/VTS doc) i otwórz w `/document-studio/:artifactId`.
  2. DevTools → sprawdź render: `.doc-table-block table` (ramki, nagłówek), `.recharts-responsive-container`/`.recharts-surface` (wykres SVG, osie, serie), `.doc-kpi-strip__card` (label/value/delta), callout (tło/ikona).
  3. Przełącz dark mode (init-script lub Settings) — powtórz.
- **Oczekiwane:** każdy typ bloku renderuje się bez crashu i overflow; w dark — kontrast ≥4.5:1, osie/linie/ramki czytelne, brak crimson-leak. 0 błędów w konsoli.
- **Dowód:** screenshot UI (light + dark) → `docs/qa/screens/deliverables-R-<data>/`; Network: brak 5xx.

### MD-6 [NOW][FLAG] — Wydajność / latencja (caveat)

- **Cel:** premium kończy generację dużych dokumentów (z akceptacją, że trwa minuty) — bez timeoutu/crasha.
- **Oczekiwane (caveat z teczki G'):** S16 ~226s, S19 ~267s — **kończy się**, ale minuty latencji. `rows[doc].error` pusty (NIE timeout). To znana cecha, nie bug; w UI wymaga widocznego, niewiszącego spinnera (sprawdzić po wpięciu).
- **Dowód:** czas runu per scenariusz + `error` pusty.

### MD-7 [BLOCKED-UI][FLAG] — Parytet eksportu DOCX/PDF (wykresy/tabele/kolory NIE degradują do tekstu)

- **Cel:** EPIK-G5 / rubryka G8 — wyeksportowany DOCX/PDF NIESIE wykresy (rasteryzowane X3), tabele z ramkami, kolory — nie sam tekst.
- **Status:** `[BLOCKED-UI]` do wpięcia + live-verify; część fidelity wykonalna jako Export-fidelity-vitest (X-series, parsowanie bajtów pliku — patrz X1/X3).
- **Kroki (po wpięciu):**
  1. Premium raport z wykresem + tabelą → Export PDF (po przejściu QA-gate, §7.3 wyżej) + Export DOCX.
  2. Otwórz PDF/DOCX (Word przez computer-use dla MQ-R10).
- **Oczekiwane:** wykres osadzony jako obraz (X3 `documentChartRasterizer` → PNG, nie pominięty); tabela z ramkami/nagłówkiem; listy jako prawdziwe listy Word (nie ręczne „• "); parytet z ekranem (G8, brak degradacji do tekstu).
- **Dowód:** plik .pdf/.docx + screenshot otwartego pliku; (fidelity-auto) parsowanie X-series.

### MD-8 [H2H][BLOCKED-UI] — Head-to-head vs Kimi/Claude na VTS golden (MQ-R11)

- **Cel:** EPIK-G6 / rubryka §3 MQ-R11 — nasz doc na złotym temacie VTS ≥ referencja (Kimi-Claude) na KAŻDYM wymiarze graficznym 3C i merytorycznym 3B.
- **Wejście:** VTS golden doc (`VTS_GOLDEN.md` sekcja 2) — „pełny raport diagnostyczny gotowości na AI dla VTS Group" (8 sekcji, KPI-strip + callouty + tabela działów + wykres trendu). Ten sam intent wrzucony do Kimi-Claude.
- **Kroki:**
  1. Wygeneruj nasz doc (premium) — porównaj z `docs/qa/deliverables/runs/2026-06-22-VTS-generated.md` (referencyjny McKinsey-grade sample).
  2. Wygeneruj/zdobądź wersję Kimi-Claude tego samego intentu.
  3. Wyrenderuj oba do PDF/PNG (nasz: `documentPdfRenderer.ts`; ich: ich export).
  4. Wypełnij KARTĘ ODBIORU (rubryka §6) — 3 oceny: Kompletność (maks 16, próg ≥90%), Merytoryka (maks 10, próg ≥80%, M1 grounding≠0 + M2 język≠0), Grafika (maks 16, próg ≥80%, żaden wymiar=0), + head-to-head per wymiar.
- **Oczekiwane (VTS_GOLDEN doc ACCEPTANCE, bramka ≥85%):**
  - `sections` ∈ [7,9]; ≥5 distinct block types; ≥1 `kpi` (3-5 itemów), ≥2 `callout`, ≥1 `table` (gotowość wg działów: wiersz dla ≥6 z 8 działów), ≥1 `bulletList`, ≥1 `chart`; każda sekcja ma `heading`; sek. 1 wymienia średni indeks gotowości jako liczbę; `citations[]` osobno.
  - **Porównanie vs Kimi-Claude (nota „vs konkurent"):** (a) bogactwo bloków — czy konkurent daje ścianę prozy a my KPI-strip/tabelę/wykres/callout; (b) struktura 7-9 logicznych sekcji; (c) trafność warningu o jakości danych (callout); (d) typografia A4 (H1→body, measure 50-75ch) vs surowy markdown; (e) rekomendacje z właścicielem + horyzontem (actionability).
  - **WERDYKT:** ODEBRANY ⟺ Kompletność PASS ∧ Merytoryka PASS ∧ Grafika PASS ∧ nasz ≥ ref na każdym wymiarze. Przegrana na choćby jednym wymiarze graficznym = DO POPRAWY.
- **Dowód:** 2× PNG/PDF (nasz vs Kimi-Claude) + wypełniona Karta odbioru (3 oceny + tabela head-to-head per wymiar) zapisana w `docs/qa/deliverables/runs/<data>/h2h-doc/`.

### MD-9. Mapowanie EPIK → scenariusz → wykonalność

| Scenariusz | EPIK (teczka F') | Pokrywa | Wykonalność |
|---|---|---|---|
| MD-1 | EPIK-G1 | bogactwo bloków (≥5 typów) | `[NOW]` harness |
| MD-2 | EPIK-G2 / GL-01 | **brak placeholder-cascade** (regresja zamaskowanego buga) | `[NOW]` harness (czytaj treść artefaktu) |
| MD-3 | EPIK-G1 / GL-02 | kalibracja liczby bloków | `[NOW]` harness |
| MD-4 | EPIK-G3 | grounding + i18n PL/EN | `[NOW]` harness |
| MD-5 | EPIK-G4 | render bloków (recharts/tabela/KPI), dark/light | `[BLOCKED-UI]` po wpięciu |
| MD-6 | (caveat) | latencja dużych dokumentów | `[NOW]` harness |
| MD-7 | EPIK-G5 | parytet eksportu DOCX/PDF (X1/X3) | `[BLOCKED-UI]` + fidelity-vitest |
| MD-8 | EPIK-G6 | head-to-head vs Kimi/Claude (MQ-R11) | `[H2H]` (render NOW, ocena ekspercka; UI-h2h po wpięciu) |

### MD-10. DoD premium DOC (uzupełnienie do DoD §powyżej)

Premium DOC zalicza bramkę jakości gdy:
1. **FT-6 ≥85%** na ≥3 golden (S01/S06/S16) — `tierUsed:PREMIUM`, `fallbackUsed:false` (MD-1). **Stan 2026-06-23: SPEŁNIONE — doc avg 92%, S06/S16 100% PASS.**
2. **0 placeholder-cascade** na golden ≥6 sekcji (MD-2) — regresja GL-01 nie wróciła. **Stan: GL-01 naprawione.**
3. Kalibracja bloków OK (MD-3) — **GL-02 naprawione, rezydualny miękki sygnał na Sml.**
4. Grounding + PL/EN (MD-4).
5. **[BLOCKED-UI]** render bloków + parytet eksportu live-verified (MD-5, MD-7) — **pending wpięcie premium w UI (EPIK-G7) + deploy.**
6. **[H2H]** ≥1 karta odbioru head-to-head vs Kimi/Claude na VTS golden = ODEBRANY (MD-8) — pending render + ocena.

**Bloker twardy:** premium niewpięte w żywy UI (intake = „deterministic first draft"). Kroki `[BLOCKED-UI]`/`[H2H]` nieodhaczalne dopóki: flaga `ENABLE_DELIVERABLES_PREMIUM` ON na Railway + wpięcie chat→canvas→studio + deploy + live-verify. Nie raportować „jakość UI potwierdzona" bez żywego LLM przez UI.
