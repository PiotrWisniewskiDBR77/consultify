# T4 Charter - Landing Anna multilingual expansion

> Status: active
> Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
> Lane: `Landing Anna multilingual expansion`
> Taxonomy: `T4`
> Priority: highest
> Last updated: 2026-03-27

---

## 1. Goal

Promote the broader public Anna multilingual lane from visible backlog into active execution and expand live public-language support beyond the current PL/EN-only cut without broadening into a full all-language rollout at once.

This lane exists because the accepted `Landing Anna prompt-quality / retrieval-quality` lane improved answer quality for the current supported path, but the public landing surface still exposes a broader app-level language system while Anna remains effectively limited to PL/EN.

---

## 2. In scope

- Public Anna language support on the live LP chat surface
- Bounded visible-surface continuity in `src/components/Landing/AnnaAssistantWidget.tsx`
- Bounded runtime language handling in `server/src/routes/public-anna.routes.ts`
- Contract alignment in `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md`
- Focused regression coverage for promoted multilingual packets
- Evidence updates and plan/tracker/program status updates

---

## 3. Explicitly out of scope

- Full simultaneous rollout for all app locales at once
- Backend analytics or dashboard breadth
- Broader Anna voice UX / architecture program
- Public landing redesign or broader marketing copy/system work
- Authenticated Teresa multilingual behavior
- Tenant-scoped or internal knowledge access

---

## 4. First bounded packet

### Packet name

`Landing Anna Spanish public continuity`

### Why this packet starts first

- the main public app locale system already supports `es`
- Anna still treats Spanish as unsupported on the live route
- the landing widget still collapses non-PL locales into English copy
- Spanish is the smallest honest additional language because it fits the current LTR public surface without introducing RTL or script-specific complexity

### Packet scope

- support Spanish on the public Anna text path instead of routing it into unsupported-language fallback
- add bounded Spanish surface copy for the live landing widget
- localize bounded runtime fallback copy for Spanish where Anna still needs a safe fallback
- keep other app locales (`de`, `ar`, `jp`) queued for later multilingual packets
- add focused route and widget regression

---

## 5. Lane acceptance target

This broader lane is not done after one extra language packet.

The lane will be accepted only when:

1. the remaining multilingual residuals are broken into honest bounded packets,
2. those packets land with runtime truth and regression,
3. no smaller real multilingual packet remains,
4. and the lane can be accepted without silently broadening into analytics, full voice-product redesign, or broader landing redesign work.
