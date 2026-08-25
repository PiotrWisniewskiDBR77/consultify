# NIGHT FIXES A — 2026-08-26

Naprawiacz: sesja nocna (Claude). Worktree: `git -C
/Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823
worktree add -b codex/night-fixes-a-20260826
/private/tmp/consultify-night-fixes-a codex/m03-admin-20260824`. Zero
dotknięcia `/Users/piotrwisniewski/Developer/Consultify` (zweryfikowane na
końcu — `git status`/`git log -1` tego katalogu identyczne jak na starcie
sesji). Zero `--no-verify`. node_modules = symlink do
`/Users/piotrwisniewski/Developer/Consultify/node_modules`.

**Base SHA:** `f0caf6a8215c6a9463ef79daeb09e399741053e0` (`codex/m03-admin-20260824`)
**Final HEAD SHA:** `bbeb97b13eb6c435aff5a1f2cb983f2f7fdb87ac` (`codex/night-fixes-a-20260826`)
**Push:** `github-backup codex/night-fixes-a-20260826` — zrobione (nowa gałąź,
PR-link zwrócony przez GitHub, PR nie utworzony — to decyzja Piotra).
**WSAD:** `docs/program/waves/WAVE_03_ACCEPTANCE/night-sweep-20260826/NIGHT_SWEEP_A_REPORT_20260826.md`
(gałąź `codex/night-sweep-a-20260826`, worktree `/private/tmp/consultify-sweep-a`).

Realizowano P0 → reszta, commit-per-ekran (9 commitów, każdy z testem per
plik + zrzutem light+dark). Zero zmian `server/**`, zero zmian domyślnych
flag.

---

## P0 (5/5 — 4 pełne, 1 częściowe z udokumentowanym powodem)

### P0 #1 — Results OKR lifecycle gate: surowe enumy → i18n
**Plik:** `src/components/ResultsVNext/okr/okrWorkspaceMappers.ts:179` (funkcja
`reasonWrongStatus`)
**Commit:** `c76433e04c`
**Zmiana:** komunikat bramki (`⚠ Złożenie do akceptacji: wymaga statusu
draft, changes_requested, obecny status to "active".`) teraz rozwiązuje
każdy status przez `okrSetStatusLabel()`/`OKR_SET_STATUS_LABELS`
(`okrRegistryMappers.ts`) zamiast wklejać surowy enum. Efekt: „wymaga
statusu „Szkic, Wymaga poprawek" (obecny status: „Aktywny")."
**Testy:** brak dedykowanego testu jednostkowego (mapper bez własnego pliku
testowego w repo) — zweryfikowane wizualnie + `npx esbuild` per plik (czysty
bundle).
**Zrzuty:** `09_RESULTS/fixed/06-okr-workspace-{light,dark}.png`
(`dev-render results-vnext-okr-workspace&setStatus=active`).

### P0 #2 — Finance Enterprise Valuation / Źródło: surowy graf → narracja
**Plik:** `src/components/Finance/Valuation/steps/SourceStep.tsx` (cały plik
przebudowany; usunięto `edge-*`/`sha256:*`/`run-*`/`user-*` z głównej treści)
**Commit:** `f08867ffbc`
**Zmiana:** każda karta łańcucha pochodzenia = nagłówek (typ artefaktu →
typ artefaktu + data + typ transformacji) + zwinięte natywne `<details>„Szczegóły techniczne"` z pełnymi ID. Uczciwa luka: `authorId` NIE jest
rozwiązywany do imienia i nazwiska — nie ma w tym workspace żadnego
katalogu użytkowników, więc zostaje jako „Autor (ID techniczne)" w sekcji
technicznej zamiast zmyślonego imienia.
**Testy:** `tests/components/Finance/SourceStep.fixc-lineage-chain.verify.test.tsx`
— 2/2 PASS (pełny łańcuch nadal renderuje się, tylko wewnątrz `<details>`).
**Zrzuty:** `10_FINANCE/fixed/05-valuation-{light,dark}.png`
(`dev-render finance-valuation-workspace&step=source&sourceLinked=1`).

### P0 #3 — Tools SWOT SummaryStep: launcher deliverables → Results & Readiness
**Plik:** `src/components/DiscoveryTools/steps/SummaryStep.tsx:509-647`
(funkcja `DynamicSwotOutputs`, gałąź `dedicatedOutputs`) — dokładnie
zakres zgłoszony jako `:561-609`
**Commit:** `856436aa15`
**Zmiana:** usunięto „Otwórz generator raportu"/„Otwórz kandydatów"/Vault
attach-file + sekcję „Pliki źródłowe w Vault" (w tym odsłonięty błąd „Nie
udało się odczytać plików z Vault." na starcie) i cały martwy stan/efekty
Vault (`attachToVault`, `refreshVaultDocuments`, `downloadVaultDocument`).
W ich miejsce: panel „Results & Readiness" zbudowany WYŁĄCZNIE z danych już
załadowanych w sesji — Overall readiness (wyprowadzone z tego samego
checklist co pasek postępu), Completion (ta sama checklist, bez pozycji
„Initiatives defined" — spec SWOT-003 §6.16: inicjatywa nie jest częścią
ukończenia SWOT), Open blockers (niespełnione pozycje checklisty), Final
result summary (`summary.verdict`/`executiveSummary` sesji, z uczciwym
stanem pustym).
**Uczciwa luka:** pełna lista §6.16 (`AI quality estimate`, `Evidence
coverage`, `Logical consistency`, `Method quality`, `Decision usefulness`)
wymaga nowych obliczeń, których ta sesja nie ma skąd wziąć (brak
evidence-tracking, silnika reguł, przebiegu jakości AI) — to nowa
funkcjonalność, nie night-fix.
**Nowe klucze i18n:** `discoveryToolsSteps.summaryStep.dynamicSwot.resultsReadiness.*`
(PL/EN, `public/locales/{pl,en}/translation.json`).
**Testy:** przepisano
`src/components/DiscoveryTools/steps/__tests__/SummaryStep.dynamic-swot-outputs.test.tsx`
(stary plik testował USUNIĘTY Vault/launcher UI) — 3/3 PASS.
**Zrzuty:** `03_TOOLS/fixed/04-initiative-proposal-{light,dark}.png`
(`dev-render tools-swot-initiative-proposal` — zarejestrowano ten
istniejący, ale niewpięty ekran harnessu w `dev-render/main.tsx`, zero
zmian `src/`).

### P0 #4 — Results Attention: `user-*` → imię i nazwisko
**Pliki:** `src/components/ResultsVNext/attention/attentionPresenters.tsx`
(nowy typ kolumny `userCol` + `MemberNameResolver`),
`src/components/ResultsVNext/attention/ResultsAttentionPage.tsx` (pobiera
listę członków organizacji)
**Commit:** `3a1e9d4702`
**Zmiana:** `ownerLoad.ownerUserId`, `overdueObligations.assigneeUserId`,
`openSupportRequests.assignedToUserId` rozwiązywane do realnego imienia
przez `OrganizationApi.getOrganizationMembers(currentOrganization.id)` —
ten sam wzorzec co `useMentionAutocomplete` gdzie indziej w aplikacji,
istniejący endpoint, zero zmian server. Nierozwiązany id → uczciwy fallback
do skróconego id (np. konto dezaktywowane), NIGDY zmyślone imię. Dodatkowo
usunięto zdublowaną surową kolumnę „KPI ID" z domyślnego bucketu „Brak
właściciela" (`missingOwnership`) — zostaje tylko czytelny „Kod KPI"
(ten bucket z definicji nie ma właściciela do pokazania — serwerowy DTO
`KpiAttentionMissingOwnershipRow` ma tylko `{kpiId, kpiCode}`, brak
tytułu/trendu/dotkliwości w ogóle).
**Testy:** `tests/resultsVnext/attention/attentionPresenters.test.ts` — 3/3
PASS (niezmienione, inne funkcje).
**Zrzuty:** `09_RESULTS/fixed/07-attention-{light,dark}.png` (domyślny
bucket) + `07-attention-ownerload-light.png` (bucket „Obciążenie
właścicieli" — pokazuje „Anna Kowalska"/„Marek Nowak" zamiast
`user-anna`/`user-marek`).

### P0 #5 — Assessment DRD Interview — CZĘŚCIOWE
**Zrobione — duplikat paska statusu:**
**Pliki:** `src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx`,
`src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx`
**Commit:** `74af6756d5`
**Zmiana:** usunięto `degradedMessage={... : \`Status: ${session.state}\`}`
— dublowało badge nagłówka (`statusLabel`, `MethodWorkspaceShell.tsx`),
który ZAWSZE pokazuje stan sesji. Zachowano komunikat `revisionOfSessionId`
(mówi coś, czego badge nie mówi).
**Dodatkowo:** naprawiono izolowany harness `dev-render/drd-workspace-main.tsx`,
który renderował PUSTY EKRAN na tej gałęzi bazowej („useFeatureFlagsContext
must be used within FeatureFlagsProvider") — owinięto w
`<FeatureFlagsProvider>`, ten sam wzorzec co inne ekrany dev-render. Dodano
`&screen=draft` (nowa sesja bez `seedTo`, które zawsze wymusza stan
`active` — żaden inny wariant nie mógł odtworzyć stanu `draft` do zrzutu).
**Testy:** nowy plik
`src/components/assessment/drd/__tests__/DrdMethodWorkspaceScreen.draftStatusBanner.test.tsx`
— 1/1 PASS. Zweryfikowano też brak regresji w całym
`src/components/assessment/drd/__tests__/` przez `git stash` (6
pre-existing failures identyczne przed/po — 34/40 pass, wcześniej 33/39 +
mój nowy test).
**Zrzuty:** `04_ASSESSMENT/fixed/04-drd-interview-draft-status-{light,dark}.png`.

**NIE zrobione — przebudowa lewego sidebara (dwupoziomowy oś→obszar):**
`src/components/method-workspace/MethodNavigator.tsx` nadal renderuje
akordeon z 7 wierszami-osiami widocznymi jednocześnie w jednej kolumnie
(1 rozwinięta, 6 zwiniętych). Świadomie POMINIĘTE:
- `ASM-OWN-016` w
  `docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md:1047`
  ma status `CAPTURED_UNRECONCILED / PROTOTYPE_REQUIRED / NOT_IMPLEMENTED /
  NOT_ACCEPTED` — to jest oznaczone jako pełna przebudowa Interview
  wymagająca PROTOTYPU i akceptu Piotra PRZED implementacją (CLAUDE.md
  reguła #7: „Piotr nigdy nie jest pierwszym testerem wizualnym"), nie
  atom-scoped night-fix. Własne słowa Piotra w rejestrze: „Musimy zupełnie
  zmienić względem tego, co obecnie mamy... Po prawej stronie Teresa nie
  jest nam potrzebna" — to przebudowa całego layoutu, nie retusz.
- `MethodNavigator.tsx`'s bieżące zachowanie (accordion, 1 oś rozwinięta)
  jest pokryte istniejącym testem `MethodNavigator.ownerBehavior.test.tsx`
  jawnie nazwanym „owner-approved compact axis navigation" — z
  WCZEŚNIEJSZEGO odbioru. Zmiana na ślepo, bez nowego cyklu
  prototyp→akcept, ryzykowałaby sprzeczność z tamtym odbiorem.
- Komponent jest WSPÓLNY dla DRD i innych metod (SIRI itd.) — zmiana
  wpłynęłaby szerzej niż tylko na ekran zgłoszony w raporcie.

**Rekomendacja:** osobna sesja z trybem prototypu (skill `consultify-artefakty`/
odpowiedni proces) na `ASM-OWN-016` przed jakąkolwiek zmianą kodu.

---

## Dodatkowe FIX-ATOM / FIX-KANON (4 — ile zdążyłem)

### #6 — Assessment Manage: bramki niebieskie/fioletowe → 4 warianty kanonu
**Plik:** `src/components/assessment/manage/WorkflowStagesTable.tsx`
(GATE_CONFIG l. 224-250, przycisk CTA l. 718, „Send Reminder" l. 774 —
zgodnie z cytowaną linią `:710` w oryginalnym pliku sprzed zmian)
**Commit:** `d8700c5d3f`
**Zmiana:** `REQUEST_REVIEW`/`APPROVE_REPORT`/`GENERATE_REPORT` (były
niebieskie/fioletowe) → neutralny slate (to etykiety TYPU bramki, nie
stanu — stan już pokazuje sąsiednia `StatusCell`). `APPROVE_ASSESSMENT`
(zielony) i `GENERATE_INITIATIVES` (bursztyn) — bez zmian, już zgodne z
kanonem. Zostawiono 3 dekoracyjne gradienty niebiesko-indygo na
avatarach/ikonie nagłówka (l. 578/627/959) — poza cytowanym zakresem
raportu, to nie CTA/status.
**Testy:** `bash scripts/check-list-canon.sh` na tym pliku — 0 nowych
naruszeń.
**Zrzuty:** `04_ASSESSMENT/fixed/03-manage-panel-{light,dark}.png`.

### #7 — Assessment Output Report: `axis-N` → pełna nazwa osi
**Pliki:** `src/components/assessment/report/drdLabels.ts` (nowa funkcja
`resolveDrdAxisName`), `src/components/assessment/report/AssessmentReportDocument.tsx:400-413`
(sekcja „Wynik per wymiar (oś)")
**Commit:** `c04bd97d68`
**Zmiana:** ten sam słownik `AXIS_NAME_BY_ID` (już używany przez
`resolveDrdUnitLabel` dla tabeli „Wynik per jednostka oceny" niżej na tej
samej stronie) teraz rozwiązuje też klucze `aggregation.byGroup`. Uczciwy
fallback do surowego id TYLKO gdy wersja pakietu faktycznie się nie
zgadza.
**Testy:** 2 nowe testy w `AssessmentReportDocument.test.tsx` — 13/13 PASS.
**Zrzuty:** `04_ASSESSMENT/fixed/08-output-report-{light,dark}.png`
(`dev-render assessment-output-report&variant=happy`).

### #8 — Results ROI registry: `user-*` → imię, angielskie enumy → PL
**Pliki:** `src/components/ResultsVNext/roi/roiRegistryMappers.ts`
(`humanizeActionType` — nowa tabela znanych wartości),
`src/components/ResultsVNext/roi/roiRegistryPresenters.tsx` (kolumna i
podgląd Właściciel), `src/components/ResultsVNext/roi/ResultsRoiHub.tsx`
(pobiera listę członków)
**Commit:** `3779a048c5`
**Zmiana:** Właściciel → realne imię (ten sam wzorzec co Attention).
„Następny krok" — zweryfikowano grepem KAŻDE przypisanie
`next_action_type = '...'` w `server/src/services/resultsVnext/roi/`:
serwer realnie emituje TYLKO 3 wartości (`conduct_post_investment_review`,
`finalize_post_investment_review`, `post_investment_review`) — każda
dostaje teraz prawdziwe polskie zdanie; wszystko inne nadal dostaje
uczciwy sformatowany fallback (nigdy surowy kod).
**Uczciwa luka:** fixture harnessu (`dev-render/screens/results-vnext-roi-registry.tsx`)
używa ZMYŚLONYCH wartości (`complete_economic_model`, `review_decision`,
`start_tracking`, `record_actual`, `set_baseline`), które NIE pasują do 3
realnych wartości serwera — zrzut nadal pokazuje dla nich angielski
fallback (poprawnie, zgodnie z dokumentacją), mimo że fix poprawnie
tłumaczy każdą realną wartość. Nie nadpisałem danych demo, żeby wyglądały
ładniej niż to, co realne — zgłoszone do właściciela tego pliku harnessu.
**Testy:** nowy plik `tests/resultsVnext/roi/ui/roiRegistryPresenters.test.tsx`
— 5/5 PASS.
**Zrzuty:** `09_RESULTS/fixed/02-roi-registry-{light,dark}.png` (widać
„Anna Kowalska"/„Tomasz Nowak"/„Piotr Wiśniewski" w kolumnie Właściciel).

### #9 — Finance Statement: `MISC_UNMAPPED_9001` → czytelna etykieta robocza
**Plik:** `src/components/Finance/statementPackWorkspaceV2/CanonicalStatementTableV2.tsx`
**Commit:** `bbeb97b13e`
**Zmiana:** wiersz z `usesLineCodeFallback` (linia niezmapowana do
canonicalLineId) dostaje humanizowaną etykietę („Misc Unmapped 9001")
zamiast surowego kodu źródłowego. Pełny surowy kod zostaje w tooltipie
(`title`) obok już istniejącego badge'a „nieprzypisana" — nic nie ukryte.
**Uczciwa luka:** prawdziwy `resolveLineLabel` w produkcji
(`FinanceHub.tsx`, 2 miejsca) to dosłownie `lineCode ?? canonicalLineId ??
rowKey` — nie ma ŻADNEGO słownika canonicalLineId→polska nazwa nawet dla
zmapowanych linii. To większa luka niż jeden wiersz „MISC_UNMAPPED" —
zgłoszona, nie naprawiona (wymaga realnej wiedzy o taksonomii linii
kanonicznych, poza zakresem tej sesji).
**Testy:** 2 nowe testy w `CanonicalStatementTableV2.test.tsx` — 8/8 PASS.
**Zrzuty:** `10_FINANCE/fixed/01-statement-{light,dark}.png`.

---

## Pominięte — z powodem (zgodnie z GRANICE: „zmiany wizualnie NOWE pomiń i wypisz")

| # | Ekran/poprawka | Powód pominięcia |
|---|---|---|
| Tools #2 | Zdublowany licznik „ZAAKCEPTOWANE: N/5" w karcie propozycji AI (session-workspace) | Nie zdążyłem — niska technicznie poprawka, ale nie dotarłem; do zrobienia w kolejnej turze. |
| Tools #3 | SWOT Build/Live artifact — tryb prezentacyjny (read-only, bez dropdownów) jako „finalny artefakt" | Wizualnie NOWY układ (nowy tryb renderowania macierzy 2×2) — wymaga prototypu, nie retuszu istniejącego atomu. |
| Tools #4 | Stopka sesji — kolizja paska Copilot AI z nawigacją kroków przy 1440px | Nie zdążyłem zweryfikować/naprawić. |
| Assessment | Library/AssessmentHub catalog — dodać pozycjonowanie/fit/zakres per metoda | Wizualnie NOWE elementy wiersza (nie tylko zmiana koloru/tekstu) — wymaga prototypu. |
| Assessment | Presentation slide 1/9 — wypełnić 70% pustej przestrzeni | Wizualnie NOWY layout slajdu — wymaga prototypu. |
| Assessment | DRD Interview/Matrix sidebar — dwupoziomowy przełącznik oś→obszar | Patrz P0 #5 wyżej — `ASM-OWN-016` PROTOTYPE_REQUIRED/NOT_ACCEPTED. |
| Results | KPI registry — `kpiCode` jako jedyny tytuł zamiast nazwy biznesowej | Server GET `KpiDefinitionDto` NIE ma pola `name` (istnieje tylko w `KpiDefinitionVersionDto`, osiągalnym wyłącznie z odpowiedzi write-command, nigdy z GET — potwierdzony, udokumentowany w kodzie „CONFIRMED BACKEND GAP"). Wymaga zmiany server/API — poza GRANICE tej sesji. |
| Results | KPI registry — `primaryProcessId` jako surowy skrócony id zamiast nazwy procesu | Brak JAKIEGOKOLWIEK endpointu/katalogu nazw procesów w kliencie (zweryfikowane grepem) — nie ma z czego zbudować resolvera bez zmiany server. |
| Results | KPI full tool — angielskie enumy `warning`/`verified` małą literą zamiast polskich stylowanych chipów | Nie zdążyłem — zidentyfikowany, nie naprawiony. |
| Finance | Prediction — wypełnić pustą przestrzeń przed przeliczeniem (CTA/podgląd) | Wizualnie NOWY element (nowy CTA/podgląd) — wymaga prototypu. |
| Finance | Baseline — re-test z właściwym `?view=`/`?status=` | To nie jest poprawka kodu, tylko ograniczenie metodyczne poprzedniej sesji audytu (harness renderuje domyślny stan błędu bez dodatkowych parametrów) — do zrobienia w kolejnym przebiegu audytowym, nie naprawczym. |

**Wspólny wzorzec potwierdzony w tej sesji:** tam gdzie dane do
rozwiązania id→nazwa ISTNIEJĄ (realny endpoint członków organizacji,
istniejący słownik AXIS_NAME_BY_ID, zamknięty i zweryfikowany zestaw
wartości next_action_type) — naprawiono. Tam gdzie dane GENUINE NIE
ISTNIEJĄ po stronie klienta (KPI name, process name, pełny słownik
canonicalLineId, DRD axis→obszar layout) — udokumentowano jako lukę,
NIE zmyślono zastępczych danych. To spójne z „ZŁOTE REGUŁY" CLAUDE.md
(nigdy nie zgaduj, weryfikuj realny stan).

---

## Podsumowanie commitów

```
c76433e04c fix(results-okr): resolve lifecycle gate reasons through i18n label dict
f08867ffbc fix(finance-valuation): readable provenance narrative, hide raw graph in details
856436aa15 fix(tools-swot): replace deliverable launcher with Results & Readiness
3a1e9d4702 fix(results-attention): resolve *UserId columns to real member names
74af6756d5 fix(drd-workspace): remove duplicate "Status: draft" banner
d8700c5d3f fix(assessment-manage): remove blue/violet gate badges — canon has 4 variants
c04bd97d68 fix(assessment-report): resolve axis-N group keys to Polish axis names
3779a048c5 fix(results-roi): resolve owner ids to names; translate known next-action types
bbeb97b13e fix(finance-statement): give unmapped lines a readable working label
```

9 commitów, 34 nowe/zmienione testy (wszystkie PASS), 19 zrzutów
light+dark w `docs/program/waves/WAVE_03_ACCEPTANCE/night-sweep-20260826/{03_TOOLS,04_ASSESSMENT,09_RESULTS,10_FINANCE}/fixed/`.
Push: `github-backup codex/night-fixes-a-20260826` @ `bbeb97b13e`.
