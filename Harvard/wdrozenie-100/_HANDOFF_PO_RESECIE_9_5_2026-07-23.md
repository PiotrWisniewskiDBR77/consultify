# HANDOFF PO RESECIE — droga do 9,5 (artefakty N)

> **CZYTAJ TO PIERWSZE.** Po resecie kontekstu to jest jedyne źródło prawdy. Wszystko inne to szczegóły.
> Kontekst poprzedniej sesji wyczerpał się przy 96%. Stan poniżej jest zweryfikowany, nie zakładany.

---

## 0. GDZIE JESTEŚMY (2026-07-23, rano)

| | |
|---|---|
| **Gałąź robocza** | `fix/prv-mywork-preview`, worktree `.worktrees/prv-mywork` (baza origin/demo) |
| **Ahead demo** | **13 commitów** — gotowe, esbuild PASS, **czekają render-odbioru + akceptu Piotra** |
| **LIVE na demo** | sweep crimson · properties std · ikona-typ M1 · i18n B5 (tag `demo-safe-2026-07-22`) |
| **Średnia** | **8,0** (było 6,8) · cel **9,5** |
| **Matryca** | `https://claude.ai/code/artifact/4d9ae7a6-5252-4be7-8341-ff52d0dbda8d` (aktualna) |

### Wyniki per artefakt (po nocy)
| Oś | Decision | Task | Interview | Notif | Insight | Tool | Initiative | śr. |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Menu | 9 | 8 | 9 | 8 | 8 | 9 | 8 | 8,4 |
| Nawigacja | 8 | 8 | 7 | 8 | 8 | 9 | 8 | 8,0 |
| Funkcja | 8 | 7 | 8 | 8 | 8 | 8 | 6 | 7,6 |
| Merytoryka | 7 | 8 | 6 | 7 | 6 | 7 | 7 | 6,9 |
| Grafika | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9,0 |
| **śr.** | 8,2 | 8,0 | 7,8 | 8,0 | 7,8 | 8,4 | 7,6 | **8,0** |

---

## 0b. RENDER-ODBIÓR FAZY A — WYKONANY (2026-07-23)

Przeskanowane **7 kart × light + dark = 14 kombinacji** (harness 3220, realny render, computed style):

| Sprawdzane | Wynik |
|---|---|
| crimson `rgb(133,24,47)` w centrum | **0 / 14** |
| tabela właściwości (`ArtifactPropertiesTable`) | **obecna 14 / 14** |
| błąd renderu / pusty ekran | **0 / 14** |
| tekst o kontraście < 45 (zbladły po sweepie) | **0 / 14** |
| powiązania w prawym panelu | `<button>`, cursor pointer, klik odpala realną nawigację (nie martwy) |

**Znaleziony i naprawiony 1 realny FAIL** (`a01b342f9b`): brak globalnego `color-scheme` →
w dark rozwinięty natywny `<select>` (m.in. w tabeli właściwości) renderował jasny tekst na
**białym** popupie systemowym. Po fixie tło popupu `rgb(255,255,255)` → `rgb(59,59,59)`.
Zasięg: cała aplikacja (popupy, scrollbary, date picker), nie tylko karty N.

★ **Pułapka zrzutów:** karty mają animację wejścia (opacity 0.18 → 1). Zrzut zrobiony od razu po
nawigacji łapie mid-fade i wygląda na „wyblakły ekran". Przed zrzutem odbiorowym **odczekaj ~5 s**
albo sprawdź `document.getAnimations().filter(a=>a.playState==='running')`.

Pre-flight merge z `origin/demo` (244 commity do przodu): **0 konfliktów**.

---

## 1. ★ METODA ODBIORU (to jest odpowiedź na „jak Piotr ma to zatwierdzać")

Problem: nie da się kazać właścicielowi oglądać 50 zrzutów. Rozwiązanie — **dwie ścieżki, zależnie od typu zmiany.**

### ŚCIEŻKA A — zmiany WIZUALNE (kod/UI) → „PARTIA × 3 ZRZUTY × CHECKLIST"
1. Grupuję pracę w **PARTIĘ** tematyczną (5–15 commitów, jedna historia: „sweep koloru", „powiązania klikalne").
2. **JA renderuję i oglądam WSZYSTKO sam** (reguła #7 — Piotr nigdy nie jest pierwszym testerem). Naprawiam FAIL-e.
3. Piotrowi pokazuję **dokładnie 3 zrzuty**: (a) najbardziej ryzykowny ekran, (b) typowy, (c) dark mode.
4. Do tego **checklist 3–5 punktów** — konkretne pytania „czy widzisz X" (nie „czy ładne").
5. Piotr mówi **TAK / POPRAW <co> / NIE**. Czas: ~2 min na partię.
6. Po TAK → promocja partii (skill `consultify-promocja-demo`) → re-tag `demo-safe`.

### ŚCIEŻKA B — zmiany TREŚCI (prompty AI, to co pisze Teresa) → „PRZED/PO NA PRZYKŁADACH"
1. **Zero zrzutów** — treść ocenia się czytając, nie oglądając.
2. Pokazuję **tabelę 3 przykładów**: karta · PRZED (dzisiejsza treść) · PO (nowa).
3. Piotr ocenia **poziom jakości** jedną decyzją: „ten poziom" / „za dużo szczegółu" / „inaczej".
4. Jedna decyzja odblokowuje **całą klasę dźwigni** (nie zatwierdza się promptów po jednym).
5. Dopiero po „tak" → wdrożenie w kod → potem ścieżka A dla efektu wizualnego, jeśli dotyczy.

**Zasada nadrzędna obu ścieżek:** Piotr zatwierdza **decyzje i poziom**, nie każdy plik. Ja odpowiadam za to, że w partii nie ma śmieci.

---

## 2. DROGA DO 9,5 — 4 fazy (kolejność ma znaczenie)

### FAZA A — domknij to, co gotowe (→ 8,0 LIVE) · dziś, ~1h
- **Render-odbiór 13 commitów**: 7 kart w harnessie (port 3220, `?screen=karta-<x>&cardContract=1&lang=pl&theme=light|dark`), light+dark. Sweep dotknął setek klas — **szukaj: zbladłe teksty, niewidoczne obramowania, zgubiona semantyka (Usuń=czerwony, done=zielony), dark mode**.
- Partia 1 „Sweep koloru G3 + N2 powiązania + Insight dedup" → 3 zrzuty + checklist → akcept → promocja.
- **Efekt: 8,0 na żywym demo.**

### FAZA B — Merytoryka (→ ~9,0) · to jest główny skok
- Wejście: `_MERYTORYKA_PACZKA_AKCEPT_2026-07-23.md` (14 dźwigni, 3 przykłady przed/po, rekomendacja).
- Ścieżka B: Piotr ocenia poziom treści → jedna decyzja.
- Wdrożenie 4 krokami: (1) 4 deterministyczne (zero LLM), (2) tanie prompty, (3) **Insight „Consulting Readout" — największa dźwignia** (prompt już to umie, brakuje pola w schemacie V6), (4) mechanika backendu osobno.
- Dwa rozjazdy do decyzji: Interview `generateSummary` (kontrakt obiecuje AI, którego nie ma) · hard-gate 422 w `submitAssignment` (vs decyzja „próg = porada").

### FAZA C — Funkcja (→ ~9,3)
- **Initiative: 13/27 kart bez realnego generatora AI** (RACI, dziennik zmian, obsada strumieni, sugerowane zmiany = dziś toast-atrapa). To najniższa komórka w całej matrycy (6).
- Wzór działający: `taskSectionGenerationService.ts` / `decisionService.ts`.
- Ścieżka B (treść) + A (efekt).

### FAZA D — domknięcie do 9,5
- **DoD §18.1 przegląd** wszystkich 7 (light+dark, kebab, panel, stany) → Grafika/Nawigacja 9→9,5.
- `MyWork/shared/*` — **683 slate/navy** (renderuje się w LISTACH i D-mode legacy, nie w karcie N-mode). Osobny dług; podnosi spójność produktu.
- Progi treści per karta (decyzja Piotra: „porada") — wdrożyć jako miękkie podpowiedzi.

---

## 3. ZASADY NIENARUSZALNE (łamanie kosztowało tygodnie)
1. **Nic na demo bez akceptu Piotra na zrzutach.** Nawet pod presją celu/mandatu „dojedź do 9". Autonomicznie = praca na gałęzi.
2. **Piotr nigdy pierwszym testerem wizualnym** — ja renderuję, oglądam, naprawiam, dopiero potem pokazuję.
3. **Prompty = treść → akcept PRZED live** (persona globalna, dotyka każdego klienta).
4. **Demo święte**: merge nie force, twarda weryfikacja plików po merge (tylko nasze!), monitor gitSha, re-tag `demo-safe`.
5. **Weryfikuj realny runtime**, nie docy/flagi. „esbuild przeszedł" ≠ „działa".

## 4. PUŁAPKI (świeże, kosztowały czas)
- **i18n**: `t()` czyta z `public/locales/{pl,en}/translation.json` (HttpBackend), NIE z defaultValue → zmiana tekstu bez dograния JSON = martwy kod.
- **Demo bardzo aktywne** (inne sesje push co kilka min) → przed każdym push: `git fetch` + merge origin/demo + retry przy odrzuceniu.
- **Agenci padają** (ENOTFOUND/stall) **przed commitem** — ich robota zwykle jest POPRAWNA. Sprawdź `git status`, esbuild, diff → dokończ commitem. Nie zakładaj „padł = nic nie zrobił".
- **Harness**: limit ~5 dev-serwerów na folder; przy wielu agentach pada. Daj agentom fallback „esbuild+grep, max 2 próby".
- **N-mode vs D-mode**: karty za flagą `cardContract` renderują `shared/NModeSections/*`, NIE `MyWork/shared/*`. Sweep celuj właściwie.
- **check-artefakt.sh** omija centrum kart (crimson w centrum niewidoczny w CI).

## 5. PIERWSZY KROK PO RESECIE
```
cd .worktrees/prv-mywork && git log --oneline origin/demo..HEAD   # 13 commitów?
```
Potem: **render-odbiór 7 kart** (harness 3220, light+dark) → napraw FAIL-e → **3 zrzuty + checklist dla Piotra** → akcept → promocja (Faza A). Następnie Faza B.

**Notatki źródłowe:** `_NOCNA_PRACA_9_0_2026-07-23.md` (co zrobione nocą) · `_MERYTORYKA_PACZKA_AKCEPT_2026-07-23.md` (Faza B) · `_PLAN_9_5_ARTEFAKTY_N_2026-07-22.md` (rejestr zadań Z-0.1…Z-4.4) · `_MERYTORYKA_{INSIGHT,INTERVIEW,NOTIFICATION}_2026-07-22.md` (audyty).

---

## 6. ZMIANA METODY ODBIORU (2026-07-23, decyzja właściciela)

Zrzuty odpadają („nie damy rady tego zrobić obrazami"). Odbiór idzie przez **klikanie jednej strony**:
`http://localhost:3000/odbior.html`, worktree `.worktrees/odbior-hub` (gałąź `odbior/hub-2026-07-23`).

Scalone w hubie: **Karty N** (16 commitów) + **IDEE fala 6-10** (41 commitów, konflikt rejestru ekranów
rozwiązany) na bazie świeżego `origin/demo`. Pozostałe fronty (Agent+Vault, dorobki decyzji, Dokumenty)
**są już na demo** — 0 commitów ahead — więc hub pokazuje je z bazy.

Zasady i pułapki tej konstrukcji: `_PROTOKOL_ODBIORU_WSPOLNEGO_2026-07-23.md`.
Decyzja właściciela zapada **per obszar**, nie per plik.
