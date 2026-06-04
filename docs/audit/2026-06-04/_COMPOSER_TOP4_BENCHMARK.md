# Consultify / Teresa — Composer Benchmark vs Top-4 Consumer AI Chats

**Date:** 2026-06-04
**Author:** Audit pass (research + proposal, no code changes)
**Scope:** Composer / message surface of ChatGPT, Claude, Gemini, Grok (late 2025 → June 2026) vs Consultify chat.
**Method:** WebSearch on official product pages, release notes, help-center articles + recent (2026) third-party walkthroughs. Sources at the end of each section.

---

## 1. Executive summary

Dimension scoring is qualitative (0–5) — how Consultify's chat composer compares to the **best-of-four** on each axis.

| Dimension | Consultify today | Best-of-4 (who) | Score | Verdict |
|---|---|---|---|---|
| Attachments & files | +AddFiles (upload / link / GDrive / Dropbox / OneDrive / SharePoint / Recent) | ChatGPT File Library + Connectors | **4/5** | Near-parity; missing **persistent file library across chats** + per-file tagging |
| AI modes / tools surface | ✏ Tools (Deep / Reasoning / Multi-agent / Private / TTS / Style / Add-to-project) | ChatGPT Tools menu + Gemini Gems | **4/5** | Strong; missing **slash-command autocomplete** + **study/learn mode** |
| Custom personas / assistants | 👥 Co-Thinker (6 built-in personas) | Custom GPTs / Gems / Skills | **2.5/5** | Built-in only; **no user-created personas, no org library, no marketplace** |
| Persistent context | Per-conversation projects, memory | Claude Projects + Cowork + custom instructions per project | **3/5** | Have projects+memory; missing **per-project custom-instructions field** and project files panel UX |
| Per-message actions | Hover toolbar (Copy / Edit / Save-to-Context), per-msg "Tok rozumowania" | ChatGPT (edit/regen/branch/share/3-dot menu) + Claude (edit→fork) | **3/5** | Missing **branch / fork from message** and **regenerate with model picker** |
| Canvas / Artifacts | EE Document+Table+Presentation Studio (separate module) | Claude Artifacts (live, MCP-connected) / ChatGPT Canvas / Gemini Canvas | **3/5** | EE is rich but **not inline in chat**; competitors render artifacts side-panel in the chat |
| Voice | 🎙 Mic dictation + Teresa live voice toggle | ChatGPT Advanced Voice + screen-share + video | **3.5/5** | Missing **screen/video share into voice** |
| Web search & citations | Citations + trust panel | Grok DeepSearch (90s reports) / Gemini Deep Research / ChatGPT Search | **3.5/5** | Strong on trust UI; check parity on **agentic deep-research depth** |
| Agents / tasks | Multi-agent analysis mode | ChatGPT Tasks (scheduled) + Agent Mode; Claude Cowork + scheduled tasks | **2/5** | **No scheduled / recurring prompts**, no autonomous browser agent |
| Connectors / MCP | GDrive / Dropbox / OneDrive / SharePoint as file sources | Claude (200+ MCP) / Grok Connectors / ChatGPT Connectors | **2.5/5** | Read-only file sourcing; **no read/write connectors** (Notion / Linear / Jira / Slack / GitHub / Gmail) |
| Customization (slash-cmd / library) | Starter chips on welcome | ChatGPT `/` menu, Study Mode, browser slash-prompt libraries | **2/5** | **No `/`-triggered prompt library**, no user prompt save |
| Sharing & export | Per-message Copy + Save-to-Context | Claude Publish / Customize / Remix; Gemini Canvas export → Docs/MS365/PDF | **2/5** | **No public-link share** of a conversation or artifact |

**Bottom line:** Consultify is **at parity or ahead on attachments, modes, voice and trust**, but **behind on personas-as-a-platform (Custom GPTs / Gems / Skills), per-message branching, inline canvas/artifacts, connectors that write back, and scheduled tasks**. These are the high-leverage gaps.

---

## 2. Per-platform inventory

### 2.1 ChatGPT (OpenAI) — June 2026

| Surface | Feature | Notes |
|---|---|---|
| Composer | Model picker pill **inside composer** (Auto / GPT-5 / GPT-5 Thinking / Pro), with **thinking-effort slider** | Released 2026; consolidates model + effort selection. ([Releasebot](https://releasebot.io/updates/openai/chatgpt)) |
| Composer | `+` Attach: upload, **persistent File Library**, browse recent | Library expanded to Free/Go users in 2026. ([Chat-Power 2026 guide](https://www.chat-power.com/blog/chatgpt-features-complete-guide-2026/)) |
| Composer | **Tools menu** → Web Search, Canvas, Code Interpreter, Image Gen, Connectors, Deep Research, Study Mode | All triggerable as picks from `/` or paperclip menu. |
| Composer | **`/`-slash command palette** (Study Mode and others) | "Type `/` and pick Study and learn." ([OpenAI Help](https://help.openai.com/en/articles/11780217-chatgpt-study-mode-faq)) |
| Composer | Voice: **Dictation** (mic icon) **vs Advanced Voice** (waveform); Advanced Voice has **live video + screen-share input** since Dec 2024 | ([OpenAI Voice FAQ](https://help.openai.com/en/articles/8400625-voice-mode-faq)) |
| Per-message | Edit → forks the conversation; Regenerate with model swap; 3-dot menu → **"Branch in new chat"**; Share link; thumbs feedback | ([Buka knowledge base](https://knowledge.buka.sh/the-hidden-fork-how-editing-messages-in-chatgpt-lets-you-branch-conversations/)) |
| Persistent | **Projects** (files, instructions, memory scoped per project) | ([Suprmind 2026](https://suprmind.ai/hub/chatgpt/features/)) |
| Persistent | **Custom GPTs** (Instructions, Knowledge files up to ~20, Capabilities checklist, Conversation Starters, Actions) | ([ai-toolbox 2026](https://www.ai-toolbox.co/chatgpt-management-and-productivity/how-to-create-custom-gpts-walkthrough-2026)) |
| Persistent | **Memory** (cross-chat) + **Custom Instructions** (global) |  |
| Persistent | **Connectors** (Gmail, GitHub, Slack, Drive, M365, Salesforce, Notion) — read+write | Plus/Pro/Team only. |
| Quality | **Canvas** side-panel (docs/code with inline edits, length/lang controls); transitioning to inline **writing blocks / code blocks** in GPT-5.5 | ([InstaPods](https://instapods.com/blog/what-is-chatgpt-canvas/)) |
| Quality | **Code Interpreter**, Image gen (DALL-E + GPT-image), Vision, file types (PDF, docx, xlsx, pptx, images, audio) |  |
| Novel 2025-26 | **Tasks** (scheduled, recurring prompts, push/email notifications) | ([OpenAI Help: Tasks](https://help.openai.com/en/articles/10291617-tasks-in-chatgpt)) |
| Novel 2025-26 | **Agent Mode** (autonomous virtual computer; browse + create files) — Plus 40/mo, Pro 400/mo | ([OpenAI Agent intro](https://openai.com/index/introducing-chatgpt-agent/)) |
| Novel 2025-26 | **Study Mode** (Socratic, scaffolded learning) | ([OpenAI Study Mode](https://openai.com/index/chatgpt-study-mode/)) |

### 2.2 Claude (Anthropic) — June 2026

| Surface | Feature | Notes |
|---|---|---|
| Composer | Attach (files, images), Web Search toggle, Extended Thinking toggle, **Style** picker (Concise / Formal / Explanatory) | |
| Composer | **Skills menu** — pre-built Skills (Excel/PPT/Word/PDF) + custom uploaded Skills, **composable** | ([Suprmind Claude 2026](https://suprmind.ai/hub/claude/features/)) |
| Composer | **Plugins** — bundles of Skills + MCP + slash-commands + sub-agents, 15 official, installable | ([Amit Kothari](https://amitkoth.com/claude-plugins-connectors-skills-explained/)) |
| Composer | **Connectors directory** (200+ MCP servers — Gmail, Drive, Slack, GitHub, Postgres, Notion); remote MCP since Jan 2026 | ([Claude Help: connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)) |
| Per-message | Edit on any prior message → creates a **branch**, original preserved; copy; regenerate; "Continue" | ([Anthropic Artifacts help](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)) |
| Persistent | **Projects** — custom instructions field, uploaded files, project memory; now inside **Cowork** workspace | ([Ruben Hassid](https://ruben.substack.com/p/claude-cowork-project)) |
| Persistent | **Memory** (2 modes), per-project + global; custom instructions are the "single most powerful" field | ([InnerForge 2026 guide](https://innerforge.ai/blog/claude-projects-custom-instructions-guide)) |
| Persistent | **Custom Skills upload** — ZIP a folder, share with colleagues or org (Team/Enterprise toggle in org settings); shared skills are view-only and auto-update | ([Claude Help: Skills](https://support.claude.com/en/articles/12512180-use-skills-in-claude), [provisioning](https://support.claude.com/en/articles/13119606-provision-and-manage-skills-for-your-organization)) |
| Quality | **Artifacts** — code, SVG, Mermaid, React, HTML, Markdown, .docx/.pptx/.xlsx/.pdf downloads; **live artifacts call Claude API and MCP** for real data | ([ShareDuo Apr 2026](https://www.shareduo.com/blog/claude-artifacts)) |
| Quality | **Publish artifact** → public link; viewers can **Customize / Remix** (fresh conversation, fully forked copy) | ([Anthropic publishing artifacts](https://support.claude.com/en/articles/9547008-publishing-and-sharing-artifacts)) |
| Quality | Vision, file types incl audio; web search; **Computer Use** (browser/desktop control) |  |
| Novel 2025-26 | **Skills** as an open primitive (Anthropic, ChatGPT and Microsoft adopting same format) |  |
| Novel 2025-26 | **Cowork** — long-running workspace + scheduled tasks + sub-agents | |
| Novel 2025-26 | **Single connector directory** (Skills + Connectors + Plugins in one browsable surface) | ([Claude directory](https://support.claude.com/en/articles/14328846-browse-skills-connectors-and-plugins-in-one-directory)) |

### 2.3 Gemini (Google) — June 2026

| Surface | Feature | Notes |
|---|---|---|
| Composer | Attach (files, images, audio, video, URLs), Deep Research toggle, **Canvas toggle**, **Image gen**, **Gem picker** | ([Fresh van Root](https://freshvanroot.com/blog/google-gemini-review/)) |
| Composer | **Gemini Live** — inline voice mode (no longer full-screen), interruptible, with camera + screen-share | ([Gemini overview](https://gemini.google/overview/)) |
| Per-message | Edit, regenerate, modify-response (shorter/longer/simpler/more casual), share, export to Docs / Gmail draft | |
| Persistent | **Gems** — custom assistants (templates: Writing Coach, Brainstorm Partner; or natural-language describe); **upload up to 10 knowledge files**; appear in mobile + Workspace side panel | ([Gemini Gems](https://gemini.google/overview/gems/), [Workspace blog](https://workspace.google.com/blog/product-announcements/new-gemini-gems-deeper-knowledge-and-business-context)) |
| Persistent | **Super Gems** (2026) — Gems with **buttons and forms** → "lightweight apps" | ([aiblewmymind 2026](https://aiblewmymind.substack.com/p/google-gemini-guide-every-feature-explained)) |
| Persistent | **Custom Instructions** global + per-surface (in-Docs, in-app) | ([Workspace updates May 2026](https://workspaceupdates.googleblog.com/2026/05/set-custom-instructions-for-gemini-in-Google-Docs.html)) |
| Persistent | **Workspace connectors** built-in (Gmail/Drive/Docs/Calendar/Chat); 3rd-party connectors via Agent Designer (Jira, Slack) |  |
| Quality | **Deep Research** — agentic; browses 100s of sites + your Drive/Gmail/Chat; turns reports into **interactive Canvas visuals / quizzes** | ([Deep Research](https://gemini.google/overview/deep-research/)) |
| Quality | **Canvas** — editable artifacts; **real-time collab share**; export to Google Docs / DOCX / PDF / MS365 / GitHub | ([Gemini Canvas](https://gemini.google/overview/canvas/), [Google blog](https://blog.google/products/gemini/gemini-collaboration-features/)) |
| Quality | Image gen, Vision, native long-context (1M+), audio, video understanding |  |
| Novel 2025-26 | **Daily Brief** (24/7 Spark agent, automatic morning brief) | ([9to5Google I/O 26](https://9to5google.com/2026/05/19/gemini-app-google-io-2026/)) |
| Novel 2025-26 | **Audio Overview** of artifacts (podcast-style summaries) | ([Google blog](https://blog.google/products-and-platforms/products/gemini/gemini-collaboration-features/)) |

### 2.4 Grok (xAI) — June 2026

| Surface | Feature | Notes |
|---|---|---|
| Composer | Mode switcher: **Think** (reasoning), **DeepSearch**, **Voice**, **Image/Video** (Imagine), Code (Build) | ([Wikipedia Grok](https://en.wikipedia.org/wiki/Grok_(chatbot))) |
| Composer | **Connectors** menu (May 2026) — GitHub, Notion, Linear, Google Workspace, Microsoft 365, SharePoint, Outlook, OneDrive, Vercel, Canva, Gamma, S&P Global, **BYO-MCP** | ([Codersera 2026](https://codersera.com/blog/xai-grok-build-skills-connectors-guide-2026/)) |
| Composer | Voice mode (Grok 4.1) — natural, faster on SuperGrok |  |
| Per-message | Edit, regenerate, share to X, copy |  |
| Persistent | **Workspaces / Projects** for organizing tasks |  |
| Persistent | **Companions** (animated personas — Ani, Bad Rudi, Valentine; consumer-leaning, not B2B) | ([Grokipedia](https://grokipedia.com/page/Grok_companions)) |
| Persistent | Memory across chats |  |
| Quality | **DeepSearch** — 90-second multi-source reports; ~10× faster, ~3× more pages than ChatGPT Deep Research per xAI; scans web + X | ([Robylon 2026](https://www.robylon.ai/blog/what-is-xai-grok-a-complete-guide-to-the-chatbot)) |
| Quality | **Composer 2.5 / Grok Build** — long-running coding agent, 8 parallel sub-agents, 256K context |  |
| Quality | Imagine — image+video, "Spicy" mode (not relevant for B2B) |  |
| Novel 2025-26 | **BYO-MCP** in the connector menu — bring your own MCP server inline | ([xAI release notes](https://x.ai/grok)) |
| Novel 2025-26 | Aggressive real-time / X-feed grounding for trend analysis |  |

---

## 3. GAP TABLE — features they have, Consultify does not

Legend: **QW** = Quick Win (≤1 sprint, isolated UI), **S** = Strategic (multi-sprint, platform-level), **NTH** = Nice-to-have, **Skip** = out-of-scope for B2B consulting.

| # | Feature | Best example | Verdict | Why for consulting |
|---|---|---|---|---|
| 1 | **Slash-command palette in composer** (`/` opens picker of modes/prompts/skills/personas) | ChatGPT `/` → Study; Claude slash-cmds | **QW** | Power users live in keyboard; consolidates Tools + Personas + saved prompts into one motion |
| 2 | **Branch / Fork from any message** (3-dot menu → "Branch in new chat") | ChatGPT, Claude | **QW** | Consultants explore "what-if" variants of a strategy without polluting main thread |
| 3 | **User-created Personas / Custom Co-Thinkers** (name, instructions, knowledge files, starter chips) | Custom GPTs, Gems, Skills | **S** | Today only 6 built-in personas; clients want "Our CFO voice", "Risk officer of Atelier Toys", etc. |
| 4 | **Persona / Skill org library** (share within team, view-only, auto-update) | Claude Skills org sharing | **S** | Consultify is B2B — team-level reuse is the differentiator |
| 5 | **Per-project Custom Instructions field** (persistent brief, communication style) | Claude Projects, ChatGPT Projects | **QW** | We have projects + memory; missing the explicit "instructions" field UX |
| 6 | **Inline Canvas / Artifact side-panel in chat** (open a doc/table/slide next to the message, edit, then export) | Claude Artifacts, Gemini Canvas, ChatGPT Canvas | **S** | EE Studio exists as a separate module — bring a slim inline view into chat for in-flight artifacts |
| 7 | **Conversation share / publish public link** (read-only or remixable) | Claude Publish + Customize | **NTH** for B2B; **S** if we want client share | Useful for partner / client read-only handoffs |
| 8 | **Connectors that write back** (Notion / Linear / Jira / Slack / Gmail / GitHub via MCP) | Claude (200+), Grok, ChatGPT | **S** | Today GDrive/Dropbox/OneDrive/SharePoint are **read-only file sources**; clients ask for "create Jira ticket from this insight" |
| 9 | **BYO-MCP** — let an enterprise plug their own MCP server | Grok, Claude | **S** | Enterprise sales unlock; matches our trust-panel positioning |
| 10 | **Scheduled / recurring prompts (Tasks)** with push/email delivery | ChatGPT Tasks, Gemini Daily Brief, Claude Cowork scheduled tasks | **S** | Maps directly onto our existing "Daily brief" starter chip — make it actually scheduled |
| 11 | **Agent Mode** (autonomous browser/desktop to execute multi-step task) | ChatGPT Agent, Claude Computer Use | **NTH** initially | Risky for B2B; could be opt-in for specific Co-Thinker (e.g. Market Researcher) |
| 12 | **Voice with live video / screen-share** | ChatGPT Advanced Voice + screen, Gemini Live | **NTH** | Nice for whiteboard sessions; defer until live-voice volume justifies |
| 13 | **Regenerate with model swap** (pick a different model when regenerating) | ChatGPT | **QW** | Cheap polish; lets users escalate to "Deep" / fall back to "Fast" without restarting |
| 14 | **Style picker beyond Standard** (Concise / Formal / Explanatory / Bullet-only) | Claude Styles, Gemini "shorter/simpler/more casual" | **QW** | We have "Response style (Standard)" placeholder — populate it |
| 15 | **Audio Overview** of a conversation or artifact (podcast-style TL;DR) | Gemini, NotebookLM | **NTH** | Pairs with TTS we already have; could be a Co-Thinker output type |
| 16 | **Daily Brief agent / morning push** | Gemini Spark, ChatGPT Tasks | **S** | Our welcome chip says "Daily brief" — turn it into a scheduled push for each client |
| 17 | **Citations + sources panel inline in canvas** (Deep Research artifacts with footnotes) | Gemini Deep Research → Canvas | **NTH** | Trust panel already exists; integrate into EE outputs |
| 18 | **Live artifacts** (artifacts that call back to Teresa API / MCP for fresh data) | Claude live artifacts | **NTH** | Strong differentiator for "living dashboards" in consulting, but expensive |
| 19 | **Image generation in chat** | ChatGPT, Gemini, Grok | **Skip** | Out of scope for consulting UX; clients have brand teams |
| 20 | **Animated Companions / character chat** | Grok Companions | **Skip** | Anti-B2B brand |
| 21 | **"Customize / Remix" of a shared artifact** | Claude | **NTH** | Pairs with #7 if we ship public sharing |
| 22 | **Persistent File Library across chats** with search + tags | ChatGPT File Library 2026 | **QW** | We have AddFiles → Recent; need a real library view at /my-work/files |
| 23 | **Multi-file drag-drop onto composer with previews + per-file role tagging** | All four | **NTH** | UX polish |
| 24 | **Conversation export** (Markdown, PDF, share to Notion/Drive) | Gemini → Docs, Claude artifacts download | **QW** | Frequently asked by users hand-rolling reports |
| 25 | **"Study / Coach" mode for client onboarding** (Socratic) | ChatGPT Study Mode | **NTH** | Could power "consultant onboarding" Co-Thinker |

---

## 4. Top 10 proposed adds — ranked by impact ÷ effort

> Ranking heuristic: **B2B-consulting fit × (frequency of use) ÷ engineering complexity**. Files-likely-touched are best-guess based on current chat composer architecture (`src/components/chat/composer/*`, `src/lib/chat/*`, `src/lib/teresa/*`).

| Rank | Add | 1-line why for consulting | Effort | Files likely touched |
|---|---|---|---|---|
| **1** | **Slash-command palette `/` in composer** — opens picker over Tools + Personas + saved prompts | One keystroke surfaces every mode/persona/skill we already have; power-user delight, zero new backend | **Low** | `src/components/chat/composer/Composer.tsx`, new `SlashMenu.tsx`, `useSlashCommands.ts` hook; pull existing tool/persona registries |
| **2** | **Branch / Fork from message** — hover toolbar gets a "Branch" button; spawns new conversation pre-loaded with context up to that turn | Lets consultants test alt strategies without losing thread; copying ChatGPT/Claude pattern | **Low** | `src/components/chat/MessageActions.tsx` (existing hover toolbar), `src/lib/chat/conversation.ts` (new `forkAt(messageId)`), conversation list UI |
| **3** | **Per-project Custom Instructions field** — text field on project settings: persona/style/context-brief, injected into every prompt in that project | We already have projects + memory; this is the missing UX primitive Claude/ChatGPT users expect | **Low** | `src/app/(app)/projects/[id]/settings/page.tsx`, `prisma/schema.prisma` (`Project.customInstructions`), `src/lib/teresa/promptAssembly.ts` |
| **4** | **Response Style picker — populate it** (Concise / Formal / Explanatory / Bullet-only / Executive-summary) instead of placeholder "Standard" | We literally have this menu item already saying "Standard" — finish it; cheap parity with Claude Styles + Gemini modify | **Low** | `src/components/chat/composer/ToolsMenu.tsx`, `src/lib/teresa/styles.ts` (new), prompt-assembly |
| **5** | **Custom Co-Thinker Personas** (user-created) — UI to create a persona with name + instructions + knowledge files + starter chips; surfaced in 👥 menu next to built-in 6 | Today 6 fixed personas is the biggest "platform" gap vs Custom GPTs / Gems / Skills; unlocks client-specific personas ("Atelier Toys CFO") | **Med** | New `/my-work/personas` module, `prisma` model `Persona`, persona registry, file-knowledge-base attachment, 👥 picker in composer |
| **6** | **Regenerate with model swap** + **branch-on-edit indicator** in conversation list | Cheap quality lift; lets user escalate to Deep without losing thread; visualises branches users already create by editing | **Low** | `src/components/chat/MessageActions.tsx`, conversation tree state, sidebar conversation list |
| **7** | **Persistent File Library** (`/my-work/files`) — list of every file you've attached anywhere, searchable, with tags + "attach to current chat" | ChatGPT 2026 shipped this; converts our existing AddFiles → Recent into a real library | **Med** | New `/my-work/files` page, `prisma` `UserFile` (probably exists), composer "+ AddFiles → My Library" tab |
| **8** | **Scheduled Tasks (Daily Brief)** — schedule a prompt (cron + persona + project) → result delivered via in-app notif + email | "Daily brief" is already a starter chip; turn it into a real scheduled job; matches ChatGPT Tasks / Gemini Daily Brief | **Med** | New `prisma` `ScheduledTask`, worker (BullMQ?), notif system, `/my-work/tasks` page, composer "Schedule this" affordance |
| **9** | **Persona / Skill org sharing** (Team/Enterprise) — toggle "share with org" on a custom persona; appears in colleagues' picker as view-only, auto-updating | Direct copy of Claude Skills org-share pattern; the B2B multiplier on #5 | **Med** | Builds on #5; org-scope on `Persona` model, share-toggle UI, RBAC checks |
| **10** | **Conversation export** (Markdown / PDF) + **share-link** for read-only conversation handoff to client | Clients constantly ask "send me what we discussed" — today they screenshot | **Low–Med** | `src/app/api/chat/[id]/export/route.ts`, share-token model, public read-only `/share/[token]` page |

**Honourable mention (Strategic, not in top-10 due to effort):**
- **Inline Canvas in chat** — re-use EE Document/Table/Presentation Studio renderers in a chat side-panel; very high impact but multi-month.
- **MCP write-back connectors** (Notion / Jira / Linear / Gmail) — enterprise unlock, but needs auth + per-tenant credential vault + per-tool UI affordances.
- **BYO-MCP** — pair with above for enterprise tier.

---

## 5. What we already match or beat

For completeness — keep marketing aware of these:

- **Multi-agent analysis mode** — ChatGPT/Claude have sub-agents but rarely exposed as a one-click composer mode; we surface it cleanly.
- **Co-Thinker as a first-class composer slot** — competitors hide personas in a separate "Custom GPT / Gem" picker outside the main chat; we put 👥 right next to ✏ Tools.
- **Private mode in composer** — explicit privacy posture; Gemini/Grok have nothing equivalent at the message level.
- **Trust panel + citations** — strong for the consulting/audit use case where ChatGPT/Gemini show citations but no consolidated trust UI.
- **Per-message collapsible "Tok rozumowania"** — Claude shows extended thinking inline (not collapsible per message), ChatGPT shows it in a separate "reasoning" expand; ours is cleaner per-message.
- **Message-language auto-detect** — Gemini and ChatGPT do not auto-detect per-message; user has to set globally.
- **Cloud sources unified** (GDrive + Dropbox + OneDrive + SharePoint in one menu) — competitors usually require separate connector setup per provider.

---

## Sources

- [ChatGPT Features 2026 — Suprmind](https://suprmind.ai/hub/chatgpt/features/)
- [ChatGPT Canvas guide — InstaPods](https://instapods.com/blog/what-is-chatgpt-canvas/)
- [OpenAI Releasebot June 2026](https://releasebot.io/updates/openai/chatgpt)
- [Custom GPTs 2026 walkthrough — ai-toolbox](https://www.ai-toolbox.co/chatgpt-management-and-productivity/how-to-create-custom-gpts-walkthrough-2026)
- [Chat branching / fork — Buka](https://knowledge.buka.sh/the-hidden-fork-how-editing-messages-in-chatgpt-lets-you-branch-conversations/)
- [Tasks in ChatGPT — OpenAI Help](https://help.openai.com/en/articles/10291617-tasks-in-chatgpt)
- [Introducing ChatGPT Agent — OpenAI](https://openai.com/index/introducing-chatgpt-agent/)
- [Study Mode FAQ — OpenAI Help](https://help.openai.com/en/articles/11780217-chatgpt-study-mode-faq)
- [Voice Mode FAQ — OpenAI Help](https://help.openai.com/en/articles/8400625-voice-mode-faq)
- [Claude Features 2026 — Suprmind](https://suprmind.ai/hub/claude/features/)
- [Claude Artifacts help](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)
- [Publishing & sharing artifacts — Claude Help](https://support.claude.com/en/articles/9547008-publishing-and-sharing-artifacts)
- [Use skills in Claude — Help Center](https://support.claude.com/en/articles/12512180-use-skills-in-claude)
- [Provision & manage skills for org — Claude Help](https://support.claude.com/en/articles/13119606-provision-and-manage-skills-for-your-organization)
- [Claude connectors directory](https://support.claude.com/en/articles/14328846-browse-skills-connectors-and-plugins-in-one-directory)
- [Custom connectors via remote MCP — Claude Help](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Plugins/connectors/skills explained — Amit Kothari](https://amitkoth.com/claude-plugins-connectors-skills-explained/)
- [Claude Cowork + Projects — Ruben Hassid](https://ruben.substack.com/p/claude-cowork-project)
- [Claude artifacts complete guide Apr 2026 — ShareDuo](https://www.shareduo.com/blog/claude-artifacts)
- [Gemini overview](https://gemini.google/overview/)
- [Gemini Gems](https://gemini.google/overview/gems/)
- [Gemini Canvas](https://gemini.google/overview/canvas/)
- [Gemini Deep Research](https://gemini.google/overview/deep-research/)
- [Gemini Workspace blog — Gems business context](https://workspace.google.com/blog/product-announcements/new-gemini-gems-deeper-knowledge-and-business-context)
- [Custom instructions for Gemini in Docs — May 2026](https://workspaceupdates.googleblog.com/2026/05/set-custom-instructions-for-gemini-in-Google-Docs.html)
- [Gemini Canvas + Audio Overview — Google blog](https://blog.google/products-and-platforms/products/gemini/gemini-collaboration-features/)
- [Gemini Google I/O 26 features — 9to5Google](https://9to5google.com/2026/05/19/gemini-app-google-io-2026/)
- [Complete Guide to Google Gemini 2026 — aiblewmymind](https://aiblewmymind.substack.com/p/google-gemini-guide-every-feature-explained)
- [Grok (chatbot) — Wikipedia](https://en.wikipedia.org/wiki/Grok_(chatbot))
- [xAI Releasebot June 2026](https://releasebot.io/updates/xai)
- [xAI Grok in 2026 — Robylon](https://www.robylon.ai/blog/what-is-xai-grok-a-complete-guide-to-the-chatbot)
- [Grok Build, Skills + Connectors — Codersera](https://codersera.com/blog/xai-grok-build-skills-connectors-guide-2026/)
- [Grok Companions — Grokipedia](https://grokipedia.com/page/Grok_companions)
