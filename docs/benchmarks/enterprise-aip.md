---
brief: enterprise-aip
module: Wzorce enterprise / AIP / data-ops (przekrojowe)
sources: [palantir.com scrape 2026-03 (sitemap + /platforms/ontology, /platforms/aip, /platforms/foundry, /aip/developers, /offerings/*, „not a data company" essays), wiedza domenowa o Palantir Foundry/AIP/Ontology]
status: done
updated: 2026-06-10
---

# Benchmark: Wzorce enterprise — Palantir Foundry + AIP (Ontology)

> Po co: to brief PRZEKROJOWY, nie o jednym module. Palantir rozwiązał problem, który my mamy
> w mniejszej skali: jak osadzić AI nad **ustrukturyzowanym modelem danych klienta** tak, żeby
> agent działał na realnych obiektach (nie na luźnym tekście) i napędzał DECYZJE, nie tylko czat.
> Cel: wyciągnąć ZASADY dla naszego modelu danych, groundingu Teresy i workflow decyzyjnego.
> Nie jesteśmy Palantirem — bierzemy doktrynę, nie skalę.

## 1. Czym jest Palantir (pozycjonowanie)
| Warstwa | Co to jest | Nasza analogia |
|---|---|---|
| **Foundry** | Platforma integracji + transformacji danych (pipeline'y, branching, lineage) | nasz backend / warstwa danych klienta |
| **Ontology** | Semantyczna warstwa nad danymi: **Objects · Links · Actions** (cyfrowy bliźniak organizacji) | nasz model: Insighty / Inicjatywy / Procesy / Wywiady + relacje |
| **AIP** (AI Platform) | Agenci/automatyzacje/LLM **ugruntowane w Ontology**, z kontrolą i audytem | Teresa + Anna nad strukturą danych klienta |
| **Apollo** | Continuous deployment dla powyższych | (poza zakresem) |

Teza, którą Palantir powtarza w esejach (`palantir-is-still-not-a-data-company`, `palantir-explained`):
**wartość nie leży w danych, tylko w MODELU operacyjnym nad danymi** — w Ontology. To jest serce briefu.

## 2. Screenshoty
**Brak.** Scrape `palantir.com` jest JS-renderowany (Next.js) — statyczne HTML mają cienkie body,
realne diagramy Ontology/AIP ładują się klientowo i nie ma ich jako czytelnych obrazów do `cp`.
Dostęp do `Softs/` zamknął się w trakcie sesji (sandbox), więc kopiowanie i tak było niemożliwe.
Referencja koncepcyjna zamiast zrzutu: schemat **Objects ↔ Links ↔ Actions** opisany w §3.

## 3. Ontology — rdzeń do skradzenia (objects / links / actions)
Ontology to nie schemat bazy — to **warstwa semantyczna i behawioralna**:
- **Objects** — rzeczowniki domeny (np. *Klient, Proces, Maszyna, Zamówienie*). U nas: *Insight,
  Inicjatywa, Proces, Sesja wywiadu, Respondent, Karta*. Każdy obiekt = typ + properties + tożsamość.
- **Links** — relacje między obiektami (*Inicjatywa → adresuje → Insight*; *Insight → wynika z →
  Proces*; *Proces → ma → Respondenta*). Linki to **first-class**, nie ukryte FK — po nich nawiguje
  i człowiek, i AI.
- **Actions** — **jedyny dozwolony sposób zmiany stanu** Ontology. Zamiast „edytuj wiersz" robisz
  `promoteInsightToInitiative`, `assignProcessOwner`, `approveCharter`. Akcja = walidacja +
  side-effecty + ślad audytu. To jest klucz: **AI i UI dzielą ten sam zestaw akcji.**

→ Dla nas: nasz model danych (insighty/inicjatywy/procesy/wywiady) powinien być opisany jako
**lekka ontologia**: typy obiektów + nazwane relacje + skończony katalog akcji mutujących stan.
To dokładnie spina się z `INITIATIVE_FORMULA` (inicjatywa = punkt zbieżności) i `CARD_CONTENT_FORMULA`.

## 4. AIP grounding — jak Teresa ma „wiedzieć" (nie halucynować)
Zasada Palantira: **agent nigdy nie operuje na surowym promptcie — operuje na Ontology.**
- Kontekst LLM to **obiekty + linki** wyciągnięte z modelu, nie zlepek tekstu. Grounding = retrieval
  po typowanych obiektach, nie po embeddingach z worka dokumentów.
- LLM **proponuje akcje z katalogu**, a nie pisze do bazy. Człowiek/reguła zatwierdza → akcja się
  wykonuje → audyt. To „**LLM proposes, Ontology disposes**".
- Każda odpowiedź jest **odnośna** (cytuje konkretne obiekty), więc da się ją zweryfikować.

→ Dla nas: Teresa powinna dostawać kontekst jako **ustrukturyzowany zrzut obiektów klienta**
(aktywne insighty, ich procesy-źródła, powiązane inicjatywy, status), a nie tylko historię czatu +
help-docs. Każda rekomendacja Teresy powinna wskazywać obiekt, którego dotyczy (insight #X, proces #Y).
To zgodne z naszym kierunkiem „Teresa jako narzędzie na kanwie" z `whiteboard.md` §5.

## 5. Workflow decyzyjny (operational decision-making)
Palantir sprzedaje nie raporty, lecz **zamkniętą pętlę**: dane → model → rekomendacja → **akcja w
systemie źródłowym** → pomiar efektu. Wzorce do adopcji:
- **Decyzja jako obiekt** — rekomendacja, jej uzasadnienie, kto zatwierdził, jaki był wynik — to
  rekordy, nie ulotny tekst czatu. (U nas: Charter inicjatywy, decyzja D1–D22 itp. powinny być obiektami.)
- **Human-in-the-loop przez Actions** — AI przygotowuje, człowiek klika akcję. Granica
  odpowiedzialności jest jawna i audytowalna.
- **Write-back** — wynik decyzji wraca do modelu (np. inicjatywa zmienia status, insight zostaje
  „rozwiązany"). Bez write-backu nie ma pętli, jest tylko dashboard.

## 6. Data-ops / governance (czego pilnować przy naszej skali)
Z esejów `designing-for-deletion`, `purpose-based-access-controls`, `interoperability`:
- **Lineage** — wiadomo, z jakiego źródła powstał insight/inicjatywa (mamy „grounded, no-repeat" —
  to ten sam instynkt).
- **Purpose-based / granular access** — dostęp per-obiekt i per-cel, nie tylko per-rola. U nas:
  RBAC org-admin/owner + beta-gating to zalążek; docelowo widoczność per-obiekt klienta.
- **Designing for deletion** — dane da się usunąć wraz z pochodnymi. Istotne dla RODO przy danych
  pracowniczych (VTS, Apator).
- **Interoperability** — Ontology siedzi NAD źródłami (SAP itd.), nie zastępuje ich. My też:
  warstwa semantyczna nad danymi z wywiadów/ankiet, a nie kolejny silos.

## 7. Decyzje dla Consultify
- ✅ **Kradniemy:** model **Objects/Links/Actions** jako framing naszego data-modelu — typy obiektów
  (Insight/Inicjatywa/Proces/Wywiad), nazwane linki, **skończony katalog akcji** mutujących stan.
- ✅ **Kradniemy:** grounding Teresy w **typowanych obiektach klienta** + każda rekomendacja odnośna
  do obiektu (anty-halucynacja, weryfikowalność).
- ✅ **Kradniemy:** „**LLM proposes, system disposes**" — AI proponuje akcje z katalogu, człowiek
  zatwierdza, akcja zostawia audyt.
- ⚠️ **Adaptujemy:** decyzję/charter jako **obiekt z write-backiem** (status inicjatywy wraca do modelu),
  spięte z `INITIATIVE_FORMULA`.
- ⚠️ **Adaptujemy:** governance — lineage + dostęp per-obiekt — wdrażamy stopniowo, zaczynając od
  obecnego RBAC/beta-gating; pełny purpose-based access to cel, nie v1.
- ❌ **Unikamy:** budowania „silnika Ontology" Palantir-grade — przy naszej skali to lekka konwencja
  w schemacie + serwisowa warstwa akcji, nie osobny produkt.
- ❌ **Unikamy:** mutowania stanu danych klienta bezpośrednio przez LLM z pominięciem warstwy akcji.
- ❌ **Unikamy:** mylenia „mamy dane klienta" z „mamy model" — wartość jest w relacjach i akcjach.

## 8. Otwarte pytania
- Czy formalizujemy **katalog akcji** (action registry) jako wspólny kontrakt UI + Teresy, czy
  zostawiamy ad-hoc endpointy? (rekomendacja: zacząć od rejestru dla inicjatyw/insightów)
- Jak reprezentujemy **linki** w obecnym schemacie — osobna tabela relacji czy typowane FK? (warunkuje
  nawigację AI po grafie)
- Zakres groundingu Teresy: ile obiektów wstrzykiwać do kontekstu, żeby nie przepalić tokenów
  (spina się z fixem token-counting `19a1b1fe11`).

## Załączniki / uwagi do źródeł
Surowe źródło: `Softs/Palantir/www.palantir.com/` (scrape 2026-03, Next.js).
- **Użyteczne:** `sitemap.xml` (646 URL — pełna mapa produktu: `/platforms/{ontology,aip,foundry,
  apollo,gotham}`, `/aip/developers`, `/aip/support`, ~10 stron `aip-for-<use-case>` operacyjnych,
  `/offerings/*` per-branża, eseje „not a data company"); nawigacja strony Ontology (potwierdza
  Ontology jako platformę pierwszej klasy obok AIP/Foundry/Apollo/Gotham).
- **Nieużyteczne/puste:** body marketingowych HTML jest JS-renderowane (cienkie statycznie, jak scrape
  tldraw) — głębia koncepcyjna pochodzi z wiedzy domenowej o Foundry/AIP potwierdzonej mapą scrape'a.
- **Uwaga środowiskowa:** dostęp do `Softs/` zamknął się w trakcie sesji (sandbox/uprawnienia),
  `textutil` działał tylko przejściowo; brief oparty na sitemapie + esejach + doktrynie publicznej.
  Przy implementacji dociągnąć online aktualne `palantir.com/platforms/ontology` i docs AIP.
