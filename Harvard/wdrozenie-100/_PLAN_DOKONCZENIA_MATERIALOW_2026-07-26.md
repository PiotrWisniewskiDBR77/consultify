# PLAN DOKOŃCZENIA MODUŁU MATERIAŁY · 2026-07-26

> Zlecenie Piotra po żywym teście demo: „zrób audyt, masz dokumentację o czym ma być ten moduł,
> zrób plan dokończenia". Poprzeczka jakości (dyrektywa Piotra): **Gamma** (tworzenie/edycja)
> + **Airtable** (biblioteka/listy) — „bardziej profesjonalnie i ładnie".
> Podstawa: 3 audyty read-only na tipie demo `20b5339d41` (powłoka/wejścia · otwieranie ·
> i18n/wizual) + kanon `MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md` + master spec.

## 0. DIAGNOZA W JEDNYM AKAPICIE
Mechanika pod spodem w większości istnieje i działa (silniki generacji, eksporty, szablony,
testy). Moduł psuje się na SZWACH: dwa silniki dokumentów bez mostu (klik w dokument = 404 →
generator), dokumenty z nowego silnika niewidoczne w bibliotece, studia wyrywają użytkownika
z powłoki modułu, pierwszy ekran to techniczny formularz (wprost łamie kanon §4), język konta
nigdy nie synchronizuje się z interfejsem, a warstwa wizualna miejscami odstaje od standardu
(tęcza filtrów, crimson w CTA). Naprawa = szwy + podniesienie poprzeczki do Gamma/Airtable,
NIE przebudowa silników.

## FAZA P0 — HYDRAULIKA: użytkownik może normalnie korzystać (bez zmian wyglądu)
Cel: klik działa, biblioteka mówi prawdę, język słucha konta. Wszystko mechanika — bez akceptu
wizualnego, ale z testami E2E z wejścia produkcyjnego.

| # | Robota | Rozmiar | Szczegół (z audytu, plik:linia w raportach) |
|---|---|---|---|
| P0.1 | **Klik w dokument otwiera TREŚĆ** | M | Root-cause: zakładka Documents pokazuje wyłącznie rekordy silnika report_builder, a „Otwórz" wysyła je do document-studio (wave5), który ich nie ma → 404 → intake. Naprawa po stronie SERWERA: `openPath` w governance/rejestrze dla `originRuntime='report'` → `/reports/builder/:id` (działający edytor istnieje); klient już honoruje `governance.openPath`. E2E: klik z wiersza+kebab+preview w Documents i All → URL z treścią, nie intake. |
| P0.2 | **Dokumenty z Document Studio widoczne w bibliotece** | M | `useRapData` filtruje `originRuntime==='report'`, a nowy silnik rejestruje `'native_artifact'` → dokumenty niewidoczne. Dodać mapowanie `native_artifact`→kind document→`/document-studio/:id`. Dwie ścieżki otwarcia rozróżniane po originRuntime — bez naiwnej unifikacji. |
| P0.3 | **Język konta steruje interfejsem** | S/M | Tłumaczenia PL są KOMPLETNE (0 braków na 26,5k kluczy w zakresie). Angielski = detekcja navigator/localStorage; zero synchronizacji język-konta→i18next po zalogowaniu (grep: changeLanguage tylko w ustawieniach). Naprawa: przy starcie sesji ustaw i18next wg preferencji konta; fallback dopiero gdy konto nie ma języka. Najpierw live-check na demo (localStorage/network) — potwierdzenie hipotezy przed kodem. |
| P0.4 | **Flagi przestają kłamać** | S | `ff_tri_tryby` i `ff_excele`: komentarz „default OFF", kod zwraca ON gdy env nieustawiony (ten sam wzorzec co wcześniej deck/tpl). Prostowanie docstringów + JAWNE env w Railway — zachowanie przestaje zależeć od przypadku builda. |

## FAZA P1 — POWŁOKA: użytkownik nigdy nie wypada z Materiałów
Cel: tożsamość modułu w każdym studiu. Model: **Opcja C z audytu** — studia zostają pełnoekranowe
(zgodnie z doktryną SPEC-A artefaktów), ale z prawdziwą ramą modułu.

| # | Robota | Rozmiar |
|---|---|---|
| P1.1 | `MainLayout` breadcrumb z 2 → N poziomów; Document Studio/Prezentacje/Excel dostają `Materiały › Dokumenty › [nazwa]` + widoczny powrót „← Materiały". Znika absurd „Document Studio › Document Studio" (brakujący klucz i18n + twardy limit 2 segmentów). | M |
| P1.2 | Każde wejście przechodzi świadomy wybór trybu: naprawa przycisku „New AI document" (dziś omija chooser); audyt wszystkich `navigate('/document-studio'|'/prezentacje'|'/excele')` bez `?entry=`. | S/M |
| P1.3 | Usunięcie zdublowanego tytułu „Consultify Document Studio" wewnątrz widoku. | S |

## FAZA P2 — POZIOM GAMMA/AIRTABLE (prototypy → akcept Piotra → rollout)
Cel: to, co Piotr nazwał „profesjonalnie i ładnie". KAŻDY ekran tej fazy: najpierw prototyp +
zrzut side-by-side z benchmarkiem (Gamma/Airtable) do akceptu, DOPIERO potem wdrożenie za flagą.
Reguła #7 w pełni.

| # | Robota | Benchmark | Rozmiar |
|---|---|---|---|
| P2.1 | Ekran startu „Z AI": jedno duże pole „Co przygotować?" + kontekst podpięty + „Więcej opcji" zwinięte (dziś: formularz Description/Density/Goal/Audience — jedyny twardo NIESPEŁNIONY punkt DoD §8). TriModeChooser już istnieje — rozbudowa, nie greenfield. Wspólny wzorzec dla 3 formatów. | Gamma | L |
| P2.2 | Biblioteka: tagi semantyczne zamiast tęczy (SOURCE_TYPE_META + 3 sąsiednie flyouty: surowe emerald/blue/amber → tokeny), fix z-index dropdown (z-50 vs z-50 topbara — potwierdzić zrzutem w dark), hover-akcje na wierszach, przełącznik widoku tabela/galeria kart. | Airtable | M/L |
| P2.3 | Szablony jako GALERIA MINIATUR (dziś tabela nazw) — widzisz jak szablon wygląda przed użyciem. Wymaga generowania miniatur blueprintów (sylwetki już istnieją: SlideSilhouette/DocumentStructurePreview — reuse). | Gamma | M |
| P2.4 | Crimson w żywych CTA: kreator prezentacji (`wizard/*Step.tsx` — gradient primary→blue na „Generate"/„Continue"). OutputsLauncherModal też ma crimson, ale wg wcześniejszych audytów jest ODPIĘTY (sprzeczność między audytami — zweryfikować grep-em callera zanim ktokolwiek go rusza; jeśli martwy → deprecate zamiast malować). | triada | S |
| P2.5 | i18n hardcode w żywym chrome Deck Buildera: TipTapEditor (pasek formatowania), EditableBlock (menu bloku), AgentActivityPanel, DeckAuditLogModal — ~32 stringi, 4 pliki bez useTranslation. | — | M |

## FAZA P3 — DOMKNIĘCIE DoD KANONU §8 + ARCHITEKTURA
| # | Robota | Rozmiar | Uwaga |
|---|---|---|---|
| P3.1 | Deck „Z szablonu" end-to-end na demo (adapter zbudowany 26.07 — gałąź scalona; domknąć weryfikację żywą) + workbook template registry (D4 architekta — osobny pakiet, warunek „Na bazie istniejącego" dla Excela). | M/L | |
| P3.2 | Tryby tworzenia SZABLONU (Czysto/Z AI/Na bazie) per format — weryfikacja + uzupełnienie luk. | M | |
| P3.3 | **Unifikacja dwóch silników dokumentów** (report_builder vs document-studio/wave5) — decyzja architektoniczna, osobna sesja koncepcyjna; do tego czasu oba jawnie rozróżnione po originRuntime (P0.1/P0.2 to gwarantują). | L | sesja architektoniczna |
| P3.4 | Czystka martwych tras/plików: stary `Presentations/PresentationsHub.tsx` (myląca kopia), legacy ReportBuilder bits, `/presentation-studio` (route osierocony — decyzja: żywe narzędzie czy relikt?), `/reports/management` (orphan). | M | częściowo decyzje Piotra |
| P3.5 | Raport = typ dokumentu z własnym szablonem (rekomendacja CTO) albo 4. kafelek formatu — decyzja Piotra. | S po decyzji | decyzja Piotra |

## KOLEJNOŚĆ I ZALEŻNOŚCI
P0 całe najpierw (bez niego klikanie nie ma sensu) → P1 (rama) → P2 prototypy równolegle z
końcówką P1 → P2 rollout po akceptach → P3 w tle od początku (P3.1 nie blokuje niczego,
P3.3/P3.5 wymagają decyzji zanim dotkniemy kodu).

## WERYFIKACJA (żelazne, po lekcji z 26.07)
1. **E2E ścieżką użytkownika** — każdy punkt P0/P1 ma test klikający jak Piotr (wiersz→treść),
   nie test funkcji w izolacji.
2. **Render-verify pełny** — każda zmiana wizualna: zrzut light+dark PRZED Piotrem; P2 dodatkowo
   side-by-side z benchmarkiem Gamma/Airtable.
3. **Zero cichych fallbacków** — każde 404/błąd = jawny stan po polsku z drogą powrotu.
4. **DoD §8 kanonu jako bramka końcowa** — moduł „skończony" dopiero gdy wszystkie punkty
   SPEŁNIONE (dziś: 2 tak, 3 częściowo, 1 nie, 2 niezbadane).

## DECYZJE OTWARTE (Piotra — zebrane, nie blokują P0/P1)
1. Raport: typ dokumentu (rekomendacja) czy 4. format?
2. `/presentation-studio` (osierocony route z 43 EN stringami): żywe narzędzie czy skasować?
3. Stary Report Builder UI (legacy, osierocony): utrzymywać czy deprecate po P0.1?
4. Flipy flag czekające z poprzednich sesji (ff_workbook_templates, ff_drd_report).

## DOPISKI PO WYKONANIU P0.4 (2026-07-26 wieczór)
- **P0.4b [S, mechanika]**: pełny audyt 83 plików flag wykazał 15 KOLEJNYCH z kłamiącym
  docstringiem (wzorzec: late-flip ON z akceptem Piotra 07-15/07-16, nagłówek nadal mówi OFF):
  agentPlan, artifactApprovalUi, businessCaseAdvisory, canvasNewDocOptions, clientReader,
  clientVault, commandCenter, evidencePanel, financeEvBasket, ideasPreviewOverlay,
  m03InboxStandardTable, m03TasksStandardTable, scimGroupSync, ssoSelfService, tabeleAiEditor.
  Jedna fala porządkowa (zero zmian zachowania) — pełna lista w raporcie robotnika P0.4.
- **P3.6 [M] — czat→prezentacje zerwana integracja**: UnifiedChatPanel.tsx:3323 ustawia
  chatKickoffMessage i nawiguje /prezentacje, ale PrezentacjeView NIGDY nie konsumuje tego stanu —
  intencja z czatu ginie, user ląduje na gołym hubie. Wymaga decyzji o docelowym przepływie
  czat→generacja (spójnie z trybem Z AI).
- **ZNALEZISKO poza Materiałami (moduł Execution)**: „Export as presentation"
  (ReportCompactPanel.tsx:111, ReportDocumentView.tsx:1749) przekazuje sourceType/sourceName/
  content, których PrezentacjeView nie czyta — funkcja martwa, treść ginie. Do rejestru Execution.
