# Tools — bieżący rejestr odbioru właścicielskiego

Status: `OWNER_REVIEW_OPEN / LIVE_INTAKE / NO_REMEDIATION_AUTHORIZED`

Data otwarcia: 2026-08-22
Trasa startowa: `/discovery-tools?tab=library`
Owner: Piotr Wiśniewski
Integrator/rejestr: Codex

## Cel odbioru

Ustalić, co należy poprawić w module Tools, zachowując rozdział między:

1. jakością biblioteki i wyboru narzędzia;
2. jakością karty szczegółowej i wiedzy o narzędziu;
3. przebiegiem aktywnej sesji narzędzia;
4. jakością wyniku, zatwierdzania i promocji do dalszej pracy;
5. prawidłowością danych, zapisu, wersji, uprawnień i lineage.

## Źródła prawdy otwarte dla tego odbioru

- `MODULE_ACCEPTANCE.md` — bieżąca karta Wave 3 i stan dowodów.
- `docs/ui-standards/03-modules/tools-library-detail-standard.md` — zamrożony
  standard biblioteki i karty narzędzia.
- `docs/ui-standards/02-components/families/UI-TOOL-01/STANDARD.md` — kontrakt
  workspace'u narzędzia, zapisu, dirty state, AI i wyniku.
- `docs/product/TOOLS_V8_SSOT.md` — nadrzędny kontrakt V8 dla kontekstu,
  governance, provenance i promocji.
- `docs/product/CONSULTING_TOOLS_V3.md` oraz
  `docs/product/CONSULTING_TOOLS_STANDARD_V1.md` — kanon przebiegu i produktu
  konsultingowego.

W razie konfliktu nie powstaje lokalna prawda w rejestrze. Konflikt otrzymuje
osobny finding i wymaga jawnego rozstrzygnięcia w kanonie.

## Protokół oceny

Każdy ekran oceniamy w pięciu wymiarach:

1. **Nawigacja i menu** — menu górne, prawy klik, kebab, przejścia między
   Library/Sessions/Outputs oraz dostępność działań kontekstowych.
2. **Prezentacja** — tabela/karty, hierarchia, czytelność, gęstość, preview,
   workspace i zachowanie na obsługiwanych viewportach.
3. **Przebieg konsultingowy** — użytkownik rozumie cel, wymagane dane, kolejne
   kroki, jakość sesji, moment review i znaczenie wyniku.
4. **Prawidłowość** — statusy, liczniki, dane, uprawnienia, wersje, zapis,
   cold readback, AI propose→accept i brak fałszywego sukcesu.
5. **Wynik i dalsza praca** — finalizacja, zatwierdzenie, niezmienny output,
   provenance oraz poprawna promocja do Initiative/Report/Presentation/Idea.

## Zasady zapisu

- Każda uwaga właściciela jest wpisywana od razu, przed rozpoczęciem następnego
  ekranu.
- Zrzut ekranu jest dowodem obserwacji, nie dowodem działania ani trwałego
  zapisu.
- `UNKNOWN`, `EVIDENCE_MISSING`, `PARTIAL` i `NOT_VERIFIED` pozostają jawne.
- Podczas odbioru nie zmieniamy kodu produktu.
- Rozwiązania i rekomendacje powstają dopiero po zamknięciu intake; implementacja
  wymaga osobnej zgody.

## Rejestr ustaleń

| ID | Obszar/ekran | Oryginalna uwaga Piotra | Obserwowane zachowanie | Oczekiwany rezultat | Wpływ | Dowód | Status |
|---|---|---|---|---|---|---|---|
| `TLS-OWN-INTAKE-001` | Cały moduł Tools | „Zaczynamy tworzyć ocenę dla Tools. Kolejny rozdział: otwórz dokumentację; zrobimy ją na temat tego, co tu trzeba poprawić.” | Techniczny odbiór istnieje, lecz właścicielska ocena jakości była dotąd otwarta; wcześniejsze `W3-TLS-CX-001` mówiło ogólnie, że journey jest niezadowalający. | Przejść systematycznie przez bibliotekę, kartę, sesję, wynik i promocję, zapisując precyzyjne findings oraz osobno późniejsze rekomendacje. | Zastępuje ogólne „jest źle” testowalnym rejestrem bez przedwczesnego kodowania. | Bieżąca sesja odbiorowa; `MODULE_ACCEPTANCE.md` G08–G13 | Gate | `REVIEW_OPEN` |
| `TLS-TBL-OWN-001` | Library, Sessions; wspólny kształt tabel/menu/preview | „Biblioteka wygląda ok. Jak wcześniej od tabel, preview i menu (…) wygląda OK.” | Library i Sessions korzystają ze spójnego tabelarycznego układu, górnej nawigacji, filtrów i akcji wiersza. | Zachować kształt biblioteki oraz bazowy standard tabel/menu/preview. Dalszy odbiór menu i funkcji może tworzyć osobne findings, ale nie uzasadnia przebudowy zaakceptowanego szkieletu. | Chroni zaakceptowaną strukturę przed niepotrzebnym redesignem. | `TLS-TBL-EVD-001..002`; evidence index | Gate | `OWNER_APPROVED_BASELINE / FUNCTIONAL_CORRECTNESS_SEPARATE` |
| `TLS-DETAIL-OWN-001` | Library → Dynamic SWOT Tool Detail; light i dark | „Jest super, naprawdę mi się to podoba.” | Karta ma czytelną hierarchię konsultingową: pozycjonowanie narzędzia, rozdział „co robi / czego nie robi”, kiedy używać, przygotowanie, proces/outcomes, właściwości i jednoznaczne `Start session`. Ta sama kompozycja pozostaje spójna w jasnym i ciemnym motywie. | Zachować tę kompozycję jako zaakceptowany wzorzec Tool Detail. Dalsze prace mogą uzupełniać prawidłowość akcji, dane, dostępność i stany alternatywne, ale nie powinny lokalnie przebudowywać zaakceptowanej hierarchii, układu ani języka wizualnego bez nowej decyzji właściciela. | Ustanawia pozytywny punkt odniesienia dla pozostałych kart narzędzi i chroni wartościowy ekran przed regresją podczas napraw menu oraz workflow. | `TLS-DETAIL-EVD-001..002`; detail evidence index | Gate | `OWNER_APPROVED_VISUAL_AND_INFORMATION_BASELINE / LIGHT_DARK_ACCEPTED / FUNCTIONAL_CORRECTNESS_SEPARATE` |
| `TLS-OUTPUT-OWN-001` | Outputs → docelowo Insights | „Tabela output ma stanowić raporty, inaczej wnioski, insajty — nazwijmy to po imieniu, insajty z dokonania konkretnych narzędzi. (…) tutaj podepniemy kreator insightów. (…) wykorzystane narzędzia z sekcji Sessions po ich zatwierdzeniu.” | Zakładka Outputs pokazuje obecnie siedem obiektów typu Report/Assessment report, w tym niezrozumiały status `unknown status: CONFIGURING`; nie reprezentuje insightów z zatwierdzonych sesji. | Zmienić semantykę i nazwę zakładki na `Insights`. Insight Creator wybiera wyłącznie zatwierdzone sesje Tools, pokazuje source eligibility i tworzy wersjonowane insighty z zachowanym `Session → Insight` lineage. Wyniki są źródłem dla dalszych inicjatyw i raportów. | Obecna nazwa i dane mieszają wniosek konsultingowy z dokumentem, przez co łańcuch wartości i governance są nieczytelne. | `TLS-TBL-EVD-002..003`; evidence index | P0 | `OWNER_ARCHITECTURE_DECISION / IMPLEMENTATION_NOT_AUTHORIZED` |
| `TLS-REPORT-OWN-001` | Reports i generator dokumentów | „Raporty to będą wygenerowane raporty Worda, PowerPointa albo Excela na bazie insightów. (…) z narzędzia lub z insightów (…) generator treści tych raportów (…) z szablonów albo bezpośrednio (…) Obecnie tabela w ogóle nie istnieje.” | Reports wizualnie powiela te same siedem report-like rekordów co Outputs. Nie dowodzi osobnej biblioteki dokumentów, wyboru źródeł, generatora, formatu, szablonu ani trwałego dokumentu. | Utworzyć prawdziwy rejestr raportów/dokumentów: Word, PowerPoint i Excel; generator przyjmuje zatwierdzoną sesję narzędzia i/lub jej zatwierdzone insighty, pozwala wybrać szablon lub tryb bez szablonu, tworzy edytowalny dokument i zachowuje pełne source/version/provenance lineage. Przed wdrożeniem trzeba powiązać to z kanonicznym standardem budowy dokumentów. | Bez tej granicy Reports jest duplikatem, a użytkownik nie ma wiarygodnej ścieżki od pracy narzędziowej do materiału konsultingowego. | `TLS-TBL-EVD-003..004`; evidence index | P0 | `MISSING_PRODUCT_SURFACE_AND_GENERATOR_CONTRACT / IMPLEMENTATION_NOT_AUTHORIZED` |
| `TLS-INIT-OWN-001` | Initiatives i wspólny Initiative Creator | „Dokładnie tak samo jak w przypadku wywiadu, obowiązuje ta sama formuła. Ten sam kreator powinien być użyty; bierze on do inicjatyw albo wyniki narzędzi, albo wyniki outputów, albo wyniki raportów i na ich podstawie buduje kontekst oraz proponuje inicjatywę. Zasada jest analogiczna, tylko kontekst inny.” | Zakładka pokazuje listę istniejących inicjatyw, lecz sam widok nie dowodzi wspólnego kreatora, kwalifikacji źródeł ani pełnego Tools → Initiative lineage. | Ponownie wykorzystać ten sam kanoniczny Initiative Creator i standard `WizardModal/UI-CREATE-01`, który został ustalony dla Interview. W Tools zmienia się tylko adapter kontekstu: kreator wybiera kwalifikowane, zatwierdzone wyniki sesji Tools, zatwierdzone tool Insights (dawne Outputs) i właściwe raporty; pokazuje wybrane źródła/wersje, buduje jawny kontekst, proponuje inicjatywę do edycji i zachowuje wieloźródłowe lineage. Nie tworzyć osobnego kreatora ani lokalnego shella. | Zapewnia jeden profesjonalny sposób tworzenia inicjatyw w całej aplikacji i zapobiega rozjechaniu UX, governance oraz pochodzenia danych między Interview i Tools. | `TLS-TBL-EVD-005`; Interview `CONSULTING_CREATOR_GUIDELINES.md` i `CREATOR_SKEPTICAL_REVIEW.md` | P0 | `OWNER_REUSE_DECISION / SHARED_CREATOR_DEPENDENCY / IMPLEMENTATION_NOT_AUTHORIZED` |
| `TLS-PREV-OWN-001` | Wszystkie Preview w Tools — warstwa graficzna | „Wszystkie preview są OK. (…) te tutaj graficzne są dobre.” | Preview zachowują akceptowalny wygląd, układ i sposób otwierania na powierzchniach Tools objętych bieżącym przeglądem. | Zachować obecną warstwę graficzną Preview w Tools. Nie przebudowywać jej pod pretekstem uzupełniania treści; późniejsze zmiany treści mają korzystać z istniejącej anatomii i kanonicznych komponentów. | Chroni zaakceptowaną prezentację i ogranicza zakres dalszych zmian do jakości informacji. | Owner live-review statement; `TLS-TBL-EVD-001..005` pokazują objęte powierzchnie tabelaryczne | Gate | `GRAPHIC_LAYER_OWNER_APPROVED / CONTENT_CORRECTNESS_SEPARATE` |
| `TLS-PREV-CONTENT-OWN-001` | Preview content contract — Tools oraz zależność cross-app | „Musimy lepiej opisać, co ma być w treściach preview. Preview nie jest zrobione tylko po to, żeby się otwierała tabela. Rzeczywiście dobrze jest mieć tutaj podsumowanie, co jest w środku. (…) super ważne, żeby określić, jak tworzone są treści w preview.” | Istniejący kanon dobrze reguluje anatomię, sekcje i akcje Preview, ale nie zapewnia jeszcze wystarczająco konkretnego, obiektowego kontraktu treści: użytkownik może zobaczyć panel, nie uzyskując odpowiedzi, co naprawdę znajduje się w obiekcie i dlaczego warto go otworzyć. | Przygotować cross-app `Preview Content Contract` oraz descriptor per typ obiektu. Preview ma umożliwić podjęcie decyzji bez otwierania pełnego widoku i zawierać co najmniej: jednozdaniowy sens obiektu, bieżący lifecycle/status i właściciela, najważniejsze 3–5 ustaleń lub wyników, zakres/metryki, źródła i lineage, ograniczenia/ryzyka oraz rekomendowany następny krok. Treść musi pochodzić z danych domenowych lub jawnie oznaczonego streszczenia AI, być aktualna względem wersji i mieć uczciwe empty/loading/error states. | Bez kontraktu treści graficznie poprawny Preview pozostaje pustą ramą, wymusza otwieranie obiektu i nie wspiera szybkiej pracy konsultingowej. Ponieważ problem dotyczy całej aplikacji, lokalne dopisywanie tekstów w Tools stworzyłoby kolejne niespójności. | Owner live-review statement; relacja do `TABLE_AND_PREVIEW_CANON.md` i descriptorów obiektowych wymaga późniejszego audytu cross-app | P1 / Cross-app | `OWNER_DIRECTION_CAPTURED / CROSS_APP_CONTENT_STANDARD_REQUIRED / NO_LOCAL_TOOLS_FORK / IMPLEMENTATION_NOT_AUTHORIZED` |
| `TLS-MENU-OWN-001` | Library, Sessions, Outputs/Reports, Initiatives — right-click i kebab | „Menu zarówno z prawego przycisku, jak i z kebaba są (…) bardzo słabe. Mamy wyznaczony standard (…) Uzupełnienie wszystkich menu, które są mało konkretne.” | Library udostępnia tylko Open/Preview/Start session/Chat; Sessions i report-like Outputs tylko Open/Preview/Chat; Initiatives dodaje wyłącznie Open in Initiatives. Pary Library i Sessions zachowują wizualną parity right-click↔kebab, lecz zestawy nie odzwierciedlają pełnego lifecycle, możliwości użytkownika ani działań właściwych dla typu i statusu obiektu. | Najpierw wdrożyć jeden governed Action Registry i parity enforcement; następnie dla każdego typu/stanu/persony/źródła uzgodnić kompletną macierz działań i dopiero na niej uzupełnić menu. Right-click i kebab renderują identyczny uporządkowany wynik; Preview/bulk mogą mieć jawny podzbiór bez zmiany semantyki. Każda akcja ma realny handler, capability, lifecycle/source gating, bezpieczny reason, async/result/readback, telemetry i audit. Bez atrap, noopów i lokalnych forków Tools. | Ubogie menu ukrywa faktyczne możliwości, wymusza otwieranie obiektów i czyni lifecycle nieoperacyjnym mimo poprawnych tabel; naprawa lokalna utrwaliłaby dług platformowy. | `TLS-MENU-EVD-001..006`; evidence index; cross-app `ROW_MENU_POLICY_SKEPTICAL_REVIEW.md` | P0 / Cross-app | `OWNER_REJECTED_TOO_SPARSE / POLICY_REVIEW_COMPLETE / PLATFORM_REGISTRY_FIRST / DOMAIN_ROLLOUT_SECOND / IMPLEMENTATION_NOT_AUTHORIZED` |
| `TLS-MENU-POLICY-OWN-001` | Polityka menu — cross-app sceptical review | „Powołanie trzech ekspertów-sceptyków, którzy przeanalizują naszą politykę tworzenia menu (…) i na podstawie ich wskazówek zweryfikują zarówno te menu, jak i te w innych kartach, gdzie zgłaszałem, że menu jest biedne.” | Trzy niezależne oceny potwierdziły mocny shell, lecz wykazały brak wykonawczej macierzy domenowej, server-authoritative governance i jednego skalowalnego registry. Runtime nadal pozwala na lokalne tablice akcji; same parytet i wspólny renderer nie zapewniają kompletności ani poprawności. | Przyjąć rozszerzoną politykę i dwa zadania w obowiązkowej kolejności: `Platform Action Registry + parity enforcement`, następnie `Menu completeness audit and domain rollout`. Audyt obejmuje Tools, Interview i wcześniejsze hotspoty; closure wymaga 100% sklasyfikowanych powierzchni, testów handlerów/uprawnień/lifecycle/readback/a11y/telemetry oraz owner retest. | Zapobiega mechanicznemu dopisaniu przycisków i przenoszeniu tego samego błędu do kolejnych modułów. | `ROW_MENU_POLICY_SKEPTICAL_REVIEW.md`; `ROW_MENU_AUDIT_REGISTER.md`; `TLS-MENU-EVD-001..006`; `INT-MENU-OWN-001` | Gate | `THREE_SKEPTICS_COMPLETE / POLICY_PARTIAL_REQUIRES_EXTENSION / TWO_RECOMMENDATIONS_DEFINED / NO_IMPLEMENTATION` |
| `TLS-SWOT-OWN-001` | Dynamic SWOT — pełny model sesji | „Every single tool in the consulting area (…) will work like that (…) make a full instruction how other tools will be organized.” | Widoczny workspace mieszał lokalne rozwiązania nawigacyjne, redundantne liczniki, rozwlekłe puste stany, niespójny SWOT Build oraz powierzchnie downstream wewnątrz sesji. | Przyjąć `SWOT-003-finalny-model-pracy-dynamic-swot.md` jako kompletną rekomendację produktową: wspólny kręgosłup `Mission & Context → Input & Exploration → Method Build → Synthesis & Insights → Recommendations → Results & Readiness → Review`, z metodycznym `Method Build`, człowiekiem zatwierdzającym i bez automatycznej promocji. | Ustanawia jeden wzorzec dla wszystkich obecnych i przyszłych narzędzi konsultingowych zamiast kolejnych miniaplikacji. | Rozmowa właścicielska 2026-08-22 i screenshoty 18:45–20:46; pełny kontrakt w `rejestr/3-DO-ODBIORU/SWOT-003-finalny-model-pracy-dynamic-swot.md` | P0 / Platform | `OWNER_DIRECTION_CAPTURED / FINAL_RECOMMENDATION_WRITTEN / IMPLEMENTATION_NOT_AUTHORIZED` |
| `TLS-REC-OWN-001` | Sesja narzędzia → Recommendations | „Let's add another line in the menu, which will be recommendations (…) All of the story which we find from the tool should be exactly here.” | `Supporting analysis` pokazuje techniczne bloki per-area/internal/external/strategic synthesis, ale nie daje łatwo odkrywalnej, pełnej historii rekomendacyjnej. | Dodać po `Synthesis & Insights` osobny etap `Recommendations`: rekomendacja główna, wspierające rekomendacje, alternatywy, działania, warunki, decyzje zarządcze oraz narracja `question → evidence → findings → insights → implications → options → recommendation`. Supporting analysis pozostaje kontekstowym lineage, nie rezultatem głównym. | Użytkownik otrzymuje jasny rezultat konsultingowy zamiast konieczności składania go z technicznych kart. | Screenshot `Screenshot 2026-08-22 at 20.44.31.png`; kontrakt §6.15 i R18 w `SWOT-003` | P0 | `OWNER_ARCHITECTURE_DECISION / IMPLEMENTATION_NOT_AUTHORIZED` |
| `TLS-READY-OWN-001` | Ostatni etap sesji | „At the end only the health analyze or summary or results (…) only the information if the tool is done well. That's it, nothing more.” | `Outputs & Actions` zawiera readiness 0/5, Report Generator, Candidate Inbox, Vault i Attach file, mieszając ocenę sesji z dystrybucją i generatorami. | Zastąpić ekran przez `Results & Readiness`: overall readiness, objaśniona ocena AI, kompletność, evidence coverage, logic/method consistency, decision usefulness, blockers i final summary. Usunąć generatory, Vault, załączniki i akcje downstream. AI estimate nie zatwierdza wyniku; pozostaje review konsultanta. | Upraszcza zakończenie sesji, usuwa duplikację generatorów i zapobiega fałszywemu poczuciu ukończenia. | Screenshots `20.45.34`, `20.46.21`; kontrakt §6.16 i R19 w `SWOT-003` | P0 | `OWNER_SCOPE_DECISION / IMPLEMENTATION_NOT_AUTHORIZED` |
| `TLS-CHAIN-OWN-001` | Outputs, Insights, Reports, Initiatives; Tools + Interview | „Outputs, insights, reports, and initiatives (…) exactly the same standards (…) every single tool (…) will work like that.” | Dotychczasowe wpisy chwilowo utożsamiały Outputs z Insights, a widoczne Outputs i Reports duplikowały report-like rekordy. | Zachować cztery różne klasy: native `Outputs`, interpreted `Insights`, publishable `Reports`, actionable `Initiatives`. Każda ma osobny katalog, lifecycle, owner, approval i lineage, ale korzysta ze wspólnego kreatora/shellu w standardzie Insight/Interview. Dodać Reports do Interview; raporty i inicjatywy tworzyć wyłącznie w dedykowanych kreatorach. | Chroni semantykę łańcucha wartości i tworzy skalowalny kontrakt platformowy dla wszystkich tools. | Kontrakt §6.17–6.18 oraz R20–R21 w `SWOT-003`; rozmowa właścicielska 2026-08-22 | P0 / Platform | `FINAL_OWNER_CLARIFICATION / FOUR_CLASS_MODEL / IMPLEMENTATION_NOT_AUTHORIZED` |

## Otwarte bramki na start

- `Library`: `OWNER_APPROVED_BASELINE`
- `Tool detail`: `OWNER_APPROVED_BASELINE_IN_LIGHT_AND_DARK / FUNCTIONAL_CORRECTNESS_SEPARATE`
- `Tool preview`: `PENDING`
- `Start/resume session`: `PENDING`
- `Dynamic SWOT workspace`: `PENDING`
- `Review/approve/finalize`: `PENDING`
- `Outputs/Insights semantics`: `FOUR_CLASS_MODEL_CAPTURED / DESIGN_AND_CORRECTNESS_PENDING`
- `Reports/document generation`: `MISSING_PRODUCT_SURFACE / CONTRACT_PENDING`
- `Initiatives/shared creator`: `OWNER_REUSE_DECISION_CAPTURED / SOURCE_ADAPTER_AND_LINEAGE_PENDING`
- `Preview graphics`: `OWNER_APPROVED`
- `Preview content`: `CROSS_APP_STANDARD_REQUIRED / DESCRIPTORS_PENDING`
- `Row menus`: `OWNER_REJECTED_AS_TOO_SPARSE / THREE_SKEPTICS_COMPLETE / PLATFORM_REGISTRY_AND_DOMAIN_AUDIT_REQUIRED`
- `Output and downstream promotion`: `PENDING`
- `Alternate/error/permission states`: `PENDING`
- `Owner reconciliation`: `PENDING`
- `Dynamic SWOT final recommendation`: `WRITTEN / OWNER_RECONCILIATION_PENDING`
- `Recommendations`: `OWNER_ARCHITECTURE_DECISION_CAPTURED / IMPLEMENTATION_NOT_AUTHORIZED`
- `Results & Readiness`: `OWNER_SCOPE_DECISION_CAPTURED / IMPLEMENTATION_NOT_AUTHORIZED`
- `Cross-tool blueprint`: `WRITTEN / PLATFORM_PLAN_PENDING`
- `Implementation`: `NOT_AUTHORIZED`

## Znany punkt wyjścia

`W3-TLS-CX-001` pozostaje nadrzędnym wcześniejszym sygnałem: technicznie
przebieg został zademonstrowany, ale szeroka jakość wizualna i konsultingowa nie
została zaakceptowana. Nowe findings będą jego precyzyjnym rozwinięciem, a nie
wymazaniem.
