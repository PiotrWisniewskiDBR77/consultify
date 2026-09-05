# Raport — naprawy nocne #1 (evidence/audyt-mvp-20260906/B/RAPORT_B.md)

Gałąź: `mvp/naprawy-noc-1` (worktree `/private/tmp/wt-fix1`, baza `origin/staging`
@ `59e282df88`). Wszystkie 7 defektów naprawione, 7 commitów, zero push.

## 1. BLOKER — `settings.profile.roles.user` brakujący klucz i18n

- Plik: `public/locales/pl/translation.json`, `public/locales/en/translation.json`
  (`settings.profile.roles.*`) — dodano `user`, `super_admin`, `guest`, `viewer`,
  `project_manager`, `team_member` (wszystkie wartości `UserRole` z
  `src/types/domain/user.ts`), zamiast dotykać zamrożonego `ProfileSettings.tsx`.
- Test: `tests/unit/i18n/profileRoles-required-keys.test.ts`.
- Mutacja RED→GREEN: usunięcie klucza `user` z pl → test czerwony; przywrócony → zielony.
- Zrzuty: nie robione (fix czysto tłumaczeniowy, brak zmiany wizualnej wartej osobnego zrzutu).

## 2. BLOKER — surowe klucze pól + `[ODMROZENIE 01_ORGANIZATION DEC-397]`

- Nowy plik: `src/labels/organizationFieldLabels.ts` (56 ścieżek z
  `ORGANIZATION_CONTEXT_CLAIM_PATHS`, wzorem `ideaSourceLabels.ts`/P4).
  Podłączony w `OrganizationReadinessScreen.tsx` (2 miejsca) i bliźniaczym
  `OrganizationDecisionQualityPanel.tsx` (rodzeństwo znalezione grepem).
- Test: `src/labels/__tests__/organizationFieldLabels.test.ts` +
  zaktualizowany `OrganizationReadinessScreen.test.tsx`.
- Mutacja RED→GREEN: usunięcie wpisu `myWork.idea` ze słownika → test czerwony.
- Zrzuty: próba `--url=/organization/readiness` na żywej sesji `Audyt Nocny`
  zakończyła się ekranem błędu „Nie można potwierdzić gotowości" (backend
  zwracał 403/„User not found" dla kilku wywołań tej konkretnej sesji —
  ograniczenie środowiska/uprawnień tej sesji, niezwiązane z tym fixem).
  Zapisano jako `evidence/mvp-naprawy-noc-1/organization-readiness.png` dla
  przejrzystości, ale NIE potwierdza wizualnie tego konkretnego commita —
  potwierdzenie jest wyłącznie testem jednostkowym + jednostkowym testem
  komponentu (mutacja RED→GREEN powyżej).
- Czyszczenie danych demo (AUDYT-M06, __M06_REPRO_TEST_...) — POZA zakresem,
  zgodnie z instrukcją, zostawione osobnemu robotnikowi danych.

## 3. WAŻNY — brak strony 404

- Nowy plik: `src/components/NotFoundPage.tsx`. Podłączony na TOP-LEVEL
  wildcard `<Route path="*">` w `src/routes/AppRoutes.tsx` (jedyna zmiana w
  tym pliku poza importem — wszystkie dedykowane przekierowania starych tras
  wyżej w pliku nietknięte). Klucze i18n `notFoundPage.*` w pl/en.
- Test: `tests/components/AppRoutes.not-found-404.test.tsx` (wzorem
  `AppRoutes.ai-chat-routing.test.tsx` — source-level, bo pełny render
  ciągnie całe drzewo providerów). Sprawdza też, że `/results/kpi` ma własną
  trasę PRZED wildcardem (nie ląduje na 404).
- Mutacja RED→GREEN: przywrócenie starego `<Navigate>` → 2/7 testów czerwone.
- Zrzuty: **`nie-ma-takiej-strony-404.png`** — ŻYWO, port 3095 (mój worktree),
  zalogowana sesja `Audyt Nocny`. W pełni po polsku, w powłoce aplikacji,
  przyciski „Wstecz" i „Wróć do Czatu" widoczne i poprawnie ostylowane.

## 4. WAŻNY — górny breadcrumb Ustawień stały na „Profil”

- Plik: `src/hooks/useBreadcrumbs.ts` — sekcja SETTINGS czyta teraz sekcję
  WPROST z URL-a (`normalizeSettingsSectionFromPath`, to samo źródło co
  lokalny, poprawny breadcrumb w `SettingsView.tsx`), zamiast z niekompletnego
  `currentView`.
- Test: `tests/unit/frontend/useBreadcrumbs.settings.test.ts` (6 testów: profile,
  import-export, security-dashboard, tenant-defaults, connected-apps, templates).
  Istniejący `useBreadcrumbs.day219.test.ts` (Admin, 16 testów) nadal zielony.
- Mutacja RED→GREEN: przywrócenie starej gałęzi if/else → 6/6 nowych testów czerwone.
- Zrzuty: **`settings-import-export.png`** — ŻYWO, port 3095. Górny pasek
  poprawnie pokazuje „Ustawienia › Import/Eksport ustawień" (PRZED naprawą:
  zawsze „Ustawienia › Profil").

## 5. KOSMETYKA — `OverflowTooltip` teoretyczne „undefined”

- Plik: `src/components/shared/ModuleHub/FilterableTable.tsx` — nowa
  `toTooltipSafeString()`, podłączona w obu miejscach budujących `content`
  dla `OverflowTooltip`.
- Test: `FilterableTable.overflowTooltipGuard.test.tsx`.
- Mutacja RED→GREEN: przywrócenie bezwarunkowego `String(value)` → test czerwony.
- Zrzuty: nie robione (guard bez zmiany widocznej geometrii; potwierdzone
  jednostkowo + cała rodzina `ModuleHub/__tests__/` 42/42 zielona).

## 6. PRZYRZĄD — `zrzut.mjs` nadpisywał cudzą sesję

- Nowy plik: `scripts/dev/odbior-zywo/zrzutSesja.mjs` (logika testowalna bez
  playwrighta). `zrzut.mjs` NIGDY domyślnie nie zapisuje sesji; zapis wymaga
  `--zapisz-sesje` I tokenu w stanie I url != `/login`; zapis atomowy
  (plik tymczasowy + rename). Ostrzeżenie dopisane w nagłówku skryptu.
- Test: `tests/unit/odbior/zrzutSesja.test.ts` (10 testów).
- Mutacja RED→GREEN: przywrócenie „zawsze zapisuj gdy != /login” → 4/10 czerwone.
- Ten fix był UŻYTY na żywo w tej sesji: wszystkie 3 zrzuty poniżej zrobione
  BEZ `--zapisz-sesje` — plik `/private/tmp/stanowisko-noc/auth.json` NIE
  został dotknięty (sprawdzone: `mtime` sprzed zrzutów).

## 7. KOSMETYKA — surowy slug/ID techniczny w UI

- Audyty: `src/components/Audit/method/tabs/AuditLibraryTab.tsx` — ukryto
  `row.packKey` pod tytułem pakietu (`row.title` już widoczne).
  `[ODMROZENIE 12_AUDITS DEC-397]`. Test: nowy przypadek w
  `AuditLibraryTab.test.tsx` ("never renders the raw technical packKey").
  Mutacja RED→GREEN potwierdzona.
- Materiały (dokument raportu, „DOC-DBR77-…” w tytule treści): **NIEZROBIONE.**
  Zbadano kodem (agent researcher) — `DocumentStudioReportView.tsx:99` renderuje
  `schema.title` WPROST, bez żadnej konkatenacji z ID; grep całego repo (src+
  server+testy+migracje) po dokładnym literale i po wzorcu
  `DOC-[A-Z0-9]+-[0-9]{8}-[A-Z]+-[0-9]+` — zero trafień. To jest treść DOKUMENTU
  (dane), nie szablon kodu — string prawdopodobnie wpisany/wygenerowany raz do
  konkretnego rekordu w bazie. Naprawa wymaga edycji danych (tytuł dokumentu w
  DB), nie kodu — POZA zakresem tego zlecenia (robotnik frontendu), zgodnie z
  zasadą „dane demo naprawia osobny robotnik danych".
- Zrzuty: nie robione (drugi fragment niezrobiony; pierwszy — zmiana tekstowa
  bez wpływu na layout, potwierdzona testem).

## Domknięcie

- `npx esbuild` (exit 0) dla KAŻDEGO zmienionego pliku źródłowego (lista w
  commitach); `zrzut.mjs`/`zrzutSesja.mjs` dodatkowo `node --check` + esbuild
  `--format=esm` (top-level await, nie da się bundlować do cjs).
- `npx vitest run tests/unit/i18n/` — 42/44 zielone; 2 czerwone
  (`idea-workspace-required-keys.test.ts`, klucze `ideas.table.*`/
  `ideas.financial.*` w `src/components/MyWork/**`) — **pre-istniejący dług,
  potwierdzony identyczny na `origin/staging` (diff testu = 0), NIE dotknięty
  przeze mnie, poza zakresem tych 7 defektów.**
- `bash scripts/check-list-canon.sh` — OK, dług spadł o 3 (364→361).
- `bash scripts/check-artefakt.sh` — OK, zero nowych naruszeń.
- Zrzuty na żywo: sesja `/private/tmp/stanowisko-noc/auth.json` była WAŻNA
  (token świeży, exp 2026-09-06 07:14) i zalogowana jako „Audyt Nocny"
  (Właściciel, org DBR77) — ALE serwer vite na porcie 3090 (wspólny, PID
  70120) serwował kod z `/private/tmp/m03`, NIE z tego worktree, więc zrzuty
  stamtąd pokazywałyby STARY kod bez moich napraw („przyrząd pokazuje nie
  produkt"). Odpaliłem WŁASNY serwer dev (`vite --port 3095`, zatrzymany po
  zrzutach) w `/private/tmp/wt-fix1`, skopiowałem `.env.local` z `m03` (target
  API = staging), i zrobiłem 3 zrzuty realnym kodem tej gałęzi:
  `nie-ma-takiej-strony-404.png` (defekt 3, pełne potwierdzenie),
  `settings-import-export.png` (defekt 4, pełne potwierdzenie),
  `organization-readiness.png` (defekt 2 — sesja miała 403/„User not found"
  na kilku wywołaniach API, ekran pokazał błąd wczytywania zamiast listy
  konfliktów; niepotwierdzone wizualnie, potwierdzone tylko testem).

## Co niezrobione

1. Materiały — surowy „DOC-DBR77-…” w tytule dokumentu (DATA, nie kod — patrz p.7).
2. Czyszczenie danych demo (Organizacja + Spotkania) — świadomie poza zakresem.
3. `/organization/readiness` niepotwierdzony wizualnie na żywo (błąd API sesji
   testowej, nie kodu) — zalecane ponowne sprawdzenie na innej/świeżej sesji.
