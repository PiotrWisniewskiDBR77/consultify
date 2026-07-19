# Micro-interactions — CANON

**Status:** Standard (Vegas Faza 0, VF0-9) · **Autorytet:** podległy `CANON.md` §6 (Doc ↔ Kod binding)
**Zakres:** 12 wzorców mikro-interakcji, lista **ZAMROŻONA** — nie rozszerzać bez decyzji PO/CTO
(procedura CANON §3.1). Jeśli potrzebujesz 13. wzorca — opisz problem, nie dopisuj po cichu.

> To jest **specyfikacja + inwentaryzacja**, nie implementacja. VF0-9 celowo nie dotyka `src/` —
> każdy wzorzec ma status **✅ ISTNIEJE** (kod już to robi, zwykle *prawie* zgodnie) albo
> **⬜ DO ZROBIENIA** (VF2-8), ze wskazanym plikiem gdzie ma wylądować.

---

## 0. Wspólne tokeny (SSOT)

Wszystkie 12 wzorców czerpie z tej samej, już istniejącej puli — **zero nowych tokenów** w tym dokumencie.

| Token | Wartość | Plik SSOT |
|---|---|---|
| `--motion-fast` | 120ms | `src/index.css` (blok `:root`, sekcja „VF0-4 MOTION TOKENS”) |
| `--motion-base` | 180ms | j.w. |
| `--motion-slow` | 220ms | j.w. — **to jest sufit. Nic w tym katalogu nie animuje dłużej.** |
| `--motion-ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | j.w. |
| Tailwind mosty | `duration-fast/base/slow` + `ease-standard` | `tailwind.config.js` (`transitionDuration.fast/base/slow` → `var(--motion-*)`, `transitionTimingFunction.standard`) |
| `--elevation-0..3` | flat→modal shadow ramp | `src/index.css` (sekcja „VF0-5 ELEVATION TOKENS”) — **zdefiniowane, ale jeszcze NIEKONSUMOWANE przez żaden komponent** (patrz wzorzec 7) |
| `--state-hover/press/selected` | color-mix z `--c-text` 6/10/8% | `src/index.css` (sekcja „VF0-6 STATE-LAYER TOKENS”) |
| Reduce-motion switch | klasa `html.reduce-motion` na `<html>` | `src/index.css` L720-723 (`html.reduce-motion * { … }` — zabija animacje/transitions globalnie) |

**Pułapka wykryta przy audycie:** obok kanonicznych `duration-fast/base/slow` w `tailwind.config.js` L836-840
żyje **równoległa, starsza** skala `hig-fast` (100ms) / `hig-slow` (300ms) / `hig-slower` (400ms) —
`hig-slow`/`hig-slower` **przekraczają sufit 220ms**. Żaden z 12 wzorców poniżej nie powinien po nią
sięgać; jeśli grep znajdzie `duration-hig-slow`/`duration-hig-slower` na nowym kodzie — to regresja.

**Reguła reduce-motion (domyślna dla wszystkich 12, o ile nie zaznaczono inaczej):** żadnych
przesunięć/skali/pulsów — zostaje **tylko** natychmiastowa zmiana `opacity 0/1` (bez tween) albo
stan końcowy wprost, bez przejścia. Egzekwowane globalnie przez `html.reduce-motion` (index.css
L720-723) — komponent nie musi pisać własnego media-query, wystarczy że używa klas
`transition-*`/`animate-*` normalnie i globalny override je wyłącza. Wyjątek: biblioteki animacji
JS (Framer Motion) **nie są objęte** tym globalnym CSS-em — potrzebują własnego
`useReducedMotion()`/`prefers-reduced-motion` guardu w komponencie (patrz pułapki per-wzorzec niżej).

---

## 1. Hover-reveal akcji wiersza

- **Trigger:** `:hover` / `:focus-within` na wierszu/karcie (mysz LUB klawiatura — nie tylko `:hover`).
- **Co się animuje:** `opacity 0 → 1` na kontenerze akcji (nigdy layout/width — zero przesuwania sąsiednich kolumn).
- **Token:** `transition-opacity` + `duration-fast` `ease-standard`.
- **Reduced motion:** natychmiastowy skok opacity (bez tween) — pokryte globalnym `html.reduce-motion`.
- **Status:** ✅ ISTNIEJE, częściowo bez tokena.
  - `src/components/standard/StandardGridCard.tsx` L166: `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[open=true]:opacity-100 transition-opacity` — ma `:focus-within`, **ale brak `duration-fast`** (Tailwind default = 150ms, nie token).
  - `src/components/standard/StandardKanbanCard.tsx` L145: grab-handle `opacity-0 group-hover:opacity-100 transition-opacity` — sam problem (brak tokena).
  - **DO ZROBIENIA (VF2-8):** dopisać `duration-fast` do obu miejsc — literal→token refactor, zero zmiany wizualnej (zgodnie z wzorcem VF0-4).

---

## 2. Otwarcie/zamknięcie kebaba

- **Trigger:** klik/Enter na przycisku kebab.
- **Co się animuje:** dropdown panel — `fade-in + zoom-in` z 95%→100% skali (subtelne, nie „pop”).
- **Token:** obecnie `animate-in fade-in-0 zoom-in-95` (tailwindcss-animate, domyślny czas biblioteki
  ≈150ms — **nie jest to jawnie `--motion-fast`**, tylko przypadkowo bliskie).
- **Reduced motion:** brak zoom/fade — panel po prostu jest lub go nie ma.
- **Status:** ✅ ISTNIEJE, ale bez jawnego bindingu do tokena.
  - `src/components/shared/RowActionsMenu.tsx` L256: `className="fixed z-context-menu … animate-in fade-in-0 zoom-in-95"`.
  - **Pułapka:** `tailwindcss-animate` ma własną skalę czasu niezależną od `--motion-*` — jeśli ktoś
    kiedyś zmieni `--motion-fast`, ten komponent **nie** podąży. Do rozważenia w VF2-8: albo zaakceptować
    rozjazd (utility ma swój, ustabilizowany czas), albo przepisać na `transition-` + `duration-fast`.

---

## 3. Accordion prawego panelu

- **Trigger:** klik nagłówka sekcji (`aria-expanded`).
- **Co się animuje:** obrót chevronu (`rotate 0 → -90deg`) + wysokość zawartości (collapse/expand).
- **Token:** `transition-transform duration-base ease-standard`.
- **Reduced motion:** `motion-reduce:transition-none` — klasa Tailwind **na komponencie**, nie polega
  wyłącznie na globalnym `html.reduce-motion` (podwójne pokrycie, celowe).
- **Status:** ✅ ISTNIEJE — **wzorzec referencyjny, najbliżej ideału z całej dwunastki.**
  - `src/components/standard/ArtifactRightPanel.tsx` L112-118: chevron
    `shrink-0 text-c-text-muted transition-transform duration-base ease-standard ${open ? '' : '-rotate-90'} motion-reduce:transition-none`,
    trigger `aria-expanded={open}` + `focus-visible:ring-2 ring-[color:var(--c-focus)]`.
  - **Do przejęcia jako wzorzec** przy dorabianiu innych 11 (jedyne miejsce, które już łączy token +
    `motion-reduce:` + `aria-expanded` + focus-ring w jednym elemencie).

---

## 4. Toast enter/exit

- **Trigger:** wywołanie `toast()` (enter) / timeout lub ręczne zamknięcie (exit).
- **Co się animuje:** wjazd z krawędzi (`x`/`y` offset → 0) + opacity; wyjazd = odwrotność.
- **Token (docelowo):** `duration-fast` enter, `duration-fast` exit, `ease-standard` — **zero spring**.
- **Reduced motion:** natychmiastowe pojawienie/zniknięcie (opacity skok), zero offsetu.
- **Status:** ✅ ISTNIEJE, **ale narusza „zero bounce/spring” (CANON §9.1 MUST).**
  - `src/components/ui/primitives/Toast.tsx` L167: enter = Framer Motion
    `transition: { type: 'spring', stiffness: 500, damping: 30 }` — to jest bounce z definicji.
  - Ten sam plik, exit L169-173: `transition: { duration: 0.15 }` — 150ms, w duchu `--motion-fast`
    ale **hardcoded literal**, nie import tokena.
  - **Pułapka (najważniejsza z całego audytu):** to jest jawne złamanie reguły „zero bounce jako
    default” z `00-foundation/visual-language.md` §9.1 — istnieje DZIŚ na `origin/demo`, nie jest
    hipotetyczne. **DO ZROBIENIA (VF2-8, priorytet):** zamienić spring na
    `{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }` (odzwierciedla `--motion-fast`/`--motion-ease`
    jako literały JS — Framer Motion nie czyta CSS custom properties bezpośrednio).
  - Drugi plik toastów, `src/components/ui/toast.tsx` (Radix-style), używa `transition-all` — sam
    w sobie zbanowany wzorzec przez `npm run lint:motion` (patrz CANON §6 wiersz Motion). Do naprawy
    razem.

---

## 5. Skeleton → content crossfade

- **Trigger:** dane wracają z API (`isLoading: true → false`).
- **Co się animuje:** fade-out skeletona + fade-in treści — **NIE** twardy swap (layout shift = 0,
  bo skeleton ma zajmować dokładnie kształt treści, zgodnie z `empty-loading-states.md`).
- **Token:** `transition-opacity duration-base ease-standard`.
- **Reduced motion:** twardy swap bez fade — dozwolone (nie ma tu przesunięcia/skali do wyłączenia).
- **Status:** ⬜ DO ZROBIENIA — skeleton sam w sobie istnieje, ale **crossfade przy przejściu nie**.
  - Skeleton: `src/components/ui/primitives/Skeleton.tsx` (`animate-hig-skeleton`, shimmer),
    `src/components/shared/states/SkeletonState.tsx` (`animate-pulse`) — oba tylko animują SIEBIE
    (shimmer), zero animacji PRZEJŚCIA do realnej treści.
  - **Miejsce docelowe (VF2-8):** tam gdzie skeleton jest warunkowo renderowany zamiast treści
    (per-moduł, np. `StandardTable.tsx`/`StandardPreview.tsx` loading branch) — dodać wspólny
    wrapper/hook robiący `AnimatePresence`-owy lub czysto CSS-owy crossfade zamiast `{loading ? <Skeleton/> : <Content/>}` w miejscu.

---

## 6. Przejście lista → preview

- **Trigger:** klik wiersza w `StandardTable` → otwarcie `StandardPreview`.
- **Co się animuje (docelowo):** panel preview wjeżdża/fade-in z prawej krawędzi.
- **Token (docelowo):** `duration-base ease-standard`.
- **Reduced motion:** natychmiastowe pojawienie, zero wjazdu.
- **Status:** ⬜ DO ZROBIENIA — dziś **zero animacji**.
  - `src/components/standard/StandardPreview.tsx` — zero `motion`/`AnimatePresence`/`transition-transform`
    w całym pliku poza wewnętrznymi przyciskami; sam panel montuje się/odmontowuje bez żadnego przejścia.
  - **Miejsce docelowe (VF2-8):** `StandardPreview.tsx` (root wrapper) — najprawdopodobniej
    `AnimatePresence` + `initial/animate/exit` na kontenerze panelu, analogicznie do `Modal.tsx`
    (wzorzec 9), ale bez overlay/scale — tylko slide+fade.

---

## 7. Drag kanban

- **Trigger:** rozpoczęcie przeciągania karty (`dnd-kit` `onDragStart`).
- **Co się animuje:** **WYŁĄCZNIE** `scale: 1.02` + podniesienie o jeden stopień `--elevation-*`.
  **ZAKAZ** dodatkowego `box-shadow` ad-hoc (poza elevation-tokenem) i **ZAKAZ tiltu/rotacji** —
  to jest jawny zakaz z briefu, nie domysł.
- **Token:** `transform: scale(1.02)` + `box-shadow: var(--elevation-2)`, `duration-fast ease-standard`.
- **Reduced motion:** zero scale-animacji (skok od razu do 1.02 albo — bezpieczniej — pomiń scale,
  zostaw tylko zmianę elevation/opacity, bo scale to animacja przesunięcia percepcyjnego).
- **Status:** ⬜ DO ZROBIENIA — dziś karta podczas drag tylko przygasa, zero scale/elevation.
  - `src/components/standard/StandardKanbanCard.tsx` L134-137: `isDragging && 'opacity-40'` —
    **to wszystko**. Brak `scale`, brak podniesienia cienia.
  - `--elevation-0..3` już istnieją w `src/index.css` (sekcja VF0-5) **ale committed jako
    „zdefiniowane, NIEKONSUMOWANE przez żaden komponent”** (dosłowny komentarz w kodzie) — StandardKanbanCard
    jest właśnie wskazanym w tym komentarzu kandydatem, czekającym na zatwierdzony zrzut (CLAUDE.md §7).
  - **Pułapka:** VF0-5 świadomie NIE podłączył elevation do `StandardKanbanCard`, bo `--elevation-2`
    różni się między light/dark (nie jest theme-invariant jak obecny `shadow-token-card-hover`) — więc
    podłączenie zmieni wygląd w dark mode i **wymaga zrzutu + akceptu Piotra przed wejściem**, nie jest to
    czysty no-op token swap jak większość pozostałych 11 wzorców.

---

## 8. Pstryczek kolumn

- **Trigger:** klik na przycisk „Kolumny” → otwarcie menu wyboru widocznych kolumn.
- **Co się animuje:** dropdown panel — `fade-in + y: 8→0`.
- **Token (docelowo):** `duration-fast ease-standard` (aktualnie Framer Motion literal `0.12` = 120ms,
  liczbowo zgodne z `--motion-fast`, ale **nie jest to import tokena** — zbieżność, nie binding).
- **Reduced motion:** brak `y`-offsetu, tylko opacity skok — **wymaga własnego guardu**, bo to Framer
  Motion (nie łapie go globalny `html.reduce-motion` CSS-owy).
- **Status:** ✅ ISTNIEJE, bez formalnego tokena i bez reduce-motion guardu.
  - `src/components/MyWork/shared/ColumnConfigMenu.tsx` L64-68:
    `<motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} transition={{duration:0.12}}>`.
  - **DO ZROBIENIA (VF2-8):** dodać `useReducedMotion()` (Framer Motion hook) i skrócić do samego
    opacity gdy `true` — dziś nie ma tego guardu nigdzie w pliku.

---

## 9. Modal enter

- **Trigger:** otwarcie modala (`open: false → true`).
- **Co się animuje:** overlay fade-in + panel `scale 0.95→1` + `opacity 0→1`.
- **Token (docelowo):** `duration-base ease-standard` (aktualnie literal `duration: 0.15` = 150ms,
  między `--motion-fast` a `--motion-base`, hardcoded).
- **Reduced motion:** brak scale, tylko opacity — **wymaga własnego guardu** (Framer Motion, jak wyżej).
- **Status:** ✅ ISTNIEJE, bez tokena i bez reduce-motion guardu.
  - `src/components/ui/primitives/Modal.tsx` L156-165 (overlay), L169-194 (panel):
    `transition={{ duration: 0.15 }}` na obu warstwach — jeden z niewielu miejsc gdzie enter/exit
    przynajmniej **nie** używa springa (zgodne z „zero bounce”), ale nadal literal, nie token.
  - **DO ZROBIENIA (VF2-8):** zamienić `0.15` na stałą JS mirror'ującą `--motion-base` (0.18) albo
    zostawić 0.15 świadomie jako „modal enter jest odrobinę szybszy niż base” — decyzja do zapisania
    w changelogu przy realizacji, nie do zgadnięcia teraz.

---

## 10. Fokus-ring pojawienie

- **Trigger:** `:focus-visible` (klawiatura, nie mysz).
- **Co się animuje:** domyślnie **nic** (outline pojawia się natychmiast — to jest właściwe zachowanie,
  fokus musi być instant, nie „ease in”). Jedyny opcjonalny wariant animowany to ustawienie
  dostępności `focus-style-animated` — tam outline **pulsuje** (nie „pojawia się z animacją", tylko
  ciągły puls jako wzmocniona widoczność dla słabowidzących).
- **Token:** `--c-focus-solid` (kolor, NIEBIESKI — nigdy crimson/accent, decyzja Piotra 2026-07-04)
  + `animation: focus-pulse 1.2s ease-in-out infinite` (tylko w wariancie animowanym).
- **Reduced motion:** `html.reduce-motion.focus-style-animated :focus-visible { animation: none; }`
  — jedyny wzorzec z 12 gdzie reduce-motion ma **własną, dedykowaną regułę** (nie tylko poleganie na
  globalnym killer-selectorze).
- **Status:** ✅ ISTNIEJE KOMPLETNIE — drugi wzorzec referencyjny obok accordionu (#3).
  - `src/index.css` L845-848 (`html.focus-highlight :focus-visible`, kolor+offset, bez animacji),
    L865-869 (`html.focus-style-animated :focus-visible`, + `focus-pulse` keyframes),
    L879-881 (`html.reduce-motion.focus-style-animated` override).
  - Nic do zrobienia w VF2-8 dla tego wzorca — już zgodny z regułą ≤220ms (puls to opcjonalny a11y-boost,
    nie wchodzi w budżet czasu pojawienia).

---

## 11. Streaming Teresy

- **Trigger:** przychodzący token/chunk podczas streamu odpowiedzi AI.
- **Co się MA animować:** **wyłącznie nowo dodane węzły DOM** (nowa linia/blok tekstu, nowy krok
  "thinking") — fade-in/slide krótki, lokalny. **ZAKAZ** animowania/pulsowania całego kontenera
  wiadomości przy każdym chunku (to jest "repaint całości", explicite zabroniony wzorzec).
- **Token (docelowo):** `transition-opacity duration-fast ease-standard` na per-node wrapperze
  (nie na całej bąbelku).
- **Reduced motion:** brak animacji per-node, tekst po prostu się pojawia (już tak działa naturalnie,
  bo tekst jest przyrostowy niezależnie od CSS).
- **Status:** ⬜ DO ZROBIENIA — **dziś dokładnie odwrotnie niż spec, to jest realna regresja, nie tylko brak.**
  - `src/components/AIChat/Messages/MessageBubble.tsx` L168-177: cały kontener bąbelka dostaje
    `${isStreaming ? 'animate-pulse' : ''}` — Tailwind `animate-pulse` = keyframe opacity na CAŁYM
    elemencie, w kółko, dopóki trwa stream. To jest **dokładnie** "animacja całości" zabroniona przez brief.
  - `src/components/AIChat/Messages/InlineThinkingStream.tsx` L144: `transition-all duration-300
    ease-in-out` na kontenerze kroków — `transition-all` to jeden z 3 twardych naruszeń z
    `npm run lint:motion` (CANON §6), `duration-300` też przekracza sufit 220ms. L53/57/61:
    `animate-bounce` na trzech kropkach loadera — `animate-bounce` to **drugie** z 3 twardych naruszeń
    lint:motion, obecne w tym samym pliku.
  - **DO ZROBIENIA (VF2-8, priorytet — to jest zarówno brief-gap jak i istniejący dług lint:motion):**
    (a) zdjąć `animate-pulse` z całego bąbelka w `MessageBubble.tsx`, zastąpić per-node fade wewnątrz
    renderera treści (`MessageRenderer.tsx` już keyuje bloki per `${path}-${idx}` — punkt zaczepienia
    do owinięcia nowych/zmienionych kluczy w krótki fade); (b) w `InlineThinkingStream.tsx` zamienić
    `transition-all duration-300` → `transition-opacity duration-fast`, `animate-bounce` → coś bez
    banned-listy (np. sekwencyjny `animate-pulse` z opóźnieniem, albo prosty CSS `@keyframes` ≤220ms).

---

## 12. Zapis-potwierdzenie

- **Trigger:** `isDirty → saving → saved` (autosave lub explicit save).
- **Co się animuje:** zmiana koloru/ikony przycisku zapisu (blue "Zapisz" → spinner "Zapisywanie" →
  neutralny/slate "Zapisano") — **subtelnie, bez zielonego flasha** (explicit zakaz z briefu — kolor
  sukcesu nie jest zielony, jest neutralny, bo to nie jest "achievement", to jest stan spoczynku).
- **Token:** `transition-all duration-fast ease-standard` na przycisku (⚠ patrz pułapka niżej — to
  jest jedno z rzadkich miejsc gdzie `transition-all` faktycznie occurs, bo zmieniają się i kolor i
  border i (przy hover) skala; do weryfikacji czy `lint:motion` go łapie).
- **Reduced motion:** `whileHover`/`whileTap` scale (Framer Motion) powinny zanikać — brak dedykowanego
  guardu dziś (jak w #8/#9).
- **Status:** ✅ ISTNIEJE — **najbliższy zgodności z regułą "bez zielonego flasha" ze wszystkich 12.**
  - `src/components/shared/NModeLayout/NModeHeader.tsx` L84-116: stan-maszyna `saveCopy` z 4 stanami
    (`saved`/`saving`/`dirty`/`error`) — `saved` = `bg-slate-100/70 … text-slate-600` (neutralne, **nie
    zielone**), `saving` = niebieski + `Loader2` spin, `error` = `danger-*`. Przycisk: L199
    `transition-all duration-fast ease-standard`.
  - **Uwaga:** `src/contexts/AutoSaveContext.tsx` (stan `saved/saving/unsaved/error`) istnieje jako
    osobny, **sierocy** kontekst — `useAutoSave()` nie ma żadnego konsumenta w `src/components/` (grep
    zero trafień). Nie jest to plik SSOT dla tego wzorca — realna implementacja żyje w `NModeHeader.tsx`,
    który ma własny lokalny `effectiveSaveState`, niezależny od tego kontekstu. Nie mylić przy VF2-8.
  - **DO ZROBIENIA (VF2-8, drobne):** sprawdzić `transition-all` na przycisku pod `lint:motion` — jeśli
    łapie jako naruszenie, zawęzić do `transition-[background-color,border-color,transform]`.

---

## 13. Podsumowanie: co już istnieje vs co czeka na VF2-8

| # | Wzorzec | Stan | Plik | Priorytet naprawy |
|---|---|---|---|---|
| 1 | Hover-reveal akcji wiersza | ✅ istnieje, brak tokena | `StandardGridCard.tsx`, `StandardKanbanCard.tsx` | niski (literal→token, no-op wizualny) |
| 2 | Kebab open/close | ✅ istnieje, biblioteka poza tokenem | `RowActionsMenu.tsx` | niski |
| 3 | Accordion prawego panelu | ✅ **referencyjne** | `ArtifactRightPanel.tsx` | brak |
| 4 | Toast enter/exit | ✅ istnieje, **narusza zero-spring** | `ui/primitives/Toast.tsx`, `ui/toast.tsx` | **wysoki** |
| 5 | Skeleton→content crossfade | ⬜ brak przejścia | docelowo per-moduł (np. `StandardTable.tsx`) | średni |
| 6 | Lista→preview | ⬜ zero animacji dziś | `StandardPreview.tsx` | średni |
| 7 | Drag kanban (scale+elevation) | ⬜ tylko opacity dziś | `StandardKanbanCard.tsx` | średni (wymaga zrzutu, dark-mode diff) |
| 8 | Pstryczek kolumn | ✅ istnieje, brak reduce-motion guard | `ColumnConfigMenu.tsx` | niski |
| 9 | Modal enter | ✅ istnieje, literal nie token | `ui/primitives/Modal.tsx` | niski |
| 10 | Fokus-ring pojawienie | ✅ **referencyjne, kompletne** | `src/index.css` L845-881 | brak |
| 11 | Streaming Teresy | ⬜ **dziś odwrotność specu (regresja)** | `MessageBubble.tsx`, `InlineThinkingStream.tsx` | **wysoki** |
| 12 | Zapis-potwierdzenie | ✅ istnieje, zgodne z „bez zielonego" | `NModeLayout/NModeHeader.tsx` | niski |

**Dwa realne priorytety dla VF2-8:** #4 (toast spring = jawne złamanie MUST z visual-language.md §9.1,
istnieje na `origin/demo` dziś) i #11 (streaming = cały bąbelek pulsuje zamiast tylko nowych węzłów —
dokładna odwrotność briefu, plus dwa z trzech twardych naruszeń `lint:motion` w tym samym pliku).

---

## 14. Nawigacja / powiązane dokumenty

- `docs/ui-standards/00-foundation/visual-language.md` §9 (reguła ogólna: 150-220ms, zero bounce) —
  ten dokument **doprecyzowuje** ją per-wzorzec, nie zastępuje.
- `docs/ui-standards/CANON.md` §6 (Doc↔Kod binding) — wiersz „Motion” tam wskazuje `npm run lint:motion`
  jako egzekwowanie ogólne; ten dokument wskazuje bindingi **per-wzorzec**.
- `docs/ui-standards/TRIADA_KANON.md` — wzorce 1/2/6/8 (hover-reveal, kebab, lista→preview, kolumny)
  żyją wewnątrz komponentów Triady (`src/components/standard/`).
- `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` — wzorzec 3 (accordion prawego panelu) i 9
  (modal) żyją wewnątrz powłoki artefaktu.
