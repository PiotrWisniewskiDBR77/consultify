# ODBIÓR — niezależny przebieg DoD §18.1 dla 7 kart N (po fazach 1-2)

> **Data:** 2026-07-22 · **Gałąź:** `fix/prv-mywork-preview` (baza `origin/demo`, worktree `.worktrees/prv-mywork`)
> **Charakter:** niezależny odbiór wzrokowy. Nie ufałem raportom poprzednich agentów — zmierzyłem sam.
> **Metoda:** playwright w **izolowanej przeglądarce** (odporność na równoległą sesję sterującą tabem —
> ryzyko opisane w `_ANALIZA_MENU1_KART_N_2026-07-22.md §0`), viewport **1280×832** (kanon desktop ≥1280),
> `deviceScaleFactor=2`. Każdy pomiar asercjonuje `location.href` w tym samym wywołaniu. Kolory jako `rgb()`,
> wymiary w px. Zrzuty: 14 plików PNG w tym folderze (7 kart × light+dark).
> **Skrypty pomiarowe** (nie commitowane): `scratchpad/capture-karty-n.mjs` (14 zrzutów + pomiary + konsola),
> `scratchpad/scan-crimson-bar.mjs` (skan crimson w nagłówku + kebab), `scratchpad/scan-mode.mjs` (tryb otwarcia),
> `scratchpad/scan-interview-red.mjs` (pomiar crimson w Interview).

---

## 1. Werdykt w jednym zdaniu

**Menu 1 (pasek nagłówka) przeszedł czysto na WSZYSTKICH 7 kartach w OBU motywach** — decyzje Piotra
D-A…D-D są zaimplementowane i zmierzone (jeden primary, status-etykieta, wskaźnik-tekst, kod+permalink
w kebabie, tytuł z wielokropkiem, zero crimson, zero surowych kluczy, zero crash) — **ale pełne DoD §18.1
(nie tylko Menu 1) łapie 3 wady w CENTRUM kart, których `check-artefakt.sh` nie widzi**: crimson jako
zaznaczenie/„Rekomendowane" w selektorze trybu Interview (pomiar `rgb(133,24,47)` = #85182F), zduplikowane
klucze React na Insight i nakładające się karty akcji Insight ucinane w połowie słowa.

---

## 2. Tabela — 7 kart × DoD (Menu 1), PASS/FAIL z dowodem

Legenda: **✅ PASS** · **❌ FAIL** · pomiar identyczny w light i dark, chyba że zaznaczono.

| DoD (Menu 1 / decyzje Piotra) | Tool | Notification | Interview | Decision | Insight | Task | Initiative |
|---|---|---|---|---|---|---|---|
| **Dokładnie 1 primary** (solid filled) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Status = etykieta-pigułka** (nie kropka), token c-* | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Wskaźnik zapisu = TEKST** (nie przycisk) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Kod+permalink w KEBABIE** (nie na pasku) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tytuł z wielokropkiem** (truncate) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Pasek: chip zniknął, brak 77px** (cel 48-62) | ✅ 60 | ✅ 60 | ✅ 62 | ✅ 62 | ✅ 60 | ✅ 62 | ✅ 60 |
| **Zero surowych kluczy i18n** (Menu 1) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Zero crash / ReferenceError** (render) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Zero crimson w Menu 1** (klasa + pomiar) | ✅ 0 | ✅ 0 | ✅ 0 | ✅ 0 | ✅ 0 | ✅ 0 | ✅ 0 |
| **Tryb otwarcia wg D-A** | ✅ RO | ✅ Edycja | ✅ Edycja | ✅ Edycja | ⚠️ Podgląd | ✅ Edycja | ⚠️ Podgląd |
| **DoD §18.1 poza Menu 1** (crimson/keys/layout w centrum) | ✅ | ✅ | ❌ crimson | ✅ | ❌ keys+layout | ✅ | ✅ |

### Dowody kluczowe (pomiar)

**1 primary (solid navy light `rgb(15,23,42)` / light-on-dark `rgb(244,247,251)`, h36):**
Tool „Startuj sesję" w138 · Notification „Otwórz dokument" w174 · Interview „Zakończ wywiad" w165 ·
Decision „Zatwierdź decyzję" w177 · Insight „Konwertuj na inicjatywę" w211 · Task „Wyślij do przeglądu" w185 ·
Initiative „Oznacz jako ukończone" w211. **Wszystkie 7 mają dokładnie jeden.** Przycisk „AI" na
Interview/Decision/Task to `c-surface-raised` (`rgb(248,250,252)` light / `rgb(21,33,59)` dark) z obwódką —
powierzchnia, nie filled-CTA (klasyfikacja jak `_ANALIZA §5`). **Naprawione względem analizy:** Interview
(było 0 — D11), Task (było 0 przy `readMode` — D12), Initiative (było 0 w harnessie).

**Status = etykieta z tekstem, token c-\*, dokładnie jedna w pasku** (pomiar scoped do paska):
Tool „Aktywne" (success, `fg rgb(2,104,51)` light) · Notification „Nowe" (info) · Interview „W trakcie" (info) ·
Decision „Oczekująca" (info) · Insight „W recenzji" (info) · Task „W trakcie" (info) · Initiative „W realizacji" (success).
Dark: success `rgb(63,185,80)`, info `rgb(88,166,255)`. **Żadna naga kropka** (D3/D4/D5 naprawione).

**Wskaźnik zapisu:** na wszystkich 7 to `<span>` „Zapisano", `clickable=false`, wewnątrz paska (D-C/D7 naprawione).

**Kebab (D-D):** wszystkie 7 mają `⋮` z dokładnie: **„Skopiuj kod obiektu" + „Kopiuj link"**. Na pasku
**0** przycisków kodu/permalinku (`linkBtnsOnBar=0`), `codeChipOnBar=false` (D2/D9 naprawione).

**Zero crimson w Menu 1:** skan całego nagłówka (klasa `primary-\d` ORAZ pomiar `getComputedStyle`
bg/color/border = `rgb(133,24,47)`) → **0 trafień na każdej z 7 kart**. Stary `ArtifactPermalinkButton`
z `hover:text-primary-400` już się nie renderuje na pasku.

**Tytuł z wielokropkiem (D6):** widoczne „…" na zrzutach Notification/Interview/Decision/Insight/Task
(tytuł jako `truncate` tekst w spoczynku, input dopiero po kliknięciu). Tool/Initiative — tytuł krótki, mieści się.

---

## 3. `bash scripts/check-artefakt.sh --report` — wynik

```
✓ check-artefakt: brak nowych naruszeń crimson w powłoce artefaktów (aktualnie 5, baseline 17 — dług nie rośnie)
── Karty N (SPEC-N §5B) — tryb RAPORTU: wypisuję, nie blokuję ──
  NotificationDetailView.tsx  ⚠ R1 solid/filled CTA poza slotem primary — 1  (L2288)
  TaskDetailView.tsx          ⚠ R1 solid/filled CTA poza slotem primary — 1  (L6247)
  Razem: R1 (ostrzeżenia) 2 · R2+R3 (blokujące w strict) 0
```

**Interpretacja (zweryfikowana, nie przepisana):**
- **Crimson powłoki: PASS.** „Aktualnie 5" to **5 fałszywych trafień — wszystkie to KOMENTARZE** w kodzie
  zawierające słowo „primary-" w prozie (`NModeCardState.tsx:21`, `NModeCardManager.tsx:14`,
  `NModeSectionWrapper.tsx:104`, `NModeActionBar.tsx:37`, `ExecutiveModuleShell/TopBar.tsx:122` — np.
  „żadnych klas `primary-*`", „CRIMSON-SAFE: zero `primary-*`"). **Realnych użyć klasy crimson w powłoce = 0.**
  Dług spadł 17→5 (same komentarze), nie rośnie.
- **R1 (2 ostrzeżenia):** Notification L2288 („Analizuj z AI" — na zrzucie **obwódkowy teal, nie solid crimson**),
  Task L6247. Ostrzeżenie do oceny okiem — wizualnie nie konkurują z primary. Akceptowalne (`_ANALIZA §5`).
- **R2 (createPortal) + R3 (zarezerwowane id sekcji): 0.** ✅
- **★ LUKA BEZPIECZNIKA:** `check-artefakt.sh` **NIE obejmuje** `RuntimeModeSelector.tsx` ani centrum
  Interview/Insight — dlatego crimson w selektorze trybu Interview (§4 FAIL-1) przechodzi skrypt, a łapie go
  dopiero oko. Skrypt sprawdza `list_scope_files` (tylko powłoka) + literalne `bg-c-accent` (nie łapie
  `bg-[var(--c-accent-soft)]` / `ring-c-accent/40`).

---

## 4. Lista FAIL — do naprawy

### FAIL-1 · Interview — crimson jako ZAZNACZENIE + badge „Rekomendowane" (DoD §18.1 „zero crimson na selection/badge")
**Gdzie:** `src/components/Interview/RuntimeModeSelector.tsx` — centrum karty Interview (selektor „Wybierz tryb wywiadu").
**Dowód (pomiar, light):** 16 elementów renderuje `rgb(133,24,47)` = **#85182F (Harvard Crimson)**:
- L144 karta zaznaczona: `bg-[var(--c-accent-soft)] ring-1 ring-c-accent/40` → tło `rgba(133,24,47,0.08)`
- L149 badge „Rekomendowane": `bg-[var(--c-accent-soft)] text-[var(--c-accent)]` → tekst `rgb(133,24,47)`
- L158 ikona zaznaczona: `text-[var(--c-accent)]`
- L175 kółko-checkmark zaznaczone: `border-[var(--c-accent)] bg-[var(--c-accent)]`

`--c-accent` = crimson. Widać na zrzucie `karta-interview-dark.png`: środkowa karta „Tryb listy zadań"
maroon + czerwony checkmark, „Rekomendowane" czerwonym tekstem. **Nie łapie tego `check-artefakt.sh`** (§3).
**Naprawa:** zaznaczenie → neutralne (`c-surface-raised`/`c-border` + `ring-c-focus`), badge „Rekomendowane" → `c-info`.
**Zakres:** centrum archetypu (nie powłoka Menu 1). Najpewniej dług sprzed faz 1-2, **nie regresja tych zmian** —
ale to twardy FAIL DoD §18.1 dla karty Interview.

### FAIL-2 · Insight — zduplikowane klucze React (console) + 3 identyczne pozycje POWIĄZANIA
**Gdzie:** centrum/panel karty Insight (`InsightViewer.tsx`).
**Dowód:** konsola przy renderze `karta-insight` (light i dark) — **4× „Encountered two children with the same key"**.
Na zrzucie `karta-insight-light.png` panel POWIĄZANIA pokazuje 3× identyczny wpis „Wywiad diagnostyczny —
robotyzacja spraw…". Zgodne z `_WERDYKT §3` („dwie różne sekcje wyświetlają ten sam tekst"). Duplikat kluczy
może **dublować/gubić** dzieci przy update. **FAIL (jakość/konsola).**

### FAIL-3 · Insight — karty „DZIAŁANIA W APLIKACJI" nakładają się i ucinają tekst w połowie słowa
**Gdzie:** centrum karty Insight, wiersz kart akcji (Utwórz raport/prezentację/tabelę/ideę/notatkę/inicjatywę).
**Dowód:** zrzut `karta-insight-light.png` @1280px — karty zachodzą na siebie, etykiety ucięte:
„Utwór raport", „Utwór preze", „Utwór tabele", „Utwór ideę", „Utwór notat". **FAIL (layout @desktop 1280).**
Zakres: centrum archetypu, nie Menu 1.

---

## 5. Obserwacje TREŚCI / i18n — poza Menu 1 (nie blokują Menu 1; znane z `_WERDYKT`)

Widoczne na zrzutach, ale to CENTRUM/panel, nie pasek nagłówka; w większości znane, nie są regresją faz 1-2:
- **Notification** (`karta-notification-light.png`): panel prawy „**AI RISK DETECTED**" (surowy angielski, wersaliki)
  + „Utworzono **1 dni temu**" (liczba mnoga; powinno „1 dzień temu"). Regex kluczy i18n tego nie łapie (to surowa
  wartość enuma, nie klucz z kropką).
- **Decision** i **Insight**: panel prawy „**Submit for review**" (surowy angielski; PL: „Wyślij do recenzji").
- **Task** (`karta-task-light.png`): pasek „**Created from decision** · Pokaż źródło" (surowy angielski; PL: „Utworzono z decyzji").
- **Systemowo:** `--c-accent` = crimson pojawia się też jako DEKORACJA treści (czerwone punktory na karcie Tool
  „CO TO NARZĘDZIE ROBI", różowo-crimsonowa karta „Utwórz prezentację" na Insight). Punktory/dekoracje nie są
  wymienione wprost w klauzuli DoD (fokus/status/badge/selection), więc miększe niż FAIL-1 — ale to ten sam token.

---

## 6. Szum ŚRODOWISKA HARNESSU — NIE defekty kart

- Konsola: „**[OrgContext] Error fetching orgs: TypeError: orgs.find is not a function**"
  (Notification/Interview/Decision/Task) oraz „**[NotificationDetailView] Analyze with AI failed: AI returned no
  JSON**". To skutek **podmiany warstwy sieciowej przez harness** (`orgs` nie-tablica, AI-stub bez JSON) —
  **nie ReferenceError, nie crash, render czysty**. Nie są regresją kart.
- **Trwałość zapisu niemierzalna z harnessu** (podmienia fetch). Zarzut z `_WERDYKT §3.1` „Notification gubi
  wpisaną treść, pokazując »Zapisano«" to **mechanika/persistencja** — z tego harnessu **nie da się jej
  potwierdzić ani obalić**. Do sprawdzenia na żywej bazie. Wskaźnik „Zapisano" jest teraz tekstem (D-C), więc
  jeśli persistencja padnie, komunikat i tak wprowadzi w błąd — ale to osobny, mechaniczny wątek.

---

## 7. Do decyzji Piotra

1. **Wysokość paska: 60-62px czy kanoniczne 48px?** Chip zniknął, 77px zniknęło (cel „bliżej 48-62" spełniony),
   ale `py-3` w `NModeHeader.tsx:270` trzyma 60-62. Zejście do 48 zmienia WSZYSTKIE 7 kart naraz →
   wymaga zrzutów przed akceptem (CLAUDE.md #7). Zostawić 60-62 czy dobić do 48?
2. **Token `c-info` — inny odcień w light vs dark.** Etykiety „Nowe/Oczekująca/W recenzji/W trakcie" w light
   są **głębokim indygo** `rgb(59,40,131)`, w dark **niebieskie** `rgb(88,166,255)`. To token (nie błąd karty),
   ale „info" wygląda fioletowo w light, niebiesko w dark. Ujednolicić odcień?
3. **Tryb otwarcia stanów pośrednich.** Reguła D-A: szkic→Edycja, zatwierdzona→Podgląd. Zmierzone: **Insight
   „W recenzji" (in_review) → Podgląd** i **Initiative „W realizacji" (EXECUTING) → Podgląd**. Obronne
   („completed/executing = gotowe → Podgląd"), ale „W recenzji" da się czytać też jako „jeszcze nie
   zatwierdzone → Edycja". Potwierdzić mapowanie tych dwóch stanów.
4. **Interview crimson (FAIL-1)** — potwierdzić kierunek naprawy: zaznaczenie → neutralne + `c-focus`,
   „Rekomendowane" → `c-info`. I czy rozszerzyć `check-artefakt.sh` na `RuntimeModeSelector`/centrum kart
   (dziś luka — §3).

---

## 8. Czego NIE zweryfikowałem (granice tego odbioru)

- **Trwałość zapisu** — harness omija serwer (§6). Nie mierzalna.
- **Wersja `lang=en`** — cały przebieg na `lang=pl` (krótsze etykiety EN mogą zmieniać ciasnotę paska; ale
  chip i tak zszedł do kebaba, więc ryzyko małe).
- **Pełny cykl Tab/Shift+Tab i Esc przez powłokę** (DoD §18.1 klawiatura) — nie przeszedłem klawiaturą;
  sprawdzone tylko obecność `focus-visible:ring-c-focus` w kodzie nagłówka.
- **Interakcje** (otwarcie kebaba zmierzone — 2 pozycje; ale klik „Kopiuj link"/„Skopiuj kod" nie testowany
  end-to-end, bo `navigator.clipboard` w harnessie).
- **Karty dziedziczące** (KPI/RAID/Milestone…) — poza tą siódemką.
- **Stany inne niż spoczynkowy** wskaźnika zapisu (`saving`/`dirty`/`error`) — zmierzony tylko `saved`
  („Zapisano") na wszystkich; logikę `error→text-c-danger` odczytałem z `NModeHeader.tsx:337`, nie z runtime.

---

## 9. Zrzuty (14) — w tym folderze

`karta-{tool,notification,interview,decision,insight,task,initiative}-{light,dark}.png`
Viewport 1280×832, DPR 2. Każdy z asercją URL. Czyste (zero „Coś poszło nie tak", zero ReferenceError,
zero surowych kluczy i18n w Menu 1).
