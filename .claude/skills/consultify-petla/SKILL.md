---
name: consultify-petla
description: Orkiestracja pracy w PĘTLI na jednym fragmencie (jedno narzędzie/temat) — zmierz→przyczyna→napraw→deploy→re-test→bramka. Wywołaj ZAWSZE gdy zaczynasz domykać którekolwiek narzędzie Harvard/Vegas/Oxford w cyklu, gdy przekazujesz robotę robotnikowi (potrzebna PIGUŁKA kontekstu), albo gdy masz zaplanować model per krok pod kątem kosztu tokenów. To skill-wejście do pracy w lupie; woła consultify-test (mierzenie), consultify-finisz-modulu (naprawa), consultify-promocja-demo (deploy).
---

# Consultify — praca w PĘTLI (fragment = zamknięty cykl)

## Zasada nadrzędna
**Nigdy cały projekt naraz — spala tokeny i gubi kontekst.** Jednostka pracy = FRAGMENT (jedno narzędzie albo jeden przekrojowy temat), domknięty jako jedna pętla, potem STOP i raport. Robisz 1-2 fragmenty na okno, aktualizujesz dashboard, wracasz. Fragmenty są niezależne — kolejność wg odblokowania, nie wg ambicji.

SSOT stanu i listy fragmentów: `Harvard/wdrozenie-100/_STATUS_3_FILARY.html` (dashboard, pamięć `[[project_dashboard_3_filary]]`) + `_PLANY_KONCOWE_2026-07-07/00_PLAN_DOKONCZENIA_FINAL.md`.

## ŻELAZNA KOLEJNOŚĆ BLOKÓW (decyzja Piotra 07-08 — nie przestawiaj bez jego zgody)
B1 Notatnik (przetarcie pętli, małe ryzyko) → B2 Excel/Sheet (Teresa→.xlsx, największa luka, Opus) → B3 Word E2E (siatka przed jakąkolwiek powłoką) → B4 MindMap+ProcessFlow+kolaboracja live-verify → B5 Deck (PPTX geometria + dowód vs Gamma) → **B6 = BRAMKA: live-odbiór Piotra 8 narzędzi (~1-2h, zamyka Harvard v1)** → B7 forward-port demo→Londyn (per-SHA) → B8 VEGAS (bramka promptów N-kart → ArtifactRightPanel → fale: Rekord→Dokument→Matryca→Deck→Canvas) → B9 OXFORD (odbiory zbudowanych: DRD+6 q-banków+standard wniosków → reszta O3→O4/O5).
**Tor równoległy B-R2 (poza kolejnością):** Storage R2 (Whiteboard obrazy+Tabela załączniki) — startuje NATYCHMIAST gdy Piotr da sekret, wpada między bloki. Zasada: blok NIE startuje, póki poprzedni nie przeszedł swojej bramki (wyjątek: B-R2 i drobne hotfixy z odbiorów).

## PIGUŁKA — kontrakt kontekstu (najważniejszy element ekonomii)
Robotnik NIE czyta wielkich handoffów. Dostaje JEDNĄ pigułkę ≤1 ekran. Ty (orkiestrator) ją składasz z SSOT; robotnik działa tylko z niej. Szablon do skopiowania:

```
PIGUŁKA · fragment: <F#/nazwa>
CEL (mierzalny): <1 zdanie — co ma działać po Tobie + próg odbioru>
GAŁĄŹ: świeża z origin/Londyn → <nazwa>; worktree: /private/tmp/<nazwa> (isolation)
RUNTIME (gdzie realnie żyje): <plik(i) + handler/URL — z consultify-finisz-modulu „Tożsamość 8 narzędzi">
TEST/PRÓG: <jak zmierzyć + próg — z consultify-test; prosty czy złożony>
ZAKRES: rób TYLKO <X>. NIE ruszaj <Y>. NIE deleguj dalej, NIE push.
MODEL: <Sonnet|Opus|Haiku — patrz tabela niżej>
TWARDE ZASADY: commit-per-krok · esbuild per plik (nie pełny tsc) · testy→git add -f ·
  0 crimson w nowych liniach · weryfikuj realny caller nie flagę · konflikt=STOP+raport.
WYNIK ZWROTNY: <co ma oddać — diff+dowód PRZED/PO, NIE proza>
```
Zasady dobrej pigułki: bez historii („dlaczego"), tylko „co i jak teraz". Ścieżki bezwzględne. Jeden cel. Jeśli robotnik musi doczytać handoff — pigułka jest zła.

## PĘTLA — 6 kroków, model per krok
| # | Krok | Model | Co robi |
|---|------|-------|---------|
| 1 | **Zmierz** | Sonnet (obiektyw rygor/model-finansowy → Opus) | harness niezawodności + panel treści na ŻYWYM demo → score+findingi. Patrz `consultify-test`. |
| 2 | **Przyczyna** | Sonnet → Opus jeśli utyka | live-debug: zaloguj REALNY wynik na demo (nie mock). Mock zgaduje, live pokazuje (lekcja canvas: 4 rundy mocków padały, live znalazł w 1). |
| 3 | **Napraw** | Sonnet mechanika · Opus trudny kod | robotnik z pigułką. DERIVED/jedno źródło. Patrz `consultify-finisz-modulu`. |
| 4 | **Deploy** | nadzorca (Ty, bez robotnika) | merge na demo, NIGDY force. Audyt oczami PRZED. Patrz `consultify-promocja-demo`. |
| 5 | **Re-test** | Sonnet | re-capture z żywej Teresy → PRZED/PO. Iteruj 1↔3 aż próg. |
| 6 | **Bramka** | Piotr | mały wycinek live-odbioru (ten ekran), nie cały przelot. Bez „tak" fragment NIE jest domknięty. |

## Tabela modeli (ekonomia — domyślnie TANIO, drogo tylko gdzie trzeba)
- **Haiku** — czysta mechanika: grep, budowa bundla, re-capture, higiena git, przenoszenie plików.
- **Sonnet** (domyślny robotnik + wszyscy weryfikatorzy/sceptycy) — mechaniczne fixy, live-debug, panel-obiektywy lekkie, testy.
- **Opus** — TYLKO: trudny kod w hot-path (np. Teresa-sheet wiring), geometria PPTX, obiektyw rygor/model-finansowy, przyczyna gdy Sonnet utknął, synteza spornego panelu.
- **ZERO Fable u robotników** — resume SendMessage bije w limit Fable; dokańczaj świeżym Agent(sonnet), zabezpiecz commitem.
- Eskalacja modelu = decyzja orkiestratora po 1 nieudanej rundzie taniego modelu, nie domyślnie.

## Higiena wykonania (nienaruszalne)
- **Świeża gałąź z `origin/demo` per fragment** (demo = target deployu i ma ~130 commitów mechaniki, których Londyn nie ma; gałąź z Londyn = fix na starym kodzie = konflikt/regresja przy merge). Londyn dostaje forward-port per-SHA osobnym blokiem (B7). NIGDY `feat/tp-forms-polish` ani linii `tp-*`/`deliverables-w1`/`harvard-noc` (skażony re-skin — [[finding_reskin_baked_into_deliverables_lineage]]).
- **JEDEN właściciel pętli per case/narzędzie.** Przed startem pętli sprawdź i wpisz się do rejestru właścicieli w dashboardzie `_STATUS_3_FILARY.html` (sekcja „Rejestr pętli"); jeśli case ma żywego właściciela (inna sesja) — NIE dotykaj jego danych na TROLLEY (lekcja: rozjazd NORDWIND między 2 agentami).
- `isolation: worktree` wymuszony; worktree pod `/private/tmp/<nazwa>` (nie `/tmp` — symlink gubi Vite; commity z ulotnego worktree bywają gubione między turami → commit-per-krok).
- Robotnik: „WYKONAJ nie deleguj" (rozdelegowanie klobruje główne drzewo), zero sub-agentów, zero push.
- Nowe testy w `tests/` → `git add -f` (`.gitignore:209`).
- Dane demo = twarz produktu: probe'y sprzątają po sobie, zero rekordów testowych.

## Domknięcie fragmentu (obowiązkowe — żeby proces się nie gubił)
1. Deploy na demo zweryfikowany (health `gitSha`).
2. **Aktualizuj dashboard** `_STATUS_3_FILARY.html` (pigułki statusu p-done/p-part) → `Artifact(url:…)` — protokół w `[[project_dashboard_3_filary]]`.
3. Zaktualizuj SSOT plan (dziennik fazy) — NIE twórz nowego docu-audytu.
4. Raport PRZED→PO, PL, krótko, tabelą. Jeśli bramka Piotra otwarta — wypisz co dokładnie ma kliknąć.

## Pointery
`consultify-test` (mierzenie/ocena) · `consultify-finisz-modulu` (naprawa+tożsamość narzędzi) · `consultify-promocja-demo` (deploy) · workflow `panel-adwersaryjny` (mechanizm złożonego testu) · `_SYSTEM_WERYFIKACJI_2.0.md` (3 osie).
