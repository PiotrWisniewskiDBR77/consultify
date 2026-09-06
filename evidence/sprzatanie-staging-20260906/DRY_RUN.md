# DRY RUN — sprzątanie danych testowych DBR77

Wygenerowano: 2026-09-05T21:37:17.077Z
Organizacja: DBR77 (a3e05d4a-5397-419d-b486-8e44366c0063)

## A. Skan ogólny (informacyjny, information_schema)

| tabela | kolumna | liczba trafień |
| --- | --- | --- |
| activity_logs | entity_name | 17 |
| artifact_lineage_receipts | title_snapshot | 10 |
| canonical_inbox_items | title | 3 |
| canonical_inbox_items | description | 3 |
| conclusion_source_packs | context_summary | 1 |
| conclusions | title | 12 |
| decisions | title | 3 |
| document_studio_templates | name | 4 |
| generated_workbooks | title | 5 |
| generated_workbooks | file_name | 6 |
| organization_context_items | source_label | 164 |
| presentation_decks | title | 1 |
| presentation_templates | name | 6 |
| tool_sessions | name | 12 |
| tp_base_templates | name | 3 |
| v8_output_artifacts | title_snapshot | 43 |
| v8_output_artifacts | origin_summary_json | 6 |
| wave5_artifacts | title | 3 |
| wave6_context_ledger | source_title | 2 |
| work_canvas_drafts | title | 1 |

_Uwaga: wave6_context_ledger: 2 trafienia wzorca to fałszywe pozytywy (artykuł "Test-retest reliability..." — treść merytoryczna, nie dane testowe). Tabela wykluczona z planu akcji._


## B. Plan akcji (skurowany, ręcznie zweryfikowany) — kandydaci do USUNIĘCIA/ARCHIWIZACJI


### activity_logs — hard-delete (17 wierszy)

_Log zdarzeń, brak status/archived/deleted_at, brak dzieci FK. 17 wierszy testowych (WAVE1-TEST-CANVAS, qa-test-workflow, test-rec-map-direct-output)._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 59c399e3-5b86-4ed1-9c53-929fef2ab821 | entity_name | test-rec-map-direct-output | 2026-03-16 21:34:01.86622 |
| 3ddf921c-2d1c-4baf-9e38-69fb5b5dac16 | entity_name | qa-test-workflowqa-test-workflow | 2026-04-28 19:52:16.771807 |
| 565b98da-de5e-4e76-a715-6c1a6b8ceae3 | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 12:56:52.109416 |
| 367ecd46-a8c7-4525-9d27-4d81687992fc | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 12:57:37.339787 |
| c29b7090-48b8-46e1-a134-c32aef1ff2ba | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 12:57:52.432488 |
| 5990c544-bfbd-45c4-827d-702debe50464 | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 13:23:06.579284 |
| d31353c8-cc95-4ba5-b763-78377b283f44 | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 13:23:09.580046 |
| 1c22aaf9-a7ff-4f29-b8e6-0f572be67a78 | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 13:23:09.898224 |
| b5e2555d-bd55-4d77-a584-42a7f27637f6 | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 13:23:29.548676 |
| 3c1511e0-285c-407e-8522-727035edf4c6 | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 13:23:39.834669 |
| f2d3c7cc-53ad-40b7-af16-5a259866cbd6 | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 13:23:51.655078 |
| 96348bf4-9d34-4a66-b30a-69b4164a7823 | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 13:24:30.174291 |
| bbc00216-2a88-4133-af0b-4847ded8a6b3 | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 13:24:30.24741 |
| e9ee6fc4-6005-4acf-ab46-cd3603117eaf | entity_name | WAVE1-TEST-CANVAS | 2026-05-16 13:26:19.254108 |
| 9449cab9-7601-455c-aec1-726d3d490da8 | entity_name | Regression Test DocumentWAVE1-TEST-CANVAS | 2026-05-16 13:32:31.399309 |
| 96d28d5f-fa97-4614-9620-8f967cd44e73 | entity_name | Regression Test DocumentWAVE1-TEST-CANVAS | 2026-05-16 13:32:41.99225 |
| 3ac4b941-dbc6-4832-a14c-3d3c20c37fac | entity_name | Regression Test DocumentWAVE1-TEST-CANVAS | 2026-05-16 13:33:02.506997 |

### artifact_lineage_receipts — hard-delete (10 wierszy)

_Paragon rodowodu artefaktu (NIE artifact_lifecycle_events — tamten ma trigger deny-delete/update i nie jest tu ruszany). Brak FK, brak triggera, sprawdzone w transakcji próbnej. 10 wierszy z jednej sesji E2E z 2026-08-06._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 5e9b696f-23fc-4b8d-9960-9be9e67c7fa9 | title_snapshot | Raport statusu inicjatywy DBR77 — TEMPLATE-E2E-20260806 | 2026-08-06 16:49:01.012066 |
| 7c76ae51-d2ec-4fb6-bb92-9efc46b9a6c6 | title_snapshot | Executive Progress &amp; Assumptions Brief — TERESA-E2E-20260806 | 2026-08-06 16:53:31.637522 |
| 8f1eb930-b965-470d-bdf2-49815fbda262 | title_snapshot | Risk &amp; Actions Brief — TERESA-E2E-20260806 | 2026-08-06 16:52:11.100406 |
| d517df50-3ac8-470f-82eb-3140c44ce7d9 | title_snapshot | Initiative Budget — E2E-20260806 | 2026-08-06 16:51:09.155608 |
| 10ce4f99-71dd-4808-a063-c413ac8764d6 | title_snapshot | Milestone Tracker — E2E-20260806 | 2026-08-06 17:04:43.344739 |
| 9f01500c-58bd-4bf1-a8d3-7cab3db9f2ba | title_snapshot | Benefits Realization — E2E-20260806 | 2026-08-06 17:07:06.623364 |
| d2b00a63-7241-47d5-918b-abb1dc0d863e | title_snapshot | Initiative Budget — Teresa — E2E-1200000 | 2026-08-06 17:27:44.379431 |
| 39106478-cb6f-4ebf-91f7-53b30e75e406 | title_snapshot | Initiative Budget — Teresa — E2E-20260806 | 2026-08-06 17:46:20.590321 |
| 5ecc76d7-e151-442e-bd34-df893af2ebba | title_snapshot | Board Portfolio Update — E2E-20260806 | 2026-08-06 17:56:56.94627 |
| b9fbe2ba-2e3b-44fe-87aa-97fe5fd336b6 | title_snapshot | Initiative Budget — E2E-20260806 | 2026-08-06 20:21:13.422705 |

### canonical_inbox_items — hard-delete (4 wierszy)

_Ma kolumnę status, ale to stan roboczy skrzynki (pending/resolved/triaged) bez wartości "archived" — brak dzieci FK, więc hard-delete. Wykluczone 2 realne powiadomienia o wywiadzie (fałszywe trafienie na słowo "test-related" we fragmencie treści notatki jakości AI)._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 1e00aa56-d0bd-47a0-8efd-28406fa9b2a6 | title | M05-E2E-CV-Dec-6zcys5 | 2026-07-28 03:52:11.488+00 |
| 1c4f1b4c-f4cc-4e53-bde2-62b1289b3c77 | title | M05-E2E-CV-Dec-2jydvv | 2026-07-28 03:52:11.488+00 |
| 7bce6350-dfe6-4200-a8dd-ba1600fe7546 | title | M05-E2E-CV-Dec-ewf3j8 | 2026-07-28 03:52:11.488+00 |
| 046f2cf1-47a6-4990-9c4c-f88942d32964 | description | "Board Portfolio Update — E2E-20260806" has been exported as PPTX. | 2026-08-07 06:58:59.567+00 |

### conclusion_source_packs — hard-delete (1 wierszy)

_Brak status/archived/deleted_at, brak dzieci FK. 1 wiersz powiązany z testową ideą MyWork._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| sp_tools_d670319c-1e46-4a27-99eb-94b7e315cd4e | context_summary | {"myWork":true,"origin":"MYWORK","source":{"type":"idea","id":"25775bd3-4e71-458f-87f1-4ef901315f52"},"summary":"probe"} | 2026-07-04 04:25:09.337 |

### conclusions — soft-delete (12 wierszy)

_Kolumna status bez CHECK — bezpieczna wartość "archived". 12 wierszy (MyWork idea/notebook z sesji M05-E2E i M05-PROBE-DELETEME)._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 14105006-d876-4f03-9322-da8f5b402263 | title | MyWork idea: M05-E2E-CV-Tasks-zrhdop | 2026-07-04 04:25:08.955 |
| 4d8b32fd-ffd5-4115-aefe-609f99e164b6 | title | MyWork idea: M05-E2E-CV-Init-04axfl | 2026-07-04 04:25:08.985 |
| 45aaa65c-c3e5-4be1-be0c-de56748f2e84 | title | MyWork idea: M05-E2E-CV-Dec-ewf3j8 | 2026-07-04 04:25:09.003 |
| ab3fe49c-06ae-4626-ac89-2b9c28e36116 | title | MyWork idea: M05-E2E-CV-Tasks-r7gsm9 | 2026-07-04 04:25:09.056 |
| 82f5442e-44be-4b32-8aae-55ec6edf3da0 | title | MyWork idea: M05-E2E-CV-Init-iog6dk | 2026-07-04 04:25:09.092 |
| ba035221-7ebf-4be7-ab59-f070e8c45f4a | title | MyWork idea: M05-E2E-CV-Dec-2jydvv | 2026-07-04 04:25:09.166 |
| c9c11093-a791-46f1-8436-e942012554f3 | title | MyWork idea: M05-E2E-CV-Tasks-qgfsoy | 2026-07-04 04:25:09.257 |
| 34319c9c-fdb6-4857-b463-a02882817f82 | title | MyWork idea: M05-PROBE-DELETEME | 2026-07-04 04:25:09.337 |
| a7186846-4bf0-4631-adfe-36a7fa437e7e | title | MyWork notebook: M04 Autosave Probe 7731 | 2026-07-04 04:25:09.804 |
| ad76db38-9723-44cc-a873-cdd560fa63ed | title | MyWork notebook: M04 Autosave Probe 7731 | 2026-07-04 04:25:09.817 |
| 92750c3c-8212-48b5-9ed8-b42c481e161c | title | MyWork idea: M05-E2E-CV-Dec-6zcys5 | 2026-07-04 04:25:08.935 |
| bdfc104e-230b-4bc7-84f6-86f63ce90a84 | title | MyWork idea: M05-E2E-CV-Init-y3sbhb | 2026-07-04 04:25:09.28 |

### decisions — soft-delete (3 wierszy)

_Kolumna status bez CHECK, ale domena to stany decyzji (pending/expired/cancelled/approved/rejected) — "cancelled" to realna, bezpieczna wartość zamiast wymyślonej. Ma CASCADE do decision_alternatives/_comments/_votes/... oraz trigger trg_mw_decisions_inbox_lifecycle_upd (AFTER UPDATE) — soft-delete korzysta z tej samej ścieżki co normalna zmiana statusu w apce._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 97fb0453-604e-44b6-853b-e637457e7f8a | title | M05-E2E-CV-Dec-ewf3j8 | 2026-06-20 20:20:18.369981 |
| d8dc7d5c-70ba-4ba5-a7fd-0864465a98e5 | title | M05-E2E-CV-Dec-6zcys5 | 2026-06-21 00:25:45.231871 |
| ce95d913-e06a-4b06-bc5e-649e283f213c | title | M05-E2E-CV-Dec-2jydvv | 2026-06-20 19:59:45.796464 |

### document_studio_templates — soft-delete (4 wierszy)

_CHECK dopuszcza tylko draft/approved/deprecated — "deprecated" to poprawna wartość domenowa na wycofanie szablonu. 4 wiersze E2E-20260806._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| doc-template-1786034866998-r8tbuk3o | name | Board Decision Memo — E2E-20260806 | 2026-08-06 16:47:46.998+00 |
| doc-template-1786034868202-uvvy01fy | name | Budget Narrative Report — E2E-20260806 | 2026-08-06 16:47:48.202+00 |
| doc-template-1786034856774-qesz2d8e | name | Initiative Status Report — E2E-20260806 | 2026-08-06 16:47:36.774+00 |
| doc-template-1786043198758-sdluley7 | name | Board Investment Decision Memorandum — Premium E2E-20260806 | 2026-08-06 19:06:38.758+00 |

### generated_workbooks — soft-delete (6 wierszy)

_Kolumna archived_at istnieje dokładnie po to. 6 unikalnych wierszy (dopasowanie po title LUB file_name, deduplikowane po id w SQL)._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 019bd504-3dac-4529-8157-b1d1c99689c2 | title | Initiative Budget — E2E-20260806 | 2026-08-06 16:51:09.084 |
| eb619e0c-9c20-493a-9262-8883608aab45 | title | Milestone Tracker — E2E-20260806 | 2026-08-06 17:04:43.263 |
| e8203780-7db7-4175-8ba9-3abd060421d9 | title | Benefits Realization — E2E-20260806 | 2026-08-06 17:07:06.573 |
| f790f9a3-8896-44d5-b8c9-1d1a88ff5b6c | title | Initiative Budget — Teresa — E2E-1200000 | 2026-08-06 17:27:44.304 |
| b31c6383-83b2-405f-a240-d1f3049bbefa | title | Initiative Budget — Teresa — E2E-20260806 | 2026-08-06 17:46:20.557 |
| 550fe25b-c01f-4d32-ab20-c0324a554e07 | file_name | Initiative_Budget_E2E-20260806.xlsx | 2026-08-06 20:21:13.375 |

### organization_context_items — hard-delete (164 wierszy)

_Brak status/archived/deleted_at; ma dziecko FK organization_context_claims z ON DELETE CASCADE. 164 wiersze (M05-E2E-*, __M06_REPRO_TEST__, M05-PROBE-*, ZPROBE-TOP-*, AUDYT-M06, M08-Manual-Test-Table)._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 5ee5348c-6fa2-4bcc-8f89-b6cf925fc890 | source_label | M05-E2E-InFolder-wil3cj | 2026-06-20 19:51:52.865 |
| d0d03d04-2ace-442b-bd98-8e0cf7f877cf | source_label | M05-E2E-Fav-61k9kd | 2026-06-20 19:52:02.677 |
| 8f3bbb2d-6b8e-45a0-864d-ca40b082376f | source_label | M05-E2E-Fav-61k9kd | 2026-06-20 19:52:03.504 |
| 2bdf6873-b768-4835-b5b0-ab5efd4a9568 | source_label | M05-PROBE-DELETEME | 2026-06-20 16:33:53.638 |
| 93422d4d-72ef-4fc7-ab40-51f869c5da4b | source_label | M05-409-PROBE | 2026-06-20 16:39:31.485 |
| 9b34259c-c342-4234-86cf-c140e88e0ee3 | source_label | M05-E2E-Fav-rfszdc | 2026-06-20 20:12:46.797 |
| c9899a66-5d42-4eed-bd69-3e9dd50cd7e3 | source_label | M05-E2E-Edit-qdksfh-ZMIANA | 2026-06-20 19:51:11.712 |
| 97b42193-e398-434d-8e11-d975d706d406 | source_label | M05-E2E-Gate-vtc0b8 | 2026-06-20 19:40:44.464 |
| 1770f3d8-0334-413f-94ab-c67fda0f522f | source_label | M05-E2E-Create-ck37ll | 2026-06-20 19:40:59.827 |
| 07264894-da51-487f-a63e-c9f897409607 | source_label | M05-E2E-Edit-gaiuyy | 2026-06-20 19:41:15.664 |
| dc944193-1b99-44c8-a373-3cefe6bb47b8 | source_label | M05-E2E-Delete-10elk2 | 2026-06-20 19:42:34.583 |
| 8d234257-7166-49fe-8ac7-a2128800a1cf | source_label | M05-E2E-Views-9cf2yy | 2026-06-20 19:42:49.481 |
| 1ac864bb-420c-4b3c-abc5-95deef11f23c | source_label | ZPROBE-TOP-li7boc | 2026-06-20 19:43:14.486 |
| a8117b71-3d74-445a-98b9-9e6b07c73617 | source_label | ZPROBE-TOP-q1xukm | 2026-06-20 19:44:37.313 |
| c772565f-5d5b-433f-a320-7cc014cbcb2c | source_label | M05-PROBE-SPEED-1 | 2026-06-20 19:45:08.64 |
| fba33927-03cb-4349-8bb2-e3b1d84e5316 | source_label | M05-PROBE-SPEED-2 | 2026-06-20 19:45:30.144 |
| c7a5194f-6127-4ddf-b05c-e6f83b245296 | source_label | M05-PROBE-SPEED-3 | 2026-06-20 19:45:52.078 |
| 211fba60-88c2-45eb-81b9-80c40fbabb4a | source_label | M05-E2E-Gate-9i73mn | 2026-06-20 19:50:43.757 |
| d575c57f-61bd-4d26-9d31-ed0cd2e55df7 | source_label | M05-E2E-Create-zxi9zz | 2026-06-20 19:51:01.864 |
| 3b617b7a-1479-4ebd-ae59-e436aec9fad7 | source_label | M05-E2E-Edit-qdksfh | 2026-06-20 19:51:10.567 |
| ea9d5b71-9f63-4dc3-8322-f7b87ba094e5 | source_label | M05-E2E-Delete-zec8ad | 2026-06-20 19:51:19.862 |
| eae1bc8c-d8b7-4623-bb90-f0dcbebea7bb | source_label | M05-E2E-Views-yqf2bc | 2026-06-20 19:51:28.653 |
| d36c7d43-69cf-4a93-acb7-5b5ba8930210 | source_label | M05-E2E-Sort-HIT-fuhqd7 | 2026-06-20 19:51:41.185 |
| 5bb4eda2-04f4-4df6-84e1-abce7ab7a8ca | source_label | M05-E2E-Sort-MISS-t3064n | 2026-06-20 19:51:41.725 |
| 79233ed5-fad8-4da5-8645-c668354cb918 | source_label | M05-E2E-Fav-61k9kd | 2026-06-20 19:52:02.154 |
| 9d093dda-4d2f-485d-9e40-a2fb7c2ed092 | source_label | M05-E2E-WS-of9d8d | 2026-06-20 19:52:18.931 |
| 615a9c92-02b8-4cd0-a21c-65f91c112154 | source_label | M05-E2E-InFolder-wil3cj | 2026-06-20 19:51:50.857 |
| 2ca29714-4894-457a-a020-800d83f17244 | source_label | M05-E2E-WS-zzkm89 | 2026-06-20 19:52:30.245 |
| a110233f-d34f-4d61-9778-1bfa8e5d95b2 | source_label | M05-E2E-WS-h76zbo | 2026-06-20 19:52:43.988 |
| 114514a3-5d3a-483c-ac7f-0511a8caf565 | source_label | M05-E2E-WS-obbt7l | 2026-06-20 19:53:18.073 |

_... +134 więcej (pełna lista w bazie, zapytanie w RAPORT.md)_


### presentation_decks — hard-delete (1 wierszy)

_Ma kolumnę status, ALE CHECK ogranicza do draft/generating/ready/exported/failed — żadna wartość nie oznacza "ukryty/wycofany", więc soft-delete jest niewykonalny bez łamania CHECK. Wyjątek udokumentowany: hard-delete uzasadniony przez dzieci FK z CASCADE (presentation_cards, presentation_deck_versions). 1 wiersz E2E-20260806._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 5178257dc9524d9a9a4da3d87fb950ec | title | Board Portfolio Update — E2E-20260806 | 2026-08-06 17:56:56.770701 |

### presentation_templates — soft-delete (6 wierszy)

_CHECK dopuszcza draft/approved/deprecated na lifecycle_state; ma też is_active/deprecated_at dedykowane do wycofywania. 6 wierszy E2E-20260806._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 54d6e8fa15364855b3aaeb6272fafada | name | Steering Decision Deck — E2E-20260806 | 2026-08-06 16:49:05.905194 |
| 5a30b9bef6794f9eb852a503bd16946b | name | Board Portfolio Update — E2E-20260806 | 2026-08-06 16:48:07.022116 |
| d13ce20ad7044f5582396523a1092685 | name | Initiative Kickoff Deck — E2E-20260806 | 2026-08-06 16:49:40.507823 |
| c036ba797c9f4cb782e044941d6e4e49 | name | Board Portfolio Update — E2E-20260806 | 2026-08-06 17:44:18.958587 |
| 4188d66da3b743ed96b11f63eedf45ae | name | Steering Decision Deck — E2E-20260806 | 2026-08-06 17:47:07.769686 |
| 3ef0da7511a14f00b8f718c7f3859f8a | name | Initiative Kickoff Deck — E2E-20260806 | 2026-08-06 17:47:34.523175 |

### tool_sessions — soft-delete (12 wierszy)

_Kolumna status bez CHECK (domena APPROVED/DRAFT/REVIEW, wielkie litery — konwencja zachowana). Sprawdzono: 0 wierszy w budgets/finance_budget_registration_receipts (NO ACTION) odwołuje się do tych 12 sesji — mimo to soft-delete, nie hard, żeby nie zależeć od tego sprawdzenia w przyszłości._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 50160f02-8622-4fa9-84d0-7f79ceba35e9 | name | MyWork idea: M05-E2E-CV-Init-04axfl | 2026-06-21 00:25:34.828 |
| 0ef884e2-dacd-4837-b6f1-587c69cab16f | name | MyWork idea: M05-E2E-CV-Tasks-zrhdop | 2026-06-21 00:25:40.038 |
| 065892b4-d619-4004-8d3b-c2749bb4b734 | name | MyWork idea: M05-E2E-CV-Dec-6zcys5 | 2026-06-21 00:25:44.959 |
| fa93f718-4968-4240-b30e-730907a4174c | name | MyWork notebook: M04 Autosave Probe 7731 | 2026-06-20 13:00:44.851 |
| cad32cbe-1c7f-4db9-b36b-b4b308162699 | name | MyWork notebook: M04 Autosave Probe 7731 | 2026-06-20 13:01:15.017 |
| d670319c-1e46-4a27-99eb-94b7e315cd4e | name | MyWork idea: M05-PROBE-DELETEME | 2026-06-20 16:34:01.06 |
| c94ced6e-0172-4c57-aa46-924589599547 | name | MyWork idea: M05-E2E-CV-Init-y3sbhb | 2026-06-20 19:59:34.621 |
| 7ed772b6-4865-405d-b487-c13670c4edd7 | name | MyWork idea: M05-E2E-CV-Tasks-qgfsoy | 2026-06-20 19:59:40.387 |
| 67c44048-c8cd-4c22-8944-98f0a561bc02 | name | MyWork idea: M05-E2E-CV-Dec-2jydvv | 2026-06-20 19:59:45.528 |
| 5da8694b-750c-4a25-87a1-df8f56c1bc80 | name | MyWork idea: M05-E2E-CV-Init-iog6dk | 2026-06-20 20:19:49.968 |
| 2b741f50-d507-4918-9937-3aea2fd9e223 | name | MyWork idea: M05-E2E-CV-Tasks-r7gsm9 | 2026-06-20 20:19:57.054 |
| fb908dd6-1833-4965-a48c-894021607a9d | name | MyWork idea: M05-E2E-CV-Dec-ewf3j8 | 2026-06-20 20:20:17.044 |

### tp_base_templates — soft-delete (3 wierszy)

_CHECK dopuszcza draft/approved/deprecated. 3 wiersze E2E-20260806._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 0482c64f-4acb-4cfe-9495-1eba4f67db94 | name | Initiative Budget — E2E-20260806 | 2026-08-06 16:49:10.357922+00 |
| 6456b397-16b4-4827-95b3-f7604f8c4c8f | name | Milestone Tracker — E2E-20260806 | 2026-08-06 16:50:02.108507+00 |
| 14ddf73e-7647-447d-a3db-3e57b0297eb1 | name | Benefits Realization — E2E-20260806 | 2026-08-06 16:50:42.386546+00 |

### v8_output_artifacts — hard-delete (43 wierszy)

_Brak kolumny status/archived/deleted_at (ma delivery_state/is_draft, ale to inne pola domenowe, nie soft-delete). Brak dzieci FK. 43 unikalne wiersze (TEST-RELIABILITY-*, TEST-RETEST-*, *-E2E-20260806); origin_summary_json to podzbiór title_snapshot — deduplikacja po artifact_id w SQL._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| 98b16480-08a5-4bd1-82b5-20807d785e3c | title_snapshot | Executive Progress &amp; Assumptions Brief — TERESA-E2E-20260806 | 2026-08-06T16:53:31.636Z |
| 7e6a5e8e-35c2-4235-b60b-b4f35c8f8032 | title_snapshot | TEST-RELIABILITY-sheet-1 | 2026-07-08T08:25:01.896Z |
| fdaeb389-8af0-4de0-81a6-a37f693913fe | title_snapshot | Milestone Tracker — E2E-20260806 | 2026-08-06T17:04:43.298Z |
| 68eac2ba-4c57-46f4-991c-322d1dfadc7a | title_snapshot | TEST-RELIABILITY-sheet-2 | 2026-07-08T08:25:33.564Z |
| 31ccce37-97fa-465d-964a-5719104f73d7 | title_snapshot | TEST-RELIABILITY-sheet-4 | 2026-07-08T08:26:50.011Z |
| 91b7f63a-ccd6-4520-b88c-639248475692 | title_snapshot | TEST-RELIABILITY-sheet-5 | 2026-07-08T08:27:28.512Z |
| 24cc22c1-42f7-433c-a14a-4f422da8bd13 | title_snapshot | Benefits Realization — E2E-20260806 | 2026-08-06T17:07:06.589Z |
| a8e4bab9-8ada-4385-8cb7-94cde643b43a | title_snapshot | TEST-RELIABILITY-deck-1 | 2026-07-08T08:27:55.297Z |
| b0421338-f05e-44e3-9303-9f0e61892a1c | title_snapshot | TEST-RELIABILITY-deck-2 | 2026-07-08T08:28:28.348Z |
| 78b80fe5-e4f3-47af-b629-9e121d5008d4 | title_snapshot | TEST-RELIABILITY-deck-3 | 2026-07-08T08:29:01.032Z |
| 8d12fc23-f8a4-4d7e-952d-a9f960fce6e3 | title_snapshot | TEST-RELIABILITY-deck-4 | 2026-07-08T08:29:33.735Z |
| e27795c2-072b-4769-a06a-e18384fde948 | title_snapshot | TEST-RELIABILITY-deck-5 | 2026-07-08T08:30:07.761Z |
| c28cda87-1a35-4e37-8a4b-e221dfde63d1 | title_snapshot | TEST-RELIABILITY-doc-3 | 2026-07-27T13:01:07.585Z |
| 15941957-0caa-4ab0-9558-07364bcfd714 | title_snapshot | TEST-RELIABILITY-doc-4 | 2026-07-27T13:01:07.608Z |
| ffc0f1a4-9cbe-4bc9-8cd9-67fae1ec38e9 | title_snapshot | TEST-RELIABILITY-doc-1 | 2026-07-27T13:01:07.642Z |
| b25b95ff-d5a2-4360-b4bd-44894c071a3d | title_snapshot | Initiative Budget — Teresa — E2E-1200000 | 2026-08-06T17:25:35.124Z |
| cf11a32e-052a-4ed2-b796-27f1b00b8be9 | title_snapshot | TEST-RELIABILITY-doc-2 | 2026-07-27T13:01:07.538Z |
| 0ba31a83-e1a4-43f6-8f31-f2285d092906 | title_snapshot | TEST-RELIABILITY-doc-5 | 2026-07-27T13:01:07.677Z |
| 107da3dc-a63d-452b-85cf-2646c90b973b | title_snapshot | TEST-RELIABILITY-insight-4 | 2026-07-27T13:01:07.739Z |
| cef77ad0-4b6f-4d57-883b-52ae1efdd6cb | title_snapshot | TEST-RELIABILITY-doc-smoke3 | 2026-07-27T13:01:07.513Z |
| d8d85ea3-2b4a-4f53-aeb9-a884b3538796 | title_snapshot | TEST-RELIABILITY-insight-2 | 2026-07-27T13:01:07.714Z |
| df46ab67-9a3d-421b-9af1-a1950e5bf88e | title_snapshot | TEST-RETEST-doc-2 | 2026-07-27T13:01:07.803Z |
| e736ea98-ef0c-4a11-8382-8a05f4ff5b75 | title_snapshot | TEST-RETEST-doc-1 | 2026-07-27T13:01:07.778Z |
| c645fde2-ea8f-404b-a80d-3a7a09334ff7 | title_snapshot | TEST-RETEST-insight-1 | 2026-07-27T13:01:07.841Z |
| 2a5227ef-83cf-453c-979a-d783a685b30a | title_snapshot | Raport statusu inicjatywy DBR77 — TEMPLATE-E2E-20260806 | 2026-08-06T16:49:01.012Z |
| 820d2a17-1eda-4017-83f1-c5f4f4ca0f07 | title_snapshot | Initiative Budget — E2E-20260806 | 2026-08-06T16:49:10.369Z |
| 2fe37380-9356-4737-a3a7-4131dd5dff2c | title_snapshot | Initiative Budget — Teresa — E2E-20260806 | 2026-08-06T17:46:19.681Z |
| 3832c2f6-9d00-43c1-a4ee-ef6700e297b2 | title_snapshot | Initiative Budget — E2E-20260806 | 2026-08-06T20:21:13.393Z |
| 638ff987-a9a3-468b-a0db-c879c3df4960 | title_snapshot | Budget Narrative Report — E2E-20260806 | 2026-08-06T16:49:10.576Z |
| d480ac62-3201-480c-addf-c8b359f96e87 | title_snapshot | Board Portfolio Update — E2E-20260806 | 2026-08-06T17:56:56.915Z |

_... +13 więcej (pełna lista w bazie, zapytanie w RAPORT.md)_


### wave5_artifacts — soft-delete (3 wierszy)

_Kolumna status bez CHECK. 3 wiersze TERESA-E2E-20260806/TEMPLATE-E2E-20260806._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| artifact-f2b7f53f-2c32-4266-aa60-bf9a5c8f66ea | title | Raport statusu inicjatywy DBR77 — TEMPLATE-E2E-20260806 | 2026-08-06 16:49:00.934482+00 |
| artifact-3bde96db-8b1b-45dc-b2af-42a404a7fb51 | title | Risk &amp; Actions Brief — TERESA-E2E-20260806 | 2026-08-06 16:52:11.038335+00 |
| artifact-2a489d59-ecc2-4ab9-872e-b1784aa286a2 | title | Executive Progress &amp; Assumptions Brief — TERESA-E2E-20260806 | 2026-08-06 16:53:31.54701+00 |

### work_canvas_drafts — hard-delete (1 wierszy)

_To szkic roboczy (draft), nie ma status/archived/deleted_at; ma dziecko FK work_canvas_versions z ON DELETE CASCADE. 1 wiersz "Regression Test DocumentWAVE1-TEST-CANVAS"._

| id | kolumna | tekst (skrót) | created_at |
| --- | --- | --- | --- |
| dba34533-0295-4466-bd5c-28a34bb25eb4 | title | Regression Test DocumentWAVE1-TEST-CANVAS | 2026-05-16T13:15:39.401Z |

### meetings — soft-delete (status='cancelled') (1 wiersz)

_Tytuł to ślad promptu AI ("Zaplanuj i wykonaj dla mnie inicjatywe..."), 0 uczestników, brak lokalizacji — dokładnie wzorzec ze zgłoszenia audytu._

| id | tytuł |
| --- | --- |
| meeting-cfd9f24a-9d7a-4313-a718-0f0502224841 | Zaplanuj i wykonaj dla mnie inicatywe której celem jest zrobienie planu… |

## C. Tłumaczenia PL (przed → po)


### meetings.title (9 spotkań demo)

| przed (EN) | po (PL) |
| --- | --- |
| Platform Migration — Kick-off | Migracja platformy — spotkanie inicjujące |
| AI Strategy Working Group — Weekly Sync | Grupa robocza ds. strategii AI — cotygodniowa synchronizacja |
| Steering Committee — Q2 Transformation Program | Komitet sterujący — program transformacji Q2 |
| Public Beta Launch — Go/No-Go Review | Start wersji beta — decyzja Go/No-Go |
| SOC 2 Readiness — External Auditor Briefing | Gotowość do SOC 2 — briefing z audytorem zewnętrznym |
| 1:1 with Anna — Backend Architecture Review | 1:1 z Anną — przegląd architektury backendu |
| Sprint 14 Planning — Product & Engineering | Planowanie Sprintu 14 — produkt i inżynieria |
| Client Demo — Acme Corp Digital Transformation | Demo dla klienta — transformacja cyfrowa Acme Corp |
| 1:1 with CTO — Weekly Catch-up | 1:1 z CTO — cotygodniowe spotkanie |

### tasks.title (42 unikalnych tytułów)

| przed (EN) | po (PL) |
| --- | --- |
| Security Audit Completion | Zakończenie audytu bezpieczeństwa |
| Refactor Authentication Module | Refaktoryzacja modułu uwierzytelniania |
| Review Q4 Budget Report | Przegląd raportu budżetowego za Q4 |
| Deploy v2.5 Release | Wdrożenie wersji v2.5 |
| Research AI Integration Options | Analiza opcji integracji AI |
| Cloud Infrastructure Planning | Planowanie infrastruktury chmurowej |
| Technology Stack Evaluation | Ocena stosu technologicznego |
| Fix Critical Production Bug | Naprawa krytycznego błędu produkcyjnego |
| Review Pull Requests | Przegląd pull requestów |
| Kick-off and scope alignment | Spotkanie inicjujące i ustalenie zakresu |
| Prepare pilot environment | Przygotowanie środowiska pilotażowego |
| Define target process and acceptance criteria | Zdefiniowanie procesu docelowego i kryteriów akceptacji |
| Submit Compliance Documentation | Złożenie dokumentacji zgodności |
| Annual Performance Reviews | Roczne oceny pracownicze |
| Team Standup Presentation | Prezentacja na standupie zespołu |
| Update Project Documentation | Aktualizacja dokumentacji projektu |
| Prepare Demo for Stakeholders | Przygotowanie demo dla interesariuszy |
| Architecture Review Session | Sesja przeglądu architektury |
| Interview: Digital Maturity Discovery | Wywiad: odkrywanie dojrzałości cyfrowej |
| Establish IoT Network Infrastructure | Budowa infrastruktury sieciowej IoT |
| Develop Machine Learning Model | Budowa modelu uczenia maszynowego |
| Conduct User Training Sessions | Przeprowadzenie szkoleń użytkowników |
| Monitor Performance and Refine Processes | Monitorowanie wydajności i doskonalenie procesów |
| Document Changeover Optimization Processes | Dokumentacja procesów optymalizacji przezbrojeń |
| Configure pilot environment and integrations | Konfiguracja środowiska pilotażowego i integracji |
| Kick-off workshop with key stakeholders | Warsztat inicjujący z kluczowymi interesariuszami |
| Prepare data model and ingestion plan | Przygotowanie modelu danych i planu wczytywania |
| DevOps — CI/CD pipeline hardening | DevOps — utwardzenie pipeline'u CI/CD |
| Quality Management 4.0 — SPC dashboard MVP | Zarządzanie jakością 4.0 — MVP pulpitu SPC |
| RPA pilot — invoice processing automation | Pilotaż RPA — automatyzacja przetwarzania faktur |
| Team capacity planning — Sprint 15 | Planowanie zasobów zespołu — Sprint 15 |
| Vendor shortlist for IoT platform (IRIS) | Krótka lista dostawców platformy IoT (IRIS) |
| Cloud migration — cost optimization review | Migracja do chmury — przegląd optymalizacji kosztów |
| Data migration dry-run — ERP staging | Próba migracji danych — środowisko testowe ERP |
| Security audit — OT/IT convergence review | Audyt bezpieczeństwa — przegląd konwergencji OT/IT |
| Prepare board presentation — digital maturity results | Przygotowanie prezentacji dla zarządu — wyniki dojrzałości cyfrowej |
| Finalize Q2 transformation roadmap | Finalizacja mapy drogowej transformacji Q2 |
| Interview: Quick Assessment | Wywiad: szybka ocena |
| Interview: DBR77 — Marketing & Promotion (Ideas) | Wywiad: DBR77 — marketing i promocja (pomysły) |
| Interview: DBR77 — How to Sell Better (Ideas) | Wywiad: DBR77 — jak sprzedawać lepiej (pomysły) |
| Q2 Strategy — Market expansion playbook | Strategia Q2 — plan ekspansji rynkowej |
| Meeting Notes | Notatki ze spotkania |

### initiatives.name (25 unikalnych nazw)

| przed (EN) | po (PL) |
| --- | --- |
| Digital Performance Management | Zarządzanie wydajnością cyfrową |
| Automated Changeover Optimization | Automatyzacja optymalizacji przezbrojeń |
| Data Analytics Platform | Platforma analityki danych |
| Cybersecurity Enhancement Program | Program wzmocnienia cyberbezpieczeństwa |
| IoT Sensor Network Deployment | Wdrożenie sieci czujników IoT |
| ERP System Modernization | Modernizacja systemu ERP |
| Quality Management System 4.0 | System zarządzania jakością 4.0 |
| DevOps Transformation | Transformacja DevOps |
| RPA Implementation | Wdrożenie RPA |
| Cloud Migration Phase 2 | Migracja do chmury — Faza 2 |
| AI Audit Deep Research V1 | Pogłębiony audyt AI — wersja 1 |
| Approval SLA and escalation governance | SLA zatwierdzania i zarządzanie eskalacją |
| KPI contract and metric ownership | Kontrakt KPI i odpowiedzialność za mierniki |
| Planning-to-execution handoff automation | Automatyzacja przekazania z planowania do realizacji |
| SMED pilot on Line 3 | Pilotaż SMED na Linii 3 |
| Decision rights redesign for exceptions | Przeprojektowanie uprawnień decyzyjnych dla wyjątków |
| Weekly priorities — Sprint 14 focus areas | Priorytety tygodnia — obszary skupienia Sprintu 14 |
| Q2 Strategy — Market expansion playbook | Strategia Q2 — plan ekspansji rynkowej |
| Meeting Notes | Notatki ze spotkania |
| Cybersecurity Enhancement Program (Fork) | Program wzmocnienia cyberbezpieczeństwa (kopia) |
| Industrial Intelligence Newsletter Value-First Pipeline | Newsletter Industrial Intelligence — lejek zorientowany na wartość |
| Offense: leverage strengths to capture opportunities | Ofensywa: wykorzystaj mocne strony, aby uchwycić szanse |
| Repair: eliminate weaknesses exposed to threats | Naprawa: wyeliminuj słabości odsłonięte przez zagrożenia |
| Conversion: fix weaknesses to unlock opportunities | Konwersja: usuń słabości, aby odblokować szanse |
| Defense: use strengths as a shield against threats | Obrona: wykorzystaj mocne strony jako tarczę przed zagrożeniami |

## D. Do decyzji właściciela (NIE ruszane automatycznie)

- initiatives.name = "New Idea" — podejrzenie domyślnego placeholdera aplikacji (sprawdzić i18n w kodzie, nie w danych).
- initiatives.name = "F1-26 from assessment", "F3 Rich Card Initiative", "P1" — niejednoznaczne kody wewnętrzne, znaczenie nieznane.
- tasks.title = "kosmos" (3 wiersze) i "Frame" (1 wiersz) — pojedyncze niejednoznaczne słowa, może testowe może nie.
- tasks.title zaczynające się od "[PRODUCTION] BUG:", "[STAGING] BUG:", "[STAGING] IDEA:", "[DEVELOPMENT] BUG:" — ŚWIADOMIE NIERUSZANE: to wyglądają na realne wewnętrzne zgłoszenia inżynierskie (np. "Inbox- nie wyswietlaja sie wiadomosci", "Kanban gubi karty po odswiezeniu"), nie na treść demo. Jeden z nich ("[STAGING] BUG: AAAA...A", ok. 110 znaków) wygląda na przypadkowe/testowe wciśnięcie klawisza — do potwierdzenia przez właściciela, czy to prawdziwe zgłoszenie czy śmieć.
- tasks.title zaczynające się od "AI/Industry:" (Safety CV, Digital Twin, Supply chain) — mieszany PL/EN żargon techniczny, zostawione bez zmian (niska pewność, że tłumaczenie poprawi czytelność).

## Podsumowanie

- Kandydaci do usunięcia/archiwizacji (plan skurowany): **290** wierszy w 16 tabelach + 1 spotkanie.
- Tłumaczenia: **9** spotkań, **42** unikalnych tytułów zadań, **25** unikalnych nazw inicjatyw.
- Pozycji do decyzji właściciela: **5**.
