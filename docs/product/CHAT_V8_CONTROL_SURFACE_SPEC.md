# Chat v8 - Control surface spec

> Status: Draft v8
> Cel: Zdefiniowac build-ready kontrakt dla wszystkich glownych control groups w czacie.

---

## 1. Po co istnieje ten dokument

`CHAT_V8_SSOT.md` ustawia produkt.
Ten dokument ustawia surface contract:
- jaki control istnieje,
- do czego sluzy,
- jaki ma handler i backend meaning,
- kiedy jest widoczny,
- czy jest canonical, partial czy legacy.

---

## 2. Nadrzedna zasada

Kazdy widoczny control w `Chat v8` musi spelniac jedna z dwoch zasad:
- ma realny handler i realny runtime effect,
- albo nie jest pokazywany.

Brak "button-shaped promises".

---

## 3. Header controls

| Control group | Purpose | Current truth | v8 rule |
|---|---|---|---|
| New chat | start new conversation | real | canonical |
| History | open library/history surface | real | canonical |
| Business actions | navigate to action area | partial, parent-dependent | only visible with real target |
| Important signals | open signal panel | feature-flagged / partial | classify as optional extension |
| Private mode badge | show privacy state | real indicator | canonical if state is real |
| Auto-read / mute | TTS state and quick mute | real | canonical |

Rules:
- header belongs to canonical shell only,
- app chrome controls and chat-surface controls must not be mixed semantically,
- full and split chat must not expose contradictory header logic.

---

## 4. History controls

| Control | Purpose | Current truth | v8 rule |
|---|---|---|---|
| New chat in history | create thread | real | canonical |
| Search | filter conversations | real but mostly client-side | canonical with honest search semantics |
| Folder create | create personal/team folder | real | canonical |
| Folder delete | delete folder | real | canonical |
| Folder open | folder-scoped view | real | canonical |
| DnD to folder | move conversation | real | canonical |
| DnD to unassigned | remove folder assignment | real | canonical |
| Archive toggle | reveal archived group | real | canonical |

Rules:
- history is a library system, not only a sidebar,
- archived, pinned and folder-scoped states must have explicit semantics,
- default view must be documented honestly if it is not truly "all chats".

---

## 5. Conversation row controls

| Control | Purpose | Current truth | v8 rule |
|---|---|---|---|
| Select conversation | open thread | real | canonical |
| Rename | rename title | real | canonical |
| Pin/unpin | starred semantics | real | canonical |
| Move to folder | assign folder | real | canonical |
| Archive/unarchive | lifecycle state | real | canonical |
| Delete | destructive remove | real | canonical |

Rules:
- row actions are part of conversation lifecycle contract,
- naming must use one vocabulary,
- inline and menu-based rename must not drift semantically.

---

## 6. Input controls

| Control | Purpose | Current truth | v8 rule |
|---|---|---|---|
| Text input | compose message | real | canonical |
| Send | submit prompt | real | canonical |
| Stop generating | abort current stream | real | canonical |
| File add | add local file | real | canonical |
| URL add | add URL for ingest | real in canonical path | canonical with shell parity requirement |
| Tools menu | configure modes/settings | real | canonical |
| Co-thinker menu | set persona/research mode | real config path | canonical but behavior must be documented honestly |
| Dictation mic | fill prompt by speech | real | canonical voice baseline |

Rules:
- send/stop must always be predictable,
- attachment state must be visible enough for trust,
- no shell may silently ignore a selected attachment type.

---

## 7. Tools and modes controls

Required groups:
- reasoning/research modes,
- privacy mode,
- TTS toggle,
- custom instructions,
- model/tier selection,
- co-thinker/persona selection,
- scope/focus visibility.

Rules:
- if a control changes stream payload, docs must say so,
- if a control changes only local UI state, docs must say so,
- no hidden focus/scope behavior without user understanding.

---

## 8. Message-level controls

Required groups:
- feedback,
- save-to-artifact actions,
- response action chips,
- citations/source inspection if available,
- retry or continue patterns where relevant.

Rules:
- message actions must not differ unpredictably across shells,
- feedback must use one canonical pipeline,
- response action chips must be classified as canonical, partial or legacy.

---

## 9. Actions and approval controls

Required groups:
- pending actions strip,
- approve,
- reject,
- view all / open actions area,
- proposal state markers.

Rules:
- every decision button must map to a real backend meaning,
- docs must distinguish `approve` from `execute` if they are different,
- optional parent callbacks must not masquerade as always-on controls.

---

## 10. Voice controls

Required groups:
- dictation,
- voice conversation if promoted,
- stop listening / stop recording,
- auto-read,
- stop speaking.

Rules:
- one user-visible state machine,
- no hidden "experimental but active" path documented as stable,
- browser and server behavior must be explicit.

---

## 11. Classification rule

Every visible control in the `Chat v8` package must be tagged as one of:
- `canonical`
- `partial`
- `legacy`
- `not supported`

This classification is mandatory for support, QA and future implementation.
