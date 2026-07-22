# ODBIÓR NIEZALEŻNY — 6 zmigrowanych artefaktów (kontrakt karty)

> **Data:** 2026-07-22 · **Gałąź:** `fix/prv-mywork-preview` (worktree `prv-mywork`, baza `origin/demo`)
> **Zakres:** Task · Tool · Interview · Notification · Insight · Initiative (POC Decision już zaakceptowany, poza zakresem).
> **Metoda:** NIE zaufałem raportom migracji. Każdy artefakt sprawdzony sam: (a) statyczne wpięcie w kodzie
> (`grep`/`Read` realnego callera), (b) runtime w harnessie `localhost:3220` — Chromium izolowany, **light I dark**,
> flaga ON i OFF, przez `scratchpad/probe-odbior-6.mjs`, (c) odbiór WZROKIEM na zrzutach, (d) bramka strukturalna
> `scripts/check-artefakt-struktura.mjs`, (e) crimson = porównanie z baseline (gate uruchomiony na commicie
> **przed** migracjami `1f0a3eff3c` vs HEAD).
> **Reguła #5/#6:** „esbuild przeszedł" ≠ „działa"; „raport agenta" ≠ „dowód".

---

## 1. WERDYKT — tabela 6 × 4

| Artefakt | 1. Render bez regresji | 2. Rdzeń nieusuwalny | 3. Węższy default (picker) | 4. Bramka (struktura / crimson) | **Werdykt** |
|---|:---:|:---:|:---:|:---:|:---:|
| **Task** | PASS | PASS | PASS (4 / 6) | PASS (OK / 11=baseline) | **PASS** |
| **Tool** | PASS | N/D wg projektu | N/D wg projektu | PASS (OK / 28=baseline) | **PASS\*** (deskryptor niewpięty) |
| **Interview** | PASS | PASS | PASS (3 / 5) | PASS (OK / 2=baseline) | **PASS** |
| **Notification** | PASS | PASS | PASS (2 / 1) | PASS (OK / 38=baseline) | **PASS** |
| **Insight** | PASS | PASS | PASS z uwagą (10 / 21; +11 Phase-D „extras") | PASS (OK / 0) | **PASS** (uwaga Phase-D) |
| **Initiative** | PASS | PASS (odznaka RDZEŃ) | **CZĘŚCIOWE** (niewpięte, ON==OFF==24) | PASS (OK / 13=baseline) | **CZĘŚCIOWE** |

**Legenda kolumny 3:** `(domyślne / dodawalne z pickera)`. **N/D wg projektu** = artefakt z definicji nie ma
takiego mechanizmu (Tool = klasa S, read-only, zero rdzenia treści — potwierdza `_PRZEPIS_MIGRACJI_TOOL`).

**Runtime — czysto dla WSZYSTKICH 6 (light+dark):** brak error-boundary, brak `ReferenceError`, brak zdublowanych
kluczy React, brak surowych kluczy i18n. (Pomiar: `scratchpad/odbior-6-out.json`, pola `boundary/refErrors/dupKeyWarns/i18nKeys` = puste we wszystkich wariantach.)

---

## 2. DOWÓD PER ARTEFAKT

### TASK — PASS (pełny wzorzec POC)
- **Wpięcie:** `TaskDetailView.tsx:92` import `TASK_CARD_SPEC`; flaga `VITE_VF1_TASK_CARD_CONTRACT` / dev `?cardContract=1`
  (`:161-163`); `spec: taskCardContractEnabled ? TASK_CARD_SPEC : undefined` (`:3965`); namespace klucza `v2-contract`/`v1` (`:3926`).
- **Rdzeń:** picker „Sekcje" — wiersz **„Opis i zakres" bez przycisku „Usuń"** (DOM `buttonCount=3`; pozostałe `=4`).
  Deskryptor `taskCardContract.ts`: `rdzen=1`. Zrzut: `karta-task-picker-sekcje.png`.
- **Węższy default:** ON = **4** widoczne (Opis i zakres, Lista kontrolna, Zależności, Dowody); OFF baseline = **8**;
  picker 10 wierszy (4 + 6 ukrytych), przełącznik **„Rdzeń zadania / Pełny"**, „Przywróć domyślne". → 4 domyślne / 6 dodawalne.
- **Bramka:** struktura OK (NModeHeader, ArtifactRightPanel, kolejność kanoniczna, zero inwersji); crimson centrum **11 = baseline**.
- **Prawy panel (zrzut):** AKCJE · WŁAŚCIWOŚCI · POWIĄZANIA · KOMENTARZE · HISTORIA/AI — kolejność kanoniczna. CTA neutralny (granat).

### TOOL — PASS\* (renderuje czysto; deskryptor NIEWPIĘTY)
- **Render:** `karta-tool-light.png`/`-dark.png` — archetyp A·Canvas (baza wiedzy „Dynamiczny SWOT"), 4 sekcje
  **Cel/Proces/Rezultat/Przykład**, aktywna pozycja = niebieski `c-focus`. Brak boundary/surowych kluczy. Identycznie ON i OFF.
- **Rdzeń / default:** **N/D wg projektu.** Tool = klasa S, read-only, **zero rdzenia treści**; **brak systemu kart / pickera**
  (`grep` w `KnownToolDetailView.tsx`: brak `useCardLayout`/`NModeCardManager`/`removeCard`; runtime `hasSekcje=false`, `hasNowaKarta=false`).
  Zgodne z `_PRZEPIS_MIGRACJI_TOOL_2026-07-22.md` („Zero rdzenia", „najlżejszy przepis").
- **Bramka:** struktura OK (NModeShell kanon, panel `[properties, relations]`); crimson centrum **28 = baseline** (biblioteka grafik + karty „nie jest").
- **★ USTALENIE:** `toolCards.contract.ts` **nie jest importowany nigdzie w `src`** (orphan). `TOOL_CARD_SPEC` się kompiluje,
  ale **nic go nie konsumuje** — kontrakt NIE rządzi renderem Tool (view nadal hardkoduje 4 sekcje). Migracja Tool = deklaratywna
  (deskryptor + bramka), **bez efektu runtime**. Inaczej niż pozostałe 4 (spec wpięty w `useCardLayout`). **DO POTWIERDZENIA PIOTRA:**
  zostawić deklaratywnie, czy wpiąć deskryptor jako źródło 4 sekcji Tool.

### INTERVIEW — PASS (pełny wzorzec)
- **Wpięcie:** `InterviewWorkspace.tsx:93` import `INTERVIEW_CARD_SPEC`; flaga `VITE_VF1_INTERVIEW_CARD_CONTRACT` / `?cardContract=1` (`:169-171`);
  `spec: interviewCardContractEnabled ? INTERVIEW_CARD_SPEC : undefined` (`:1813`).
- **Rdzeń:** picker — **„Pytania" bez „Usuń"** (`buttonCount=3`); deskryptor `rdzen=1`. Zrzut `karta-interview-picker-sekcje.png`.
- **Węższy default:** ON = **3** (Podgląd, Pytania, Notatki); OFF = **8**; picker 8 wierszy, „Rdzeń wywiadu / Pełny". → 3 / 5.
- **Bramka:** struktura OK; crimson centrum **2 = baseline** (ConversationalPanel/NotesPanel). Dark: `karta-interview-dark.png` — czysto.

### NOTIFICATION — PASS (pełny wzorzec, poprawne bramkowanie flagą)
- **Wpięcie:** `NotificationDetailView.tsx:75` import `NOTIFICATION_CARD_SPEC`; flaga `VITE_VF1_NOTIFICATION_CARD_CONTRACT` / `?cardContract=1` (`:192-194`).
  ⚠️ `spec` przekazany do `useCardLayout` **bezwarunkowo** (`:2334`), ALE **wyjście bramkowane flagą**: `orderedNModeSections =
  enabled ? applyToSections(...) : surowe` (`:2341-2347`), initial/persist = no-op gdy OFF (`:2310/:2321`). → **OFF = zero regresji** (potwierdzone: OFF=3, ON=2).
- **Rdzeń:** picker — **„Co się dzieje" + „Oczekiwana akcja" bez „Usuń"** (oba `buttonCount=3`); deskryptor `rdzen=2`.
- **Węższy default:** ON = **2**; OFF = **3**; picker 3 wiersze (2 + 1 ukryta „Analiza AI"), „Rdzeń powiadomienia / Pełny". → 2 / 1.
- **Bramka:** struktura OK; crimson centrum **38 = baseline** (w tym „Usuń" = semantyka destrukcyjna). Runtime: 3 crimson w light, 0 w dark — **baseline** (te same ON i OFF).
- **Otwarta decyzja (poprawnie oznaczona):** `NOTIFICATION_ARTIFACT_TYPE` placeholder — „★ DO POTWIERDZENIA PIOTRA: dodać
  'notification' do `NModeArtifactType`" (`:200-205`).

### INSIGHT — PASS (mechanika wpięta; uwaga Phase-D)
- **Wpięcie:** `InsightViewer.tsx:140` import `INSIGHT_CARD_SPEC`; flaga `VITE_VF1_INSIGHT_CARD_CONTRACT` / `?cardContract=1` (`:160-162`);
  `spec: insightCardContractEnabled ? INSIGHT_CARD_SPEC : undefined` (`:1087`). Runtime dev-log potwierdza ON:
  `[insightCardContract] kontrakt ON — katalog 21 kart, Phase-D poza katalogiem (extras): 11`.
- **Rdzeń:** `rdzen=2`, egzekwowane **typem** (`rola:'rdzen' ⇒ core:true`, `insightCardContract.ts:659`). Picker grupowany
  (WGLĄD widoczne / MIĘDZY WIERSZAMI przekreślone). Zrzut `karta-insight-picker-sekcje.png`.
- **Węższy default:** **spec** `default = rdzeń + domyślna = 10 kart` (`buildInsightCardSpec:673-678`), full = 21.
  **UWAGA:** 11 sekcji Phase-D (`do-decyzji-piotra`) renderuje się jako **„extras" zawsze** (poza katalogiem, `useCardLayout`),
  więc netto widocznych ~20 — **zwężenie nie jest w pełni widoczne na ekranie**, dopóki nie zapadnie dedup Phase-D
  (druga tura D-1/2/3 — świadomie POZA tą falą). Mechanika obecna, efekt netto ograniczony. Świadomie udokumentowane w deskryptorze.
- **Bramka:** struktura OK (panel z `evidence` = ŹRÓDŁA I ZAŁOŻENIA, kolejność kanoniczna); crimson centrum **0**.

### INITIATIVE — CZĘŚCIOWE (rdzeń chroniony; zwężenie + picker NIEWPIĘTE)
- **Wpięcie:** `InitiativeDocumentView.tsx:734` `isInitiativeCardContractEnabled()`; flaga **INNY klucz** `?ff_initiativeCardContract=1`
  (`initiativeCardContract.ts:687`). Import w view: **tylko `INITIATIVE_CORE_BOARD_IDS`** (`:205`).
- **Rdzeń:** WPIĘTE i WIDOCZNE — sekcja **„Zakres inicjatywy" z odznaką „RDZEŃ"**, chroniona przed ukryciem w pickerze
  (`:10730-10732`: `isCore = enabled && INITIATIVE_CORE_BOARD_IDS.has(s.id)` ⇒ `isVisible = isCore || !hidden`). Zrzut `karta-initiative-picker-sekcje.png`.
- **Węższy default — CZĘŚCIOWE / NIEWPIĘTE:** `INITIATIVE_MINIMAL_VISIBLE` (default-7) i `buildInitiativeCardSets` (picker „Rdzeń/Pełny")
  **zdefiniowane w deskryptorze, ale NIE importowane/nieużyte** w view; ścieżka registry zwraca współdzielony
  `DEFAULT_VISIBLE_SECTIONS` (`:2135`), nie minimal. Runtime: **ON == OFF == 24** widoczne sekcje (flaga nie zwęża boardu).
  Deskryptor sam to nazywa: „do przyszłego ziarna", „★ DO POTWIERDZENIA PIOTRA", picker = „krok silnika". Zgodne z oczekiwanym „czesciowe".
- **Bramka:** struktura OK (jedyny z pełnym `evidence` w kolejności kanonicznej); crimson centrum **13 = baseline**.

---

## 3. BRAMKA STRUKTURALNA — pełny wynik + baseline crimson

`node scripts/check-artefakt-struktura.mjs` (tryb raportu). **Struktura (Menu1/panel/kolejność): PASS dla wszystkich —
zero inwersji, zero brakującego panelu.** „FLAGA" wynika WYŁĄCZNIE z pre-existing crimson w centrum (dług sprzed migracji).

| Artefakt | Struktura | Crimson centrum (HEAD) | Crimson centrum (baseline `1f0a3eff3c`) | Δ |
|---|:---:|:---:|:---:|:---:|
| Task | OK | 11 | 11 | **0** |
| Tool | OK | 28 | 28 | **0** |
| Interview | OK | 2 | 2 | **0** |
| Notification | OK | 38 | 38 | **0** |
| Insight | OK | 0 | 0 | **0** |
| Initiative | OK | 13 | 13 | **0** |

**Crimson = baseline, ZERO wzrostu z żadnej z 6 migracji.** Potwierdzenie potrójne: (a) 6 deskryptorów ma **0** tokenów crimson,
(b) 6 diffów migracji dodało **0** linii crimson, (c) gate na commicie przed migracjami = te same liczby. Sweep crimsona = OSOBNY etap (decyzja 07-08) — poza tą falą.

---

## 4. LISTA FAIL (do naprawy)

**Brak twardych FAIL-i (regresji).** Render czysty 6/6 w light i dark; struktura PASS 6/6; crimson bez wzrostu 6/6.
Poniżej ustalenia wymagające decyzji/wpięcia (nie regresje):

1. **Tool — deskryptor niewpięty (orphan).** `toolCards.contract.ts` nie jest importowany w `src`; kontrakt nie rządzi
   renderem Tool. Wg przepisu Tool nie ma systemu kart (klasa S), więc brak pickera jest projektowy, ale „wiążący" aspekt
   kontraktu na Tool nie jest egzekwowany. **DO POTWIERDZENIA PIOTRA:** deklaratywnie zostawić czy wpiąć jako źródło sekcji.
2. **Harness (nie migracja):** `[OrgContext] orgs.find is not a function` (`OrgContext.tsx:50`) na task/interview/notification —
   mock `/organizations/current` oddaje zły kształt. Pre-existing, nie boundary, nie blokuje renderu. Drobiazg do sprzątnięcia harnessu.

## 5. LISTA „CZĘŚCIOWE"

1. **Initiative — węższy default + picker „Rdzeń/Pełny" NIEWPIĘTE.** Rdzeń chroniony i widoczny (odznaka RDZEŃ), ale
   `INITIATIVE_MINIMAL_VISIBLE` / `buildInitiativeCardSets` zdefiniowane a nieużyte; `ON == OFF == 24` widoczne. Zgodne z opisem
   „krok silnika / do przyszłego ziarna". Domknięcie = osobny krok (silnik boardu).
2. **Insight — zwężenie widoczne tylko częściowo.** Spec `default=10/21`, ale 11 sekcji Phase-D renderuje się jako „extras"
   zawsze → netto ~20 widocznych. Pełne zwężenie po dedupie Phase-D (druga tura D-1/2/3).
3. **Tool — migracja deklaratywna** (patrz FAIL #1) — deskryptor bez konsumenta runtime.

---

## 6. ZRZUTY (w tym folderze)

`karta-<nazwa>-light.png` i `-dark.png` dla 6 artefaktów (12). Pickery: `karta-{task,interview,notification}-picker-{sekcje,nowa}.png`,
`karta-{insight,initiative}-picker-sekcje.png`. Wszystkie: Chromium 1440×900 @2x, harness `?cardContract=1`
(Initiative `?ff_initiativeCardContract=1`), `lang=pl`.

> **Następny krok (nie w tym odbiorze):** pokaz batcha Piotrowi na tych zrzutach → akcept → dopiero wtedy promocja na demo
> (skill `consultify-promocja-demo`; flaga default OFF do akceptu). Piotr NIE jest pierwszym testerem wizualnym (reguła #7 — spełniona).
