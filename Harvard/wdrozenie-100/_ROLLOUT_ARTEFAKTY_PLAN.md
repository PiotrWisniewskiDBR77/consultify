# ROLLOUT ARTEFAKTÓW (SPEC-A) — PLAN I STAN REALNY (SSOT)

Data utworzenia: 2026-07-26 · Źródło: audyt runtime na `origin/demo` (`de00f85741`).
**Ten plik wcześniej NIE ISTNIAŁ** — referencje (m.in. `_PLAN_SESJI_68a-e_TOOLS_ARTEFAKT.md:76`,
CLAUDE.md „fale G0-G5") wskazywały phantom-dokument. Nomenklatura „G0-G5" nie miała nośnika;
realne fale w repo to A/B/C (`_HANDOFF_FALA_*_2026-07-22.md`) i F (StandardArtifactShell).

## POWIĄZANE SSOT (nie dubluj — linkuj)
- Anatomia/standard: `ARTIFACT_ANATOMY_STANDARD.md` (§10.2/§11.2 powłoka, §13 per archetyp, §18.1 DoD)
- Formuła 6 stref + kolumna Stan per narzędzie: `_FORMULA_MENU_NARZEDZI_12.md`
- Ostatni audyt gotowości: `_AUDYT_GOTOWOSCI_ARTEFAKTY_2026-07-24.md` (ocena 7,1/9,5)

## 1. STAN POWŁOK per archetyp (runtime 2026-07-26)

| Archetyp | Artefakt | Powłoka realna | ArtifactRightPanel | Luka |
|---|---|---|---|---|
| A Canvas | MindMap/PF/WB (`IdeaMapWorkspace`) | MELS `IdeaCanvasMelsView` (flaga ON) | — (canvas rail) | legacy floating-chrome wciąż w kodzie jako alternatywa |
| B Dokument | DocumentStudio/Wordy (`DocumentStudioView.tsx:498`) | własna ExecutiveModuleShell | **BRAK** | jedyny archetyp bez wspólnego prawego panelu |
| C Rekord | Insight, Tool | `<NModeShell>` ✓ | ✓ | wzorcowe |
| C Rekord | Task/Decision/Notification/Initiative | **prymitywy NModeLayout ręcznie** (grep `<NModeShell` = 0) | ✓ | 4 różne szerokości: 1488/1332/1496/1364 px |
| D Matryca | Idea Table | `IdeaMapWorkspace`/`IdeaTableTool` | — | |
| D Matryca | Tabele (Kimi) | ExecutiveModuleShell | własny `ExceleRightPanel`+`TabeleRightRail` | drugi alfabet paneli |
| E Deck | DeckBuilder (`DeckBuilder.tsx:1201`) | ExecutiveModuleShell (default ON) | ✓ + własny `DeckBuilderMelsRightRail` | dubel panelu |

**`StandardArtifactShell` (docelowa powłoka Fali F): 0 konsumentów.** Plan migracji M1-M7 opisany
w `standard/registry.ts:82-150`; odwołania w kartach to tylko komentarze.

## 2. FLAGI POWŁOK (defaulty runtime)

| Flaga | Zakres | Default |
|---|---|---|
| `melsCanvasFlag` | A Canvas MELS | **ON** (2026-07-22) |
| `melsDeckBuilderFlag` | E Deck | **ON** |
| `melsTabeleFlag` / `melsPrezentacjeFlag` | D/E | OFF |
| `vf1CanvasSpecAFlag` / `vf1InitSpecAFlag` | stany SPEC-A | OFF |
| `artifactApprovalUiFlag` | pasek zatwierdzeń | OFF |
| `studioFlag` | Canvas Studio | OFF (crash containment) |

## 3. PLAN DOMKNIĘCIA (fale — kolejność wg zależności; funkcja > wygląd)

- **Fala W1 (bez zmiany pikseli, wykonalna od ręki):** ujednolicenie mechaniki — bramka PART 2
  check-artefakt na ratchet (gałąź `fix/bramki-nie-klamia`), inwentarz ten dokument, dubel paneli
  D/E opisany jako dług.
- **Fala W2 (pilot, za flagą OFF, odbiór Piotra):** migracja JEDNEJ karty N (rekomendacja: Task —
  największy ruch) na `<NModeShell>` lub `StandardArtifactShell` M1; render-verify + zrzuty →
  akcept → reszta kart falami.
- **Fala W3 (decyzja produktowa):** wspólny prawy panel dla archetypu B (Dokument) — wymaga
  projektu (dokument ≠ rekord: inne sekcje); sesja koncepcyjna przed kodem.
- **Fala W4:** wygaszenie legacy floating-chrome Canvas po okresie stabilności MELS; usunięcie
  dubli `DeckBuilderMelsRightRail`/`ExceleRightPanel` po unifikacji.

## 4. DoD ODBIORU (skrót — pełny w ARTIFACT_ANATOMY §18.1)
Zrzut light+dark, zero crimson w powłoce (`check-artefakt` PART 1), szerokość zgodna z kanonem,
prawy panel accordion kompletny, odbiór OCZAMI nie „testy przeszły".

## 5. DZIENNIK
- 2026-07-26 — utworzenie planu z audytu runtime; unieważnienie phantom-nomenklatury G0-G5;
  stan zastany jak w §1.
