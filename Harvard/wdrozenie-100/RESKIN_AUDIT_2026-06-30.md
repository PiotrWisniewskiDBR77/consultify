# Audyt Wizualny — Re-skin App-wide
**Data:** 2026-06-30 | **Autor:** Harvard Strateg + 3 agenty Explore

---

## Tl;dr (dla Piotra po spotkaniach)

System tokenów `c.*` istnieje i jest poprawny. Problem: **~4% adherencji** (165 użyć na 4000+ miejsc z klasami kolorów). Aplikacja używa trzech konkurencyjnych palet i ma 4 403 wystąpień `primary` = czerwień crimson w miejscach które nie powinny być czerwone.

**Nie ma jednego bug do naprawienia — jest dług architektoniczny warstwy wizualnej.**

---

## System tokenów (co istnieje i jest poprawne)

Plik: `tailwind.config.js` + `src/index.css`

```
c.bg          → #0a0f1e (dark) / #fafaf9 (light)   — tło aplikacji
c.surface     → #0f172a (dark) / #ffffff (light)   — panele, karty
c.surface-raised → #15213b (dark)                  — popovers, chips
c.text        → #f4f7fb (dark) / #0f172a (light)   — tekst główny
c.text-secondary → #b8c4d6 / #475569
c.text-muted  → #8a99b0 / #64748b
c.accent      → #c8324a (dark) / #85182f (light)   — crimson (TYLKO brand moments)
c.success/warning/danger/info                       — semantyczne statusy
```

`darkMode: 'class'` + `<html class="dark">` globalnie ✅

---

## Trzy konkurencyjne palety (źródło chaosu)

| Paleta | Gdzie | Tło ciemne | Problem |
|--------|-------|-----------|---------|
| **navy-*** | Większość apki | `navy-950` (#0a1428) | Najbliższe `c.bg` ale nie identyczne |
| **slate-*** | StudioView, PresentationStudio | `slate-950` (#020617) | Inna czerń niż navy |
| **c.*** | ~4% kodu | `c.bg` (#0a0f1e) | Jedyna poprawna |

---

## Audyt per moduł

### A. Infrastruktura wspólna

| Komponent | Plik | Tło | c.* % | Największy problem |
|-----------|------|-----|-------|-------------------|
| **MainLayout** | `src/layouts/MainLayout.tsx` | `bg-slate-100 dark:bg-navy-950` | **0%** | Root shell bez tokenów — dziedziczą wszystkie moduły |
| **Sidebar** | `navigation/Sidebar/Sidebar.tsx` | `bg-slate-50 dark:bg-navy-950` | ~2% | `bg-slate-50` zamiast `bg-c-bg`; badge aktywny = crimson |
| **NavItem** | `navigation/Sidebar/NavItem.tsx` | - | ~20% | Tekst w c.* ✅, tła poza tokenami |
| **ModuleHub** | `shared/ModuleHub/ModuleHub.tsx` | `bg-slate-50 dark:bg-navy-950` | **0%** | Wrapper 5 hubów bez tokenów — jeden fix = 5 poprawionych |
| **ModuleNavBar** | `shared/ModuleHub/ModuleNavBar.tsx` | brak (topbar bez bg) | ~15% | `dark:bg-[#F4F7FB]` hex hardkodowany w CTA dark mode |
| **Button** | `ui/button.tsx` lub primitives | `bg-navy-900 dark:bg-[#F4F7FB]` | ~8% | `dark:bg-[#F4F7FB]` + `dark:hover:bg-[#DDE5EF]` — dwa hex hardkodowane |
| **Card** | `ui/card.tsx` | `bg-card` (shadcn var) | 0% | shadcn `bg-card` ≠ `bg-c-surface` — może się rozjechać |
| **Dialog** | `ui/dialog.tsx` | `bg-background` (shadcn) | 0% | shadcn var niezwalidowany vs c.* |
| **Tabs** | `ui/primitives/Tabs.tsx` | `bg-slate-100 dark:bg-navy-900` | ~5% | Hardkodowane tła; `c-info` tylko inline |
| **Badge (default!)** | `ui/badge.tsx` | `bg-primary` | **0%** | `bg-primary` = **crimson #85182F** — domyślna odznaka = czerwona! |

---

### B. Huby nawigacyjne

| Moduł | Tło wrapper | c.* % | Kluczowe problemy |
|-------|-------------|-------|------------------|
| **M13 InitiativesHub** | `bg-white dark:bg-navy-900` (modals) | **0%** | `text-primary-400` (crimson ikony), `dark:bg-[#F4F7FB]` hex CTA, 73 unikalne klasy kolorów |
| **M14 ExecutionHub** | `bg-white/80 dark:bg-navy-900/50` | ~4% | Crimson drag ring `ring-primary-500/50`; hex `dark:bg-[#F4F7FB]`; Kanban opacity tricks |
| **M15 ResultsHub** | `bg-white/80 dark:bg-white/[0.04]` | **0%** | `bg-white/80` → białe/szare w dark (to źródło M15-UI1 bug!); alpha-opacity zamiast tokenów |
| **M16 FinanceHub** | `bg-white dark:bg-navy-900` | **0%** | `focus:ring-primary-500/30` = crimson focus; **`dark:bg-slate-50` = BIAŁE w dark mode!** |
| **M24 Admin panele** | `bg-white dark:bg-white/5` | **0%** | `bg-white/5` = prawie transparentne (stary pattern); wszystkie 55 paneli bez tokenów |
| **M12B AssessmentHub** | `bg-white dark:bg-navy-900` | **0%** | `bg-primary-100 dark:bg-primary-900/30` = crimson tint na empty state |
| **Settings** | `bg-slate-50 dark:bg-navy-950` | **0%** | Spójne z MainLayout, ale oba poza tokenami |

---

### C. Edytory (canvas Ideas)

| Moduł | Tło | c.* % | Kluczowe problemy |
|-------|-----|-------|------------------|
| **M06 IdeaMapWorkspace** | `bg-white dark:bg-navy-950` | **0%** | `ring-primary-200/70` = crimson ring wokół canvasu; glassmorphism overlay bez tokenów |
| **M07 ProcessFlowTool** | `bg-white dark:bg-navy-950` | **0%** | **`dark:bg-[#0b1020]` hex hardkodowany** dla canvas; semantyczne indigo/emerald na panelach AI |
| **M09 WhiteboardTool** | `bg-white dark:bg-navy-950` | **0%** | Minimal — skeletons `bg-slate-100 dark:bg-navy-800` |

---

### D. Chat + Studio

| Moduł | Tło | c.* % | Kluczowe problemy |
|-------|-----|-------|------------------|
| **UnifiedChatPanel** | `bg-slate-50 dark:bg-navy-950` | **0%** | **AI bubble = `bg-primary-50 dark:bg-primary-900/50` = CZERWONE bąble AI!** Active icons crimson; quick prompts crimson hover |
| **StudioView** | `bg-slate-950` | **0%** | **Inna paleta niż reszta apki** (`slate-950` vs `navy-950`); własne `bg-blue-500/20` statusy |

---

## Trzy klasy długu (hierarchia ważności)

### Klasa 1 — CRIMSON TRAP (4 403 wystąpień `primary`)
`tailwind.config.js`: `primary.DEFAULT = #85182F` (crimson). Każde `text-primary`, `bg-primary`, `text-primary-400`, `bg-primary-500/10` = **czerwień**.

Dotyczy:
- Badge domyślny → czerwona odznaka
- Chat AI bubbles → czerwone bąble
- Active nav states → czerwona nawigacja  
- Focus rings → `ring-primary-500` = crimson focus (WCAG: focus ≠ error)
- Empty state icons → crimson ikony
- Drag borders w Kanban → crimson hover

**To nie jest zamierzone używanie crimson jako brand moment — to stary violet zamieniony na crimson bez korekty semantyki.**

### Klasa 2 — Hardkodowane hex (w dark mode!)
```
dark:bg-[#F4F7FB]     — Button.primary, ModuleNavBar, InitiativesHub (skopiowane wszędzie)
dark:hover:bg-[#DDE5EF] — Button.primary hover
dark:bg-[#0b1020]     — ProcessFlow canvas background
```
Hex w className = niemożliwe do globalnej zmiany przez token.

### Klasa 3 — Palety bez tokenów (ale z dark: prefixem — więc adaptywne)
`bg-slate-50 dark:bg-navy-950`, `bg-white dark:bg-navy-900` — pattern spójny wewnątrz siebie, ale poza systemem `c.*`. Łatwe do migracji automatem.

**Specjalny przypadek — antywzorce:**
- `FinanceHub: dark:bg-slate-50` → białe tło w dark mode (błąd!)
- `ResultsHub: bg-white/80 dark:bg-white/[0.04]` → M15 wygląda jasno bo `white/80` na dark tle = szare
- `StudioView: bg-slate-950` → trzecia paleta, różna od reszty apki

---

## Globalna statystyka

| Metryka | Wartość |
|---------|---------|
| Pliki TSX z `bg-white`/`bg-gray-50`/`bg-slate-*` | **1 767** |
| Wystąpienia hardkodowanych kolorów w views | **12 713** |
| Wystąpienia `primary` (= crimson) | **4 403** |
| Adherencja `c.*` tokenów | **~4%** (165 / 4000+) |
| Pliki z `dark:` prefixem | **1 982** (adaptywne ✅) |
| Shared UI components | **74** (~30% c.*) |
| Admin paneli (rozproszonych) | **55** |
| Hex hardkodowane w dark mode | co najmniej **3 unikalne** |

---

## Pięć najważniejszych fixów (efekt największy)

1. **MainLayout.tsx L182** — `bg-slate-100 dark:bg-navy-950` → `bg-c-bg` (root shell, radiuje na wszystko)
2. **UnifiedChatPanel** — `bg-primary-*` na AI bubbles → `bg-c-surface-raised` (chat = centralny produkt)
3. **ModuleHub L147** — `bg-slate-50 dark:bg-navy-950` → `bg-c-bg` (cascade na 5 hubów)
4. **Badge default** — `bg-primary` → `bg-c-surface-raised text-c-text` (czerwona odznaka wszędzie)
5. **ResultsHub** — `bg-white/80 dark:bg-white/[0.04]` → `bg-c-surface` (naprawia M15-UI1 jasny motyw)

---

## Pytania strategiczne (czekają na Piotra)

**D-K — Motyw bazowy:**
- Opcja A (rec. CTO): dark-only, usuń light-mode tokens z `:root`
- Opcja B: dual-mode zachowany (dark teraz, light możliwy post-GA)

**D-L — Automatyzacja:**
- Tak/Nie na skrypt half-auto sweep (Claude generuje diff, Piotr weryfikuje na demo per fala)?
- Bez tego 1767 plików = tygodnie, z tym = dni.

---

## Plan fal (5 fal, ~5-6 tygodni równolegle z D-I + Tor 3)

| Fala | Co | Czas | Efekt |
|------|----|------|-------|
| **0** | ESLint gate + token lock-in | 1d | Nowy dług zablokowany |
| **1** | 74 shared UI components | 3d | Radiuje wszędzie |
| **2** | MainLayout + ModuleHub + Admin CSS | 2d | Cascade na 5 hubów |
| **3** | Per-moduł residual (M13 432 instancji → M14 → M15) | 5-7d | Wszystkie huby czyste |
| **4** | 7 edytorów (sync z D-I, po sign-offie wzorca) | sync | Edytory w kanonie |
| **5** | StudioView + generatory + Panel Health | post-D-I | Koniec długu |
