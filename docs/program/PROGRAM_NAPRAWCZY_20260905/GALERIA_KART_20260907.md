---
doc_id: galeria-kart-20260907
status: ODBIÓR — galeria kart N na finalnym kodzie (35 pozycji w rejestrze)
zrodla: `src/components/standard/registry.ts` (REJESTR_KART_N), `docs/ssot/KARTA_N_KONTRAKT.md`,
  stanowisko lokalne API `127.0.0.1:4100` / frontend `127.0.0.1:3090`, baza `consultify_noc`
  (`127.0.0.1:54400`, WYŁĄCZNIE odczyt), organizacja DBR77 (`cc9db573-260f-4a19-927f-f3cc1fbaea38`),
  06/07.09.2026 noc
pomiar: worktree `/private/tmp/wt-galeria-kart` (gałąź `mvp/galeria-kart`), narzędzie zrzutu
  `scripts/dev/odbior-zywo/zrzut.mjs` (kanoniczny skrypt Playwright repo, sesja z
  `/private/tmp/stanowisko-noc/auth.json`, WYŁĄCZNIE odczyt tego pliku), zrzuty 1440×900,
  motyw jasny, `evidence/galeria-kart/*.png` + `*.png.json` (adres końcowy, błędy konsoli, treść)
---

# Galeria kart N — odbiór na finalnym kodzie (07.09.2026)

Dziś w nocy dwie paczki rozbudowały `REJESTR_KART_N` z 13 do **35 pozycji**. Ten dokument jest
pierwszym spojrzeniem na wszystkie 35 na obrazie — realna trasa, realny rekord, jeden zrzut na
kartę, sekcja „Pracuj z AI" rozwinięta wszędzie, gdzie istnieje.

## Liczby

| miara | wynik |
|---|---|
| kart w rejestrze (`REJESTR_KART_N`) | **35** |
| sfotografowanych na żywo (realna trasa + realny rekord) | **31** |
| z rozwiniętym „Pracuj z AI" (trzy pozycje: Analizuj / Uzupełnij tę sekcję / Uzupełnij cały dokument) | **9** — task, decision, notification, initiative, insight, metric, objective, roi_case, tool-document |
| z „Pracuj z AI" ograniczonym do samego „Analizuj" (tylko do odczytu, z podanym powodem) | 5 z powyższych 9 (metric, objective, roi_case, tool-document — read-only; initiative i task w trybie Edycja mają pełne 3 pozycje) |
| BEZ żadnego „Pracuj z AI" (ani listy, ani zamiennika) | **22** — action, tool, interview, plan, capacity_analysis, kpi-scorecard, kpi-deviation, okr-report, okr-set-tool, roi-case-tool, presentation, template-architect-doc, template-architect-deck, vault-document, report-builder, management-report, reporting-automation, governed-context, finance-statement-pack, finance-analysis, execution-report, execution-work-doc |
| nie dało się otworzyć na żywo (powód w tabeli) | **4** — document, sheet, template, chat-artifact |

31 + 4 = 35. Zero rekordów utworzonych na potrzeby tego odbioru — wszystkie zdjęcia to zastane
rekordy DBR77; baza 54400 dotknięta wyłącznie odczytem (identyfikatory do tras).

## Tabela — 35 kart rejestru

| Karta (nazwa po polsku) | Moduł | Trasa | Plik zrzutu | Pracuj z AI | Uwagi |
|---|---|---|---|---|---|
| Task | Moja Praca | `/my-work` → Zadania → rekord → Otwórz | `task.png` | **jest** (3 poz.) | Wzorzec rodziny: Menu 4/5 pełne, tabela właściwości, pigułka w pasku modułu. |
| Decision | Moja Praca | `/my-work/decisions` → rekord → Otwórz | `decision.png` | **jest** (3 poz.) | Jak wzorzec. |
| Notification | Moja Praca | `/my-work` → Skrzynka → rekord → Otwórz | `notification.png` | **jest** (3 poz.) | Pigułka modułu pokazuje „Powiadomienie", nie tytuł rekordu (K19). |
| Initiative | Inicjatywy | `/initiatives?mode=doc&open=…` → Edycja → Pracuj z AI | `initiative.png` | **jest** (3 poz., w Podglądzie tylko Analizuj) | Wzorzec „kocham" właściciela — kompletna powłoka SPEC-N. |
| Insight | Wywiad | `/interview?tab=insights` → rekord → Otwórz → Edycja | `insight.png` | **jest** (3 poz., „Uzupełnij cały dokument" wyszarzone z powodem) | Czysto. |
| Interview Session | Wywiad | `/interview?tab=sessions` → rekord → Otwórz | `interview.png` | **brak** | Ekran-kreator pytań: zero prawego panelu, zero Menu 4/5 — to nie jest karta N w sensie SPEC-N, to formularz. |
| Plan | Inicjatywy | `/initiatives?tab=plan` → rekord → Otwórz | `plan.png` | **brak** (3 OSOBNE przyciski zamiast listy) | „WEEK · Europe/Warsaw" nieprzetłumaczone; właściwości = akapit, nie tabela; brak Menu 5. Rejestr mówi `statusMigracji: 'zmigrowana'` — nieprawda na ekranie. |
| Capacity analysis | Inicjatywy | `/initiatives?tab=capacity` → rekord → Otwórz | `capacity_analysis.png` | **brak** (jak Plan) | Ten sam defekt co Plan — para powstała z tego samego komponentu bazowego. |
| Action | Wyniki (osadzona w Moja Praca/Skrzynka) | `/my-work` → Skrzynka → „Karty działania (1)" → rekord | `action.png` | **brak** | NIE jest kartą N w sensie powłoki: rozwija się WEWNĄTRZ listy skrzynki, zero paska modułu z pigułką, zero prawego panelu, zero Menu 4/5. Jedyny sposób dotarcia — inline blok nad tabelą powiadomień. |
| Tool | Narzędzia | `/discovery-tools?docId=known:dynamic-swot` → Otwórz | `tool.png` | **brak** („Analizuj" osobny przycisk) | Menu 5 wtopione w Menu 4. |
| Tool document | Narzędzia | `/discovery-tools?tab=sessions&docId=…` → Otwórz → Pracuj z AI | `tool-document.png` | **jest** (tylko Analizuj, read-only: „sesja zatwierdzona") | W panelu AKCJE widnieją DWA identyczne przyciski „Uzupełnij tę sekcję" (duplikat) + etykieta „COPILOT AI" (stary branding, nie „Pracuj z AI"). |
| Metric (KPI) | Wyniki | `/results/kpi/:kpiId` → Pracuj z AI | `metric.png` | **jest** (tylko Analizuj, read-only: „wersja definicji nie jest szkicem") | 1 błąd konsoli (404) przy wejściu. |
| OKR Objective | Wyniki | `/results/okr/:setId/objectives/:id` → Pracuj z AI | `objective.png` | **jest** (tylko Analizuj, read-only: status zestawu) | Czysto. |
| ROI Case | Wyniki | `/results/roi/:roiCaseId` → Pracuj z AI | `roi_case.png` | **jest** (tylko Analizuj, read-only: „edytuje się w pełnym narzędziu ROI") | Czysto. |
| Raport KPI (kpi-scorecard) | Wyniki | `/results/kpi/scorecards/:id` | `kpi-scorecard.png` | **brak** | To jest TABELA mierników na pełną szerokość, nie karta: zero prawego panelu, zero pigułki modułu. 4 błędy konsoli (404) przy wejściu do rejestru KPI — znany, powtarzający się problem (zgłoszony już w P10). |
| Odchylenie KPI (kpi-deviation) | Wyniki | `/results/kpi/:kpiId/deviation-cases/:caseId` | `kpi-deviation.png` | **brak** | Ekran-kreator 7-krokowy (Wykrycie→Zamknięcie), zero paska modułu z zakładkami KPI/OKR/ROI, zero pigułki. W tabeli Właściwości widać SUROWE UUID („KPI ed531550…", „Właściciel 76015d70…") — naruszenie K28. |
| Raport OKR (okr-report) | Wyniki | `/results/okr/:setId` | `okr-report.png` | **brak** | Ta sama rodzina wizualna co Raport KPI (tabela pełnej szerokości) — spójne z Raportem KPI, ale inne niż Task/Decision/Initiative. |
| Narzędzie zestawu OKR (okr-set-tool) | Wyniki | `/results/okr/sets/:okrSetId` | `okr-set-tool.png` | **brak** | Powłoka administracyjna: zakładki w Menu 2 zamiast Menu 5, zero prawego panelu, tabela właściwości na pełną szerokość zamiast bocznej. Największy wizualny outlier w module Wyniki. |
| Narzędzie analizy ROI (roi-case-tool) | Wyniki | `/results/roi/cases/:roiCaseId` | `roi-case-tool.png` | **brak** | Ten sam wzorzec co okr-set-tool — „-tool" = powłoka narzędziowa, nie karta N. |
| Dokument (document) | Materiały | `/document-studio/:artifactId` | — (brak) | n/d | **NIE DA SIĘ OTWORZYĆ.** Wiersz „Plan strategiczny…" w Materiały→Dokumenty prowadzi na `/document-studio/99849d62-…`, który zwraca „Nie ma tu dokumentu" (404 API). Sprawdzone też z prawdziwym `artifact_id` z bazy (`1e1ddef3-3ed0-4ef0-a26d-f65ac57bf00e`) — również 404. Pozostałe wiersze listy „Dokumenty" (ADMA…) prowadzą do `/reports/builder/...`, czyli do INNEJ karty (report-builder), nie do document-studio. |
| Arkusz (sheet) | Materiały | `/excele` (wymaga istniejącego arkusza) | — (brak) | n/d | **BRAK REKORDU.** Zakładka „Arkusze" w Materiałach jest pusta (0/0/0), tabela `generated_workbooks` nie ma ani jednego wiersza dla DBR77. `/excele` bez parametru otwiera tylko kreator „Jak chcesz zacząć arkusz?" — nie kartę. |
| Prezentacja (presentation) | Materiały | `/presentations?tab=presentations` → rekord → Otwórz | `presentation.png` | **brak** | „Zapytaj Teresę" w stopce — wyciek Teresy poza Menu 1 (K27), zero paska modułu z pigułką (breadcrumb zamiast tego). |
| Wzorzec (template) | Materiały | `/presentations?tab=templates` | — (brak) | n/d | **BRAK ISTNIEJĄCEGO REKORDU DO OTWARCIA.** Wszystkie 79 wzorców w rejestrze otwierają się WYŁĄCZNIE jako podgląd z akcjami „Użyj wzorca” / „Klonuj” — żadna nie ma „Otwórz”. `TemplateBuilderShell` (komponent karty) montuje się tylko przez kreator „Nowy szablon” → zapisałby nowy rekord w bazie pokazowej, więc pominięto (zakaz zapisu). |
| Architekt wzorca dokumentu (template-architect-doc) | Materiały | `/document-studio?tab=templates` | `template-architect-doc.png` | **brak** | Ekran-kreator + rejestr zatwierdzonych szablonów systemowych — nie ma prawego panelu ani Menu 5, to hub, nie karta pojedynczego rekordu. |
| Architekt wzorca prezentacji (template-architect-deck) | Materiały | `/presentations?tab=template_architect` | `template-architect-deck.png` | **brak** | Jak wyżej, rejestr pusty („Brak szablonów") — ekran kreatora widoczny czysto. |
| Dokument sejfu (vault-document) | Moja Praca | `/my-work?safeId=organization` (Sejfy → Sejf organizacji → Otwórz) | `vault-document.png` | **brak** | To lista dokumentów sejfu (tabela), nie pojedynczy dokument — komponent rejestru (`VaultDocumentsView`) faktycznie renderuje TĘ tabelę, nie kartę pojedynczego pliku. |
| Raport (report-builder) | Materiały | `/reports/builder/:reportId` (z Materiały→Dokumenty→rekord→Otwórz) | `report-builder.png` | **brak** | Kreator raportu blokowego — Menu 2 własne (Edytuj/Agent/Podgląd), zero prawego panelu klasycznego, zero pigułki modułu. |
| Raport zarządczy (management-report) | Raporty | `/reports/management/:reportId` | `management-report.png` | **brak** | Dokument-raport na pełną szerokość, czysty render, zero błędów konsoli — ale bez Menu 4/5/prawego panelu. |
| Automatyzacja raportowania (reporting-automation) | Raporty | `/reports/management` → zakładka „Automatyzacja" | `reporting-automation.png` | **brak** | Pusty stan („Brak harmonogramów"), ale to workspace konfiguracyjny, nie karta rekordu — nie ma czego tu „otworzyć" jako obiekt. |
| Kontekst zarządzany (governed-context) | Organizacja | `/organization/sources/claims-sources` | `governed-context.png` | **brak** | Pełna powłoka SETTINGS (lewe menu sekcji ustawień organizacji), zero prawego panelu karty N, zero Menu 4/5 — architektura całkowicie odmienna od reszty rejestru. |
| Artefakt czatu (chat-artifact) | Czat AI | (wewnątrz konwersacji, `ArtifactsPanel`) | — (brak) | n/d | **BRAK ISTNIEJĄCEGO REKORDU.** Żadna wiadomość w `conversation_messages` DBR77 nie niesie artefaktu. Wygenerowanie nowego wymagałoby wysłania wiadomości do AI (zapis) — pominięto zgodnie z zakazem zapisu do bazy pokazowej. |
| Pakiet sprawozdań finansowych (finance-statement-pack) | Finanse | `/finance?tab=statements` → rekord → Otwórz | `finance-statement-pack.png` | **brak** (własne przyciski „Podsumuj sprawozdanie” / „Wskaż ryzyka w danych”) | Prawy panel ma WŁASNY zestaw sekcji („Rekoncyliacja”, „Powiązane artefakty”, „Sekcja raportu”) — nie pasuje do kontraktu Akcje/Właściwości/Powiązania/Źródła/Historia. |
| Analiza finansowa (finance-analysis) | Finanse | `/finance?tab=analysis&canonicalArtifactId=…` | `finance-analysis.png` | **brak** (pigułka „Analizuj”/„AI” w Menu 2, nie Menu 5) | Tabela wskaźników na pełną szerokość, zero prawego panelu. |
| Raport realizacji (execution-report) | Realizacja | `/execution?tab=reports` → rekord → Otwórz | `execution-report.png` | **brak** | Dokument-migawka („zamrożona migawka danych”) z przyciskami Pobierz DOCX/PDF — zero prawego panelu, zero Menu 5. |
| Element pracy realizacji (execution-work-doc) | Realizacja | `/execution?tab=work` → rekord (podgląd boczny) | `execution-work-doc.png` | **brak** | To jest DRAWER podglądu (jak Action), nie pełna karta: „Otwórz" ze środka drawer'a przenosi do zupełnie innej karty (Task, `/my-work`) — `ExecutionWorkSurface` nie ma własnej pełnej postaci, tylko bramkuje do Task. |

## Co odstaje od reszty

Patrząc na 31 zrzutów obok siebie, produkt dzieli się na **trzy rodziny wizualne**, nie jedną:

1. **Rodzina wzorcowa (7 kart): Task, Decision, Notification, Initiative, Insight, Metric,
   Objective, ROI Case, Tool document.** Wspólny szkielet: pasek modułu z pigułką otwartego
   rekordu, Menu 4 (tytuł + kebab), Menu 5 (Sekcje ▾ / Edycja-Podgląd / Pracuj z AI ▾), lewy
   spis sekcji, prawy panel akordeonowy Akcje→Właściwości(tabela)→Powiązania→Źródła→Komentarze→
   Historia. To jest jedyna rodzina, w której „Pracuj z AI" w ogóle istnieje jako wspólny
   komponent.

2. **Rodzina „tabela pełnej szerokości" (kpi-scorecard, okr-report, finance-analysis,
   okr-set-tool, roi-case-tool, vault-document).** Zero prawego panelu, zero Menu 5, dane w
   siatce na całą szerokość ekranu. Wewnętrznie spójna (te ekrany są do siebie podobne), ale
   zupełnie inna niż rodzina 1 — brak jakiegokolwiek elementu SPEC-N poza paskiem górnym.
   `okr-set-tool` jest tu najdalej: ma WŁASNE zakładki w Menu 2 (Przegląd/Cele i KR/Dopasowania/
   Rozmowy/Przegląd/Historia) zamiast Menu 5, czyli inny wzorzec nawigacji niż cokolwiek innego
   w rejestrze.

3. **Rodzina „dokument/kreator" (plan, capacity_analysis, presentation, report-builder,
   management-report, execution-report, template-architect-doc, template-architect-deck,
   finance-statement-pack, governed-context).** Każdy ekran ma WŁASNY, inny prawy panel
   (albo żaden), własne nazwy przycisków AI („Podsumuj sprawozdanie”, „COPILOT AI”, trzy osobne
   ikony zamiast listy) i własną nawigację. `governed-context` jest skrajnym przypadkiem —
   to jest właściwie ekran ustawień (lewe menu sekcji), nie ekran-obiekt w ogóle.

Dodatkowo, punktowo:
- **`plan` i `capacity_analysis`** deklarują w rejestrze `statusMigracji: 'zmigrowana'`, ale na
  żywym ekranie NIE mają tabeli właściwości (jest akapit), NIE mają Menu 5 i nie mają
  „Pracuj z AI" jako listy — trzy osobne przyciski. Wpis w rejestrze nie jest dowodem stanu ekranu
  (dokładnie ostrzeżenie z docstringa `registry.ts`).
- **`action`** i **`execution-work-doc`** to jedyne dwie karty, które w ogóle nie mają własnej
  pełnej postaci — obie żyją jako podgląd/inline-blok wewnątrz innego ekranu i „Otwórz"
  przenosi gdzie indziej (execution-work-doc → Task).
- **Wyciek Teresy poza Menu 1 (K27)** widoczny na `presentation` („Zapytaj Teresę” w stopce).
- **Surowe UUID w DOM (K28)** widoczne na `kpi-deviation` (KPI/Właściciel/Pomiar wywołujący jako
  hex bez etykiety czytelnej).
- **Duplikat przycisku** na `tool-document`: dwa identyczne „Uzupełnij tę sekcję” obok siebie w
  sekcji AKCJE, plus stara etykieta „COPILOT AI”.
- **Błędy konsoli (404) przy wejściu do rejestru/karty KPI** — 4 na `kpi-scorecard.png`, 1 na
  `metric.png`. Nie badałem który zasób — to samo zjawisko, które P10 zgłosił 06.09
  („rejestr KPI 3× 404”); dziś 4×, więc się nie naprawiło, raczej pogłębiło.

## Cztery karty, których nie dało się otworzyć

| Karta | Powód | Co by trzeba było zrobić (i dlaczego tego nie zrobiłem) |
|---|---|---|
| **document** | Route istnieje (`/document-studio/:artifactId`), ale KAŻDY sprawdzony `artifactId` (z UI i wprost z bazy) zwraca „Nie ma tu dokumentu” — realny błąd 404 po stronie API, nie mój błąd nawigacji. | Naprawa kodu jest poza zakresem tego zlecenia (odbiór, nie naprawa). |
| **sheet** | Zero rekordów w `generated_workbooks` dla DBR77 — zakładka „Arkusze” w Materiałach jest pusta. | Utworzenie arkusza zapisałoby nowy rekord w bazie pokazowej — zakaz zapisu. |
| **template** | 79 wzorców w rejestrze, ale żaden nie ma „Otwórz” — tylko „Użyj wzorca”/„Klonuj”, oba tworzą NOWY rekord. `TemplateBuilderShell` montuje się wyłącznie przez kreator. | Jak wyżej — zapis. |
| **chat-artifact** | Zero wiadomości z artefaktem w `conversation_messages` DBR77. | Wygenerowanie wymagałoby wysłania wiadomości do AI (zapis konwersacji) — zakaz zapisu. |

## Znane pułapki — jak je zaadresowano

- Rejestracja w `REJESTR_KART_N` nie była traktowana jako dowód — każda karta zweryfikowana
  obrazem (`plan`/`capacity_analysis` pokazały to wprost: rejestr mówi „zmigrowana”, ekran
  przeczy).
- Rozwijanie „Pracuj z AI” sprawdzane pod kątem czy nie zamyka czegoś innego — na `initiative`
  trzeba było dodatkowo kliknąć „Edycja” (bez tego „Pracuj z AI” pokazuje tylko „Analizuj” w
  Podglądzie — to nie błąd, to zamierzone read-only, ale wymagało dodatkowego kroku, żeby
  pokazać pełne trzy pozycje).
- Żaden zrzut nie pochodzi z `dev-render` — wszystkie 31 mają `url` na `127.0.0.1:3090` z realną
  trasą modułu, żaden nie kończy się na `/login`.
- Zweryfikowano, że pary wyglądające podobnie (`kpi-scorecard`/`okr-report`,
  `plan`/`capacity_analysis`) to naprawdę DWA różne rekordy pod różnymi trasami/ID — nie ten sam
  obraz podpisany dwa razy.

## Środowisko i dowody

API `127.0.0.1:4100`, frontend `127.0.0.1:3090` (nie restartowane). Sesja odczytana z
`/private/tmp/stanowisko-noc/auth.json` (tylko odczyt — token localStorage, nie modyfikowany).
Baza `postgresql://postgres:***@127.0.0.1:54400/consultify_noc` — wyłącznie SELECT, użyte do
znalezienia identyfikatorów tras (`rvn_kpi_deviation_cases`, `action_cards`,
`v8_output_artifacts`, `generated_workbooks`, `conversation_messages`). Zero zapisów.

Zrzuty i metadane: `evidence/galeria-kart/<klucz-karty>.png` + `.png.json` (31 par).
