# P9 — Karta działania jako jeden komponent + trzy brakujące ogniwa kręgosłupa

SSOT treści: `docs/ssot/KREGOSLUP_WARTOSCI.md` (32 zmierzone konwersje, elementy obiektów, zasada „jedna karta, jedna Skrzynka"). Ta paczka jest jej wykonaniem. Szablon: `00_SZABLON_PACZKI.md`.

## 1. Cel dla użytkownika
Kiedy coś idzie źle — wskaźnik poza limitem, zadanie po terminie, niezgodność w audycie, odchylenie finansowe — konsultant dostaje **jedną, zawsze tak samo wyglądającą kartę działania w swojej Skrzynce**, a z podsumowania spotkania i z karty inicjatywy da się wreszcie kliknąć „zrób z tego zadanie / przekaż do realizacji".

## 2. Zakres
**(a) Karta działania — komponent wspólny.** Powierzchnie: Wyniki (`results-vnext-teresa-kpi-deviation`, `results-vnext-attention`), Realizacja (`exe-002-004-ui-audit`, Kokpit), Audyty (`audit-criterion-workspace`), Finanse (`finance-baseline-workspace`) + Skrzynka Mojej Pracy (`mywork-inbox`). 5 ekranów + 1 wspólny komponent.
**(b) Trzy brakujące konwersje** (numery z `KREGOSLUP_WARTOSCI.md` §1): **K1 = #30** Spotkanie → zadanie · **K2 = #17/#18** Inicjatywa → przekazanie do Realizacji → sprawa → zadanie · **K3 = #32** klikalny rodowód (powrót do źródła). Razem 4 ekrany.
Moduły zamrożone w zakresie: `06_EXECUTION`, `07_MY_WORK_AGENT`, `08_MEETINGS`, `12_AUDITS`, `05_INITIATIVES` (`MVP_FINAL_ZAMROZONE.json`). Wyniki i Finanse niezamrożone.

## 3. Przyczyna źródłowa (zweryfikowane na HEAD m03 `888e8a52b9`)
- **Rozproszenie karty działania:** 8 osobnych komponentów (`src/components/AIChat/AIActionCard.tsx`, `src/components/AIChat/Actions/AIActionCard.tsx`, `src/components/Chat/ChatActionCard.tsx`, `src/components/Audit/method/workspace/RemediationPanel.tsx`, `src/components/MyWork/DefinitionRemediationQueue.tsx`, `src/components/MyWork/Executive/ActionRequiredStrip.tsx`, `src/components/MyWork/notebook/ActionItemsPanel.tsx`, `src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx`) — trzy ostatnie z listy bez ani jednego importera. Po stronie bazy 14 rodzin tabel o tej samej roli.
- **Skrzynka zna tylko trzy źródła:** `server/src/services/inboxService.ts:194` — `tasks` (przypisane), `decisions` (oczekujące), `notifications` (nieprzeczytane). Audyty nie piszą do żadnego z nich (`server/src/services/audits/*` — zero `notificationService`). Finanse omijają wspólną drogę: `server/src/services/v8/financeIntegrationHooks.ts:139` pisze wprost do `canonical_inbox_items`.
- **K1:** `server/src/services/meeting/meetingNoteTaskFunnelService.ts:44-46` zapisuje pełny rodowód (`source_type='meeting_note_action_item'`), endpoint `server/src/routes/meeting.routes.ts:1155` jest zamontowany — a `src/components/Meeting/MeetingObjectPage.tsx:754-766` renderuje punkty działania jako gołe `<li>{a.task}</li>`. Zero wołaczy w `src/`.
- **K2:** `execution_case` powstaje wyłącznie w `server/src/domain/initiatives-execution/handoffAcceptance.ts:247`; `src/components/Execution/ExecutionHub.tsx:5993` mówi wprost „created only by accepted Handoff; never manually". Wołacze istnieją (`src/services/initiatives-execution/runtimeApi.ts:143/160/173`), ale `src/components/MyWork/HandoffAcceptanceQueue.tsx` i `ScheduleDecisionQueue.tsx` nie są nigdzie importowane, a test `src/components/MyWork/__tests__/MyWorkHub.decisionsOwnerFeedback.test.ts:19` wymusza ich nieobecność.
- **K3:** `src/components/Initiatives/InitiativeSourceLink.tsx:60` (jedyny komponent z realną nawigacją wstecz) nie jest renderowany nigdzie; 9 plików importuje z niego wyłącznie `getSourceDisplayLabel`, czyli pokazuje napis o źródle bez możliwości przejścia.

## 4. Projekt rozwiązania
**Jeden wzorzec, jedno miejsce.** Karta działania żyje w `src/components/standard/ActionCard.tsx` (+ `ActionCard.types.ts`, `ActionCardList.tsx`) i rejestruje się jako **ósma karta N** w `src/components/standard/registry.ts` (klucz `action`), spójnie z `DEC-2026-09-03-381`. Pola dokładnie z `KREGOSLUP_WARTOSCI.md` §2.4 (arkusz właściciela): okres · cel osiągnięty? · działania wymagane? · opis problemu · główna przyczyna · opis działania · odpowiedzialność (osoba, nie ID) · termin · komentarz · status OTWARTY/ZAMKNIĘTY.

**Serwer.** Jedna tabela `action_cards` (migracja **addytywna**, `server/migrations/20261105_action_cards_spine.sql`): `id`, `organization_id`, `source_kind` (`kpi_deviation|execution_delay|audit_finding|finance_variance|meeting_action`), `source_id`, `period_start/end`, `goal_met` (bool), `action_required` (bool), `problem`, `root_cause`, `action_text`, `owner_user_id`, `due_date`, `comment`, `status`, `created_*`, `updated_*`. Zero DROP, zero ALTER istniejących kolumn. Istniejące tabele (`rvn_kpi_corrective_actions`, `audit_corrective_actions`, …) zostają; nowy serwis `server/src/services/actionCard/actionCardService.ts` czyta je przez adaptery i pisze do `action_cards`. Jeden router `server/src/routes/actionCards.routes.ts` (`GET /`, `POST /`, `PATCH /:id`, `POST /:id/close`), zamontowany w `server/src/Gateway.ts` pod `/api/action-cards`, **bez flagi**.

**Skrzynka jako jedyny odbiornik.** Każde utworzenie karty działania woła `notificationService.send({ entityType: 'action_card', entityId })` — jedna droga, przez serwis, nigdy surowym `INSERT`. `inboxService.materializeInboxItems` zyskuje czwarte źródło: otwarte `action_cards`, gdzie `owner_user_id = użytkownik`. Zapisy wprost do `canonical_inbox_items` z `financeIntegrationHooks.ts:139` i `inboxEnterpriseService.ts:104` przechodzą na `notificationService`.

**K1.** Przy każdym punkcie działania w `MeetingObjectPage.tsx` przycisk „Zrób zadanie" → istniejący `POST /api/meeting/:id/notes/:noteId/action-items/:index/task`. Zero zmian na serwerze.
**K2.** W karcie inicjatywy (Menu 1, kebab) akcja „Przekaż do realizacji" → `requestHandoffAcceptance`; w Skrzynce sekcja „Do akceptacji" renderująca `HandoffAcceptanceQueue` → `decideHandoffAcceptance`; test `MyWorkHub.decisionsOwnerFeedback.test.ts:19` aktualizowany (kolejka wraca jako sekcja Skrzynki, nie osobny pill).
**K3.** Wszystkie 9 miejsc używających `getSourceDisplayLabel` przechodzi na renderowanie `<InitiativeSourceLink>`; brakujące cele nawigacji dopisane w samym komponencie.

**Zakazy kanonu:** listy wyłącznie `StandardTable`/`StandardModuleBar`/`StandardPreview`, karta w powłoce `ArtifactRightPanel`, tokeny `c-*`, **zero `primary-*`** (crimson tylko dla statusu krytycznego karty), kebab pionowy, i18n `pl`+`en` dla każdego nowego napisu.

## 5. Kroki wykonania
| # | Krok | Pliki | Rozmiar | Zamrożenie |
| :-: | --- | --- | :-: | --- |
| 0 | Potwierdź liczby §3 własnym `rg` na swoim HEAD (8 komponentów, 14 tabel, 3 bez importera) | — | S | — |
| 1 | Migracja `20261105_action_cards_spine.sql` + `actionCardService.ts` + `actionCards.routes.ts` + montaż w `Gateway.ts` | `server/` | M | — |
| 2 | Adaptery odczytu z `rvn_kpi_corrective_actions`, `audit_corrective_actions`, `delay_signals`, `meeting_follow_ups` | `server/src/services/actionCard/adapters/` | M | — |
| 3 | Czwarte źródło Skrzynki + sprowadzenie Finansów i konektorów na `notificationService` | `server/src/services/inboxService.ts`, `v8/financeIntegrationHooks.ts`, `inboxEnterpriseService.ts` | M | `[ODMROZENIE 07_MY_WORK_AGENT DEC-397]` |
| 4 | `src/components/standard/ActionCard*.tsx` + wpis `action` w `registry.ts` + ekran harnessu `dev-render/screens/karta-dzialania.tsx` | `src/components/standard/` | L | — |
| 5 | Podmiana 5 powierzchni na `ActionCard`: Wyniki, Realizacja, Audyty, Finanse, Skrzynka; usunięcie 3 komponentów bez importera | `src/components/{ResultsVNext,Execution,Audit,Finance,MyWork}` | L | `[ODMROZENIE 06_EXECUTION DEC-397]`, `[ODMROZENIE 12_AUDITS DEC-397]`, `[ODMROZENIE 07_MY_WORK_AGENT DEC-397]` |
| 6 | K1 — przycisk „Zrób zadanie" przy punkcie działania spotkania | `src/components/Meeting/MeetingObjectPage.tsx` | S | `[ODMROZENIE 08_MEETINGS DEC-397]` |
| 7 | K2 — „Przekaż do realizacji" w karcie inicjatywy + sekcja „Do akceptacji" w Skrzynce | `src/components/Initiatives/`, `src/components/MyWork/` | L | `[ODMROZENIE 05_INITIATIVES DEC-397]`, `[ODMROZENIE 07_MY_WORK_AGENT DEC-397]` |
| 8 | K3 — 9 miejsc renderuje `InitiativeSourceLink` zamiast samej etykiety | `src/components/{MyWork,ReportBuilder,Discovery,Initiatives}` | M | `[ODMROZENIE 05_INITIATIVES DEC-397]` |
| 9 | i18n `pl`+`en` dla wszystkich nowych napisów; zero surowych ID w UI (osoba = nazwisko) | `public/locales/{pl,en}/translation.json` | S | — |

Kolejność wymuszona: 1→2→3, 4→5; 6, 8 równolegle od startu; 7 po 3.

## 6. Testy
**Jednostkowe (asercja → mutacja, która MUSI je zabić):**
| # | Test | Asercja | Mutacja |
| :-: | --- | --- | --- |
| T1 | `actionCard.pola.test.tsx` | karta renderuje **wszystkie 10** pól z §2.4, w kolejności arkusza | usunięcie „główna przyczyna" → czerwony |
| T2 | `actionCard.jedenKomponent.test.ts` | `rg` po `src/` nie znajduje innego komponentu o roli karty działania niż `standard/ActionCard` | przywrócenie `KpiDeviationCaseSubview` jako własnej karty → czerwony |
| T3 | `actionCard.tokeny.test.tsx` | markup nie zawiera `primary-`; czerwień tylko przy `status='OPEN' && severity='RED'` | `bg-primary-500` w nagłówku → czerwony |
| T4 | `inbox.czwarteZrodlo.pg.test.ts` (RUN_DB_TESTS=1) | **para**: (a) otwarta `action_card` właściciela **jest** w Skrzynce; (b) karta **innego** użytkownika **nie jest** | wygaszenie filtra `owner_user_id` → czerwony na (b); wygaszenie źródła → czerwony na (a) |
| T5 | `financeInbox.jednaDroga.test.ts` | zero `INSERT INTO canonical_inbox_items` poza `inboxService.ts` | przywrócenie zapisu w `financeIntegrationHooks.ts` → czerwony |
| T6 | `meetingActionItem.przycisk.test.tsx` | przy każdym punkcie działania jest przycisk wołający `.../action-items/:i/task`; drugi klik nie tworzy drugiego zadania (idempotencja) | zamiana przycisku na `<li>` → czerwony |
| T7 | `initiativeHandoff.przycisk.test.tsx` | akcja „Przekaż do realizacji" w kebabie karty inicjatywy; sekcja „Do akceptacji" w Skrzynce renderuje `HandoffAcceptanceQueue` | usunięcie sekcji → czerwony |
| T8 | `sourceLink.renderowany.test.tsx` | 9 miejsc renderuje element `<a>`/`role="link"`, nie sam napis | powrót do `getSourceDisplayLabel` bez linku → czerwony |
| T9 | `actionCards.migracja.pg.test.ts` | migracja przechodzi na **pustej** bazie i na bazie z danymi; zero DROP/ALTER istniejących kolumn | dodanie `ALTER TABLE … DROP COLUMN` → czerwony |

**Wizualne** (`scripts/dev/odbior-zywo/zrzut.mjs`, katalog `evidence/p9-kregoslup/`): `01-wyniki-karta-dzialania-1440-jasny.png`, `02-audyt-karta-dzialania-1440-jasny.png`, `03-realizacja-karta-dzialania-1440-jasny.png`, `04-skrzynka-z-kartami-1280-jasny.png`, `05-skrzynka-1280-ciemny.png`, `06-spotkanie-punkty-dzialania-1440-jasny.png`, `07-inicjatywa-przekaz-do-realizacji-1440-jasny.png`. Wszystkie trzy pierwsze muszą być **wizualnie identyczne** poza treścią — to dowód, że jest jeden komponent.

**Przepływ klikany** (Playwright, `tests/e2e/p9-odchylenie-do-karty.spec.ts`): zaloguj → Wyniki → raport KPI → wpisz rezultat poza limitem → **Skrzynka pokazuje nowy wpis** → otwórz wpis → karta działania z wypełnionym okresem i opisem problemu → uzupełnij przyczynę, właściciela i termin → zapisz → status OTWARTY widoczny na wierszu raportu → zamknij → znika ze Skrzynki. Drugi przepływ: spotkanie → punkt działania → „Zrób zadanie" → zadanie widoczne w Skrzynce wykonawcy z linkiem wstecz do spotkania.

## 7. Kryterium odbioru właściciela
Na 3000: „wpisuję zły wynik wskaźnika i w Skrzynce od razu mam kartę działania z moim nazwiskiem i terminem — a ta sama karta wygląda identycznie w Audytach i w Realizacji".

## 8. Ryzyka i cofanie
- **Ryzyko 1: podwójna Skrzynka.** Sprowadzenie Finansów na `notificationService` może chwilowo ukryć istniejące wpisy `section='finance'`. Zabezpieczenie: krok 3 najpierw dopisuje nową drogę, dopiero po zielonym T5 usuwa starą.
- **Ryzyko 2: migracja przyrostowa.** `action_cards` nie czyta żadnej kolumny dodawanej później alfabetycznie — T9 sprawdza to na bazie od zera.
- **Ryzyko 3: odmrożenia.** Pięć zamrożonych modułów; commit bez markera zostanie odrzucony przez `scripts/mvp-final/check-freeze.sh` — to jest zamierzone, nie obchodzić.
- **Cofanie:** tag `demo-safe-<data>` przed startem; `git revert` per krok; migracja addytywna nie wymaga rollbacku.

## 9. Nakład
Opus: kroki 1–3 (1,5 d), krok 4 (1 d), krok 7 (1,5 d) = **4 d**. Sonnet: kroki 5, 6, 8, 9 (2,5 d). Ścieżka krytyczna 4,5 d. Zrównoleglić: 6 i 8 od pierwszego dnia w osobnym worktree.

## 10. Cel osiągnięty = samokontrola Codexa
| Komenda | Oczekiwany wynik |
| --- | --- |
| `npx esbuild <każdy zmieniony plik src/> --bundle --platform=browser --outdir=/tmp/esb --log-level=error --loader:.png=file --loader:.svg=file` | exit 0 na **każdym** pliku; `Transform failed` = błąd komendy, nie zielony wynik |
| `npx vitest run src/components/standard/__tests__ src/components/Meeting/__tests__ src/components/MyWork/__tests__ tests/unit/action-cards` | PASS, T1–T8 z dowodem mutacyjnym opisanym w §6 |
| `cd server && RUN_DB_TESTS=1 npx vitest run src/services/__tests__/inbox.czwarteZrodlo.pg.test.ts src/services/__tests__/actionCards.migracja.pg.test.ts` | PASS; **bez `RUN_DB_TESTS=1` te testy nie liczą się jako wynik** |
| `cd server && npx tsc --build tsconfig.build.json` | exit 0 |
| `bash scripts/check-list-canon.sh && bash scripts/check-artefakt.sh` | `OK`, dług nie rośnie |
| `rg -n -e ChatActionCard -e DefinitionRemediationQueue -e ActionItemsPanel src -g '!**/__tests__/**'` | 0 trafień (trzy komponenty bez importera usunięte) |
| `rg -n "INSERT INTO canonical_inbox_items" server/src -g '!**/__tests__/**' -g '!**/inboxService.ts'` | 0 trafień |
| `rg -n "getSourceDisplayLabel" src -g '!**/__tests__/**' -g '!**/InitiativeSourceLink.tsx'` | 0 trafień bez otaczającego `<InitiativeSourceLink` |

**Pomiar na żywo** (własny vite na wolnym porcie, `cp /private/tmp/m03/.env.local .`, host 127.0.0.1, sesja `ODBIOR_AUTH_STATE`): `node scripts/dev/odbior-zywo/zrzut.mjs --url=<ekran> --port=<port> --host=127.0.0.1 --dom="[data-action-card]" --szerokosc=1440 --motyw=jasny`. Progi z `.json` każdego zrzutu: `bledyKonsoli` = **0** · `dom.aside.count` ≤ **1** · `przepelnieniaPoziome` = **0** · zero odpowiedzi ≥ 400 · zero surowych identyfikatorów w polu „odpowiedzialność" (nazwisko, nie UUID) · brak danych renderowany jako „—", nigdy „0". Porównanie z obrazem odniesienia: zrzuty `01`, `02`, `03` muszą mieć **identyczny układ** (ta sama liczba i kolejność pól); różnica układu = niespełniony próg. Ciemny motyw: `05` musi różnić się od `04` średnią jasnością (nie ta sama fotka pod dwiema nazwami).

**Przepływ Playwright** `tests/e2e/p9-odchylenie-do-karty.spec.ts` (§6) — zielony, z artefaktem wideo w `evidence/p9-kregoslup/`.

**STOP:** wszystkie progi spełnione → commit per krok + raport z liczbami i ścieżkami. Próg niespełnialny bez decyzji właściciela → zatrzymać się i opisać, **nie obchodzić**. **Zakazy:** `--no-verify`, `git stash`, tworzenie flag chowających pracę, nowe komponenty tabel (tylko `StandardTable`), edycja plików modułów zamrożonych bez markera `[ODMROZENIE <MODUL> DEC-397]`, pytania do właściciela.

## 11. Wklejka dla Codexa

```
ZADANIE P9 — Karta działania jako jeden komponent + trzy brakujące ogniwa kręgosłupa. Praca do celu.

Katalog: świeży worktree z origin/staging (git worktree add -b codex/p9-kregoslup <dir> origin/staging). Commit per krok, bez push, autor Piotr <piotr.wisniewski@dbr77.com>.
Specyfikacja: docs/program/PROGRAM_NAPRAWCZY_20260905/P9_KREGOSLUP_I_KARTA_DZIALANIA.md — przeczytaj CAŁĄ. Kontekst produktowy: docs/ssot/KREGOSLUP_WARTOSCI.md (szczególnie §2.4 pola karty i §3 zasada).

CEL: każde „coś jest źle → ktoś ma działać" kończy się TĄ SAMĄ kartą działania w Skrzynce właściciela. Dziś jest 8 osobnych komponentów (3 bez importera) i 14 rodzin tabel, a Skrzynka zna tylko tasks/decisions/notifications (inboxService.ts:194) — Audyty nie piszą do niej wcale, Finanse omijają wspólną drogę (financeIntegrationHooks.ts:139).

CO ROBISZ (§4): (1) src/components/standard/ActionCard.tsx + ActionCard.types.ts + ActionCardList.tsx, pola DOKŁADNIE z §2.4 KREGOSLUP_WARTOSCI (okres · cel osiągnięty? · działania wymagane? · opis problemu · główna przyczyna · opis działania · odpowiedzialność · termin · komentarz · status), wpis `action` w src/components/standard/registry.ts jako ósma karta N; (2) serwer: migracja ADDYTYWNA server/migrations/20261105_action_cards_spine.sql (tabela action_cards z source_kind/source_id), actionCardService.ts + adaptery odczytu istniejących tabel, router /api/action-cards zamontowany w Gateway.ts BEZ FLAGI; (3) inboxService.materializeInboxItems dostaje czwarte źródło (otwarte action_cards właściciela), a Finanse i konektory przechodzą na notificationService — zero INSERT INTO canonical_inbox_items poza inboxService.ts; (4) podmiana 5 powierzchni (Wyniki, Realizacja, Audyty, Finanse, Skrzynka) na wspólny ActionCard i usunięcie ChatActionCard/DefinitionRemediationQueue/ActionItemsPanel; (5) K1: przycisk „Zrób zadanie" przy punkcie działania w src/components/Meeting/MeetingObjectPage.tsx:754 (backend gotowy: POST /api/meeting/:id/notes/:noteId/action-items/:index/task); (6) K2: „Przekaż do realizacji" w kebabie karty inicjatywy → requestHandoffAcceptance + sekcja „Do akceptacji" w Skrzynce renderująca HandoffAcceptanceQueue → decideHandoffAcceptance (wołacze już są w src/services/initiatives-execution/runtimeApi.ts:143/160/173); (7) K3: 9 miejsc importujących getSourceDisplayLabel renderuje <InitiativeSourceLink>, nie sam napis; (8) i18n pl+en dla każdego nowego napisu, zero surowych UUID w UI.

KANON (twardo): listy tylko StandardTable/StandardModuleBar/StandardPreview, powłoka artefaktu ArtifactRightPanel, tokeny c-*, ZERO primary-* (crimson wyłącznie dla statusu krytycznego karty), kebab pionowy.

KROKI: §5, kolejność 1→2→3, 4→5, 7 po 3; kroki 6 i 8 równolegle od startu. Krok 0: potwierdź liczby z §3 własnym rg na swoim HEAD (8 komponentów, 14 tabel, 3 bez importera) — nie ufaj moim liczbom, zmierz sam i zamelduj rozbieżność.

MODUŁY ZAMROŻONE: 06_EXECUTION, 07_MY_WORK_AGENT, 08_MEETINGS, 12_AUDITS, 05_INITIATIVES — każdy commit ich dotykający MUSI mieć w opisie [ODMROZENIE <MODUL> DEC-397]. Bez markera hook odrzuci commit; to zamierzone, nie obchodź.

CEL OSIĄGNIĘTY = §10: esbuild czysty na każdym zmienionym pliku (Transform failed = błąd, nie zielone), vitest T1–T8 z dowodem mutacyjnym, testy bazodanowe URUCHOMIONE z RUN_DB_TESTS=1 (bez tego nie liczą się jako wynik), tsc serwera exit 0, check-list-canon.sh i check-artefakt.sh OK, trzy grepy kontrolne z §10 dające 0 trafień, zrzuty w evidence/p9-kregoslup/ z bledyKonsoli=0, aside≤1, przepelnieniaPoziome=0, zero odpowiedzi ≥400, nazwisko zamiast UUID w polu odpowiedzialność, zrzuty 01/02/03 o IDENTYCZNYM układzie (dowód jednego komponentu), zrzut ciemny 05 różny od jasnego 04 średnią jasnością, oraz zielony przepływ Playwright „odchylenie → Skrzynka → karta" i „spotkanie → zadanie". Raport z liczbami, ścieżkami zrzutów i SHA.

STOP: próg niespełnialny bez decyzji właściciela → zatrzymaj się i opisz. ZAKAZY: --no-verify, git stash, tworzenie flag chowających pracę, nowe komponenty tabel, commit w module zamrożonym bez markera, pytania do właściciela.
```
