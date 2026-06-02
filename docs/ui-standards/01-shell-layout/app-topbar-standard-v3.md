# App Topbar (Global Header) Standard — v3

> **Status:** Canonical global chrome standard, subordinate to `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`  
> **Cel:** Ustandaryzować **stały** pasek górny aplikacji (chrome), oddzielając go od **kontekstowego** topbara modułów.  
> **Powiązane standardy:**  
> - `docs/ui-standards/03-modules/module-hub-standard.md` (kontekstowy topbar modułu)  
> - `docs/ui-standards/00-foundation/visual-language.md` (warstwy, light mode readability)  
> - `docs/ui-standards/00-foundation/artifact-identity-map.md` (kolory/ikony artefaktów)  
>
> **SSOT (as-is w kodzie):** `src/layouts/MainLayout.tsx` (global header + split-chat shell)

---

## 1) Dwie warstwy topbara (MUST)

W aplikacji są **dwa** “top bary” i nie wolno ich mieszać:

1. **App Topbar (Global)** — stały, niezmienny w całej aplikacji (chrome + statusy + user).
2. **Module Topbar (Context)** — zmienny zależnie od modułu i aktywnej powierzchni (tabs, view modes, filtry, CTA, AI context).

---

## 2) App Topbar — anatomia (MUST)

### 2.1 Lewa strona: Breadcrumbs

- Kanon breadcrumbs: `Module > Surface/Tool` (bez “Dashboard …” clutter)  
  (SSOT: `docs/ui-standards/03-modules/module-hub-standard.md`)

### 2.2 Prawa strona: stała kolejność elementów

Kolejność (od lewej do prawej w prawym segmencie):

1. **Data** (3 stany: green/yellow/red)
2. **Model** (wybór modelu/warstwy jakości)
3. **Inbox** (badge = nowe/nieprzeczytane)
4. **Tasks (Today)** (badge = taski na dziś)
5. **User menu** (avatar + nazwisko + identyfikator/brand, bez roli i bez organizacji)

**Reguła:** App Topbar NIE zawiera “AI toggle” jako osobnego przycisku (patrz sekcja 4).

---

## 3) Data (Connectivity / Access to data) — 3 stany (MUST)

W globalnym topbarze zamiast “Online” pokazujemy **Data** i stan:

- **Green**: frontend + backend + baza danych dostępne (normalna praca)
- **Yellow**: backend działa, ale baza danych jest niedostępna / timeout / provider problem  
  - UI może działać w trybie “degraded”: buforowanie / praca ograniczona / retry w tle
- **Red**: backend niedostępny lub aplikacja nie może pracować (twardy błąd)

**Zasada UX:** yellow/red to sygnał statusu systemu — nie “feature”.

**Wymóg techniczny (contract):**

- stan jest liczony na podstawie szybkiego health check (`/api/health`) z bounded timeout.

---

## 4) AI — zasada v3 (MUST)

### 4.1 Globalny AI toggle — OFF (na czas testów)

W globalnym App Topbar **nie** ma przycisku “AI”, żeby nie tworzyć podwójnego sterowania.

### 4.2 Kanoniczny “AI w kontekście” — w Module Topbar

AI w v3 jest uruchamiane przez **jeden** kanoniczny przycisk w **kontekstowym topbarze modułu**:

- klik = otwórz/zamknij split chat panel
- chat ma znać kontekst (gdzie user jest i nad czym pracuje), nawet jeśli “milczy”
- kontrakt: korzystamy z `useOpenChatWithContext` (SSOT w kodzie)

**Kolejność w Module Topbar (prawa strona, od prawej):**  
**Area (toggle lewego panelu / split chat)** → **Add (+New)** → **Tool** → **View modes** → **Filters**  
SSOT: `docs/ui-standards/03-modules/module-hub-standard.md` (pełna anatomia 3‑liniowego menu + Command Row)

---

## 5) Inbox (global) — zastępuje Notifications (MUST)

W v3 rezygnujemy z osobnego “Notifications” w topbarze:

- globalny przycisk = **Inbox**
- badge = liczba nowych/nieprzeczytanych
- zawartość = zintegrowane kanały (system alerts, sync messages, AI komunikaty, notyfikacje artefaktów)
- wejście z App Topbar prowadzi do `My Work > Inbox` (Action Queue)

---

## 6) Tasks (global) — badge “na dziś” (MUST)

W globalnym topbarze przycisk tasków ma badge:

- liczba tasków na dziś (dueDate = today)
- otwiera `My Work > Tasks`

---

## 7) User menu (MUST)

W App Topbar pokazujemy:

- avatar (jeśli brak zdjęcia → inicjały)
- imię + nazwisko
- identyfikator/brand (np. “DBR77”)

Nie pokazujemy:

- organizacji (na tym poziomie)
- roli użytkownika (nie każdy musi to widzieć)

---

## 8) SSOT w kodzie (as-is)

- Global header + kolejność elementów: `src/layouts/MainLayout.tsx`
- Data status: `src/components/SystemHealth.tsx`
- Model selector: `src/components/LLMSelector.tsx`
- Tasks dropdown: `src/components/TaskDropdown.tsx`
- Inbox dropdown: `src/components/layout/NotificationDropdown.tsx` *(docelowo może być alias/rename, ale standard v3 nazywa to “Inbox”)*
- User menu: `src/components/layout/UserProfileMenu.tsx`

