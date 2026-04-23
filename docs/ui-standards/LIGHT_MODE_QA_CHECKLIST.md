# Light Mode QA Checklist & Governance

> **Status:** Canonical (v3.2)
> **Scope:** Każdy PR zmieniający UI w light mode, quarterly regression sweep, audyt modułów operacyjnych.
> **Powiązane SSOT:** [`00-foundation/light-mode-readability.md`](./00-foundation/light-mode-readability.md), [`UI_UX_CANON_V3.md`](./UI_UX_CANON_V3.md)

---

## 1. Referencyjne ekrany

Każda zmiana UI w light mode musi przejść weryfikację na **5 referencyjnych ekranach**. Screeny (light mode, 100% zoom) dołączamy do PR opisu.

| # | Ekran | Route / komponent | Co weryfikujemy |
| --- | --- | --- | --- |
| 1 | **Inbox / Wnioski** | My Work → Decisions / Backlog | tabela + preview + status badge + grouped sections |
| 2 | **Executive Dashboard** | Executive hub | karty metryk + nagłówki + hierarchia warstw |
| 3 | **Interview / Discovery** | Interview workspace | formularze + helper surfaces + toolbary |
| 4 | **SuperAdmin Customers/Feedback** | `/superadmin/customers`, `/superadmin/feedback` | tabela + filtr + bulk action + drawer szczegółu |
| 5 | **Chat / AI Panel** | Split layout z chat rail | messages + composer + side panels |

### Kiedy wymagany screen?

- Dowolna zmiana w `src/components/ui/primitives/**` — **wszystkie 5**.
- Zmiana w `ResizableTable`, `DataTable`, `PreviewPaneShell` — **1, 4**.
- Zmiana w `MainLayout`, `Sidebar`, topbarach — **wszystkie 5**.
- Zmiana w `src/index.css` lub `tailwind.config.js` (tokeny) — **wszystkie 5**.
- Zmiana lokalna w jednym module — minimum ekran tego modułu.

---

## 2. Review checklist (per PR)

### A. Kontrast i tekst

- [ ] Czy tytuł / treść główna jest natychmiast czytelna (≥ 4.5:1)?
- [ ] Czy metadata jest czytelna bez wytężania wzroku (≥ 4.5:1)?
- [ ] Czy nie pojawił się `text-slate-400` dla treści roboczej (tylko disabled)?
- [ ] Czy wszystkie małe etykiety (≤ 12 px) mają co najmniej `text-slate-600`, a tintowane `text-*-700`?
- [ ] Czy nie ma pastelowego tekstu (`text-*-400/300`) na pastelowym tle (`bg-*-50/100`)?
- [ ] Czy `opacity < 1` nie buduje hierarchii tekstu?

### B. Surface i struktura

- [ ] Czy każdy ważny kontener ma co najmniej 2 środki separacji (tło + border / tło + shadow)?
- [ ] Czy hover i selected są widoczne przez tło/border (nie tylko kolor tekstu)?
- [ ] Czy tabela i preview pane są rozróżnialne bez zgadywania (wyraźny border `slate-200` lub gap `slate-100`)?
- [ ] Czy nie ma niewidzialnych borderów `border-*/10` / `border-*/20` w warstwach operacyjnych?
- [ ] Czy sidebar, topbar, preview tworzą jeden system warstw?

### C. Badge i statusy

- [ ] Czy badge statusu jest czytelny bez zoomu i bez dark mode?
- [ ] Czy badge ma pełny zestaw: tło `100` + border `200` + tekst `700/800`?
- [ ] Czy amber używa text-900 (nie 700)?
- [ ] Czy w grayscale statusy są nadal odróżnialne (tekst / ikona / kształt)?
- [ ] Czy badge nie jest zrobiony z `bg-*-500/20 text-*-400` (zakaz v3.2)?

### D. Stany interaktywne

- [ ] Czy każdy klikalny element ma widoczny focus-visible (ring-2, primary-500, offset-2)?
- [ ] Czy disabled jest rozpoznawalny poza samym `opacity` (kursor, jawne tło)?
- [ ] Czy state matrix (default / hover / selected / focus / pressed / disabled / error) jest kompletny?
- [ ] Czy `outline: none` nie pojawia się bez zastąpienia custom fokusem?

### E. Shell i spójność

- [ ] Czy decyzje kolorystyczne idą przez tokeny semantyczne / klasy `.lm-*` / `.admin-*`, a nie jednorazowe utility?
- [ ] Czy nie ma ad-hoc wariantów light/dark w kodzie modułów (miejsce na prymityw)?
- [ ] Czy tokeny `--surface-*`, `--text-*`, `--status-*` zostały użyte tam, gdzie to sensowne?

### F. Accessibility

- [ ] WCAG AA tekst 4.5:1 (zweryfikowane w Chrome DevTools lub Stark).
- [ ] Non-text contrast 3:1 dla borderów i selected state.
- [ ] Focus indicator ≥ 2 CSS px, kontrast ≥ 3:1 (WCAG 2.2 SC 2.4.13).
- [ ] Status nie polega wyłącznie na kolorze (ikona, tekst, kształt dodatkowo).
- [ ] `prefers-reduced-motion` szanowane dla animacji wejścia.

---

## 3. Automatyzowalne guardrails

Co da się zmechanizować (przyszła praca, rekomendacja):

### Lint rules (custom ESLint plugin lub simple regex CI check)

Zakazane wzorce w kodzie aplikacji (poza `src/components/ui/primitives/**`):

- `bg-\w+-(500|400)\/(10|20)\s+text-\w+-(300|400)` — pastel na pastel
- `text-slate-400(?!.*disabled)` — zbyt jasny tekst roboczy
- `border-\w+-\/[0-9]+` w komponentach tabeli / listy / preview
- `outline:\s*none` bez widocznego `focus-visible:` w sąsiedztwie

### Grep audit command (do uruchomienia przed każdym release light mode)

```sh
# 1. Forbidden badge patterns (should be 0 outside primitives).
rg -n 'bg-(blue|amber|emerald|red|purple|green|cyan)-500\/[12]0 text-\\1-(300|400)' consultify/src \
  --glob '!**/primitives/**'

# 2. Weak metadata text.
rg -n 'text-xs\s[^"]*text-slate-400' consultify/src

# 3. Missing borders on key surfaces.
rg -n 'bg-white[^"]*"[^"]*(?<!border-)' consultify/src/components/ui/ResizableTable
```

---

## 4. Quarterly regression sweep

Co kwartał należy:

1. **Przejrzeć 5 ekranów referencyjnych** (§1) w light mode. Dołączyć screeny do wewnętrznej Notion page "Light Mode QA {YYYY-QN}".
2. **Uruchomić grep audit** (§3).
3. **Zweryfikować tokeny** w `src/index.css` / `tailwind.config.js` — czy nowe komponenty przechodzą przez `--surface-*` / `--text-*` / `--status-*`.
4. **Sprawdzić nowe prymitywy / refaktory** — czy nie wprowadziły ad-hoc `text-*-400` / `bg-*/20` w warstwie view.
5. **Aktualizować standard** — jeśli pojawiły się nowe wzorce (compact density, nowy typ badge, nowe surface), dopisać w `light-mode-readability.md`.

### Definition of Done quarterly sweep

- [ ] Screeny 5 ekranów referencyjnych załączone i przejrzane.
- [ ] Grep audit = 0 nowych naruszeń w porównaniu do poprzedniego kwartału.
- [ ] Zmiany w prymitywach przeszły state matrix review.
- [ ] Dokumentacja zaktualizowana.
- [ ] Lista TODO regresji (jeśli coś zostało) wpisana do `light-mode-backlog.md`.

---

## 5. Governance

### Własność standardu

- **SSOT:** `docs/ui-standards/00-foundation/light-mode-readability.md` (kompletny kontrakt).
- **Canon v3:** `docs/ui-standards/UI_UX_CANON_V3.md` §1 (top-level reguły).
- **Tokeny:** `src/index.css` `:root` + `tailwind.config.js` `colors.{surface,content,edge,status,focus}`.
- **Klasy wspólne:** `src/index.css` `@layer components` (`.lm-*`, `.admin-*`, `.focus-ring`).
- **Prymitywy:** `src/components/ui/primitives/**` (Badge, Button, Input, Card, Tabs, Dropdown, Modal).

### Zasady aktualizacji

- Każda zmiana tokenu = aktualizacja standardu w dokumentacji.
- Każdy nowy prymityw = odniesienie do §standardu w komentarzu kodu.
- Każde odstępstwo (ekran marketingowy, print, canvas) = jawny wpis w `docs/ui-standards/00-foundation/canvas-mode.md` lub `docs/ui-standards/print-mode.md`.

### Eskalacja

Jeśli zespół ma wątpliwość, czy dana implementacja jest zgodna z light mode v3.2:

1. Sprawdź `light-mode-readability.md` §X.
2. Jeśli nadal nie jest jasne, otwórz PR draft z proponowanym wzorcem i requestem do review.
3. Po akceptacji, wzorzec wraca do standardu jako kolejna sekcja lub przykład.

---

## 6. Known gaps / backlog

Obszary rozpoznane ale niedomknięte w v3.2 (dla przyszłych sprintów):

- **Module-level sweep:** Pozostało ~500 ad-hoc wystąpień `bg-*/10-20 + text-*/400` w widokach modułów poza prymitywami. Migracja etapowa po najwyższym wpływie (MyWork, Interview, Studio, Admin settings).
- **Tokenizacja border-subtle:** rozważyć migrację `border-slate-200/50` / `border-white/5` na `border-edge-subtle` w kodzie.
- **Domyślny theme:** zmiana z `dark` na `system` w `uiSlice.ts` — wymaga decyzji produktowej + migracji istniejących użytkowników.
- **Mass badge adoption:** zastąpienie lokalnych implementacji badge komponentem `Badge` z `src/components/ui/primitives/Badge.tsx` lub klasami `.lm-badge-*`.
- **Data density switch:** ekspozycja `compact` vs `comfortable` jako ustawienie per-moduł (dziś zakodowane per-ekran).
- **Lint automation:** custom ESLint plugin wyłapujący zakazane wzorce z §3.

Te pozycje należy śledzić w module-specific backlogu, nie blokują core standardu.
