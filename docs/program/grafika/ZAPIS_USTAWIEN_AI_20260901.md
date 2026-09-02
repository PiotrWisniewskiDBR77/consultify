# Pomiar rozstrzygający — zapis Ustawień AI organizacji

**Werdykt: POTWIERDZONE — i szersze niż zgłoszono.** Ekran „Ustawienia AI organizacji”
(`OrgAISettingsView.tsx`, zakładka Governance settings w Centrum sterowania AI) ma realny
defekt odczytu i zapisu: 18 pól (nie ~15) czyta camelCase z odpowiedzi serwera, która jest
wyłącznie snake_case, więc odczyt zawsze pokazuje wartości domyślne, a zapis zawsze
zapisuje z powrotem STARE wartości z bazy. Dodatkowo — **rodzina „trzy piętra” zbadana
w całości (krok 0 zlecenia): piętro superadministratora ma DOKŁADNIE TEN SAM defekt co
piętro organizacji.** Poprawnie zremapowane jest tylko piętro użytkownika. Hipoteza
„dwa piętra poprawne, jedno pominięte” się NIE potwierdza — poprawne jest jedno piętro
z trzech, nie dwa.

---

## 0. Rodzina trzech pięter — sprawdzone wszystkie, nie tylko organizacja

| Piętro | Plik ekranu | Endpoint | Odczyt (front↔serwer) | Zapis (front→trasa→serwis) | Werdykt |
|---|---|---|---|---|---|
| Użytkownik | `src/components/settings/AISettings.tsx` | `/api/ai-settings/user` | `getUserAISetting(settings, 'response_style', 'responseStyle')` — czyta **oba** klucze (linia 144, użyte np. 152-159) | Body budowane RĘCZNIE w snake_case przed wysyłką (`response_style: preferences.responseStyle`, …, linie 322-339) | **POPRAWNE** |
| Organizacja | `src/views/admin/OrgAISettingsView.tsx` | `/api/ai-settings/org/:orgId` | `normalizeOrgAISettings` czyta WYŁĄCZNIE `raw?.policyLevel` itd. (linie 48-79) | `expected = settings` (camelCase) wysyłane wprost jako JSON (linie 291-295, `admin.api.ts:128-138`) | **ZEPSUTE** |
| Superadmin | `src/components/SuperAdmin/SuperAdminAISettings.tsx` | `/api/ai-settings/superadmin` | `normalizeSettings` czyta WYŁĄCZNIE `payload.defaultProvider` itd. (linie 157-209) | `payload = {...settings, fallbackChain}` (camelCase) wysyłane wprost jako JSON (linie 304-316) | **ZEPSUTE — ten sam wzorzec co organizacja** |

Sprawdzone na własne oczy w `server/src/services/aiSettingsService.ts`: `getUserSettings`
(374-405) i `updateUserSettings` (407-489) operują na snake_case identycznie jak
`getOrgSettings`/`updateOrgSettings` (264-372) i `getSuperAdminSettings`/
`updateSuperAdminSettings` (180-261) — serwis jest spójny i konsekwentnie snake_case na
WSZYSTKICH trzech piętrach. To znaczy: **defekt nie leży w serwisie** (który jest jednolity),
tylko w tym, że TYLKO ekran użytkownika ma po stronie frontu warstwę tłumaczącą
nazewnictwo — w INNYM pliku niż oba zepsute ekrany. Zdanie hipotezy „poprawny wzorzec stoi
kilkadziesiąt linii obok w tym samym pliku” jest nieprecyzyjne: poprawny wzorzec
(`getUserAISetting`) leży w `AISettings.tsx`, zupełnie innym pliku niż zepsuty
`OrgAISettingsView.tsx` — nie kilkadziesiąt linii obok, tylko w osobnym module.

Zakres tego pomiaru (i pliku `ZAPIS_USTAWIEN_AI_20260901.md`) to piętro **organizacji**,
zgodnie ze zleceniem — piętro superadmina zgłaszam jako POTWIERDZONE PODEJRZENIE tym samym
mechanizmem, nie doprowadzam analizy do tego samego poziomu szczegółu (nie ma to wpływu na
odpowiedź „czy Piotr przyjął ekran z zepsutym zapisem”, bo ekran superadmina nie jest w
rejestrze pytania).

---

## 1. Ślad przez cztery warstwy — piętro ORGANIZACJI (zmierzone, z liniami)

**Warstwa 1 — co ekran wysyła w ciele żądania.**
`OrgAISettingsView.tsx:291-295`: `const expected = settings;` → `AdminApi.updateOrganizationAISettings(currentOrganization.id, expected as unknown as Record<string, unknown>)`.
`settings` to stan zbudowany przez `normalizeOrgAISettings` (linie 48-79) — obiekt **camelCase**
(`policyLevel`, `maxTokensPerMonth`, `freezeOnLimit`, …).
`src/services/api/admin.api.ts:128-138`: `body: JSON.stringify(settings)` — ciało żądania PUT
niesie klucze camelCase, bez żadnej konwersji.

**Warstwa 2 — co trasa czyta z ciała.**
`server/src/routes/ai-settings.routes.ts:265`: `const settings = req.body;` — trasa **nie
czyta pojedynczego pola** `req.body.policy_level` (korekta względem hipotezy — to nie trasa
robi selekcję pola, trasa przekazuje CAŁE ciało dalej). Linia 275-282: `AISettingsService.updateOrgSettings(orgIdStr, settings, actorId, actorRole, ipAddress, userAgent)`
— `settings` przekazane 1:1 to ten sam camelCase obiekt z warstwy 1.

**Warstwa 3 — co serwis podstawia.**
`server/src/services/aiSettingsService.ts:305`: `const current = await this.getOrgSettings(orgId);`
— pobiera BIEŻĄCY wiersz z bazy jako snake_case (`policy_level`, `max_tokens_per_month`, …,
linie 264-295 — SELECT zwraca WYŁĄCZNIE snake_case, zero aliasów camelCase).
Linie 337-354, np.:
```
settings.policy_level ?? current.policy_level,
...
settings.max_tokens_per_month ?? current.max_tokens_per_month,
...
(settings.freeze_on_limit ?? current.freeze_on_limit) ? 1 : 0,
```
`settings.policy_level` jest `undefined` (ciało niesie `policyLevel`, nie `policy_level`) —
`??` zawsze wybiera `current.policy_level`, czyli STARĄ wartość z bazy. To samo dla
pozostałych 17 pól.

**Warstwa 4 — co trafia do zapytania do bazy.**
`aiSettingsService.ts:306-334` — INSERT … ON CONFLICT DO UPDATE, tablica parametrów
(335-356) zawiera w praktyce same `current.*` (stare wartości) dla 18 pól ustawień, plus
`actorId` (literalnie, linia 355 — to JEDYNA rzecz, która faktycznie się zmienia razem z
`updated_at=CURRENT_TIMESTAMP`). Zapytanie **wykonuje się poprawnie i zwraca sukces** —
UPSERT nie jest pusty składniowo, po prostu zapisuje te same wartości, które już tam były.

**Wniosek zapisu:** trasa zwraca 200 (`res.json(updated)`, route linia 284, gdzie `updated =
getOrgSettings(orgId)` po zapisie — linia 371 serwisu). HTTP-owo „zapis się udał”. Wartości
ustawień w bazie **nie zmieniają się** (poza `updated_at`/`updated_by`).

**Czy front i tak pokaże „zapisano”?** Nie zawsze — `OrgAISettingsView.tsx` ma WŁASNY,
dodatkowy bezpiecznik: po PUT robi GET ponownie (linia 296) i porównuje
`orgAISettingsMatch(persistedSettings, expected)` (definicja 88-113). Ponieważ
`persistedSettings` też przechodzi przez ten sam zepsuty `normalizeOrgAISettings` (czyta
camelCase z odpowiedzi, która jest snake_case), `persistedSettings` zawsze wraca do
WARTOŚCI DOMYŚLNYCH normalizatora — niemal na pewno różnych od tego, co admin właśnie
ustawił. W typowym przypadku to NIE pokazuje fałszywego „zapisano” — pokazuje **błąd**:
„Organization AI settings save was not confirmed by the server” (linia 301-308) albo ogólny
„Failed to save organization AI settings” (317-324). Jest to WIDOCZNIEJSZA awaria niż opisana
w hipotezie („zapisano się pokazuje, nic się nie zmienia”) — tu w większości przypadków
pokazuje się KOMUNIKAT BŁĘDU, nie fałszywy sukces.

Jest jeszcze wcześniejsza bariera: `normalizeOrgAISettings` przy PIERWSZYM wczytaniu ekranu
ustawia `maxAICallsPerDay`/`maxTokensPerMonth` na `0` (bo `raw?.maxAICallsPerDay` jest zawsze
`undefined` — linie 59-60), a `validateOrgAISettings` (115-149) blokuje zapis komunikatem
„Daily AI call limit must be at least 1” / „Monthly token limit must be at least 1” (linie
116-125), zanim żądanie w ogóle wyjdzie do sieci — chyba że admin ręcznie wpisze poprawną
liczbę w oba pola. To NIE zostało zmierzone na żywym serwerze (brak środowiska), oznaczam
jako PODEJRZENIE wysoce prawdopodobne z lektury kodu, nie jako zmierzony fakt.

---

## 2. Tabela pól (piętro organizacji, `organization_ai_settings`)

| nazwa u serwera (`getOrgSettings`) | nazwa na froncie (`normalizeOrgAISettings`) | odczyt gubi? | zapis gubi? |
|---|---|---|---|
| `policy_level` | `policyLevel` | TAK | TAK |
| `max_policy_level` | `maxPolicyLevel` | TAK | TAK |
| `default_proactivity_mode` | `defaultProactivityMode` | TAK | TAK |
| `active_roles` | `activeRoles` | TAK | TAK |
| `default_role` | `defaultRole` | TAK | TAK |
| `enabled_model_ids` | `enabledModelIds` | TAK | TAK |
| `max_ai_calls_per_day` | `maxAICallsPerDay` | TAK | TAK |
| `max_tokens_per_month` | `maxTokensPerMonth` | TAK | TAK |
| `monthly_budget_usd` | `monthlyBudgetUSD` | TAK | TAK |
| `hard_limit_usd` | `hardLimitUSD` | TAK | TAK |
| `freeze_on_limit` | `freezeOnLimit` | TAK | TAK |
| `web_search_enabled` | `webSearchEnabled` | TAK | TAK |
| `artifacts_enabled` | `artifactsEnabled` | TAK | TAK |
| `thinking_steps_enabled` | `thinkingStepsEnabled` | TAK | TAK |
| `focus_modes_enabled` | `focusModesEnabled` | TAK | TAK |
| `voice_enabled` | `voiceEnabled` | TAK | TAK |
| `audit_all_requests` | `auditAllRequests` | TAK | TAK |
| `audit_policy_changes` | `auditPolicyChanges` | TAK | TAK |

**18 pól, nie ~15** — liczba z hipotezy była niedoszacowana (zmierzone przeliczeniem par
front/serwis, nie przyjęte na wiarę).

Pola frontu BEZ odpowiednika w `getOrgSettings` w ogóle (nie jest to błąd nazewnictwa, tylko
brak funkcji po stronie serwera — osobna, mniejsza sprawa): `autoTierEnabled`,
`autoTierDirection`, `autoTierThreshold`, `systemPrompts`, `defaultSystemPromptId`,
`createdAt`, `updatedAt`, `updatedBy` (te trzy ostatnie serwis świadomie nie zwraca —
`getOrgSettings` liczy je z `SELECT *`, ale nie umieszcza w zwracanym obiekcie, linie
270-290).

---

## 3. Który ekran z rejestru to jest

`docs/program/grafika/status.json` → `admin-ai-policy-autonomy` — „Polityka i autonomia”,
**ocena D**, `gdzie: "Administracja → Sterowanie AI → zakładka „Polityka i autonomia”.
Zrzuty: evidence/grafika/146-admin-ai/."`.

Dowód montowania (nie po nazwie, po realnym imporcie): `dev-render/screens/admin-ai.tsx:711`
— `if (adminScreen === 'policy-autonomy') return <AdminAIControlCenterPanel />;` (bez
`initialAiModuleTab`) → `AdminAIControlCenterPanel.tsx:48` → `activeTab` domyślnie `'settings'`
→ linia 162: `<OrgAISettingsView />`. To jest DOKŁADNIE ten sam komponent, który zbadano w
sekcji 1.

**Właściciel NIE oznaczył `admin-ai-policy-autonomy` jako przyjęty.** Lista przekazana w
zleceniu („m.in. przyjęte: `admin-command-ai-policy`, `admin-ai-personas`,
`admin-ai-quality-evaluations`, `admin-ai-ai-incidents`, `admin-ai-configuration-versions`,
`ustawienia-ai-automatyzacja`”) nie zawiera `admin-ai-policy-autonomy` — zgadza się z oceną D
i z zarejestrowanymi wyjątkami tego ekranu w `status.json` (100% po angielsku, crimson na
wybranej roli, trzeci poziom tabów kolidujący z menu) — **żaden z zarejestrowanych wyjątków
tego ekranu nie wspomina o zapisie**, bo defektu zapisu nie da się zobaczyć zrzutem
(patrz sekcja 4).

Uwaga poboczna, ustalona przy okazji: `admin-command-ai-policy` (ocena A, przyjęty) to
**zupełnie inny komponent** — `AdminCommandCenterPanel screen="ai-policy"`
(`dev-render/screens/admin-command.tsx:21,62`), inny endpoint
(`/admin/enterprise-compliance/ai-policy`), niepowiązany kodowo z `OrgAISettingsView` ani z
`aiSettingsService`. Nazwa „Polityka AI” w dwóch różnych miejscach menu to dwa różne ekrany —
przyjęcie jednego (A) nic nie mówi o drugim (D).

---

## 4. Czy defekt był w ogóle widoczny na zrzucie

**NIE — z dwóch niezależnych powodów, oba zmierzone.**

**Powód 1 — harness stoi na podstawionych danych w kształcie, który omija defekt.**
`dev-render/screens/admin-ai.tsx:104-132` definiuje `ORG_AI_SETTINGS` w **camelCase**
(`policyLevel: 'ADVISORY'`, `maxAICallsPerDay: 500`, …) i mockuje `window.fetch` tak, że
KAŻDE żądanie zawierające `/ai-settings/org/` — GET i PUT — zwraca ten sam stały obiekt
(linie 644-647: `if (url.includes('/ai-settings/org/')) { if (method === 'PUT') return
jsonResponse(ORG_AI_SETTINGS); return jsonResponse(ORG_AI_SETTINGS); }`). To jest DOKŁADNIE
kształt, jakiego oczekuje zepsuty `normalizeOrgAISettings` — defekt (serwer zwraca
snake_case, front czyta camelCase) nie ma szansy się ujawnić, bo atrapa serwera od razu mówi
camelCase. Nawet gdyby ktoś kliknął „Zapisz zmiany” na tym harnessie, PUT zwróciłby ten sam
stały obiekt niezależnie od tego, co wysłano — pętla odczyt→zapis→odczyt zawsze domyka się
„zgodnie”, bo mock nie honoruje zapisu w ogóle.

**Powód 2 — obejrzane zrzuty potwierdzają wizualnie.**
Obejrzano bezpośrednio (narzędziem Read, nie z nazwy pliku):
- `evidence/grafika/146-admin-ai/admin-ai-policy-autonomy__PO__light.png` — pola wypełnione
  („Doradczy”/ADVISORY zaznaczony, „Doradca” zaznaczony jako aktywna rola, plakietka
  „Maksymalny dozwolony” przy Autopilot), przycisk „Zapisz zmiany” WIDOCZNY w kadrze (prawy
  górny róg karty).
- `evidence/grafika/146-admin-ai/admin-ai-policy-autonomy__PO__dark.png` — to samo w dark.
- `evidence/grafika/146-admin-ai/admin-ai-ai-limits-budgets__PO__light.png` — inny ekran
  dzielący ten sam endpoint (`AccessLimitsTab`), też pokazuje sensowne liczby (500 wywołań,
  2000k tokenów, budżet 1200/1800 USD) i własny przycisk „Zapisz zmiany”.

Zrzut jest statyczny — nie pokazuje wyniku kliknięcia. Nawet gdyby pokazywał: przycisk zapisu
JEST w kadrze na wszystkich trzech obejrzanych zrzutach, więc formalnie zadanie „czy ekran
miał przycisk zapisu w kadrze” — TAK. Ale ponieważ dane są podstawione w kształcie
kompatybilnym z błędem frontu, **żaden zrzut (przed czy po kliknięciu) nie mógł ujawnić tego
konkretnego defektu**, zgodnie z sugestią zlecenia.

---

## 5. ZMIERZONE vs PODEJRZENIA

**ZMIERZONE (przeczytane w kodzie, linia po linii, cytowane wyżej):**
- Odczyt org gubi wszystkie 18 pól (front camelCase vs serwis snake_case, zero aliasów po
  obu stronach).
- Zapis org jest fantomowy dla tych samych 18 pól — SQL wykonuje się, ale zapisuje wartości
  odczytane chwilę wcześniej z tej samej bazy (`current.*`), nie nowe wartości z formularza.
- Trasa (`ai-settings.routes.ts`) NIE robi selekcji pojedynczego pola — przekazuje całe
  `req.body`; to serwis robi `??`-owe podstawienie pole-po-polu. Korekta względem hipotezy
  co do MIEJSCA mechanizmu (serwis, nie trasa), nie co do ISTNIENIA mechanizmu.
- Piętro superadmina ma identyczny wzorzec błędu (camelCase front, snake_case serwis, zero
  remapowania) — sprawdzone czytaniem `SuperAdminAISettings.tsx` i
  `aiSettingsService.ts:180-261`.
- Piętro użytkownika jest poprawne w obie strony (dual-key odczyt + ręczne snake_case przy
  zapisie) — sprawdzone czytaniem `AISettings.tsx` i `aiSettingsService.ts:374-489`.
- Ekran z rejestru to `admin-ai-policy-autonomy` (ocena D), NIE na liście przyjętych przez
  właściciela.
- Harness dev-render dla tego ekranu podstawia dane w kształcie omijającym defekt (camelCase
  mock zamiast snake_case realnej odpowiedzi) — defekt niewidoczny na żadnym zrzucie z tej
  rundy.

**PODEJRZENIA (wnioskowanie z kodu, NIE zweryfikowane na żywym serwerze/bazie — brak
dostępu do środowiska w zakresie tego zlecenia):**
- Że w realnej bazie demo/staging pole `organization_ai_settings` faktycznie ma inne
  wartości niż domyślne (nie sprawdzano żywej bazy — zgodnie z zasadą „stan danych czytaj z
  żywej bazy” to byłby kolejny krok, którego tu nie wykonano).
- Że walidacja `maxAICallsPerDay < 1` faktycznie blokuje pierwsze kliknięcie „Zapisz” w
  praktyce (wywnioskowane z kodu normalizatora + walidatora, nie klikane na żywym ekranie).
- Że self-check `orgAISettingsMatch` faktycznie renderuje toast błędu użytkownikowi w
  produkcji identycznie jak w kodzie (zależy od `react-hot-toast` w realnym środowisku —
  mechanizm istnieje w kodzie, nie obserwowano go w przeglądarce).
- Zakres defektu na piętrze superadmina nie został doprowadzony do tego samego poziomu
  szczegółu (tabela pól, próba wywołania) co piętro organizacji — potwierdzony ten sam
  MECHANIZM, nie policzone dokładnie ile pól.

## Sprostowanie 2026-09-01 (dyżur 250) — plik cytowany w tym dokumencie nie istnieje

`server/src/routes/ai-settings.routes.ts` (bez prefiksu `ai/`), cytowany w sekcjach 1 i
4 tego dokumentu jako źródło numerów linii i werdyktu „piętro superadmina ZEPSUTE”,
nie istnieje w repozytorium na SHA `df7f13056f` (`ls` zwraca `No such file or
directory`). Jedyny zamontowany plik tego kontraktu to
`server/src/routes/ai/ai-settings.routes.ts`: `Gateway.ts:54,744` montuje go pod
`/api/ai-settings`, a `routes/ai/index.ts:25,64` montuje ten sam router drugi raz pod
`/api/ai/settings`. Na żywym pliku piętro superadmina ma transformacje
`transformSettingsToCamelCase` i `transformSettingsToSnakeCase` (definicje 60–93,
użycie 189–253 na markerze), co przeczy części tego dokumentu dotyczącej
superadministratora. Nie ustalono, czy dokument analizował plik później usunięty, czy
od początku błędną ścieżkę; oba wyjaśnienia są zgodne z dostępnym dowodem. Werdykt
„POTWIERDZONE” o historycznie zepsutym piętrze organizacji pozostaje bez zmian; to
wyłącznie twierdzenie o żywym piętrze superadmina wymaga niniejszego sprostowania.
