# Chat History & Folders/Projects — Code-Verified Capability Audit

**Date:** 2026-06-04
**Scope:** Conversation-history + folders/projects management, end-to-end (UI → API → DB).
**Method:** Read-only code verification. file:line evidence below.

---

## 1. Executive Summary

The chat-history system is **solid on single-conversation lifecycle** and **thin on team collaboration + bulk/power-user actions**.

**What's solid (real end-to-end):**
- Conversation CRUD: rename (manual + inline), auto-title generation (with retries + heuristic fallback), soft-delete with 30-day grace + hard purge, archive/unarchive, star/pin.
- Folders: create/rename/delete (delete detaches, does not cascade-delete conversations), per-folder color/icon/description, **per-project custom instructions injected into the AI system prompt** (real KB-lite).
- Move to folder via modal **and** drag-and-drop (incl. drop-to-unassigned to remove).
- Branch/fork a conversation at a message — fully wired (per-message action → API → DB row copy with `parent_conversation_id`).
- Server-side **full-text search** (Postgres tsvector over titles + message content, ILIKE fallback) with cursor pagination, filters (folder/pinned/archived/date/hasAttachments), and team-scope permission gating.
- Time-grouping (Today/Week/Month/Older/Pinned/Archived) + per-group "Show more" + per-section "Show more".
- Export a single conversation (json/markdown/text) with too-large guard.

**What's thin / biggest gaps:**
1. **No per-project ACL.** Team folders are **org-wide only** — every active org member sees every team folder. No `chat_project_members` table, no invites, no per-folder membership.
2. **No bulk-select UI.** The `POST /bulk` endpoint + store action exist and work, but nothing in the sidebar lets a user multi-select.
3. **No real-time updates.** Folder/conversation changes by others are invisible until a manual refetch (no socket/SSE).
4. **No share link.** Permission model reserves `create_share_link`, but there is no endpoint and no UI.
5. **No PDF export / no share-link export.** Only md/json/text, single conversation.
6. **No nested folders / sub-projects.** Flat list only.
7. **No project-level file/KB attachment** beyond the text "custom instructions" brief.

---

## 2. Master Table

| # | Capability | Verdict | Mechanism (file:line) | Gap |
|---|---|---|---|---|
| **Conversation-level** |
| 1 | Rename (manual) | ✅ REAL | UI inline `ConversationItem.tsx:91`; menu `ConversationActions.tsx:93`; store `useConversationStore.ts:1457`; API `PATCH /:id` `conversations.routes.ts:542` | — |
| 2 | Auto-title generation | ✅ REAL | Trigger after 1st exchange `useConversationStore.ts:1176`; `generateTitle` w/ retries+fallback `:1359`; API `POST /:id/title/generate` `conversations.routes.ts:1159` | — |
| 3 | Delete (+confirm, soft/hard) | ✅ REAL | Confirm dialog `ConversationActions.tsx:318`; soft-delete + 30d grace + `force=true` purge w/ audit `conversations.routes.ts:661-762`; purge `useConversationStore.ts:1659` | Trash/restore UI for soft-deleted items is minimal (purge button only shows when `deletedAt` set) |
| 4 | Archive / unarchive | ✅ REAL | `ConversationActions.tsx:246`; store `:1253`; via `PATCH /:id`; auto-archive job `POST /auto-archive` `conversations.routes.ts:2134` | — |
| 5 | Pin / favorite / star | ✅ REAL | `ConversationActions.tsx:188`; store `:1245`; surfaces as `pinned` group | "Star" = pin-to-top group; single tier only |
| 6 | Move to folder/project | ✅ REAL | Modal `MoveToProjectModal.tsx:117`; store `useChatProjectStore.ts:270`; API `POST /:id/conversations/:cid` `chat-projects.routes.ts:448` + remove `:523` | — |
| 7 | Duplicate / branch | ✅ REAL | Per-message action `UnifiedChatPanel.tsx:3632`; `Api.branchConversation` `api.ts:11702`; API `POST /:id/branch` copies msgs + `parent_conversation_id` `conversations.routes.ts:2192`. NOTE: `BranchSelector.tsx` exists but is **orphaned (never imported)** | No "duplicate" (full copy) distinct from branch; branch entrypoint is per-message only |
| 8 | Export (md/json/text) | ⚠ PARTIAL | `ConversationActions.tsx:276` (md only); store `:1644`; API `GET /:id/export` `conversations.routes.ts:2010` (json/markdown/text) | **No PDF**; no multi-conversation/folder export |
| 8b | Share link | ❌ MISSING | Permission action `create_share_link` reserved `chatPermissionService.ts:35` but no route, no UI | Entire feature absent |
| 9 | Search (full-text) | ✅ REAL | Sidebar debounced server search `ChatHistorySidebar.tsx:448`; store `serverSearch` `:1591`; API tsvector+msg-content+ILIKE `conversations.routes.ts:1653-1659` | Client fallback is title/preview only for <3-char queries |
| 10 | Bulk select / move / delete | ⚠ PARTIAL | Store `bulkOperation` `useConversationStore.ts:1487`; API `POST /bulk` (archive/unarchive/star/unstar/delete) `conversations.routes.ts:1287` | **No bulk-select UI**; bulk has no "move to folder" action |
| 11 | Drag-and-drop into folders | ✅ REAL | DnD source `ConversationItem.tsx:124`; folder drop `ChatHistorySidebar.tsx:129`; unassigned-drop removes `:621` | Cannot DnD-reorder; cannot DnD between sections to change scope |
| 12 | Time-grouping | ✅ REAL | `getConversationGroup` diffDays math `useConversationStore.ts:372`; render order `ConversationList.tsx:79` | "Yesterday" not a distinct bucket (folds into thisWeek); no locale-aware week boundaries |
| 13 | Pagination / show-more | ⚠ PARTIAL | Per-group/section "Show more" client-only `ConversationList.tsx:91`, `ChatHistorySidebar.tsx:148`. Search has real cursor pagination `conversations.routes.ts:1691`. | Main list `GET /` is **not paginated** in the sidebar — fetches all, slices client-side; no infinite scroll |
| **Folder/Project-level** |
| 14 | Create / rename / delete folder | ⚠ PARTIAL | Create `ChatHistorySidebar.tsx:540` + modal; delete w/ confirm `:565`; API create `chat-projects.routes.ts:219`, delete `:393`. **Rename: backend `PATCH` supports `name` `:353`, store `updateProject` supports it `useChatProjectStore.ts:230`, but no sidebar rename UI** (only Delete in folder menu `ChatHistorySidebar.tsx:280`) | Folder **rename has no UI affordance** |
| 15 | Color / icon / description / custom-instructions | ⚠ PARTIAL | CI editor real `MoveToProjectModal.tsx:229-276` → store `:230` → API `:369` → **injected into prompt** `AIPipeline.ts:828-838`. Color/icon/description columns exist `515_team_chat_projects.sql:16-18` and backend accepts them `:361-368` | **No UI to set color/icon/description** at create or edit time (color defaults `#6366f1`); only custom-instructions are editable in UI |
| 16 | Personal vs Team scope | ✅ REAL | `scope` enum `useChatProjectStore.ts:66`; create picks scope `ChatHistorySidebar.tsx:540/551`; backend filters `chat-projects.routes.ts:97-117`; SQL `515_*.sql:33-42` | — |
| 17 | Team sharing / member roles / invite / ACL | ⚠ PARTIAL | Roles **derived from org membership only** `chatPermissionService.ts:179`; checks on create/edit/delete/move `chat-projects.routes.ts:243,337,420,476`. **No `chat_project_members` table, no invite, no per-folder ACL** | No per-project membership; sharing == "any active org member" |
| 18 | Move conversation personal↔team | ⚠ PARTIAL | Moving a conversation into a team folder makes it team-visible (`POST /:id/conversations/:cid` `chat-projects.routes.ts:448`). No explicit "change conversation scope" control; scope is implicit via folder | No direct scope toggle; team visibility only via folder membership |
| 19 | Conversation count per folder | ✅ REAL | Subquery `COUNT(*) ... conversation_count` `chat-projects.routes.ts:123`; rendered `ChatHistorySidebar.tsx:263` | — |
| 20 | Nested folders / sub-projects | ❌ MISSING | No `parent_id` on `chat_projects` (`515_*.sql:11-22`); flat render | Entirely absent |
| 21 | Project-level KB / files | ⚠ PARTIAL | Text-only "custom instructions" brief injected per-project `AIPipeline.ts:828`. No file/document attachment at folder level | No real KB; no attached files/docs scoped to a folder |
| **Team / Org** |
| 22 | Team-folder visibility enforcement | ✅ REAL | Server-side `WHERE cp.scope='team' AND cp.organization_id=?` everywhere `chat-projects.routes.ts:106,113,173,326,409,467`; search gated by `checkChatPermission(...,'read')` `conversations.routes.ts:1636` | Org-wide only (no narrower scoping) |
| 23 | Per-project ACL beyond org-wide | ❌ MISSING | No membership table; roles come from `organization_members.role` `chatPermissionService.ts:186` | No per-folder grants |
| 24 | Real-time updates | ❌ MISSING | No socket/SSE in either store; updates require manual refetch (`fetchProjects({force:true})` after own mutations only) | Others' changes invisible until reload |

---

## 3. Per-Gap Detail (⚠ / ❌)

### G1 — Per-project ACL / team sharing model (❌ ACL, ⚠ sharing)
There is **no `chat_project_members` (or any sharing/permissions) table** anywhere in the codebase (verified across `server/migrations/*`, `*.sql`, `*.ts`). A "team folder" is `chat_projects` row with `scope='team'` + `organization_id`. Visibility = "is the requester an `ACTIVE` member of that org". Roles are **derived live from `organization_members.role`** (`chatPermissionService.ts:179`), not stored per-folder. Consequence: you cannot share a team folder with a *subset* of the org, cannot invite an external/guest to one folder, and cannot grant someone edit on folder A but not folder B.

### G2 — Bulk-select UI (⚠)
`POST /conversations/bulk` (`conversations.routes.ts:1287`) and `useConversationStore.bulkOperation` (`:1487`) are real and ownership-checked, supporting archive/unarchive/star/unstar/delete. **No component renders checkboxes or a selection state** (no caller of `bulkOperation` in `src/`). Also note: bulk has **no "move to folder"** action server-side.

### G3 — Real-time (❌)
Neither store opens a socket/SSE/EventSource. After a user's own mutation the stores call `fetchProjects({force:true})` / `fetchConversations({force:true})`, but a teammate adding a chat to a shared team folder will not appear until the viewer manually refetches (remount / new-chat / search). For team folders this is a real collaboration gap.

### G4 — Share link (❌)
The permission enum reserves `create_share_link` (owner-only) `chatPermissionService.ts:149`, but there is no route, token table, or UI. Export is the only "get content out" path.

### G5 — Export breadth (⚠)
`GET /:id/export?format=json|markdown|text` works (`conversations.routes.ts:2010`); UI wires **markdown only** (`ConversationActions.tsx:276`). No PDF, no folder/multi-conversation export, no share.

### G6 — Folder rename + color/icon/description UI (⚠)
Backend fully supports renaming and color/icon/description (`chat-projects.routes.ts:353-368`; store `updateProject` `useChatProjectStore.ts:230`). The sidebar folder menu only offers **Delete** (`ChatHistorySidebar.tsx:280`). So a user cannot rename a folder or set its color/icon/description from the UI today (only `customInstructions` is editable, via `MoveToProjectModal`).

### G7 — Main-list pagination (⚠)
`GET /conversations` returns the full set; the sidebar slices client-side per group/section. Only `/conversations/search` implements real cursor pagination (`conversations.routes.ts:1691`). At scale (hundreds+ of conversations) the default (non-search) list will fetch everything.

### G8 — Nested folders (❌) & project KB (⚠)
`chat_projects` has no `parent_id` (`515_team_chat_projects.sql:11-22`) — flat only. "Project KB" is just the text `custom_instructions` brief injected into the prompt (`AIPipeline.ts:828`); no file/document attachment scoped to a folder.

---

## 4. Team-Folder Permission Model Today (exact shape)

**Storage:** No dedicated ACL. A team folder is a `chat_projects` row with `scope='team'` and `organization_id` set (`515_team_chat_projects.sql:33-42`). Conversations carry `chat_project_id` + `created_by`; messages carry `author_user_id`.

**Visibility:** Org-wide. Any user who is an `ACTIVE` row in `organization_members` for that `organization_id` can read all team folders + their conversations (enforced server-side in every query, e.g. `chat-projects.routes.ts:106`, `:173`, `:467`; search `conversations.routes.ts:1644`).

**Roles (derived, not stored per-folder):** Mapped from `organization_members.role` by `mapOrgRoleToChatRole` (`chatPermissionService.ts:52`):
- **owner** ← OWNER/ADMIN/SUPERADMIN → full control of any team folder/thread.
- **contributor** ← MEMBER/MANAGER/PROJECT_MANAGER → read, add messages, create folders/threads; **edit/delete/manage only on content they created** (`isCreator` gate).
- **viewer** ← CONSULTANT/VIEWER/GUEST/CLIENT → read-only.

**Enforced actions** (`checkChatPermission`): `create_project` (`chat-projects.routes.ts:243`), `edit_project` (`:337`), `delete_project` (`:420`), `manage_thread` on move/delete (`:476`, `conversations.routes.ts:683`), `read` gate on search (`conversations.routes.ts:1636`). `create_share_link` is defined but unused.

**No:** per-folder membership, invites, per-folder role overrides, guest/external single-folder access, or real-time propagation.
