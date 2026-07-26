# STD-001 — Weryfikacja standardu: bramki, SSOT rolloutów, higiena preview/IDEE

- **Stan:** DO ODBIORU (2026-07-26)
- **Gałąź/commity:** `integ/standard-weryfikacja-2026-07-26` — 12 commitów (audyt → 3 fale robotników → integracja)

## Diagnoza (4 równoległe audyty runtime — pełne wnioski w dokumentach SSOT niżej)
Standard istniał jako TOKENY kopiowane ręcznie, nie KOMPONENTY montowane: `StandardModuleBar`
nieużywany w 8 hubach, `StandardPreview` w ~1/3 ekranów, `StandardArtifactShell` 0 konsumentów.
Dwa dokumenty rollout-SSOT były phantomami (nie istniały). Bramki dawały fałszywą zieleń.

## Co wykonano automatycznie (funkcja > wygląd)
1. **Bramki:** PART 2 `check-artefakt` dostał ratchet (blokuje NOWE naruszenia bez `--strict`);
   baseline PART 1 zaciśnięty **274→7** (dług realnie spłacony — ratchet od dziś pilnuje serio).
   `check-triada`: audyt o „martwej na macOS" OBALONY sondą (naprawiona wcześniej, commit `5b34b9dcde`).
2. **SSOT odtworzone:** `_ROLLOUT_TRIADA_INWENTARZ.md` + `_ROLLOUT_ARTEFAKTY_PLAN.md` napisane
   od zera Z DANYCH AUDYTU (kto realnie podłączony, plan fal W1-W4). Analiza A2 preview
   (547 linii, jedyny artefakt PRV-007/008) uratowana z bocznej gałęzi do głównej linii.
3. **Higiena:** 8 martwych plików preview usuniętych (−1725 linii, każdy po grep-weryfikacji);
   martwe pigułki Relations dostały onClick (Inbox→zadanie/decyzja, Decyzje→linkowana decyzja) —
   wg wzorca działających handlerów z tych samych plików; chipy etapów MyWorkHub na SSOT
   (złapany realny dryf „Kształtuje" w translation.json); naprawiony elision bug w deps
   (`TaskDetailView` `readMode,, t`).
4. **Literówka etapu:** chip Menu 1 Idei — „Kształtuje się" (SSOT) zamiast lokalnej kopii.

## Dowody
- Strażnicy na finalnym drzewie: check-artefakt ✓ (7/7) · check-list-canon --all ✓ (414/414) ·
  check-actions ✓ (16 akcji) · crimson na liniach dodanych: 0.
- Zrzuty: chip etapu light+dark, kontrolka Teresy light+dark (IDE-021).
- **Do klikania w odbiorze:** pigułki Relations w Inbox/Decyzjach (dowód kodowy jest;
  klik-dowód celowo zostawiony na odbiór — brak harnessu montującego realny panel ze store).

## Czego NIE wykonano automatycznie (wymaga akceptu wizualnego — reguła #5)
Plan W2-W4 w `_ROLLOUT_ARTEFAKTY_PLAN.md`: adopcja StandardModuleBar w 8 hubach, migracja
kart N na wspólną powłokę (pilot Task za flagą), lista Ideas na StandardTable, wspólny prawy
panel archetypu B. To zmiany widoczne — najpierw prototyp+zrzuty, potem decyzja Piotra.
