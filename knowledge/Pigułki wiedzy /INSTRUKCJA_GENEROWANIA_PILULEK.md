# Instrukcja generowania pigułek wiedzy: Vector + DBR77

**Cel:** Wygenerowanie brakujących pigułek wiedzy (knowledge pills) dla dwóch produktów:
- **DBR77 Vector** — 15 brakujących plików (02–16), folder `Vector-info-pills/`
- **DBR77 Ecosystem** — 16 plików (01–16), folder `DBR77-info-pills/`

**Kontekst:** Pigułki wiedzy to pliki `.md` ładowane do RAG (Retrieval Augmented Generation). Asystent publiczny Anna odpytuje je przy każdym pytaniu użytkownika. Jakość pigułek = jakość odpowiedzi Anny.

---

## KROK 0: Przeczytaj źródła (obowiązkowe przed generowaniem)

### Dla VECTOR — przeczytaj w tej kolejności:

| Prio | Ścieżka pliku | Co zawiera |
|------|--------------|------------|
| 1 | `knowledge/vector-website/messages/pl.json` (klucz `"vector"`, linie ~1008–1822) | Pełny marketing PL: hero, intro, architektura, bezpieczeństwo, porównanie, FAQ, trening, deployment, produkty, cennik |
| 2 | `knowledge/vector-website/messages/en.json` (klucz `"vector"`) | Angielski mirror — użyj dla terminów technicznych |
| 3 | `knowledge/Pigułki wiedzy /Vector-info-pills/01-funkcjonalnosc-i-pozycjonowanie.md` | Jedyna istniejąca pigułka Vector — WZORZEC tonu |
| 4 | `knowledge/vector-website/src/data/voice.ts` | Skrypty głosowe Anna: kluczowe fakty, deployment, ekosystem, bezpieczeństwo |
| 5 | `knowledge/vector-website/src/app/api/voice/route.ts` | System prompt: definicja produktu, ekosystem, page-aware instrukcje |
| 6 | `knowledge/vector-website/src/components/voice/VoiceAssistant.tsx` | Capability brief: 20B, 1400+ cases, 3 modele deployment |
| 7 | `Blogs/_OPERATIONS/core/DBR77_MESSAGING_ARCHITECTURE.md` (sekcja `### Vector`) | Rola, core message, what it gives, persony, CTA |
| 8 | `server/src/services/ai/annaSiteConfig.ts` | Site config Vector: brand, mission, topics, cross-sell |
| 9 | `server/src/services/ai/annaKnowledgeService.ts` (`VECTOR_FALLBACK_CONTEXT`) | Fallback blurb — krótki opis produktu |

### Dla DBR77 ECOSYSTEM — przeczytaj w tej kolejności:

| Prio | Ścieżka pliku | Co zawiera |
|------|--------------|------------|
| 1 | `Blogs/_SYSTEM/strategy/DBR77_PRODUCT_MARKETING_PLAN.md` | Kanoniczny plan marketingowy: multi-entry gate, persona→gate mapping, rola dbr77.com, content map |
| 2 | `Blogs/_SYSTEM/strategy/DBR77_PRODUCT_MARKETING_SYSTEM.md` | System design: 7 surfaces, CRM, content governance, telemetria |
| 3 | `Blogs/_OPERATIONS/core/DBR77_MESSAGING_ARCHITECTURE.md` | Messaging: brand promise, Measure→Transform, product message houses, persona priorities, brand faces |
| 4 | `Blogs/_SYSTEM/strategy/DBR77_MASTER_COMMAND_CENTER.md` | Runbook: kolejność publikacji, reguły LP |
| 5 | Każda pigułka `01` z folderów: `Consultinity`, `IIoT`, `DT`, `IRIS`, `Marketplace`, `Vector` | Po jednym zdaniu o każdym produkcie — do pigułki 01 DBR77 |
| 6 | `server/src/services/ai/virtualWorkerService.ts` (DEFAULT_PRODUCT_PILLS, sekcja `dbr77-ecosystem`) | Pill blurb + ecosystem explanation strings |
| 7 | `server/src/services/ai/annaKnowledgeService.ts` (FALLBACK_CONTEXT_MAP) | Fallbacki dla wszystkich 7 produktów |
| 8 | `server/src/services/ai/annaSiteConfig.ts` (ANNA_SITE_CONFIGS) | Konfiguracje landing pages |
| 9 | `knowledge/vector-website/messages/pl.json` (klucz `"vector.home.products"`) | Opis ekosystemu produktów z perspektywy Vector |

---

## KROK 1: Format pliku (ŚCISŁY)

Każdy plik MUSI zaczynać się od tego nagłówka:

```markdown
# Plik NN: [Tytuł po polsku] — [Nazwa Produktu]

**Producent:** DBR77 Robotics Sp. z o.o.  
**Produkt:** [DBR77 Vector | DBR77 Ecosystem]  
**Wersja dokumentu:** 1.0 | Marzec 2026

---
```

Gdzie `NN` to numer pliku (01–16).

Dodaj opcjonalnie (gdy odpowiednie):
- `**Adresat:** Zespół Sprzedaży, Marketing, Customer Success` (plik 10, 15, 16)
- `**Cel dokumentu:** [opis]` (plik 09)

### Konwencje formatowania:

- Sekcje: `## 1. Tytuł`, `## 2. Tytuł`, ...
- Podsekcje: `### 2.1 Tytuł` lub `### Descriptive name`
- Listy: bullet (`-`) dla cech, numerowane (`1.`) dla kroków/procesów
- Tabele: markdown tables z nagłówkami
- Separator między blokami logicznymi: `---`
- Język: **polski profesjonalny B2B**, z anglicyzmami technicznymi gdzie ustalone (OEE, CAPEX, ROI, on-premise, QLoRA, deployment, pipeline, inference)
- NIGDY nie pisz `TODO`, `placeholder`, `lorem ipsum`

---

## KROK 2: Struktura 16 pigułek (co w każdej)

### Plik 01 — Funkcjonalność i User Journey
**Struktura:** `## 1.` Czym jest produkt → `## 2.` Architektura / Schemat → `## 3.` User Journey (etapy) → ... → `## N.` Podsumowanie
**Długość:** 2000–3000 słów. Najbardziej szczegółowy plik.
**Elementy:** ASCII flow diagram w code fence, tabele porównawcze, etapy journey z numeracją
**Wzorzec:** `Consultinity - info pills/01-funkcjonalnosc-user-journey.md`

### Plik 02 — Katalog Problemów i Rozwiązań (Pain Points)
**Struktura:** `## Metodologia` → `## Problem 1 — Tytuł` ... `## Problem N — Tytuł` → `## Podsumowanie — Matryca`
**Każdy problem:** 3 pola bold: **Opis** / **Rozwiązanie [Produkt]** / **Wartość biznesowa**
**Ile problemów:** 15–22 (dla Vector skupione na AI/bezpieczeństwo/przemysł; dla DBR77 na fragmentację/silosy/brak systemu)
**Wzorzec:** `Consultinity - info pills/02-pain-points.md`

### Plik 03 — Wymagania Techniczne i Infrastrukturalne
**Struktura:** `## 1.` Minimalne wymagania → `## 2.` Infrastruktura → `## 3.` Integracje → `## 4.` Sieć/bezpieczeństwo
**Elementy:** Tabele z wymaganiami (CPU/RAM/storage), wspierane przeglądarki, API, protokoły
**Dla Vector:** GPU (H100/A100), Docker, RunPod, on-premise vs cloud, QLoRA, model size (39GB base + 60MB adapter)
**Dla DBR77:** Wymagania per produkt w tabeli zbiorczej, SSO, wspólna baza, Redis, PostgreSQL

### Plik 04 — Cyberbezpieczeństwo i Własność Intelektualna
**Struktura:** `## 1.` Polityka bezpieczeństwa → `## 2.` Szyfrowanie → `## 3.` Audyt → `## 4.` IP / własność danych
**Dla Vector:** KLUCZOWY plik — dane klienta nigdy nie trenują modelu, on-premise = zero data leakage, CI/CD audytowalny, brak logowania zapytań, single-tenant vs shared isolation
**Dla DBR77:** RLS (Row-Level Security), tenant isolation, ISO-ready, GDPR, SOC 2 readiness
**Wzorzec:** odpowiednie sekcje z `vector.home.securityHighlights` i `vector.security.*` w pl.json

### Plik 05 — Hosting i Lokalizacja Danych
**Struktura:** `## 1.` Modele hostingu → `## 2.` Lokalizacja (EU/PL/on-prem) → `## 3.` Retencja → `## 4.` DPA
**Dla Vector:** 3 modele deployment (on-premise, private API, shared serverless), rezydencja danych, RunPod EU
**Dla DBR77:** Railway (staging/prod), PostgreSQL Neon/Supabase, Redis Upstash, Docker containers

### Plik 06 — Macierz Odpowiedzialności RACI
**Struktura:** `## Legenda` → `## Faza 1: [nazwa]` z tabelą RACI → ... → `## Faza N`
**Kolumny tabeli:** Zadanie | Klient | DBR77 | Integrator (R/A/C/I)
**Dla Vector:** Discovery → Pilot → Deployment → Operations
**Dla DBR77:** Evaluation → Onboarding → Implementation → Scaling → Optimization
**Długość:** 1000–1500 słów

### Plik 07 — Nakład Pracy i Zaangażowanie
**Struktura:** `## 1.` Role wymagane po stronie klienta → `## 2.` Harmonogram → `## 3.` FTE estimates
**Tabele:** Faza | Rola | Godziny/tydzień | Czas trwania
**Dla Vector:** Pilot = 2–4 tyg., deployment = 4–8 tyg., maintenance = low
**Dla DBR77:** Per product estimate + sumaryczny w tabeli

### Plik 08 — Kryteria Fit / Non-Fit
**Struktura:** `## Idealny klient` (bullets) → `## Red flags` (bullets) → `## Matryca kwalifikacji` (tabela)
**Dla Vector:** Fit = producent >50 pracowników, wyzwania Lean/OEE, potrzeba AI bez wycieku danych. Non-fit = firma bez danych produkcyjnych, brak GPU budżetu (chyba że shared)
**Dla DBR77:** Fit = firma produkcyjna >100 osób, transformacja cyfrowa priorytetem, budżet DX. Non-fit = startup bez procesów, brak sponsora C-level
**Długość:** 800–1200 słów

### Plik 09 — Granice Produktu (Out-of-Scope)
**Struktura:** `## Wstęp` → `## Kategoria N:` z `### OUT-OF-SCOPE N: Tytuł` → `## Podsumowanie — Szybka Matryca`
**Każdy item:** Bold zdania: **[Produkt] nie jest / nie robi / oferuje zamiast / Właściwe narzędzie**
**Dla Vector:** Nie jest chatbotem ogólnym, nie zastępuje konsultanta, nie steruje maszynami, nie jest ERP/MES
**Dla DBR77:** Nie jest monolitem, nie zastępuje księgowości, nie jest narzędziem HR, każdy produkt osobno
**Ile items:** 12–20
**Wzorzec:** `Consultinity - info pills/09-granice-produktu.md`

### Plik 10 — Buyer Personas — Język Korzyści
**Struktura:** `## Jak Używać` → `## Persona N: [Rola]` z `### Profil` / `### 3 Haki Sprzedażowe` / `### Unikalne Korzyści` (tabela) / `### Język Do Unikania`
**Haki:** W blockquotach (`>`)
**Persony:** 6–8 (CEO/Owner, Plant Manager, CFO, CTO, Purchasing, COO, Maintenance Manager, IT Director)
**Źródło person:** `DBR77_MESSAGING_ARCHITECTURE.md` sekcja "Persona Message Priorities"
**Wzorzec:** `Consultinity - info pills/10-buyer-personas-jezyk-korzysci.md`

### Plik 11 — Case Studies i Dowody Wartości (ROI)
**Struktura:** `## Metodologia` → `## Wzór ROI` (code fence) → `## Case Study N` z fazami i tabelą wyników
**Dla Vector:** Case studies oparte na 1400+ cases: optymalizacja layout, bottleneck analysis, predictive maintenance ROI
**Dla DBR77:** Cross-product cases: firma wdrożyła IIoT → IRIS → Consultify → efekt synergii
**WAŻNE:** Wszystkie case studies muszą być realistyczne ale anonimowe ("Zakład produkcyjny w branży FMCG")
**Ile case studies:** 4–6
**Długość:** 1500–2500 słów

### Plik 12 — Słowniczek Pojęć
**Struktura:** Lista terminów alfabetycznie: `### Termin` → Definicja (1–3 zdania)
**Dla Vector:** QLoRA, PEFT, adapter, inference, on-premise, serverless GPU, cold start, ChatML, fine-tuning, guardrails, token, LLM, embedding, reasoning
**Dla DBR77:** DRD (framework), SIRI, ADMA, Lean 4.0, CMMI, OEE, Digital Twin, IIoT, MES, CMMS, APS, WMS, QMS, transformation, initiative
**Ile terminów:** 25–40
**Długość:** 1000–1500 słów

### Plik 13 — Ścieżka Konwersji (Next Steps)
**Struktura:** `## 1.` Funnel stages → `## 2.` CTA per stage → `## 3.` Handoff rules
**Dla Vector:** Awareness (artykuł) → Interest (demo/porównanie) → Decision (pilot) → Action (deployment)
**Dla DBR77:** Entry gate → product LP → demo/trial → onboarding → cross-sell
**Źródło:** `DBR77_PRODUCT_MARKETING_PLAN.md` sekcje "Multi-Entry Gate System" i "Persona-To-Gate Mapping"
**Długość:** 800–1200 słów

### Plik 14 — Dane Wejściowe do Rekomendacji AI
**Struktura:** `## Instrukcja` → `## SEKCJA A: [Temat]` → `### [Kod] — Tytuł [TAG]` → Numerowane pytania + *Cel:* kursywą
**Dla Vector:** Pytania o current infra, data maturity, security policy, budget, use cases, team capability
**Dla DBR77:** Pytania o dojrzałość cyfrową, priorytety transformacji, istniejące systemy IT/OT, cele biznesowe
**Ile pytań:** 40–60 pogrupowane w 5–8 sekcji
**Długość:** 1500–2500 słów

### Plik 15 — Matryca Obiekcji (Objection Handling)
**Struktura:** `## Instrukcja Użycia` → `## PERSONA N: [Rola] (20 obiekcji)` → `### Obiekcja N.M` z **Obiekcja** (quote) / **Empatia** / **Fakt** / **CTA**
**ILE:** 8 person × 20 obiekcji = **160 obiekcji** (PEŁNE, nie skracaj!)
**Wzorzec:** `Consultinity - info pills/15-matryca-160-obiekcji.md`
**UWAGA:** Consultify pill 15 zawiera tylko 40/160. Twój MUSI mieć 160.
**Dla Vector:** Obiekcje typu "po co nam własne AI", "GPT wystarczy", "za drogi GPU", "nie mamy danych"
**Dla DBR77:** Obiekcje typu "za dużo produktów", "nie potrzebujemy całego ekosystemu", "mamy już ERP"
**Długość:** 6000–10000 słów (NAJDŁUŻSZY plik)

### Plik 16 — Baza 160 FAQ (Sprofilowana pod Persony)
**Struktura:** `## Sekcja N: [Rola] — 20 FAQ` → `**N.M Q: [pytanie]**` newline `A: [odpowiedź]` → `---`
**ILE:** 8 person × 20 pytań = **160 Q&A** (PEŁNE!)
**Persony:** CEO, CFO, CTO, Plant Manager, COO, Maintenance Manager, Purchasing Director, IT Director
**Wzorzec:** `Consultinity - info pills/16-baza-160-faq.md`
**Długość:** 7000–10000 słów (NAJDŁUŻSZY plik po 15)

---

## KROK 3: Reguły specyficzne per produkt

### VECTOR — Reguły:

1. **Kluczowe fakty (MUSZĄ się pojawić w pigułkach):**
   - 20 miliardów parametrów (20B LLM)
   - 1400+ rzeczywistych przypadków fabrycznych (training data)
   - QLoRA fine-tuning, adapter 60 MB
   - ChatML format, 66 kolumn danych produkcyjnych na przypadek
   - 3 modele deployment: on-premise, private API, shared serverless
   - Serverless GPU: RunPod, A100/H100 80GB
   - Cold start <60s, skaluje do zera
   - CI/CD: GitHub Actions → Docker Hub → RunPod
   - Dane klienta NIGDY nie trenują modelu
   - NIE jest chatbotem ogólnego przeznaczenia

2. **Ton Vector:** Techniczny ale przystępny. Vector to "inteligentne serce ekosystemu DBR77". Porównanie: "jak najbardziej doświadczony specjalista Lean — dostępny 24/7".

3. **Relacja do ekosystemu:** Vector zasila Consultify, IRIS, Digital Twin, IIoT, Marketplace. W publicznej komunikacji **Consultify jest priorytetem** — Vector wspiera, nie dominuje.

4. **Czego NIE obiecywać:** Nie obiecuj AGI, nie obiecuj zastąpienia konsultantów, nie podawaj specyficznych benchmarków wydajności bez źródła.

### DBR77 ECOSYSTEM — Reguły:

1. **Kluczowa narracja (z DBR77_MESSAGING_ARCHITECTURE.md):**
   - DBR77 to nie losowe portfolio software — to JEDEN system operacyjny
   - Logika: Measure → Optimize → Run → Automate → Think → Transform
   - Brand promise: less guesswork, less fragmentation, lower decision risk, faster execution, clearer financial outcomes
   - 10 lat praktyki przemysłowej (nie nowa firma)

2. **6 produktów (entry gates):**
   - **Consultify** — transformation management, consulting replacement (PRIORYTET #1)
   - **IIoT** — measurement, real-time visibility, machine data
   - **IRIS** — plant OS, execution layer, tasking
   - **Digital Twin** — simulation, decision de-risking, CAPEX confidence
   - **Marketplace** — automation sourcing, vendor comparison
   - **Vector** — secure industrial AI, intelligence layer

3. **Persona → Gate mapping:**
   - CEO/Owner/President → Consultify lub DT
   - Plant Manager/Operations → IoT lub DT
   - CFO → DT lub Marketplace
   - CTO → IRIS lub Vector
   - Purchasing → Marketplace

4. **Rola dbr77.com:** NIE jest głównym entry point. To trust layer, system explanation, brand authority. Produkty drive entry.

5. **Ton DBR77:** Strategiczny, systemowy, C-level. Mniej techniczny niż Vector, więcej o wartości biznesowej i logice decyzyjnej.

---

## KROK 4: Nazwy plików (ŚCISŁE)

### Vector (folder: `knowledge/Pigułki wiedzy /Vector-info-pills/`):
```
01-funkcjonalnosc-i-pozycjonowanie.md        ← JUŻ ISTNIEJE, NIE NADPISUJ
02-katalog-problemow-rozwiazan.md
03-wymagania-techniczne.md
04-cyberbezpieczenstwo-ip.md
05-hosting-lokalizacja-danych.md
06-macierz-odpowiedzialnosci-raci.md
07-naklad-pracy-zaangazowanie.md
08-kryteria-fit-non-fit.md
09-granice-produktu.md
10-buyer-personas-jezyk-korzysci.md
11-case-studies-roi.md
12-slowniczek.md
13-sciezka-konwersji.md
14-dane-wejsciowe-rekomendacje.md
15-matryca-obiekcji.md
16-baza-faq.md
```

### DBR77 (folder: `knowledge/Pigułki wiedzy /DBR77-info-pills/`):
```
01-funkcjonalnosc-user-journey.md
02-katalog-problemow-rozwiazan.md
03-wymagania-techniczne.md
04-cyberbezpieczenstwo-ip.md
05-hosting-lokalizacja-danych.md
06-macierz-odpowiedzialnosci-raci.md
07-naklad-pracy-zaangazowanie.md
08-kryteria-fit-non-fit.md
09-granice-produktu.md
10-buyer-personas-jezyk-korzysci.md
11-case-studies-roi.md
12-slowniczek.md
13-sciezka-konwersji.md
14-dane-wejsciowe-rekomendacje.md
15-matryca-obiekcji.md
16-baza-faq.md
```

---

## KROK 5: Walidacja po wygenerowaniu

Dla każdego pliku sprawdź:

- [ ] Nagłówek `# Plik NN:` + metadata block + `---`
- [ ] Produkt prawidłowy (`DBR77 Vector` lub `DBR77 Ecosystem`)
- [ ] Minimum 800 słów (01, 02, 10, 11, 15, 16 = min 2000)
- [ ] Plik 15: dokładnie 160 obiekcji (8 × 20)
- [ ] Plik 16: dokładnie 160 FAQ (8 × 20)
- [ ] Brak `TODO`, `placeholder`, `TBD`, `lorem ipsum`
- [ ] Fakty techniczne Vector zgodne ze źródłami (20B, 1400+, QLoRA, 60MB, H100)
- [ ] Brak obietnic których nie ma w źródłach
- [ ] Polski z anglicyzmami technicznymi — NIE tłumacz: OEE, ROI, CAPEX, on-premise, deployment, pipeline

---

## KROK 6: Po wygenerowaniu — zaindeksuj

```bash
curl -X POST http://localhost:3001/api/ai-operations/knowledge/product-pills/index \
  -H "Authorization: Bearer <SUPERADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"forceReindex": true}'
```

**Produkcja (Railway):** ten sam endpoint na URL API (`https://…/api/ai-operations/knowledge/product-pills/index`). Zawsze `forceReindex: true` po dodaniu lub zmianie plików `.md` w repozytorium (deploy buduje paczkę `knowledge-runtime/product-pills` z folderu `knowledge/Pigułki wiedzy /`). Bez tego kroku baza RAG nie ma aktualnych fragmentów — Anna/Teresa odpowiadają tylko z pigółek DB + fallbacków.

---

## Kolejność generowania (rekomendowana)

1. **Vector 02–09** (krótsza treść, łatwiejsze)
2. **Vector 10–14** (personas, case studies — wymagają kreatywności)
3. **Vector 15** (160 obiekcji — najdłuższe, generuj persona po personie)
4. **Vector 16** (160 FAQ — najdłuższe, generuj sekcja po sekcji)
5. **DBR77 01–09** (wymaga cross-reference wszystkich 6 produktów)
6. **DBR77 10–14**
7. **DBR77 15** (160 obiekcji)
8. **DBR77 16** (160 FAQ)

**WAŻNE:** Pliki 15 i 16 są za długie na jedną sesję AI. Generuj je w 8 częściach (1 persona = 1 generacja) i łącz.
