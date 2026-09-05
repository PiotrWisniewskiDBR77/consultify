# Wzorce systemowe — atestacja pochodzenia (decyzja CTO 05.09)

Gałąź: `agent/wzorce-systemowe-atestacja-20260905` (baza: `/private/tmp/m03`, tip `b71998043a`).
Worktree: `/private/tmp/ag-wzorce-system`. Wykonawca: robotnik.

Kontekst zlecenia: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/AGENT_MATERIALY_DEFEKTY_20260905.md`,
punkt 1 (sekcja „⚠️ DO DECYZJI WŁAŚCICIELA — wzorzec SYSTEMOWY nie da się odblokować"). Ten
raport zmierzył: „Raport diagnostyczny DRD" i każdy inny wzorzec SYSTEMOWY nie może zostać
zaatestowany ŻADNĄ istniejącą drogą — `listPendingTemplateProvenance` i `approveTemplateProvenance`
filtrują `WHERE organization_id = ?` (organizacja wołającego), a wzorzec systemowy należy do
`SYSTEM_ORG_ID` / ma `organization_id IS NULL`. Skutek: 409 `TEMPLATE_PROVENANCE_UNVERIFIED`
blokował „Użyj wzorca" dla KAŻDEGO wzorca systemowego, bez żadnego wyjścia z kwarantanny.

## Decyzja CTO (05.09) — wykonana dosłownie

> Wzorce systemowe dostarczane z produktem są zaufane z definicji — traktuj je jako atestowane
> (pochodzenie: „systemowy Consultify", prawa: „licencja produktu"), bez ręcznej atestacji;
> wzorce organizacji zostają pod bramką, ale UI ma prowadzić do ekranu „Pochodzenie i prawa"
> jednym klikiem.

## 1. Serwer — bramka provenance rozpoznaje wzorzec systemowy

**Gdzie:** `server/src/services/materials/creationIntent.ts` — trzy resolwery, po jednym na
rejestr:

| Rejestr | Marker „systemowy" | Funkcja |
|---|---|---|
| `document_studio_templates` | `is_system = TRUE AND organization_id = SYSTEM_ORG_ID` (`'__system__'`) | `resolveDocumentStudioTemplate` |
| `report_builder_templates` | `organization_id IS NULL OR is_system = TRUE` (np. „DRD Full Diagnostic Report", migracja `523_drd_report_templates_v2.sql`) | `resolveLegacyReportTemplate` |
| `presentation_templates` | `organization_id IS NULL OR is_system = TRUE` | (wewnątrz `resolvePresentationTemplateForCreation`) |

Każdy z trzech markerów jest DOKŁADNIE tym samym predykatem, który resolver już liczył dla
bramki `TEMPLATE_FORBIDDEN` (widoczność) — nie wprowadzono nowego pojęcia „systemowości", tylko
podłączono istniejące pod drugą bramkę. Zmiana w każdym miejscu jest jednowierszowa: warunek
`if (row.provenance_status !== 'approved')` stał się `if (!systemowy && row.provenance_status !== 'approved')`.

**Zapisane jawnie w kodzie** (nie przez wyjątek w kliencie): każdy z trzech resolverów niesie
komentarz cytujący decyzję CTO 05.09 i wyjaśniający, DLACZEGO ręczna atestacja dla wzorca
systemowego nigdy nie była możliwa (kolejka i UPDATE filtrują `organization_id = <wołający>`,
co z definicji wyklucza `SYSTEM_ORG_ID`) — więc to nie jest obejście bramki, tylko poprawka
zakresu, w którym bramka w ogóle powinna działać.

Bramka dla wzorców ORGANIZACJI nie ruszona: wiersz z `organization_id` realnej organizacji i
`provenance_status <> 'approved'` nadal kończy się 409, niezależnie od tego, czy jest to
`is_public = TRUE` (cross-org publiczny wzorzec innej organizacji — to NIE jest system, ma
realnego właściciela-organizację, więc też zostaje pod bramką).

## 2. Test realdb z dowodem mutacyjnym

Nowy plik:
`server/src/services/materials/__tests__/creationIntentResolver.systemProvenance.pg.test.ts`

Real PostgreSQL (nie mock) — własna, jednorazowa baza-artefakt tej sesji
(`mat_provenance_wzorce_system_20260905`, kontener Docker `pgvector/pgvector:pg16` na porcie
`5440`, po pełnym `migrate.postgres.ts`, ~1113 migracji). Gate fail-closed, wszystkie cztery
zmienne wymagane:

```
RUN_DB_TESTS=1  MOCK_DB=false  WZORCE_SYS_PROV_20260905_CLEANUP=1
DATABASE_URL=postgresql://postgres:postgres@localhost:5440/mat_provenance_wzorce_system_20260905
```

Namespace guard w `beforeAll` (ten sam wzorzec co `deliverableTemplates.provenance.test.ts`
MAT-PROV-19): `current_database()` MUSI zgadzać się z nazwą z `DATABASE_URL` i obie MUSZĄ
zaczynać się od `mat_provenance_` — inaczej test rzuca przed jakimkolwiek zapisem.

9 testów × 3 rejestry (`document_studio_templates`, `report_builder_templates`,
`presentation_templates`), po 3 na rejestr — dokładnie żądany dowód mutacyjny:

1. **SYSTEM** (`SYSTEM_ORG_ID` / `organization_id IS NULL`, `provenance_status='unknown'`) →
   resolver zwraca wynik. Dodatkowo sprawdzone, że wiersz w bazie NIE został przy tym
   przepisany (`provenance_status` zostaje `'unknown'`) — decyzja jest odczytowa, nie cicha
   auto-atestacja w danych.
2. **ORGANIZACJA bez atestacji** (własna organizacja wołającego, `provenance_status='unknown'`)
   → 409 `TEMPLATE_PROVENANCE_UNVERIFIED` (bramka NIE zniknęła w ogóle).
3. **ORGANIZACJA po atestacji** — ten sam wiersz z (2), REALNY
   `UPDATE ... SET provenance_status='approved', provenance_json=...` (dokładny kształt, jaki
   wymaga CHECK constraint i jaki produkuje `approveTemplateProvenance`) → resolver teraz
   zwraca wynik.

Wynik:

```
 ✓ document_studio_templates > SYSTEM_ORG_ID row … resolves OK (trusted by definition)
 ✓ document_studio_templates > organization-owned row without attestation → 409
 ✓ document_studio_templates > organization-owned row: after REAL approval UPDATE, resolves OK
 ✓ report_builder_templates  > organization_id IS NULL row … resolves OK (trusted by definition)
 ✓ report_builder_templates  > organization-owned row without attestation → 409
 ✓ report_builder_templates  > organization-owned row: after REAL approval UPDATE, resolves OK
 ✓ presentation_templates    > organization_id IS NULL row … resolves OK (trusted by definition)
 ✓ presentation_templates    > organization-owned row without attestation → 409
 ✓ presentation_templates    > organization-owned row: after REAL approval UPDATE, resolves OK

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

Bez env (`npx vitest run …` bez zmiennych) — cały blok `describe.skipIf` jest no-opem (9
`skipped`, zero importów/efektów), więc nie może udawać zielonego bez pomiaru na maszynie bez
Postgresa.

Uwaga metodyczna znaleziona po drodze (NIE naprawiana — poza zakresem tego zlecenia):
`documentTemplateService.ts`'s `ensureHydrated()` cache'uje rejestr `document_studio_templates`
per-organizacja RAZ na proces (`hydratedOrgs`), bez unieważnienia. Test 2/3 dla tego rejestru
używa świeżego, nigdy wcześniej niehydrowanego `organizationId`, żeby dowód mutacyjny nie
utknął na tej (istniejącej, ortogonalnej) własności cache'u — opisane w komentarzu w teście.

**Test regresji naprawiony przy okazji:** mock-owy `creationIntentResolver.test.ts` miał test
„quarantines an otherwise approved presentation template with unknown provenance", którego
domyślna fikstura (`presentationTemplateRow()`) jest wzorcem SYSTEMOWYM
(`organization_id: null, is_system: true`) — po decyzji CTO ten test dowodził stanu, który
świadomie przestał być prawdą. Zastąpiony dwoma testami: system przechodzi (dowód naprawy) +
wzorzec ORGANIZACJI nadal blokowany (dowód, że bramka nie zniknęła w ogóle). 31/31 zielono.

## 3. UI — przycisk „Przejdź do Pochodzenie i prawa"

Po decyzji CTO kod 409 `TEMPLATE_PROVENANCE_UNVERIFIED` dotyczy już WYŁĄCZNIE wzorców
organizacji — dla nich atestacja jest realną drogą wyjścia z kwarantanny (w przeciwieństwie do
wzorca systemowego, dla którego ta sama droga nigdy nie istniała). Komunikat 409 we wszystkich
TRZECH wejściach dostał działający przycisk zamiast samego opisu słownego:

- **`src/components/ReportsAndPresentations/artifactNavigation.ts`** — nowa
  `resolveTemplateProvenancePath()` → `/presentations?tab=templates&openProvenance=1`.
  `resolveTemplatesDeepLink` (istniejący czytelnik deep-linków Biblioteki, ten sam plik/test co
  `editWorkbookTemplateId` — celowo, po incydencie „martwy przewód" z tego samego raportu
  źródłowego) czyta `?openProvenance=1` i wymusza zakładkę „Szablony".
- **`src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`** —
  `initialOpenProvenance` z deep-linku otwiera `TemplateProvenanceApprovalDialog`
  (`setTemplateProvenanceOpen(true)`) od razu po wejściu, bez dodatkowego kliku.
  Ekran „Pochodzenie i prawa" to ISTNIEJĄCY dialog zamontowany na pasku zakładki Szablony —
  nic nowego nie budowano, tylko podpięto jednoklikowe wejście.
- **`src/components/DocumentStudio/DocumentStudioView.tsx`** (`document_template`),
  **`src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx`** (`presentation_template`),
  **`src/views/ReportBuilderView.tsx`** (legacy `report_template`) — na komunikacie 409 przycisk
  „Przejdź do Pochodzenie i prawa" (po polsku), widoczny TYLKO gdy kod błędu to
  `TEMPLATE_PROVENANCE_UNVERIFIED` (inne kody — `TEMPLATE_FORBIDDEN`, `TEMPLATE_DEPRECATED` itd.
  — dalej pokazują tylko „Wróć do Biblioteki", bo tam nie ma dokąd „przejść do atestacji").

Testy kontraktu deep-linku zaktualizowane i zielone:
`src/components/ReportsAndPresentations/__tests__/templateLibraryContract.test.ts` (27/27,
w tym nowy test producent+czytelnik dla `resolveTemplateProvenancePath`).

## 4. Zrzut PO — status

**Zablokowane w trakcie tego zlecenia — nie sfabrykowano zastępczego zrzutu.**

Wymagany łańcuch: `ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json` +
`scripts/dev/odbior-zywo/zrzut.mjs`. Plik `auth.json` wymaga, żeby WŁAŚCICIEL sam zalogował się
w oknie przeglądarki (`scripts/dev/odbior-zywo/zaloguj.mjs` — „Nikt nie wpisuje jego hasła").
W trakcie tej sesji plik nie istniał (katalog `/private/tmp/odbior-auth/` niesie ślady dwóch
wcześniejszych udanych logowań dziś rano i trzeciej, nieukończonej próby — `zaloguj3.log` bez
linii „Sesja zapisana"), a ja nie mogę kliknąć za właściciela w tym oknie. Czekałem (Monitor,
do 4 minut) — plik się nie pojawił.

Przygotowane i gotowe do użycia, gdy `auth.json` powstanie:
- Własny vite: `cd /private/tmp/ag-wzorce-system && npx vite --port 3056 --strictPort`
  (`.env.local` skopiowany z `/private/tmp/m03` — `VITE_API_TARGET=https://staging.consultify.ai`,
  frontend na tym branchu, backend REALNY staging).
- Zrzut: `ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json node
  scripts/dev/odbior-zywo/zrzut.mjs --port=3056 --url="/presentations?tab=templates"
  --klik="css=[data-testid^='template-gallery-use-']" --czekaj=2500
  --out=evidence/wzorce-system-20260905/01-409-provenance-cta-PO.png`
  — kliknąć na kafelku wzorca ORGANIZACJI bez atestacji (raport źródłowy: „Board Control
  Template — DBR77 — 20260806", 26 takich wzorców na koncie DBR77), poczekać na 409, zrobić
  zrzut karty błędu z widocznym przyciskiem „Przejdź do Pochodzenie i prawa".

**Zastrzeżenie z instrukcji, aktualne również po uzyskaniu zrzutu:** zmiana SERWEROWA (bramka
provenance) nie jest widoczna przez proxy do stagingu (staging niesie STARY kod, deploy poza
zakresem tej sesji) — zrzut dowodzi WYŁĄCZNIE UI komunikatu 409 i przycisku, nie zachowania
wzorca systemowego na żywo. To ostatnie jest dowiedzione dowodem mutacyjnym w §2 (realna,
lokalna Postgres), nie zrzutem.

Vite (port 3056) i kontener Postgres (`mat-prov-wzorce-system-20260905`, port 5440) zostały
zatrzymane po zakończeniu pracy — patrz §5.

## 5. Sprzątanie

- `docker stop mat-prov-wzorce-system-20260905 && docker rm mat-prov-wzorce-system-20260905`
- `kill <PID vite 3056>`
- Baza lokalna `mat_provenance_wzorce_system_20260905` żyła wyłącznie w kontenerze Docker
  usuniętym powyżej — nic nie zostaje na hoście.
- `.env.local` w worktree jest kopią z `/private/tmp/m03` (gitignored, nie wchodzi do commitów).

## Pliki

- `server/src/services/materials/creationIntent.ts` — bramka provenance (3 resolwery).
- `server/src/services/materials/__tests__/creationIntentResolver.systemProvenance.pg.test.ts` — nowy, realdb.
- `server/src/services/materials/__tests__/creationIntentResolver.test.ts` — naprawiony stały test.
- `src/components/ReportsAndPresentations/artifactNavigation.ts` — `resolveTemplateProvenancePath`, `resolveTemplatesDeepLink`.
- `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx` — `?openProvenance=1`.
- `src/components/ReportsAndPresentations/__tests__/templateLibraryContract.test.ts` — naprawiony + nowy test.
- `src/components/DocumentStudio/DocumentStudioView.tsx`, `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx`, `src/views/ReportBuilderView.tsx` — przycisk CTA na 409.

Commity na `agent/wzorce-systemowe-atestacja-20260905`:
- `2de800a8bb` — fix(materials): wzorce systemowe zaufane z definicji w bramce provenance
- `7a29bd0cc9` — feat(materials): przycisk „Przejdź do Pochodzenie i prawa" na 409 wzorca organizacji
