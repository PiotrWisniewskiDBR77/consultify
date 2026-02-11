# DBR77 Visual Language Standard (KANON)

> **Wersja:** 1.0  
> **Data:** 2026-02-11  
> **Status:** OBOWIĄZUJĄCY  
> **Cel:** Jedna, spójna “warstwa wizualna” dla całej aplikacji (kolory, tła, ramki, typografia, spacing, depth, motion) – niezależnie od modułu i niezależnie od trybu prezentacji detail view.

---

## 0) Zasady nadrzędne (MUST)

- **Jedna aplikacja, jeden język wizualny.** Moduły i tryby widoku nie wprowadzają własnej palety, ramek, typografii ani “stylu kart”.
- **Minimalizm DBR77.** UI ma być “enterprise clean”: mniej ramek, więcej rytmu spacing + hierarchii typograficznej + subtelnych separatorów.
- **Semantyka kolorów jest święta.** Kolory oznaczają znaczenie (CTA / info / warning / danger / success), nie “ład”.
- **Dark mode jest pierwszoplanowy.** Każdy komponent musi wyglądać równie dobrze w `dark`.

---

## 1) Źródła prawdy (MUST)

To są jedyne kanoniczne źródła tokenów i reguł:

- **DBR77 colors & Apple HIG tokens:** `tailwind.config.js`
- **Globalne style i wzorce kontenerów:** `src/index.css`
- **Semantyka DBR77 color usage:** `docs/00_foundation/COLOR_SYSTEM_STANDARD.md`
- **Uwaga (legacy):** `packages/shared/src/ui/theme.ts` nie jest źródłem prawdy dla DBR77 (nie jest używany przez core UI) i nie może nadpisywać tokenów z Tailwinda.

> Jeśli standard mówi X, a komponent robi Y — komponent jest do poprawy (albo aktualizujemy standardy centralnie).

---

## 2) Kolory (KANON)

### 2.1 DBR77: 4 kolory semantyczne + neutral (MUST)

- **PRIMARY (`primary/*`)**: CTA, aktywny stan, focus, linki.
- **SECONDARY (`secondary/*`) / NEUTRAL NAVY (`navy/*`)**: nawigacja, UI chrome, neutralne tła i tekst.
- **DANGER (`danger/*`)**: błędy, destrukcja, alarm.
- **SUCCESS (`success/*`)**: potwierdzenie, “healthy/up”.
- **NEUTRAL (`navy/*`, `slate/*`)**: tła, bordery, tekst, separatory.

### 2.2 Kolory sygnałowe (MUST/SHOULD)

DBR77 dopuszcza dwa kolory sygnałowe (nie‑brandowe), **wyłącznie** dla sygnalizacji:

- **WARNING / AT RISK:** `amber/*`
- **INFO:** `blue/*`

**MUST:** ich użycie ograniczamy do `badge/dot/callout` (i ewentualnie tła typu surface).  
**MUST NOT:** nie używamy ich dla CTA ani jako stałego koloru nawigacji/ramek paneli.

---

## 3) Tła i surfaces (KANON)

### 3.1 App background (MUST)

- **Light:** `bg-slate-100`
- **Dark:** `bg-navy-950`

### 3.2 Standardowe powierzchnie (MUST)

- **Panel (header/rail/top chrome):**
  - light: `bg-white`
  - dark: `bg-navy-900`
- **Karty / kontenery treści:**
  - light: `bg-white border border-slate-200 rounded-xl`
  - dark: `dark:bg-navy-900/50 dark:border-white/10 rounded-xl`

**MUST:** max 1 poziom kontenera (zakaz “cards in cards” jako default).

---

## 4) Ramki, rounding, separatory (KANON)

### 4.1 Borders (MUST)

- Light:
  - granice: `border-slate-200`
  - subtelne separatory: `border-slate-100`
- Dark:
  - granice: `dark:border-white/10`
  - subtelne separatory: `dark:border-white/5`

### 4.2 Rounding (MUST)

- Karty/panele: `rounded-xl`
- Kontrolki (button/input): `rounded-lg`
- Badges/chips: `rounded-full`

---

## 5) Typografia (KANON)

### 5.1 Font (MUST)

- Bazowy font aplikacji: **Inter** (`font-sans`) – zgodnie z `tailwind.config.js`.

### 5.2 Skala i hierarchia (MUST)

- Metadane/etykiety: `text-xs` + `font-medium` + `tracking-wide` (oszczędnie, tylko dla label)
- Treść UI: `text-sm`
- Tytuły sekcji: `text-sm`/`text-base` + `font-semibold`
- Tytuł encji: `text-base`/`text-lg` + `font-semibold` (bez krzykliwych display fontów)

**SHOULD:** skala Apple HIG (`text-hig-*`) jest dozwolona, ale tylko konsekwentnie w całym ekranie/komponencie.

---

## 6) Spacing i gęstość (KANON)

**MUST:**

- Preferuj spójny rytm spacing (grupy 8/12/16/20/24px).
- Gęstość “tight but breathable”: minimalizm przez rytm, nie przez “pustkę”.

**SHOULD:** jeśli komponent jest premium/kluczowy, używaj tokenów `hig-*` z `tailwind.config.js`.

---

## 7) Depth / shadows (KANON)

**MUST:**

- Subtelna głębia jest preferowana nad grubymi ramkami.
- Dozwolone: `shadow-hig-*` (i `shadow-hig-dark-*` w dark) lub legacy `shadow-sm`.

---

## 8) Interakcje i dostępność (MUST)

- Focus jest zawsze widoczny i spójny (ring/shadow w semantyce `primary/*`).
- Hover/active są subtelne.
- Destrukcja zawsze `danger/*` + confirm.
- Empty/loading/error są “quiet” i spójne (bez udawania danych).

---

## 9) Motion (SHOULD)

- Animacje są krótkie (typowo 150–220ms) i wspierają orientację.
- Zakaz “ciężkich” animacji jako dekoracji w ekranach enterprise.

### 9.1 Motion tokens (KANON)

**MUST:**

- Czas trwania:
  - `fast`: 120–160ms (hover/active, focus transitions)
  - `base`: 160–220ms (otwieranie dropdown/tooltip/tab underline)
  - `slow`: 240–320ms (drawer/panel/rail, layout shift)
- Easing:
  - preferuj „soft” (ease-out / standard UI easing),
  - unikaj bounce/spring jako default (spring tylko dla “delight”, bardzo subtelnie).

**SHOULD:**

- Dla Framer Motion:
  - używaj `layout`/`layoutId` do płynnych przejść (np. underline taba),
  - preferuj małe przesunięcia \(2–6px\) zamiast dużych animacji.

### 9.2 Reduce motion (A11y) (MUST)

**MUST:**

- Wspieramy `prefers-reduced-motion`:
  - wyłączamy animacje przesunięć i skale,
  - zostawiamy tylko natychmiastowe stany (opacity 0/1 bez tween) lub minimalne.

### 9.3 Mikrointerakcje “tech‑sexy” (KANON, ale minimalistyczne)

To są dozwolone „smaczki”, które podnoszą premium feel bez krzykliwości.

**MUST (zalecane wszędzie):**

- Hover: delikatna zmiana tła (`slate-50` / `white/[0.02]`) + subtelny border shift.
- Active/press: krótki “press” (np. `active:scale-[0.98]`) tylko na buttonach/tiles, nie na tabelach.
- Focus: ring/spójny z `primary/*` + brak “jumpingu” layoutu.
- Skeleton: płynny shimmer (Apple HIG) dla loading; bez migotania.

**SHOULD (dla kluczowych ekranów: C mode, N mode, ModuleHub):**

- “Sticky elevation”: gdy sticky header/command bar zaczyna nachodzić na treść, pojawia się subtelny cień (`shadow-hig-sm`).
- “Selection clarity”: zaznaczony element listy ma:
  - 1px border accent (`primary`) + bardzo subtelne tło (`primary/surface`),
  - animacja przejścia 160–220ms.
- “Tab underline glide”: underline taba przesuwa się płynnie (layoutId), bez skakania.

**MUST NOT:**

- nie robimy neonów, intensywnych glow jako domyślnego UI,
- nie robimy “parade animations” (duże fly-in),
- nie animujemy wszystkiego naraz (tylko 1–2 elementy w danym komponencie).

---

## 10) Zastosowanie do 3 trybów detail view (MUST)

Ten standard obowiązuje **dla wszystkich 3 trybów prezentacji** detail view:

- `D` (D presentation mode: legacy / DBR77, 2/3 + 1/3)
- `N` (N presentation mode)
- `C` (C presentation mode)

Wszystkie trzy tryby muszą używać tych samych tokenów kolorów/tła/ramek/typografii – różni się wyłącznie układ treści.
