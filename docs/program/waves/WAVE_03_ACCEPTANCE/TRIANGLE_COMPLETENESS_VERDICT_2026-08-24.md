# Werdykt nadzorcy — kompletność integracji Admin + Settings + Superadmin

Data: 2026-08-24 · Podpis: Fable (sesja nadzorcza programu dokończenia)
Status: `SIGNED / BINDING_FOR_MODULE_02_03_ACCEPTANCE`

Zakres na polecenie właściciela (2026-08-24): finalna kompletność integracji
logicznej i funkcjonalnej trójkąta Admin + Settings + Superadmin ma być
wykonana lub nadzorowana osobiście przez Fable. Materiał zebrały cztery
niezależne zadania robotnicze (analiza uwag i kompletności; weryfikacja
superadmin end-to-end na żywym runtime; dowody przeglądarkowe m02; integracja
m03). Trzy twierdzenia nośne zweryfikowałem osobiście w kodzie
(`requireActiveMembership` na endpointach osobistych; biała lista podłączonych
ekranów Admina; brak konsumentów trzech przełączników bezpieczeństwa) —
wszystkie potwierdzone.

## Werdykt per obszar

| Obszar | Werdykt | Uzasadnienie |
|---|---|---|
| **Settings (15)** | `FUNCTIONALLY_COMPLETE / CLEANUPS_PENDING` | 36 ekranów podłączonych; zapis/odczyt działa (dowody m02); rozplątanie D10 wykonane na poziomie tras (m02+m03). Porządki: OAuth backend gotowy przy UI „Coming soon"; osierocony `AppearanceSettings`; brak PL dla etykiety grupy Billing. |
| **Admin (14)** | `STRUCTURE_OK / CONTENT_14_OF_55 / NOT_ACCEPTABLE_AS_WHOLE` | Siedem domen i powłoka zgodne ze spec; realnie podłączonych 14/55 ekranów (biała lista w `AdminSettingsModule.tsx`), 40 renderuje uczciwe „Niezweryfikowane". Założenie właściciela z 21.08 („wszystko podłączone") obalone przez kod. |
| **Superadmin** | `ARCHITECTURE_AS_DESIGNED / TWO_DEFECTS` | Rozdzielenie ról zamierzone i udokumentowane (SUPERADMIN nie dziedziczy `/admin/*` — decyzja P0 ADM-RAW-P0-001, potwierdzona w runtime). Defekty: P1 i P2 poniżej. |

## Lista MUST przed odbiorem modułów 02/03

| ID | Problem | Dowód | Działanie |
|---|---|---|---|
| TRI-MUST-01 | **Superadmin nie zapisze własnych ustawień osobistych** — 10 endpointów osobistych (powiadomienia, wygląd, GDPR) za `requireActiveMembership`, które 403-uje konto bez wiersza `organization_members`; komunikat `ORG_MEMBERSHIP_REVOKED` mylący. | `server/src/routes/settings.routes.ts:533,1035,2849…5752`; żywy 403 na runtime | Rozdzielić endpointy osobiste od organizacyjnych: preferencje własne konta chronione tożsamością, nie członkostwem. Naprawa + test + powtórka na runtime. |
| TRI-MUST-02 | **Trzy przełączniki bezpieczeństwa Admina nic nie egzekwują** (goście, link-sharing, zatwierdzanie narzędzi) — zapis/odczyt tylko w `adminP32.routes.ts` + rejestr; zero konsumentów. Panel potwierdza politykę, która nie istnieje. | grep konsumentów: brak poza storage/testami | Decyzja właściciela: wdrożyć egzekwowanie (większa praca) albo ukryć/oznaczyć „nieaktywne" do czasu wdrożenia (mała praca). Zakaz pozostawienia placebo. |
| TRI-MUST-03 | **Cztery działające funkcje uwięzione w zakładkach** (`api-access`, `scim-lifecycle`, `risk-summary`, `ai-operations`) — ich pozycje w lewym menu mówią „Niezweryfikowane", a realny ekran żyje jako pozioma zakładka gdzie indziej; łamie kontrakt menu. | `AdminSettingsModule.tsx` biała lista vs nawigacja | Wpiąć ekrany pod ich pozycje menu (rozszerzyć białą listę o istniejące implementacje). |
| TRI-MUST-04 | **Podwójna redirekcja gubi superadmina**: `/settings/billing` itd. → `/admin/*` → P0-guard odbija na `/superadmin/customers` bez wyjaśnienia. | runtime, zrzuty m03 evidence | Dla roli SUPERADMIN kierować na odpowiednik w `/superadmin/*` albo pokazywać ekran wyjaśniający; nie zmieniać decyzji P0. |
| TRI-MUST-05 | **Ryzyko schematu na świeżej bazie**: `migrationIdentity.ts:56` akceptuje ~2/3 plików migracji (poza zakresem m.in. klucze API, rejestr ustawień); plus znana podwójna migracja `20260412` (dwa niezsynchronizowane systemy migracji). | analiza + incydent runtime m01 | Obowiązkowa weryfikacja na świeżej bazie PRZED fazą 3 (staging). Osobne zadanie naprawcze. |
| TRI-MUST-06 | **Brak domu dla „ustawień domyślnych organizacji"** (język/strefa/waluta/udostępnianie): spec 7 domen nie przewiduje edytora; przekierowania tymczasowo → Command Center (werdykt 08e2beec19). | spec 14_ADMIN + kod | Decyzja właściciela: gdzie ekran ma żyć (proponowane: nowe dziecko w Command Center lub Team & Access). |

## Zamknięte w ramach tej weryfikacji

- Fantom `/admin/operations` naprawiony osobiście (commit `08e2beec19`): Domains → spec-exact `Security & Identity → Domains`; branding/organization/tenant-defaults → Command Center; alias `operations→command`; test anty-fantomowy.
- Aliasy `ROUTES.ADMIN` sprzątnięte (m03, `dff7fa528a`); bramki `OWN-GATE-001..005` = ACCEPTED (`f5fe0cc6b0`).
- Rozplątanie D10 na poziomie tras: m01 (`34080ef9f3`), m02 (`baf89f836e`).
- Gałęzie zachowane nie zawierają utraconej wiedzy o Settings/Admin (sprawdzone).

## Rejestr uwag właściciela

16 uwag z przeglądów 21–24.08 zebrane w `settings-admin-analiza.md` (materiał
sesji nadzorczej): 6 zamkniętych, 10 otwartych — każda otwarta mapowana na
pozycję MUST powyżej albo na listę po-MVP (OAuth UI, AppearanceSettings,
12 kluczy P31 bez konsumenta, egzekwowanie limitów planu, PL etykiety).

## Skutek

Moduły 02/03 NIE trafiają do odbioru właściciela przed zamknięciem
TRI-MUST-01..04 oraz decyzjami właściciela w TRI-MUST-02 (wariant) i
TRI-MUST-06 (lokalizacja). TRI-MUST-05 blokuje fazę 3, nie odbiór modułów.

## Aktualizacja nocna — 2026-08-25 (podpis: Fable)

| ID | Status | Dowód |
|---|---|---|
| TRI-MUST-01 | **CLOSED** | Naprawa 51d78e9182; żywy dowód 9176945792: PUT preferencje → 200 + readback po pełnym reloadzie; izolacja nieosłabiona (kontrola negatywna 403/200). |
| TRI-MUST-02 | **CLOSED** | DEC-12: kontrolki ukryte (0bd36932c5) + spójność w Settings read-only (d345ceac1e). Egzekwowanie = po-MVP z własnym odbiorem. |
| TRI-MUST-03 | **CLOSED** | Fala 1 (5fc3016b05, ea9e00476e): cztery uwięzione funkcje wpięte pod ich pozycje menu. |
| TRI-MUST-04 | **CLOSED** | Naprawa ba0a4759d2; dowód 9176945792: superadmin nie tranzytuje przez /admin. Nowa obserwacja P2 (nie-blokująca): SuperAdminView po ~300ms normalizuje URL do /superadmin/customers (stan Zustand niesynchronizowany z URL) — do sprzątnięcia przy module SuperAdmin, bez wpływu na bezpieczeństwo. |
| TRI-MUST-05 | **OPEN — bramka fazy 3** | Weryfikacja migracji na świeżej bazie (filtr ~2/3 + podwójna 20260412) + testy PG (GDPR/deletion/cold-session) przed stagingiem. |
| TRI-MUST-06 | **DECIDED** | DEC-13: edytor tenant-defaults w Command Center; budowa w nocnym programie Admin 55. |
| TRI-MUST-07 | **NEW — MUST przed wdrożeniem** | Trzy niebezpieczne endpointy odkryte przy autorstwie instrukcji nocnej: GET /api/security/sessions/all bez guardu roli; DELETE /sessions/:id bez sprawdzenia przynależności; /api/admin-data/*: org z URL zamiast z tokenu. Instrukcja nocna zakazuje podpinania UI; wymagane trasy tenant-bezpieczne. |

**Werdykt obszaru Superadmin: ZAMKNIĘTY** (architektura zamierzona, oba defekty naprawione i dowiedzione na żywo).
**Settings:** czeka na finisz graficzny (w toku) i werdykt właściciela.
**Admin:** program „komplet 55/56" w toku (Fale 0+1 done: ~28 ekranów; nocny dyżur Codex buduje dalej).

## Uzupełnienie — ustalenia z macierzy przepływów (2026-08-25, podpis: Fable)

| ID | Problem | Dowód | Klasyfikacja |
|---|---|---|---|
| TRI-MUST-08 | **Audyt mutacji admina nie jest uniwersalny**: projekcja /api/admin/audit-logs ma tylko 2 źródła (19 jawnych logAction w adminP32.routes.ts + role_change_audit_events); mutacje zespołów, domen, ai-settings/ai-governance nie zostawiają wpisu. Narusza kontrakt spec „every Admin mutation defines … audit trail" (AC-005). Stan zastany, nie wina nocnych ekranów. | macierz przepływów, grep adminAuditService | MUST w programie Admin 55 (przed CLOSED_FINAL modułu 03) |
| TRI-OBS-09 | Zmiana planu (PUT /api/admin/billing/plan) nie zapisuje subscription_history (jedyny writer: dunningService.ts:502) — ekran „Plan history" pokaże pustkę mimo zmian. | macierz przepływów | WAŻNE — dołączyć do fali Billing |
| TRI-OBS-10 | „Configuration Versions" wersjonuje Prompt OS, nie politykę ai-settings/ai-governance — dwa rozłączne systemy. | macierz przepływów | WAŻNE — decyzja przy fali AI |
| TRI-MUST-11 | GET /api/access-control/requests: superadmin-only i bez filtra organizacji (access-control.routes.ts:89) — ekran „Access requests" NIE może go wołać; wymagany endpoint tenant-scoped. | access-control.routes.ts:89 | MUST — reguła weryfikacji nocnej (jak TRI-MUST-07) |

## Uzupełnienie — odbiór przepływów nocy (2026-08-25, podpis: Fable)

| ID | Problem | Dowód | Klasyfikacja |
|---|---|---|---|
| TRI-MUST-13 | **ADMIN ma efektywny dostęp `'*'`** (effectiveAccessService, commit 2026-05-17) — przechodzi KAŻDĄ kontrolę capability, w tym `admin.project_roles.manage`; żywy dowód: ADMIN utworzył rolę (200, pełny formularz), wbrew zamierzonemu modelowi DEC-17 (OWNER-only). Zasięg: cały system uprawnień admina. | FLOW_VERDICTS.md (8e6931a367) | **MUST przed demo** — naprawa in-house (model uprawnień), nie w zadaniu Codexa |
| TRI-OBS-14 | `billing_alerts` nie istnieje na żadnej czysto zmigrowanej bazie Postgres (migracja sklasyfikowana jako SQLite-only przez filtr). Kod fail-closed z uczciwym komunikatem, ale funkcja martwa wszędzie. | FLOW_VERDICTS.md | dołączyć do TRI-MUST-05 (bramka migracyjna fazy 3) |

## Warstwa 3 odbioru nocy Codexa — PODPIS (2026-08-25, Fable)

Werdykt: **PRZYJĘTE W CAŁOŚCI po naprawach.** Warstwa 1 (kod): ACCEPT_PARTIAL →
warunki FIX-1..9 wykonane. Warstwa 2 (99 przepływów, żywy runtime): PRZYJĘTE
WARUNKOWO → oba FAIL_NOCY naprawione (FIX-2); 5/5 negatywów TRI-MUST-07 czysto.
Dodatkowo zamknięte przy odbiorze: FIX-11 (IDOR ai-quality), FIX-12
(TRI-MUST-13: wildcard ADMIN → deny-lista owner-only, dowód stash-testem).
Gałąź codex/admin55-fixes-20260825 (nocna praca + naprawy, 252/252 testów)
scalona do codex/m03-admin-20260824. Stan programu Admin: ~50/56 ekranów
podłączonych; pozostałe pozycje w instrukcji dnia 2 (STOP-y wg DEC-19, i18n,
Superadmin fala 1).
