# Chat v8 - Enterprise and compliance

> Status: Draft v8
> Cel: Ustawic granice retention, audit, export, admin visibility i compliance semantics dla `Chat v8`.

---

## 1. Po co istnieje ten dokument

Leader-grade chat dla organizacji nie konczy sie na UX.
Musi byc tez wiarygodny dla:
- retention,
- audit,
- export,
- admin controls,
- tenant isolation,
- support and compliance interpretation.

---

## 2. Nadrzedna zasada

`Chat v8` nie moze skladac obietnic enterprise, ktorych produkt nie potrafi utrzymac.

Dokumentacja musi uczciwie rozdzielac:
- co jest canonical enterprise baseline,
- co jest governed policy boundary,
- co jest future/extension.

---

## 3. Enterprise concern areas

### 3.1 Retention

Produkt musi conceptually okreslac:
- co podlega retention,
- kto ustala retention policy,
- jak retention dotyczy conversation content, memory i actions.

### 3.2 Auditability

Produkt musi conceptually okreslac:
- co jest logowane,
- co ma audit trail,
- kto moze przegladac audit.

### 3.3 Export and portability

Produkt musi conceptually okreslac:
- czy i kiedy conversation content moze byc eksportowany,
- czy export jest user-facing czy admin-facing,
- jakie sa granice dla sourced, governed i action-linked content.

### 3.4 Admin visibility

Produkt musi conceptually okreslac:
- kiedy admin lub support ma wglad,
- jakie sa granice privacy vs operational access,
- jak to sie ma do private mode.

### 3.5 Tenant isolation

To jest non-negotiable:
- organizational memory,
- folders,
- conversations,
- sources,
- actions

nie moga przeciekac miedzy tenantami.

---

## 4. Baseline enterprise promises for v8

Minimum enterprise baseline:
- tenant isolation is mandatory,
- governed actions are audytowalne,
- retention boundaries have an owner,
- private mode does not over-promise beyond documented scope,
- permissions and sharing semantics are explicit enough for support and QA.

---

## 5. Relationship to other specs

Enterprise/compliance dla chatu laczy sie z:
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `CHAT_V8_AI_GOVERNANCE.md`

Ten dokument nie zastępuje ogolnych org/compliance docs.
On ustawia chat-specific promises i boundaries.

---

## 6. Non-goals for v8 baseline

Jesli ponizsze nie sa jeszcze jawnie wspierane, dokumentacja musi to mowic:
- full e-discovery suite,
- rich legal hold workflows,
- full customer-configurable retention UI,
- advanced export compliance workflows beyond current product scope.

Brak tych capability nie moze byc ukryty za ogolnym jezykiem "enterprise-ready".

---

## 7. Anti-patterns

- private mode sugeruje zero retention without proof,
- admin visibility left unspecified,
- export semantics guessed by teams,
- organization memory described without tenant rules,
- compliance promises broader than runtime and policy reality.

---

## 8. Definition of done

Enterprise and compliance boundaries sa domkniete, gdy:
- retention owner and boundaries sa wskazane,
- audit expectations sa jasne,
- tenant isolation jest explicite non-negotiable,
- admin/support visibility ma uczciwy contract,
- baseline vs extension promises sa rozdzielone.
