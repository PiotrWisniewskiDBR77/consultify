# W17 — actual restore title divergence

Confirmed PRODUCT_RED on local built frontenddbf846f97e/indexb728db58734ab34250843538e0f6f9b0c4edf6709a4187142015d5761711ee9f and existing API5293. No deployment.

Owned deck7769e962faaa4ed5abbe85ebf98b4e49 had eight stable cards. A real competing write followed by stale UI save produced409; visible Load latest adopted version5, with history1–4 and no overwrite. Root inspected the conflict screenshot and raw evidence.

Visible Restore Version2 then sent one POST expectedVersion5, returned200/version6/restoredFrom2, and restored the card snapshot with history1–5. However raw restored deck_json.title is the selected old fixture title while presentation_decks.title remains the competing version5 title. API top-level title, normalized JSON title and UI header consequently show the newer title. Root independently parsed result081692a128fa1ed217e2677d3a87676d750f2f1ecbff5656e3b3a17af0727e35 (actual-v5-restore-v2/result.json in w17-deck-history-conflict-20260913 scratch). Zero page errors does not negate this persisted inconsistency.

Source cause: presentations.routes.ts restore UPDATE changes deck_json/version/updated_at without synchronizing the title column. Full PREZENTACJE_V8_CANONICAL_DECK_MODEL §6 requires queryable metadata synchronized with canonical content. Author owns a bounded restore-writer fix with existing tenant/CAS and history guarantees; no UI-only correction or compensating autosave. Fixture retained atversion6; no repeat restore merely to rerun a prior assertion. Actual restore→edit→reload acceptance stays open until the fix is integrated and retested.

Separately the accessible close-button label was independently accepted and integrated771e7970e6; not yet included in the currently served frontend. English toolbar labels and Notebook parent context remain separate active findings. Full W17 action coverage, three difficult scenarios per tool and all MVP release gates remain open.
