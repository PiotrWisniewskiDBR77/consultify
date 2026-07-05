# VISUAL_STANDARD.md — Consultify Design System v1

**Status:** PROPOZYCJA do akceptacji właściciela
**Data:** 2026-06-12
**Podstawa:** Visual Audit 2026-06-12 (Faza 1 + 1b + COMPONENT_ANALYSIS.md — ~70 screenshotów, 45 wariantów komponentów)
**Benchmark:** OpenAI (ChatGPT), Apple HIG, Google Material 3, Linear — standardy dark-UI 2026
**Podgląd:** `docs/standards/visual-standard-preview.html` (otwórz w przeglądarce)

---

## 0. Filozofia

1. **Neutral-first.** Powierzchnie i typografia niosą UI. Kolor jest rzadki i zawsze znaczy to samo.
2. **Czerwień = tożsamość + niebezpieczeństwo, nic więcej.** Audyt wykazał czerwień w 5 rolach semantycznych naraz. Nowy budżet czerwieni — patrz §2.3.
3. **Kontrast jest niedyskutowalny.** Żaden tekst informacyjny poniżej 4.5:1 (WCAG AA). Tekst główny celuje w ≥10:1.
4. **Jeden wzorzec na funkcję.** Jeden styl inputa, jeden primary button, jeden wzorzec tabów, jedna paleta statusów — w całej aplikacji.

---

## 1. Tokeny — powierzchnie i tekst

### 1.1 Powierzchnie (dark — motyw bazowy)

| Token | Wartość | Użycie |
|---|---|---|
| `--bg-base` | `#0A0F1E` | Tło aplikacji (bez zmian — tożsamość navy) |
| `--bg-surface` | `#0F172A` | Panele, inputy, wiersze tabel |
| `--bg-elevated` | `#15213B` | Karty, modale, dropdowny, tooltips |
| `--bg-hover` | `rgba(255,255,255,0.05)` | Hover wierszy, list, ghost-buttonów |
| `--bg-active` | `rgba(255,255,255,0.10)` | Stan wciśnięty / aktywna pozycja nav |

### 1.2 Bordery

| Token | Wartość | Użycie |
|---|---|---|
| `--border-subtle` | `rgba(148,163,184,0.12)` | Karty, separatory |
| `--border-default` | `rgba(148,163,184,0.22)` | Inputy, secondary buttons |
| `--border-strong` | `rgba(148,163,184,0.36)` | Hover inputów, aktywne kontrolki |

Zastępuje: `#2a3655`, `rgba(255,255,255,0.06/0.08)` i pozostałe wartości ad-hoc.

### 1.3 Tekst (dark) — z minimami kontrastu

| Token | Wartość | Kontrast na `--bg-base` | Użycie |
|---|---|---|---|
| `--text-primary` | `#F4F7FB` | ~16:1 | Tytuły, treść, dane tabel |
| `--text-secondary` | `#B8C4D6` | ~9:1 | Opisy, nieaktywne taby, etykiety |
| `--text-muted` | `#8A99B0` | ~5.5:1 | Placeholdery, pomocniczy, timestamps |
| `--text-disabled` | `#5D6B82` | ~3.1:1 | TYLKO disabled i dekoracje |

**Twarda reguła:** `--text-disabled` nie może nieść informacji. Wszystko, co użytkownik ma przeczytać, używa `--text-muted` lub jaśniejszego. To zamyka problem "za ciemnych liter na ciemnym tle" (audyt: tekst `#64748B` ≈ 3.5:1 używany informacyjnie).

### 1.4 Tekst na jasnych tłach (eksporty, jasne badge, przyszły light mode)

| Token | Wartość | Użycie |
|---|---|---|
| `--text-on-light-primary` | `#101828` | Treść na białym/jasnym |
| `--text-on-light-secondary` | `#475467` | Pomocniczy na jasnym |

**Twarda reguła:** na jasnym tle minimum `#475467` (≈7:1 na białym). Zakaz szarości jaśniejszych niż `#667085` dla tekstu informacyjnego. To zamyka problem "za jasnych liter na jasnym tle".

---

## 2. Tokeny — kolor funkcjonalny

### 2.1 Akcent marki

| Token | Wartość | Użycie |
|---|---|---|
| `--brand` | `#C9344F` | Crimson rozjaśniony pod dark bg (z `#A82D49`) |
| `--brand-deep` | `#A82D49` | Logo, materiały marketingowe |

### 2.2 Semantyka

| Token | Wartość | Znaczenie |
|---|---|---|
| `--info` | `#58A6FF` | Otwarte, nowe, przypisane, informacja |
| `--success` | `#3FB950` | Sukces, zatwierdzone, ukończone |
| `--warning` | `#E8A33D` | W toku, eskalacja, oczekuje |
| `--danger` | `#ED5565` | Błąd, krytyczne, destrukcja, przeterminowane |
| `--violet` | `#9D7BEA` | Zaplanowane, beta, przyszłe |
| `--focus` | `#5B8DEF` | Focus ring — JEDYNY kolor focusa |

Tinty pod badge/przyciski semantyczne: kolor przy `14%` alpha jako tło + pełny kolor jako tekst.

### 2.3 Budżet czerwieni (zamyka COLOR-01: 5 ról → 2 role)

Czerwień (`--brand` / `--danger`) występuje WYŁĄCZNIE w:

1. Logo / branding (sidebar "77", napisy marki)
2. Wskaźnik aktywnej pozycji sidebar — 2px lewa kreska (`--brand`)
3. CTA głosowe "Talk to Teresa" (`--brand`) — jedyny brand-moment w UI
4. Przyciski destrukcyjne: Delete, Reject, Stop (`--danger`)
5. Stany błędu i statusy Critical/Failed/Overdue (`--danger`)

Czerwień ZNIKA z: focus ringów, aktywnych tabów, filter pills, primary buttonów, badge "Open", gradientów przycisków, badge "TERESA".

---

## 3. Typografia

**Font:** Inter (bez zmian). **Wagi: 400 / 500 / 600** — nic ponad 600.

| Token | Rozmiar / lh / waga | Użycie |
|---|---|---|
| `display` | 32px / 1.2 / 600 | Hero ("Talk to Teresa, Piotr") — **z 48px** |
| `title` | 22px / 1.3 / 600 | Tytuły stron |
| `heading` | 17px / 1.4 / 600 | Nagłówki sekcji, tytuły kart i modali |
| `body` | 15px / 1.6 / 400 | Treść (odpowiedzi czatu, dokumenty) |
| `ui` | 14px / 1.45 / 400–500 | Domyślny UI: przyciski, dane tabel, inputy — **z 16px** |
| `caption` | 12px / 1.4 / 400 | Pomocniczy, timestamps |
| `overline` | 11px / 1.3 / 600, caps, ls 0.06em | Etykiety sekcji, NAGŁÓWKI TABEL |
| `micro` | 10px / 600 | Tylko liczniki (notyfikacje) |

Naprawia: hero 48/48 (lh 1.0 → 1.2), nagłówek tabeli = dane (16/16 → overline 11 vs ui 14), chaos 12–16px w przyciskach.

---

## 4. Geometria

| Token | Wartość | Użycie |
|---|---|---|
| `--r-control` | 8px | Przyciski, inputy, selecty, taby-pill |
| `--r-card` | 12px | Karty, kafelki, panele |
| `--r-modal` | 16px | Modale, popovery |
| `--r-pill` | 9999px | Badge statusów, filter chips, avatary, progress |

Wysokości: kontrolka 36px (sm 28px), wiersz tabeli 44px, input 38px.
Siatka odstępów: wielokrotności 4px (4/8/12/16/24/32).

Zamyka: 6px vs 8px vs 12px inputów, pill vs prostokąt przycisków, 4px beta-tag.

---

## 5. Komponenty

### 5.1 Przyciski (zamyka BTN: 4 kolory primary, 3 promienie, 3 font-size)

| Wariant | Tło | Tekst | Border | Użycie |
|---|---|---|---|---|
| **Primary** | `#F4F7FB` | `#0B1224` | — | Główna akcja widoku (1 na widok). Wzorzec OpenAI/Linear dark |
| **Secondary** | transparent | `--text-primary` | `--border-default` | Akcje drugorzędne, eksporty |
| **Ghost** | transparent | `--text-secondary` | — | Cancel, akcje pomocnicze; hover `--bg-hover` |
| **Destructive** | `--danger` | white | — | Delete, Reject, Stop |
| **Semantic-tint** | kolor @14% | kolor pełny | kolor @30% | Approve / Reject / Escalate w panelach decyzji |
| **Brand CTA** | `--brand` | white | — | WYŁĄCZNIE "Talk to Teresa" |

Wspólne: `--r-control` 8px (koniec z pill na przyciskach), h 36px, font 14/500, padding 0 16px. Disabled: 45% opacity + `cursor: not-allowed`. Loading: spinner zastępuje ikonę, szerokość stała.

### 5.2 Inputy (zamyka INPUT: 3 implementacje + focus=error)

Jedna specyfikacja: tło `--bg-surface`, border 1px `--border-default`, radius 8px, h 38px, font 14, placeholder `--text-muted`.

| Stan | Wygląd |
|---|---|
| Hover | border `--border-strong` |
| **Focus** | **border `--focus` + ring 3px `rgba(91,141,239,0.25)`** — koniec czerwonego focusa |
| Error | border `--danger` + ring 3px `rgba(237,85,101,0.2)` + komunikat 12px `--danger` pod polem |
| Disabled | 45% opacity |

Selecty: jeden custom wygląd (`appearance:none` + chevron Lucide). Checkbox/radio: `accent-color: var(--focus)` — koniec systemowego niebieskiego.

### 5.3 Badge statusów (zamyka BADGE: "Open" ×2, Submitted=Assigned, beta-tag 4px)

Forma: pill 9999px, 11px/600, padding 3px 10px, tło = kolor @14%, tekst = kolor pełny.

| Status | Kolor |
|---|---|
| Open, New, Assigned | `--info` niebieski |
| In Progress, Pending | `--warning` pomarańcz |
| Escalated, Medium | `--warning` |
| Approved, Completed, Submitted, Done | `--success` zielony |
| Critical, Failed, Overdue, High | `--danger` czerwony |
| Scheduled, Beta | `--violet` fiolet |
| Low, Draft, Archived, Coming Soon | szary `#8A99B0` |

`Assigned` (niebieski) vs `Submitted` (zielony) — różne rodziny kolorów, rozróżnialne przy skanowaniu. Badge NIGDY nie jest ucinany — kolumna ma `min-width`, a pełna nazwa w tooltipie przy overflow.

### 5.4 Tabele (zamyka TABLE: header=data 16px, brak hover, ucięte badge)

- Nagłówek: `overline` (11px caps 600 `--text-muted`), tło transparent, border-bottom `--border-subtle`
- Dane: 14px `--text-primary`, wiersz 44px
- Hover wiersza: `--bg-hover` — zawsze widoczny
- Selected: `--bg-active` + 2px lewa kreska `--info`
- Empty: standard §5.8

### 5.5 Nawigacja (zamyka NAV: niewidoczny active, 2 wzorce tabów)

**Sidebar — aktywna pozycja:** tło `--bg-active` + tekst/ikona `--text-primary` + **2px lewa kreska `--brand`** (jedno z 5 dozwolonych miejsc czerwieni). Nieaktywne: `--text-secondary`, hover `--bg-hover`.

**Taby (Menu 2, jeden wzorzec w całej aplikacji) — DECYZJA PIOTRA 2026-07-03: PILL (nie underline).** Wcześniejszy wzorzec underline został zastąpiony pigułką jak w My Work. Aktywny: NEUTRALNY wypełniony pill — `--c-surface-raised` + ramka `--c-border` + tekst `--c-text` (BEZ crimson; `primary`=crimson to pułapka). Nieaktywny: subtelna ramka `--c-border` + delikatne tło + `--text-muted`, hover rozjaśnia tło. SSOT klas: `MENU_2_TAB_ACTIVE`/`MENU_2_TAB_INACTIVE` (`src/components/shared/ModuleMenu3.tsx`) oraz `TAB_ACTIVE`/`TAB_INACTIVE` w `ModuleNavBar.tsx`.

**Filter chips (≠ taby):** pill — aktywny: `--bg-active` + `--text-primary` + border `--border-strong`; nieaktywny: transparent + `--text-muted` + border `--border-subtle`.

OUTPUT pills w chacie = filter chips (koniec ciemnoczerwonego "Auto").

### 5.6 Modale i overlaye (zamyka MODAL-01)

- **Backdrop ZAWSZE:** `rgba(2,6,18,0.65)` — każdy modal, bez wyjątków
- Kontener: `--bg-elevated`, radius 16px, border `--border-subtle`, max-w 560px
- Nagłówek: `heading` + X (ghost 32×32) w prawym górnym
- Stopka: akcje wyrównane do prawej, primary z prawej
- Dropdown: `--bg-elevated`, radius 8px, item h 36px, hover `--bg-hover`
- Tooltip: `--bg-elevated`, radius 6px, 12px tekst, pojawia się po 500ms

### 5.7 Toasty

Pozycja: dół-prawo. Kontener: `--bg-elevated`, radius 12px, border `--border-subtle`, ikona semantyczna (success/danger/info), tytuł 14/500, opis 12 `--text-secondary`, auto-dismiss 5s + X.

### 5.8 Empty states (zamyka EMPTY-01)

Każda lista/widok bez danych: ikona Lucide 32px `--text-muted` + tytuł 15/500 + opis 13 `--text-secondary` (1–2 zdania) + CTA (Primary lub Secondary). Zakaz pustych białych przestrzeni bez komunikatu.

### 5.9 Pozostałe

- **Progress bar:** wypełnienie `--success` (koniec lime `#9EC44D`), tor `rgba(255,255,255,0.08)`, h 4px, pill
- **Avatar:** 24/32/40px, tło `--bg-elevated`, inicjały `--text-secondary`, pill
- **Ikony:** Lucide outline (bez zmian — spójne), 16–20px, kolor dziedziczony
- **"COMING SOON":** przycisk widoczny, disabled 45%, szary badge `SOON` — komunikuje roadmapę
- **Loading:** skeleton dla list/tabel (tło `--bg-hover`, pulse), spinner tylko dla akcji w przyciskach

### 5.10 Chat

- Asymetria zostaje (wzorzec ChatGPT/Claude): user w bubble `--bg-elevated` radius 16/16/4/16, Teresa bez kontenera
- Branding "Consultify® DBR77" na pustym ekranie: zmniejszony do watermarku — 15px/500 przy 25% opacity (z ~48px/85%)
- Stop button: `--danger` (destrukcyjny — zgodny z budżetem czerwieni)
- Focus pola czatu: `--focus` niebieski

---

## 6. Mapa migracji (znalezisko → naprawa)

| Audyt | Problem | Naprawa wg standardu |
|---|---|---|
| COLOR-01 | czerwień ×5 ról | §2.3 budżet czerwieni |
| COLOR-02 / BTN | 4 kolory primary | §5.1 Primary = biały |
| INPUT-01 | focus = error | §5.2 focus `--focus` niebieski |
| INPUT-02 | 3 style inputów | §5.2 jedna specyfikacja |
| MODAL-01 | brak backdropu | §5.6 backdrop zawsze |
| BADGE-01 | "Open" ×2 kolory | §5.3 Open = `--info` |
| BADGE (Submitted=Assigned) | nierozróżnialne | §5.3 zielony vs niebieski |
| TABLE | header=data, brak hover | §5.4 |
| NAV | niewidoczny active, 2 wzorce tabów | §5.5 |
| TYPE | hero 48/1.0, chaos rozmiarów | §3 skala |
| VIS-008 | ucięte badge typów | §5.3 min-width + tooltip |
| VIS-023 | czerwony focus selectów | §5.2 |
| EMPTY-01 | puste listy bez komunikatu | §5.8 |
| Kontrast (uwaga właściciela) | za ciemne/za jasne litery | §1.3–1.4 twarde minima |

---

## 7. Wdrożenie (propozycja faz)

1. **Tokeny** — plik `tokens.css` / Tailwind config z §1–4; podmiana wartości ad-hoc
2. **Quick wins (P0):** backdrop modali, focus ring, hover tabel, kontrast `--text-disabled`→`--text-muted` w miejscach informacyjnych
3. **Przyciski + inputy** — ujednolicenie do §5.1–5.2
4. **Badge + tabele + nav** — §5.3–5.5
5. **Chat + empty states + reszta** — §5.8–5.10

Każda faza: zmiana → preview → screenshot → porównanie ze standardem (zgodnie z RULE: Verify before claiming).
