# Feedback Pipeline V2 — Plan "Cursor-ready bug resolution"

Status: Plan (proposed, 2026-04-16).
Prerequisite: V1 is live (see `docs/SUPERADMIN_FEEDBACK_PIPELINE.md`).
Owner: Piotr Wiśniewski.

## 0. Cel

Zbudować taki sposób zgłaszania i obsługi błędów, żeby **od zgłoszenia przez
użytkownika do poprawki w Cursorze było <= 1 minuty kontekstu manualnego**.
Wszystko, co można złapać automatycznie, musi być złapane automatycznie:
screen, logi, request który padł, stan użytkownika, route, build SHA, wcześniejsze
kliknięcia. Cursor dostaje gotowy brief i od razu wchodzi w naprawę.

Mierzalne KPI celu:

| KPI                                     | Dziś (V1) | Target (V2) |
| --------------------------------------- | --------- | ----------- |
| % ticketów z screenshotem                | ~0%       | ≥ 90%       |
| % ticketów z console/network logs       | 0%        | ≥ 80%       |
| Czas od zgłoszenia do `IN_PROGRESS`     | godziny   | < 10 min    |
| MTTR dla `CRITICAL prod`                | nieznany  | < 2 h       |
| Duplikaty automatycznie zlinkowane      | 0%        | ≥ 60%       |
| % fixów z auto-test regresyjnym         | 0%        | ≥ 40%       |

## 1. Gdzie jesteśmy (V1, stan faktyczny)

- Schemat zgłoszenia (`POST /api/feedback`) przyjmuje:
  `type`, `title`, `message`, `severity`, `routePath`, `deviceType`, `screenSize`,
  `uiLanguage`, `uiTheme`, `metadata` (dowolny JSON).
- Superadmin ma pipeline (Board/List, Operations/Delivery/Resolution, timeline).
- Workflow metadata zapisywana w `metadata_json` + `PATCH /:id/workflow`.
- Alert routing (slack/email/whatsapp) + auto-task dla każdego zgłoszenia.

## 2. Luki (Gap analysis) — czego brakuje do "ideału"

### 2.1 Capture (moment zgłoszenia)

- [ ] **Screenshot viewportu** w momencie kliknięcia "Zgłoś błąd".
- [ ] **Console logs buffer** — ostatnie N=50 linii `console.error/warn/log`.
- [ ] **Network errors buffer** — ostatnie N=20 requestów (URL, status, czas, payload size).
- [ ] **Breadcrumbs** — ostatnie N=30 akcji użytkownika (clicks, route changes, form submits).
- [ ] **Stack trace** z ErrorBoundary / window.onerror / unhandledrejection.
- [ ] **Build info** — `VITE_BUILD_SHA`, `VITE_BUILD_AT`, `APP_ENV`.
- [ ] **User context** — role, orgId, feature flags, permissions (hash, nie payload).
- [ ] **Viewport/device** — szerokość, DPR, user agent, język, offline/online.
- [ ] **Session replay link** (opcjonalnie, patrz §6).

### 2.2 Storage & privacy

- [ ] Screenshoty trzymane jako obiekty (object storage), nie base64 w DB.
- [ ] Automatyczne maskowanie PII w screenie (`data-feedback-redact`, inputy typu password, email, phone).
- [ ] Retencja + GDPR usuwanie z feedbackiem.

### 2.3 Triage (backend + UI)

- [ ] Automatyczna klasyfikacja cluster na podstawie `routePath` → component map.
- [ ] Deduplikacja po `signatureHash` (stack trace + route + msg normalizacja).
- [ ] Auto-priority (`CRITICAL` jeżeli env=production + ErrorBoundary fired + >1 user).

### 2.4 Handoff do Cursor

- [ ] Generator briefu ("Cursor prompt") per zgłoszenie — plain text z wszystkim.
- [ ] Jedno kliknięcie "Otwórz w Cursorze" z pre-filled instrukcją.
- [ ] Automatyczne ustawienie `workflow.source = "cursor"`, `owner`, `note: "Picked up"`.
- [ ] Konwencja nazywania: `branch = feedback/<id-short>`, `PR title = "[feedback:<id-short>] <title>"`.

### 2.5 Verification & loop

- [ ] "Try it again" link dla reportera → ponowna próba scenariusza z markerem.
- [ ] Structural user-confirm flow (nie tylko admin_response).
- [ ] Auto-regression test stub z repro do `tests/feedback/<id>.spec.ts`.

### 2.6 Observability

- [ ] Dashboard: MTTR per cluster, re-open rate, user-satisfaction.
- [ ] Slack digest dzienny: "nowe + otwarte > 48h + critical prod".

## 3. Screeny — tak, ale jak (decyzja techniczna)

**Rekomendacja: TAK, screen jest absolutnie kluczowy**. 80% bugów użytkownik
opisuje słowami, które bez obrazka są niejednoznaczne. Ale robimy to w
kontrolowany sposób, nie "zrzut ekranu systemu":

| Metoda                              | Plus                                                      | Minus                                                | Decyzja      |
| ----------------------------------- | --------------------------------------------------------- | ---------------------------------------------------- | ------------ |
| `html2canvas` / `modern-screenshot` | Działa w przeglądarce, bez zgody, pełna kontrola          | Nie łapie canvas/iframe/DRM, ciężkie drzewa = wolno | **TAK (V2)** |
| `navigator.mediaDevices.getDisplayMedia` | Realny pixel, łapie wszystko                          | Modal systemowy (zgoda), user może wybrać inny ekran | Opcja (V2.5) |
| DOM snapshot (HTML + CSS)           | Lekki, Cursor może zaimportować                            | Nie wizualny                                         | Jako uzupełnienie |
| Session replay (rrweb)              | Reprodukcja click-by-click, złoty standard                | Waga, koszt storage, GDPR ostro                       | V3 (behind flag) |

**Plan**:
1. **V2.0**: `modern-screenshot` (PNG, WebP kompresja), zawsze próba, fallback do DOM snapshot.
2. **V2.0**: auto-redact — wszystkie `input[type=password]`, `input[type=email]`,
   `[data-feedback-redact]` są czarnymi pasami przed rasteryzacją.
3. **V2.5 (opt-in w widgetcie)**: "dołącz nagranie ekranu" → `getDisplayMedia`
   + 10s MP4 przy bugach reprodukowalnych.
4. **V3 (enterprise)**: rrweb session replay, tylko dla wybranych orgs.

## 4. Architektura docelowa (V2)

```
User clicks "Report bug"
          │
          ▼
┌────────────────────────────────────────────┐
│  FeedbackCollector (frontend)              │
│  - screenshot(modern-screenshot) + redact  │
│  - pull console buffer                     │
│  - pull network buffer                     │
│  - pull breadcrumbs                        │
│  - pull build/user/env context             │
│  - serialize -> POST /api/feedback         │
│  - attachments: upload to /api/uploads     │
└────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────┐
│  /api/feedback (existing)                  │
│  + artifacts[] {kind,url,meta}             │
│  + signatureHash (for dedup)               │
│  + breadcrumbs[], consoleLogs[], netErrs[] │
│  stored in metadata_json                   │
└────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────┐
│  Triage worker (new)                       │
│  - detect duplicates (signatureHash)       │
│  - auto-assign cluster (route -> map)      │
│  - auto-priority (env + severity + count)  │
│  - Slack/email summary                     │
└────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────┐
│  Superadmin Pipeline (existing V1)         │
│  + "Open in Cursor" action                 │
│  + "Copy Cursor prompt" action             │
│  + Screenshot viewer in detail             │
│  + "Regenerate repro" action               │
└────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────┐
│  Cursor session                            │
│  - autostart: branch feedback/<id-short>   │
│  - autowrite: workflow.source=cursor,owner │
│  - autowrite: prUrl after PR               │
│  - autowrite: deployStatus after deploy    │
│  - autowrite: resolution.* at close        │
└────────────────────────────────────────────┘
```

## 5. Plan wdrożenia w etapach

### V1.1 — Hardening V1 (1 dzień, przed V2)

Cel: żeby V1 było w 100% stabilne w produkcji zanim dorzucimy capture.

- [ ] Zmigrować kluczowe pola workflow do osobnych kolumn (opcjonalnie, ale
      robi order-by/index: `owner`, `cluster`, `deploy_status`,
      `last_updated_at`).
- [ ] Dodać unit testy dla `normalizeWorkflowMeta` / `shapeFeedbackRow`.
- [ ] Dodać e2e test scenariusza: zgłoszenie → PATCH workflow → Board → Resolved.

### V2.0 — Rich capture + screenshot (3 dni)

Cel: każde zgłoszenie przychodzi z artefaktami, które Cursor czyta bezpośrednio.

**Frontend**:
- [ ] Pakiet `@consultify/feedback-collector`:
  - `captureScreenshot()` (modern-screenshot + redact)
  - `ConsoleBuffer`, `NetworkBuffer`, `BreadcrumbBuffer` (ring buffers, `sessionStorage` ttl)
  - `AppContextProvider` do wstrzykiwania buildSha, userRole, orgId, flags
- [ ] Nowy widget `ReportBugDialog`:
  - Przycisk pływający w stopce (shift+ctrl+B jako skrót)
  - Od razu łapie screenshot (user widzi podgląd + może redact area pędzlem)
  - Pole tytuł + opis + severity
  - Checkbox "dołącz screenshot", "dołącz logi" (domyślnie ✓)
- [ ] ErrorBoundary + `window.onerror` + `unhandledrejection` → automatyczna
      propozycja "Zgłoś ten błąd" z wypełnionym formularzem.

**Backend**:
- [ ] `POST /api/uploads/feedback-artifact` — multipart, S3/R2 presigned,
      MIME whitelist (png/webp/json/txt), max 5MB, 30-day TTL.
- [ ] Rozszerzenie `metadata_json` o `artifacts[]`, `consoleLogs[]`,
      `networkErrors[]`, `breadcrumbs[]`, `appContext`, `signatureHash`.
- [ ] `signatureHash = sha1(normalizedStack + normalizedRoute + normalizedMsg)`.
- [ ] Walidacja rozmiaru payloadu + rate limit per user.

**Privacy**:
- [ ] `data-feedback-redact` jako konwencja w komponentach wrażliwych
      (RODO, maile klientów, tokeny).
- [ ] Default redact: `input[type=password|email]`, `[aria-label*=password]`.
- [ ] Notka w UI "Wysyłasz zrzut ekranu aktualnej karty" + preview.

### V2.1 — Triage worker + deduplikacja (2 dni)

- [ ] Serwis `FeedbackTriageService`:
  - `detectDuplicates(signatureHash)` → zwraca listę podobnych.
  - `inferCluster(routePath)` z mapy `routeToClusterMap.ts`
    (np. `/superadmin/users` → `Superadmin Users`).
  - `inferPriority({ severity, env, userRole, stackTrace })`.
- [ ] Przy POST `/api/feedback`:
  - ustaw `workflow.cluster` jeśli pusty
  - ustaw `metadata_json.duplicateOf` jeśli wykryto
  - auto-escalacja `CRITICAL prod` → ping Slack #ops
- [ ] UI: badge `×3 duplicates` + link "pokaż powiązane" w Superadmin cards.

### V2.2 — Cursor handoff (1 dzień)

- [ ] `GET /api/feedback/:id/cursor-brief` → plain text brief zoptymalizowany
      pod wklejenie do Cursor (markdown, nagłówki, linki do plików).
- [ ] W Superadmin detail: przyciski
  - "Copy Cursor brief" (do schowka)
  - "Start Cursor worktree" (REST call do lokalnego agenta lub link
    `cursor://open?task=...` — opcjonalnie, decyzja w §7).
- [ ] Konwencja commit: `fix(feedback:<id-short>): ...`;
      skrypt `scripts/feedback-link-pr.ts` czyta branch i robi `PATCH /:id/workflow`.

### V2.3 — Verification loop (1 dzień)

- [ ] Generowanie `verifyToken` przy `PATCH /:id/status` → `RESOLVED`.
- [ ] Wysyłka maila do reportera: "sprawdź czy problem zniknął"
      + link `/feedback/:id/verify?token=...`.
- [ ] Strona publiczna: tak/nie + krótki komentarz → zapis w
      `resolution.userConfirmation`.
- [ ] Jeśli `nie` w 7 dni → auto-reopen + `workflow.owner` ustaw na
      ostatniego resolvera.

### V2.4 — Observability (1 dzień)

- [ ] Widok `/superadmin/feedback/analytics`:
  - MTTR per cluster (avg, p50, p90)
  - Volumes per env (stacked bar, tygodniowo)
  - Re-open rate
  - Backlog aging (histogram)
- [ ] Scheduler: codzienny digest Slack na #product-pulse.

### V3 (opt-in, bez harmonogramu) — session replay

- [ ] rrweb background recorder (za feature flag `enable_session_replay`).
- [ ] Dokładne 30s przed zgłoszeniem trafia do S3 jako artefakt.
- [ ] Viewer osadzony w Superadmin detail.

## 6. Decyzje do podjęcia (RFC-level)

Zanim wejdziemy w kod V2, proszę o rozstrzygnięcie:

1. **Storage artefaktów**:
   - (a) Railway volume (szybko, tanio, krótka retencja) ←— proponuję na start
   - (b) S3 / Cloudflare R2 (standard, więcej roboty konfiguracyjnej)
2. **Screenshot engine**:
   - (a) `modern-screenshot` + `html2canvas` fallback (łatwe, 95% przypadków)
   - (b) Dodatkowo `getDisplayMedia` jako opt-in (dla bug-hunterów)
3. **Cursor handoff**:
   - (a) Tylko "copy brief to clipboard" (minimalne, zero setupu) ←— MVP
   - (b) Custom protocol `cursor://` (wymaga aktywacji locally)
   - (c) Integracja przez Cursor CLI (subagent `shell` wystartowany z briefem)
4. **Deduplikacja**:
   - (a) Tylko `signatureHash` (szybkie, działa dla błędów JS)
   - (b) Dodatkowo embeddings (tekst → ANN) — koszt AI, ale łapie opisowe bugi
5. **Privacy floor**:
   - (a) Zawsze maskuj `password/email/phone` + elementy z `data-feedback-redact`
   - (b) Wymagaj preview z akceptacją przed wysłaniem ←— proponuję

## 7. Kamienie milowe i estymacja

| Milestone | Zakres                                              | Czas   |
| --------- | --------------------------------------------------- | ------ |
| M1        | V1.1 hardening (testy, kolumny)                     | 1 dz.  |
| M2        | V2.0 capture + screenshot + widget                  | 3 dni  |
| M3        | V2.1 triage + dedup                                 | 2 dni  |
| M4        | V2.2 Cursor handoff                                 | 1 dzień |
| M5        | V2.3 verification loop                              | 1 dzień |
| M6        | V2.4 analytics                                      | 1 dzień |
| (opt) M7  | V3 session replay                                   | +3 dni |

Razem V2: **~9 dni roboczych** (bez V3).

## 8. Minimum do wdrożenia (MVP w 48h)

Jeżeli chcesz wynik natychmiast:

1. **Dzień 1** (M1 + połowa M2):
   - `FeedbackCollector` w froncie: screenshot (modern-screenshot), console
     buffer, network buffer, breadcrumbs, appContext.
   - Modal "Report bug" z podglądem screena.
   - Backend: rozszerzenie `metadata_json` (bez osobnego upload endpointu
     na start — base64 max 1MB, potem zmieniamy na S3).
   - `signatureHash` + prosty dedup.
2. **Dzień 2** (druga połowa M2 + M4):
   - Upload endpoint → Railway volume.
   - Cursor brief generator + "Copy brief".
   - Konwencja commit/branch + auto PR link.

To wystarczy, żeby 90% nowych zgłoszeń trafiało do Cursora gotowych do naprawy.

## 9. Ryzyka

- **Rozmiar payloadu**: screen 1920×1080 PNG może mieć 400 KB+. Rozwiązanie:
  WebP ~ 80%, downscale do 1600px, twardy limit 800 KB w zgłoszeniu.
- **Privacy blowback**: ktoś zgłasza bug z widoczną listą klientów.
  Rozwiązanie: wymuszony preview + domyślne redact + klauzula w widgetcie.
- **Wolne html2canvas**: duże dashboardy (>5k węzłów) idą sekundami.
  Rozwiązanie: `modern-screenshot` (szybszy), loader w modalu, timeout 3s
  → fallback do DOM snapshot bez rasteryzacji.
- **False-positive dedup**: dwa różne bugi z podobnym stackiem.
  Rozwiązanie: dedup jest "miękki" — proponuje link, nie zamyka ticketu.

## 10. Co dalej po akceptacji planu

1. Założenie tasków w `feedback_items` jako seed (self-hosting dog-food):
   po jednym ticket per milestone, owner=cursor, cluster=`feedback-pipeline`.
2. `docs/SUPERADMIN_FEEDBACK_PIPELINE.md` aktualizowany po każdym milestone
   (data model, API, UI contract).
3. `CHANGELOG.md` wpis per release.
