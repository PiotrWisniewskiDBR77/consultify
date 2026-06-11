# KONTEKST — snapshot pamięci projektowej (2026-06-11)

Pamięć lokalna Claude'a nie przenosi się przez git. Ten plik to jej esencja dla pracy w Audycie Harvard. Na nowym komputerze Claude powinien zapisać te fakty do swojej pamięci przy starcie.

## 1. Kim jest użytkownik i jak pracujemy
- **Piotr — CTO/właściciel Consultify (DBR77)**, nietechniczny w sensie operacyjnym: Claude prowadzi decyzje techniczne i wykonuje pracę end-to-end; Piotr decyduje produktowo. Preferuje UX klasy Miro/Apple.
- **Reguła właścicielska „verify before claiming":** każda zmiana UI → otworzyć w preview/przeglądarce, sprawdzić wizualnie i logicznie, dowód screenshotem. NIGDY nie raportować „done" na podstawie tsc/eslint.
- Gap-reporty i szybkie skany agentów przeszacowują braki (~1 na 7 prawdziwy) — weryfikować w kodzie runtime przed budowaniem.
- Język pracy: polski (kod/commity po angielsku).

## 2. Stan repo i środowisk (krytyczne!)
- **Branch roboczy:** `feat/deliverables-light` (kontynuacja `feat/ee-deliverables-unification`). Główny branch PR-ów: `Londyn`. `develop` = chroniony (PR + „PR Gate"), auto-deploy staging z push-to-develop.
- **PROD Railway = kod z 2026-05-18** — promocja ~1 miesiąca pracy (Londyn) PLANOWANA, nie wykonana; bez backupu. KAŻDY finding „działa w kodzie" wymaga dopisku czy istnieje na prodzie.
- **Staging:** znany schema-drift (braki kolumn/tabel → żywe 500-tki Postgresa) + `/api/v8` routery 404 przy `ENABLE_V8_GLOBAL` off — raporty `docs/qa/runs/2026-06-08/`.
- **Migracje:** runner manualny (`npm run db:migrate`) + `tablePlatform/migrationRunner` oznacza migrację jako wykonaną NAWET przy błędzie → weryfikować schemat (`information_schema`), nie tabelę migracji.
- **Dev backend bywa wpięty w PROD DB przez DATABASE_URL** — przed zapisami sprawdzić cel!
- **Dockerfile.api gubi zależności** (wzorzec rrule-crash) — przy nowych paczkach serwera stosować explicit-install.
- **SQLite-izmy padają na PG:** `datetime('now', ...)` z konkatenacją nie jest tłumaczone przez adapter (`PostgresDatabase.ts` pokrywa tylko literały) — realny crash w realtimePlatformService:141,511.
- Głos AI = Gemini Live; wymaga `GEMINI_LIVE_API_KEY` + `TERESA_VOICE_*`; weryfikacja `/api/public/anna/voice-config`.

## 3. NAPRAWIONE — nie zgłaszać ponownie (stan na 2026-06-11)
Document Studio persistencja (DAO write-through); Meeting zamontowany i realny; Rollout na trwałych danych; zaproszenia org = produkcyjny route; GDPR-delete z weryfikacją hasła (bcrypt); Calendar Sync realny connect/disconnect; Partner: auth payoutów (getActivePartnerOrgIdForUser) + uczciwe empty-states; superadmin→/superadmin redirect (P0 ról); mock karty płatniczej usunięty (self-serve za kill-switchem OFF); bramka kontaktowa Prezentacji usunięta; ROI `/roi` realny (nie „Under Construction"); interview RBAC admin (per-permission fallback); InsightViewer guard na częściowe material_quality_json; applyProposal Tabel realny (nie no-op).

## 4. Otwarte programy powiązane (żeby nie dublować pracy)
- **Deliverables-light (TRIADA deck/doc/sheet)** — DONE i zweryfikowane live 2026-06-10; następne: afordancje na encjach + L4 retire-list.
- **Canvas program** — fale 1–3 wykonane 2026-06-10 (C8 security, wersje, public share, retrieval za flagą, registry, provenance-pętla); zostało C1–C3/C5/B3/B4/D2–D3 + smoke wizualny.
- **Ideas overhaul** — 5 kart z planami (M05–M09); wspólne P0: model per-user (`my_idea_maps` unique user+idea) blokuje współpracę; konflikt 409 kłamie (silent overwrite); wielu writerów wersji.
- **VTS wave 2** — pełna diagnoza AI na prodzie (~131 osób, szablony 2-blokowe PL/EN); pilotowe blokady ról VTS w Inicjatywach/Wdrożeniu.
- **Feedback backlog** — 100 zgłoszeń w prod feedback_items; P0 = 4 bugi czatu Elkomtech (język EN, nowa konwersacja, brak odpowiedzi); plan 5 fal w `docs/qa/runs/2026-06-10/`.
- **Beta gating** — SSOT `betaAccess.ts`; 8 modułów closed; `BETA_ADMINS_EXEMPT=false`; blokada TYLKO nawigacyjna (URL omija) — decyzja route-guard otwarta.
- **Promocja staging→prod** — oficjalny workflow railway-deploy.yml; squash-merge przez PR (develop chroniony, linear history).

## 5. Wątki systemowe z Mapy V2 (naprawiać RAZ, nie per moduł)
1. Beta-lock tylko nawigacyjny (M05–M09, M12, M15–M21).
2. `ENABLE_V8_GLOBAL` = SPOF dla Outputs/Prezentacji/Tabel/AI-OS-Artifacts/inbox-canonical — przy OFF moduły wyglądają na puste bez komunikatu.
3. Rozjazd flag BE: komentarz/zod „OFF" vs runtime `!== 'false'` = ON (min. 4 flagi Tabel).
4. Masowy martwy kod (My Work ~25 komponentów, BenefitsHub, Economics/*, Admin/*, layout/*Sidebar).
5. Dane localStorage udające serwerowe (Organizacja Goals/Challenges/Strategy, rename tabel Ideas).
6. Public-production lock: consultify.ai pokazuje tylko 6 modułów core.

## 6. Konwencje
- Tabele list: TABLE_AND_PREVIEW_CANON §27 (A–S) = checklista zgodności.
- Karty insight/inicjatywa: CARD_CONTENT_FORMULA (walidatory w docs/qa/runs/2026-06-10/ dla VTS).
- Terminologia: **Canvas** = split-view czatu; **Ideas** = narzędzia My Work (Mind Map, Process Flow, Table, Whiteboard).
- Commity: konwencja `feat(scope)/fix(scope)`, Co-Authored-By Claude.
