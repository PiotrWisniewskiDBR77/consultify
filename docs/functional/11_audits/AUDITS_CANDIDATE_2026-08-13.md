---
document_id: AUDITS-CANDIDATE-2026-08-13
module: Audits
status: CANDIDATE_NOT_ACCEPTED
truth_type: evidence
owner: piotr
prepared_by: opus-audits
baseline_sha: f3e7df565e0da826ba110d85aad3c3c81a1087f1
candidate_sha: acf666ee4680642702b838c5053c82e4ef4ddfc3
branch: codex/method-audits-20260813
last_reviewed: 2026-08-13
---

# AUDITS_CANDIDATE — kernel metodyczny modułu Audits

**Status: kandydat. Nie scalony, nie wypchnięty, nie wdrożony.**
Odbiór właścicielski na zrzutach nie został wykonany — to następny krok.

---

## 1. Podstawowe dane

| | |
| --- | --- |
| branch | `codex/method-audits-20260813` |
| baseline SHA | `f3e7df565e` (`origin/demo`, 2026-08-12) |
| candidate SHA | `acf666ee46` |
| commity (bez merge) | 20 |
| pliki | 74 zmienione, +23 480 linii |
| worktree | `~/consultify-wt/method-audits-20260813` |
| gałęzie robotników | `codex/method-audits-{u2..u8}` (scalone do kandydata) |

Baza gałęzi to `origin/demo`, zgodnie z regułą projektu. Bieżąca gałąź sesji
(`codex/sync-demo-20260729`) była **695 commitów za demo** i miała 338 obcych
zmian roboczych — nie została tknięta.

---

## 2. Co powstało

### Schemat (`server/migrations/20260813_audits_method_core.sql`)

16 nowych tabel domykających łańcuch obronności + rozszerzenie `audit_programs`
z 11 do 28 kolumn. Migracja forward-only, addytywna, faza DATED.

```
audit_norm_sources → audit_packs → audit_pack_criteria
      ↓ snapshot przy starcie programu
audit_programs → audit_program_members
      ↓
audit_program_criteria   (wymaganie · pytanie · oczekiwany dowód · procedura ·
      ↓                   próba · test · wynik · notatka · wniosek · zgodność
audit_evidence_requests   — każde w OSOBNEJ kolumnie, nie jako „odpowiedź")
      ↓
audit_evidence           (material_id + material_version + content_hash)
      ↓
audit_program_findings → audit_management_responses
      ↓
audit_corrective_actions (correction · containment · corrective · preventive)
      ↓
audit_verifications      (implementation · effectiveness, independence_ok)
      ↓
audit_outputs (immutable) → audit_reports → audit_initiative_proposals

audit_domain_events  — biznesowa ścieżka audytowa
audit_ai_proposals   — Intent → Preview → Confirmation → Commit → Settle
```

### Backend (`server/src/services/audits/`, `server/src/routes/audits/`)

18 serwisów i 12 podtras zamontowanych pod `/api/audits`, obok nietkniętego
`/api/audit` obsługującego dotychczasowy hub.

### Frontend (`src/components/Audit/method/`)

Hub pięciu powierzchni **Library · Processes · Outputs · Reports · Initiatives**
na `StandardModuleBar`/`StandardTable`/`StandardPreview`, z `?tab=` jako
źródłem prawdy. Za flagą `auditsFiveSurfacesV1`, **domyślnie WYŁĄCZONĄ**.

---

## 3. Rejestr pakietów i źródeł — stan po pracy

| Pakiet / źródło | Klasyfikacja | Gotowość |
| --- | --- | --- |
| preset „ISO 27001" (`auditPresets.ts`) | **LEGACY / NOT CURRENTLY VERIFIED** | Nie wolno używać jako podstawy audytu zgodności. 14 domen Annex A w wersji **2013**; norma ma edycję 2022. Brak źródła, wersji i deklaracji praw |
| preset „New company discovery" | INTERNAL/ORGANIZATION FRAMEWORK | Szablon rozpoznania, nie audyt zgodności |
| seed `046_compliance.sql` (SOC2/GDPR/HIPAA/ISO27001) | LEGACY / EVIDENCE_MISSING | Poza domeną Audits; **nie wykonuje się na fresh install** (numer < 500) |
| `internal-process-audit-demo` (nowy, `packSeed.ts`) | **DEMONSTRATION** | 12 kryteriów (3 domeny + 9 liści), każde z wymaganiem, pytaniem, procedurą i odniesieniem do własnego źródła. Idempotentny |

**Nadal nie istnieje ani jeden pakiet `VERIFIED_NORMATIVE`** i nie mógł
powstać — repozytorium nie zawiera zweryfikowanego materiału normatywnego z
potwierdzonymi prawami. Walidator to egzekwuje, nie tylko deklaruje (§5).

Nie pobrano ani nie skopiowano treści żadnej normy ISO/IATF/VDA.

---

## 4. Testy i bramki — wyniki, nie deklaracje

| Bramka | Komenda | Wynik |
| --- | --- | --- |
| Instalacja od zera | `migrate.postgres.ts` na pustej bazie | **exit 0**, 580 migracji, 1347 tabel |
| Suita domeny Audits | `vitest run server/src/services/audits/__tests__/ server/src/routes/audits/__tests__/ --no-file-parallelism` | **155/155**, exit 0 |
| Golden flow E2E | `vitest run …/goldenFlow.e2e.test.ts` | **1/1**, pełny łańcuch |
| Montaż tras w Gateway | `vitest run server/src/routes/audits/__tests__/mounting.integration.test.ts` | **14/14** |
| Testy komponentowe | `vitest run src/components/Audit/method/__tests__/` | **29/29** |
| Typy serwera | `tsc -p server --noEmit` | **0 błędów** |
| Typy frontendu | `tsc --noEmit` | **0 błędów** |
| Kanon tabel | `scripts/check-list-canon.sh` | **exit 0**, zero nowych naruszeń, dług spadł 409 → 408 |

Testy DB biegną przeciw realnemu Postgresowi (`RUN_DB_TESTS=1 MOCK_DB=false`);
bez tych zmiennych suita cicho mockuje bazę i „przechodzi" nic nie sprawdzając.

### Regresja repo — zmierzona, nie założona

`npm run test:unit` na kandydacie: **242 porażki / 16 117 przejść** (16 555
testów, 1573 pliki), exit 1.

Sama ta liczba nic nie znaczy, dopóki nie wiadomo, czy dług jest zastany.
Porównanie jeden do jednego na dwunastu najczęściej padających plikach
(100 z 242 porażek, 41% całości), identyczna komenda i te same warunki:

| | Test Files | Tests |
| --- | --- | --- |
| baseline `origin/demo` @ `f3e7df565e` | 12 failed | **100 failed / 33 passed** |
| kandydat `acf666ee46` | 12 failed | **100 failed / 33 passed** |

Porównanie nazw padających testów: **198 unikalnych pozycji po obu stronach,
zero różnic** (`diff` pusty). Padają `queryHelpers`, `useTableViews`,
`useTableSchema`, `InitiativeController`, `mindmap`, widoki superadmina — nic,
czego ta praca dotyka. Trafienia na słowo „audit" w porażkach dotyczą
`AuditEventsViewer`/`AdminAuditLogsView`, czyli platformowego dziennika zdarzeń,
a nie modułu Audits.

**Wniosek: regresja nie została pogorszona.** Pozostałe 142 porażki poza
zbadanym podzbiorem nie zostały porównane z baseline — to jedyna niedomknięta
część tej bramki.

Uwaga metodyczna: pierwsza próba tego pomiaru dała `exit 1` przy **zerze
uruchomionych testów**, bo `--reporter=basic` nie istnieje w tej wersji vitest.
Druga próba (dwa ciężkie przebiegi równolegle) została zabita przez system
(`exit 144`). Dopiero trzecia, sekwencyjna, dała wynik.

---

## 5. Co zostało udowodnione, a nie tylko napisane

**Łańcuch traceability.** `goldenFlow.e2e.test.ts` przechodzi od pakietu przez
publikację, snapshot kryteriów, dowód z provenance, test audytora, wniosek,
ustalenie, odpowiedź właściciela, działanie korygujące, weryfikację
skuteczności i zamknięcie, po Output, raport i propozycję inicjatywy — a na
końcu odtwarza cały łańcuch jednym zapytaniem SQL i sprawdza każde ogniwo.

**Segregacja obowiązków.** Osobny test na każdy zakaz: audytowany nie zamyka
własnego ustalenia, autor nie recenzuje własnego, właściciel działania nie
weryfikuje własnej skuteczności, akceptacja ryzyka wymaga wskazanej roli,
zamknięcie bez weryfikacji jest odrzucane. Role platformowe nie odblokowują
czynności merytorycznych.

**Bramka normatywności.** Sonda integratora próbowała ją obejść sześcioma
drogami — wszystkie odrzucone: brak źródła, prawa niepotwierdzone, brak wersji,
brak zatwierdzenia eksperta, taksonomia bez pozycji niezgodności, sama
hierarchia domen bez kryteriów. Dodatkowo tytuł sugerujący normę przy
klasyfikacji demonstracyjnej jest błędem.

**Granice Teresy.** 21 testów na wszystkie 9 operacji z `AI_NEVER_COMMITS`.
Commit propozycji wykonuje się w uprawnieniach człowieka; zatwierdzenie
zgodności, wydanie ustalenia, zamknięcie, weryfikacja skuteczności, publikacja
raportu i akceptacja ryzyka są dla AI niedostępne nawet po kliknięciu „zastosuj".

**Montaż tras.** Ten projekt ma historię tras kompletnych w pliku, ale
niezamontowanych. Test buduje aplikację tym samym `initializeRoutes` co
bootstrap i wymaga, by każda z 12 tras odpowiadała odmową uwierzytelnienia,
a nie 404.

---

## 6. Błędy wykryte i naprawione w trakcie

| Co | Jak wyszło |
| --- | --- |
| INSERT do `audit_packs` z listą 31 kolumn i 30 wartościami | Dopiero realne zapytanie do bazy; `esbuild` nie sprawdza typów, a `DbPromise` domyślnie połyka błędy SQL |
| `isNonconformingClassification` wywołana z jednym argumentem i bez `await` | Promise jest zawsze prawdziwy, więc reguła łapała wszystko — złapały to testy robotnika |
| Weryfikacja skuteczności wymagana od korekcji skutku | Golden flow: blokowało zamknięcie każdego ustalenia, przy którym ktoś rzetelnie odnotował doraźną korektę |
| `program.create` osiągalne tylko dla administratora platformy | Ról udziela się w programie, więc bramkowanie tworzenia rolą zamykało moduł w błędnym kole |
| 3 błędy typów w komponentach (m.in. wariant CTA `primary`, którego kanon nie zna) | `tsc` po integracji; robotnicy zgodnie z higieną go nie uruchamiali |
| Testy zostawiały 443 wiersze w 11 tabelach mimo deklaracji o sprzątaniu | Ręczne zapytanie po suicie; dodano `server/scripts/cleanup-audit-test-data.ts` |
| Dane harnessu pokazywały pakiet „ISO 9001:2015" jako zweryfikowaną normę | Oględziny zrzutu; zmienione na własną procedurę klienta |

Osobno warto odnotować **fałszywy pomiar**, który omal nie wszedł do dowodów:
pierwsza próba weryfikacji HTTP odpowiadała `401`/`404` z **cudzego procesu** na
zajętym porcie — mój serwer w ogóle nie wystartował (`EADDRINUSE`).

---

## 7. Zrzuty do odbioru

`~/consultify-wt/_evidence-audits/zrzuty/`

| Plik | Co pokazuje |
| --- | --- |
| `01-library-light.png` | Library, 5 pakietów o 5 różnych klasyfikacjach |
| `02-library-dark.png` | To samo w trybie ciemnym |
| `03-processes-light.png` | Programy, 11 etapów lifecycle z licznikami |
| `04-outputs-light.png`, `05-reports-light.png`, `06-initiatives-light.png` | Pozostałe powierzchnie |
| `07-library-preview-demo.png` | Podgląd pakietu demonstracyjnego — CTA nieaktywne **z podanym powodem** |
| `08-empty-light.png`, `09-error-light.png` | Stan pusty i błędu |
| `10-processes-preview-dark.png` | Podgląd programu: pokrycie, bramki następnego etapu z blokerem, zespół z rolami |

Harness: `npx vite --config dev-render/vite.config.ts --port 3021`, ekran
`?screen=audyty-piec-powierzchni&lang=pl&theme={light|dark}&tab={…}&state={…}`.

---

## 8. Czego NIE zrobiono — uczciwie

1. **Odbiór właścicielski nie odbył się.** Flaga jest wyłączona, nic nie weszło
   na demo. Lista czekowania TRIADA część B nie została przejechana punkt po
   punkcie oczami na wszystkich stanach — sprawdziłem 10 zrzutów, nie 43 punkty.
2. **Regresja `npm run test:unit` nie dobiegła końca.** Wynik nieznany.
3. **Nie ma ekranu-artefaktu audytu** (Work View / Presentation View wg SPEC-A).
   Powstał kernel i pięć powierzchni listowych; artefakt raportu to następny
   krok. `ARTIFACT_ANATOMY_STANDARD.md` zna dziś tylko „Audit Report" jako
   Dokument i nie ma wierszy dla pozostałych obiektów audytu — to luka
   standardu do uzupełnienia, nie do obejścia lokalnym wariantem.
4. **Workspace kryteriów nie ma UI.** Backend obsługuje pełną pracę na
   kryterium (odpowiedź, procedura, próba, test, wniosek), ale ekran do tego
   nie powstał — dziś dostępne wyłącznie przez API.
5. **Ścieżka realnego LLM nieprzećwiczona.** Środowisko nie ma klucza dostawcy;
   generatory Teresy działają w trybie deterministycznym z obniżoną pewnością.
6. **Import normy i generator blueprintu z dokumentu nie powstał** (§6 karty
   MOD-AGR-04). Kernel jest na to gotowy — jest rejestr źródeł, wersjonowanie i
   walidator — ale samo rozpoznawanie dokumentu to osobna praca.
7. **Plan audytów organizacji** (§8 karty) nie powstał.
8. **Testy zostawiają dane** — jest skrypt czyszczący, ale sprzątanie nie jest
   automatyczne po suicie.
9. **Nie testowałem tras HTTP z prawdziwym tokenem** — dowód montażu kończy się
   na odmowie uwierzytelnienia; ścieżki pozytywne sprawdzone na warstwie
   serwisów.

---

## 9. Długi zastane, nie wprowadzone tą pracą

- `ArtifactPropertiesTable` ma nagłówki `Property`/`Value` na stałe po
  angielsku — widać to w polskim podglądzie na zrzutach.
- `StandardTable` formatuje daty względne bez odmiany liczebnika („1 dni temu").
- Menu Audits pokazuje badge `soon`, choć flaga `MODULE_AUDITS` jest otwarta.
- `audit.routes.ts` (tabela `audits`) pozostaje niezamontowany na demo, a
  `POST /api/initiatives/from-audit` czyta z tabeli, do której nie ma
  zamontowanej ścieżki zapisu.
- `044_multi_framework_audit.sql` i `046_compliance.sql` nie wykonują się na
  fresh install (numer < 500).
- Dokumentacja programu mówi `Deliverables`, żywy kod Assessment `Reports`.

---

## COORDINATION_REQUIRED

**problem:** Trzy źródła podają trzy zestawy nazw powierzchni. Zlecenie:
`Sessions`/`Reports`. Dokumentacja: `Processes`/`Deliverables`. Żywy kod
Assessment (flaga domyślnie włączona po odbiorze 2026-08-01):
`processes`/`reports`.

**rekomendowana zmiana:** przyjęto zestaw z żywego kodu — `Library · Processes ·
Outputs · Reports · Initiatives`. Pokrywa się ze zleceniem w 4 z 5 pozycji.

**wpływ na audit lifecycle:** żaden; to etykiety nawigacji.

**eventy/typy:** `AuditProgram`, `AuditOutput`, `AuditReport`,
`AuditInitiativeProposal`. Brak wspólnej szyny zdarzeń w repo — zdarzenia
domenowe trzymane lokalnie w `audit_domain_events`.

**pliki:** `src/components/Audit/method/**`, `server/src/services/audits/**`.

**obejście:** zmiana etykiet to jedna edycja i18n; wymagałaby jednak
przemianowania także Assessment, inaczej moduły metodyczne się rozjadą.

**czy praca niezależna może trwać:** tak.

---

**problem:** `SHARED_CONTRACT_MANIFEST` nie istnieje w repo; brak wspólnej szyny
zdarzeń i brak wpisu Audits w `docs/modules/CONTRACT_OWNERSHIP_REGISTRY.md`.

**rekomendowana zmiana:** Assessment/Core publikuje manifest; do tego czasu
Audits trzyma typy i zdarzenia za lokalną granicą i nie kopiuje Artifact Core.

**czy praca niezależna może trwać:** tak.

---

**problem:** Zlecenie odwołuje się do skali **MPQ ≥27/30**, której w repo nie ma
w żadnej postaci. Jedyna mierzalna bramka wizualna to lista czekowania TRIADA
część B (43 punkty, zaliczenie wyłącznie przy komplecie).

**rekomendowana zmiana:** albo wskazać źródło definicji MPQ, albo przyjąć listę
TRIADA jako bramkę odbioru wizualnego.

**czy praca niezależna może trwać:** tak — bramka dotyczy odbioru, nie budowy.

---

## Status

**AUDITS_CANDIDATE — gotowy do przeglądu, niegotowy do wdrożenia.**
Nie wykonano: merge, push, deploy. Flaga wizualna wyłączona.
Następny krok należy do właściciela: odbiór na zrzutach z §7.
