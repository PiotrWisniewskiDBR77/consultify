---
name: consultify-artefakt-fala
description: Orkiestracja FALI ARTEFAKTÓW Vegas (B8) — jak wydajnie przeprowadzić standaryzację 12 narzędzi do SPEC-A. Wywołaj ZAWSZE gdy planujesz/uruchamiasz pracę nad WIELOMA artefaktami naraz (fala, rollout, "zróbmy wszystkie artefakty"), gdy kroisz pracę na robotników per artefakt, albo gdy wypełniasz kolumnę Stan w _FORMULA_MENU_NARZEDZI_12.md. Dla kanonu POJEDYNCZEGO ekranu-artefaktu → consultify-artefakty; dla cyklu test-napraw-deploy → consultify-petla.
---

# Consultify — FALA ARTEFAKTÓW (orkiestracja B8, wydajna ekonomicznie)

## Cel i miara
Wszystkie **12 narzędzi** (`_FORMULA_MENU_NARZEDZI_12.md` §0) w powłoce SPEC-A, odebrane przez Piotra na zrzutach (DoD §18.1). Miara postępu = kolumna **Stan** w Formule (per przycisk: ✅ JEST / 🔨 DOROBIĆ / ❓ DECYZJA) + pigułki w dashboardzie `_STATUS_3_FILARY.html`.

## Dokumenty (hierarchia — patrz `_VEGAS_AUDYT_SPOJNOSCI_2026-07-09.md` §1)
0. **`_DOKTRYNA_POWSTAWANIA_ARTEFAKTOW.md` — NADRZĘDNA dla decyzji silnikowych**: 5 wymiarów (tryb/temporalność/pochodzenie/interakcja/kolaboracja) + benchmarki (Miro·Notion·Airtable·Gamma+·Word=wyznacznik) + reguły §6 (nie przenoś wzorców między trybami; dokument=first-shot-akceptowalny; oba wejścia AI wszędzie).
1. `ARTIFACT_ANATOMY_STANDARD.md` — SSOT wyglądu (menu §5, alfabet §6, instancjacja §13, DoD §18.1).
2. `_FORMULA_MENU_NARZEDZI_12.md` — CO ma być w którym menu per narzędzie (kontrakt fali).
3. Skill `consultify-artefakty` — JAK budować pojedynczy ekran (zakazy kolorów, NModeCardState, lekcje TDZ).

## ★ DECYZJE PIOTRA 07-09 (czytaj PRZED planowaniem fal)
- **WYRÓWNAĆ KONTRAKT, nie accordion**: dojrzałe narzędzia (Deck/Word/Notatnik/Idea Table) zostają na swoich bogatszych powłokach; wyrównujesz tylko tokeny/zero-crimson/Powiązania-first-class/slot-AI/kebab. NIE przerabiaj ich na ArtifactRightPanel. Odejścia z komentarzem-decyzją w kodzie = akceptowane.
- **Excel/Sheet = Idea Table (powłoka) + generator/.xlsx (treść)**. Nie budujesz edytora-grida.
- Pełny kontekst: `_DOKTRYNA_POWSTAWANIA_ARTEFAKTOW.md §0`.

## KROK 0 fali (jednorazowy, PRZED rolloutem — nie pomijaj)
1. **Galeria wzorca:** zrzuty Task (jedyny w 100% żywy SPEC-A: NModeShell+ArtifactRightPanel, TaskDetailView) dark+light → to jest „tak ma wyglądać" dla całej fali. Bez wzorca każdy robotnik zgaduje inaczej (lekcja nocy 3/4: szerokość bez wzorca = katastrofa).
2. **Flip flag w przeglądarce** (localStorage `ff.mels_canvas`, `ff.mels_mindmap_panel`, flagi kart N) — odsłoń ZBUDOWANE powłoki bez deployu, zrób zrzuty → Piotr decyduje co przyjmuje od razu, a co poprawiamy. Dużo SPEC-A już istnieje za OFF (audyt F4/F6) — fala to głównie ODSŁANIANIE i DOMYKANIE, nie budowa od zera.
3. **Bramka promptów N (Piotr, F5):** treść `_PRZEGLAD_PROMPTOW_ARTEFAKTY_N_2026-07-07.md` — bez zgody sekcje AI kart N nie idą live.

## KOLEJNOŚĆ FAL (wg pokrewieństwa powłok; w fali można równolegle, MIĘDZY falami sekwencyjnie)
| Fala | Artefakty | Powłoka | Uwaga |
|---|---|---|---|
| A1 | Task (wzorzec ✅) → Insight → Decision | NModeShell + panel | Rekord S; Insight/Decision = odsłonięcie kart N + diff Formuły |
| A2 | Mind Map → Process Flow → Whiteboard | IdeaMapWorkspace (+MELS OFF→ON) | Canvas; NAJPIERW flip+zrzuty, potem domykanie diffów |
| A3 | Initiative | InitiativeDocumentView (SPEC-A podpięty) | 10,8k linii — OSOBNY zwiad głębi przed zmianami; nie dawać robotnikowi „przebuduj" |
| A4 | Notatnik → Word | B Dokument (M2 formatowanie) | wspólny kontrakt edytora tekstu |
| A5 | Idea Table → Excel/Sheet | D Matryca | Sheet zależny od decyzji B2 (grid vs markdown+eksport) |
| A6 | Deck | E Deck (MELS) | razem z B5 Harvarda (PPTX) — jedna sesja wizualna |

## PIGUŁKA robotnika-artefaktu (szablon — instancjonuj z Formuły, robotnik NIE czyta standardu w całości)
```
PIGUŁKA · artefakt: <nazwa> (archetyp <A-E>, klasa <S/L>)
CEL: doprowadź powłokę do kontraktu z _FORMULA_MENU_NARZEDZI_12.md §<sekcja narzędzia> — NAJPIERW diff (co JEST vs formuła), POTEM domknięcie różnic.
KROK 1 — DIFF: dla każdej strefy (M1/M2/M3/RAIL/PANEL/PPM) wypisz stan per przycisk: ✅/🔨/❓. Grepuj realny kod (plany kłamią — audyt F2). ODDAJ diff PRZED kodowaniem.
KROK 2 — DOMKNIJ tylko 🔨 zatwierdzone przez orkiestratora. Reużyj: ArtifactRightPanel · NModeCardState (prop state; badge prop status!) · prymitywy PreviewPane.
GAŁĄŹ: świeża z origin/demo → worktree /private/tmp/<nazwa>. NIE tykaj wspólnej powłoki (NModeShell/ArtifactRightPanel/IdeaMapWorkspace) bez zgody orkiestratora — kolizje między robotnikami.
ZAKAZY: primary-* KAŻDY numer = crimson · **c-accent w NOWYM kodzie = ZAKAZ (hook tego nie łapie — audyt F1!)** · navy/slate/hex · fokus=c-focus · akcent AI=c-info/teal.
WERYFIKACJA: esbuild per plik + OTWÓRZ w przeglądarce (lekcja TDZ: tsc nie łapie ReferenceError) + zrzuty artefakt/panel/kebab × dark+light.
WYNIK: diff-tabela Stan + SHA + zrzuty. NIE push, NIE deploy.
```

## POLITYKA MODELI I TOKENÓW (ekonomia — obowiązuje każdego agenta fali)
**Zasada naczelna: najtańszy model, który zrobi robotę; eskalacja dopiero PO porażce taniego, decyzją orkiestratora — nigdy "na zapas".**
- **Haiku** — czysta mechanika: grep/inwentarz stref, porównanie kodu z Formułą, przenoszenie plików, re-capture.
- **Sonnet** (domyślny) — diff-tabele, domykanie przycisków, testy, orkiestracja fali.
- **Opus TYLKO 3 przypadki:** zwiad Initiative (A3, 10,8k linii) · zmiany WSPÓLNEJ powłoki (kolizje) · Deck geometria. Nic więcej.
- **Fable: ZAKAZ u robotników i wykonawcy** (resume bije w limit; drogi kontekst).
- **Ekonomia kontekstu:** robotnik dostaje PIGUŁKĘ ≤1 ekran (orkiestrator destyluje z SSOT) — NIE czyta standardu 1255 linii ani handoffów; zwraca SUROWE DANE (diff-tabela, SHA, ścieżki zrzutów), nie prozę; jeden artefakt = jeden robotnik = jeden worktree.
- **Ekonomia przebiegu:** fala naraz (nie 12 artefaktów równolegle — max 3-4 robotników w fali); diff-inwentarze można robić na zapas taniej; zrzuty batchem po fali (orkiestrator, preview/flip flag — bez deployu); zero pełnego tsc/vitest (esbuild per plik); NIE powtarzaj pomiarów, które już są w Formule/audycie.
- **Stop-lossy:** robotnik utknął >1 rundę → STOP+raport (nie mielenie); zadanie okazuje się "trudny hot-path" → STOP, orkiestrator decyduje o Opusie; limit sesji w trakcie panelu → wynik częściowy, nie powtarzaj od zera.

## BRAMKI (feed-forward — jak consultify-test, ale wizualnie)
1. Diff robotnika → orkiestrator zatwierdza LISTĘ 🔨 (nie „rób wszystko") → dopiero kodowanie.
2. Zrzuty PRZED/PO per artefakt → **Piotr akceptuje → dopiero merge demo** (consultify-promocja-demo). Odrzut = poprawka w tym samym kroku.
3. Fala N+1 nie startuje, póki fala N nie przejdzie bramki zrzutów (wyjątek: diff-inwentarze można robić równolegle na zapas).
4. Po każdej fali: aktualizuj kolumny Stan w Formule + dashboard + `AKTUALIZUJ ten skill jeśli lekcja` (nie twórz nowych doców-audytów).

## Pułapki fali (z audytu + historii)
- Kod bywa DALEJ niż plany (F2) — diff zawsze przed budową; „do zbudowania" w planie ≠ prawda.
- Wspólna powłoka = wąskie gardło współbieżności — zmiany w niej robi JEDEN wyznaczony robotnik, reszta czeka.
- Flagi OFF ≠ brak kodu — najpierw flip+zrzuty, potem decyzja co budować.
- Reużycie: Task/Decision/Insight/KPI = jeden artefakt, wiele domów — standaryzuj RAZ, zweryfikuj we wszystkich domach (My Work, Initiatives, Execution, Results).
- Odbiór = WZROKIEM Piotra na zrzutach; „hook przeszedł" ≠ odebrane.
