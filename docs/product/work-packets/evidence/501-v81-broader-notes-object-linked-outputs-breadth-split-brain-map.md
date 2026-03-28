# 501 - broader Notes object-linked outputs breadth split-brain map

Date: 2026-03-28
Lane: broader `Notes` adjunct / object-linked outputs breadth
Status: active

## Why a broader lane exists

The accepted bounded `T3` notes lane closed one governed notebook adjunct slice only:

- notebook AI proposals continuity,
- notebook convert continuity.

That bounded acceptance intentionally left broader capture/upload and object-linked outputs breadth outside scope.

## Split-brain map

### 1. Governed notebook core/readback vs legacy capture upload initiation

- notebook page list/detail/create/update/delete and notebook convert continuity already have governed V8-first seams under `server/src/routes/v8/my-work.routes.ts`
- the active `NewPageModal` upload CTA still goes through `Api.notebookCaptureUpload()` -> `/api/notebook/capture/upload`
- after that legacy capture step, the client resolves the created page through governed notebook readback, which means upload initiation authority remains the thinner active split-brain seam

### 2. Accepted notebook adjunct lane vs broader object-linked outputs breadth

- the accepted `T3` lane already covered AI proposal strip and convert flow continuity
- broader object-linked outputs breadth still remains in notebook-linked outputs surfaces and capture/upload-related notebook workflows
- this broader lane should not silently reopen the already accepted proposal/convert packets

### 3. Smallest honest first packet

- the first honest packet is not "all notebook outputs"
- the smallest visible seam is notebook capture upload initiation authority continuity on the active notebook creation surface

## First bounded packet decision

Promote `notebook capture upload authority continuity seam` first:

- add governed V8-first parity for notebook capture upload initiation
- keep created-page readback continuity unchanged
- leave wider attachment/output breadth for later bounded reassessment
