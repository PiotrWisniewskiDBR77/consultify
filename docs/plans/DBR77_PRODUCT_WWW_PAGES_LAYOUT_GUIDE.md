## DBR77 — Instrukcja implementacji stron produktowych WWW (layout jak landing)

Ten dokument jest **instrukcją dla programistów (i ich AI)** jak tworzyć publiczne strony produktowe w DBR77/Consultinity w **spójnym układzie** zgodnym z naszym landingiem.

### Cel

- **Ujednolicić układ i zachowanie** wszystkich stron publicznych „produktowych” (np. `/`, `/tools`, `/audits`, kolejne landing pages).
- **Re-używać istniejących komponentów** landingu zamiast pisać wszystko od zera.
- Zapewnić **dark/light mode**, **i18n**, responsywność i spójne CTA.

### Co jest „kanonicznym landingiem” w tym repo

W tym kodzie istnieją dwa „landingi”, ale **route `/` używa komponentowego, i18n‑owego wejścia**:

- **Kanoniczne wejście (route `/`)**:
  - `src/views/ProductEntryPage.tsx` (składanie strony i zachowania CTA, demo flow)
  - `src/components/Landing/EntryTopBar.tsx` (header: logo, demo/trial/login/signup, theme, language, mobile menu)
  - `src/components/Landing/HeroSection.tsx` (hero + bento grid CTA)
  - `src/components/Landing/TrustStrip.tsx` (pasek zgodności / security)
  - `src/components/Landing/InfoSections.tsx` (metodologia + governance + FAQ + CTA)
  - `src/components/Landing/EntryFooter.tsx` (footer + linki + dane spółek + social)
  - `src/components/Landing/DemoModeModal.tsx` + `src/components/demo/DemoLoadingOverlay` (modal/overlay dla demo/trial flows)
- **Starszy/custom landing (nie jest podpięty pod `/`)**:
  - `src/views/PublicLandingPage.tsx` (hardcoded treści, używa `glass-card/glass-panel`, ma też `KnowledgePreviewSection`)
  - `src/components/Landing/KnowledgePreviewSection.tsx` (sekcja preview Knowledge Base; opcjonalna do wpięcia w inne strony)

### Strony publiczne produktowe — obecne przykłady

- `src/views/ToolsShowcasePage.tsx` (route `/tools`) — używa `EntryTopBar`, własny footer (nie `EntryFooter`)
- `src/views/AuditsShowcasePage.tsx` (route `/audits`) — używa `EntryTopBar` + `EntryFooter`

Te strony są dobrymi przykładami „public page shell”, ale mają miejscami duplikację tła/hero. W nowych stronach **trzymamy jeden kanoniczny układ** opisany poniżej.

---

## Kanoniczny układ strony (Public Product Page Shell)

Każda strona produktowa (publiczna) ma mieć ten szkielet:

### 1) Layout wrapper i tło

- **Wrapper**: `AuthLayout` (public routes), zob. `src/layouts/AuthLayout.tsx`.
- **Tło**: „premium gradient blobs + radial overlay + optional texture”, jak w `ProductEntryPage.tsx` i `ToolsShowcasePage.tsx`.
- **Zasada**: tło ma być `pointer-events-none`, mieć niski kontrast w light mode i mocniejszy „ambient” w dark.

### 2) Stały header (top bar)

Używamy **zawsze**: `EntryTopBar`.

Wymagania:
- **Fixed header** z backdrop blur.
- **Desktop**: CTA `Demo`, `Trial`, `Log in`, `Sign up` + toggles (theme + language).
- **Mobile**: burger menu + analogiczne CTA.
- **Logo**: z katalogu `Logo consultinity/` (uwaga: ścieżka ze spacją), jak w `EntryTopBar.tsx`.

### 3) Hero (pierwszy ekran)

Warianty:
- **Dla landing `/`**: `HeroSection` (bento grid z 5 kaflami + tagline tile).
- **Dla stron produktowych typu showcase**: hero może być custom, ale musi trzymać:
  - kontener `max-w-* mx-auto`,
  - mocne H1 + 1–2 linie lead text,
  - primary CTA (trial / execute) + secondary CTA (scroll / learn more),
  - wizualny gradient akcentujący DBR77 primary (fiolet).

### 4) Trust / Compliance strip

Po hero (lub w top part strony) wpinamy:

- `TrustStrip` — jeśli strona jest „sprzedażowo‑produkowa” (większość).

### 5) Sekcje treści (middle)

W zależności od strony:

- **Landing‑like**: re-użyj `InfoSections` (metodologia + governance + FAQ).
- **Showcase**: sekcje data-driven (jak `ToolsShowcasePage` i `AuditsShowcasePage`), ale trzymają zasady:
  - rytm spacingu (duże przerwy, sekcje oddechowe),
  - powtarzalny pattern: nagłówek sekcji → grid/list → CTA,
  - elementy interaktywne (modal video, accordions) mają fokus/keyboard i sensowne `aria`.

### 6) Bottom CTA

Każda strona kończy się „zamknięciem”:

- sekcja CTA (gradient / dark block), z 1 primary akcją.
- CTA musi prowadzić do jednej z dróg wejścia:
  - **Demo**: `/demo`
  - **Trial**: `/trial` (lub `/trial/start` jeśli wymagany flow z kodem)
  - **Kontakt**: `/contact` lub `/contact/expert`

### 7) Footer

Preferowany standard:
- `EntryFooter` — chyba że strona ma **świadomie** inny footer.

Wymagania:
- linki do `Legal`, `Docs`, `Security`, `Pricing`,
- social linki (DBR77),
- dane spółek jak w `EntryFooter.tsx`.

---

## Zachowania CTA (kontrakty funkcjonalne)

### Demo

- `Demo` w topbar i w hero prowadzi do ścieżki demo (`/demo`).
- W `ProductEntryPage` demo ma tryb „instant” (Ctrl/Cmd + D) i overlay. Na innych stronach można mieć zwykły `navigate('/demo')`, ale:
  - jeśli dodajecie „instant demo”, re-użyjcie istniejących komponentów (`DemoLoadingOverlay`) i API (`Api.demoLogin()`).

### Trial

W repo są dwa użycia:
- `/trial` (public „trial entry” / wizard route),
- `/trial/start` (auth step CODE_ENTRY).

Zasada dla nowych stron:
- **Jeśli CTA ma być „spróbuj teraz”** → prowadź do `/trial`.
- **Jeśli CTA ma być „trial z kodem / enterprise”** → `/trial/start`.
- Jeśli strona używa `EntryFooter`, pamiętaj że footer już zawiera link do `/trial/start`.

### Log in / Sign up

Zawsze prowadzą do:
- `/login`
- `/register`

Topbar ma już wbudowaną nawigację.

---

## i18n, dark mode, stylowanie (wymagania jakości)

### i18n

- **Wszystkie teksty** (nagłówki, opisy, CTA, etykiety) mają być przez `useTranslation()` i `t(...)`.
- Dla nowych stron **nie doklejajcie** tekstów do istniejących kluczy `landing.*` jeśli to inny moduł/strona.
  - Dobre nazewnictwo: `showcase.<pageId>.*` (jak już jest dla `tools` i `audits`), albo `public.<pageId>.*`.
- Minimalny zakres: **EN + PL** (reszta może mieć fallbacki, ale klucze muszą działać).
- Pliki tłumaczeń:
  - `public/locales/en/translation.json`
  - `public/locales/pl/translation.json`
  - analogicznie inne języki w `public/locales/<lang>/translation.json`

### Dark / Light

- Każda sekcja musi mieć `dark:` warianty tła i tekstu.
- Używajcie tokenów Tailwinda z projektu (DBR77):
  - kolory: `navy.*`, `primary.*`, `secondary.*`, `brand.*` (legacy alias),
  - utility: `glass-panel`, `glass-card` z `src/index.css`,
  - breakpoints: z `tailwind.config.js`.

### Animacje

- Preferowane: `framer-motion` z `whileInView` i `viewport={{ once: true }}` dla sekcji.
- Unikajcie ciężkich animacji w tle (perf). Ambient ma być subtelny.

---

## Routing: jak dodać nową stronę produktową

### 1) Dodaj view

Utwórz plik w `src/views/`, np. `src/views/ManufacturingShowcasePage.tsx`.

W środku:
- wrapper `div` z tłem,
- `EntryTopBar` z `onDemoClick/onTrialClick/onLoginClick/onRegisterClick`,
- sekcje,
- `EntryFooter`.

### 2) Dodaj route w `AppRoutes`

W `src/routes/AppRoutes.tsx` w sekcji **PUBLIC ROUTES** dodaj:

- nowy `<Route path="/manufacturing" element={<AuthLayout>...` (analogicznie do `/tools` i `/audits`),
- jeśli strona jest większa, użyj `React.lazy` + `Suspense` (jak inne public views).

### 3) (Opcjonalnie) Dodaj do `ROUTES`

Jeśli to ma być „kanoniczna” ścieżka (używana w app/menu), dodaj też do `src/routes/routeConfig.ts` w `ROUTES`.

---

## Assets / media: jak dodawać grafiki i wideo

### Grafiki

W kodzie landingu są referencje do ścieżek typu:
- `/assets/landing/...`
- `/assets/logos/...`

Zasada:
- trzymamy publiczne assety w `public/assets/<obszar>/...`,
- ścieżki w kodzie są absolutne (od `/`), np. `/assets/landing/cinematic/<plik>.png`.

Jeśli dodajecie nowe assety pod screenshoty:
- zróbcie folder per strona: `public/assets/<pageId>/...`,
- trzymajcie nazwy plików bez spacji, małe litery, myślniki.

### Wideo

Jeśli dodajecie video modal:
- re-użyjcie patternu z `HeroSection` (`<video controls autoPlay>...`),
- dodajcie fallback tekst `t('common.videoUnsupported', ...)`.

---

## Checklist dla programistów (Definition of Done dla nowej strony produktowej)

- **Layout**:
  - `EntryTopBar` na górze, fixed, działa mobile/desktop.
  - sekcje mają spójny rhythm spacing i kontener `max-w-* mx-auto`.
  - `EntryFooter` na dole (lub świadoma alternatywa).
- **Zachowanie**:
  - CTA „Demo” → `/demo`
  - CTA „Trial” → `/trial` (albo `/trial/start` jeśli w spec)
  - CTA auth → `/login`, `/register`
  - scroll/anchor linki działają (jeśli są).
- **Jakość**:
  - działa w dark i light (bez „znikających” tekstów),
  - i18n: EN + PL (minimum), brak hardcoded strings w JSX,
  - brak błędów konsoli przy wejściu,
  - responsywność: 375px → 1536px.
- **A11y**:
  - poprawna hierarchia nagłówków (H1 tylko raz),
  - przyciski są `<button>` jeśli akcja, linki są `<a>` jeśli nawigacja,
  - external linki: `target="_blank"` + `rel="noopener noreferrer"`,
  - modale zamykalne (ESC lub przycisk) i bez trapów fokusowych (minimum: focus na close).

---

## Anty‑wzorce (czego NIE robić)

- **Nie budujcie nowych headerów/footerów** bez powodu — re-użyjcie `EntryTopBar` i `EntryFooter`.
- **Nie hardcodujcie tekstów** w JSX (jak w `PublicLandingPage.tsx`) dla nowych stron — i18n ma być standardem.
- **Nie mieszajcie stylów** (np. przypadkowe kolory spoza tokenów) — używajcie `navy/primary/secondary/brand`.
- **Nie duplikujcie** tych samych bloków tła w 5 plikach bez kontroli — jeśli to rośnie, wydzielcie wspólny komponent (ale tylko jeśli to jest realny, powtarzalny pattern).

---

## „Prompt skeleton” dla AI programistów (do użycia ze screenami)

Poniżej jest szkielet opisu sekcji. Programiści mogą wkleić go do AI razem ze screenami i uzupełnić placeholdery.

### Metadane strony

- Route: `/<pageId>` (np. `/manufacturing`)
- Page title (H1): `<...>`
- Primary CTA: `<Demo|Trial|Execute>` → `<route>`
- Secondary CTA: `<scroll to #sectionX|open modal|learn more>`
- Footer: `<EntryFooter|custom>`

### Sekcje (kolejność)

1) Header: `EntryTopBar` (standard)
2) Hero:
   - H1: `<...>`
   - Lead: `<...>`
   - CTA buttons: `<...>`
   - Visual: `<image/video placeholder path>`
3) TrustStrip: `<yes/no>`
4) Sections:
   - Section A: `<name>` (layout: grid/list, cards: `<count>`)
   - Section B: `<name>`
   - FAQ: `<yes/no>` (re-use `InfoSections` FAQ pattern lub dedykowane)
5) Bottom CTA (gradient block):
   - Header: `<...>`
   - One primary action → `<route>`
6) Footer: `EntryFooter` (standard)

