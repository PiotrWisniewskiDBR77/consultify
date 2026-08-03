---
doc_kind: CORRECTION_BACKLOG
status: OPEN
source: panel adwersaryjny 5 recenzentów, 2026-08-02
scope: dokumentacja UI/UX po remediation czwartego audytu
authority: docs/ui-standards/CANON.md
---

# Rejestr korekt po panelu adwersaryjnym

**To NIE jest odbiór i NIE zawiera oceny liczbowej.** To lista defektów do usunięcia. Dokument z własną oceną był patologią, którą wykrył czwarty audyt — nie powtarzamy jej.

## 0. Co się stało

Po czwartym audycie (werdykt `FAIL`) wykonano remediation 15 agentami. Następnie pięciu niezależnych recenzentów adwersaryjnych sprawdziło **treść** wyniku, weryfikując ok. **300 twierdzeń o kodzie** realnymi poleceniami.

**Wynik: remediation realnie poprawiła stan, ale wprowadziła nową porcję tego samego błędu.**

- Potwierdzone jako prawdziwe: ~260 z ~300 twierdzeń o kodzie.
- Fałszywych: **25 twardych** (11× P0, 12× P1) + ok. 11 P2.
- Obszary, o które audyt najbardziej się bał (`clamp(340px,28%,480px)`, dług fokusa 119/259, rejestr delt D-01…D-05), okazały się **w pełni poprawne wszędzie** — te dwie błędne tezy audytora NIE rozprzestrzeniły się.
- Ale powstał **niezależny zestaw tego samego wzorca** (za wąski grep · błędna negacja · źle policzony output) w innych plikach, w tym w warstwie najwyższego autorytetu.

**Błąd metodyczny nadzorcy (do zapamiętania):** po remediation ogłoszono „bramki czyste" na podstawie `docs:links`, unikalności hashy sekcji i greppa statusów. To znowu była **metryka formy, nie treści** — dokładnie ten sam błąd co rundy 1–3, tylko o poziom wyżej. Unikalność sekcji dowodzi, że tekst jest różny, nie że jest prawdziwy ani użyteczny.

---

## 1. P0 — blokują użycie dokumentacji jako wiążącego bindingu

### 1A. Fałszywe fakty o kodzie w warstwie autorytetu

| ID | Plik | Twierdzenie | Stan faktyczny | Poprawka |
|---|---|---|---|---|
| K-01 | `CANON.md` §6 | `previewStyles.ts` (`PreviewActionBar`) jako kod SSOT | `PreviewActionBar` jest w osobnym `PreviewActionBar.tsx`; `previewStyles.ts` ma tylko stałe klas | Rozdzielić na dwa wiersze bindingu |
| K-02 | `TRIADA_KANON.md` §D | 4 obrazy referencyjne `assets/triada/*.png` | Katalog `assets/triada/` **nie istnieje**; żaden z 4 plików nie istnieje w repo | Usunąć sekcję albo dołożyć realne zrzuty |
| K-03 | `TRIADA_KANON.md` §A6 | „bloki 4–5 dokłada komponent automatycznie" | `RowActionsMenu.tsx` renderuje dokładnie to, co dostanie, w kolejności wołającego; `RowActionSectionKind` to etykieta bez logiki | Poprawić na „moduł deklaruje wszystkie 5 bloków" albo dopisać auto-injekcję do komponentu |
| K-04 | `UI-ART-01/STANDARD.md` | `StandardArtifactShell` ma „3 konsumentów" | **Zero** realnych importów/renderów — 3 pliki tylko wspominają nazwę w komentarzu, jeden wprost pisze „to NIE jest pełna migracja" | Poprawić na 0 + opisać realny stan adopcji |
| K-05 | `UI-SHELL-01/STANDARD.md` (4 miejsca) | Pozycje nawigacji mają pole `capability`; sidebar **filtruje** pozycje bez uprawnień | Pole nazywa się `isLocked`/`lockedMessage`; zachowanie **odwrotne** — pozycja zostaje w DOM, disabled + tooltip | Poprawić nazwę pola i opis zachowania |
| K-06 | `UI-STATUS-01/STANDARD.md` | `statusColors.ts` ma 7 konsumentów, w tym `EntityStatusChip.tsx`/`StatusPill.tsx` | Te dwa pliki **nie importują** `statusColors.ts` — mają własny system i deklarują się jego następcą. Realnie 5 konsumentów | Skorygować listę i liczbę |
| K-07 | `UI-SHEET-01/STANDARD.md` §4/§12 | Drawer 360 px / zakres 320–420 | Własne referencje karty: `IdeaNodeDetailDrawer.tsx:595` = `w-[420px]` stałe; `InitiativeDrawer.tsx:903` = „50% width". Liczba 360/320–420 należy do **innej** powierzchni (SPEC-A) | Wpisać realny pomiar obu referencji albo oznaczyć rozjazd jako dług |
| K-08 | `BLOCK_TYPES_CANON.md` | `src/services/statusColors.ts` | Realnie `src/constants/statusColors.ts` | Poprawić ścieżkę |
| K-09 | `BLOCK_TYPES_CANON.md` | SQL: tabela `insights`, kolumna `JSONB` | Realnie tabela `interview_insights`, kolumna **`TEXT`**, bez `IF NOT EXISTS`/`DEFAULT` | Poprawić DDL |
| K-10 | `BLOCK_TYPES_CANON.md` changelog | „zmiana wykonana: `transition-all duration-500` → `transition-[width]`" | `NModeLeftNav.tsx:470` **nadal** ma `transition-all duration-500` | Przeformułować: zmieniono SPECYFIKACJĘ, kod jest długiem |
| K-11 | `BLOCK_TYPES_CANON.md` | Dwie różne listy „12 typów bloków", obie jako kanon | Pokrywają się w 2/12; 6 nazw z pierwszej listy ma **zero** wystąpień w `src/` | Rozstrzygnąć jedną listę wg realnych komponentów |
| K-12 | `TABLE_AND_PREVIEW_CANON.md` | `Admin/shared/EnhancedDataTable.tsx` (884 LOC, 2 importery) | Plik **nie istnieje** w `src/` (tylko w martwych worktree) | Usunąć wpis |
| K-13 | `TABLE_AND_PREVIEW_CANON.md` | `Admin/shared/AdminTable.tsx`, 2 importery | Realnie `src/views/superadmin/components/shared/AdminTable.tsx`, **1** importer | Poprawić ścieżkę i liczbę |
| K-14 | `color-system.md` §1 | Tabela `--neutral-950…--neutral-0` jako tokeny CSS | **Zero wystąpień** `--neutral-*` w `src/`. Wartości przesunięte o stopień względem realnej skali `navy-*` | Usunąć tabelę, zastąpić realnym odczytem `navy-*` |
| K-15 | `color-system.md` changelog v3.0 | „Fiolet `#7C3AED` nie istnieje w produkcie" | **8 wystąpień** w `src/` (`ChatToggleButton.tsx`, `ChatHistorySidebar.tsx`, `APIAccessSettings.tsx`, `calendar-theme.css`, `GoldenThreadSankey.tsx`) | Poprawić na „usunięty jako token CTA; pozostało 8 wystąpień = dług" |

### 1B. Nowe sprzeczności wprowadzone przez remediation

| ID | Konflikt | Strony | Rozstrzygnięcie |
|---|---|---|---|
| K-16 | Kolejność „Co dalej" vs „Akcje" w preview | `ARTIFACT_ANATOMY_STANDARD.md` §14.5 (Co dalej **przed** akcjami) vs `TABLE_AND_PREVIEW_CANON.md` (naprawione tego samego dnia) vs kod `StandardPreview.tsx` | Kod + TRIADA: **6. Akcje → 7. Co dalej (opcjonalny)**. Poprawić §14.5 |
| K-17 | Hex najgłębszej warstwy tła | `color-system.md` §1 `#020617` vs `visual-language.md` §3.1 `#0A0F1E` | `tailwind.config.js:184` → `navy-950 = #0A0F1E`. Poprawić `color-system.md` |
| K-18 | Sidebar: border-right | `light-mode-readability.md` §11 (`bg-white border-r border-slate-200`) vs `visual-language.md` §3.1/§4.2 (**MUST NOT** mieć border-right) | Kod `Sidebar.tsx:489`: `bg-slate-50`, **zero** `border-r`. Poprawić oba |
| K-19 | Hover wiersza tabeli | `color-system.md` §2.6b `hover:bg-slate-100/80` („APPROVED/ENFORCED") vs `light-mode-readability.md` §6 `bg-slate-50` (wprost „nie `bg-slate-100`") | Wybrać jedną; LMR ma uzasadnienie UX |
| K-20 | Kolor aktywnego taba | `color-system.md` §2.2 (`--c-focus-solid`) vs §2.6c (`--c-info`) — **w jednym pliku** | Rozstrzygnąć i ujednolicić |
| K-21 | Wzorzec aktywnej pozycji nawigacji | `light-mode-readability.md` §11 cytuje `NavItem.tsx` dla `border-l-2 border-c-info` | Plik **nie zawiera** tego wzorca; realnie `bg-slate-200/60 dark:bg-white/10`. Poprawić cytat albo dopisać wzorzec do kodu |
| K-22 | Szerokości panelu — dwa pominięte wystąpienia | `ARTIFACT_ANATOMY_STANDARD.md` §9.2b „Drawer/Sheet 360–480" i §15.2 „panel instrumentu 320–360" | Nota SYS-2 twierdzi, że sprowadziła 5 wartości do 2 — pominęła te dwie (480 > 420, 360 < 420). Doliczyć |

### 1C. Governance, który niczego nie egzekwuje

| ID | Problem | Dowód | Poprawka |
|---|---|---|---|
| K-23 | `lint:focus:ci` **nie jest wpięty** w `.husky/pre-commit` ani w żaden workflow CI | Hook ma 7 numerowanych bramek, `focus-canon` nie występuje | Dopisać krok do pre-commit dla diffów w `src/**/*.tsx` |
| K-24 | Skrypt **ślepy na pliki nieśledzone** — `list_scope_files()` używa `git ls-files` | Zademonstrowane: plik z 5 naruszeniami, nie `git add` → **exit 0** | Dodać ostrzeżenie dla nieśledzonych `.tsx` z naruszeniami |
| K-25 | `CLAUDE_DOCUMENTATION_HANDOFF.md` prowadzi następnego recenzenta do **unieważnionego** werdyktu 9,6/10 jako „ostatniego", bez wzmianki o czwartym audycie | To **dokładnie mechanizm, który spowoduje powtórzenie błędu w rundzie 5** | Przepisać kolejność czytania: `CANON.md` §9 v3.1 najpierw |
| K-26 | `DEEP_SKEPTICAL_AUDIT_ROUND_3` (9,6/10, `CLOSED_AFTER_REMEDIATION`) i `DOCUMENTATION_REACCEPTANCE` bez markera unieważnienia; łańcuch supersede przerwany | Czytelnik idący za linkami trafia na martwy punkt | Dopisać baner `SUPERSEDED → CANON.md §9 v3.1` do obu |

---

## 2. Odkrycie systemowe — narracja „fiolet jest martwy" jest częściowo fałszywa

**To jest najważniejsze znalezisko panelu i nie było znane wcześniej.**

`tailwind.config.js` (ok. linii 478–660) zawiera blok **„CENTRAL REMAP"**, który przepina domyślne nazwy Tailwinda — `blue`, `red`, `emerald`, `amber`, **`violet`, `indigo`, `purple`**, `rose` — na customową paletę HBS. Komentarz w kodzie: *„indigo/violet/purple → HBS Purple"* (`violet-500 = #80408D`).

Konsekwencje, których **żaden z czterech dokumentów fundamentu nie zna**:

1. Klasa `bg-violet-500` w tym projekcie **nie renderuje standardowego fioletu Tailwinda** — renderuje HBS Purple. Większość tabel kolorystycznych w `color-system.md`/`light-mode-readability.md` jest **niemożliwa do poprawnej interpretacji** bez tej wiedzy.
2. Nota w `color-system.md` §2.6b, że „Violet status" to „standardowa paleta Tailwind, niepowiązana z martwym fioletem-primary", jest **fałszywa** — to remapowana skala fioletowa, wizualnie nadal fiolet na ekranie.
3. `--c-info` = `#3b2883` ma hue ≈**252°** (indygo/fiolet), prawie identyczne z martwym `#7C3AED` (≈262°). Prawdziwy niebieski w tym systemie to `--c-focus-solid` `#2563eb` (≈221°). Dokumenty **wszędzie** nazywają `--c-info` „niebieskim" — Piotr zobaczy na zrzucie fiolet tam, gdzie dokument obiecuje jego koniec.

**Wymagane działanie:** udokumentować CENTRAL REMAP w warstwie fundamentu i przestać nazywać `--c-info` niebieskim. To nie jest kosmetyka — to podważa odbiór wzrokowy, który jest w tym projekcie nadrzędną metodą akceptacji.

---

## 3. P1 — zniekształcają skalę, nie wskazują na nieistniejący byt

- **K-27** `ARTIFACT_ANATOMY_STANDARD.md` §14.0: `ModuleMenu3.tsx` „użyć: 1" → realnie **27** importerów.
- **K-28** `ARTIFACT_ANATOMY_STANDARD.md`: trzy różne liczby dla `TableWithPreviewLayout` (25 / 28 / 28) w jednym dokumencie; realni konsumenci JSX = **18**, raw grep = 28. Brak zdefiniowanej metodologii liczenia „adopcji" — **do rozstrzygnięcia zanim ktokolwiek poprawi liczby**.
- **K-29** `TABLE_AND_PREVIEW_CANON.md`: `StatusPill`+`statusColors` „~34 callerów" → realnie 9–13.
- **K-30** `TABLE_AND_PREVIEW_CANON.md`: „Interview ma 5 ręcznych `<table>`, plik 8,9k linii" → 2 pliki, `InterviewHub.tsx` ma **10 015** linii.
- **K-31** `UI-ACTION-01`: `RowActionsMenu` „6 modułów" → 36 plików w ≥13 modułach.
- **K-32** `UI-STATUS-01`: `EntityStatusChip` „23 konsumentów" → 33 (import) / 45 (wzmianka).
- **K-33** `UI-SHELL-01`: sidebar „56/240 px" → `w-16`/`w-64` = **64/256 px**; rozjazd z `FOUNDATION_TOKEN_CONTRACT.md` nieodnotowany.
- **K-34** `FOUNDATION_TOKEN_CONTRACT.md` §7: mapowanie statusów wymienia `WAITING`/`AT_RISK` — klucze **nie istnieją** w `statusColors.ts` (jest `AWAITING_APPROVAL`). Osobno: `info` i `AI` sklejone w jeden wiersz przez „/" bez etykiety.
- **K-35** `FROZEN_LAYOUTS.md`: „Home" jako domyślny tab My Work → tab jest **wyfiltrowany** (`RADAR_ENABLED=false`), domyślny to `inbox`. Osobno: §138 odsyła do „niedomkniętego" rozjazdu, który już naprawiono.
- **K-36** `light-mode-readability.md` §18.1: „187 komórek dat `rgb(145,10,40)`" jako dowód crimson-leak — cytowane źródło (`MASTER_VISUAL_QA_CATALOG.md` VIS-002) **odrzuca** ten wniosek („intencjonalny aging config").
- **K-37** `UI-REL-01` §17: „zero trafień" na relacje w `NModeLayout/` — grep był za wąski, `src/components/shared/PreviewPane/PreviewRelations.tsx` istnieje.
- **K-38** Sekcje **13 i 15** we wszystkich kartach: 3 zdania wspólnego boilerplate + dokładnie 1 zdanie specyficzne. Formalnie „unikalne", merytorycznie recykling.
- **K-39** Skrypt `check-focus-canon.sh`: dynamiczna konstrukcja klasy (template literal, konkatenacja, `.join()`) omija wykrywanie w 100% — a `cn()`/`clsx` są w tym repo promowanym wzorcem.
- **K-40** `--update-baseline` pozwala jednym poleceniem wyzerować dług bez naprawy, bez żadnej autoryzacji.
- **K-41** `THEORETICAL_PHASE_CLOSURE` §5.2 sprawdza **obecność** czterech pól dowodowych, nie ich prawdziwość — agent może wpisać dowolną treść i formalnie zamknąć bramkę.
- **K-42** SPEC-W pkt 8 (idempotency): nazwany, nie zaprojektowany — brak informacji, kto generuje klucz, gdzie żyje, jaki TTL, co zwraca backend przy kolizji. Przywołany przykład (`AuditOrchestratorWizard.tsx:181`) implementuje **inny** mechanizm i sam nie ma ochrony przed duplikatem.
- **K-43** §13.3b (500 węzłów/750 krawędzi/50 ms): próg bez metody pomiaru. Test `m06-21-large-maps.spec.ts` jest `[MANUAL]`/skip; kod (`virtualization.ts`, `LargeMapOptimizer.tsx`) ma własne progi 150/300/500 i przyznaje brak occlusion culling >300 węzłów.
- **K-44** §13.3a (zakres AI) wpisany jako **DoD-blocking MUST** dla 6 artefaktów, mimo że system nie istnieje i nie ma planu wdrożenia. Dodatkowo wprowadza **trzecią** taksonomię AI obok istniejącej `tool→section→field` z `NModeLayout/types.ts`.
- **K-45** Changelog `ARTIFACT_ANATOMY_STANDARD.md`: wpis 1 („sprowadzone do jednej wartości") unieważniony przez wpis 4 tego samego dnia, bez oznaczenia.

---

## 4. Kolejność wykonania

1. **K-23, K-24, K-25, K-26** — governance. Bez tego runda 5 powtórzy błąd rundy 3. Najtańsze i najważniejsze.
2. **K-01…K-15** — fałszywe fakty o kodzie. Każdy z nich wysyła agenta lub dewelopera pod nieistniejący adres.
3. **Sekcja 2 (CENTRAL REMAP + `--c-info` to nie niebieski)** — udokumentować w warstwie fundamentu; wpływa na odbiór wzrokowy.
4. **K-16…K-22** — sprzeczności wprowadzone przez remediation.
5. **K-42, K-43, K-44** — kontrakty, które nazywają problem zamiast go rozwiązywać; albo dokończyć projekt, albo zdjąć status blokujący DoD.
6. **K-27…K-41, K-45** — liczby i porządek. Przed poprawą liczb **ustalić metodologię liczenia „konsumenta"** (import vs JSX vs wzmianka) — inaczej poprawimy je na inne błędne.

## 5. Czego nadal nie wolno uznać za odebrane

Bez zmian względem czwartego audytu: **nic**. Wszystkie 26 rodzin pozostaje `runtime_status: PARTIAL`, zero wpisów `RUNTIME_ACCEPTED`. Dodatkowo, do czasu wykonania sekcji 1A:

- **dokumentacja nie może służyć jako wiążąca mapa kodu (binding)** — 25 twierdzeń o kodzie jest fałszywych, w tym w `CANON.md` §6 i `TRIADA_KANON.md`;
- **`lint:focus` nie jest bramką** — jest ochotniczym miernikiem, dopóki nie zostanie wpięty (K-23);
- **żaden dokument nie może twierdzić, że fiolet zniknął z produktu** — CENTRAL REMAP renderuje go pod zremapowanymi nazwami, a `--c-info` jest indygo.

## 6. Co faktycznie działa (żeby nie wylać dziecka z kąpielą)

- **Rejestr delt D-01…D-05 odtwarza się w 5/5** — wszystkie liczby zweryfikowane niezależnie. Jedyny fragment governance bez zastrzeżeń.
- Obszary największego ryzyka (`clamp(340px,28%,480px)`, dług fokusa) — poprawne we **wszystkich** miejscach cytowania.
- Karty **UI-CANVAS-01 (9/10), UI-TABLE-01 i UI-CREATE-01 (8,5/10), UI-AI-01 (8/10)** — realnie użyteczne, z twardymi liczbami i uczciwym przyznaniem, że referencyjna implementacja nie spełnia własnego kontraktu.
- 16 z 26 kart przeszło weryfikację faktograficzną **bez zastrzeżeń**.
- `TABLE_AND_PREVIEW_CANON.md` przestał rościć sobie wyłączność — ten konkretny konflikt jest realnie naprawiony.
- Dojrzałe sekcje `light-mode-readability.md` (progi WCAG §9, test grayscale §8, macierz stanów §10) przetrwały remediation nieuszkodzone.
