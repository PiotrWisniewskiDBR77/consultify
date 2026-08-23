# Execution current-browser replay — 2026-08-23

Purpose: current local owner-review evidence for the restored Execution module.
This packet is technical browser evidence only. It is not owner acceptance and
it is not release evidence.

Runtime: `http://127.0.0.1:4390`
Visible runtime marker: `LOCAL @cc8848eb7d33`
Integration worktree baseline before this change: `f133739559f4e86e534151a13d2f6cda10c9bae6`
Viewport: `1280 × 720`

| File | Screen | SHA-256 |
|---|---|---|
| `01-realizacje.jpg` | Canonical initiative projection in Execution | `2965c1eef55433268b3be3c7475be3d48a329c71393a3b2786c99e2f73616712` |
| `02-praca-register.jpg` | Work register with seven review items | `4f6b4e61f14d0f530df5821fc9bf0c518db7dc3465fd30b69a9f059765a78d40` |
| `03-praca-document-menu3.jpg` | Task opened as a dynamic Menu 3 document | `625636f67ec05d925914592125366fd2ba86b8e5ecd64c462847b4cd828da968` |
| `04-zasoby.jpg` | Resource/capacity review table | `3f94f76c9e8b116fc85dda75af23921450db5d3b6252d3257ae8b79a652c36f3` |
| `05-sterowanie.jpg` | Control interventions and current closure block | `7e9974efd3af380577c961bfca76417b9f9ea1b731df899b85f81ffe9d3bdadc` |
| `06-raporty.jpg` | Report register and definitions | `2fa5b57bceed5a66667b3254e96e36822e8267eb70f68957ba0652bffbe294d1` |

Browser assertions:

- five expected tabs are visible: Realizacje, Praca, Zasoby, Sterowanie, Raporty;
- review data is visible on all five surfaces;
- opening a Work row creates a closable contextual Menu 3 document;
- the document contains governed controls, evidence/dependency context and the editor;
- returning to the list remains available through `Back to list`;
- Sterowanie still contains the historical closure form above its table; this is
  retained as an open visual/product finding, not silently accepted.
