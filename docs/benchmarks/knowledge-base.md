---
brief: knowledge-base
module: Help / Knowledge base (digest → Anna + Teresa)
sources: [Atlassian/Confluence (scrape 2026-06, niedostępny w sesji), Intercom Help Center + Messenger + Fin (2026-06, niedostępny), Zendesk Guide/help center + AI agent (2026-06, niedostępny)]
status: done
updated: 2026-06-09
---

# Benchmark: Help / Knowledge base (Anna + Teresa)

> Po co: ustawić docelowy kształt naszego Help/KB i — co ważniejsze — sposób, w jaki
> dokumentacja **karmi AI** (Anna in-product + Teresa-voice/chat). Decyzja do odblokowania:
> czy zostajemy przy kodowanym SSOT (`helpExperience.ts` → `productHelpDigest` / `productModuleCatalog`),
> czy ewoluujemy ku modelowi „kolekcje → artykuły → AI-agent nad korpusem" jak Intercom Fin / Zendesk.

> ⚠️ Uwaga metodyczna: surowe scrapy w `Softs/0 Baza wiedzy/` (Atlassion 1/2, Intercom 1/2,
> Zendesk 1/2) były w tej sesji **niedostępne** — system plików zwracał „Operation not permitted"
> na całym poddrzewie `Softs` (TCC/sandbox), mimo że repo `consultify` było zapisywalne. Brief
> opiera się więc na: szablonie + ukończonym `whiteboard.md`, naszej notatce wdrożeniowej
> Help-coverage (dokładne pliki/wiring) oraz wiedzy własnej o architekturze tych trzech produktów.
> Twierdzenia o liczbach/szczegółach UI należy zweryfikować po odzyskaniu dostępu do scrapów.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature |
|---|---|---|
| **Intercom** (Help Center + Messenger + **Fin**) | „Customer service w jednym oknie" — KB + czat + AI-agent splecione w produkcie | **Fin AI Agent** odpowiadający nad korpusem help-center z cytowaniem źródeł + **contextual messenger** (pomoc w miejscu użycia) |
| **Zendesk** (Guide / help center + AI agents) | Enterprise service-desk z KB jako warstwą self-service zasilającą ticketing | **Help center IA** (Category → Section → Article) + **AI agent/answer bot** + **Content Cues** (KB sugeruje, co napisać/zaktualizować) |
| **Atlassian / Confluence** | Wiki współpracy zespołowej; KB jako szablon na spaces/pages | **Spaces + page tree + potężny search** + bloki/makra; wzorzec dla *autoringu* i hierarchii, nie dla in-product help |

Wniosek strategiczny: **Intercom to wzorzec dla połączenia KB↔AI↔in-product** (to jest dokładnie nasz
problem: digest → Anna/Teresa). **Zendesk to wzorzec IA help-center + autoring + „content cues"**.
**Confluence to wzorzec hierarchii i edytora artykułu**, ale NIE wzorzec kontekstowej pomocy w aplikacji.

## 2. Wzorce UX / IA (co działa)

> Zrzuty: nie udało się pozyskać (poddrzewo `Softs` niedostępne — patrz §1). `assets/knowledge-base/`
> utworzony, pusty. Do uzupełnienia po odzyskaniu dostępu: 1× Intercom Messenger/Help home,
> 1× Fin z cytowaniem źródeł, 1× Zendesk help-center IA.

- **Help-center IA: Category → Section → Article (Zendesk Guide).** Trzy warstwy + globalny search na
  górze, „popularne artykuły" i „ostatnio aktualizowane" na home. → *dlaczego działa:* płaska, przewidywalna
  nawigacja + search jako główny punkt wejścia. → *jak u nas:* nasz odpowiednik to **moduł → dokument → sekcje
  (whatThisIs/whyItMatters/whatYouDoHere/howAiHelpsHere/whatComesNext) + quickGuides + FAQ** w `helpExperience.ts`.
  Mamy hierarchię, brakuje globalnego search po całym korpusie Help i widoku „popularne/ostatnio zmienione".
- **Contextual in-product help (Intercom Messenger).** Widget w rogu, który **zna kontekst ekranu** i podsuwa
  trafione artykuły zanim user zapyta. → *dlaczego działa:* pomoc trafia w miejscu i momencie potrzeby, zero
  szukania. → *jak u nas:* mamy `viewToModuleMapping.ts` (view → documentId) — to **jest** nasz „kontekst ekranu".
  Anna już z tego korzysta; wzorzec do dociągnięcia: **proaktywne podsunięcie** najtrafniejszego dokumentu/FAQ
  przy wejściu w widok, nie tylko na żądanie.
- **AI-agent nad korpusem z cytowaniem (Fin / Zendesk AI).** Odpowiedź generowana wyłącznie z artykułów KB,
  **z linkami do źródeł**, z jasnym „nie wiem → eskalacja". → *dlaczego działa:* zaufanie (cytaty) + brak halucynacji
  + płynna ścieżka do człowieka. → *jak u nas:* Teresa/Anna dostają **dygest** (summary+actions+methods), NIE pełny
  korpus quick-guides/FAQ. To świadomy kompromis na tokeny, ale tracimy „cytowanie konkretnego artykułu".
- **Autoring artykułu jako struktura, nie blob (Zendesk/Confluence).** Artykuł = tytuł + sekcje + bloki + metadane
  (labels, last-updated, owner). → *jak u nas:* nasze dokumenty są już **ustrukturyzowane polami** (mocniejsze niż
  blob HTML) — to przewaga, którą zachowujemy: struktura = jednocześnie render UI i źródło dygestu AI (zero driftu).
- **„Content Cues" (Zendesk): KB mówi autorowi, czego brakuje.** Analityka wyszukiwań bez wyniku → sugestie nowych
  artykułów. → *jak u nas:* moglibyśmy logować pytania do Anny/Teresy, których digest nie pokrył, i robić z tego
  backlog dokumentów.

## 3. Model danych / architektura

Trzy modele referencyjne i nasz wybór:
- **Confluence:** Space → Page (drzewo) → bloki/makra. Hierarchia mocna, treść jako rich-content blob.
- **Zendesk Guide:** Category → Section → Article (+labels, +translations per artykuł). Płaski, search-first, i18n na
  poziomie artykułu.
- **Intercom:** Collection → Article + warstwa **Fin**, która indeksuje artykuły do odpowiedzi AI (źródło = ten sam
  korpus co help-center; jeden zbiór prawdy dla ludzi i AI).

**Nasz model (i dlaczego jest dobry):** `HELP_DOCUMENTS` w `src/config/helpExperience.ts` to **SSOT** —
dokument per moduł z polami (summary, whatThisIs…whatComesNext, askAiNow, quickGuides[], faqs[]) + bilingual PL/EN.
`viewToModuleMapping.ts` mapuje **view aplikacji → documentId** (np. AI_CHAT→chat, MEETING→meeting, WORDY→document_studio).
To jest mocniejsze niż Category/Section blob: **ta sama struktura renderuje panel Help I generuje dygest AI** →
`buildProductHelpDigest(lang)` → wstrzykiwany do **Teresa-voice** (`teresaVoiceInstruction.ts`) i **Anna-voice**
(`AnnaAssistantWidget.tsx`). Po stronie serwera (osobny tsconfig, brak importu z `src/`) **mirror**
`server/src/services/ai/productModuleCatalog.ts` zasila **Teresa-chat** (`persona.ts buildPersonaPrompt`, always-on)
i **Anna-text** (`public-anna.routes.ts`). 

→ Najważniejszy wniosek architektoniczny z benchmarku: **Intercom/Fin trzyma JEDEN korpus dla ludzi i AI; my mamy
DWA** (frontend digest + server mirror) z ręcznym ryzykiem driftu (udokumentowanym: „update server mirror too").
To nasz dług. Docelowo: jeden serializowany artefakt help (build-time export z `helpExperience.ts`), z którego
czyta i frontend, i serwer — eliminacja mirrora.

## 4. AI grounding / „answer over docs" (sedno tego briefu)

- **Granulacja:** Fin/Zendesk groundują na **całych artykułach z cytowaniem**; my groundujemy na **dygescie**
  (summary+actions+methods). Plus: tanio w tokenach, zawsze włączone (Teresa-chat always-on katalog). Minus: AI zna
  „o czym jest moduł", ale nie zacytuje konkretnego quick-guide/FAQ. → **Adaptacja:** hybryda — dygest zawsze w
  prompt (jak teraz) + **retrieval pełnego dokumentu** gdy intent dotyczy konkretnego modułu
  (mamy już bramkę intentu `isProductOrHowToQuery` w helpDocsContext — rozszerzyć o zwracanie pełnego `document` po
  `documentId` z `viewToModuleMapping`).
- **Cytowanie źródeł:** Fin podaje „z którego artykułu". My nie. → dla zaufania warto, by Teresa/Anna kończyła
  odpowiedź odnośnikiem „zobacz: Help → <moduł> → <sekcja/FAQ>".
- **Kontekst ekranu jako sygnał retrievalu:** Intercom używa bieżącego ekranu do rankingowania artykułów. Mamy
  `viewToModuleMapping` — to gotowy, niedoceniony sygnał: **bieżący view → priorytetowy dokument** w grounding Anny.
- **Eskalacja / „nie wiem":** wzorzec Fin (gdy KB nie pokrywa → jawne „nie wiem" + ścieżka do człowieka). U nas:
  jawne „tego nie ma w dokumentacji" zamiast konfabulacji + ewentualne logowanie do backlogu (patrz Content Cues §2).

## 5. Decyzje dla Consultify

- ✅ **Kradniemy (Intercom):** wzorzec **kontekstowej pomocy** — `viewToModuleMapping` jako sygnał do
  *proaktywnego* podsuwania dokumentu/FAQ przy wejściu w widok, nie tylko na pytanie.
- ✅ **Kradniemy (Fin/Zendesk):** **cytowanie źródła** w odpowiedziach Anny/Teresy („zobacz: Help → moduł → sekcja")
  + jawne „nie wiem" zamiast halucynacji.
- ✅ **Kradniemy (Zendesk Content Cues):** logowanie pytań nieobsłużonych przez digest → backlog nowych dokumentów/FAQ.
- ✅ **Zachowujemy (nasza przewaga):** **ustrukturyzowany dokument = jednocześnie UI i źródło AI** (zero driftu
  treści w obrębie frontu). To lepsze niż blob-artykuł Confluence/Zendesk.
- ⚠️ **Adaptujemy:** **retrieval pełnego dokumentu** dla intentów modułowych (digest zawsze + pełny doc on-demand),
  zamiast tylko dygestu — hybryda zamiast skoku na pełny-RAG.
- ⚠️ **Adaptujemy:** **globalny search po Help** + sekcje „popularne / ostatnio zmienione" na home panelu Help
  (wzorzec Zendesk Guide) — dziś mamy nawigację per-view, brak wyszukiwarki po całym korpusie.
- ❌ **Unikamy:** **dwóch rozjeżdżających się korpusów** (frontend digest vs server mirror). Cel: jeden artefakt
  build-time z `helpExperience.ts` czytany przez oba światy → koniec ręcznego „update the mirror too".
- ❌ **Unikamy:** modelu Confluence (wiki spaces/page-tree) jako pomocy in-product — to autoring zespołowy, nie
  kontekstowa pomoc; dla nas SSOT-per-moduł jest właściwy.
- ❌ **Unikamy:** pełnego ciężkiego help-center jak Zendesk (kategorie/tłumaczenia/portale) — overkill dla 19 modułów;
  bierzemy wzorce IA i AI, nie cały ich produkt.

## 6. Otwarte pytania / do walidacji

- Jeden artefakt help (build-time export) zamiast mirrora `productModuleCatalog.ts` — kiedy i czyim kosztem?
- Hybryda grounding: czy dygest+pełny-doc-on-demand wystarczy, czy potrzebny prawdziwy RAG/embeddings nad quick-guides+FAQ?
- Cytowanie źródeł w głosie (Teresa-voice) — jak podać „zobacz Help → …" w kanale audio, nie tylko tekstowym?
- Search po Help: lokalny (po `HELP_DOCUMENTS`) czy wspólny z globalnym search aplikacji?
- **Walidacja źródeł:** powtórzyć dystylację na realnych scrapach Atlassion/Intercom/Zendesk po odzyskaniu dostępu
  do `Softs` — potwierdzić szczegóły IA, UI Fin/Messenger i dociąć 3 zrzuty do `assets/knowledge-base/`.

## Załączniki
Zrzuty: **brak** — `Softs/0 Baza wiedzy/` niedostępny w sesji (TCC „Operation not permitted" na całym poddrzewie
`Softs`; repo `consultify` zapisywalne). `assets/knowledge-base/` utworzony, pusty — do uzupełnienia.
Surowe źródło (do ponownej dystylacji po odzyskaniu dostępu): `Softs/0 Baza wiedzy/{Atlassion 1, Atlassion 2,
Intercom 1, Intercom 2, Zendesk 1, Zendesk 2}`.
Nasza strona (zweryfikowana z notatki wdrożeniowej): `src/config/helpExperience.ts` (SSOT),
`src/config/viewToModuleMapping.ts`, `src/config/productHelpDigest.ts`, `src/utils/teresaVoiceInstruction.ts`,
`src/components/.../AnnaAssistantWidget.tsx`, `server/src/services/ai/productModuleCatalog.ts`,
`server/src/ai/persona.ts`, `server/src/routes/public-anna.routes.ts`.
