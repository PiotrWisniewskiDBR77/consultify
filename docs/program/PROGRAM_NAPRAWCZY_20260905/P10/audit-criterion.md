# Kryterium audytu (`audit-criterion`)

**Status:** PROPOZYCJA — do słowa właściciela. Nadpisuje wersję rundy 1 (linie 1–11 poniżej pomiaru
przed R1 — rekord się wtedy nie ładował; dziś ładuje się i renderuje pełny warsztat 18 ogniw).
Pomiar 06.09.2026, zrzut na żywo już istnieje: `evidence/p10-matryca/18-audit-criterion.png`
(+ `.json`), trasa `http://127.0.0.1:3102/audit-programs/aprog_.../criteria/apcrit_...`.

## §0. Tożsamość

- Nazwa PL: **Kryterium audytu** — warsztat jednego wymagania przez cały łańcuch metodyki
  (dowód → test → wniosek → ustalenie → naprawa, 18 ogniw w 4 fazach).
- Moduł: `12_AUDITS`. Archetyp: **C — Rekord**.
- Trasa: `/audit-programs/:programId/criteria/:criterionId` (`AppRoutes.tsx:1762`).
- Otwarcie: Audyty → Sesje → program → Kryteria → wiersz (`D1.1 · Cel i zakres…`).
- Komponent aktywny: `src/components/Audit/method/workspace/v2/CriterionWorkspaceV2.tsx:385`
  (1823 linie), za bramką `src/components/Audit/method/workspace/CriterionWorkspaceGate.tsx:21`
  (`isCriterionWorkspaceV2Enabled()`, **domyślnie ON od DEC-97, 26-08-2026** — V2 jest dziś
  DOMYŚLNYM ekranem, nie wariantem eksperymentalnym).
- Dublet #65 (`audit-criterion-v1`): `src/components/Audit/method/workspace/CriterionWorkspace.tsx:52`
  (523 linii) — TA SAMA trasa, druga gałąź tej samej bramki, osiągalna tylko przez
  `?ff_criterionWorkspaceV2=0` (query) albo `localStorage["ff.criterion_workspace_v2"]="off"`
  (opisane wprost w komentarzu `CriterionWorkspaceGate.tsx:9-12` jako „ścieżka regresyjna do
  porównań”). **Ten kontrakt obowiązuje dla V2; V1 NIE dostaje osobnego pliku** (zasada „dublety —
  jeden kontrakt z aliasem”) — V1 istnieje wyłącznie do porównania regresji, nie jako produkcyjna
  ścieżka.
- Powłoka: prawy panel **`ArtifactRightPanel`** (SPEC-A canon, `ARTIFACT_PANEL_SECTION_ORDER`) —
  ale bez paska modułu/Menu 4/Menu 5 nad treścią (§3).

## §1. Sekcje (centrum ekranu — 4 fazy, 18 ogniw)

| sekcja/faza | po co użytkownikowi | źródło danych → writer | reguła pustki | S/L |
|---|---|---|---|---|
| Faza 1 · Planowanie (ogniwa 1–3: kryterium/źródło, pytanie audytowe, oczekiwany dowód) | co i dlaczego się bada | `criterion.sourceReference`/`expectedEvidence` → `GET /audit-programs/:id/criteria/:critId` (`server/src/routes/audits/criteria.routes.ts:27`) | licznik „3/3” w nagłówku fazy | L |
| Faza 2 · Badanie (4–8: dostarczony dowód, procedura, próba, test, wynik) | audytor zbiera i ocenia dowód | `EvidencePanel` → `GET/POST /audits/programs/:id/evidence` (`server/src/routes/audits/evidence.routes.ts:24,39`) | licznik „0/5” gdy brak wpisów | L |
| Faza 3 · Ustalenia (9–12: wniosek audytora, status zgodności, ustalenie, odpowiedź właściciela) | zapisanie wniosku i ewentualnego niezgodności | `FindingPanel` → `GET/POST /audits/findings` (`server/src/routes/audits/findings.routes.ts:36,91`); `criterion.testResult`/`conformityChoice` → `PATCH /criteria/:id` (`criteria.routes.ts:64,78`) | licznik „0/4” | L |
| Faza 4 · Naprawa i zamknięcie (13–18: korekcja, przyczyna źródłowa, działanie korygujące, właściciel/termin, weryfikacja, zamknięcie) | domknięcie cyklu CAPA | `RemediationPanel` → trasy `findings.routes.ts:101-151` (transitions) | licznik „0/6”; część sub-stanów renderuje się honestly wyłączona z powodem, gdy brak API (komentarz `CriterionWorkspaceV2.tsx:19-22`: „management-response reminder”, „standalone close criterion”) | L |

18 ogniw pogrupowanych w 4 CIĄGŁE makro-fazy (`../chainLinks.ts:AUDIT_CHAIN_PHASES`) — zgodne z
K1 w duchu (istnieje wyliczalna struktura sekcji), ale to NIE `KanonicznaKarta`/`StandardSekcjaDef`
z rejestru standardu (K1 formalnie ✗, patrz §6).

## §2. Prawy panel (`ArtifactRightPanel`, `rightPanelSections`, `CriterionWorkspaceV2.tsx:913`)

| sekcja | obecna? | treść | uwaga |
|---|---|---|---|
| Akcje | ✓ (`:915`) | Kopiuj link, Przekaż innemu audytorowi, Oznacz „nie dotyczy” | poprawnie pierwsza |
| Właściwości | ✓ (`:1007`), ale **NIE tabela** | 10 wierszy przez lokalny `PropRow` (div `flex`, `:290-298`) — brak `<table>`, brak nagłówka „Właściwość \| Wartość” | **K7 ✗** — ten sam kształt błędu co `plan`/`capacity_analysis` (`KARTA_N_KONTRAKT.md` §7) |
| Powiązania | ✓ (`:1111`) | — | — |
| Źródła i założenia | ✓ (`:1175`, „Źródła i założenia”) | `sourceReference` + `expectedEvidence[]` | poprawnie obecna dla karty z rolą AI |
| Komentarze | ✓, pusta z jawnym powodem | „Planowane — brak API komentarzy dla kryteriów audytu” (`:1199-1204`) | zgodne z K10 (warunkowa, powód jawny) |
| Historia | ✓ (`:1207`) | `PreviewActivityStrip` z realnych zdarzeń (`history`→`activityEvents`) | zgodne z K10 |

Kolejność sekcji = dokładnie `ARTIFACT_PANEL_SECTION_ORDER` (Akcje→Właściwości→Powiązania→Źródła→
Komentarze→Historia) — **K11 spełnione**, jeden panel.

## §3. Menu 5 i nawigacja

Brak w całości: brak „Sekcje ▾”, brak przełącznika Edycja/Podgląd, brak „Pracuj z AI ▾”. Zamiast
tego własny pasek „FAZA AUDYTU” z 4 kaflami liczników (Planowanie 3/3, Badanie 0/5, …) i link „Mapa
18 ogniw / Pokaż wszystkie fazy” — funkcjonalnie zastępuje spis sekcji, ale nie jest kanonicznym
Menu 5 (K12 ✗). Brak paska modułu (Menu 2/3) nad tym wszystkim — otwarta karta NIE zostaje w module
wizualnie (K19 ✗, potwierdzone zrzutem: `18-audit-criterion.png` pokazuje breadcrumb „Audyty › … ›
D1.1”, nie zakładki modułu + pigułkę).

## §4. AI

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| — | brak (poza Teresą, patrz niżej) | brak | brak | wszystko poza polem wniosku/ustalenia wpisywanym ręcznie przez audytora |

Zero `PracujZAI`/„Pracuj z AI ▾” — **potwierdzone na żywo**: zrzut `19-audit-report.png.json`
(karta siostrzana, ta sama próba kliknięcia) loguje `klik nieudany: text=Pracuj z AI: … Timeout`.
Dla `audit-criterion` grep potwierdza brak importu `PracujZAI` w ogóle.

Zamiast kanonicznego AI — **`TeresaProposalCard`** (import `:74`, użycie `:1682`, „Teresa: wyjaśnij
kryterium”) w treści fazy „Ustalenia”, PLUS druga wzmianka „Teresa — asystent metodyczny” w treści
sekcji Historii prawego panelu (`:1224`, blurb bez przycisku). To jest DOKŁADNIE luka DEC-404/419
z `MATRYCA_21_KART.md` wiersz 18: „przycisk „Teresa” w nagłówku + `TeresaProposalCard`”. Zrzut na
żywo (`18-audit-criterion.png.json`, pole `tekst`) potwierdza słowo „Teresa” w treści strony poza
Menu 1: `„…Nie przetestowane\nTeresa\nSprawdź dowód…”`.

`audit-criterion`/`audit_criterion` nie ma wpisu w `cardAnalysisRubric.ts` ani `registry.ts`
(K21/K24 ✗ formalnie), ale **ma już** dwa realne punkty wejścia do Teresy poza kanonem — do
usunięcia wg wzorca `InitiativeDocumentView.tsx:162-168` (cytat z `MATRYCA_21_KART.md` wiersz 121).

## §5. Czytelność

- `grep -c "primary-[0-9]"` na pliku = 0 (K17 ✓).
- Fokus: nie zweryfikowano linia-po-linii; brak dowodu złamania.
- i18n: plik jest dwujęzyczny lokalnie (`t(pl,en)` na każdym literale) — bez oczywistych leków
  angielskich w polskiej gałęzi przy czytaniu próbki (K25 wygląda ✓, nie wyczerpująco sprawdzone).
- K19 pasek modułu z pigułką: **✗**, potwierdzone zrzutem (§3).
- K13 spis sekcji: nie dotyczy w klasycznej postaci (pasek FAZA AUDYTU zamiast lewego spisu) —
  etykiety liczników nie są ucinane na zrzucie 1440.

## §6. Stan zastany vs kontrakt (K1–K30) — cytat zmierzony 06.09 (`MATRYCA_21_KART.md` wiersz 18)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak katalogu w rejestrze (18 ogniw żyje w `chainLinks.ts`, nie w `cardContract.types.ts`) |
| K7 tabela Właściwości | ✗ | `PropRow` div, brak `<table>`/nagłówka (§2) |
| K8–K10 Powiązania/Źródła/Komentarze/Historia | ✓ (częściowo z jawnym powodem) | §2 |
| K12 Menu 5 | ✗ | własny pasek „Faza audytu” zamiast |
| K19 pigułka modułu | ✗ | zrzut `18-audit-criterion.png` |
| K21 Pracuj z AI (3 pozycje) | ✗ | zero, zamiast tego `TeresaProposalCard` |
| K27 Teresa tylko Menu 1 | **✗** | dwie wzmianki poza Menu 1 (§4), potwierdzone zrzutem |
| K17 zero primary | ✓ | 0 trafień |
| K30 zrzut 1440 z realnym rekordem | ✓ (już istnieje) | `evidence/p10-matryca/18-audit-criterion.png` |

## §7. Luki → naprawa (skopiowane i potwierdzone z `MATRYCA_21_KART.md` §3/§4, weryfikowane tu kodem)

1. **Usunąć Teresę z karty (DEC-404/419).** Dwa punkty: `TeresaProposalCard` w fazie „Ustalenia”
   (`:1682`) i blurb w sekcji Historii (`:1224`). Wzorzec usunięcia:
   `InitiativeDocumentView.tsx:162-168`. Rozmiar: M (matryca: przypisane Sonnet).
2. **Nagłówek tabeli Właściwości.** Zamienić `PropRow` na `ArtifactPropertiesTable` z
   `propertyLabel="Właściwość"`/`valueLabel="Wartość"` — dokładnie ten wzorzec już działa w
   `audit-report.md` (ten sam moduł, ten sam panel, poprawnie zrobiony obok). Rozmiar: S
   (matryca: przypisane Sonnet).
3. **Przywrócić pasek modułu z pigułką (K19).** Rozmiar: M (matryca: przypisane Sonnet, razem z
   `audit-report`/`assessment-report`/`presentation`).
4. **Wpiąć `PracujZAI` z trzema pozycjami.** Wymaga najpierw uzupełnienia kryteriów w
   `cardAnalysisRubric.ts` (dziś brak typu `audit_criterion`) — matryca to już zaplanowała jako
   pozycję 1.7 (rozmiar M, Codex P10 r2). Bez tego kroku podpięcie samego przycisku nie ma z czego
   generować treści.
5. **Dublet V1/V2 (#65).** Nie naprawiać — to świadoma ścieżka regresyjna za query/localStorage,
   nie produkcyjny ekran. Warto dodać komentarz w `CriterionWorkspace.tsx` (V1) odsyłający do tego
   kontraktu, żeby przyszły czytelnik nie pisał dla niego osobnego kontraktu.

**STOP:** brak — wszystkie pozycje mają jasny kierunek naprawy i istniejący wzorzec (K7/K19 już
rozwiązane w `audit-report` w tym samym module).
