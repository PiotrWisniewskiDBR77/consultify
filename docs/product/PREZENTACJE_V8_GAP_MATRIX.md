# Prezentacje v8 - Gap matrix

> Status: Draft v8
> Cel: Zmapowac obecny stan funkcji prezentacji w `consultify` na target `Prezentacje v8`.
> Metoda: `As-is -> V8 target -> Gap -> Proposal -> Priority -> Dependencies -> Risks`

---

## 1. As-is anchors

Frontend:
- `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`
- `src/components/Presentations/PresentationWizard.tsx`
- `src/components/Presentations/DeckBuilder/`
- `src/components/Presentations/SharedPresentationView.tsx`

Backend:
- `server/src/routes/presentations.routes.ts`
- `server/src/routes/presentation-enterprise.routes.ts`
- `server/src/services/presentationGeneratorService.ts`
- `server/src/services/presentationEnterpriseService.ts`

Produkt:
- `docs/product/PRESENTATION_GENERATOR_V3.md`
- `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`

---

## 2. Module snapshot

### As-is

W kodzie istnieje realny, rozbudowany modul prezentacji:
- unified hub,
- wizard,
- builder,
- templates i brand kit,
- AI generation,
- share/embed/export,
- source traceability,
- enterprise extension path.

### V8 target

Pelny `Gamma-primary`, AI-native, source-backed deck operating system:
- library-first,
- setup/prompt-first,
- outline-first,
- builder-as-second-half,
- brand-safe,
- source-traceable,
- governed przez reviewable AI i delivery lifecycle.

### Top gaps

- brak jednej kanonicznej dokumentacji `v8`,
- brak jednego kontraktu relacji hub vs wizard vs builder,
- brak jednego modelu traceability i refresh semantics,
- brak jednego AI governance contract,
- brak jasnej granicy baseline vs enterprise/aspirational features,
- brak jednej mapy rollout i API surface reality.

---

## 3. Gap matrix

| Area | As-is | V8 target | Gap | Proposal | Priority | Dependencies | Risks |
|---|---|---|---|---|---|---|---|
| Library and navigation | Istnieje `ReportsAndPresentationsHub` i deck routes | Jeden kanoniczny library model dla deckow | Brak jednego SSOT dla entry points i relacji do starszych surfaces | Opisac canonical hub/navigation contract | P0 | routes, hub, docs | Rozjazd miedzy UX i dokumentacja |
| Gamma-primary create flow | Outline-first wizard istnieje | Kanoniczny `library -> create -> setup/prompt -> outline -> generate` flow | Brak jednej definicji create contract | Spisac source/setup/outline/deck contract | P0 | wizard, generator service, templates | Nadmierne obietnice AI generation albo zbyt techniczny flow |
| Builder continuity | `DeckBuilder` istnieje i jest bogaty | Builder jako refinement surface drugiej polowy tego samego workflow | Brak jednej definicji roli buildera wzgledem wizarda | Dookreslic builder contract i continuity wizard -> builder | P0 | deck_json, builder UI, routes | Modul bedzie wygladal jak dwa osobne produkty |
| Template system | Templates istnieja | Template = struktura + intent + brand + source expectations | Brak jednego canonical template contract | Dopisac template semantics i quality rules | P0 | templates DB, brand kit, wizard | Templates beda tylko lista wzorcow bez logiki |
| Brand and quality | Brand kit i visuals pipeline istnieja | Good-by-default branded deck | Brak jednego quality baseline | Zdefiniowac quality gates i brand-safe defaults | P1 | visuals, QA, builder | Decki beda technicznie generowane, ale nierowne jakosciowo |
| Canonical deck model | `deck_json` / `unified_json` i persisted decks juz istnieja | Jeden kanoniczny model decku dla edycji i continuity | Brak jednej definicji canonical deck document vs projections | Zdefiniowac canonical deck model i compatibility bridge | P0 | persistence, builder, generator | Rozjazd danych i niebezpieczna migracja rollout |
| Traceability | Source refs, source ids i context packs istnieja | Source-backed deck jako zasada produktu | Brak jednej definicji source-backed artifact semantics | Spisac traceability contract i refresh model | P0 | generator, exports, source artifacts | Utrata zaufania i refresh bez kontroli |
| Delivery | Share/embed/export/analytics istnieja | Jasny lifecycle `draft -> ready -> shared -> archived` | Brak jednego delivery contract | Dookreslic statusy, analytics i share semantics | P1 | routes, analytics, shared view | Prezentacja pozostanie tylko plikiem do pobrania |
| Collaboration and review | Sa hooks i sharing surfaces | Lekki baseline review/collab | Brak jasnego baseline vs aspirational team features | Zdefiniowac review/collab baseline | P2 | builder hooks, permissions | Overbuild w zlym momencie |
| AI deck operations | Sa AI narrative, visuals i agent-like edits | AI jako glowny builder decku i jeden contract operacji | AI jest rozproszone i niespojnie nazwane | Wydzielic AI governance i operation classes | P0 | AI services, builder, routes | Silent edits lub niespojny UX review |
| API and rollout reality | Sa `/api/presentations` i `/api/presentations-v4` | Jedna jasna mapa runtime reality | Brak jednej prawdy o baseline vs enterprise surface | Opisac rollout/migration reality i API boundaries | P0 | routes, services, migrations | Zla interpretacja tego, co jest naprawde live |

---

## 4. Mapowanie na warstwy `v8`

### LibraryAndNavigation

As-is:
- unified hub i routing istnieja.

Gap:
- brak jednego canonical entry contract.

### Generation

As-is:
- wizard i outline generation istnieja.

Gap:
- brak jednego reviewable generation contract.

### AuthoringAndDeckModel

As-is:
- builder i deck model istnieja.

Gap:
- brak jednego modelu wizard -> builder continuity.

### BrandAndQuality

As-is:
- themes, visuals, quality surfaces istnieja.

Gap:
- brak quality baseline jako SSOT.

### TraceabilityAndRefresh

As-is:
- source refs i context pack sa realne.

Gap:
- brak jednej definicji source-backed and refreshable deck.

### DeliveryAndDistribution

As-is:
- share/export/embed/analytics istnieja.

Gap:
- brak lifecycle delivery artifact.

### AI-native

As-is:
- AI generation i AI edits istnieja.

Gap:
- brak jednego governance modelu i eval framing,
- brak jawnej definicji AI as primary builder.

---

## 5. Priorytety `v8`

### P0 - Baseline `v8`

- canonical hub/wizard/builder model,
- generate contract,
- canonical deck model,
- template contract,
- traceability contract,
- AI governance,
- API/rollout reality map.

### P1 - Strong differentiators

- brand-safe quality baseline,
- delivery lifecycle,
- refresh semantics,
- stronger reviewable deck QA.

### P2 - Expansion

- broader collaboration baseline,
- deeper enterprise team deck capabilities,
- richer operational analytics.

---

## 6. Dependencies

Produktowe:
- `PRESENTATION_GENERATOR_V3.md`
- `PRESENTATIONS_AND_REPORTS_V3.md`
- traceability and export docs

Frontend:
- hub,
- wizard,
- builder,
- shared views

Backend:
- presentations routes,
- enterprise routes,
- generator service,
- visuals services,
- migrations

Cross-module:
- source artifacts,
- reports,
- notebook,
- `My Work` export flows,
- brand/profile services

---

## 7. Go-live risks for v8

- dokumentacja `v8` nie domknie granicy as-is vs aspirational enterprise,
- AI generation bedzie promowane bez jasnych review gates,
- traceability bedzie istniec technicznie, ale bez product contract,
- builder bedzie rozwijany jak osobny swiat bez continuity z wizardem,
- hub bedzie rozmijac sie z realnym runtime i support expectations.

---

## 8. Wniosek

`Prezentacje` w obecnym kodzie sa juz daleko bardziej rozwiniete niz prosty export module.
Najwieksza luka `v8` nie lezy w samym braku funkcji, tylko w braku jednej, kompletnej i kanonicznej formuly produktu, ktora:
- spina library, wizard i builder,
- spina Gamma-like create flow z realnym runtime,
- spina traceability i delivery,
- spina AI contract,
- i opisuje jasno, co jest baseline `v8`, a co pozostaje dalszym rozwojem ponad aktualny rollout.
