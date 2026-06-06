# Canvas Top-4 Benchmark — Consultify vs Claude Artifacts, Google Antigravity, ChatGPT Canvas, Gemini Canvas

**Date:** 2026-06-04
**Owner:** Piotr (CTO Consultify)
**Scope:** Benchmark Consultify Canvas (TipTap v3 chat split-view, markdown-canonical, AI-streaming, inline AI-diff, project knowledge / RBAC) against the four leading inline-document AI surfaces in 2025-2026.
**Internal audit score (Canvas today):** 62/100.

---

## 1. Executive summary

Consultify Canvas is at parity with the top-4 on the **core "AI writes into a document" paradigm** (split-view, streaming, inline diff, markdown). The top-4 are **ahead** on four axes:

1. **Sharing & publishing** — public links, embeddable, "share an AI-powered app" (Claude, Gemini).
2. **Run-and-preview** — Claude Artifacts render React/HTML/SVG live; ChatGPT Canvas runs Python; Antigravity runs the actual app in a browser surface.
3. **Versioning UX** — explicit version selector + "Show changes" diff between any two versions (ChatGPT, Claude).
4. **Multi-document / multi-tab** — Claude juggles N artifacts per chat; Antigravity orchestrates 5 parallel agents across editor + terminal + browser tabs.

Consultify Canvas is **uniquely positioned** on the axis none of the top-4 owns: **integration with consulting primitives** (Initiatives, Decisions, Tasks, Meetings, Radar, Notebook, Outputs/Reports) plus three sibling Studios (Document, Table/Excel, Presentation). The top-4 stop at "the artifact". Consultify can ship: *Canvas → "Save as Output", Canvas → "Promote to Slide deck", Canvas → "Extract decisions to Decisions module", Canvas → "Bind table to Excel Studio".* No competitor can do this; it is the only believable B2B-consulting moat.

**Parity score after Top-10 plan:** 62 → **84/100** target. The remaining 16 points are platform-deep features (true real-time multi-user editing, mobile, voice) deferred behind differentiator work.

---

## 2. Per-platform feature inventories

### 2.1 Claude Artifacts (Anthropic) — owner's reference "gold standard"

| Dimension | State 2025-2026 |
|---|---|
| Editor paradigm | Side-panel preview, not WYSIWYG. Renders **Markdown docs, code, HTML single-page apps, SVG, Mermaid diagrams, React components**. Editing is by *asking Claude to revise*; no rich-text manual editing in-panel (text is rendered, not directly typed). |
| Inline AI actions | Conversational — user instructs in chat, artifact updates. No floating selection menu inside the artifact itself. Claude Code (separate product) has y/n/d/e diff approval in CLI; Artifacts proper relies on chat. |
| Diff / accept-reject | "Replace is all you need" — fast targeted replacements rather than whole-doc regen. No granular hunk accept/reject in the Artifact UI (open feature request in Claude Code). |
| Versioning | Explicit **version selector** between iterations; editing a prior chat message creates a new branched version with its own artifact set. |
| Streaming | Real-time render into the side panel as Claude generates; live preview updates progressively. |
| Multi-artifact | **Multiple artifacts per conversation**, chat controls (slider icon) to switch between them. |
| Sharing | Public publish + embed on Free/Pro/Max; Team/Enterprise share is org-scoped only (publishing publicly disabled). Recipients can **run AI-powered artifacts free** (creator pays nothing extra). |
| Export | Copy to clipboard, download file. No native Docs/Slides/Sheets export (not the target audience). |
| Integration | **Projects** (Claude's RBAC workspace) → Artifacts wiring; **MCP** connects artifacts to Asana, Google Calendar, Slack; **Persistent storage** 20 MB/artifact (Pro+); **Live Artifacts** (Apr 2026, Cowork) auto-refresh from connected data. |
| Mobile / desktop | Web + desktop apps; mobile artifact viewing supported. |
| Last 6 months | Live Artifacts (Apr 2026), MCP-connected interactive apps, persistent storage, generative-UI / "interactive visuals" rendered inline between paragraphs (separate from Artifacts). |

Sources: [Claude Help — Artifacts](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them), [Publishing & sharing artifacts](https://support.claude.com/en/articles/9547008-publishing-and-sharing-artifacts), [Live Artifacts in Cowork](https://support.claude.com/en/articles/14729249-use-live-artifacts-in-claude-cowork), [MindStudio — Generative UI vs Artifacts](https://www.mindstudio.ai/blog/what-is-claude-generative-ui-vs-canvas-artifacts), [Replace-is-all-you-need analysis](https://medium.com/@rquintino/replace-is-all-you-need-the-surprisingly-simple-technique-behind-claudes-new-lightning-fast-b5ae18c3c113).

---

### 2.2 Google Antigravity (Google, Nov 2025) — agentic IDE, *not* Drive's old "Antigravity"

| Dimension | State Nov-2025 → Jun-2026 |
|---|---|
| Editor paradigm | VS Code-derived IDE. Two top-level surfaces: **Editor view** (synchronous, tab-completion + inline commands) and **Manager view** (asynchronous, orchestrates up to 5 parallel agents). |
| Inline AI actions | Tab completions + inline commands in editor; in Manager, agents act across editor + terminal + browser without human context switch. |
| Diff / accept-reject | Agent produces *Artifacts* (task lists, implementation plans, screenshots, browser recordings) as verifiable deliverables — user gives feedback on the artifact, agent re-runs. Not a hunk-level diff UI. |
| Versioning | Per-agent task runs; mission-control dashboard tracks state. Git-native (it is an IDE). |
| Streaming | Agents stream plans + actions live into Manager dashboard. |
| Multi-doc / multi-tab | **5 parallel agents** across separate workspaces. True multi-surface (editor + terminal + browser). |
| Sharing | IDE-local + Git push. No "public canvas link" concept. |
| Export | File system / Git; produces apps + recordings as artifacts. |
| Integration | Terminal, embedded browser for UI verification, model-agnostic (Gemini 3 Pro, Claude Sonnet 4.5, GPT-4o). |
| Mobile / desktop | macOS / Windows / Linux desktop only. |
| Last 6 months | Public preview launched Nov 2025; free for individuals. Wikipedia + dev.to coverage indicates rate-limit tightening in early 2026. |

Sources: [Google Developers Blog — Build with Antigravity](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/), [Antigravity launch blog](https://antigravity.google/blog/introducing-google-antigravity), [Wikipedia](https://en.wikipedia.org/wiki/Google_Antigravity), [dev.to public preview review](https://dev.to/blamsa0mine/google-antigravity-public-preview-what-it-is-how-it-works-and-what-the-limits-really-mean-4pe).

**Verdict for Consultify:** Antigravity is *not a peer* for Consultify Canvas — it's an agentic IDE. We borrow its **artifact verification** idea (screenshots, browser recording, plan-as-artifact) for *agent deliverables*, but the canvas paradigm itself is different.

---

### 2.3 ChatGPT Canvas (OpenAI)

| Dimension | State 2025-2026 |
|---|---|
| Editor paradigm | Side-panel "Google-Docs-style" doc + code editor. **Two modes**: text mode and code mode (auto-detected; mixed content uses text). |
| Inline AI actions | **Floating menu / preset tools**: Suggest Edits (inline comments), Adjust the Length (slider), Change Reading Level (Kindergarten → Graduate), Add Final Polish, Add Emojis. Code mode adds Add Comments, Add Logs, Fix Bugs, Port Language, **Run Python in-canvas**. |
| Diff / accept-reject | **"Show changes" button** in top toolbar — visual additions/deletions diff between any two versions, for both docs and code. |
| Versioning | Explicit version history with side-by-side diff between drafts. |
| Streaming | Streams into canvas; targeted edits update in place rather than full regen. |
| Multi-doc | One canvas at a time per chat; switching topic opens a new canvas. |
| Sharing | Share canvas asset (rendered React/HTML, document, code) by link, similar to sharing a chat. Project threads also have unique shareable links. |
| Export | Copy / download; **no native Docs/Slides/Sheets export** — OpenAI is its own ecosystem. |
| Integration | **Projects** (RBAC + project knowledge), Deep Research, Voice Mode (desktop + mobile, including screen-share). |
| Mobile / desktop | Web + desktop apps fully supported. **Canvas on mobile = still "coming soon"** as of mid-2026. |
| Last 6 months | Canvas expanded to **build interactive apps + call APIs**; tighter Project ↔ Canvas wiring; voice + screen-share on mobile; suggest-edits inline comments. |

Sources: [OpenAI — Introducing canvas](https://openai.com/index/introducing-canvas/), [OpenAI Help — Canvas](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it), [DataStudios Canvas update](https://www.datastudios.org/post/chatgpt-canvas-projects-update-export-options-deep-research-voice-mode-and-mobile-workflow), [ai-toolbox — Canvas sharing](https://www.ai-toolbox.co/chatgpt-management-and-productivity/canvas-sharing-how-to-share-chatgpt-canvas-creations), [DataCamp guide](https://www.datacamp.com/blog/chatgpt-canvas).

---

### 2.4 Gemini Canvas (Google)

| Dimension | State 2025-2026 |
|---|---|
| Editor paradigm | Interactive side-panel. **Docs, code, slides, mini-apps**. Auto-saved. |
| Inline AI actions | **Highlight-to-edit popover** — select section, ask to rewrite/shorten/change tone; only that segment edits. Quick-edit buttons for length & tone; toolbar formatting; whole-doc Edit button with plain English. |
| Diff / accept-reject | "Recent changes" tracking in code; no formal version-pair diff like ChatGPT's Show changes. |
| Versioning | Auto-save with recent-changes log; lighter than ChatGPT/Claude on explicit version history. |
| Streaming | Streams into the panel; inline edits stay scoped to the selection. |
| Multi-doc | One canvas at a time per chat. |
| Sharing | **Public share links** with collaborative editing for 18+. Recipients can fork ("make a copy and continue editing with Canvas"). Mobile share links open desktop only. |
| Export | **One-click Export to Docs, Export to Slides, Export to PDF**, plus Python → **Google Colab** for data science. Rolled out broadly Apr 11, 2026. |
| Integration | Gemini Enterprise / Workspace native — naturally rides Docs/Slides/Sheets ecosystem. Canvas in **Search AI Mode** rolled out to US users Mar 4, 2026. |
| Mobile / desktop | Web + Android Gemini app; shared canvas links require desktop. |
| Last 6 months | Audio overviews, quizzes, infographics, web pages from existing content; Slides export; Search AI Mode integration. |

Sources: [Gemini Apps Help — Canvas](https://support.google.com/gemini/answer/16047321?hl=en&co=GENIE.Platform%3DDesktop), [Gemini Enterprise — Docs & slides in Canvas](https://docs.cloud.google.com/gemini/enterprise/docs/assistant-canvas), [Gemini Canvas overview](https://gemini.google/overview/canvas/), [TechCrunch — Canvas in Search AI Mode](https://techcrunch.com/2026/03/04/https-techcrunch-com-2026-03-04-google-search-rolls-out-geminis-canvas-in-ai-mode-to-all-us-users/), [findskill.ai — Slides decks from one prompt](https://findskill.ai/blog/gemini-canvas-presentations-tutorial/), [Google Workspace updates blog Mar 2026](https://blog.google/products-and-platforms/products/workspace/gemini-workspace-updates-march-2026/).

---

## 3. GAP table — what the top-4 have that Consultify Canvas does not

| # | Capability | Who has it | Consultify today | Effort | Verdict |
|---|---|---|---|---|---|
| G1 | **"Show changes" version-pair diff** (visual additions/deletions between any two saved versions) | ChatGPT, Claude | Inline AI-diff exists, but no version-vs-version diff | M | **Quick Win** — extend existing diff layer to compare any two `canvas_versions` rows |
| G2 | **Explicit version selector + branch from prior message** | Claude, ChatGPT | Linear version history only | M | **Quick Win** |
| G3 | **Multi-canvas per chat** (N artifacts in one thread, switch via slider) | Claude | One canvas per split-view | M-H | **Strategic** — high value for consulting (deliverable + working notes side-by-side) |
| G4 | **Adjust Length / Reading Level / Final Polish presets** | ChatGPT | We have free-form AI prompt | S | **Quick Win** — preset buttons over existing AI handler |
| G5 | **Suggest Edits (inline AI comments)** | ChatGPT | Not yet — only diff | M | **Strategic** — fits B2B review workflows perfectly |
| G6 | **Highlight-to-edit popover scoped to selection** | Gemini, ChatGPT | We have it via floating menu? confirm in our impl | S | **Quick Win** if missing — confirm and ship |
| G7 | **Public share link / publish artifact** | Claude, ChatGPT, Gemini | RBAC org-only; no public link | M | **Strategic** — gated, watermarked, "Send to client" CTA |
| G8 | **Embeddable / "run live" artifact** (React/HTML/SVG live preview) | Claude | Markdown only | H | **Skip for v1** — not consulting-shaped; revisit if dashboards take off |
| G9 | **Run Python in canvas** | ChatGPT | No | H | **Skip** — defer to Table Studio path |
| G10 | **Export to Google Docs / Slides / PDF in one click** | Gemini | DOCX/PDF export from Document Studio, but not from Canvas itself | S-M | **Quick Win** — wire Canvas → Document Studio export pipeline |
| G11 | **Auto-save with "recent changes" log** | Gemini | Manual save? confirm | S | **Quick Win** |
| G12 | **Generative-UI / interactive visuals inline in chat** | Claude | No | H | **Skip for v1** |
| G13 | **Manager / multi-agent orchestration across surfaces** | Antigravity | Teresa is single-agent | XH | **Skip / Strategic-future** — Wave-3 candidate |
| G14 | **Mobile canvas** | Gemini partial, Claude view-only | Desktop-first | H | **Strategic-deferred** — past GA |
| G15 | **Live Artifacts (auto-refresh from connected data)** | Claude (Cowork) | No | H | **Strategic** — natural fit for Radar / Initiatives dashboards |
| G16 | **MCP-connected artifacts** | Claude | Teresa has tools, Canvas doesn't expose | M | **Strategic** — reuse Teresa tool registry from Canvas selection |

---

## 4. DIFFERENTIATOR table — what only Consultify can ship

None of the top-4 has *consulting primitives*. Document Studio + Table/Excel Studio + Presentation Studio + Outputs + Initiatives + Decisions + Tasks + Meetings + Radar + Notebook + Ideas form a **graph** the top-4 simply cannot replicate. Canvas should become the **conductor** of that graph.

| # | Differentiator | One-line description | Effort | Why nobody else can copy |
|---|---|---|---|---|
| D1 | **Canvas → Output ("Save as deliverable")** | Promote any canvas to an entry in Outputs/Reports module with metadata (client, project, type, status) | S | They have no Outputs module |
| D2 | **Canvas → Presentation Studio** | "Convert to slide deck" — sectioning heuristic + auto-layout in Presentation Studio | M | Gemini exports to Google Slides; we ship a *native deck editor* that stays inside the platform |
| D3 | **Canvas ↔ Table/Excel Studio bind** | Insert a `live-table` block; bind to a Table Studio sheet; edits flow both ways, formulas evaluated server-side | M-H | None of the top-4 has a paired spreadsheet surface |
| D4 | **Canvas → Document Studio (DOCX/PDF export with brand)** | One-click export retaining brand template, headers, footers, page numbers | S | Closest: Gemini → Google Docs; ours is brand-styled, not raw export |
| D5 | **Canvas → Decisions** | Highlight a paragraph → "Capture as Decision" → creates a Decision entity with provenance link back to canvas span | S | Decisions module is unique to Consultify |
| D6 | **Canvas → Tasks** | "Extract action items" Teresa tool sweeps doc → creates Tasks with assignees, due dates, links | S | We already wired Teresa create_task; just expose as canvas button |
| D7 | **Canvas → Initiatives** | "Spin up Initiative" — create Initiative entity with this canvas attached as the brief | S | Wave-1 just shipped initiative creation; reuse |
| D8 | **Canvas → Radar** | "Log as signal / risk" — push a span into Radar with severity | S | Radar is unique |
| D9 | **Canvas → Meetings prep** | "Generate meeting brief from canvas" → Calendar entity with attached briefing | S | Meeting Studio is unique |
| D10 | **Project Knowledge-grounded streaming** | Canvas AI streams cite project-knowledge sources inline (RBAC-checked, with hover-card source preview) | M | We have RBAC project knowledge; Claude's Projects + Artifacts is closest but not citation-grounded in-canvas |
| D11 | **Consulting prompt presets** | Domain-tuned presets: "Convert to MECE", "Tighten to executive memo", "Add Pyramid intro", "SCQA-ify" | S | Generic tools have nothing consulting-specific |
| D12 | **Canvas → Notebook page promotion** | Drop a canvas section into a Notebook (the new notebooks-of-notes overhaul) — personal vs team typology preserved | S | Notebook is unique |
| D13 | **Client-share watermarked link** | Public share with watermark, expiry, optional NDA gate — for sending drafts to clients | M | Top-4 share is consumer-grade; ours is B2B-shaped |
| D14 | **Audit trail per canvas span** | Every AI-generated paragraph carries an `ai_provenance` record (model, prompt, sources, accept/reject decision, who clicked) — exportable for compliance | M | Critical for regulated-industry consulting; nobody has it |
| D15 | **Cross-canvas reuse blocks** | A `snippet` block backed by a workspace-level library — change once, propagate to all canvases that embed it | M | Notion-style; none of the top-4 has it in their canvas |

---

## 5. Top-10 proposed Canvas adds — ranked by impact ÷ effort for B2B consulting

Mix of **COPY** (parity with top-4) and **INVENT** (only-we-can-do).

| Rank | Item | Type | Effort | Impact | Why now |
|---|---|---|---|---|---|
| 1 | **D6 Extract Tasks + D5 Capture Decision + D1 Save as Output** (one button row "Promote") | INVENT | S | Massive | Connects Canvas to 3 existing Wave-1 modules in one shippable strip. Owner sees integration moat working in week 1. |
| 2 | **G4 Preset AI actions** (Adjust length, Reading level, Final polish, MECE-ify, SCQA-ify, Pyramid intro) | COPY+INVENT | S | High | ChatGPT-parity buttons + 3 consulting-only presets. Closes a visible UX gap. |
| 3 | **D4 Canvas → Document Studio brand export (DOCX + PDF)** | INVENT | S-M | High | "Send-to-client" — every consulting workflow needs this; Gemini has plain Docs export, ours is brand-styled. |
| 4 | **G1 Show-changes diff between any two versions** + **G2 explicit version selector** | COPY | M | High | Parity with ChatGPT + Claude. Canvas already has version table; UI wrap. |
| 5 | **D10 Project-knowledge citations inline in streaming** | INVENT | M | Very High | Project knowledge just shipped (RBAC). Adding citation chips with hover preview is the single biggest perceived-quality jump. |
| 6 | **G5 Suggest-Edits inline AI comments** | COPY | M | High | Review workflow is core consulting. Implement as a `canvas_comments` thread anchored to spans. |
| 7 | **D2 Convert to slide deck (Presentation Studio)** | INVENT | M | High | Sectioning heuristic → Presentation Studio. Visible "wow" for partners. |
| 8 | **G3 Multi-canvas per chat** (slider + tabs) | COPY | M-H | High | Consulting: brief + draft + appendix side-by-side. Claude-parity. |
| 9 | **D13 Watermarked client share link** (expiry, optional gate) | INVENT | M | High | Replaces "PDF over email" — a workflow we own. |
| 10 | **D14 AI-provenance audit trail per span** | INVENT | M | Medium-High (very high for enterprise) | Differentiator vs all top-4; unlocks regulated-industry sales. |

**Deferred (deliberate skip for v1):**
- G8 live React/HTML rendering (not consulting-shaped),
- G9 Python-in-canvas (Table Studio's job),
- G12 inline generative-UI (premature),
- G13 multi-agent Manager (Wave-3),
- G14 mobile canvas (post-GA).

**Score trajectory:** 62 → **84/100** after items 1-7 ship; items 8-10 take us to 90/100. Remaining 10 points require true multi-user real-time editing (Yjs/CRDT layer) which is the right Wave-2 bet.

---

## 6. One-line per-platform reads (for executive memo)

- **Claude Artifacts** — best-in-class for *live, runnable, persistent, MCP-connected* side-panel content; weakest on rich-text inline editing (chat-driven).
- **Google Antigravity** — not a canvas peer; it is an agentic IDE that *we should borrow the artifact-verification pattern from* (screenshots, plans, recordings as deliverables) for Teresa, not Canvas.
- **ChatGPT Canvas** — best-in-class for *writer-centric* UX: preset edit tools, Show-changes diff, suggest-edits comments; weakest on ecosystem export.
- **Gemini Canvas** — best-in-class for *Workspace export* (Docs/Slides/PDF/Colab one-click) and highlight-to-edit selection UX; weakest on versioning and shareable persistence model.

---

## 7. Sources (consolidated)

**Claude Artifacts:** [Help — Artifacts](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them) · [Publishing & sharing](https://support.claude.com/en/articles/9547008-publishing-and-sharing-artifacts) · [Live Artifacts in Cowork](https://support.claude.com/en/articles/14729249-use-live-artifacts-in-claude-cowork) · [Projects](https://www.anthropic.com/news/projects) · [MindStudio — Generative UI vs Canvas vs Artifacts](https://www.mindstudio.ai/blog/what-is-claude-generative-ui-vs-canvas-artifacts) · [Replace-is-all-you-need (artifact update mechanics)](https://medium.com/@rquintino/replace-is-all-you-need-the-surprisingly-simple-technique-behind-claudes-new-lightning-fast-b5ae18c3c113) · [Anchorify — Teams artifact sharing post-removal](https://anchorify.io/blog/claude-artifact-share-after-teams-plan-removal)

**Google Antigravity:** [Google Developers Blog — Build with Antigravity](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/) · [Antigravity launch](https://antigravity.google/blog/introducing-google-antigravity) · [Wikipedia](https://en.wikipedia.org/wiki/Google_Antigravity) · [dev.to public-preview review](https://dev.to/blamsa0mine/google-antigravity-public-preview-what-it-is-how-it-works-and-what-the-limits-really-mean-4pe) · [Codecademy setup guide](https://www.codecademy.com/article/how-to-set-up-and-use-google-antigravity)

**ChatGPT Canvas:** [OpenAI — Introducing canvas](https://openai.com/index/introducing-canvas/) · [OpenAI Help — Canvas](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it) · [DataStudios — Canvas + Projects + Voice update](https://www.datastudios.org/post/chatgpt-canvas-projects-update-export-options-deep-research-voice-mode-and-mobile-workflow) · [DataCamp Canvas guide](https://www.datacamp.com/blog/chatgpt-canvas) · [ai-toolbox — Canvas sharing](https://www.ai-toolbox.co/chatgpt-management-and-productivity/canvas-sharing-how-to-share-chatgpt-canvas-creations) · [ai-toolbox — 2026 guide](https://www.ai-toolbox.co/chatgpt-management-and-productivity/how-to-use-chatgpt-canvas-guide-2026)

**Gemini Canvas:** [Gemini Apps Help — Canvas](https://support.google.com/gemini/answer/16047321?hl=en&co=GENIE.Platform%3DDesktop) · [Gemini Enterprise — Docs & slides in Canvas](https://docs.cloud.google.com/gemini/enterprise/docs/assistant-canvas) · [Gemini Canvas overview](https://gemini.google/overview/canvas/) · [TechCrunch — Canvas in Search AI Mode](https://techcrunch.com/2026/03/04/https-techcrunch-com-2026-03-04-google-search-rolls-out-geminis-canvas-in-ai-mode-to-all-us-users/) · [findskill.ai — Slides from one prompt](https://findskill.ai/blog/gemini-canvas-presentations-tutorial/) · [Google blog — Workspace updates Mar 2026](https://blog.google/products-and-platforms/products/workspace/gemini-workspace-updates-march-2026/) · [Blue Lightning — Canvas sharing](https://bluelightningtv.com/2026/05/04/gemini-canvas-makes-ai-prototypes-easy-to-share/)
