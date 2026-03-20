# Chat v8 - Gap matrix

> Status: Draft v8
> Cel: Porownac obecny stan chatu z docelowym `Chat v8`, wskazac priorytety, zaleznosci i ryzyka.

---

## 1. Jak czytac te matrix

Kazdy wiersz opisuje:
- obszar produktu,
- target `v8`,
- obecny stan,
- gap,
- priorytet,
- ryzyko lub zaleznosc.

---

## 2. Matrix

| Area | Target v8 | As-is | Gap | Priority | Notes |
|---|---|---|---|---|---|
| Canonical shell | One shell for full and split product truth | `UnifiedChatPanel` strong, but full route still on `AIChatWelcomeView` | Two-shell product contradiction | P0 | Biggest structural blocker |
| Route model | One canonical full chat route contract | Full route and split route semantics differ | Product and docs diverge | P0 | Must be frozen in runtime truth map |
| Split mode | Clear workspace-native co-working model | Real, but partly spread across layout/store/context | Missing single product formula | P0 | Core Consultify advantage |
| History | Full library system | Real search/folders/archive/star/rename/delete/move | No single formal lifecycle model | P0 | Strong base, weak SSOT |
| Folder semantics | `Chat folder` separate from PMO project | Mixed naming and partial logic drift | Mental model confusion | P0 | Must be explicit everywhere |
| Search | Honest, scalable conversation retrieval | Client-side search active, server support only partly used | Search semantics incomplete | P1 | Needs clear baseline/target split |
| Attachments local files | Strong grounded file work | Real | Needs clearer contract and limits | P1 | Keep and formalize |
| Attachments URL | Honest URL ingest path | Real in unified path, not equally across all shells | Surface inconsistency | P1 | Must be classified |
| Cloud sources | Honest source availability | Partial | UI promise exceeds runtime | P1 | No false completeness |
| Scope/focus | One explicit source/scope model | Concept exists, UI/UX incomplete | User cannot always control or understand scope | P0 | Key parity requirement |
| Source transparency | Clear sourced answer expectations | Partial, often best-effort | No full user-visible contract | P0 | Critical for trust |
| Deep research | Clear gated advanced flow | Confirm gate exists | Needs canonical workflow and review semantics | P1 | Good base |
| Co-thinkers/personas | Explicit runtime contract | Config exists | Behavioral guarantee insufficiently formalized | P2 | Governance/documentation task |
| Model and modes | Clear user-facing control model | Real toggles and selectors | Product semantics fragmented | P1 | Needs one contract |
| Pending actions | Clear propose/review/approve/reject model | Real indicator and approve path | Execution semantics and reject path not fully honest | P0 | Critical to trust |
| Message actions | One consistent action layer | Mixed across shells | Not all action systems align | P1 | Needs response model/spec |
| Feedback | One real pipeline | Real on unified path, legacy drift elsewhere | Duplicate/legacy/fake path confusion | P1 | Needs consolidation |
| Voice | One coherent user-facing system | Dictation, TTS and STT pieces exist | Product story weaker than runtime possibilities | P1 | Needs dedicated spec |
| Artifact handoff | Save outcomes into work system | Partly real | Needs explicit canonical actions model | P1 | Local differentiator |
| Documentation | One `Chat v8` package as SSOT | Fragmented docs | No safe build-ready package | P0 | This program addresses it |

---

## 3. Biggest P0 gaps

### 3.1 Two-shell contradiction

Without fixing documentation truth here, every later UI or backend improvement risks reinforcing two different products.

### 3.2 Scope and source clarity

Leader-grade chat cannot rely on hidden or implied context rules.
User must understand why the model answered this way.

### 3.3 Action governance clarity

If the system proposes business actions, approval and execution semantics must be exact, not approximate.

### 3.4 History as product, not component

Current history is stronger than expected, but still under-defined at product level.

---

## 4. Key dependencies

- runtime truth must be frozen before implementation plan is trusted,
- canonical vocabulary must separate `chat folder` from `PMO project`,
- source and scope model must align UI, store, stream payload and docs,
- action model must align UI, API, and backend executor,
- voice model must align visible controls with runtime capabilities.

---

## 5. Risks if gaps remain unresolved

- users will experience full chat and split chat as different products,
- QA will validate the wrong shell or wrong controls,
- retrieval and citation trust will stay soft,
- cloud and voice will keep overpromising,
- AI actions can erode trust if approve/reject semantics are unclear,
- future implementation will keep patching symptoms instead of following one target model.

---

## 6. Strategic conclusion

`Chat v8` is not blocked by lack of raw capability.
It is blocked mainly by:
- product coherence,
- source-of-truth coherence,
- and explicit contracts for history, scope, retrieval, actions and voice.

That is why the `v8` package must define not only a better target, but also one honest map from current runtime to future product.
