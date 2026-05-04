# Business Work Canvas Stage 41 Chat-To-Canvas Command Routing

Status: `PASSED`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 41 makes Canvas reachable from natural chat commands.

Users should be able to say "wrzuć to do Canvas", "zrób research canvas" or use `/canvas research` and land in the correct right-side work mode without losing the current Teresa conversation.

## 2. Completed Scope

- Added a local Canvas command parser to `UnifiedChatPanel`.
- Added routing for slash commands and explicit natural-language Canvas intents.
- Opened the right-side Canvas work panel from chat routing commands.
- Added controlled Canvas starter selection for routed commands.
- Persisted the user command in the current conversation with `canvasCommand` metadata.
- Prevented Teresa streaming from starting for local Canvas routing actions.
- Added component coverage for research Canvas routing and parser behavior.

## 3. Safety Contract

- Chat remains the same runtime and conversation.
- Canvas routing is a local UI command, not an AI prompt.
- Commands only trigger when the user explicitly mentions Canvas/work area/kanwa with a routing verb or uses a slash command.
- The Canvas starter remains visible and editable after routing.

## 4. Quality Gate

Stage 41 passes only when:

- explicit Canvas commands open the right work panel,
- the correct starter is selected for research, decision and plan routing,
- command metadata is persisted with the user message,
- Teresa stream is not started by local routing commands,
- targeted frontend tests pass,
- changed files have no linter errors.
