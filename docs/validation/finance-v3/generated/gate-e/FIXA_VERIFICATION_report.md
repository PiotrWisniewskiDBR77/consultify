# FIX-A weryfikacja niezależna (Gate E) — "uczciwy interfejs"

Weryfikator: agent niezależny od autora FIX-A. Worktree `fv3p-e-analysis`, gałąź
`codex/fv3p-fixa-honest-ui` @ `f54e338bd7`, baza `57fe0543cc`. Zero zmian w `server/**`,
`rawEnumLeakScanner.test.ts`, plikach layoutu kroków wyceny (potwierdzone niżej). Wszystkie
kontrole negatywne wyłącznie przez `git show 57fe0543cc:<plik> > <plik>` i ręczne
przywrócenie z `/tmp` — nigdy `stash`/`reset`/`clean`. Zero bazy demo/staging/prod użyto.

Nowy plik dodany przez tę weryfikację (własny dowód, nie autora): `src/components/Finance/shared/__tests__/FinanceStatusAnnouncer.independent-verification.test.tsx`.

---

## Tabela wyników

| # | Twierdzenie autora | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1a | `aria-live` węzeł realnie mutuje (nie remontuje się) w 4 konsumentach | Własny test `MutationObserver` napisany na **innym** komponencie (`FinanceComparePanel`) i **innym** wyzwalaczu (zmiana propsa `request`, nie klik) — PASS na HEAD, RED po przywróceniu przedfixowej wersji (patrz #5) | **POTWIERDZONE** |
| 1b | Ostateczny test autora nie ma tego samego ukrytego fałszywego negatywu (timing) | Zmutowałem `FinanceCommentsPanel.tsx` do wersji sprzed naprawy (3 różne korzenie JSX) i uruchomiłem TEST AUTORA bez zmian — poszedł czerwony dokładnie na `toBe(announcerBefore)` z komunikatem "Ładowanie komentarzy…" zamiast oczekiwanego tekstu po akcji. Test autora NIE ma ukrytej wady — trzymanie promisy otwartej ręcznie faktycznie wymusza commit `loading` | **POTWIERDZONE** |
| 1c | 4 konsumenty naprawione, brak piątego zepsutego | `grep -rl FinanceStatusAnnouncer src` → 5 plików. Piąty (`FinanceExportImportPanel.tsx`) ma JEDEN stabilny `<div>` korzeń z announcerem zawsze pierwszym dzieckiem — nigdy nie miał defektu (nie dotknięty diffem, słusznie) | **POTWIERDZONE** |
| 2a | 11 wartości `mapping_reason` pokryte, potwierdzone grepem w `finance-v3-backfill-dry-run.ts` | Policzyłem klucze w `known{}` (`financeV2.types.ts`): dokładnie 11. Każdy z 11 grep-potwierdzony jako `reasonCode:` w skrypcie | **POTWIERDZONE (dosłownie)** |
| 2b | Fallback daje zrozumiały komunikat, nigdy nie przecieka surowy kod | `financeLegacyBridgeQuarantineReasonLabel()` dla nieznanej wartości zwraca stały, bezpieczny tekst PL. Test autora potwierdza to na REALISTYCZNYM przykładzie (`pack_status=draft;pack_readiness_status=pending`) | **POTWIERDZONE** |
| 2c | Test poprawiony asertuje etykietę ludzką ORAZ brak surowego kodu | `FinanceLegacyBridgeGate.test.tsx` diff: `expect(text).not.toContain('approved_without_snapshot')` + `expect(text).toMatch(/zatwierdzony.*bez zapisanej migawki/)`, plus nowy test dla wolnotekstowej wartości | **POTWIERDZONE** |
| — | ★ ZNALEZISKO WŁASNE (nieproszony, ale istotny kontekst dla oceny "pokrycia") | Zob. sekcję "Uwaga: praktyczny zasięg 11 etykiet" niżej — 11 kodów jest grep-prawdziwe, ale w PRAKTYCE nieosiągalne z jedynego pisarza `mapping_reason` | **DO ODNOTOWANIA** |
| 3a | Zero zmiany wizualnej dla ~22 konsumentów spoza Finance | Policzyłem 24 pliki referujące `EmptyStateInline` (21 spoza Finance po odjęciu 3 plików Finance + komponentu). Test-probe potwierdza: zmiana koloru `text-primary-500` → `text-c-focus-solid` jest **BEZWARUNKOWA** (nie za flagą, nie za propem) — dotyka KAŻDEGO wywołania z `action`, min. 8 plików spoza Finance faktycznie przekazuje `action` (KpisSection, InsightCreatorModal, InsightViewer×5, CalendarView, HomeView, IdeaProcessFlowTool, IdeaTableTool). Prefiks `+` faktycznie JEST zachowany (domyślne `showPrefix` nieustawione → stare zachowanie) | **OBALONE (kolor) / POTWIERDZONE (prefiks)** — patrz niżej |
| 3b | Kontrast `text-c-focus-solid` ≥4,5:1 | Policzyłem WCAG na `#2563eb`(light)/`#5b8def`(dark) vs `c-surface`/`c-surface-raised`/`c-bg`: **4,94–5,91:1** we wszystkich 6 kombinacjach. `--c-focus-solid` to inny, pełnokryjący token niż `--c-focus` (rgba z alpha 0.4/0.45) | **POTWIERDZONE** |
| 4 | 511/511 Finance testów, `tsc --noEmit` exit 0 w 112s | Pełny zestaw autora (64 pliki/511 testów, **bez** mojego dodanego pliku): **510/511 PASS, exit 1** w izolowanym uruchomieniu z powodu 1 FLAKY testu (`PredictionWorkspace.test.tsx`, race niezwiązany z FIX-A — patrz niżej). `tsc --noEmit`: **exit 0, 111s** (zmierzone `cmd > plik 2>&1; echo $? >> plik`, nigdy przez potok) | **CZĘŚCIOWO** — tsc potwierdzony; vitest zielony TYLKO probabilistycznie |
| 5 | Kontrole negatywne (min. 2) | Wykonałem **3** własne mutacje (`FinanceComparePanel.tsx`, `FinanceCommentsPanel.tsx`, `EmptyStateInline.tsx`, `FinanceLegacyBridgeGate.tsx` — de facto 4 pliki w 3 rundach), każda: czerwono z defektem → zielono po przywróceniu → `git diff --stat` pusty po każdej | **POTWIERDZONE** |
| 6 | Allowlista (zero `server/**`, zero skanera, zero layoutu wyceny) | `git diff --stat 57fe0543cc..f54e338bd7` — 17 plików, wszystkie w `src/`, `docs/validation/`; zero `server/**`; `rawEnumLeakScanner.test.ts` niedotknięty | **POTWIERDZONE** |
| 7 | Zrzuty przed/po zgodne z kanonem | Obejrzałem 4 PNG (`before/after` × `light/dark`). Po: brak crimsonu, link niebieski (`c-focus-solid`), etykieta PL, brak gołego kodu. Przed: crimson + `approved_without_snapshot` widoczne wprost — wyraźny kontrast defekt→naprawa | **POTWIERDZONE** |
| 8 | Rozbieżność `PredictionWorkspace.tsx` — przedistniejący, nie z tej sesji | `grep -n mountCheck.version.status` identyczna linia 250 w `f54e338bd7` I w `57fe0543cc` | **POTWIERDZONA INTERPRETACJA** — do odnotowania, nie naprawiam |

---

## 1. `aria-live` — własny dowód MutationObserver

Napisałem `FinanceStatusAnnouncer.independent-verification.test.tsx`, celowo na **innym** komponencie
(`FinanceComparePanel`) i **innym** wyzwalaczu (re-render z nową propsą `request`, powodujący
`useEffect` re-fetch loaded→loading→loaded) niż test autora (klik w `FinanceCommentsPanel`/
`FinanceSavedViewsPanel`). Test:

1. Renderuje panel, czeka na `loaded`, zapamiętuje węzeł `finance-status-announcer`.
2. Podłącza `MutationObserver` do TEGO węzła.
3. Trzyma drugą odpowiedź `compareFinancePeriods` OTWARTĄ ręcznie sterowaną obietnicą (nie
   `mockResolvedValueOnce`) — świadome powtórzenie techniki autora, bo instant-resolve przepuszcza
   React 18 przez `loading` w jednej partii i observer nic nie widzi (sprawdziłem to ręcznie przy
   pisaniu — dokładnie fałszywy negatyw opisany w zadaniu).
4. `waitFor` na `compare-panel-loading` PRZED sprawdzeniem tożsamości węzła.
5. Asertuje `toBe(announcerBefore)` mid-flight ORAZ `records.some(r => r.type === 'characterData')`.

**Wynik na HEAD (`f54e338bd7`): PASS.**

### Kontrola negatywna — czy naprawa naprawdę robi różnicę

Cofnąłem `FinanceComparePanel.tsx` do `57fe0543cc` (trzy różne korzenie JSX: `<>` dla
loading/error, `<div data-testid="finance-compare-panel">` dla loaded) i uruchomiłem mój test bez
zmian:

```
AssertionError: expected <div role="status" …> to be <div role="status" …>
- Porównanie gotowe.
+ Liczenie porównania…
 ❯ …independent-verification.test.tsx:106:60
```

**RED, dokładnie na asercji tożsamości węzła** — węzeł uchwycony przed re-renderem NIE jest tym
samym węzłem widocznym mid-`loading`; React go odmontował i wstawił nowy. Plik przywrócony
(`git diff --stat` puste), test znów PASS.

### Czy test AUTORA ma ten sam ukryty fałszywy negatyw w innej postaci?

Cofnąłem `FinanceCommentsPanel.tsx` do `57fe0543cc` i uruchomiłem TEST AUTORA
(`FinanceStatusAnnouncer.mutation.test.tsx`) bez żadnej modyfikacji testu:

```
FAIL FinanceCommentsPanel: "Oznacz jako rozwiązany" MUTATES the existing role="status" node…
AssertionError: expected <div role="status" …> to be <div role="status" …>
- Komentarze wczytane.
+ Ładowanie komentarzy…
```

**RED** (test SavedViews w tym samym pliku pozostał zielony, bo dotyczy innego, nietkniętego
komponentu — spodziewane). To dowodzi, że trzymanie promisy otwartej ręcznie + `waitFor` na stanie
`loading` PRZED sprawdzeniem tożsamości węzła faktycznie wymusza prawdziwy, obserwowalny unmount/
remount pod defektem — **test autora NIE ma tej samej wady w innej postaci.** Plik przywrócony,
`git diff --stat` puste.

### Czwarty konsument — czy istnieje piąty zepsuty?

`grep -rl FinanceStatusAnnouncer src` zwraca 5 plików spoza `__tests__`: cztery naprawione
(`FinanceCommentsPanel`, `FinanceSavedViewsPanel`, `FinanceComparePanel`, `FinanceLineageNavigator`)
plus `FinanceExportImportPanel.tsx` — NIEDOTKNIĘTY diffem. Sprawdziłem jego strukturę: JEDEN
`return` z JEDNYM stabilnym korzeniem `<div data-testid="finance-export-import-panel">`, dwa
`<FinanceStatusAnnouncer>` zawsze zamontowane jako pierwsze dzieci, warunkowa treść renderowana
WEWNĄTRZ tego samego korzenia (`{importState.kind === 'parsing' ? … : null}` itd.), nigdy przez
osobny `return`. **Nigdy nie miał tego defektu — słusznie pominięty.**

---

## 2. Etykiety `mapping_reason`

11 kluczy w `known{}` (`financeV2.types.ts`) policzone ręcznie i każdy zweryfikowany grepem jako
`reasonCode: 'XXX'` w `finance-v3-backfill-dry-run.ts` — **11/11 zgadza się**.

### Uwaga: praktyczny zasięg 11 etykiet (do odnotowania, nie defekt bezpieczeństwa)

Prześledziłem PRZEPŁYW danych: `legacyIdBridgeService.ts::resolveLegacyFinanceArtifact()` czyta
`state.reason` z **`finance_artifact_aliases.mapping_reason`** (kolumna zapisywana WYŁĄCZNIE przez
`insertAlias()`). Ale wszystkie 11 grep-potwierdzonych kodów (`APPROVED_WITHOUT_SNAPSHOT`,
`ORPHANED_ORG_REFERENCE`, `LEGACY_PARALLEL_STORE_UNRECONCILED` itd.) są przekazywane jako
`reasonCode:` do **`logQuarantine()`/`logExcluded()`**, które piszą do DWÓCH INNYCH tabel
(`finance_v3_backfill_quarantine_log`, `finance_v3_backfill_excluded_log`) — tabel, których
`legacyIdBridgeService.ts` NIGDY nie czyta.

Sprawdziłem WSZYSTKIE 10 wywołań `insertAlias()` w skrypcie — każde przekazuje `mappingReason` jako
WOLNY TEKST (`pack_status=...;pack_readiness_status=...`, `child_of_pack=...`, `status=...;
ORCH-DEC-002...`, `current_version;model_status=...`, `superseded_by_next_version`,
`ORCH-DEC-001;source=...`), NIGDY jeden z 11 kodów SCREAMING_SNAKE_CASE. Napisałem izolowany skrypt
przepuszczający wszystkie 8 unikalnych wzorców przez `financeLegacyBridgeQuarantineReasonLabel()` —
**wszystkie 8 trafiają w FALLBACK, zero trafia w któryś z 11 znanych kluczy.**

Dodatkowo: z 4 tabel faktycznie mostkowanych przez UI (`LEGACY_FINANCE_TABLES` =
`financial_statement_packs`/`financial_analyses`/`financial_models`/`valuations`), manifest Gate A
(`WP-A01_inventory_manifest.json`) klasyfikuje wszystkie 4 jako `AUTO_MIGRATE`/`MIGRATE_WITH_WARNING`
— nigdy `QUARANTINE`/`EXCLUDE_WITH_REASON` — więc stan `QUARANTINED` może być w ogóle nieosiągalny
dla tych 4 tabel z bieżących danych tego skryptu.

**To NIE unieważnia naprawy**: własność bezpieczeństwa ("nigdy nie echuj surowego tekstu")
jest zachowana NIEZALEŻNIE od tego, czy któryś z 11 kluczy trafi — fallback jest bezpieczny i
uczciwy, i sam autor to POTWIERDZA własnym testem na realistycznym przykładzie
(`pack_status=draft;pack_readiness_status=pending` → fallback, nie któryś z 11 kluczy). Odnotowuję
to jako niuans do sprostowania w opisie ("pokrycie 11 wartości" sugeruje, że te konkretne tłumaczenia
będą używane w praktyce — w rzeczywistości z tego jedynego pisarza kolumny prawie na pewno ZAWSZE
zadziała fallback), nie jako defekt do naprawy.

### Kontrola negatywna

Cofnąłem `FinanceLegacyBridgeGate.tsx` do `57fe0543cc`, uruchomiłem test autora bez zmian:
**2/6 czerwone** — dokładnie test szukający `approved_without_snapshot` (teraz oczekuje jego
BRAKU) i nowy test fallbacku. Zgadza się z tabelą autora. Przywrócone, diff pusty.

---

## 3. `EmptyStateInline` — zmiana współdzielona

**Prefiks `+`**: potwierdzone — `action.showPrefix === false ? label : '+ ' + label`, więc KAŻDY
istniejący callsite bez tego pola (wszyscy poza Finance) zachowuje stary tekst z prefiksem.

**Kolor — to jest sedno tej weryfikacji.** Klasa `className` zmieniła się BEZWARUNKOWO:
`text-primary-500 hover:text-primary-600` → `text-c-focus-solid hover:underline`. Nie ma żadnej
flagi, propa ani gałęzi warunkowej różnicującej Finance od reszty — to jedna literalna zmiana
stringa dla WSZYSTKICH konsumentów tego przycisku. Napisałem probe-test:

```
render(<EmptyStateInline message="m" action={{ label: 'Dodaj cel', onClick: () => {} }} />)
// className: "mt-2 text-xs font-medium text-c-focus-solid hover:underline transition-colors disabled:opacity-40"
```

24 pliki referują `EmptyStateInline` (grep), z czego 3 są plikami Finance (`FinanceHub.tsx`,
`PredictionWorkspace.tsx`, `FinanceLegacyBridgeGate.tsx`) — **21 plików spoza Finance**. Sprawdziłem
które z nich faktycznie przekazują `action` (czyli renderują przycisk z tym kolorem): co najmniej
`KpisSection.tsx`, `InsightCreatorModal.tsx`, `InsightViewer.tsx` (5×), `CalendarView.tsx`,
`HomeView.tsx`, `IdeaProcessFlowTool.tsx`, `IdeaTableTool.tsx` — **min. 8 plików spoza Finance
faktycznie zmieniają kolor swojego "+"-linku z crimson na niebieski w wyniku tego commita.**

**Werdykt dla punktu 3a: warunek "zero zmiany wizualnej dla ~22 konsumentów spoza Finance" NIE jest
spełniony dosłownie dla koloru** — jest spełniony dla prefiksu. Sam autor to jawnie przyznaje w
komentarzu nagłówkowym nowego testu ("This component is shared across ~26 files… the crimson→neutral
color swap is a pure CSS-class change with NO signature/behavior change, consistent with CLAUDE.md's
repo-wide canon — safe everywhere") — czyli nie ukrywa zasięgu, ale framing raportu jako "zero zmiany
wizualnej" jest nieścisły względem realnego zasięgu zmiany. Rzeczowo: `text-primary-500` (crimson)
na zwykłym linku nawigacyjnym było już naruszeniem kanonu UI (CLAUDE.md reguła #3: "primary w
tailwind = crimson, TYLKO semantyka krytyczna") we WSZYSTKICH tych ~8+ plikach, więc ta zmiana
koloru jest merytorycznie POPRAWKĄ zgodności z kanonem repo-wide, nie regresją — ale to WCIĄŻ
zmiana wizualna poza Finance, którą zadanie definiuje jako "warunek nienaruszalny" do potwierdzenia
jako ZERO. Rekomendacja: to wymaga świadomej decyzji właściciela (Piotr), nie cichego przemycenia w
pakiecie Finance — sygnalizuję do orkiestratora, nie blokuję (jest jawnie udokumentowane w kodzie i
teście autora, nie ukryte).

### Kontrast

`--c-focus-solid: #2563eb` (light) / `#5b8def` (dark) — pełnokryjące tokeny (bez alfa), różne od
`--c-focus: rgba(37,99,235,0.4)` używanego dla obwódki fokusu (ten dałby ~1,80:1, jak ostrzega
zadanie — POTWIERDZONE że to NIE jest token użyty tutaj). Policzyłem WCAG (formuła relative
luminance) dla tekstu na trzech plausybilnych tłach:

| Tło | Tryb | Kontrast |
|---|---|---|
| `--c-surface` (#ffffff) | light | 5.17:1 |
| `--c-surface-raised` (#f8fafc) | light | 4.94:1 |
| `--c-bg` (#fafaf9) | light | 4.95:1 |
| `--c-surface` (#0f172a) | dark | 5.53:1 |
| `--c-surface-raised` (#15213b) | dark | 4.95:1 |
| `--c-bg` (#0a0f1e) | dark | 5.91:1 |

Wszystkie ≥4,5:1 (próg AA dla tekstu normalnego, `text-xs` = 12px, nie duży tekst).
**POTWIERDZONE.**

### Kontrola negatywna

Cofnąłem `EmptyStateInline.tsx` do `57fe0543cc`, uruchomiłem test autora bez zmian: **2/4
czerwone** (kolor crimson obecny, prefiks bezwarunkowy — `showPrefix: false` nie działa, bo pole
nie istnieje w starej wersji). Zgadza się z tabelą autora. Przywrócone, diff pusty.

---

## 4. Pełny zestaw testów + tsc — zmierzone samodzielnie

### Vitest

Uruchomiłem DOKŁADNIE zestaw autora (`src/components/Finance src/services/api/financeV2.types.ts
src/components/shared/NModeBlocks`, `--maxWorkers=2`), z moim dodanym plikiem tymczasowo usuniętym
z drzewa:

```
Test Files  1 failed | 63 passed (64)
     Tests  1 failed | 510 passed (511)
     exit=1, 61.20s (moje uruchomienie; autor: 34.42s)
```

Jedyny fail: `PredictionWorkspace.test.tsx` > "gdy realny endpoint preflight odrzuca wywołanie…" —
**test FLAKY**, nie deterministyczna regresja. Uruchomiłem TEN SAM plik w izolacji 3× (i 3× na
`57fe0543cc`, PRZED FIX-A): pattern fail/pass/fail w OBU wersjach, identyczny. To dowodzi, że
flakiness jest PRZEDISTNIEJĄCA, niezwiązana z FIX-A (którego jedyna zmiana w tym pliku to 3×
`showPrefix: false` w zupełnie innych, niepowiązanych blokach `return`). Błąd konkretny: race między
dwoma różnymi komunikatami błędu w preflight (`Brak realnego scenariusza…` vs oczekiwany
`…nie istnieje albo nie masz do niej dostępu`), timing-zależny.

**Werdykt**: teza "511/511 PASS" jest PRAWDZIWA probabilistycznie (mój pełny-katalogowy przebieg z
`--maxWorkers=2` faktycznie dał 512/512 zielono z moim dodatkowym plikiem włączonym — patrz niżej),
ale NIE jest deterministyczna — powtórzenie dokładnie tego samego polecenia może dać czerwono z
powodu przedistniejącego race'a w pliku, który FIX-A nie dotyka merytorycznie. To ryzyko dla
orkiestratora, jeśli bramka CI odpala ten zestaw bez retry.

Dla porównania, mój pełny przebieg z moim własnym plikiem NADAL w drzewie (65 plików / 512 testów):
`exit=0, 512/512 PASS, 73.60s` — czysto zielono w TYM konkretnym uruchomieniu (los, biorąc pod uwagę
flaky test powyżej).

### `rawEnumLeakScanner.test.ts`

```
Test Files  1 failed (1)
     Tests  1 failed | 4 passed (5)
newOffenders = ["src/components/Finance/Prediction/PredictionWorkspace.tsx: {mountCheck.version.status}"]
```
Zgadza się dokładnie z raportem autora. Zweryfikowałem: linia 250 identyczna w `f54e338bd7` i w
`57fe0543cc` (`grep -n mountCheck.version.status` na obu) — **przedistniejący offender,
niezmieniony przez tę sesję, potwierdzam interpretację autora.**

### `tsc --noEmit`

```
NODE_OPTIONS=--max-old-space-size=8192 tsc --noEmit
TSC_EXIT=0
DURATION=111s
```
Zmierzone `cmd > plik 2>&1; echo "TSC_EXIT=$?" >> plik` (nigdy przez potok/`PIPESTATUS`). Zero linii
błędu w logu. Autor: 112s. **POTWIERDZONE, zgodne co do rzędu wielkości.**

---

## 5. Kontrole negatywne — podsumowanie (3 przeprowadzone, min. wymagane 2)

| # | Plik cofnięty | Test | Z defektem | Po przywróceniu |
|---|---|---|---|---|
| 1 | `FinanceComparePanel.tsx` | mój własny (`independent-verification.test.tsx`) | RED (`toBe` fail, mid-loading inny węzeł) | PASS |
| 2 | `FinanceCommentsPanel.tsx` | autora (`FinanceStatusAnnouncer.mutation.test.tsx`) | RED (SavedViews-test niedotknięty, jak oczekiwano) | PASS (2/2) |
| 3 | `EmptyStateInline.tsx` | autora (`EmptyStateInline.test.tsx`) | 2/4 RED | PASS (4/4) |
| 4 | `FinanceLegacyBridgeGate.tsx` | autora (`FinanceLegacyBridgeGate.test.tsx`) | 2/6 RED | PASS (6/6) |

Po KAŻDEJ: `cp <fixed> /tmp/`, `git show 57fe0543cc:<plik> > <plik>`, test, `cp /tmp/<fixed> <plik>`,
`git diff --stat` → puste. Zero użycia `stash`/`reset`/`clean`.

---

## 6. Allowlista

```
git diff --stat 57fe0543cc..f54e338bd7
```
17 plików zmienionych, wszystkie w `src/`, `docs/validation/finance-v3/generated/gate-e/`. **Zero**
plików `server/**`. **Zero** zmian w `rawEnumLeakScanner.test.ts` (potwierdzone przez brak wpisu w
diff-stat i przez samodzielne uruchomienie testu — patrz §4). **Zero** plików layoutu kroków wyceny
w diffie (allowlista FIX-B, nie znaleziono żadnego pasującego pliku).

---

## 7. Zrzuty przed/po

Obejrzałem `before-light.png`, `after-light.png`, `before-dark.png`, `after-dark.png` (zawartość:
`FinanceHub` z wybranym wierszem legacy `financial_models`, panel bridge, oba motywy).

- **Przed**: `+ Wróć do listy` w wyraźnym crimson (czerwono-różowy), surowy string
  `approved_without_snapshot` wprost w zdaniu PL ("Powód: approved_without_snapshot.").
- **Po**: `Wróć do listy` (bez prefiksu) w niebieskim `c-focus-solid`, pełne uczciwe zdanie PL
  bez śladu surowego kodu.
- Brak crimsonu na nawigacji w obu trybach "po". Fokus niebieski zgodny z kanonem. Polski spójny.
  Status komunikowany tekstem, nie samym kolorem.
- Pływające "← Lista"/"Uwagi" w prawym dolnym rogu to nakładka harnessu (zgodnie z ostrzeżeniem w
  zadaniu) — nie zgłaszam jako defekt.

**POTWIERDZONE zgodnie z kanonem.**

---

## 8. Rozbieżność `PredictionWorkspace.tsx` — do odnotowania

Autor: wyciek `{mountCheck.version.status}` (linia 250) jest "przedistniejący, niezmieniony od
bazy". Niezależna bateria innego agenta twierdzi, że wyciek pochodzi z commitu `2e61d2eeff` TEJ
sesji. Zweryfikowałem: `git show 57fe0543cc:...PredictionWorkspace.tsx | grep -n
mountCheck.version.status` → linia 250, identyczna treść jak w `f54e338bd7`. **Obie tezy są
poprawne przy różnych bazach** — baza autora (`57fe0543cc`, punkt startowy TEJ gałęzi) już zawiera
`2e61d2eeff` z innej, wcześniejszej sesji równoległej. Potwierdzam interpretację autora dla ZAKRESU
TEGO PAKIETU (FIX-A go nie wprowadził ani nie dotknął) — **nie naprawiam**, robi to inny agent
(FIX-B/skaner).

---

## Nowe defekty znalezione przeze mnie

1. **(Do rozstrzygnięcia przez orkiestratora/Piotra, nie blokujące)** Zmiana koloru w
   `EmptyStateInline.tsx` jest bezwarunkowa i realnie zmienia wygląd min. 8 ekranów spoza Finance
   (KPI Section, Insight Creator/Viewer, Calendar, Home, Idea Process Flow, Idea Table) —
   sprzeczne dosłownie z "zero zmiany wizualnej poza Finance", choć merytorycznie jest to POPRAWKA
   zgodności z zakazem crimsona z CLAUDE.md (reguła #3), jawnie udokumentowana przez autora w
   kodzie i teście, nie ukryta. Rekomenduję świadomą akceptację/odrzucenie przez Piotra jako osobną
   decyzję (nie ukrywać w pakiecie Finance-scoped).
2. **(Informacyjne, nieblokujące)** `PredictionWorkspace.test.tsx` ma przedistniejący, niezwiązany z
   FIX-A test FLAKY (~1/3 czerwony w izolacji, potwierdzone identycznie na bazie `57fe0543cc`) —
   ryzyko fałszywie czerwonej bramki CI przy re-runach "511/511 PASS".
3. **(Informacyjne, niuans nie-defekt)** "Pokrycie 11 wartości mapping_reason" jest grep-prawdziwe,
   ale praktycznie nieosiągalne z jedynego pisarza kolumny (`insertAlias()` zawsze pisze wolny tekst,
   nigdy jeden z 11 kodów) — fallback jest bezpieczny i to jedyna właściwość, która faktycznie się
   liczy, ale opis "pokrycie" myli o realnym zasięgu tłumaczeń.

---

## Ocena końcowa

**PARTIAL.**

Rdzeń bezpieczeństwa/uczciwości interfejsu (defekt 1 — aria-live realnie mutuje; defekt 2 — nigdy
nie przecieka surowy tekst, fallback zawsze bezpieczny; testy regresji i kontrole negatywne autora)
jest **solidnie potwierdzony** własnymi, niezależnymi pomiarami, łącznie z własnym testem
MutationObserver na innym komponencie/wyzwalaczu i 4 własnymi mutacjami czerwono→zielono.
`tsc --noEmit` potwierdzony 1:1 (exit 0, 111s vs raportowane 112s).

Dwa powody obniżenia z PASS do PARTIAL:
- **Defekt 3 (EmptyStateInline)**: warunek "zero zmiany wizualnej dla ~22 konsumentów spoza
  Finance" NIE jest spełniony dosłownie — zmiana koloru jest bezwarunkowa i realna dla min. 8
  ekranów spoza Finance, mimo że jest to merytorycznie poprawna, jawnie udokumentowana korekta
  zgodności z kanonem repo. Wymaga świadomej decyzji orkiestratora/Piotra, nie automatycznego
  przejścia.
- **Punkt 4 (511/511)**: potwierdzony tylko probabilistycznie — jeden przedistniejący, niezwiązany z
  FIX-A test flaky w `PredictionWorkspace.test.tsx` sprawia, że powtórzenie dokładnie tego samego
  polecenia testowego może dać czerwono niezależnie od jakości tego pakietu.

Żaden z tych dwóch punktów nie jest regresją WPROWADZONĄ przez FIX-A względem jego trzech
deklarowanych defektów — oba są albo świadomie ujawnionym efektem ubocznym (kolor), albo
przedistniejącym stanem repo (flaky test) — ale oba naruszają dosłowne warunki z briefu weryfikacji,
więc raportuję PARTIAL, nie PASS.
