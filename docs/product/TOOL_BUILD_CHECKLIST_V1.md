# Tool Build Checklist V1

> Status: proposed foundation  
> Scope: every new consulting tool built in `Tools`
> Related SSOT: `docs/product/CONSULTING_TOOLS_STANDARD_V1.md`

---

## 1. Purpose

This checklist defines what must exist before a tool is considered ready to build and ready to ship.

It prevents the old pattern where a tool gets runtime UI first and content, Help Center, outputs, and assets are added later or never.

Canonical build sequence:

**Spec -> KB article -> Library preview -> Runtime config -> Outputs mapping -> Assets -> Implementation**

---

## 2. Build phases

### Phase A. Product definition

Required artifacts:

- tool name EN + PL,
- tool slug / `toolType`,
- category,
- short positioning statement,
- when to use,
- required inputs,
- expected outputs,
- common mistakes,
- example,
- next steps,
- target user.

Definition of done:

- a product spec exists,
- output mapping exists,
- UI flow is defined,
- AI role is defined.

### Phase B. Help Center / Knowledge

Required artifacts:

- one canonical KB article in Help Center,
- slug: `tools-<toolType>-how-to`,
- related module binding: `[toolType]`,
- EN + PL content,
- optional video script,
- quick checklist section.

Definition of done:

- Help Center article exists,
- article is linked to the tool deterministically,
- content is aligned with current runtime and outputs.

### Phase C. Library preview

Required artifacts:

- short description,
- `whenToUse`,
- `inputs`,
- `steps`,
- `outputs`,
- `commonMistakes`,
- `example`,
- `nextSteps`,
- what-you-get pills / preview copy.

Definition of done:

- preview is complete in Known Tools metadata,
- preview and KB article do not contradict each other.

### Phase D. Runtime design

Required artifacts:

- stage model / flow,
- work surface type,
- data objects,
- review/finalization logic,
- output step definition,
- AI interaction model.

Definition of done:

- runtime flow is implementation-ready,
- missing-items model exists,
- output step is explicit,
- traceability expectations are defined.

### Phase E. Assets

Required artifacts:

- preview graphic assumptions,
- preview graphic production task,
- 45-60s micro-video script,
- thumbnail / teaser assumptions,
- optional canonical illustration for Help Center.

Definition of done:

- asset assumptions are approved,
- asset production can proceed without additional discovery.

### Phase F. Implementation

Required artifacts:

- frontend implementation backlog,
- backend / API backlog if needed,
- AI / prompt backlog,
- KB / migration backlog,
- tests / smoke path.

Definition of done:

- implementation tickets exist,
- dependencies are visible,
- acceptance criteria are written.

---

## 3. Required per-tool deliverables

For every tool, all of the following must exist:

1. Product spec
2. KB article
3. Known Tools preview content
4. Output mapping
5. Runtime / data-flow definition
6. Graphics assumptions
7. Micro-video script
8. Implementation backlog

No tool is product-ready without all eight.

---

## 4. Minimal runtime checklist

Before implementation starts, confirm:

- the tool fits the canonical `Library -> Session -> Outputs -> Initiatives` model,
- the real user flow is `entry -> conversation -> context -> analysis -> applied conclusions -> final summary -> outputs`,
- the runtime ends in outputs, not summary only,
- the tool can create `initiative`, `report`, `presentation`, and `idea`,
- AI works as mentor / consultant / challenger in `propose -> accept/reject`,
- the session can be finalized,
- source traceability is defined.

---

## 5. Minimal KB checklist

Before a tool is marked content-ready, confirm:

- Help Center article slug is deterministic,
- `related_modules` contains the exact `toolType`,
- title and summary exist in EN + PL,
- article content covers purpose, inputs, stages, interpretation, mistakes, outputs,
- quick checklist exists,
- video script exists or is explicitly marked missing.

---

## 6. Minimal Library checklist

Before a tool is marked preview-ready, confirm:

- `whenToUse` is concrete,
- inputs are visible and understandable,
- steps describe the real runtime,
- outputs match the new universal output contract,
- common mistakes are consulting-relevant,
- example is realistic,
- next steps point to actual downstream actions.

---

## 7. Implementation handoff checklist

Before engineering starts, confirm:

- spec is approved,
- KB article draft is approved,
- preview copy is approved,
- runtime stages are approved,
- output contract is approved,
- any unresolved product decisions are listed explicitly.

---

## 8. Ship readiness checklist

A tool can be considered ready to ship when:

- runtime is implemented,
- output layer works,
- Help Center article is published,
- Known Tools preview is complete,
- traceability is visible,
- at least one smoke path is validated.

---

## 9. Standard adoption gate

Before a tool is marked aligned with the new consulting tools standard, confirm:

- runtime follows `entry -> conversation -> context -> analysis -> applied conclusions -> final summary -> outputs`,
- session uses the canonical `N`-mode shell,
- `initiative`, `report`, `presentation`, and `idea` are the declared output contract,
- `task` is not declared as a direct tool output,
- one deterministic KB article exists under `tools-<toolType>-how-to`,
- `Known Tools` preview, runtime, and KB use the same stage language,
- rollout wave / migration priority is explicitly assigned.
