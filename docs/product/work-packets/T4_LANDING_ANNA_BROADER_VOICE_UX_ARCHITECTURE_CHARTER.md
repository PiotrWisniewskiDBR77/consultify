# T4 Charter - Landing Anna broader voice UX / architecture

> Status: historical charter for an accepted lane
> Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
> Lane: `Landing Anna` broader voice UX / architecture
> Taxonomy: `T4`
> Priority: highest
> Last updated: 2026-03-27

---

## 1. Goal

Promote the broader Landing Anna voice UX / architecture lane from visible backlog into active execution and close the remaining split-brain between continuity-safe live voice behavior and a productized public voice experience.

This lane exists because earlier Anna voice work closed bounded fallback, close, reopen, and integrity seams, but the live voice path still remains structurally separate from the typed Anna path and has not yet been productized as a coherent voice architecture.

---

## 2. In scope

- Public Anna live voice UX and architecture on the landing surface
- Voice-specific split-brain mapping across browser runtime, backend seams, and operator truth
- Bounded voice packets chosen only after the architecture residual is written down
- Focused regression coverage for any promoted voice packets
- Evidence updates and plan/tracker/program status updates

---

## 3. Explicitly out of scope

- Reopening already accepted Anna fallback / continuity / integrity packets
- Prompt-quality, multilingual, or backend analytics/dashboard breadth work
- Broader landing redesign or marketing-system work
- Authenticated Teresa voice behavior
- Full simultaneous redesign of all public Anna surfaces at once

---

## 4. First bounded packet

### Packet name

`Landing Anna voice architecture split-brain map`

### Why this packet starts first

- current voice behavior is continuity-safe but still structurally separate from typed Anna
- the remaining residual is architecture-shaped, not one obvious tiny UI bug
- forcing a code packet first would risk silently broadening into a full voice redesign
- an explicit split-brain map is the smallest honest packet that can identify the next real bounded voice seam

### Packet scope

- document the current public Anna voice architecture and its seams
- identify where voice and typed Anna still diverge across runtime, knowledge path, session state, and operator truth
- name the smallest real follow-on voice packet only after that map is written
- keep this packet evidence-first rather than pretending a larger redesign is already chosen

---

## 5. Lane acceptance target

This broader lane is not done after a single architecture note.

The lane will be accepted only when:

1. the remaining voice UX / architecture residuals are broken into honest bounded packets,
2. those packets land with real runtime and surface continuity,
3. no smaller real voice packet remains,
4. and the lane can be accepted without silently broadening into broader Anna product redesign work.
