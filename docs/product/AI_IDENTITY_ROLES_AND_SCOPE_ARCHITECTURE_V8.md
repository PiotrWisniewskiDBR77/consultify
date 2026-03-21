# AI Identity Roles And Scope Architecture v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: zdefiniowac kanoniczny model `identity`, `effective role`, `scope resolution` i `AI consumer visibility`.

---

## 1. Why this matters for Consultify

To samo zapytanie AI ma inny sens, jesli user dziala jako:

- osoba prywatna,
- czlonek organizacji,
- wlasciciel projektu,
- konsultant,
- admin,
- albo agent wykonawczy dzialajacy w czyims imieniu.

Bez jednego modelu identity i scope AI bedzie nieprzewidywalne i trudne do audytu.

---

## 2. Leader patterns

Leaders consistently expose or imply:

- project-aware scope,
- private vs shared knowledge boundaries,
- stable visibility semantics across threads and files.

Imported lesson:

AI scope must be derived from effective identity, not from ad hoc local flags.

---

## 3. Current V8 coverage

Strong inputs exist in:

- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `ROLES_MODEL.md`
- `PROJECT_ROLES_AND_GOVERNANCE.md`

Current gap:

- brak dokumentu, ktory bezposrednio laczy platform role model z AI consumers and AI scope resolution.

---

## 4. Canonical target architecture

Canonical resolution chain:

`identity -> organization membership -> effective role -> active workspace/project -> allowed scopes -> AI consumer permissions`

Required objects:

- `EffectiveAIIdentity`
- `EffectiveAIScope`
- `ConsumerScopeGrant`
- `ScopeExplanation`

## 4.1 Leader-grade hardening requirements

This architecture must also define:

- identity projection for employees, consultants, admins, service actors and delegated runs,
- precedence rules between private mode, project scope and org policy,
- support-visible explanation of effective scope for any run or answer,
- break-glass or elevated review semantics where enterprise policy allows them.

---

## 5. Contracts and boundaries

Platform governance docs own human role semantics.

This document owns:

- how those roles translate into AI-visible scope,
- how chat, execution, workers and retrieval inherit effective access,
- how scope is explained and audited.

---

## 6. Risks and failure modes

- same user sees different scope behavior in different AI surfaces,
- consultant overlay leaks broader org knowledge than intended,
- support cannot explain effective scope at run time,
- private mode conflicts with org-level policy.

---

## 7. Implementation implications

- define one AI identity projection model,
- define one effective scope snapshot reused by chat, retrieval and execution,
- surface scope explanation in user and support paths,
- prevent consumer-specific scope drift.

---

## 8. Acceptance criteria

- AI scope can be explained from identity, role and active context.
- All AI consumers use one effective scope model.
- Private, shared and project-specific access boundaries remain consistent.
- Support can inspect effective AI scope for any run or response.

---

## 9. Related canonical docs

- `docs/product/CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `docs/product/KNOWLEDGE_RAG_V8_SSOT.md`
- `docs/product/CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `docs/product/ROLES_MODEL.md`
- `docs/product/PROJECT_ROLES_AND_GOVERNANCE.md`
- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
