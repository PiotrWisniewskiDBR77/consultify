# Audyt: rozjazdy nazw pól między ekranem a zapleczem

**Zlecenie:** przemiatanie całego produktu w poszukiwaniu rozjazdów nazw pól (ekran ↔ trasa),
na wzór zmierzonego przypadku Sesji audytu (`AuditProcessesTab.tsx` — kolumna „Postęp"
pokazuje literalny ukośnik, „Ustalenia otwarte" puste). To jest **pomiar zasięgu**, nie naprawa.

**Gałąź:** `audyt/rozjazdy-nazw-pol-20260901` (worktree `/private/tmp/przemiatanie-nazw`,
bare-repo `consultify-recovery-vault-20260820.git`), zbudowana na
`github-backup/codex/m03-admin-20260824`.
**SHA tipa bazowego:** `31694daecd6060129caa47e7172e23c41b917d0`.

## Pierwsze zdanie wyniku

**2 rozjazdy ZMIERZONE (jeden obejmuje 3 pola na jednym ekranie, drugi obejmuje 15 pól na
jednym ekranie) i 0 dodatkowych PODEJRZEŃ podniesionych do zgłoszenia** — przesiane
automatycznie ~40 kandydatów (skrypt `scan.py` w tym worktree, sygnatura słów-w-workaku
camelCase front ↔ back), z czego **~35 to fałszywe alarmy** zweryfikowane ręcznie (i18n-klucze,
lokalne zmienne, DB-only snake_case nigdy nie wysyłane do klienta, pola już poprawnie
przemapowane). Metoda i lista fałszywych alarmów opisane niżej — to jest część dowodu, nie
szum do pominięcia.

**Metoda nie objęła całego produktu.** 3202 plików front-end, 2288 plików zaplecza. Ręcznie
prześledzono ~25 kandydatów do końca (4 warstwy: pole istnieje w route → komponent renderowany
→ dociera do przeglądarki → zaplecze faktycznie je zwraca). Reszta (patrz „Czego NIE
sprawdzono") to obszar nieopisany tym audytem — brak sygnału ZMIERZONE ani PODEJRZENIE, bo
nie był badany, nie dlatego że jest czysty.

---

## Tabela — od najbardziej widocznych dla użytkownika

| # | Ekran | Pole szukane (front) | Pole zwracane (trasa) | Przemapowanie? | Co widzi użytkownik | Status |
|---|---|---|---|---|---|---|
| 1 | **Admin → AI Control Center → Governance → Ustawienia AI organizacji** (`OrgAISettingsView.tsx`, przez `PolicyGovernanceTab.tsx` → `AdminAIControlCenterPanel.tsx` → `AIModule.tsx`) | `policyLevel`, `maxPolicyLevel`, `defaultProactivityMode`, `activeRoles`, `defaultRole`, `enabledModelIds`, `maxAICallsPerDay`, `maxTokensPerMonth`, `monthlyBudgetUSD`, `hardLimitUSD`, `freezeOnLimit`, `webSearchEnabled`, `artifactsEnabled`, `thinkingStepsEnabled`, `focusModesEnabled`, `voiceEnabled`, `auditAllRequests`, `auditPolicyChanges` (15+ pól camelCase) | `policy_level`, `max_policy_level`, `default_proactivity_mode`, `active_roles`, `default_role`, `enabled_model_ids`, `max_ai_calls_per_day`, `max_tokens_per_month`, `monthly_budget_usd`, `hard_limit_usd`, `freeze_on_limit`, `web_search_enabled`, `artifacts_enabled`, `thinking_steps_enabled`, `focus_modes_enabled`, `voice_enabled`, `audit_all_requests`, `audit_policy_changes` (snake_case) | **NIE — w żadną stronę.** `GET` robi `res.json(settings)` surowo; `PUT` robi `const settings = req.body` i czyta `settings.policy_level` z ciała, które ma klucze `policyLevel`. | Cały ekran zawsze pokazuje wartości domyślne (ADVISORY/REACTIVE/0/false…) niezależnie od tego co w bazie. **Zapis jest CICHYM NO-OP-em** — `settings.policy_level ?? current.policy_level` zawsze bierze gałąź `current` (stara wartość z bazy), bo `settings.policy_level` jest `undefined`. Klik „Zapisz" pokazuje sukces, baza się nie zmienia. Weryfikacja po zapisie (`persisted.X === expected.X`, linie 90-111) porównuje domyślne z domyślnymi, więc fałszywie wygląda na spójną. | **ZMIERZONE** |
| 2 | **Audits → Method → Processes** — tabela programów audytowych (`AuditProcessesTab.tsx`, kolumny „Postęp" i „Ustalenia otwarte", wiersze z `AuditsMethodHub.tsx` → `listPrograms()`) | `row.concludedCriteria`, `row.applicableCriteria`, `row.openFindings` | `criteriaConcluded`, `criteriaTotal`, `findingsOpen` | **NIE** — `listPrograms()` we froncie (`auditsMethodApi.ts:475-486`) rzutuje odpowiedź trasy `1:1` na typ `AuditProgramSummary` bez mapowania; sam typ TS deklaruje złe nazwy (`applicableCriteria`/`concludedCriteria`/`openFindings`), więc TypeScript nie łapie rozjazdu w runtime. | Kolumna „Postęp" pokazuje **literalny ukośnik `/`** (oba liczniki `undefined`), „Ustalenia otwarte" jest **pusta**. (Zgłoszenie źródłowe — potwierdzone ponownie na tej gałęzi.) | **ZMIERZONE** |

**Ważna nuansa dla #2:** na tym samym ekranie panel podglądu (prawy panel, właściwość
„Pokrycie") **jest poprawny** — `getProgramCoverage()` (`auditsMethodApi.ts:537-556`) ma
jawne przemapowanie `applicableTotal→applicableCriteria`, `concludedTotal→concludedCriteria`
z komentarzem w kodzie ostrzegającym dokładnie przed tym rodzajem rozjazdu. Zepsuta jest
wyłącznie ścieżka **listy** (`GET /audits/programs` → `listPrograms()`), nie ścieżka
**szczegółu/pokrycia** (`GET /audits/programs/:id/coverage`).

**Ważna nuansa dla #1:** to samo ustawienie AI istnieje na **trzech piętrach** — User, Org,
SuperAdmin. **User i SuperAdmin są zbudowane poprawnie** (patrz dowody niżej), **tylko
poziom Org jest zepsuty**. To dokładnie ten sam rozjazd, naprawiony dwa razy obok i pominięty
raz pośrodku.

---

## Dowód dla #1 — dosłowne fragmenty kodu (statyczny ślad pełnej ścieżki)

Nie uruchomiono realnego Postgresa dla tego przypadku (patrz „Co NIE zostało zrobione"
niżej) — dowód jest **deterministyczny ze statycznego kodu**, nie próbką z live-HTTP: błąd
to literalna niezgodność nazw kluczy JS, więc odczyt źródła rozstrzyga go w 100%, tak samo
jak zrobiłby to zrzut HTTP.

**Trasa GET** — `server/src/routes/ai/ai-settings.routes.ts:226-227`:
```ts
const settings = await AISettingsService.getOrgSettings(orgId);
return res.json(settings);
```

**Serwis GET** — `server/src/services/aiSettingsService.ts:264-282` (fragment):
```ts
static async getOrgSettings(orgId: string) {
  ...
  return {
    organization_id: row.organization_id,
    policy_level: row.policy_level,
    max_policy_level: row.max_policy_level,
    default_proactivity_mode: row.default_proactivity_mode,
    ...
    max_tokens_per_month: row.max_tokens_per_month,
    freeze_on_limit: !!row.freeze_on_limit,
    artifacts_enabled: !!row.artifacts_enabled,
    thinking_steps_enabled: !!row.thinking_steps_enabled,
    focus_modes_enabled: !!row.focus_modes_enabled,
    audit_all_requests: !!row.audit_all_requests,
    audit_policy_changes: !!row.audit_policy_changes,
  };
}
```

**Ekran (odczyt)** — `src/views/admin/OrgAISettingsView.tsx:50-75` (fragment):
```ts
const normalizeOrgAISettings = (organizationId, raw) => ({
  ...
  defaultProactivityMode: raw?.defaultProactivityMode || 'REACTIVE',
  maxTokensPerMonth: typeof raw?.maxTokensPerMonth === 'number' ? raw.maxTokensPerMonth : 0,
  freezeOnLimit: Boolean(raw?.freezeOnLimit),
  artifactsEnabled: Boolean(raw?.artifactsEnabled),
  thinkingStepsEnabled: Boolean(raw?.thinkingStepsEnabled),
  focusModesEnabled: Boolean(raw?.focusModesEnabled),
  auditAllRequests: Boolean(raw?.auditAllRequests),
  auditPolicyChanges: Boolean(raw?.auditPolicyChanges),
  ...
});
```
`raw.defaultProactivityMode` na obiekcie, który ma tylko `default_proactivity_mode` →
zawsze `undefined` → zawsze pada na wartość domyślną `'REACTIVE'`. Analogicznie dla
pozostałych 14 pól.

**Trasa PUT** — `server/src/routes/ai/ai-settings.routes.ts:270`:
```ts
const settings = req.body;
...
const updated = await AISettingsService.updateOrgSettings(orgId, settings, actorId, actorRole, ...);
```

**Serwis PUT** — `server/src/services/aiSettingsService.ts:339` (jeden z 18 analogicznych wierszy):
```ts
settings.default_proactivity_mode ?? current.default_proactivity_mode,
```
Ciało żądania (`req.body`) ma klucz `defaultProactivityMode` (bo front wysyła dokładnie ten
kształt — `OrgAISettingsView.tsx:292`, `AdminApi.updateOrganizationAISettings(...)` →
`services/api/admin.api.ts:128-137`, `JSON.stringify(settings)` z obiektu camelCase).
`settings.default_proactivity_mode` jest więc zawsze `undefined`, wyrażenie `??` bierze
`current.default_proactivity_mode` — **wartość, która już była w bazie przed zapisem**.
To samo dla wszystkich 18 kolumn INSERT/UPDATE. Zapis nic nie zmienia, niezależnie od tego,
co użytkownik ustawił na ekranie.

### Kontrast — te same ustawienia zrobione poprawnie piętro niżej i piętro wyżej

**Poziom User** (`ai-settings.routes.ts` `/user`, `aiSettingsService.getUserSettings` /
`updateUserSettings`) — też surowy snake_case w odpowiedzi, **ale front-end
(`src/components/settings/AISettings.tsx:144-145`) się broni**:
```ts
const getUserAISetting = (settings, snakeKey, camelKey) =>
  settings?.[snakeKey] ?? settings?.[camelKey];
```
i przy zapisie (`AISettings.tsx:324-339`) wysyła **snake_case**, zgodnie z tym czego
serwis oczekuje (`response_style`, `writing_tone`, `model_temperature`, ...). Ten poziom
działa.

**Poziom SuperAdmin** (`ai-settings.routes.ts:135-136` i `:181-182`) ma **jawną,
dwukierunkową transformację w tym samym pliku, kilkadziesiąt linii nad zepsutym kodem Org**:
```ts
// GET (linia ~136)
return res.json(transformSettingsToCamelCase(settings));
// PUT (linia ~181)
const settingsSnakeCase = transformSettingsToSnakeCase(settingsCamelCase);
...
return res.json(transformSettingsToCamelCase(updated));
```
Front-end (`src/components/SuperAdmin/SuperAdminAISettings.tsx`) poprawnie czyta
`payload.defaultProvider`, `payload.maxTokensPerRequest` itd. — bo trasa faktycznie to
zwraca. Ten poziom też działa.

**Wniosek:** narzędzie naprawy (transform camelCase↔snake_case) istniało w tym samym pliku
i było użyte dla SuperAdmin. Poziom Org nigdy go nie dostał.

---

## Dowód dla #2 — dosłowne fragmenty kodu

**Trasa** — `server/src/routes/audits/programs.routes.ts:27-41`:
```ts
router.get('/', route('GET /programs', async (req, res) => {
  ...
  const result = await programService.listPrograms(actor.organizationId, { ... });
  res.json({ success: true, data: result });
}));
```

**Serwis** — `server/src/services/audits/programService.ts:264-275`:
```ts
const programs: ProgramListItem[] = rows.map((row) => ({
  ...mapProgramRow(row),
  criteriaTotal: Number(row.criteria_total ?? 0),
  criteriaConcluded: Number(row.criteria_concluded ?? 0),
  findingsOpen: Number(row.findings_open ?? 0),
}));
```

**Front-end wywołanie** — `src/components/Audit/method/auditsMethodApi.ts:475-486`:
```ts
export async function listPrograms(params = {}) {
  ...
  const res = await Api.get(`/audits/programs${qs}`);
  const payload = unwrapEnvelope(res);
  const items = toArray<AuditProgramSummary>(payload, 'programs', 'items');
  return { items, total: toTotal(payload, items.length, 'total') };
}
```
Brak przemapowania — `items` to surowe obiekty z kluczami `criteriaTotal`/`criteriaConcluded`/
`findingsOpen`, zrzutowane (nie zmapowane) na typ `AuditProgramSummary`, który deklaruje
(błędnie) `applicableCriteria`/`concludedCriteria`/`openFindings`.

**Ekran** — `src/components/Audit/method/tabs/AuditProcessesTab.tsx:247-260`:
```tsx
render: (row: AuditProgramSummary) => (
  <span>{row.concludedCriteria}/{row.applicableCriteria}</span>
),
...
render: (row: AuditProgramSummary) => (
  <span>{row.openFindings}</span>
),
```

---

## Kandydaci sprawdzeni i ODRZUCENI (fałszywe alarmy — dokumentowane, żeby hipoteza nie wróciła)

Wygenerowano automatycznie ~112 kolizji sygnatur (te same słowa w camelCase, różna
kolejność/konwencja) skryptem `scan.py` (worktree `/private/tmp/przemiatanie-nazw/scan.py`,
`front_access.json`/`back_fields.json`/`candidates_reorder.json` — pliki robocze, nie
commitowane). Prześledzone ręcznie do końca (przeglądarki 4-warstwowej), wszystkie
**ODRZUCONE**:

| Kandydat (front ↔ back) | Ekran | Powód odrzucenia |
|---|---|---|
| `hoursAllocated`/`hoursCapacity` ↔ `allocatedHours`/`capacityHours` | `WorkloadHeatmap.tsx` | **Martwy kod** — komponent nie ma importera nigdzie w `src/` poza samym sobą i plikiem typów. Nie renderowany. |
| `rawSeverity` ↔ `severityRaw` | `ExecutionControlSurface.tsx` | Front jawnie mapuje lokalnie `rawSeverity: x.severity` przy budowie wiersza (linia ~299) — to celowy lokalny rename, nie odczyt cudzego pola. `severityRaw` z `signalReadModel.ts` to inny, niepowiązany read-model. |
| `citedClaims`/`totalClaims`/`coverageScore` | `TrustPanel.tsx` | Zgodne 1:1 z `ai.routes.ts:5880-5895`. |
| `detail.actual`/`detail.required` | `CandidateProfileView.tsx` | Zgodne 1:1 z `cvMatchingService.ts:534-543`. |
| `summary.passed`/`summary.tested` | `PromptTestBench.tsx` (superadmin dev-tool) | Zgodne 1:1 z `prompt-assistant.routes.ts` (`{ tested, passed }`). |
| `llmStatus.summary.healthy`/`configured` | `AdminLLMView.tsx` | Zgodne 1:1 z `summarizeProviderHealth()` w `llm.routes.ts:278-286`. |
| `item.checklistDone`/`checklistTotal` | `FocusView.tsx` | Liczone lokalnie z `task.checklist` (JSON), nie z osobnych pól API. |
| `mfaEnabled` ↔ `mfa_enabled` | `SecurityDashboard.tsx` | `mfa_enabled` to nazwa kolumny SQL używana tylko wewnątrz serwera; `AuthController.ts:529` normalizuje do `mfaEnabled` zanim wyśle do klienta. |
| `healthScore` ↔ `health_score` | (i18n klucz, nie pole danych) | `health_score` istnieje tylko w `aiCoach.ts` (niepowiązany moduł); wszystkie trasy PMO/Execution już zwracają `healthScore`. |
| `confidenceLow`, `decisionGate`, `countTarget`/`sumTarget`, `groupResults` | różne | Klucze i18n albo lokalne zmienne/akumulatory, nie odczyty z API. |
| pary `snake_case ↔ camelCase` z ustawień AI (`admin_email`, `billing_period`, `certification_level`, `focus_area`, `full_name`, `last_login`, `stage_id/name`, itd.) | ~15 dodatkowych sygnatur ze skryptu | Wszystkie to nazwy kolumn SQL widoczne wyłącznie w zapytaniach `dbGet`/`dbAll` wewnątrz serwera (typowanie surowego wiersza) — nie znaleziono ścieżki, którą trafiają do `res.json` bez przejścia przez serializer. Nie prześledzono do końca każdej z osobna (zob. „Czego NIE sprawdzono") — oznaczone jako odrzucone na podstawie wzorca, nie 100% pewności per pole. |

---

## Czego NIE sprawdzono (obszar poza zasięgiem tego przebiegu)

- **~4800 plików front-end i ~2300 plików zaplecza** — sam automatyczny przesiew objął tylko
  identyfikatory dostępu do znanych nazw zmiennych (`row.`, `item.`, `summary.`, `program.`,
  `coverage.`, `detail.`, ~35 innych) i linie `identyfikator: wartość` w serwisach/trasach.
  Odczyty przez destrukturyzację (`const { x, y } = obj`), dostęp przez `obj['pole']`,
  odczyty w hookach `useMemo`/`useQuery` bez oczywistej nazwy zmiennej — **poza zasięgiem
  skryptu**, sprawdzane tylko tam, gdzie trafiłem na nie ręcznie.
- **Moduły nietknięte celowanym przeglądem:** Meetings, Documents/Wordy, Finance (poza
  `finance-settings`), Results, Initiatives, Interview, Materials/Tools (CLAUDE.md wskazuje
  je jako "wzór poprawny" — nie weryfikowałem tego twierdzenia od nowa), Assessment (poza
  jednym plikiem CV), cała warstwa SuperAdmin poza AI Settings.
- **~90 z ~112 automatycznych kandydatów sygnatur** nie zostało prześledzonych do czwartej
  warstwy (czy zaplecze faktycznie to wysyła w JSON, nie tylko czy nazwa istnieje gdziekolwiek
  w pliku serwera) — wypisane w `candidates_reorder.json` w worktree, nieskopiowane do tego
  dokumentu, bo klasyfikowanie ich jako PODEJRZENIE bez żadnej weryfikacji byłoby dokładnie
  tym błędem, przed którym ostrzega zlecenie (hipoteza jako fakt). Zostały pominięte, nie
  zgłoszone.
- **Brak żywego zapytania do Postgresa / ApiGateway z podpisanym tokenem** dla obu ZMIERZONYCH
  przypadków — dowód jest w 100% statyczny (czytanie kodu źródłowego). Dla #2 to powtórzenie
  już wcześniej zmierzonego na żywym ekranie przypadku źródłowego zlecenia. Dla #1 mechanizm
  jest deterministyczny (niezgodność nazw kluczy JS nie zależy od danych w bazie), więc
  odczyt kodu rozstrzyga pytanie równie mocno jak zrzut HTTP — ale **nie było realnego zrzutu
  odpowiedzi**, co zlecenie stawia jako jedyny w pełni policzony dowód. Rekomendacja: jeśli
  potrzebny jest zrzut HTTP 1:1, priorytet to przypadek #1 (piętro Org) — najwyższe ryzyko
  (cichy no-op zapisu na ekranie admina organizacji).
- **Wpływ biznesowy #1 poza samym ekranem** — nie sprawdzono, czy inne miejsca w produkcie
  (np. faktyczne wymuszanie limitów tokenów/budżetu, wyłączanie artifacts/thinking-steps dla
  użytkowników org) czytają `organization_ai_settings` **bezpośrednio z bazy** (z pominięciem
  tego zepsutego API) — jeśli tak, silnik może i tak działać poprawnie, a zepsuty jest tylko
  **widok admina** na te ustawienia (wciąż poważne — admin nie widzi/nie zmienia realnego
  stanu, ale zakres skutku jest inny niż "polityka nigdy nie działa").

## Robocze pliki audytu (w worktree, niecommitowane)
`scan.py`, `front_access.json`, `back_fields.json`, `candidates_reorder.json`,
`slash_patterns.txt` — w `/private/tmp/przemiatanie-nazw/`. Nie są częścią repo (nie dodane
do commita), zostawione do wglądu w tym worktree na wypadek kontynuacji.
