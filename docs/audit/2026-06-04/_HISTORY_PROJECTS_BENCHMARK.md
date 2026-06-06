# History & Projects Benchmark — Top-4 AI Chats vs Consultify/Teresa

**Date:** 2026-06-04 · **Scope:** conversation-history management + Projects/folders (incl. TEAM/SHARED projects) across ChatGPT, Claude, Gemini, Grok · **Method:** web research on vendor help-centers, changelogs, 2025-2026 sources (no code).

> Research-only. All claims source-linked. Note the 2025 wave: ChatGPT + Claude now both ship *shared/team Projects with per-member roles*; Gemini ships *shareable Gems*; Grok ships *Workspaces/Projects with team sharing*.

---

## 1. Executive Summary — where we stand

**Our current state:** personal folders + org-scoped team folders, search, time-grouping, move-to-folder, per-project custom instructions (new), branch/fork (new). Team folder = **org-wide visible**, no per-project membership/roles.

### (a) History management — **we're ~at parity, a few gaps**
We have search, time-grouping, move-to-folder, branch/fork. The top-4 add: **archive** (ChatGPT — soft-hide distinct from delete), **pin/favorite section** (Gemini, ChatGPT-in-project), **per-chat share link** (ChatGPT public links; Grok team links), **bulk actions** (ChatGPT), **drag-and-drop chat→project** (ChatGPT), **full data export** (all four). Biggest single gap: **no per-chat share link** and **no archive state**.

### (b) Personal projects — **we're at parity**
Personal projects with files/knowledge + custom instructions + scoped chats is now table-stakes; we have folders + per-project instructions. We lack **project-scoped files/knowledge** as first-class (RAG over uploaded docs) and **project-only memory** — the differentiator versus a plain folder.

### (c) TEAM / SHARED projects — **this is our real gap (owner's priority)**
We have org-wide team folders but **no per-project membership, no roles (owner/editor/viewer), no invited-only visibility, and no project-level shared knowledge with access control.** Both ChatGPT and Claude now ship exactly this. The single most important nuance for a B2B consulting product:

> **Claude:** chats inside a shared project are **private-by-default** (members share *knowledge + instructions*, not each other's chats). **ChatGPT:** chats inside a shared project are **visible to all project members.** For consulting (client confidentiality + partner oversight) we likely want **Claude's private-by-default chat model with an opt-in "share to project" toggle.**

---

## 2. Per-platform detail

### 2.1 Conversation history actions

| Action | ChatGPT | Claude | Gemini | Grok | **Us** |
|---|---|---|---|---|---|
| Rename | ✅ 3-dot menu | ✅ | ✅ touch-hold→Rename | ✅ | ✅ |
| Delete | ✅ (30-day purge) | ✅ (hover→select) | ✅ (also deletes Canvas) | ✅ | ✅ |
| Archive (soft-hide) | ✅ distinct state | ❌ (requested, not shipped) | ❌ | ❌ | ❌ |
| Pin / favorite | ✅ (pin in project) | ❌ (requested) | ✅ Pin → top of Recent | partial | ❌ |
| Branch / fork | ✅ "Branch in new chat" (Sep 2025) | ❌ | ✅ "Branch in new chat" | ❌ | ✅ (new) |
| Share — public/link | ✅ public shared links | ✅ share chat link | ❌ (no per-chat share) | ✅ team secure link | ❌ |
| Export | ✅ Settings→Data Controls (full) | ✅ Settings→Privacy→Export | ✅ via Takeout/activity | ✅ accounts.x.ai JSON | partial |
| Move to project/folder | ✅ menu + **drag-drop** | ✅ (into project) | via Gems (n/a per-chat) | ✅ workspaces | ✅ (no drag-drop) |
| Bulk actions | ✅ archive-all / delete-all | partial (multi-select delete) | partial | ❌ | ❌ |
| Search — title vs full-text | full-text (chat search/memory) | **title-only** in sidebar (+ AI chat-search on paid) | yes | yes | title (verify) |
| Time grouping | ✅ | ✅ reverse-chrono | ✅ Recent | ✅ | ✅ |
| Pinned section | ✅ (within project) | ❌ | ✅ | ❌ | ❌ |

Sources: ChatGPT [delete/archive](https://help.openai.com/en/articles/8809935-how-to-delete-and-archive-chats-in-chatgpt), [branch](https://www.techtimes.com/articles/311823/20250906/openai-introduces-conversation-branching-chatgpt.htm), [shared links](https://help.openai.com/en/articles/7925741-chatgpt-shared-links-faq) · Claude [delete/rename](https://support.claude.com/en/articles/8230524-how-can-i-delete-or-rename-a-conversation), [chat search/memory](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context) · Gemini [manage chats](https://support.google.com/gemini/answer/13666746) · Grok [user guide](https://docs.x.ai/grok/user-guide), [export](https://chatexport.guide/guides/grok/).

### 2.2 Personal Projects

| Capability | ChatGPT | Claude | Gemini (Gems) | Grok (Workspaces) |
|---|---|---|---|---|
| Project/folder for chats | ✅ Projects | ✅ Projects | Gems = custom assistants (not chat folders) | ✅ Workspaces/Projects |
| Project files / knowledge | ✅ upload files | ✅ knowledge base (docs) | ✅ Gem custom knowledge (Drive/upload) | ✅ upload files |
| Project custom instructions | ✅ | ✅ | ✅ Gem instructions | ✅ project instructions |
| Project-scoped memory | ✅ project-only memory | per-project knowledge | per-Gem | per-workspace |
| Scoped chat history | ✅ | ✅ self-contained | n/a | ✅ |

Sources: [ChatGPT Projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) · [Claude Projects](https://support.claude.com/en/articles/9517075-what-are-projects) · [Gemini Gems sharing](https://workspaceupdates.googleblog.com/2025/09/gem-sharing-gemini-app-workspace.html) · [Grok Projects](https://grok.com/project).

### 2.3 TEAM / SHARED projects — sharing model (the priority)

| Dimension | **ChatGPT Shared Projects** | **Claude Projects (Team/Enterprise)** | Gemini (shared Gems) | Grok (Workspaces) |
|---|---|---|---|---|
| Availability | All tiers since 22 Oct 2025; Biz/Ent admin-managed | Team & Enterprise plans | Workspace (shared via Drive) | Grok Business team workspaces |
| Visibility model | "Only those invited" **or** "Anyone with a link" (logged-in users join) | **Public** (whole org can view/use) **or** **Private** (invited only) | Drive sharing rules (org or external if allowed) | Team members; secure shared link |
| Roles | **Can Chat** (view + chat) · **Can Edit** (settings, instructions, files) | **Can view** (see knowledge/instructions, chat) · **Can edit** (instructions, knowledge, members) | use / edit / copy (Drive-style) | view / collaborate |
| Who can add/remove members | Owner removes; **Editors can add but not remove** | Editors add members + update settings; "Remove access" via Share | Drive permissions | workspace admin |
| **Chats visible to all members?** | **YES — members see all chats in the project** | **NO — chats private-by-default**, knowledge+instructions shared | n/a (Gems aren't chat folders) | shared via explicit link |
| Shared files/knowledge | ✅ shared, all members | ✅ shared knowledge base | ✅ Gem knowledge | ✅ workspace files |
| Personal memory leakage | personal memory stays private | personal chats isolated | per-account | per-account |
| Real-time co-edit | async (live context hub) | async | async | async |

Sources: ChatGPT — [OpenAI: more ways to work with your team](https://openai.com/index/more-ways-to-work-with-your-team/), [Projects help](https://help.openai.com/en/articles/10169521-projects-in-chatgpt), [chats visible to members](https://www.aioperator.com/blog/chatgpt-project-sharing-a-new-feature-that-improves-team-collaboration/). Claude — [Manage project visibility & sharing](https://support.claude.com/en/articles/9519189-manage-project-visibility-and-sharing) (private-by-default chats; Can view / Can edit), [Projects news](https://www.anthropic.com/news/projects). Gemini — [Gems sharing + admin controls](https://workspaceupdates.googleblog.com/2025/09/gem-sharing-gemini-app-workspace.html). Grok — [user guide](https://docs.x.ai/grok/user-guide).

---

## 3. GAP TABLE — they have, we don't

| # | Feature | Who has it | Verdict | Note |
|---|---|---|---|---|
| 1 | Per-project membership + roles (owner/editor/viewer) | ChatGPT, Claude | **Strategic** | Core team-project gap |
| 2 | Invited-only (private) project visibility | ChatGPT, Claude | **Strategic** | Today we're org-wide only |
| 3 | Private-by-default chats in shared project + opt-in share | Claude | **Strategic** | Right model for consulting confidentiality |
| 4 | Project-scoped shared knowledge/files w/ access control | ChatGPT, Claude, Grok | **Strategic** | The thing that makes it >folder |
| 5 | Project-only memory | ChatGPT | **Strategic** | Differentiates project from folder |
| 6 | Per-chat share link (public / to-org) | ChatGPT, Claude, Grok | **Quick Win** | Client deliverable sharing |
| 7 | Archive (soft-hide ≠ delete) | ChatGPT | **Quick Win** | Cheap UX win |
| 8 | Pin/favorite + pinned section | Gemini, ChatGPT | **Quick Win** | Cheap, high daily value |
| 9 | Drag-and-drop chat → project | ChatGPT | **Quick Win** | Polish on existing move-to-folder |
| 10 | Bulk actions (multi-select delete/archive/move) | ChatGPT | **Quick Win** | |
| 11 | Full data export (account-level) | all four | **Quick Win** | Compliance/B2B expectation |
| 12 | Full-text history search | ChatGPT, Gemini, Grok | **Strategic** | We're title-only |
| 13 | "Shared with me" discovery tab | Claude | **Quick Win** | Needed once #1 lands |
| 14 | "Anyone with link can join project" | ChatGPT | **Skip for B2B** | Security risk for consulting; invited-only preferred |

---

## 4. Team/Shared-Projects design recommendation

Adopt the **Claude model** (private-by-default chats, per-project roles) over the ChatGPT model (all chats visible) — confidentiality is the consulting default. Layer ChatGPT's clean **Can Chat / Can Edit** verbs.

**Visibility per project:** `private` (invited only) | `org` (whole org can view/use) — replaces today's blanket org-wide team folder.

**Roles (3):** `owner` (delete project, manage all members, transfer) · `editor` (edit instructions/knowledge/files, add members) · `viewer` (read knowledge+instructions, create own chats). Editors add members; only **owner** removes — mirror ChatGPT.

**Default chat visibility:** **private to author**, with explicit per-chat "Share to project" toggle (Claude model). A consultant's client chats stay private; they opt-in to surface a chat to the engagement team.

**Concrete schema (illustrative):**
```
projects(id, org_id, name, visibility ENUM('private','org'), created_by, instructions, ...)
project_members(project_id, user_id, role ENUM('owner','editor','viewer'), added_by, added_at)
project_knowledge(id, project_id, file_ref, added_by, ...)        -- shared, RBAC by membership
chats(id, project_id NULL, author_id, shared_to_project BOOL DEFAULT false, ...)
```
**Access rules:** a chat is visible to a member iff `chat.author_id = me` OR (`chat.shared_to_project` AND I'm a project member). Knowledge/instructions visible to any member; editable by editor/owner. `org`-visibility projects auto-grant `viewer` to all org users (preserves today's behavior as one option, not the only one).

**Migration:** existing "team folders" → `visibility='org'` projects, all current members `viewer`, creator `owner`. Non-breaking.

---

## 5. Top 12 proposed adds (ranked by impact ÷ effort)

| Rank | Add | Why (1-line) | Effort |
|---|---|---|---|
| 1 | Pin/favorite + pinned section | Daily-use win, trivial build | **Low** |
| 2 | Archive state (soft-hide) | Declutter without delete; expected | **Low** |
| 3 | Bulk multi-select (delete/archive/move) | Power-user hygiene at scale | **Low** |
| 4 | Drag-and-drop chat→project | Polishes move-to-folder we already have | **Low** |
| 5 | Per-chat share link (to-org first) | Consultants share deliverables internally | **Med** |
| 6 | Per-project membership + roles (owner/editor/viewer) | The core team-project gap | **High** |
| 7 | Private vs invited-only project visibility | Confidentiality model for consulting | **Med** |
| 8 | Private-by-default chats + "share to project" toggle | Right confidentiality default (Claude model) | **Med** |
| 9 | Project-scoped shared knowledge/files (RBAC) | Makes a project > a folder; Teresa RAG hook | **High** |
| 10 | Full-text history search | Title-only search is a real daily miss | **Med** |
| 11 | "Shared with me" tab + project-only memory | Discovery + Teresa context isolation | **Med** |
| 12 | Account-level full data export | B2B/compliance expectation | **Low** |

**Sequence:** Wave A (quick wins 1-4, 12) → Wave B (team-project core 6-7-8-9) → Wave C (5, 10, 11). Teresa angle: items 8-9-11 give Teresa correctly-scoped, access-controlled project context — the consulting differentiator the top-4 don't tailor.
