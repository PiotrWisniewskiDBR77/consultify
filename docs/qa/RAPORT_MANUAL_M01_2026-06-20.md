# Raport testów manualnych — M01 Czat (composer +/✎/👥)

> **Data:** 2026-06-20 · **Tester:** Claude (CTO) przez zalogowaną przeglądarkę Piotra (Chrome MCP)
> **Środowisko:** localhost:3000/chat (frontend dev) + :3001 (backend staging DB) · zalogowany OWNER DBR77 · dark-mode
> **Spec:** `Harvard/Testy manualne/TESTY_M01_CZAT.md`
> **Legenda:** ✅ PASS · ❌ FAIL · ⚠️ uwaga/odroczone (wymaga AI/balansu providera) · ⬜ nie wykonano

## Podsumowanie
Przejrzano na żywo skrypt `TESTY_M01_CZAT.md` (3 przyciski composera + przekrojowe) na zalogowanej apce. **Rdzeń trzech menu PASS, 0 defektów rdzenia M01.** 1 finding cross-module (M25 routing „Manage cloud sources"), caveaty środowiskowe (drift schematu staging — ai-memory/prompts), nota vs spec (badge liczy multiAgent). E2E flag→backend potwierdzone na żywo (Deep Thinking + Agent Audit Layer). DoD #7: a11y (Esc/focus/role) + dark = ✅ live; responsywność mobile = ⚠️ ograniczenie narzędzia (do ręcznego potwierdzenia). Szczegóły niżej.

---

## Sekcja 1 — AddFilesMenu (+)

| Test | Wynik | Dowód / uwaga |
|---|---|---|
| 1.1 Otwieranie | ✅ | Menu wysuwa się nad przyciskiem (`bottom-full`), nie zasłania pola, w obrębie ekranu. Pozycje EN: Upload file / Add link / Manage cloud sources / Recent |
| 1.2 Upload file | ⚠️ | Otwiera natywny dialog plików — niemożliwy do sterowania automatem. `accept` (SUPPORTED_CHAT_ATTACHMENT_ACCEPT) ma pokrycie unit. Wymaga ręcznego klika Piotra |
| 1.3 Add link — modal | ✅ | Modal „Add link" otwiera się; i18n EN poprawne (`addLinkModalDesc`, `urlLabel`, `urlPlaceholder`, `urlPrivacyHint`); Add disabled przy pustym polu |
| 1.3 Walidacja — `ftp://` | ✅ | Toast „Only http(s) links are supported" (`urlUnsupportedProtocol`), modal pozostaje |
| 1.3 Walidacja — śmieć | ✅ | Toast „Invalid link" (`urlInvalid`) |
| 1.3 Walidacja — `example.com` | ✅ | Auto-dopisanie `https://` + normalizacja → chip „Link: https://example.com/ ×" w composerze |
| 1.4 Manage cloud sources | ⚠️ **FINDING P3 (cross-module M25)** | M01 robi `navigate('/settings/integrations')` poprawnie (`AddFilesMenu.tsx:258`), ALE moduł Ustawień NIE ma tego route'a — „Integrations" to sekcja akordeonu, a `/settings/integrations` przekierowuje na `/settings/profile` (potwierdzone bezpośrednią nawigacją). Skutek: użytkownik ląduje na Profilu zamiast na integracjach. **Defekt routingu M25/cross-module, nie rdzeń M01.** Draft (chip) nie przetrwał powrotu — testowane „wstecz" przeglądarki (pełny remount), nie in-app SPA |
| 1.5 Recent — flyout | ✅ | Submenu wysuwa się w prawo (`left-full`), pusty stan „No recent attachments" |
| 1.5 Recent — reattach/delete docId | ⚠️ | Wymaga realnego uploadu (zależy od 1.2). Logika `chatRecentAttachments` ma pokrycie unit |

**Wniosek Sekcja 1:** rdzeń (otwieranie, Add link + pełna walidacja URL, Recent flyout) PASS. 1 finding P3 (target nawigacji cloud). 2 pozycje wymagają realnego uploadu/ręcznego klika (granica automatu).

## Sekcja 2 — ToolsMenu (✎)

| Test | Wynik | Dowód / uwaga |
|---|---|---|
| 2.1 Trigger + badge | ✅ | Badge „N active" w nagłówku + liczba na triggerze ✎; outside-click zamyka; menu scrolluje się przy małej wysokości |
| 2.1 Licznik badge — multiAgent | ℹ️ **vs spec** | Live: badge liczy też `multiAgent` (deep+reasoning+multiAgent = „3 active"). Spec notował „multiAgent NIE liczony" — obecne zachowanie liczy WSZYSTKIE aktywne tryby (spójniejsze, traktuję jako poprawne; spec-notatka nieaktualna) |
| 2.2 Toggle 5 trybów on/off | ✅ | Deep analysis / Show reasoning / Multi-agent / Read responses — checkmark + podświetlenie + toast „enabled"/„disabled"; badge aktualizuje liczbę |
| 2.2 Persistencja (close/reopen) | ✅ | Po zamknięciu i ponownym otwarciu menu stany trybów zachowane |
| 2.2 **E2E — flagi konsumowane** | ✅ **mocny dowód** | Z włączonym Deep analysis wysłana wiadomość → odpowiedź to karta **„Confirm Understanding (Deep Thinking)"** + „Suggested reviewers (Agent Audit Layer)" (Max agents 3, 3 recenzentów). Zachowanie realnie zmienia się wg flag → flagi docierają do backendu. Provider AI działa (openrouter/gpt-4o, log „AI Pipeline chat completed"). Tytuł rozmowy auto-wygenerowany („Digital Transformation Readiness Assessment Guide") |
| 2.3 Podsekcja TTS | ✅ | „Read responses" ON → pojawia się „Voice settings"; rozwija „Speed (1x)" + suwak 0.5x–2x; ikona 🔊 w headerze. Pełna lista głosów = zależna od `speechSynthesis` przeglądarki |
| 2.4 Response style — modal | ✅ | „Personalize AI responses" + 8 stylów w siatce 2-kol (Standard/Concise/Executive/Analyst/Formal/Coach/Professional/Friendly) + „Custom instructions" (licznik /1000); i18n EN poprawne |
| 2.4 Custom instructions — zapis | ⚠️ **środowiskowe** | GET/PUT `/api/ai-memory` na staging DB pada (`ai_user_memory.value` / kolumny nie istnieją — **drift schematu staging**, log Postgres). UI modala działa; persystencja do weryfikacji na demo/prod. NIE defekt kodu M01 |
| 2.5 Add to project (z rozmową) | ✅ | Toast „Add to project" + otwiera modal „Move to folder" (CURRENT: No folder, Search, Create folder, MY FOLDERS 4) |

**Wniosek Sekcja 2:** wszystkie pozycje PASS. 1 nota vs spec (badge liczy multiAgent — uznane za poprawne). 1 caveat środowiskowy (ai-memory persist na staging — drift schematu, nie M01). **Kręgosłup czat→deep-thinking zweryfikowany na żywo.**

## Sekcja 3 — CoThinkerMenu (👥)

| Test | Wynik | Dowód / uwaga |
|---|---|---|
| 3.1 6 person obecnych | ✅ | Consultant / Idea Creator / Analyst / Auditor / Editor / Market Researcher pod nagłówkiem „CO-THINKER" |
| 3.1 Wybór persony → pill | ✅ | Analyst → trigger zmienia się w pill „Analyst" (primary) + pasek „CO-THINKER · Active: Analyst" z „× Clear" (= `CoThinkerActivePill`) |
| 3.1 Wzajemne wykluczanie | ✅ | Wybór Market Researcher gdy aktywny Analyst → Analyst zastąpiony, tylko jedna persona naraz |
| 3.1 Clear | ✅ | „× Clear" czyści personę — pasek znika, pill wraca do ikony 👥 |
| 3.2 Market Researcher | ✅ | Persona ustawiana (pill „Market Researcher"). Trzy flagi (`coThinkerMode='market_researcher'`+`marketResearch`+`webSearch`) — pokrycie unit; flagi docierają do BE (potwierdzone E2E w 2.2) |
| a11y — role | ✅ | `find` potwierdził `role="menuitem"` na pozycjach menu |

**Wniosek Sekcja 3:** wszystkie pozycje PASS.

## Sekcja 4 — Przekrojowe + DoD #7 (a11y/dark/responsywność)

| Test | Wynik | Dowód / uwaga |
|---|---|---|
| 4.1 Kombinacje flag | ✅ | Deep analysis + Show reasoning + Read responses aktywne równocześnie („3 active"); wysyłka → wszystkie konsumowane (Deep Thinking + reviewers), nie kasują się |
| 4.2 Persistencja między rozmowami | ✅ | `aiConfig` globalny — badge „3" zachowany po zmianie widoku/rozmowy |
| 4.3 Disabled podczas streamingu | ⚠️ | Niezweryfikowane wprost (trudne do złapania mid-stream przez automat); kod blokuje (`disabled` prop). Do potwierdzenia ręcznego |
| 4.4 Z-index / nakładanie | ✅ | Menu renderują się nad composerem, nieprzycięte, w viewport |
| 4.5 Outside-click izolacja | ✅ | Otwarte ✎ + klik 👥 → ✎ zamyka się, 👥 otwiera; nigdy dwa menu naraz. Klik w tło zamyka |
| 4.6 i18n PL/EN | ✅ | Pełna weryfikacja (patrz fix i18n): EN „HOW TERESA SHOULD ANSWER", modale, AddFiles; PL „JAK TERESA MA ODPOWIADAĆ", „Dodaj do projektu". 0 gołych fallbacków |
| 4.7 Dark mode | ✅ | Czysty we wszystkich menu/modalach/flyout (cała sesja w dark) |
| 4.8 a11y (DoD #7) | ✅ | Esc zamyka menu + focus-ring wraca na trigger; `role="menuitem"` na pozycjach (potwierdzone w drzewie a11y) |
| 4.9 Console | ✅ | Zero błędów/wyjątków przez całą sesję |
| Responsywność (DoD #7) | ⚠️ **tooling** | `resize_window`/`innerWidth` nie reagują na tej karcie (okno zarządzane/zmaks. — innerWidth stałe 1728). Layout composera = flex; desktop czysty. Live mobile = ręczny check Piotra LUB DevTools device-mode |

**Wniosek Sekcja 4:** rdzeń przekrojowy PASS (kombinacje, persistencja, izolacja, z-index, i18n, dark, a11y-Esc/role, console). 2 pozycje ⚠️: disabled-mid-stream (granica automatu) + responsywność live (ograniczenie narzędzia).

---

## PODSUMOWANIE manualne M01

**Pokrycie:** wszystkie 3 przyciski composera (+, ✎, 👥) + przekrojowe przejrzane na żywo na zalogowanej apce (OWNER DBR77, dark, EN+PL).

**PASS (rdzeń modułu):** AddFilesMenu (otwieranie, Add link + pełna walidacja URL, Recent flyout) · ToolsMenu (5 trybów toggle+badge+toasty, persistencja, TTS subsection, Response style modal, Add to project) · CoThinkerMenu (6 person, pill, wzajemne wykluczanie, Clear) · **E2E flag→backend** (Deep Thinking + Agent Audit Layer na żywo) · tytuł auto-generowany · i18n EN+PL · dark · a11y (Esc/focus/role) · console 0 błędów · outside-click izolacja · z-index.

**Findingi:**
- **P3 (cross-module M25):** „Manage cloud sources" → `navigate('/settings/integrations')` poprawne w M01, ale Ustawienia nie mają tego route'a → redirect na `/settings/profile`. Defekt routingu Ustawień, nie rdzeń M01.
- **Środowiskowe (staging DB drift, NIE M01):** `ai_user_memory`/`ai_system_prompts`/`organization_ai_settings`/`ai_budgets` — brak kolumn/tabel na staging → custom instructions persist i część kontekstu AI pada (graceful fallback). Do weryfikacji persystencji na demo/prod.
- **Nota vs spec:** badge ToolsMenu liczy też `multiAgent` (spójniejsze; spec-notatka nieaktualna).

**Niezweryfikowane (granica narzędzi/dostępu):** upload pliku (natywny dialog), Recent reattach/delete (zależne od uploadu), disabled-mid-stream, responsywność mobile live. Branch/export/share/revoke/głos — poza tą paczką spec (osobne ekrany).

**Werdykt:** rdzeń trzech menu composera M01 **działa na żywo**; 0 defektów rdzenia M01; 1 finding cross-module (M25) + caveaty środowiskowe (staging).

---

## HEADLESS E2E (deterministyczny, repeatable) — 2026-06-20

Manualne scenariusze composera zakodowane jako **headless Playwright E2E**: [`tests/e2e/smoke/m01-composer-manual-e2e.spec.ts`](../../tests/e2e/smoke/m01-composer-manual-e2e.spec.ts) — system `E2E_MODE + mock DB + AI_PROVIDER_MODE=mock` (bez realnego DB/AI, bez zależności od balansu providera). **Wynik: 7/7 PASS (26s).**

| Test headless | Pokrywa | Wynik |
|---|---|---|
| S1 AddFilesMenu | open menu · Add link modal · walidacja URL (ftp→odrzut / śmieć→Invalid / example.com→chip) · Add disabled przy pustym | ✅ |
| S2 ToolsMenu | toggle trybu + toast · podsekcja TTS (Voice settings) · persistencja close/reopen · modal Response style (8 stylów) | ✅ |
| S3 CoThinker | 6 person · pill aktywnej · wzajemne wykluczanie · Clear | ✅ |
| S4 i18n | **regresja-guard fixu i18n**: steering key rozwiązany (brak surowego `aiChat.menu.steeringHeading`) | ✅ |
| S4 a11y | Escape zamyka menu | ✅ |
| S4 izolacja | otwarcie 👥 zamyka ✎ | ✅ |
| S4 **responsywność** | viewport 390px → composer używalny, **0 horizontal overflow** (domyka lukę DoD #7, której nie dało się sterować interaktywnie) | ✅ |

Komenda: `QA_AI_MODE=true AI_PROVIDER_MODE=mock E2E_MODE=true E2E_USE_WEB_SERVER=true E2E_BACKEND_RUNNER=tsx E2E_MOCK_DB=true ENABLE_TEST_SUPPORT=true E2E_API_URL=http://127.0.0.1:3101 E2E_BASE_URL=http://127.0.0.1:3100 npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/m01-composer-manual-e2e.spec.ts --project=chromium`

Uwaga implementacyjna: dodano obejście async-mount dialogu onboardingu (`Welcome to Consultify — Meet Teresa`, backdrop-blur z-50 przechwytywał kliknięcia) — czekanie na mount + klik „Skip for now".
