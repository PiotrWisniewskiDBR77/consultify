# HANDOFF — Program „wiążący kontrakt karty" (2026-07-22)

> **Dla następcy w nowej sesji.** Kontekst poprzedniej sesji się wyczerpał w połowie migracji.
> Czytaj TĘ stronę pierwszą, potem dokumenty wskazane niżej. Wszystkie fakty zweryfikowane w sesji;
> gdzie czegoś nie sprawdziłem — napisane wprost.

---

## 0. STAN NA TERAZ (2026-07-22, koniec sesji)

| | |
|---|---|
| **Gałąź robocza** | `fix/prv-mywork-preview` |
| **Worktree** | `.worktrees/prv-mywork` (WEWNĄTRZ repo — nie w /private/tmp, bywa czyszczone) |
| **Baza** | `origin/demo` |
| **Demo (żywe)** | `533d353896` (health: `curl -s https://demo.consultify.ai/api/health` → gitSha) |
| **Gałąź ahead demo** | ~10 commitów (POC Decision + 5 migracji + docs) — NIE na demo, ZA FLAGĄ |
| **Tag bezpieczeństwa** | `demo-safe-2026-07-22` (ostatni stan zaakceptowany przez Piotra) |
| **Harness** | `.claude/launch.json` → port 3220, `?screen=karta-<nazwa>&theme=dark\|light&lang=pl` |
| **Flaga wyglądu** | `?cardContract=1` włącza nowy kontrakt (default OFF do akceptu Piotra) |

**★ FLOTA W TOKU przy końcu sesji:** `wgayit5k8` (armia migracji 6 artefaktów). Zdążyła zacommitować
5 migracji (Tool·Task·Notification·Interview·Insight). **Initiative (najtrudniejszy) + niezależny odbiór
ze zrzutami jeszcze pracowały.** PIERWSZY KROK NASTĘPCY: sprawdź wynik tej floty (git log + folder
`_ODBIOR_MIGRACJI_6_2026-07-22/`), zanim cokolwiek zaczniesz.

---

## 1. CO TO ZA PROGRAM (nomenklatura ustalona z Piotrem 07-22)

- **ARTEFAKT** = obiekt-ekran + wspólna powłoka (Menu 1, prawy panel, kebab, stany). Jest ich **7**:
  Decyzja · Task · Inicjatywa · Insight · Interview · Tool · Notification.
- **KARTA** = SEKCJA WEWNĄTRZ artefaktu, gdzie AI pisze treść. Łącznie **100 kart** w 7 artefaktach
  (Initiative 29, Insight 32, Task 10, Decision 8, Interview 8, Notification 7, Tool 6).
- **TUL/narzędzie** = osobny warsztat (SWOT, Mind Map…) — wzorzec W, POZA tym programem (Piotr robi je
  w osobnych sesjach — patrz §7).
- ⚠️ Stare dokumenty mówią „karta N" na to, co jest ARTEFAKTEM — błąd słownika. Trzymaj się powyższego.

**Problem, który program rozwiązuje** (audyt `_AUDYT_ARCHITEKTURY_ARTEFAKTOW_2026-07-22.md`):
architektura kart jest OPISANA, ale NIE WIĄŻĄCA. Kontrakt karty rozsiany po 5 miejscach, cztery różne
systemy kompozycji na 7 artefaktów, Initiative ma własny silnik i rozjeżdża się z resztą z definicji.
Sam kod nazywa sedno: *„StandardTable nie da się obejść, a NModeShell — da się, i obchodzi go 8/8."*

---

## 2. DECYZJE PIOTRA — ZABLOKOWANE (buduj do nich, nie re-litiguj)

- **D-7 SYSTEM:** JEDEN kanon, WYPRACOWANY best-of. Piotr: „weź najlepsze z Decyzji/Tasków (już wyglądają
  dobrze) + najlepsze z Inicjatyw, stwórz jeden kanon." → NIE „cardSets kasuje Initiative". Nadzbiór.
- **D-8 EGZEKWOWANIE:** WIĄŻĄCY — typ + bramka jak StandardTable (nie da się obejść).
- **D-6 SIEROTY:** WSZYSTKIE 7 artefaktów pod kontraktem (Interview/Tool/Notification też, z uzasadnioną redukcją).
- **D-4/D-5 KOMPOZYCJA:** każdy artefakt ma RDZEŃ nieusuwalny + WĘŻSZY zestaw domyślny (nie „pokaż wszystko").

**DRUGA TURA decyzji (progi treści — NIE blokują struktury, do zebrania od Piotra później):**
D-1 próg kompletności per-karta? D-2 gates.readinessScore odcięcie? D-3 minima pól = bramka czy porada?
Plus granularne aliasy (Insight 11 sekcji Phase-D, Initiative id-kebab-vs-camel) — lista w kontrakcie SSOT §7.

---

## 3. CO ZROBIONE (ta sesja)

**Warstwa ARTEFAKTU (Menu 1 grafika) — NA DEMO** (wcześniej `a42ee33280`, zaakceptowane na 14 zrzutach):
7 artefaktów, jeden pasek Menu 1 wg decyzji Piotra: status-etykieta, wskaźnik zapisu tekstowy, kod+permalink
w kebabie, tytuł truncate. Primary Interview (D11), Task (D12), usunięty martwy AI Initiative (D13). Tryb
otwarcia szkic→Edycja/zatwierdzona→Podgląd. 3 wady środka naprawione (Interview crimson, Insight kafle+dedup).

**Warstwa KARTY (kontrakt) — NA GAŁĘZI, ZA FLAGĄ, NIE NA DEMO:**
- **POC Decision** (`738447b039`) — ZAAKCEPTOWANY przez Piotra, odbiór niezależny ✅ PASS 5/5. Rdzeń
  nieusuwalny (typ+UI), węższy default 6→4, picker Rdzeń/Pełny. Nowy plik `decisionCardContract.ts`.
- **5 migracji** (`8e7dc69c55`..`c22eea86a1`): Tool·Task·Notification·Interview·Insight — za flagą,
  wg przepisów recon. **Initiative + odbiór = sprawdź w wyniku floty `wgayit5k8`.**

**Narzędzia/kanon zbudowane:**
- `src/components/standard/cardContract.types.ts` — typ kontraktu karty (karta bez id/roli/kompozycji = błąd kompilacji).
- `scripts/check-artefakt-struktura.mjs` — bramka STRUKTURALNA (Menu1, panel, kolejność sekcji, crimson w centrum).
  Tryby: raport (default), `--json`, `--strict` (exit 1). NIE wpięta jeszcze jako hook — decyzja Piotra (D-8, moment).
- `_KANON_KARTY_MODEL_2026-07-22.md` — model karty + 51 kanonicznych id (dedup ze 100).
- `_KONTRAKT_KARTY_SSOT_2026-07-22.md` — jeden wiążący SSOT (tabela master + plan migracji POC-first).
- `_PRZEPIS_MIGRACJI_<X>_2026-07-22.md` — 6 gotowych przepisów migracji per artefakt.
- `_DWA_SYSTEMY_KART_MAPA` · `_ROZJAZD_TAKSONOMIA_KART` · `_WIDMA_ODWOLANIA_KART` — front mechaniczny.

---

## 4. NASTĘPNE KROKI (kolejność)

1. **Sprawdź wynik floty `wgayit5k8`** — czy Initiative domknięty (lub „częściowe do serializacji" — DB),
   czy odbiór 6 dał zrzuty i werdykt. Folder `_ODBIOR_MIGRACJI_6_2026-07-22/`.
2. **Obejrzyj zrzuty SAM** (reguła #7 — Piotr NIE jest pierwszym testerem). Jasny+ciemny, każdy artefakt:
   render bez regresji, rdzeń nieusuwalny, węższy default, brak boundary/surowych kluczy.
3. **Napraw FAIL-e** (jeśli są) zanim pokażesz — jak przy POC/kartach N.
4. **Pokaż batch Piotrowi na zrzutach → akcept.** Dopiero po „tak": bezpieczna promocja na demo
   (skill `consultify-promocja-demo`: merge nie force; pre-flight merge-tree; twarda weryfikacja plików;
   push; monitor health gitSha; re-tag `demo-safe`).
5. **Decyzja o fladze:** czy `cardContract` staje się domyślna. UWAGA: bramka `--strict` NIE jest zielona
   przez crimson w centrum (dług PRE-EXISTING, ~100 tokenów w 7 artefaktach — osobny sweep kolorystyki,
   decyzja Piotra 07-08). Przed domyślną flagą: albo domknij crimson, albo Piotr świadomie akceptuje dług.
6. **Druga tura decyzji Piotra** (progi treści D-1/2/3 + granularne) — zbierz, zanim ruszy standaryzacja TREŚCI kart.

---

## 5. NIENARUSZALNE REGUŁY (kosztowały tygodnie — nie łam)

1. **Weryfikuj REALNY runtime, nie docy/flagi.** Audyty starzeją się w 3 dni. Grep callera w src/server,
   sprawdź czy flaga ma implementację (FANTOMY), stan z żywej bazy. „Testy przeszły" ≠ „działa".
2. **Baza gałęzi ZAWSZE `origin/demo`.** Główny checkout (`oxford/oc2-merge`) ~2000 commitów za demo —
   numery linii fałszywe. Czytaj z worktree `prv-mywork` albo `git show origin/demo:<ścieżka>`.
3. **Piotr NIGDY nie jest pierwszym testerem wizualnym** (załamanie 07-11). Renderuj+zrzut SAM przed pokazem.
4. **Nic na demo bez akceptu Piotra na zrzutach.** Demo święte, merge nie force, POC-first (nie hurtem — reguła #9).
5. **„esbuild przeszedł" ≠ działa.** 2× w tej sesji zielony esbuild wywalił się w przeglądarce. Otwórz w harnessie.
6. **Raport agenta = deklaracja, nie dowód.** Zawsze niezależny odbiór wzrokiem. Złapał 13 wad, których 7 agentów nie zgłosiło.
7. **Sweep crimsona = OSOBNY etap** (decyzja Piotra 07-08). Migracja to STRUKTURA, nie kolor. Nie mieszaj.
8. **Model pracy:** flota agentów (workflow), nie jeden agent. Piotr tego oczekuje. Prep równolegle do bramek;
   armia dopiero PO akcepcie POC/wzorca. Bramki (POC, akcept) nie są ograniczone liczbą agentów.

---

## 6. HIGIENA WYKONANIA (dla robotników floty)

Modele tanie do mechaniki, Opus/max do trudnego; świeża gałąź/worktree; commit-per-krok; NIE push;
zakaz pełnego tsc/vitest (OOM) — esbuild per plik; agent edytuje TYLKO swój artefakt (+ własny deskryptor +
locales append-only), NIE wspólne pliki równolegle (cardContract.types.ts, registry — konflikt).

---

## 7. RÓWNOLEGLE (nie Twoje — Piotr prowadzi w osobnych sesjach)

- **IDEE** (Mind Map · Tabela · Whiteboard · Process Flow) — audyt+naprawa, osobna sesja z promptu.
- **DOKUMENTY** (Prezentacja/Deck · Word · Excel) — „kaszanka", audyt+naprawa, osobna sesja.
- Nie dubluj ich. Twój zakres: **kontrakt karty / artefakty N**.

---

*Zapisane przy wyczerpaniu kontekstu. Punkty cofnięcia i wszystkie SHA zweryfikowane w sesji.*
