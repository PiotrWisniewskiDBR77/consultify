# T4 Charter - Landing Anna Prompt-Quality / Retrieval-Quality

> Status: active
> Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
> Lane: `Landing Anna prompt-quality / retrieval-quality`
> Taxonomy: `T4`
> Priority: highest
> Last updated: 2026-03-26

---

## 1. Goal

Promote the broader public Anna quality lane from visible backlog into active execution and improve the real quality of Anna's answers without broadening into multilingual rollout, analytics dashboard breadth, or full voice-product redesign.

This lane exists because the bounded Anna series closed placement, fallback, telemetry integrity, and reopen continuity, but did not yet close the broader quality of prompt shaping and retrieval shaping on the live public surface.

---

## 2. In scope

- Public Anna answer quality on the live LP chat and voice bootstrap path
- Prompt-quality and retrieval-quality improvements that can be bounded honestly
- Runtime changes in `server/src/routes/public-anna.routes.ts`
- Retrieval/context changes in `server/src/services/ai/annaKnowledgeService.ts`
- Contract alignment in `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md`
- Regression coverage for bounded quality seams
- Evidence updates and plan/tracker/program status updates

---

## 3. Explicitly out of scope

- Multilingual expansion beyond the current PL/EN contract
- Backend analytics or dashboard breadth
- Broader Anna voice UX / architecture work
- Public landing redesign or broader marketing copy/system work
- Authenticated Teresa behavior
- Tenant-scoped or internal knowledge access

---

## 4. First bounded packet

### Packet name

`Landing Anna locale-aware retrieval quality`

### Why this packet starts first

- the runtime already receives `locale`
- indexed Anna knowledge already stores `language`
- the current retrieval seam does not yet use that signal strongly enough
- this is a real answer-quality improvement without broadening into full multilingual product work

### Packet scope

- prefer locale-matching and neutral public product pills before cross-language fallback
- keep cross-language fallback only as a bounded safety net when matching public material is unavailable
- apply the same retrieval preference to voice bootstrap
- add focused regression at the service layer

---

## 5. Lane acceptance target

This broader lane is not done after one packet.

The lane will be accepted only when:

1. the remaining Anna quality residuals are broken into honest bounded packets,
2. those packets land with runtime truth and regression,
3. no smaller real prompt/retrieval quality packet remains,
4. and the lane can be accepted without silently broadening into multilingual, analytics, or full voice-product work.
