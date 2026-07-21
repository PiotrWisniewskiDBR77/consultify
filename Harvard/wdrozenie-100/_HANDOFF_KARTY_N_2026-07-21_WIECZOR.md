# HANDOFF — karty N, sesja 2026-07-21 (wieczór)

> **Dla następnej sesji.** Kontekst poprzedniej wyczerpał się przy ~99%.
> Czytaj w tej kolejności: ta strona → `_SPEC_N_KARTY_2026-07-21.md` → `_PLAN_WDROZENIA_KART_N_2026-07-21.md`.

---

## 1. GDZIE JESTEŚMY — stan na teraz

| | |
|---|---|
| **Gałąź robocza** | `fix/prv-mywork-preview` |
| **Worktree** | `.worktrees/prv-mywork` (WEWNĄTRZ repo — `/private/tmp` bywa czyszczone, straciliśmy tak worktree raz) |
| **Baza** | `origin/demo` |
| **Demo (żywe)** | `e677c2372c` — wszystko wypchnięte, **zero commitów zaległych** |
| **Harness** | `.claude/launch.json` → `harness-kart-n`, port 3220, `?screen=karta-<nazwa>&theme=dark\|light&lang=pl\|en` |

**Punkty cofnięcia:** `06cdc24c1f` (przed falą migracji) · `713428f0b4` (przed ujednoliceniem paneli).

**UWAGA — jest niezacommitowana zmiana** w `src/components/Initiatives/InitiativeDocumentView.tsx`:
neutralizacja chrome kontrolek w panelu Właściwości (opis w §4). esbuild przechodzi,
zweryfikowana wzrokiem w harnessie. **Do zacommitowania i wypchnięcia.**

---

## 2. CO ZOSTAŁO ZROBIONE (wszystko na demo)

**Fala F — fundament** (`70fd8ebe8d`)
- `StandardArtifactShell(.types).tsx` — typowana warstwa NAD `NModeShell` (NModeShell nietknięty).
  Nie skompiluje się: karta bez prawego panelu · bez primary · z sekcją `comments`/`history`/
  `activity-log` w lewej nawigacji · sekcja bez `aiContract` · `children`/`portalTarget`/
  `draftSavedLabel` (martwe typem). **Nigdy jeszcze nie zamontowana na żadnej karcie.**
- `NModeToolbar` + prop `overflowActions` (wzorzec z `PreviewActionBar`)
- `registry.ts` (7 kart) + `scripts/karty-n-smoke.mjs` (bramka strukturalna)
- `check-artefakt.sh` + 3 reguły SPEC-N §5B w **trybie raportu** (`--report`), nie blokady.
  `KARTY_N_STRICT=1` włącza blokadę — **fala Z ma to włączyć na stałe**

**Fala M — 7 migracji** (`809e3abe31`), 7 agentów równolegle, jeden na plik.
Bramka: naruszenia blokujące **10 → 0**, ostrzeżenia **16 → 3**.

**Ujednolicenie paneli** (`984421c842`) — tabela Właściwość/Wartość we wszystkich 7.

**Wcześniej tego wieczoru:** kanon preview §7.2/§7.3, warianty przycisków (skutek, nie ekran),
`PreviewActionBar.overflowActions`, bramka `sprawdz-zrodla.mjs`.

---

## 3. ★ CO PIOTR ZGŁOSIŁ, A CO NIE JEST DOMKNIĘTE

Ostatnia wiadomość: **„no niestety mamy dużo błędów jeszcze, zobacz jak wygląda wzór czyli
decyzje i taski"** + 4 zrzuty z demo (Initiative, Insight, Decision, Task).

**Wzorzec = Decision i Task.** Initiative i Insight mają odbiegać do nich, nie odwrotnie.

### 3.1 ZDIAGNOZOWANE I NAPRAWIONE (niezacommitowane)
**Initiative — wartości w panelu Właściwości renderowały się jako ciemne puste prostokąty.**
Przyczyna: `field.render()` pochodzi z POZIOMEGO paska właściwości (pełna szerokość, własne tło
i ramka); w wąskiej komórce panelu widać było tylko kropkę. Naprawa: opakowanie neutralizujące
chrome kontrolki (`[&_select]:bg-transparent` itd.) — **wartość czyta się jak tekst, ale
pozostaje edytowalna**. Zweryfikowane: „Szkic", „Narzędzia", „Wysoki" widoczne.

### 3.2 ZDIAGNOZOWANE, NIENAPRAWIONE — ★ ZACZNIJ TUTAJ
**Initiative: „Submit for Review" renderuje się DWA RAZY na jednym ekranie.**
- `:9949` — jako `primaryAction` nagłówka (Menu 1)
- `:10467` — drugi raz, w bloku nad panelem, ten sam `primaryLifecycleAction`
  + `handleStatusAction`
- `InitiativeDraftJourney` (`:10518`) to trzecie wejście w ten sam przepływ

Widać na zrzucie Piotra: biały „Submit for Review" w nagłówku i osobny „Submit for review"
pod chipem „Draft". Łamie SPEC-N §2.6 (anty-duplikacja). A1 opisał to jako „dublet lifecycle
primary vs `InitiativeDraftJourney.onAdvance`, widoczny tylko w DRAFT" — czyli znany, nienaprawiony.

**Rozstrzygnięcie do podjęcia:** który zostaje. Rekomendacja: **zostaje primary w nagłówku**
(spójne z Decision „Approve decision" i Insight „Convert to initiative”), a blok pod chipem
znika. `InitiativeDraftJourney` to prowadzenie po krokach — do oceny, czy zostaje.

### 3.3 NIEZWERYFIKOWANE — „dużo błędów" nie zostało w pełni rozpisane
Piotr powiedział „dużo", ja zdążyłem potwierdzić dwa. **Nie zakładaj, że to wszystko.**
Poproś go o listę albo przejdź 4 zrzuty punkt po punkcie.

Różnice widoczne na zrzutach, których NIE rozstrzygnąłem:
- sekcja AKCJE ma różną treść: Task „All actions live in the card header" · Insight „Actions
  … live in the header and toolbar" · Decision `Delegate`+`Share` · Initiative `Fork`+`Presentation mode`.
  Czy to uzasadniona różnica per karta, czy rozjazd?
- „Presentation mode" jako AKCJA w Initiative — wg SPEC-N §2.7 tryb prezentacji ma mieć własny
  slot, nie być akcją na rekordzie
- Insight ma 6. sekcję `SOURCES & ASSUMPTIONS`, Initiative `ŹRÓDŁA I ZAŁOŻENIA` — Decision i Task nie mają.
  To ZGODNE ze SPEC-N §4A (warstwa dowodowa tylko dla kart z treścią AI), ale warto potwierdzić z Piotrem

---

## 4. CO ŚWIADOMIE ZOSTAŁO POZA ZAKRESEM

| Rzecz | Decyzja | Gdzie |
|---|---|---|
| Martwy kod (~2500 linii: Task D-mode, Notification C-mode, Initiative legacy) | osobna fala PO migracjach (P3) | rejestr |
| Kontrakty treści (rubryki, progi) | wymaga redakcji Piotra | KT1/C8/DEC-010 |
| Subtasks w Task | nowa funkcja, nie migracja | nowe zgłoszenie |
| Taksonomia zakładek Initiative | zmiana treściowa | nowe zgłoszenie |
| Twarda bramka evidence (backend) | dziś tylko miękkie ostrzeżenie frontowe | nowe zgłoszenie |
| Adopcja `StandardArtifactShell` przez 7 kart | powłoka nieprzetestowana na żywym ekranie | **fala Z** |
| Panel poniżej 1024px | `ArtifactRightPanel` w `hidden lg:block`; pasek właściwości usunięty → na wąskim ekranie właściwości mogą nie być widoczne NIGDZIE | **do sprawdzenia** |

---

## 5. LEKCJE — nie powtarzaj tych błędów

1. **„esbuild przeszedł" ≠ działa.** Dziś 2 z 8 ekranów z zielonym esbuildem wywaliły się
   w przeglądarce. **Otwórz kartę w harnessie po KAŻDEJ zmianie.**
2. **Raport agenta nie jest dowodem.** 7 agentów zgłosiło sukces; wzrokiem znalazłem
   13 przypadków `useMemo`/`useCallback` wołających `t()` **bez `t` w zależnościach** —
   tłumaczenia ładują się async, memo zwraca surowy klucz i nigdy się nie przelicza.
   Objaw: `interview.workspace.noReview` na ekranie. **Klucz ISTNIAŁ w JSON** — więc ani
   lektura kodu, ani dopisanie tłumaczeń tego nie naprawiały. Naprawione 13/13.
3. **Sprawdź, czy cytowane dokumenty istnieją w TYM worktree.** Kazałem 7 agentom czytać
   `_ANALIZA_A1_INWENTARZ_KART_N.md`, którego na gałęzi nie było. To ta sama pułapka, którą
   rano wykryła `sprawdz-zrodla.mjs` w 5 skillach. Uruchom ją przed wypuszczeniem agentów.
4. **Numery linii czytaj z `origin/demo`**, nie z głównego checkoutu (`oxford/oc2-merge` jest
   ~2000 commitów za demo — te same pliki mają inne linie).
5. **Nie czytaj dokumentu wyrywkowo.** Oceniłem 741-linijkowy plan po nagłówkach i orzekłem
   „tego nie ma", a sekcja KT odpowiadała wprost na pytanie Piotra sprzed dnia.
6. **Agenci nie mogą pisać w te same pliki.** 7 równoległych pisało w oba `translation.json` —
   przeszło (append-only), ale sprawdź `python3 -m json.tool` po każdej fali.
7. **Dozbrajaj istniejący komponent, nie buduj od zera.** `PreviewActionBar` był już wspólny
   dla 11 modułów — brakowało mu JEDNEJ zdolności (overflow), przez co dwa ekrany napisały
   własne „…" ręcznie tego samego wieczoru.

---

## 6. NASTĘPNE KROKI — kolejność

1. **Zacommituj i wypchnij** niezacommitowaną naprawę Initiative (§1)
2. **Napraw dublet „Submit for Review"** w Initiative (§3.2) — najkonkretniejszy znany błąd
3. **Dopytaj Piotra o pełną listę** „dużo błędów" (§3.3) — nie zgaduj
4. Sprawdź panel na wąskim ekranie (§4)
5. Dopiero potem: fala Z (adopcja powłoki + `KARTY_N_STRICT=1`)

**Tryb pracy ustalony z Piotrem:** wypychamy na demo partiami, on weryfikuje na żywym demo,
zgłasza zrzutami. Nie czekamy na akcept przed pushem — ale KAŻDA zmiana wizualna musi być
wcześniej obejrzana przeze mnie w harnessie.

---

*Zapisane przy wyczerpaniu kontekstu. Wszystkie fakty zweryfikowane w tej sesji; tam gdzie
czegoś nie sprawdziłem, jest to napisane wprost.*
