---
brief: enterprise-aip
module: Wzorce enterprise / AIP / data-ops (przekrojowe)
sources: [palantir.com scrape 2026-03 (REALNY TEKST: /platforms/ontology, /platforms/aip, /aip/developers, /platforms/foundry, /palantir-explained; + sitemap, eseje „not a data company"), wiedza domenowa o Palantir Foundry/AIP/Ontology]
grounding: scrape/partial
status: done
updated: 2026-06-10
---

# Benchmark: Wzorce enterprise — Palantir Foundry + AIP (Ontology)

> Po co: to brief PRZEKROJOWY, nie o jednym module. Palantir rozwiązał problem, który my mamy
> w mniejszej skali: jak osadzić AI nad **ustrukturyzowanym modelem operacyjnym klienta** tak, żeby
> agent działał na realnych obiektach (nie na luźnym tekście) i napędzał DECYZJE, nie tylko czat.
> Cel: wyciągnąć ZASADY dla naszego modelu danych, groundingu Teresy i workflow decyzyjnego.
> Nie jesteśmy Palantirem — bierzemy doktrynę, nie skalę.
>
> Ten brief jest UGRUNTOWANY w realnym tekście stron (cytaty niżej), nie tylko w sitemapie.

## 1. Czym jest Palantir (pozycjonowanie — z realnej kopii stron)
| Warstwa | Co to jest (cytat / parafraza ze strony) | Nasza analogia |
|---|---|---|
| **Foundry** | „The **Ontology-Powered Operating System** for the Modern Enterprise" — integracja + transformacja danych (pipeline'y, branching, lineage) | nasz backend / warstwa danych klienta |
| **Ontology** | „The **Decision-Centric System** for Enterprise Autonomy" — semantyczna warstwa kodująca **Data · Logic · Action · Security** organizacji | nasz model: Insighty / Inicjatywy / Procesy / Wywiady + relacje + akcje |
| **AIP** (AI Platform) | „**Go beyond chat.** Turn AI in your Applications into **Agents and Automations**" — agenci ugruntowani w Ontology, z kontrolą i audytem | Teresa + Anna nad strukturą danych klienta |
| **Apollo** | Continuous deployment dla powyższych | (poza zakresem) |

**KOREKTA vs poprzednia wersja:** Palantir nie ramuje Ontology jako samo „Objects/Links/Actions".
Strona `/platforms/ontology` ramuje ją jako **cztery filary, które trzeba zakodować: Data, Logic,
Action, Security** („Encode the Data / Logic / Action / Security of the Enterprise"). Objects ·
Properties · Links to warstwa DANYCH („the *nouns* of the enterprise"); Actions to warstwa AKCJI
(„*verbs*"). To bogatszy framing niż wcześniejszy trójkąt — i lepszy dla nas (logika + bezpieczeństwo
to osobne wymiary, nie podzbiór akcji).

Teza powtarzana w esejach (`Palantir Is Not a Data Company #1`, `...Still Not a Data Company #7`):
**wartość nie leży w danych, tylko w MODELU operacyjnym nad danymi** — w Ontology. To serce briefu.

## 2. Screenshoty (REALNE — skopiowane ze scrape'a)
W przeciwieństwie do poprzedniej wersji („brak — wszystko JS"), w `Softs/Palantir/.../assets/`
znaleziono **realne grafiki produktowe** (Contentful CDN, nie JS-render). Skopiowane do
`assets/enterprise-aip/`:

- **`ontology-system-diagram.png`** — autentyczny slajd „**The Ontology System**" z AIPCon: warstwy
  **DATA SOURCES → LOGIC SOURCES → SYSTEMS OF ACTION** (dół) i **ANALYTICS & WORKFLOWS /
  AUTOMATIONS / PRODUCTS & GOAL** (góra), w środku graf obiektów Ontology. To wizualne potwierdzenie
  framingu z §1 (Data · Logic · Action) i §3.
- **`ontology-sdk-schematic.png`** — schemat „Building with Palantir AIP — **Ontology Software
  Development Kit**": wireframe grafu obiektów/relacji jako backend aplikacji (potwierdza §3 „tool
  factory" / OSDK jako backend).

> Uwaga: hero-diagramy *na samych stronach* `/ontology` i `/aip` są wideo/JS-renderowane i nie dało
> się ich wyjąć jako obrazów. Powyższe dwa pochodzą z CDN-owej biblioteki assetów (realne PNG).

## 3. Ontology — rdzeń do skradzenia (data · logic · action · security)
Ontology to nie schemat bazy — to **warstwa semantyczna i behawioralna**. Cztery filary z realnej kopii:

- **Data (Objects · Properties · Links)** — „unifies disparate data sources… into coherent **objects,
  properties, and links** — the *nouns* of the enterprise." U nas: *Insight, Inicjatywa, Proces, Sesja
  wywiadu, Respondent, Karta*. **Links są first-class**, nie ukryte FK — po nich nawiguje człowiek i AI.
- **Action (verbs)** — „models the complete range of **actions — or *verbs*** — from simple
  transactions to multi-step workflows that **write back** to operational and edge systems. Every
  kinetic action is **traceable, governed, and executable at scale**." To **jedyny dozwolony sposób
  zmiany stanu**: zamiast „edytuj wiersz" robisz `promoteInsightToInitiative`, `assignProcessOwner`,
  `approveCharter`. **AI i UI dzielą ten sam zestaw akcji.**
- **Logic** — „business logic that powers each action… from simple business rules to ML models,
  **LLM-driven functions**, or complex multi-step orchestrations." Logika żyje obok akcji, nie w UI.
- **Security** — „orchestrates **granular security policies** across data, logic, and action
  primitives — governing interactions for tens of thousands of humans **and agents** simultaneously."

→ Dla nas: nasz model (insighty/inicjatywy/procesy/wywiady) opisujemy jako **lekką ontologię**:
typy obiektów + nazwane relacje + **skończony katalog akcji** mutujących stan + reguły logiki +
polityka dostępu. Spina się z `INITIATIVE_FORMULA` (inicjatywa = punkt zbieżności) i `CARD_CONTENT_FORMULA`.

> Z `/aip/developers` (realny tekst): Ontology to **„tool factory"** — „lets your builders define
> tools for both humans and agents"; OSDK „creates an API enabling you to build operational apps on
> top of any data, modeling, or **systems of action**." To dosłownie nasz cel: jeden katalog akcji =
> kontrakt dla UI i dla Teresy.

## 4. AIP grounding — jak Teresa ma „wiedzieć" (nie halucynować)
Zasada Palantira potwierdzona realną kopią: **agent operuje na Ontology, nie na surowym promptcie.**

- **Anti-halucynacja — CYTAT z `/aip/developers`:** „**The Ontology makes your data easier for LLMs
  to understand and can help minimize hallucinating.**" Grounding = retrieval po **typowanych
  obiektach + linkach**, nie po embeddingach z worka dokumentów.
- **„LLM proposes, system disposes" — POTWIERDZONE niemal dosłownie** na stronie `/platforms/aip`.
  Realna kopia trzech kroków pętli:
  - „AI reviews alerts and **automatically proposes resolutions**"
  - „Human operators **review proposals to approve** AI-suggested resolutions"
  - „Tools allow the AI to **propose and undertake real-world actions**" +
    „Human operators **remain in-the-loop for approving** AI-proposed actions"
- Każda odpowiedź jest **odnośna** (dotyczy konkretnych obiektów), więc da się ją zweryfikować.

→ Dla nas: Teresa dostaje kontekst jako **ustrukturyzowany zrzut obiektów klienta** (aktywne
insighty, ich procesy-źródła, powiązane inicjatywy, status), nie tylko historię czatu + help-docs.
Każda rekomendacja Teresy wskazuje obiekt (insight #X, proces #Y). Zgodne z „Teresa jako narzędzie
na kanwie" z `whiteboard.md` §5.

## 5. Workflow decyzyjny (operational decision-making)
Palantir sprzedaje nie raporty, lecz **zamkniętą pętlę**. Z `/platforms/foundry` (realny tekst):
„harmonize and automate **decision-making** in complex settings… driving meaningful **action** as
conditions evolve." Wzorce do adopcji:

- **Decyzja jako obiekt** — rekomendacja, uzasadnienie, kto zatwierdził, jaki wynik — to rekordy, nie
  ulotny tekst czatu. (U nas: Charter inicjatywy, decyzje D1–D22 powinny być obiektami.)
- **Human-in-the-loop przez Actions** — AI przygotowuje, człowiek klika akcję; granica
  odpowiedzialności jawna i audytowalna (potwierdza to kopia kroków „remain in-the-loop", §4).
- **Write-back** — „write back to operational and edge systems" (§3). Wynik decyzji wraca do modelu
  (inicjatywa zmienia status, insight zostaje „rozwiązany"). Bez write-backu nie ma pętli, jest dashboard.

## 6. Data-ops / governance (czego pilnować przy naszej skali)
- **Lineage / provenance** — Foundry niesie pochodzenie danych (pipeline'y + branching). Mamy
  „grounded, no-repeat" — to ten sam instynkt; docelowo: z jakiego źródła powstał insight/inicjatywa.
- **Purpose-based Access Controls (PBAC)** — **POTWIERDZONE jako realny termin** na `/platforms/foundry`,
  z realnym klientem: N3C/NCATS „closely **governs data usage and access** for hundreds of projects
  via **Purpose-based Access Controls (PBAC)**." Dostęp per-obiekt i per-cel, nie tylko per-rola.
  U nas: RBAC org-admin/owner + beta-gating to zalążek; docelowo widoczność per-obiekt klienta.
- **Designing for deletion** — (esej `Safeguarding Privacy through Systematic Data Deletion`) dane da
  się usunąć wraz z pochodnymi. Istotne dla RODO przy danych pracowniczych (VTS, Apator).
- **Interoperability / federacja** — z `/aip/developers`: „AIP's **federated** data model **avoids data
  duplication** while enabling powerful data integration." Ontology siedzi NAD źródłami (ERP/CRM/SAP),
  nie zastępuje ich. My też: warstwa semantyczna nad danymi z wywiadów/ankiet, a nie kolejny silos.

## 7. Decyzje dla Consultify
- ✅ **Kradniemy:** framing **Data · Logic · Action · Security** (bogatszy niż sam „objects/links/
  actions") jako oś naszego data-modelu — typy obiektów + nazwane linki + **skończony katalog akcji** +
  reguły logiki + polityka dostępu.
- ✅ **Kradniemy:** grounding Teresy w **typowanych obiektach klienta** + każda rekomendacja odnośna do
  obiektu (anty-halucynacja — wprost wsparta cytatem „minimize hallucinating", §4).
- ✅ **Kradniemy:** „**LLM proposes, system disposes**" — potwierdzone kopią AIP: AI proponuje akcje,
  człowiek zatwierdza, akcja zostawia audyt.
- ✅ **Kradniemy:** **OSDK jako „tool factory"** — jeden katalog akcji = wspólny kontrakt UI + Teresy.
- ⚠️ **Adaptujemy:** decyzję/charter jako **obiekt z write-backiem** (status inicjatywy wraca do modelu),
  spięte z `INITIATIVE_FORMULA`.
- ⚠️ **Adaptujemy:** governance — lineage + **PBAC** (dostęp per-obiekt/per-cel) — wdrażamy stopniowo,
  startując od obecnego RBAC/beta-gating; pełny PBAC to cel, nie v1.
- ❌ **Unikamy:** budowania „silnika Ontology" Palantir-grade — przy naszej skali to lekka konwencja w
  schemacie + serwisowa warstwa akcji, nie osobny produkt.
- ❌ **Unikamy:** mutowania stanu danych klienta bezpośrednio przez LLM z pominięciem warstwy akcji.
- ❌ **Unikamy:** mylenia „mamy dane klienta" z „mamy model" — wartość jest w relacjach, akcjach i logice.

## 8. Otwarte pytania
- Czy formalizujemy **katalog akcji** (action registry) jako wspólny kontrakt UI + Teresy, czy
  zostawiamy ad-hoc endpointy? (rekomendacja: zacząć od rejestru dla inicjatyw/insightów)
- Jak reprezentujemy **linki** w schemacie — osobna tabela relacji czy typowane FK? (warunkuje
  nawigację AI po grafie)
- Zakres groundingu Teresy: ile obiektów wstrzykiwać do kontekstu, by nie przepalić tokenów (spina
  się z fixem token-counting `19a1b1fe11`).

## Załączniki / uwagi do źródeł
Surowe źródło: `Softs/Palantir/www.palantir.com/` (scrape 2026-03, Next.js).
- **Realny tekst wyciągnięty (`textutil`):** `/platforms/ontology` (bogata kopia — cztery filary,
  „tool factory", „decision-centric"), `/platforms/aip` („go beyond chat", pełna pętla propose→approve),
  `/aip/developers` („minimize hallucinating", federated model, OSDK), `/platforms/foundry`
  („Ontology-Powered OS", PBAC + N3C), `/palantir-explained` (eseje „not a data company").
- **Realne grafiki:** 2 skopiowane do `assets/enterprise-aip/` (§2) — slajd „The Ontology System" +
  schemat OSDK. Hero-diagramy na samych stronach są wideo/JS i niedostępne jako obraz.
- **Puste/cienkie źródła:** `blog/` to tylko `index.html` (brak osobnych wpisów); body marketingowych
  HTML poza wymienionymi jest JS-renderowane. Sitemap (646 URL) służył jako mapa produktu, nie treść.
