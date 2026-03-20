# Prezentacje v8 - As-is map

> Status: Draft v8
> Cel: Opisac obecny stan funkcji prezentacji w kodzie i dokumentach oraz zmapowac go na warstwy produktu `v8`.

---

## 1. Najwazniejsze anchor points

### Frontend

- `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`
- `src/components/Presentations/PresentationWizard.tsx`
- `src/components/Presentations/DeckBuilder/`
- `src/components/Presentations/SharedPresentationView.tsx`
- `src/components/MyWork/table/ExportToPresentation.tsx`

### Backend

- `server/src/routes/presentations.routes.ts`
- `server/src/routes/presentation-enterprise.routes.ts`
- `server/src/services/presentationGeneratorService.ts`
- `server/src/services/presentationEnterpriseService.ts`

### Dokumenty

- `docs/product/PRESENTATION_GENERATOR_V3.md`
- `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- `docs/product/PRESENTATION_GENERATOR_VISUALS_IMPLEMENTATION_PLAN_V3.md`

---

## 2. Osadzenie w produkcie

Prezentacje:
- maja glowny punkt wejscia w `ReportsAndPresentationsHub`,
- maja osobny wizard i builder,
- sa uruchamiane takze z artefaktow platformy i `My Work`,
- sa juz czym wiecej niz tylko "export to PPTX".

To oznacza:
- modul nie jest greenfieldem,
- `v8` powinno rozwijac istniejacy produkt, a nie tworzyc obok nowy deck app.

---

## 3. Obecny stan po warstwach

### 3.1 LibraryAndNavigation

#### Co juz jest

- `ReportsAndPresentationsHub` jako glowna biblioteka z tabs `templates / reports / presentations`.
- Routing do wizarda, buildera, shared i embed view.
- Filterable hub z list/card behavior.

#### Wniosek

Biblioteka i entry points istnieja realnie.

#### Luka

Brak jednego `v8` kontraktu, ktory jasno mowi:
- jaka jest rola unified hub,
- jaka jest rola deck-only surfaces,
- ktory entry point jest kanoniczny.

### 3.2 Generation

#### Co juz jest

- `PresentationWizard` ma flow `Sources -> Setup -> Outline -> Generate -> Result`.
- `presentationGeneratorService` buduje outline i deck.
- Backend wspiera templates, intents, brand kit i deck generation endpoints.

#### Wniosek

Generator jest realny, nie papierowy.

#### Luka

Brak jednej warstwy SSOT, ktora spina:
- wizard,
- source semantics,
- outline review,
- role AI i traceability w generate flow.

### 3.3 AuthoringAndDeckModel

#### Co juz jest

- `DeckBuilder` i wiele paneli deck editing.
- `deck_json` / `unified_json` oraz operacje na kartach/slajdach.
- Agent-like deck edits w backendzie.

#### Wniosek

Builder jest juz mocna surface produktu, nie tylko backlogiem.

#### Luka

Brak jednej definicji:
- kiedy user zostaje w wizard,
- kiedy przechodzi do buildera,
- jaki jest kanoniczny model decku dla `v8`.

### 3.4 BrandAndQuality

#### Co juz jest

- brand kit endpoint,
- templates,
- themes/colors,
- visuals pipeline,
- quality gates panels,
- export-oriented polish.

#### Wniosek

System ma juz ambicje "good slides by default".

#### Luka

Brak jednego quality contract, ktory opisze:
- brand rules,
- visual discipline,
- slide quality baseline,
- role visual QA.

### 3.5 TraceabilityAndRefresh

#### Co juz jest

- `source_type`, `source_id`, `source_refs_json`,
- `context_pack_snapshot`,
- refreshable data semantics,
- multiple source-aware export paths.

#### Wniosek

To jest jedna z najmocniejszych przewag `consultify`.

#### Luka

Brak jednej kanonicznej definicji, co znaczy:
- source-backed deck,
- refreshable slide,
- traceable presentation artifact.

### 3.6 DeliveryAndDistribution

#### Co juz jest

- download/export,
- shared view,
- embed view,
- share tokeny,
- analytics,
- export history behavior.

#### Wniosek

Deck jest juz traktowany jako delivery artifact.

#### Luka

Brak jednego, czytelnego modelu `draft -> ready -> shared -> archived` jako produktu.

### 3.7 CollaborationAndReview

#### Co juz jest

- sharing surfaces,
- comments/collab hooks w builderze,
- version/history style panels,
- team/workspace-oriented help w benchmarkach.

#### Wniosek

Zalazek collaboration i review istnieje.

#### Luka

Brak jednego baseline contract:
- co jest review,
- co jest comments,
- co jest collab,
- co nie wchodzi jeszcze do baseline `v8`.

### 3.8 AI-native

#### Co juz jest

- AI narrative generation,
- AI visuals planning i materialization,
- AI image QA,
- agent-like deck edit commands,
- AI-assisted outline and deck generation.

#### Wniosek

Modul prezentacji jest juz AI-enabled na wielu poziomach.

#### Luka

Brak jednego jawnego AI contract dla:
- generate,
- edit,
- refresh,
- visuals,
- speaker notes,
- share-safe governance.

---

## 4. Co jest juz mocne

Najmocniejsze obszary `as-is`:
- wizard and outline-first generation,
- deck builder surface,
- source traceability,
- share/embed/export,
- brand/template foundations,
- AI generation and visuals pipeline.

---

## 5. Co jest jeszcze niejednoznaczne

- relacja `ReportsAndPresentationsHub` vs `PresentationsHub`,
- granica `/api/presentations` vs `/api/presentations-v4`,
- relacja wizard vs builder,
- baseline collaboration vs aspiracyjny team deck product,
- granica miedzy as-is i targetem opisana w starym `v3` SSOT.

---

## 6. Mapa `as-is -> v8`

| Warstwa | As-is strength | Glowna luka v8 |
|---|---|---|
| LibraryAndNavigation | Istnieje realny hub i routing | Brak jednego kanonicznego modelu entry points |
| Generation | Outline-first wizard i generator istnieja | Brak jednego product contract dla generation flow |
| AuthoringAndDeckModel | Builder i deck model sa rozbudowane | Brak jednej definicji wizard vs builder |
| BrandAndQuality | Templates, brand kit i visuals istnieja | Brak quality contract jako SSOT |
| TraceabilityAndRefresh | Source refs i context pack sa realne | Brak jednej definicji source-backed decku |
| DeliveryAndDistribution | Share, embed, analytics, export istnieja | Brak jednego lifecycle delivery artifact |
| CollaborationAndReview | Sa hooks i panele, ale bez pelnego kontraktu | Brak baseline review/collab model |
| AI-native | AI jest osadzone w generation i editing | Brak jednego AI governance contract |

---

## 7. Glowny wniosek

`Prezentacje` w obecnym kodzie nie wymagaja wymyslania od nowa.
Najwieksza luka `v8` nie lezy w samym braku funkcji, tylko w braku jednej, kompletnej i kanonicznej formuly produktu, ktora:
- spina hub, wizard i builder,
- spina traceability i delivery,
- spina AI contract,
- i wyjasnia, ktore elementy sa baseline `v8`, a ktore nadal pozostaja targetem wykraczajacym poza obecny rollout.
