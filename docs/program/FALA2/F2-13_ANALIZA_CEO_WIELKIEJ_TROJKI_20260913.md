# F2-13 — Co zrobić, żeby CEO wielkiej trójki chciał to kupić

**Zadanie:** SPEC_FALA2 §12 (N2-B12). **Data analizy:** 2026-09-13.
**Podstawa stanu:** katalog referencyjny `wt/kandydat-20260913` (tylko odczyt), pomiar kodu 13.09.
**Zasada:** każda liczba pochodzi z pliku albo ze źródła z datą. Gdzie nie zmierzyłem — piszę NIEZMIERZONE.

---

## STRESZCZENIE DLA WŁAŚCICIELA — 10 zdań

1. „CEO wielkiej trójki" jako kupujący nie istnieje jako jedna osoba — są trzy różne portfele i tylko jeden z nich jest dziś w naszym zasięgu.
2. Big3 nie kupuje narzędzi dla własnych konsultantów, bo już je zbudowały: McKinsey Lilli (75% z 43 tys. ludzi, 17 użyć/tydzień), BCG Deckster+GENE (~90% pracowników używa AI, 18 tys. własnych agentów GPT), Bain Sage i status Elite Partner OpenAI.
3. Ale wszystkie trzy mają tę samą dziurę: ich AI kończy się na slajdzie i syntezie wiedzy, nikt nie prowadzi klienta od wywiadu do zmierzonego KPI w jednym rekordzie — i to jest dokładnie nasza pętla.
4. Dlatego pierwszy realny kupujący to **klient końcowy firmy doradczej** (CEO/COO przedsiębiorstwa), do którego Big3 dopisuje swoje godziny wokół narzędzia — cykl zakupu 1–3 miesiące zamiast 12–24 i brak wymogu SOC 2 Type II na starcie.
5. Zmierzone twardo: SSO jest fikcją — `sso.routes.ts` zwraca 503 na SAML i OIDC („brak weryfikatora podpisu XML"), czyli logowanie korporacyjne, bez którego żaden dział IT Big3 nie zaczyna rozmowy, nie istnieje; SCIM za to jest napisany (1283 linie).
6. Wielojęzyczność jest pozorna: angielski 41 928 kluczy, polski 42 115, ale niemiecki 3 387, hiszpański 2 795, japoński 2 779, arabski 2 819 — czyli ~7% pokrycia, a Big3 działa w kilkunastu językach.
7. Eksport organizacji — warunek wyjścia z każdego kontraktu enterprise — jest na gałęzi HOLD z audytem 1 EXPORT / 4 EXCLUDE / **1918 UNRESOLVED**; to blokuje nie tylko Big3, ale i nasz własny pilotaż.
8. Ślad decyzji AI mamy zaprojektowany wzorowo (kontrakt „wolno/zakazane" dla 36 powierzchni, zakaz auto-apply, 29 z 36 działa), ale tabela `ai_run_ledger` jest realnie zapisywana tylko przez 3 serwisy — czyli audytowalność jest deklaracją, nie pokryciem.
9. Najstarszy otwarty punkt programu, S1.4 („dokument i prezentacja z szablonu na danych DBR77"), jest do dziś NIEZMIERZONY — a to jest dokładnie ten jeden artefakt, który partner Big3 ocenia w pierwszych trzech minutach demo.
10. Wniosek: nie ma sensu budować „pakietu enterprise" przed pierwszym płacącym klientem końcowym; kolejność to najpierw jedna bezbłędna 30-minutowa pętla na danych DBR77, potem eksport organizacji, potem prawdziwe SSO — a klocki procesu (n8n metodyki) są naszym jedynym argumentem, którego Big3 nie umie skopiować w kwartał.

---

## TRZY DECYZJE DLA WŁAŚCICIELA

### D1 — Na którego kupującego celujemy pierwszego?

| Litera | Wariant | Cykl zakupu | Bramka wejścia | Ryzyko |
|---|---|---|---|---|
| A | Partner zarządzający biura krajowego Big3 (narzędzie dla swoich zespołów) | 6–12 mies. | globalny InfoSec + SSO + SOC 2 | kolizja z własnym BCG X / Lilli — „zbudujemy sami" |
| B | Dział Product/Tech Big3 (platforma do wdrożeń u klientów, white-label) | 12–24 mies. | pełne DD + IP + eksport + odporność dostawcy | najwyższa wartość, najniższa szansa bez referencji |
| **C** | **Klient końcowy firmy doradczej (CEO/COO), Big3 poleca i doradza wokół** | **1–3 mies.** | **DPA + RODO + zgoda na dostawcę AI** | **najniższa cena jednostkowa** |

**Rekomendacja: C.** Powód: Big3 nie kupuje narzędzia — Big3 kupuje **dowód**. Jedyna rzecz, której partner Big3 słucha, to zdanie „to zadziałało u klienta X i przyniosło Y". DBR77 jest już tym przypadkiem. B jest celem docelowym, ale rozmowa z Product/Tech bez trzech referencji kończy się w BCG X, który ma ~3000 technologów i zbuduje to sam.

### D2 — Czy budujemy „pakiet zaufania enterprise" (SSO · eksport · pełny ślad AI) i kiedy?

| Litera | Wariant |
|---|---|
| A | Osobny program fali 2 (N2-B13) **przed** PMO i Agentem |
| **B** | **Po PMO i Agencie — z jednym wyjątkiem: eksport organizacji idzie teraz** |
| C | Dopiero po pierwszym płacącym kliencie |

**Rekomendacja: B.** Eksport organizacji (`codex/c6-export-contract-20260912`, +19 patchy, HOLD) wyjmujemy z pakietu i robimy natychmiast, bo to bloker **także** pilotażu czterech osób (S2.7), nie tylko Big3. SSO SAML/OIDC i wielojęzyczność czekają — dziś kosztują tygodnie, a nikt ich od nas nie żąda kontraktem.

### D3 — Jaki jeden artefakt sprzedażowy budujemy pierwszy?

| Litera | Wariant |
|---|---|
| **A** | **Bezbłędna 30-minutowa pętla demo na danych DBR77: wywiad → ocena → wniosek → inicjatywa → realizacja → pierwszy KPI** |
| B | Edytor klocków procesu (n8n metodyki) — SPEC §2 |
| C | Eksport metodyki / white-label jako produkt |

**Rekomendacja: A.** B jest naszym najmocniejszym wyróżnikiem rynkowym i wchodzi zaraz po, ale bez A nie ma czego wyklikać, a S1.4 (dokument i prezentacja z szablonu na danych DBR77) jest do dziś NIEZMIERZONY — czyli nie wiemy, czy pierwsze trzy minuty demo w ogóle się bronią.

---

# PĘTLA 1 — Kupujący i jego kryteria

## 1.1 Kto to naprawdę jest

„CEO wielkiej trójki" to skrót myślowy. Realnie decyzja zakupowa rozkłada się na trzy portfele,
z trzema różnymi progami bólu i trzema różnymi bramkami.

| | (a) Partner zarządzający biura krajowego | (b) Dział Product/Tech firmy doradczej | (c) Klient końcowy (CEO przedsiębiorstwa) |
|---|---|---|---|
| **Co kupuje** | wydajność swoich zespołów | platformę pod wdrożenia u klientów, pod swoją marką | wynik: zmierzoną zmianę w swojej firmie |
| **Budżet** | koszt biura (setki tys. EUR/rok) | inwestycja produktowa (mln EUR) | budżet projektu transformacji |
| **Kto blokuje** | globalny InfoSec, globalny Knowledge | Legal (IP), Risk, Architecture Board | CIO + DPO |
| **Konkurencja wewnętrzna** | Lilli / Sage / Deckster — już wdrożone | BCG X, własne zespoły inżynierskie | Planview / WorkBoard / Cascade / Jira |
| **Cykl** | 6–12 mies. | 12–24 mies. | 1–3 mies. |

**Kontekst rynkowy (twardy, z datami).**
McKinsey Lilli: wdrożone od lipca 2023, dziś ponad 75% z ~43 000 pracowników używa miesięcznie,
średnio 17 razy w tygodniu, ponad 500 000 promptów/mies., trenowane na 100 000+ dokumentów firmy,
oszczędność ~30% czasu na zbieraniu i syntezie informacji ([mckinsey.com](https://mckinsey.com/capabilities/tech-and-ai/how-we-help-clients/rewiring-the-way-mckinsey-works-with-lilli), [CIO Dive](https://www.ciodive.com/news/McKinsey-generative-AI-Lilli-platform-internal-employees/691231/)).
BCG: ChatGPT Enterprise dla wszystkich od października 2023, ponad 18 000 własnych agentów GPT,
Deckster (edytor slajdów na 800–900 szablonach, ~40% associates tygodniowo), GENE; BCG X to ok. 3000
technologów ([Computerworld](https://www.computerworld.com/article/3491334/bcg-execs-ai-across-the-company-increased-productivity-employee-joy.html), [AOL/Business Insider](https://www.aol.com/articles/nearly-90-bcg-employees-using-090601035.html)).
Bain: Sage (jedno z 12 narzędzi GenAI), inwestycja w OpenAI Deployment Company (maj 2026),
status **OpenAI Elite Partner** (lipiec 2026) ([bain.com](https://www.bain.com/about/media-center/press-releases/2026/bain-company-named-an-openai-elite-partner/), [consulting.us](https://www.consulting.us/news/13396/bain-company-invests-in-openai-deployment-company)).

**Co z tego wynika jednym zdaniem:** wszystkie trzy firmy już rozwiązały „AI dla konsultanta"
(wyszukiwanie, synteza, slajd). Żadna nie rozwiązała „AI prowadzące realizację u klienta aż do KPI".
To jest jedyne okno, w które możemy wejść.

## 1.2 Co musi być prawdą — per kupujący

Legenda kolumny „u nas": **TAK** (zmierzone w kodzie) · **CZĘŚCIOWO** · **NIE** · **NIEZMIERZONE**.

| Wymóg | (a) partner | (b) Product/Tech | (c) klient końcowy | U nas dziś |
|---|:--:|:--:|:--:|---|
| SSO korporacyjne (SAML 2.0 / OIDC) | bloker | bloker | ważne | **NIE** — 503 na obu ścieżkach |
| SCIM (provisioning użytkowników) | ważne | bloker | opcja | **CZĘŚCIOWO** — kod jest, nieprzetestowany |
| MFA wymuszone politykami | bloker | bloker | ważne | **CZĘŚCIOWO** — `MFAService` + trasy są, S2.3 otwarte |
| SOC 2 Type II | bloker | bloker | miło mieć | **NIE** — README sam mówi „nie uznajemy bez raportu" |
| ISO 27001 | ważne | bloker | ważne | **NIE** — matryca 🟡 na wszystkim |
| RODO/DPA, DPIA AI | bloker | bloker | bloker | **CZĘŚCIOWO** — DPIA ✅, reszta 🟡 |
| Region danych / on-prem | ważne | bloker | ważne (sektor) | **CZĘŚCIOWO** — docker-compose jest, atestacja regionu tylko w modelu danych |
| Eksport całości danych organizacji (exit) | bloker | bloker | bloker | **NIE** — HOLD, 1918 UNRESOLVED |
| Ślad audytowy decyzji AI | ważne | bloker | ważne | **CZĘŚCIOWO** — kontrakt wzorowy, zapis do ledgera wąski |
| Człowiek w pętli / zakaz auto-apply | ważne | bloker | ważne | **TAK** — zakaz C6 w kanonie |
| Wielojęzyczność produktu (≥6 języków) | bloker | bloker | zależy | **NIE** — ~7% poza EN/PL |
| White-label / marka klienta | opcja | bloker | opcja | **CZĘŚCIOWO** — backend jest, UI NIEZMIERZONE |
| Własność IP metodyki po stronie kupującego | ważne | **bloker krytyczny** | nie dotyczy | **NIE** — brak eksportu metodyki jako artefaktu |
| Integracje (Jira/M365/Teams/SAP/Workday) | ważne | bloker | ważne | **NIE** — SPEC §4 nierozpoczęty |
| Model komercyjny per-projekt (nie per-seat) | ważne | ważne | bloker | **NIE rozstrzygnięty** |
| Koszt AI przewidywalny (budżet per organizacja) | ważne | bloker | ważne | **CZĘŚCIOWO** — limiter to etap E3 paczki C6, wstrzymany |
| Odporność dostawcy (bus factor, escrow) | ważne | **bloker krytyczny** | ważne | **NIE** |

**Rekomendacja pętli 1: celujemy najpierw w (c).**
Trzy powody, w kolejności wagi:
1. **(c) jest jedynym portfelem, którego bramki dziś przechodzimy albo domkniemy w tygodniach**, nie kwartałach — DPA, RODO, zgoda na dostawcę AI. (a) i (b) zaczynają rozmowę od SSO i SOC 2, których nie mamy i nie będziemy mieć w tym roku.
2. **(c) produkuje jedyną walutę, którą Big3 rozumie** — referencję z liczbą. Partner Big3 nie kupi narzędzia, ale dopisze swoje godziny do narzędzia, które już przyniosło klientowi wynik.
3. **(b) jest celem docelowym i trzeba go świadomie odłożyć.** Wejście do Product/Tech Big3 bez referencji kończy się decyzją „zbudujemy sami" — mają 3000 technologów w BCG X i partnerstwo Elite z OpenAI w Bain. Wracamy tam z trzema wdrożeniami i policzonym ROI, nie wcześniej.

---

# PĘTLA 2 — Luka między Consultify a „gotowe dla Big3"

## 2.1 Tabela luk

Koszt: **S** ≤ 1 tydz. · **M** 2–4 tyg. · **L** 1–3 mies. · **XL** > 3 mies.

| Wymóg | Mamy (dowód: plik/moduł) | Brak | Koszt | Fala |
|---|---|---|:--:|---|
| SSO SAML/OIDC | `server/src/routes/integrations/sso.routes.ts` (388 l.) — CRUD konfiguracji, discovery po domenie; `ssoService.ts` | **cały protokół**: `/saml/login`, `/saml/callback`, `/oidc/authorize`, `/oidc/callback` zwracają **503** (`SAML_SIGNATURE_VERIFICATION_UNAVAILABLE`); brak `passport-saml`/`openid-client` w zależnościach | L | F2 (po C) |
| SCIM | `routes/integrations/scim.routes.ts` (1283 l.), `validators/scim.validators.ts`, zamontowane `Gateway.ts:1025` | test end-to-end z realnym IdP; bez SSO nie ma sensu | M | F2 |
| MFA | `services/MFAService.ts`, `routes/mfa.routes.ts`, `middleware/mfaEnrollmentToken.middleware.ts`, testy PG | domknięcie S2.3; znana pułapka „zamknięte koło" (wymóg MFA bez konta z MFA) | S | MVP |
| SOC 2 / ISO 27001 | `docs/security-compliance/` (10 dokumentów), `COMPLIANCE_MATRIX.md` v1.0 z **2026-02-06** | audyt zewnętrzny; matryca ma 🟡 na ~85% pozycji; brak dowodów operacyjnych w czasie | XL | F3 |
| RODO / DPIA | `DPIA_AI_PROCESSING.md` ✅, `GDPR_COMPLIANCE_GUIDE.md`, `/api/gdpr` zamontowane | DSR wykonywalne z interfejsu, retencja z dowodem uruchomienia joba | M | F2 |
| Eksport organizacji (exit) | gałąź `codex/c6-export-contract-20260912` (+19 patchy) | kontrakt **1 EXPORT / 4 EXCLUDE / 1918 UNRESOLVED** (audyt C6, 13.09); na HOLD, poza kandydatem | L | **teraz (D2)** |
| Usunięcie organizacji | C6-DEL-OFF w kandydacie `cfea70de8a` — odmowa 410 bez klienta bazy | pełna ścieżka usuwania z potwierdzeniem | M | F2 |
| Ślad audytowy AI | `ZASADY_AI_TERESA_SSOT.md` + `KONTRAKTY_NARZEDZI_AI.md` — kontrakt „wolno/zakazane/ślad" dla 36 powierzchni; migracja `20260425_wave3_ai_run_ledger.sql`; `middleware/auditLog.middleware.ts` | `ai_run_ledger` zapisują realnie **3 serwisy** (`aiRunLedgerService`, `wave7ConnectorRuntime`, `wave8AgentRuntime`) — główna ścieżka `POST /api/ai/chat/stream` nie jest pokryta; **brak ekranu, na którym audytor to zobaczy** | M | F2 |
| Człowiek w pętli | zakaz auto-apply (C6), propozycja→akcept→ślad we wszystkich 12 narzędziach Discovery, wzorzec odniesienia: `Audit/method/workspace/TeresaProposalCard.tsx` | martwa reguła `canvasMutationRisk.ts:86` (`canAutoApply` dla Teresy) — do skasowania, bo w DD wygląda jak tylna furtka | S | MVP |
| Znakowanie treści AI (EU AI Act art. 50) | plakietki „AI" w UI | maszynowo czytelne oznaczenie wyjść AI — obowiązuje **od 2 sierpnia 2026** | M | F2 |
| Wielojęzyczność | `en` 41 928 kluczy · `pl` 42 115 | `de` 3 387 · `es` 2 795 · `ja` 2 779 · `ar` 2 819 → **~7% pokrycia**; RTL dla `ar` NIEZMIERZONE | L | F2 |
| White-label | tabela `white_label_config`, `services/enterpriseService.ts:297–383` (logo light/dark, `hide_consultify_branding`, `is_enabled`) | podpięcie do UI i do eksportów PPTX/DOCX **NIEZMIERZONE**; `BRAND_EXPORT_CANON.md` opisuje kanon, nie wdrożenie | M | F2 |
| Eksport metodyki jako IP kupującego | `initiative_templates`, `management_report_templates`, `ai_playbook_templates`, 12 narzędzi Discovery | metodyka nie jest przenośnym artefaktem: nie da się jej wyeksportować, wersjonować ani sprzedać jako pakietu | L | F2 |
| Klocki procesu (n8n metodyki) | SPEC §2 opisany; klocki jako byty domenowe już istnieją | **cały edytor** — 10 myśli właściciela, nierozpoczęte; wymaga prototypu przed kodem | XL | F2 |
| Integracje (Jira/M365/Teams/SAP) | `POST /api/scim`, konektory `wave7ConnectorRuntimeService` | SPEC §4 nierozpoczęty; Teams (aktywny asystent) nierozwiązany także w DBR77 | XL | F2/F3 |
| Dostawcy modeli | OpenAI, Anthropic, Groq, Gemini, OpenRouter (`config/envValidator.ts:69–233`) | **brak Azure OpenAI / Bedrock / Vertex** — czyli brak wariantu „model w tenancie klienta", którego żąda każdy InfoSec Big3 | M | F2 |
| On-prem / region | `docker-compose.yml` (postgres 15, redis 7, prometheus, grafana), `Dockerfile.api`/`.frontend` | `data_residency_attestation` istnieje tylko jako kolumna w `LLMController.ts:353` — nie ma egzekwowania regionu | L | F3 |
| Budżet AI per organizacja | etap E3 paczki C6 | wstrzymany razem z C6 (S2.6) | M | F2 |
| Poczta (zaproszenia, reset) | szablony `email_templates` | **martwa** (DEC-471, czeka na dostęp do panelu Hostingera) — bez tego onboarding z listy (SPEC §8.3) nie istnieje | S | **MVP** |
| Deliverable oceniony formalnie | `DELIVERABLES_QUALITY_RUBRIC.md` (3 osie, progi, head-to-head vs Gamma/Claude) | **brak zestawu wzorcowego** (§7 rubryki) → najostrzejsze kryterium nie działa; S1.4 do dziś **NIEZMIERZONE** | M | **MVP** |
| Model komercyjny | — | nierozstrzygnięty: per-projekt vs per-seat vs partnerski (moduł 16 Partner bez integracji, „fala 2") | S (decyzja) | F2 |

**Stan wdrożenia, który trzeba pamiętać czytając tę tabelę:** staging = demo = `60051310d7`; nic z 11–13.09
nie jest wdrożone; kandydat zamrożony `5de710ff46` → scalony `cfea70de8a` (147 commitów, 207 plików, 0 migracji),
bramka K2 w toku. Czyli **część „mamy" żyje w kandydacie, nie na żywym środowisku.**

## 2.2 Pięć rzeczy, które nas wyróżniają — uczciwie

Kryterium doboru: czy Big3 **naprawdę** tego u siebie nie ma (sprawdzone wobec Lilli/Sage/Deckster), i czy
**my naprawdę** to mamy (sprawdzone w kodzie).

| # | Wyróżnik | Dowód u nas | Czego Big3 nie ma | Uczciwe zastrzeżenie |
|---|---|---|---|---|
| 1 | **Jedna pętla od wywiadu do KPI w jednym rekordzie** — inicjatywa nie jest kopiowana do Realizacji, tylko zmienia fazę życia z zachowaną tożsamością i historią | SPEC „MODUŁ REALIZACJA", dopisek 13.09; DEC-476 (rdzeń = Inicjatywy + Realizacja) | Lilli/Sage kończą na syntezie i slajdzie; realizacja u klienta żyje w Jirze i Excelu, poza AI | rdzeń jest **w kandydacie, niewdrożony**; przejście właściciela (S1.16) NIE ROZPOCZĘTE |
| 2 | **Teresa z twardym kontraktem per powierzchnia** — dla 36 powierzchni spisane „co wolno / czego nie wolno / gdzie ślad", z egzekwowaniem: propozycja bez źródeł nie ma aktywnego „Zastosuj" | `KONTRAKTY_NARZEDZI_AI.md`: DZIAŁA 29/36 (81%), wzorzec `Audit/.../TeresaProposalCard.tsx` | firmowe chatboty nie mają kontraktu zakazów per moduł — mają politykę ogólną | brak **jednego wspólnego wejścia**: `TeresaEntryButton` żyje w 2 modułach, `AIActionSlot` ma 0 użyć |
| 3 | **12 narzędzi konsultanta z aplikowalną propozycją, nie z czatem** — SWOT, Value Chain, Portfolio Priority, Risk, Growth Paths… każde z handlerem „zastosuj" i zakazem („nie wolno ustalać priorytetu za człowieka") | `toolAiActions.ts`, `TOOLS_WITH_APPLY_HANDLER`; 12/12 DZIAŁA | Big3 ma metodykę w głowach i w PowerPoincie, nie jako wykonywalny obiekt | lista `TOOLS_WITH_APPLY_HANDLER` jest ręczna — poza listą przyciski cicho nic nie robią |
| 4 | **Klocki procesu — metodyka jako wykonywalny przepływ** (paleta nodów, kolory, terminy, osoby, wyklikanie do narzędzia, natychmiastowy Gantt) | SPEC §2; słowa właściciela: „krytycznie ważny element, który zbuduje wartość Consultify" | to jest **dokładnie to, czego Big3 broni jako IP** i czego nie umie zdigitalizować — metodyka zostaje w plikach i ludziach | **nierozpoczęte.** To obietnica, nie produkt. W demo pokazujemy jako prototyp, nazwany prototypem |
| 5 | **Ślad decyzji gotowy pod EU AI Act** — zakaz auto-apply, akcept człowieka przed każdym zapisem, zakaz wystawiania ocen i wartości pomiaru przez AI (R2/R3/D3) | kanon C6 + tabela zakazów w `KONTRAKTY_NARZEDZI_AI.md` | narzędzia firmowe skupiają się na poufności danych, nie na rozliczalności decyzji | ledger pokrywa 3 serwisy; **nie ma ekranu, na którym audytor to obejrzy** |

**Czego NIE wpisuję jako wyróżnik, choć kusi:** jakość dokumentów i prezentacji (rubryka gotowa, ale
zestaw wzorcowy nie istnieje — §7; S1.4 niezmierzone), bezpieczeństwo (matryca 🟡), skala (jeden klient).

---

# PĘTLA 3 — Demo, które kupuje

## 3.1 Scenariusz 30 minut — dane jednego klienta (DBR77), od wywiadu do pierwszego KPI

Zasada: **jeden klient, jedna nitka, zero skoków po menu.** Partner Big3 ocenia spójność, nie liczbę funkcji.

| Min | Scena | Ekran | Co musi być bezbłędne | Zdanie, które padnie |
|---:|---|---|---|---|
| 0–3 | **Punkt wyjścia** | Organizacja — profil klienta | dane realne DBR77, zero „lorem", zero pustych stanów | „To jest firma, którą znamy. Wszystko dalej wisi na tym kontekście." |
| 3–8 | **Wywiad prowadzony przez Teresę** | Interview — sesja + `InsightViewer` | odpowiedzi po **angielsku** (DEC-461), wnioski ze wskazaniem źródła, ceremonia zatwierdzania odpowiedzi (S1.15) | „Konsultant nie wypełnia formularza — rozmawia, a system pilnuje kompletności." |
| 8–13 | **Ocena dojrzałości** | Assessment — macierz DRD | uzasadnienia z cytatem z wywiadu; **AI nie wystawia oceny — proponuje** | „AI nigdy nie stawia stopnia. To jest zapisane w kontrakcie i wyegzekwowane w kodzie." |
| 13–18 | **Wniosek → inicjatywa** | Initiatives — karta inicjatywy (karty N) | generowanie pierwszego opisu, historia karty, przycisk Teresy w sekcji „Akcje" | „Tu dzieje się praca, za którą partner płaci seniorowi." |
| 18–22 | **Ta sama inicjatywa wchodzi w realizację** | Execution — Bank | **ten sam rekord**, ta sama historia, brak drugiego wpisu | „Nie ma przepisywania do Jiry. To jest ten sam obiekt w innej fazie życia." |
| 22–27 | **Pierwszy KPI i odchylenie** | Results — KPI + karta odchylenia | odchylenie → karta działania → zadanie; ROI z metodyką pod przyciskiem | „Tu kończy się prezentacja, a zaczyna dowód, że transformacja się dzieje." |
| 27–30 | **Ślad i wyjście** | Historia karty + eksport | pełna historia „kto/kiedy/na czyj akcept"; eksport do PDF/PPTX z marką klienta | „Każda decyzja AI ma autora-człowieka i datę." |

**Co MUSI istnieć, zanim ten pokaz w ogóle się odbędzie (lista bramkowa, nie życzeniowa):**

| # | Warunek | Stan 13.09 | Koszt |
|---|---|---|:--:|
| B1 | Kandydat `cfea70de8a` wdrożony na demo (K4) | bramka K2/K3 w toku | S |
| B2 | S1.4 zmierzone: dokument **i** prezentacja z szablonu na danych DBR77 | **NIEZMIERZONE — najstarszy otwarty punkt** | M |
| B3 | Cała nitka po **angielsku** (DEC-461) — zero widocznego polskiego | 16 modułów zmierzone kiedyś, po wdrożeniu do powtórzenia | M |
| B4 | Ślad AI widoczny na ekranie (nie tylko w tabeli) | brak ekranu | M |
| B5 | Eksport artefaktu z logo klienta (white-label w eksportach) | backend jest, UI/eksport NIEZMIERZONE | M |
| B6 | Dane demo czyste (S1.7) | skrypt sprzątania w kandydacie, nieuruchomiony | S |
| B7 | Zero 5xx w całej nitce przez 3 kolejne przebiegi | NIEZMIERZONE | S |

**Czego demo NIE potrzebuje, wbrew pokusie:** SSO, SOC 2, wielojęzyczność, integracje. Partner ocenia
produkt; dział zakupów ocenia certyfikaty — i to jest **druga** rozmowa.

## 3.2 Trzy pytania, które zada partner — i nasze odpowiedzi

**Pytanie 1: „Czym to się różni od tego, co mamy u siebie? Mamy Lilli/Sage/Deckstera."**
> Odpowiedź: „Wasze narzędzia kończą się na slajdzie. Nasze zaczyna się tam, gdzie wasze kończy — inicjatywa,
> którą AI pomogło opisać, jest **tym samym rekordem**, który sześć miesięcy później pokazuje odchylenie KPI.
> Wy sprzedajecie rekomendację; my pilnujemy, żeby została wdrożona i zmierzona. To nie konkuruje z Lilli —
> to jest warstwa pod nią."
> *Czego nie mówimy:* że mamy lepsze AI. Nie mamy. Mamy inną pętlę.

**Pytanie 2: „Czyja jest metodyka? Jeśli wgramy naszą, kto będzie jej właścicielem?"**
> Odpowiedź uczciwa na dziś: „Metodyka klienta pozostaje klienta — ale **dziś nie umiemy jej wyeksportować
> jako przenośnego pakietu**. To jest pozycja w naszej fali 2 i jestem gotów zrobić z tego warunek kontraktu
> z terminem." (Alternatywa — kłamstwo „oczywiście, eksportujemy" — kosztuje nas cały deal na etapie DD.)
> *To jest jednocześnie najmocniejszy argument za D3/B: klocki procesu + eksport metodyki to razem produkt,
> który (b) Product/Tech kupuje.*

**Pytanie 3: „Kto to utrzyma? Ilu was jest, co jeśli jutro zniknie autor?"**
> Odpowiedź: „Jesteśmy mali i to jest prawda, której nie ukrywam. Dlatego proponuję model, w którym ryzyko
> jest po naszej stronie, nie po waszej: pilotaż na jednym kliencie, płatność za wynik, escrow kodu,
> i pełny eksport danych organizacji jako warunek kontraktowy z terminem."
> *Czego nie mówimy:* liczb o zespole, pokryciu testami ani „SOC 2 w trakcie".

## 3.3 Czego pokazywać NIE WOLNO, dopóki nie jest twarde

| Nie pokazujemy | Powód (dowód) |
|---|---|
| Moduł **Finanse** | poza MVP (DEC-470); w menu zaślepka „wkrótce"; SPEC §3 nierozpoczęty |
| Moduł **Spotkania** | ZA FLAGĄ (`VITE_INTERNAL_TOOLS_ENABLED` default OFF), blok podpowiedzi po angielsku wewnątrz polskiego UI |
| **Ustawienia** | CLOSED_FINAL zakwestionowane 1.09; 33 z 37 sekcji niedostępne dla zwykłego użytkownika, przekierowanie bez śladu |
| **Organizacja** — komplet 11 ekranów | odebrany na **prototypie**, leży za flagą; runtime pokazuje stary układ |
| **Partner Portal** | zero integracji z Teresą, model komercyjny nierozstrzygnięty |
| **SSO / logowanie korporacyjne** | 503 na SAML i OIDC — pokaz kończy się kompromitacją |
| Cokolwiek w **DE/ES/JA/AR** | ~7% pokrycia kluczy — pierwszy klik pokaże angielskie łańcuchy |
| **Eksport organizacji** | HOLD, 1918 UNRESOLVED |
| Ścieżka **„Z AI" w Document Studio** | `zaiTeresaFlag` default OFF |
| **Whiteboard „Auto-clustering (AI)"** | etykieta kłamie — to heurystyka bez LLM (defekt udokumentowany) |
| **Wyszukiwanie w mapie myśli** | `ENABLE_TERESA_MINDMAP_SEARCH` = OFF |
| Jakiekolwiek **liczby pokrycia testami / „SOC 2"** | README sam je unieważnia jako niepotwierdzone |

---

## Co z tego wchodzi do planu fali 2 (propozycja dopisku do SPEC §12)

| Krok | Co | Kiedy | Zależność |
|---|---|---|---|
| 1 | Domknąć B1–B7 (bramka demo) | razem z paczką 1 MVP | K4 → K5 |
| 2 | Eksport organizacji z HOLD do produkcji | równolegle, natychmiast | D2/B |
| 3 | Ekran śladu decyzji AI + rozszerzenie `ai_run_ledger` na `/api/ai/chat/stream` | po PMO | — |
| 4 | Prototyp klocków procesu (SPEC §2) — **prototyp przed kodem** | po PMO i Agencie | D3/A najpierw |
| 5 | Eksport metodyki jako przenośny pakiet | po klockach | otwiera kupującego (b) |
| 6 | SSO SAML/OIDC + SCIM e2e + wielojęzyczność | po pierwszej referencji | D2/B |
| 7 | Skasować `canvasMutationRisk.ts:86` (`canAutoApply` dla Teresy) | teraz, S | higiena DD |

---

## Źródła

**Repozytorium** (`wt/kandydat-20260913`, stan 13.09.2026): `server/src/routes/integrations/sso.routes.ts:80–127`
(503 na SAML/OIDC) · `server/src/routes/integrations/scim.routes.ts` (1283 l.) · `server/src/Gateway.ts:1024–1026` ·
`server/src/services/enterpriseService.ts:297–383` (white-label) · `server/src/config/envValidator.ts:69–233`
(dostawcy modeli) · `public/locales/*/translation.json` (pomiar kluczy) · `server/migrations/20260425_wave3_ai_run_ledger.sql` ·
`docs/ssot/KONTRAKTY_NARZEDZI_AI.md` (pomiar 05.09: 29/36 DZIAŁA) · `docs/security-compliance/COMPLIANCE_MATRIX.md` v1.0, 2026-02-06 ·
`docs/program/FALA2/SPEC_FALA2_20260912.md` · `docs/program/TRZY_POJEMNIKI_PRACY_20260906.md` (STAN NA 13.09) ·
`docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md` (skrzynka 13.09) · `README.md` (status deklaracji zewnętrznych) ·
`Harvard/wdrozenie-100/DELIVERABLES_QUALITY_RUBRIC.md` §7.

**Rynek:**
[McKinsey — Rewiring the way McKinsey works with Lilli](https://mckinsey.com/capabilities/tech-and-ai/how-we-help-clients/rewiring-the-way-mckinsey-works-with-lilli) ·
[CIO Dive, rollout Lilli do 7 tys. pracowników](https://www.ciodive.com/news/McKinsey-generative-AI-Lilli-platform-internal-employees/691231/) ·
[Computerworld — BCG: AI w całej firmie](https://www.computerworld.com/article/3491334/bcg-execs-ai-across-the-company-increased-productivity-employee-joy.html) ·
[AOL/BI — ~90% pracowników BCG używa AI](https://www.aol.com/articles/nearly-90-bcg-employees-using-090601035.html) ·
[Bain — OpenAI Elite Partner, lipiec 2026](https://www.bain.com/about/media-center/press-releases/2026/bain-company-named-an-openai-elite-partner/) ·
[Bain — inwestycja w OpenAI Deployment Company, maj 2026](https://www.bain.com/about/media-center/press-releases/2026/bain-company-openai-a-new-venture-to-deploy-ai-at-enterprise-scale/) ·
[Holland & Knight — EU AI Act, termin 2 sierpnia 2026](https://www.hklaw.com/en/insights/publications/2026/04/us-companies-face-eu-ai-acts-possible-august-2026-compliance-deadline) ·
[artificialintelligenceact.eu — art. 50, obowiązki przejrzystości](https://artificialintelligenceact.eu/transparency-rules-article-50/) ·
[Planview — rynek strategy execution 2026](https://www.planview.com/resources/articles/best-strategy-execution-management-software-for-2026/) ·
[Accenture przejmuje Dragos/RunZero/NetRise, 2026 — wzorzec „konsulting kupuje software"](https://www.consulting.us/news/13586/accenture-acquires-three-ot-cybersecurity-firms-for-4175-billion).

---

*Uwaga metodyczna: wszystkie stany „u nas" zmierzone w katalogu referencyjnym, nie z dokumentacji.
Trzy pozycje oznaczone NIEZMIERZONE (S1.4, white-label w UI, RTL) wymagają osobnego pomiaru na żywym
środowisku przed użyciem tej analizy w rozmowie handlowej.*
