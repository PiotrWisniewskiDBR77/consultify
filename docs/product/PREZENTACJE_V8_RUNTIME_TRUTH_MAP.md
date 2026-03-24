# Prezentacje v8 - Runtime truth map

> Status: Draft v8
> Cel: Zamknac jedna wykonawcza prawde runtime dla prezentacji, tak aby zespol wiedzial, ktore capabilities naleza do glownego spine'u produktu, a ktore pozostaja extension runtime.

---

## 1. Po co istnieje ten dokument

Pakiet `PREZENTACJE_V8_*` ustawia model produktu.
Ten dokument ustawia model wykonawczy:
- ktory runtime jest kanoniczny dla glownej sciezki usera,
- ktore endpointy sa w baseline spine,
- ktore endpointy sa enterprise / extension,
- jak unikac podwojnego rozwijania tych samych capabilities.

Zrodla prawdy:
- `server/src/routes/presentations.routes.ts`
- `server/src/routes/presentation-enterprise.routes.ts`
- `server/src/services/presentationGeneratorService.ts`
- `src/services/api.ts`

---

## 2. Zasada nadrzedna

Kanoniczny user flow `v8` jest jeden:

`library -> create -> setup/prompt -> outline -> generate -> builder -> present/share/export -> analytics`

Dla tego flow kanonicznym runtime spine jest:
- `ReportsAndPresentationsHub`
- `PresentationWizard`
- `DeckBuilder`
- `/api/presentations`

`/api/presentations-v4` nie jest rownolegla druga historia produktu.
To runtime rozszerzen:
- enterprise controls,
- rollout-safe governance extras,
- advanced bindings,
- import/governance/collab/media rights features.

---

## 3. Capability matrix

| Capability | User-facing role | Primary runtime today | Extension runtime today | Canonical owner for v8 | Decision |
|---|---|---|---|---|---|
| Shared deck read | Public/shared presentation open | `/api/presentations/shared/:token` | none | baseline | Zostaje w baseline |
| Library list | Deck listing in hub | `/api/presentations/decks` | none | baseline | Zostaje w baseline |
| Deck detail | Builder/open deck | `/api/presentations/decks/:id` | none | baseline | Zostaje w baseline |
| Template list/detail/clone/update | Create flow templates | `/api/presentations/templates*` | `/presentations-v4/template-governance*` tylko governance | baseline + extension | Template usage w baseline, governance w extension |
| Brand kit | Setup and output defaults | `/api/presentations/brand-kit` | none | baseline | Zostaje w baseline |
| Intent catalog | Wizard outline/setup help | `/api/presentations/intents` | none | baseline | Zostaje w baseline |
| Style profile defaults | AI/setup defaults | `/api/presentations/style-profile` | none | baseline | Zostaje w baseline |
| Outline generation | Review gate | `/api/presentations/generate/outline` | none | baseline | Zostaje w baseline |
| Full deck generation | AI-first creation | `/api/presentations/generate/deck` | none | baseline | Zostaje w baseline |
| Direct deck create from structured slides | Export or ingestion helper | `/api/presentations/decks` POST | none | baseline helper | Zostaje jako helper runtime |
| Builder autosave | Persist edited deck | `/api/presentations/decks/:deckId/autosave` | none | baseline | Zostaje w baseline |
| Agent edit | Current in-place AI mutation | `/api/presentations/decks/:deckId/agent-edit` | none | baseline, but must be reworked | Nie rozwijac dalej as-is; zastapic target AI ops contract |
| Block refresh | Refreshable block content | `/api/presentations/decks/:deckId/cards/:cardId/blocks/:blockId/refresh` | `/presentations-v4/bindings/:bindingId/refresh` | split | Simple refresh in baseline, governed binding refresh in extension |
| Share link create | Delivery | `/api/presentations/decks/:id/share` | none | baseline | Zostaje w baseline |
| PPTX download | Delivery | `/api/presentations/decks/:id/download` | none | baseline | Zostaje w baseline |
| PDF export | Delivery | `/api/presentations/decks/:id/export/pdf` | none | baseline | Zostaje w baseline |
| HTML export | Delivery | `/api/presentations/decks/:deckId/export/html` | none | baseline | Zostaje w baseline |
| PNG export | Delivery | `/api/presentations/decks/:deckId/export/png` | none | baseline | Zostaje w baseline |
| Share analytics write/read | Delivery telemetry | `/api/presentations/decks/:deckId/analytics*` | none | baseline | Zostaje w baseline |
| Quality gates | Output hardening | `/api/presentations/decks/:deckId/quality-gates` | `/presentations-v4/decks/:deckId/export-qa` | split | UX quality gates w baseline, export QA records w extension |
| Data bindings | Structured artifact binding | none | `/api/presentations-v4/decks/:deckId/bindings*` | extension | Extension until baseline needs governed bindings |
| Layout rules | Advanced layout governance | none | `/api/presentations-v4/layout-rules*` | extension | Extension |
| Export QA records | Advanced export verification | none | `/api/presentations-v4/decks/:deckId/export-qa*` | extension | Extension |
| Template governance publish flow | Controlled template ops | none | `/api/presentations-v4/template-governance*` | extension | Extension |
| PPTX import | Reverse ingestion | none | `/api/presentations-v4/pptx-imports*` | extension | Extension |
| Realtime collab session | Team editing presence | none | `/api/presentations-v4/decks/:deckId/collab/*` | extension | Extension |
| Media rights workflow | Media governance | `/api/presentations/media` basic org media read | `/api/presentations-v4/media*` | split | Baseline media browsing vs extension rights/governance |

---

## 4. Canonical ownership by product stage

### 4.1 Library

Canonical runtime:
- `GET /api/presentations/decks`
- `GET /api/presentations/templates`
- `GET /api/presentations/style-profile`

Not canonical for baseline:
- template governance publish workflows from `/api/presentations-v4`

### 4.2 Create / setup / outline

Canonical runtime:
- `GET /api/presentations/templates/:id`
- `GET /api/presentations/brand-kit`
- `POST /api/presentations/generate/outline`
- `GET /api/presentations/intents`

Not canonical for baseline:
- advanced template governance

### 4.3 Generate

Canonical runtime:
- `POST /api/presentations/generate/deck`

Supporting runtime:
- `presentationGeneratorService.ts`

Not canonical for baseline:
- enterprise bindings as a hard dependency for deck generation

### 4.4 Builder persistence

Canonical runtime:
- `GET /api/presentations/decks/:id`
- `PUT /api/presentations/decks/:deckId/autosave`

Legacy-but-live runtime:
- `POST /api/presentations/decks/:deckId/agent-edit`

Decision:
- builder persistence remains in baseline,
- `agent-edit` is treated as transitional runtime and must not become the long-term AI contract.

### 4.5 Refresh

Canonical baseline runtime:
- `POST /api/presentations/decks/:deckId/cards/:cardId/blocks/:blockId/refresh`

Canonical extension runtime:
- `POST /api/presentations-v4/bindings/:bindingId/refresh`
- `POST /api/presentations-v4/bindings/:bindingId/approve`

Decision:
- baseline refresh = block-level best-effort refresh,
- extension refresh = governed binding lifecycle.

### 4.6 Deliver

Canonical runtime:
- `POST /api/presentations/decks/:id/share`
- `GET /api/presentations/shared/:token`
- `GET /api/presentations/decks/:id/download`
- `GET /api/presentations/decks/:deckId/export/pdf`
- `POST /api/presentations/decks/:deckId/export/html`
- `POST /api/presentations/decks/:deckId/export/png`

Supporting quality runtime:
- `POST /api/presentations/decks/:deckId/quality-gates`

Extension-only:
- `POST /api/presentations-v4/decks/:deckId/export-qa`

### 4.7 Analytics

Canonical runtime:
- `POST /api/presentations/decks/:deckId/analytics/view`
- `GET /api/presentations/decks/:deckId/analytics`

No extension runtime should replace these for baseline deck delivery.

### 4.8 Collaboration

Canonical v8 baseline:
- review/share semantics only

Extension runtime:
- `/api/presentations-v4/decks/:deckId/collab/join`
- `/api/presentations-v4/collab/:sessionId/presence`
- `/api/presentations-v4/collab/:sessionId/leave`
- `/api/presentations-v4/decks/:deckId/collab/active`

Decision:
- collab is not a baseline gating dependency for Gamma-like product parity.

---

## 5. Capability decisions the team must follow

### 5.1 What must not be duplicated

Do not create a second baseline implementation for:
- deck listing,
- outline generation,
- deck generation,
- autosave,
- share/export,
- analytics.

Those already belong to `/api/presentations`.

### 5.2 What must stay extension-only until explicitly promoted

Keep in `/api/presentations-v4` until product intentionally promotes them:
- governed bindings,
- template governance publish flow,
- export QA records,
- PPTX import,
- realtime collab presence,
- media rights workflows.

### 5.3 What must be bridged, not forked

These are split today and require a bridge contract:
- refresh,
- quality validation,
- media usage,
- template governance vs template consumption.

---

## 6. Runtime consolidation rules

### Rule 1

If a capability is required for the canonical user path `hub -> wizard -> builder -> deliver`, it must have a single canonical owner in baseline runtime.

### Rule 2

If a capability exists in both baseline and extension, baseline owns the user-facing happy path and extension owns governance, approval, or advanced enterprise variants.

### Rule 3

No new feature should be implemented first in `/api/presentations-v4` if the capability is necessary for standard deck creation or delivery.

### Rule 4

`agent-edit` may remain live, but all future AI mutations must be specified against the target AI operations contract, not against the current keyword-driven helper.

---

## 7. Support-ready routing interpretation

When support or implementation teams ask "where does this live?", the default answers should be:

- Library, create, generate, builder save, share, export, analytics:
  `/api/presentations`
- Governance extras, bindings, import, export QA, collab, advanced media rights:
  `/api/presentations-v4`

If the answer is "both", the team must document:
- baseline owner,
- extension owner,
- promotion rule,
- migration consequence.

---

## 8. Open migration decisions still required

This document closes ownership, but not full implementation.
The following still need engineering work:
- replace `agent-edit` with reviewable AI mutation contract,
- define when block refresh should escalate to governed bindings,
- decide whether quality-gates summary writes to extension QA records,
- decide when basic `/media` browsing should read through extension media governance.

---

## 9. Build-ready outcome

Po wdrozeniu zasad z tego dokumentu zespol ma pracowac tak:
- glowny produkt budujemy na `/api/presentations`,
- `/api/presentations-v4` traktujemy jako controlled extension layer,
- nie rozwijamy dwoch rownoleglych historii deck runtime,
- kazda nowa capability ma od razu przypisanego jednego wlasciciela runtime.
