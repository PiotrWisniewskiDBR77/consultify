# Raport audytu (`audit-report`)

**Status:** PROPOZYCJA — do słowa właściciela. Wzorzec bazowy: `_wzorzec-raport-dokument.md`.
Nadpisuje wersję rundy 1 (rekord się wtedy nie ładował). Zrzut na żywo już istnieje:
`evidence/p10-matryca/19-audit-report.png` (+ `.json`), trasa `.../audit-programs/reports/arep_...`.

## §0. Tożsamość

- Nazwa PL: **Raport audytu** — dokument z 13 sekcjami (kind `audit_report`) albo 6-sekcyjny
  snapshot postępu naprawy (kind `remediation_progress`); trzeci, oddzielny tryb „Widok dla
  zarządu” (8-sekcyjny deck, liczony NA ŻYWO, nie zapisany).
- Moduł: `12_AUDITS`. Archetyp: **B — Dokument** (rekord `audit_reports`, `id`+`version`+
  `content_hash`, `GET /audits/reports/:id` zwraca ZAPISANY payload — spełnia regułę
  record-identity z `_wzorzec-raport-dokument.md`).
- Trasa: `/audit-programs/reports/:reportId` (`AppRoutes.tsx:1738`, mount `:855`).
- Otwarcie: Audyty → Raporty → wiersz → „Otwórz”.
- Komponent: `src/components/Audit/method/AuditReportDocumentView.tsx:1` (1462 linie). Powłoka:
  `NModeShell` (`:1438`) + `ArtifactRightPanel` (`:1449`) — **jedyna karta tej partii z powłoką
  standardu na poziomie Menu 4/kontener**, w przeciwieństwie do `audit-criterion` (własny nagłówek).
- Trzy renderery treści (server, `server/src/services/audits/reportRenderer.ts`, cytowane wprost
  w komentarzu nagłówkowym pliku, `AuditReportDocumentView.tsx:16-33`):
  `renderAuditReport` (`:428`, 13 sekcji z macierzą traceability — TA jest zapisywana w
  `audit_reports.payload` i zwracana `GET /reports/:id`), `renderRemediationProgressReport`
  (`:575`, 6 sekcji, też zapisywana), `renderPresentationView` (`:688`, 8-sekcyjny deck LICZONY NA
  ŻYWO przez `GET /reports/:id/presentation` — nic nie zapisuje, zawsze osobny „drugi tryb”).
  R1 (DEC-117) naprawił błąd, w którym widok renderował ZAWSZE `presentation`, niezależnie od tego,
  co było faktycznie zaplombowane `content_hash`em — dziś domyślnie renderuje `report.payload`
  (ten sam byt, który się zatwierdza), „Widok dla zarządu” jest drugi, jawnie nazwany, w kebabie.

## §1. Sekcje (dla `audit_report`, 13 sekcji z `renderAuditReport`)

| sekcja (`section.id`) | źródło (`reportRenderer.ts`) | reguła pustki |
|---|---|---|
| `executive_summary`, `scope`, `methodology`, `limitations`, `overall_conclusion` | wyliczone z `AuditOutputPayload` przy generowaniu raportu (`reportService.generateReport`, `:148`) | sekcja bez treści renderuje generyczny pusty stan (`ErrorState`/placeholder — `AuditReportDocumentView.tsx:1430-1435`) |
| `findings_by_severity`, `findings_by_area` | grupowanie ustaleń z Outputu | jw. |
| `objective_evidence_references` | referencje do dowodów zebranych w kryteriach | jw. |
| `systemic_conclusions`, `corrective_action_plan`, `verification_plan` | agregacja z `FindingPanel`/`RemediationPanel` przez cały program | jw. |
| `appendices` | załączniki | jw. |
| `traceability_matrix` | `buildTraceabilityMatrix` (`reportRenderer.ts:383`), kolumny kryterium→dowód→test→wniosek→ustalenie→… | tabela renderowana `data-canon="§27-exempt"` (`AuditReportDocumentView.tsx:329-335`, komentarz cytuje `DOKTRYNA_TABELA_NIE_EXCEL.md` — wiersze to ZAMROŻONA TREŚĆ, nie rekordy do filtrowania, zgodnie z `_wzorzec-raport-dokument.md`) |

Sekcje idą z `KNOWN_SECTION_IDS` (`:322-328`, dla trybu `presentation`: `conclusion`,
`systemic_themes`, `findings_distribution`, `critical_findings`, `critical_evidence`,
`remediation_priorities`, `timeline`, `accountabilities`) — każdy inny `id` spada na generyczny
renderer „by kind” (keyValue/list/group/table).

## §2. Prawy panel (`ArtifactRightPanel`, `rightPanelSections`, `:1320`)

| sekcja | obecna? | treść |
|---|---|---|
| Akcje | ✓ (`:1322`) | Zatwierdź (`canApprove`), Opublikuj (`canPublish`), Pobierz DOCX, Pobierz PDF — z jawnym powodem disabled (status wymagany) |
| Właściwości | ✓ (`:1391`), **TABELA prawdziwa** | `ArtifactPropertiesTable` (`:1395-1399`) z `propertyLabel="Właściwość"`/`valueLabel="Wartość"` — **K7 spełnione, wzór dla `audit-criterion`/`assessment-report`/`presentation`** (Program, Rodzaj — per AKTYWNY tryb dokumentu, nie statyczny `report.reportKind` — Wersja, Status, Język, Odbiorca, Poufność, Data zatwierdzenia, Data publikacji, Zaktualizowano) |
| Powiązania | **✗ brak** | — |
| Źródła i założenia | **✗ brak** | — |
| Komentarze | **✗ brak** | — |
| Historia | **✗ brak** | — |

Tylko 2 z 6 kanonicznych sekcji (K8–K10 ✗ w całości — nie ma nawet jawnego `pominięta:{reason}`,
tylko milczenie). Uwaga pozytywna: komentarz `:1447-1448` dokumentuje, że przycisk „Zapytaj Teresę
o ten raport audytu” został ŚWIADOMIE USUNIĘTY z sekcji Akcje (DEC-419, 06.09.2026) — to jest
NAPRAWIONA luka K27, cytowana wprost w kodzie jako precedens dla innych kart tej fali.

## §3. Menu 5 i nawigacja

`NModeShell` z `showModeSwitcher={false}` (`:1445`) — świadomie WYŁĄCZONY przełącznik
Edycja/Podgląd (K14 spełnione z powodem dorozumianym: dokument zamrożony, edycja idzie przez
proces Zatwierdź/Opublikuj, nie przez tryb edycji treści). Lewy spis sekcji pochodzi z
`sections: NModeSection[]` = `{ label: {pl: s.title, en: s.title} }` (`:1207`) — **brak własnego
tłumaczenia etykiet, tytuł sekcji z backendu wchodzi 1:1** (patrz §5, K25). Brak „Pracuj z AI ▾” —
Menu 5 ma dwa z trzech elementów (Sekcje, brak Edycja/Podgląd z powodem), zero AI (K12 częściowo).
Kebab Menu 1 (`extraOverflowItems`, `:1273-1291`) niesie przełącznik „Przełącz na widok dla
zarządu”/„Przełącz na pełny raport” i „Otwórz listę raportów” — **działa naprawdę**
(`HeaderOverflowMenu`), w przeciwieństwie do martwego propa `secondaryActions` (komentarz
`:1266-1271` cytuje istniejący czerwony test `NModeHeader.ownerActions.test.tsx` jako dowód).

## §4. AI

Zero `PracujZAI`. Potwierdzone NA ŻYWO: zrzut `19-audit-report.png.json` loguje próbę kliku
„Pracuj z AI” zakończoną timeoutem (`klik nieudany: text=Pracuj z AI: … Timeout 8000ms exceeded`).
`audit_report`/`audit-report` nie ma wpisu w `cardAnalysisRubric.ts` ani `registry.ts`. Teresa: NIE
występuje w treści strony (pozytywnie — usunięta świadomie, §2) — **jedyna karta tej partii, gdzie
K27 jest spełnione przez naprawę, nie przez przypadek**.

Wniosek audytu (feature A4, DEC-417e): `POST /reports/:id/conclusion`
(`server/src/routes/audits/reports.routes.ts:236`) tworzy rekord w tabeli `conclusions` (ten sam
byt co ogólny „Wniosek”, karta #71 `ConclusionsHub`/`ConclusionReadout.tsx` z inwentarza, POZA
zakresem 12_AUDITS) — to CIENKI PRZEWÓD do istniejącej warstwy Wniosków, analogiczny do
`POST /assessment-reports/:id/conclusion` (DEC-416), nie nowy typ karty. **Alias, nie nowa karta**:
wniosek otwarty z Audytów prowadzi do `/conclusions?id=<conclusionId>` (ten sam ekran, którym
zarządza partia obejmująca `conclusion`/#71 — poza B5). Ten kontrakt nie duplikuje go; jeśli
właściciel chce osobny kontrakt dla „Wniosku” jako karty N, powinien powstać przy #71, z
odnośnikiem tutaj.

## §5. Czytelność

- `grep -c "primary-[0-9]"` = 0 (K17 ✓).
- **K25 i18n — złamane, potwierdzone kodem I zrzutem.** Tytuł sekcji „Macierz traceability”
  (`server/src/services/audits/reportRenderer.ts:504`, `title: 'Macierz traceability'`) miesza
  polski z angielskim słowem technicznym; zrzut `19-audit-report.png.json` pole `tekst` potwierdza
  dokładnie ten napis w lewym spisie sekcji. Naprawa: `„Macierz traceability"` → `„Macierz
  identyfikowalności"` (matryca, pozycja 4.4, rozmiar S).
- **K13 spis sekcji — ryzyko ucięcia.** Etykiety sekcji idą 1:1 z `s.title` (§3) bez skracania;
  13 pozycji w wąskiej lewej kolumnie NModeShell — matryca `MATRYCA_21_KART.md` wiersz 19 już
  odnotowuje to jako złamanie K13 dla tej karty (kolumna „✗” przy spisie sekcji); ten pomiar to
  potwierdza źródłowo (brak jakiegokolwiek `truncate`/skracania etykiety w kodzie).
- **K19 pasek modułu z pigułką: ✗**, potwierdzone zrzutem (`19-audit-report.png` — sam nagłówek
  dokumentu, brak zakładek modułu Audytów nad nim).

## §6. Stan zastany vs kontrakt (K1–K30) — zgodne z `MATRYCA_21_KART.md` wiersz 19

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak katalogu; 13/6/8 sekcji żyją w `reportRenderer.ts`, nie w rejestrze standardu |
| K7 tabela Właściwości | **✓** | `ArtifactPropertiesTable` (§2) — jedyna karta tej partii, gdzie K7 przechodzi |
| K8–K10 Powiązania/Źródła/Komentarze/Historia | ✗ | brak wszystkich czterech |
| K12 Menu 5 | ~ | Sekcje ✓, Edycja/Podgląd świadomie ukryty (K14 ✓ z powodem), Pracuj z AI ✗ |
| K13 spis sekcji bez ucięć | ✗ | zmierzone wcześniej, zgodne |
| K17 zero primary | ✓ | 0 trafień |
| K19 pigułka modułu | ✗ | zrzut |
| K21 Pracuj z AI (3 pozycje) | ✗ | timeout na klik (zrzut), zero importu |
| K25 i18n | ✗ | „Macierz traceability” (kod + zrzut) |
| K27 Teresa tylko Menu 1 | **✓ (naprawione, DEC-419)** | komentarz `:1447-1448`, brak wzmianek w zrzucie |
| K30 zrzut 1440 z realnym rekordem | ✓ (już istnieje) | `evidence/p10-matryca/19-audit-report.png` |

## §7. Luki → naprawa (zgodne z `MATRYCA_21_KART.md` §4, weryfikowane tu kodem)

1. **„Macierz traceability” → „Macierz identyfikowalności”** w `reportRenderer.ts:504` (jeden
   literał, S) — plus skrócić etykiety spisu sekcji, żeby żadna nie kończyła się „…” na 1440
   (K13, S). Matryca: pozycja 4.4, przypisane Sonnet.
2. **Powiązania · Źródła i założenia · Komentarze · Historia w prawym panelu** (K8–K10) — dodać
   cztery sekcje do `rightPanelSections` po wzorze innych kart standardu (np.
   `CriterionWorkspaceV2.tsx:1111-1210` w tym samym module ma już wzorzec „Powiązania”/„Źródła i
   założenia”/„Komentarze z jawnym powodem”/„Historia” do skopiowania). Rozmiar S. Matryca:
   pozycja 3.3, Sonnet.
3. **Przywrócić pasek modułu z pigułką (K19).** Rozmiar M (razem z `audit-criterion`,
   `assessment-report`, `presentation` — pozycja 3.2 matrycy, Sonnet).
4. **`PracujZAI` na sekcjach dokumentu** (13 sekcji dla audytu, różne dla oceny/decku) — rozmiar L,
   przypisane Opus w matrycy (pozycja 1.5) ze względu na skalę (trzy różne dokumenty × wiele
   sekcji, plus decyzja co „Uzupełnij tę sekcję” miałby robić na TREŚCI WYLICZONEJ z dowodów —
   ryzyko nadpisania faktów wygenerowanym tekstem, wymaga przemyślanej rubryki, nie mechanicznego
   podpięcia).
5. **Trzeci równoległy tryb „Widok dla zarządu”** działa poprawnie i jest jawnie nazwany (nie
   luka) — ale warto w kontrakcie odnotować, że TEN tryb (`renderPresentationView`) nigdy nie
   dostaje `id`/zapisu, więc dla NIEGO reguła record-identity NIE zachodzi — jeśli kiedyś dostanie
   własny link, będzie to osobna karta, nie ten sam dokument.

**STOP:** brak — jedyna otwarta kwestia produktowa (czy „Wniosek audytu” zasługuje na WŁASNĄ kartę
zamiast bycia aliasem `conclusion`) należy do partii obejmującej #71, nie do B5; zaznaczona w §4
jako odnośnik, nie jako blokier tego pliku.
