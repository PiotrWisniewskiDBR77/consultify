# Presentation Generator v3 — Visuals (Gamma‑like) Implementation Plan

> **Status:** Implementation plan (v3)  
> **Priorytet:** P0 (jakość decków)  
> **Cel:** “Kliknij → wygeneruj → wow” dzięki połączeniu **deterministycznego PPTX renderera** + **LLM (narracja)** + **IMAGE_MODEL (grafika)** z kontrolą “quality vs cost”.

## 1) Kontekst (as‑is w repo)

- **Wizard (frontend)**: `src/components/Presentations/PresentationWizard.tsx`
- **API (backend)**: `server/src/routes/presentations.routes.ts`
- **Generator**: `server/src/services/presentationGeneratorService.ts`
- **Renderer PPTX**: `server/src/services/report/pptx/PptxPipelineService.ts` + layouty `server/src/services/report/pptx/layouts/*`
- **Kontrakt visuali**: `UnifiedSlide.visuals?: SlideVisualSpec[]` w `server/src/services/report/pptx/types.ts`
- **MVP visuals** (już w kodzie): cover + background textures (best‑effort) sterowane `setup.visuals.priority`

## 2) Zasady produktu (Gamma‑like, ale “Consultify-grade”)

- **Deterministyczny layout** (PPTX): tabele/wykresy/typografia muszą być idealnie czytelne.
- **AI = “visual fill” + styl + kontekst**, nie “dane”.
- **Propose → accept**: AI proponuje obraz/slot; UI pokazuje i pozwala regenerować/wyłączyć.
- **Quality vs cost**: zawsze jawna decyzja (domyślnie “quality” dla sales/demo).
- **Compliance**: dataClass/polityka rezydencji blokuje zewnętrznych providerów dla `confidential`.

## 3) Docelowa formuła (pipeline)

### 3.1 Warstwy (idealny miks)

1. **Narrative Planner (LLM)** → outline + key messages (SlideIntent)
2. **Slide Writer (LLM)** → `SlideContent` per intent (treść “fit-to-slide”)
3. **Visual Director (LLM)** → `visuals[]` (slot + purpose + prompt + paleta + constraints)
4. **Image Generator (IMAGE_MODEL)** → generuje assety, zapisuje i uzupełnia `asset.path`
5. **Vision QA (LLM)** → scoring + reject/regenerate (1 iteracja max)
6. **PPTX Renderer (deterministyczny)** → osadza obrazy w layoutach (layering) + export

### 3.2 Sloty i purpose (kontrakt v3)

- `purpose=image_cover` → `slot=cover_bg|hero`
- `purpose=image_slide_asset` → `slot=background_texture|side_illustration|icon_strip`
- `purpose=image_diagram` → `slot=diagram`

## 4) Plan realizacji (workstreams + kolejność)

### Workstream A — Product knobs (UX + API contract)

**Cel:** użytkownik jednym ruchem steruje jakością i “ilością grafiki”.

- **A1**: Rozszerzyć `setup.visuals` w Wizardzie i backendzie:
  - `enabled: boolean`
  - `priority: 'quality'|'cost'`
  - `imageDensity: 'low'|'medium'|'high'`
  - `imageStylePreset?: string` (np. `abstract_geometric`, `corporate_photography`)
  - `imageSource?: 'smart'|'org_library'|'ai_only'|'none'`
- **A2**: UI: sekcja “Visuals” w kroku Setup:
  - toggle ON/OFF
  - radio quality/cost
  - density slider (low/med/high)
  - style preset (opcjonalnie)
- **AC (acceptance criteria)**:
  - request do `/presentations/generate/deck` niesie te pola
  - wyłączenie visuals daje deterministyczny deck bez network calls do IMAGE_MODEL

### Workstream B — Visual Director (plan obrazów per intent)

**Cel:** zamiast hardcodu, obraz jest dobierany kontekstowo “jak Gamma”.

- **B1**: Dodać serwis `VisualDirectorService` (LLM) który:
  - bierze `UnifiedReportJSON` + template + brand kit
  - zwraca `visuals[]` per slide (slot + purpose + prompt + palette)
  - respektuje `imageDensity` i `priority`
- **B2**: Integracja z `presentation_templates.recommended_visuals`:
  - template może narzucać sloty (np. cover zawsze ma hero)
  - director dopasowuje prompty do treści slajdu
- **B3**: Standard promptów:
  - zawsze “no text in image” dla tła/hero (chyba że infographic)
  - “low visual noise / high readability”
  - paleta oparta o brand kit
- **AC**:
  - dla tej samej treści i presetów powstaje przewidywalny plan slotów (mała wariancja)
  - director nie zwiększa liczby obrazów ponad limit density

### Workstream C — Image provider adapters + routing (enterprise v3)

**Cel:** wybór modelu po `purpose` + polityka rezydencji + quality/cost.

- **C1**: Standard interfejsu adaptera (tekst → obraz, opcjonalnie edit):
  - input: `purpose`, `prompt`, `styleHint`, `palette`, `size/aspect`, `quality`
  - output: `buffer|dataUri|url`, metadane (provider/model/seed)
- **C2**: Provider baseline (kolejność wdrożenia):
  - **OpenAI** (już) — szybki start
  - **Flux (fal.ai / Replicate)** — wysoka jakość i elastyczność
  - **Ideogram** lub **Recraft** — jeśli wchodzimy w “text-in-image” / brand assets
  - **Local SDXL/ComfyUI** (opcjonalnie) — dla orgów z `confidential`
- **C3**: Routing:
  - `ai_purpose_assignments` (global/org) + `organization_ai_policy`
  - `priority=quality` preferuje `tier=PREMIUM|STANDARD`, `cost` preferuje `BUDGET|STANDARD`
- **AC**:
  - brak skonfigurowanego providera → warning + fallback (bez fail)
  - polityka rezydencji blokuje zewnętrzne generowanie przy `confidential`

### Workstream D — Asset storage (Media Library v3) + re-use

**Cel:** nie generować tych samych tekstur w kółko; mieć bibliotekę org.

- **D1**: Struktura storage:
  - ścieżki `exports/presentations/assets/<deckId>/...` (MVP)
  - docelowo: `OrganizationMediaLibrary` (DB + object storage) + cache/dedupe
- **D2**: Hashing/dedupe:
  - hash = (`prompt` + model + preset + palette + size)
  - jeśli hash istnieje → re-use zamiast regeneracji (quality mode nadal może generować warianty)
- **D3**: Metadane do traceability:
  - prompt, model_id, provider, created_at, deckId, slideIndex, slot, purpose
- **AC**:
  - użytkownik może “regenerate visual” bez psucia reszty decka
  - assety są sprzątane (retencja) albo przenoszone do Media Library

### Workstream E — Vision QA (quality gate dla grafiki)

**Cel:** jakość “premium”, nie przypadkowa.

- **E1**: Vision QA check:
  - czy jest “slide-friendly” (niski noise, brak watermark)
  - czy paleta pasuje do brandColor
  - czy nie zawiera tekstu (dla slotów tła)
- **E2**: Score + 1 iteracja:
  - jeśli score < threshold → 1 regen z poprawionym promptem
- **AC**:
  - flake rate nisko: QA nie może często odrzucać wszystkiego (limit iteracji)
  - zawsze finalny fallback (brak visuali) i nadal “ładny deck”

### Workstream F — Layout upgrades (PPTX) pod sloty

**Cel:** obrazy muszą wyglądać “jak z templates”, nie “doklejone”.

- **F1**: Ujednolicić, jak layouty konsumują sloty:
  - cover: `cover_bg` (pełny bleed) + opcjonalnie `hero` (np. prawa część)
  - section_intro/key_messages: `background_texture` z transparencją
  - executive_summary/single_insight: `side_illustration` (prawy panel)
  - diagram intents: `diagram` (contain, bez crop)
- **F2**: Zasady readability:
  - overlay card background, blur/opacity, “safe margins”
- **AC**:
  - tekst zawsze czytelny (kontrast)
  - obraz nie nachodzi na tabele/wykresy

### Workstream G — Observability + koszty (mimo że “quality first”)

**Cel:** mieć metryki, kontrolę i audit.

- **G1**: Logowanie `purpose/kind/latency/status/price_snapshot_id` dla image calls (jak w `AIPipeline`)
- **G2**: Price snapshots dla `per_image` / `per_mp` (dla image providers)
- **G3**: Alerting:
  - skok kosztu / czasów / error rate (provider outage)
- **AC**:
  - SuperAdmin widzi użycie i może odciąć provider/purpose

### Workstream H — Testy (L1–L5) + stabilność CI (wspólne z planem testów)

**Cel:** zero flakiness w PR gate, visuals testowane deterministycznie.

- **L1 (unit)**:
  - Visual Director plan: “intent → sloty” (bez network)
  - routing selection: policy allow/deny
- **L2/L3 (integration)**:
  - `/presentations/generate/deck` z visuals:
    - (a) enabled + brak assignment → warning, success
    - (b) enabled + stub adapter → asset zapisany, visual wpisany w unified_json
- **L4 (E2E smoke)**:
  - wizard flow: outline → generate deck → download
  - tryb visuals OFF (deterministyczny)
  - tryb visuals ON ale bez API key (fallback)
- **L5 (security/perf)**:
  - rate-limit na generację obrazów
  - timeouty i circuit breaker na providerach
  - PDF/PPTX export size limits

## 5) Harmonogram (proponowany)

### Etap 0 (1–2 dni): “Foundation & knobs”
- A1/A2 + feature flags + ograniczenia (density/priority)
- testy L1 dla routingu/policy

### Etap 1 (3–5 dni): Visual Director v1 + 2–3 layouty premium
- B1/B3 + F1 dla cover/section_intro/key_messages/executive_summary
- E1 (prosty QA) — opcjonalnie za flagą

### Etap 2 (5–10 dni): Multi-provider + Media Library MVP
- C2 (Flux/Ideogram/Recraft wg priorytetu) + D1/D3
- L4 smoke (visuals OFF/ON fallback) jako PR gate

### Etap 3 (ciągłe): Quality hardening
- E2 scoring + regen
- D2 dedupe + re-use
- rozszerzenia layoutów (diagram/side illustrations)

## 6) Ryzyka i mitigacje

- **Flakiness** (sieć, provider) → stub adapters w testach, timeouts, fallback zawsze.
- **Czytelność** → zasady “low noise” + overlay cards + QA scoring.
- **Koszt** (przy quality) → limity density, caching, re-use backgroundów.
- **Compliance** → polityka org + dataClass gating (local-only dla confidential).

## 7) Definition of Done (DoD) dla “Gamma-like visuals”

- Wizard ma kontrolki visuals (ON/OFF, quality/cost, density).
- Min. 4 intent-y wspierają visuals slotami (cover, section intro, key messages, exec summary).
- Visual Director generuje plan slotów (bez hardcodu per-intent w generatorze).
- Co najmniej 2 provider adaptery (1 premium, 1 szybki) + routing per purpose.
- Vision QA działa za flagą (quality mode).
- Testy: L1 + L4 smoke (OFF i fallback) stabilne w PR gate.

