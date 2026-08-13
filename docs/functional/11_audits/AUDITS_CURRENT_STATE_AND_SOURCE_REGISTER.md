---
document_id: AUDITS-CURRENT-STATE-AND-SOURCE-REGISTER
module: Audits
status: GATE_U0_BASELINE
truth_type: as-is-verified-in-runtime
owner: piotr
prepared_by: opus-audits
baseline_sha: f3e7df565e0da826ba110d85aad3c3c81a1087f1
branch: codex/method-audits-20260813
last_reviewed: 2026-08-13
---

# Audits — stan obecny i rejestr źródeł (Gate U0)

Dokument powstał z czterech niezależnych sond czytających **kod, migracje i żywy
schemat bazy**, nie dokumentację. Każde twierdzenie ma wskazany plik. Gdzie
wcześniejsze dokumenty twierdziły coś innego niż runtime — rozstrzyga runtime.

Baza dowodowa: fresh install `origin/demo` @ `f3e7df565e` na Postgres 17
(579 migracji, 1347 tabel, exit 0) — `~/consultify-wt/_evidence-audits/baseline-schema-20260813.sql`.

---

## 1. Ustalenia, które zmieniają założenia zlecenia

Trzy założenia wejściowe okazały się nieprawdziwe wobec kodu. Wszystkie zgłoszone
w sekcji COORDINATION_REQUIRED na końcu.

| Założenie | Stan faktyczny | Dowód |
| --- | --- | --- |
| „Istniejące tabele pięciu funkcji są kanonem, nie projektuj ich od nowa" | **Pięć powierzchni nie istnieje.** Moduł ma jedną listę programów + jedną flagowaną zakładkę raportów DRD (należących merytorycznie do Assessment) | `src/components/Audit/AuditsHub.tsx:621-644` |
| Nazwy powierzchni: Library → Sessions → Outputs → Reports → Initiatives | Kanon repo (zaakceptowany przez właściciela) mówi: **Library → Processes → Outputs → Deliverables → Initiatives** | `AGREEMENTS/METHOD_MODULE_FIVE_SURFACES_STANDARD.md:14-28`, `AGREEMENTS/04_AUDITS_REVIEW.md:660-663` |
| „Po otrzymaniu SHARED_CONTRACT_MANIFEST…" | **Plik nie istnieje w repo** (grep całego drzewa: zero trafień). Nie ma też udokumentowanej wspólnej szyny zdarzeń dla Tools/Assessment/Audits | brak pliku |

Dodatkowo dwa pojęcia z zlecenia nie mają definicji w repo: **MPQ (skala 30 pkt)**
oraz kontrakt Teresy **Intent → Preview → Confirmation → Commit → Settle**.
Najbliższe istniejące odpowiedniki: karta audytu modułu (skala 100 pkt,
`Harvard/modules/M12-audyty/KARTA_AUDYTU.md`) i wzorzec Proposal Queue
(`AGREEMENTS/TOOL_ARTIFACT_FUNCTION_CATALOG.md` §7). Implementacja przyjmuje
sekwencję Teresy z zlecenia jako wiążącą i utrwala ją w schemacie
(`audit_ai_proposals`), a MPQ ocenia wg listy czekowania TRIADA część B
(43 punkty) — jedynej mierzalnej bramki wizualnej istniejącej w repo.

---

## 2. Co faktycznie działa dzisiaj

### Frontend — cały moduł to 6 plików

| Plik | Rola | Stan |
| --- | --- | --- |
| `src/components/Audit/AuditsHub.tsx` (1047 l.) | jedyna lista — „Programy audytowe" | ŻYWY, używa `StandardTable`+`StandardPreview` (kanon) |
| `src/components/Audit/AuditOrchestratorWizard.tsx` (511 l.) | kreator 4-krokowy: cel → szablony → przypisani → review | ŻYWY |
| `src/components/Audit/auditApi.ts` (256 l.) | klient API | ŻYWY |
| `src/components/Audit/auditPresets.ts` (225 l.) | dwa statyczne presety | ŻYWY, patrz §4 |
| `src/components/Audit/AuditHistoryView.tsx` (240 l.) | — | **MARTWY: zero importów w całym repo** |
| `src/views/DRDAuditReportView.tsx` (803 l.) | edytor raportu DRD | ŻYWY za flagą `isDrdReportEnabled()` (OFF); **należy do Assessment**, nie do Audits |

Routing: `/audit-programs` pod `BetaGate MODULE_AUDITS`
(`src/routes/AppRoutes.tsx:1409-1423`); flaga `MODULE_AUDITS: 'open'`
(`src/utils/betaAccess.ts:48`) — moduł jest w pełni dostępny, ale menu pokazuje
badge `soon` (`src/components/navigation/Sidebar/menuConfig.ts:171`), co wprowadza
w błąd. Osobno istnieje publiczna strona marketingowa `/audits`
(`src/views/AuditsShowcasePage.tsx`), niepowiązana z produktem.

**Brak ekranu artefaktu.** Kliknięcie wiersza otwiera wyłącznie preview; nie ma
trasy `/audit-programs/:id` — potwierdza to komentarz w kodzie
(`AuditsHub.tsx:929`). Brak ekranów: findings, evidence, corrective actions,
verification, output, report.

**Brak store'a.** Cały stan w `useState` w hubie; zero zustand/react-query.

### Backend

| Endpoint | Montaż | Uwaga |
| --- | --- | --- |
| `GET/POST/PATCH/DELETE /api/audit/programs*`, `/generate-surveys`, `/completion` | **ZAMONTOWANY** bezwarunkowo (`server/src/Gateway.ts:1164`) | jedyna żywa ścieżka modułu |
| `GET/POST/PUT /api/audit` (tabela `audits`) | **NIEZAMONTOWANY na demo/produkcji** — `mountStub` bez wpisu w `STUB_NAMES_WITH_LIVE_UI_ON_DEMO` (`Gateway.ts:1174`, `:389-402`) | martwy kod bez callera |
| `POST /api/initiatives/from-audit` | ZAMONTOWANY (`Gateway.ts:565`) | czyta z `audits`, do której **nie ma zamontowanej ścieżki zapisu** — funkcjonalnie osierocony |
| `GET /api/audit/events` | ZAMONTOWANY | inny domen (platformowy audit trail) |

Uprawnienia: `/api/audit/programs*` chroni wyłącznie `requireOrgAccess()` —
**każdy członek organizacji, niezależnie od roli, może tworzyć, edytować i usuwać
programy audytowe** (`server/src/routes/audit-programs.routes.ts:41-44`). Nie
istnieje żadna rola audytowa (lead auditor, auditee, reviewer).

`server/src/validators/audit.validators.ts` to pusty placeholder — zero schematów.

Zdarzenia: moduł **nie emituje żadnych zdarzeń domenowych** (grep `eventBus|domainEvent`
po plikach domeny: zero trafień).

### Baza — stan przed tą pracą

| Tabela | Producent | Stan |
| --- | --- | --- |
| `audit_programs` | **brak pliku migracji** — leniwy `CREATE TABLE IF NOT EXISTS` w `auditProgramService.ts:124-148` + zrzut `20260719_baseline_gap.sql:2174` | ryzyko dryfu schematu; naprawione w `20260813_audits_method_core.sql` |
| `audits` | `20260627_audits.sql:40` + trzeci, węższy bootstrap w `PostgresDatabase.ts:2147` | dwie niespójne definicje; brak żywej ścieżki zapisu |
| `audit_findings` | `20260627_audits.sql:71` | **zero czytelników i zero pisarzy w kodzie** — martwy schemat |
| `multi_framework_audit_log/actions/retention` | `044_multi_framework_audit.sql` | **nie powstają na fresh install** — numer < 500 wyklucza plik w `isSqliteOnlyMigration()` |
| `compliance_frameworks/status/audits/findings` | `046_compliance.sql` | **też wykluczone**; okrojone warianty w baseline-gap, `compliance_audits` **bez `organization_id`** |

RLS: **nie istnieje w całym repo** — izolacja wyłącznie aplikacyjna przez
`WHERE organization_id = ?`.

---

## 3. Rejestr Audit Packs i źródeł — stan zastany

Zgodnie z wymogiem: dla każdego istniejącego pakietu/źródła podano nazwę, wersję,
źródło, prawa, kompletność, status zatwierdzenia eksperckiego, mapowanie do kodu,
aktualność, klasyfikację i gotowość.

### 3.1 „ISO 27001" — preset frontendowy

| Pole | Wartość |
| --- | --- |
| Nazwa | `ISO_27001_PRESET`, id `iso27001` |
| Wersja pakietu | brak — obiekt nie ma pola wersji |
| Źródło | **nieokreślone**; brak URL, wydawcy, roku wydania |
| Wersja normy | **brak**. Struktura 14 domen `a5`–`a18` odpowiada Annex A **ISO/IEC 27001:2013**; norma została zastąpiona edycją **2022** (93 kontrole w 4 tematach) — preset jest merytorycznie **nieaktualny o jedną edycję** |
| Licencja/prawa | **brak deklaracji.** Etykiety są parafrazami tytułów domen, nie treścią normy — samo to nie tworzy naruszenia, ale nie stanowi też dowodu praw |
| Kompletność | 14 pozycji najwyższego poziomu, zero kryteriów, zero pytań audytowych, zero oczekiwanych dowodów, zero procedur testowych |
| Zatwierdzenie eksperckie | **brak** — żadnego śladu w kodzie ani dokumentacji |
| Mapowanie do kodu | `src/components/Audit/auditPresets.ts:47-145`; `buildPlanFromPreset()` `:219-225` (heurystyka deterministyczna, jawnie nie-AI) |
| Odzwierciedlenie w bazie | **żadne.** `audit_programs.preset` to niewalidowany string; backend nie zna treści presetu |
| **Klasyfikacja** | **LEGACY / NOT CURRENTLY VERIFIED** |
| Gotowość | **nie wolno używać jako podstawy audytu zgodności ISO.** Dopuszczalne wyłącznie jako etykieta historyczna do czasu potwierdzenia źródła, wersji i mapowania |

### 3.2 „New company discovery" — preset frontendowy

| Pole | Wartość |
| --- | --- |
| Nazwa | `NEW_COMPANY_PRESET` |
| Źródło | wewnętrzna heurystyka Consultify; brak normy |
| Kompletność | 6 obszarów funkcji firmy (strategy/finance/sales/product/people/tech) |
| Mapowanie | `src/components/Audit/auditPresets.ts:151-194` |
| **Klasyfikacja** | **INTERNAL/ORGANIZATION FRAMEWORK** — i tak powinien być oznaczony w UI |
| Gotowość | użyteczny jako szablon rozpoznania, **nie jest audytem zgodności** |

### 3.3 Seed `046_compliance.sql` — SOC2 / GDPR / HIPAA / ISO27001:2022

| Pole | Wartość |
| --- | --- |
| Zawartość | 4 wiersze `compliance_frameworks`: SOC2 (`2017`, 9 kontroli), GDPR (`2018`, 12 artykułów), HIPAA (`1996`, 11 pozycji), ISO27001 (`2022`, **tylko 4 kategorie A5–A8**, nie 93 kontrole) |
| Prawa/licencja | **brak pól** źródła, URL, licencji |
| Aktualność | częściowa; ISO27001:2022 reprezentowany szczątkowo |
| Stan runtime | **seed nie wykonuje się na fresh install** — plik `046` (<500) jest pomijany przez produkcyjny runner |
| Mapowanie do Audits | **żadne** — to moduł Compliance Center (admin), nie moduł Audits |
| **Klasyfikacja** | **LEGACY / EVIDENCE_MISSING**, poza domeną Audits |

### 3.4 `multi_framework_assessments` i pokrewne

Należą do Assessment (DRD/SIRI). Zgodnie z `04_AUDITS_REVIEW.md` §5 i §13 **nie
mogą być prezentowane jako pakiety ani raporty Audits**. Flagowana zakładka
„Raporty DRD" w hubie Audits jest naruszeniem tej granicy i została oznaczona do
usunięcia w §22 tej samej karty.

### 3.5 Podsumowanie rejestru

**Nie istnieje ani jeden pakiet o klasyfikacji `VERIFIED_NORMATIVE`.**
Repozytorium nie zawiera żadnego zweryfikowanego, wersjonowanego materiału
normatywnego z potwierdzonymi prawami. Konsekwencja dla implementacji, zgodna
z zleceniem:

1. Buduję kernel (Audit Pack, rejestr źródeł, walidator publikacji).
2. Tworzę **jawnie nienormatywny** pakiet demonstracyjny oparty o publicznie
   opisane zasady audytowania (ISO 19011 jako *odniesienie metodyczne*, nie
   reprodukcja treści), oznaczony `DEMONSTRATION` + `EVIDENCE_MISSING`.
3. Walidator **blokuje** publikację jako `VERIFIED_NORMATIVE` bez źródła, wersji
   i deklaracji praw.
4. Preset ISO 27001 zostaje przeklasyfikowany na `LEGACY` i nie może zasilać
   pakietu normatywnego bez potwierdzenia źródła przez eksperta.

Nie pobieram i nie kopiuję treści norm ISO/IATF/VDA.

---

## 4. Fundament wprowadzony w tym kroku

`server/migrations/20260813_audits_method_core.sql` — forward-only, addytywna,
faza DATED (uruchamia się po wszystkich obecnych migracjach). Wprowadza 16 tabel
domknięcia łańcucha obronności i rozszerza `audit_programs` z 11 do 28 kolumn:

```
audit_norm_sources → audit_packs → audit_pack_criteria
      ↓ (snapshot przy starcie programu)
audit_programs → audit_program_members
      ↓
audit_program_criteria  (requirement · question · expected evidence · procedure
      ↓                  · sample · test · result · note · conclusion · conformity
audit_evidence_requests   — każde w OSOBNEJ kolumnie, nie jako „odpowiedź")
      ↓
audit_evidence  (material_id + material_version + content_hash = provenance)
      ↓
audit_program_findings → audit_management_responses
      ↓
audit_corrective_actions (correction | containment | corrective | preventive)
      ↓
audit_verifications (implementation | effectiveness, independence_ok)
      ↓
audit_outputs (immutable, content_hash) → audit_reports → audit_initiative_proposals

audit_domain_events   — biznesowa ścieżka audytowa
audit_ai_proposals    — Intent → Preview → Confirmation → Commit → Settle
```

Weryfikacja: migracja zastosowana na świeżej bazie (fresh 579 + ta = 580),
exit 0, wszystkie 16 tabel obecne, `audit_programs` = 28 kolumn.

Decyzje modelu warte odnotowania:
- **Snapshot kryteriów w programie**, nie FK do pakietu — publikacja nowej wersji
  pakietu nie może po cichu zmienić trwającego audytu (MOD-AGR-04 §6, §18).
- **Nowa `audit_program_findings`** zamiast rozszerzania martwej `audit_findings`
  — tamta wisi na porzuconym korzeniu `audits` i nie zna kryterium. Stara tabela
  zostaje nietknięta jako legacy.
- **`UNIQUE` po `COALESCE(organization_id,'__global__')`** — zwykły UNIQUE nie
  wyłapałby duplikatu pakietu globalnego, bo NULL nie koliduje.
- **`supports_conformity BOOLEAN NULL`** na dowodzie — pozwala zapisać dowód
  *przeczący* tezie, czego Teresie nie wolno ukryć (MOD-AGR-04 §11).

---

## COORDINATION_REQUIRED

**problem:** Zlecenie zakłada nazwy powierzchni `Library → Sessions → Outputs →
Reports → Initiatives` oraz istnienie ich tabel. Kanon repo — zaakceptowany przez
właściciela 2026-07-31 i **wspólny dla Tools, Assessment i Audits** — mówi
`Library → Processes → Outputs → Deliverables → Initiatives`, a w kodzie nie
istnieje żadna z tych powierzchni.

**rekomendowana zmiana:** implementuję nazwy kanonu repo (Processes, Deliverables)
z mapowaniem `Sessions ≡ Processes`, `Reports ≡ Deliverables`. Powód: te same
etykiety muszą zobaczyć równoległe zespoły Tools i Assessment; rozjazd nazw
złamałby kryterium odbioru „użytkownik uczący się jednego modułu rozumie dwa
pozostałe" (`METHOD_MODULE_FIVE_SURFACES_STANDARD.md` §11).

**wpływ na audit lifecycle:** żaden — zmiana dotyczy wyłącznie etykiet nawigacji.
Lifecycle Planning→…→Closure realizowany jest wewnątrz powierzchni Processes.

**eventy/typy:** `AuditProgram` (Process), `AuditOutput`, `AuditReport`
(Deliverable), `AuditInitiativeProposal`. Brak wspólnej szyny zdarzeń w repo —
domenowe zdarzenia trzymam lokalnie w `audit_domain_events` i wystawię adapter,
gdy manifest się pojawi.

**pliki:** `src/components/Audit/**`, `server/src/services/audits/**`,
`server/migrations/20260813_audits_method_core.sql`.

**obejście:** etykiety pochodzą z jednego modułu i18n — zmiana na Sessions/Reports
to jedna edycja słownika, bez zmian modelu.

**czy praca niezależna może trwać:** **tak**, cała.

---

**problem:** `SHARED_CONTRACT_MANIFEST` nie istnieje; nie ma też wspólnej szyny
zdarzeń ani wpisu Audits w `docs/modules/CONTRACT_OWNERSHIP_REGISTRY.md`.

**rekomendowana zmiana:** Assessment/Core publikuje manifest; do tego czasu Audits
trzyma własne typy i zdarzenia za lokalną granicą (`server/src/services/audits/`)
i nie kopiuje Artifact Core.

**wpływ na audit lifecycle:** żaden dziś; po publikacji manifestu podmieniam
adapter.

**czy praca niezależna może trwać:** **tak**.
