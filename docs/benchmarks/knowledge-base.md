---
brief: knowledge-base
module: Help / Knowledge base (digest → Anna + Teresa)
sources: [Atlassian Support + Confluence/Jira docs (scrape 2026-06), Intercom Help Center + Knowledge Hub + Fin AI Agent (scrape 2026-06), Zendesk Guide/help center + Answer Bot/Copilot (scrape 2026-06)]
status: done
grounding: scrape/partial
updated: 2026-06-10
---

# Benchmark: Help / Knowledge base (Anna + Teresa)

> Po co: ustawić docelowy kształt naszego Help/KB i — co ważniejsze — sposób, w jaki
> dokumentacja **karmi AI** (Anna in-product + Teresa-voice/chat). Decyzja do odblokowania:
> czy zostajemy przy kodowanym SSOT (`helpExperience.ts` → `productHelpDigest` / `productModuleCatalog`),
> czy ewoluujemy ku modelowi „kolekcje → artykuły → AI-agent nad korpusem" jak Intercom Fin / Zendesk.

> ✅ Uźródłowienie (2026-06-10): brief zaktualizowany na **realnych scrapach** z `Softs/0 Baza wiedzy/`
> (Atlassion 1/2 = support.atlassian.com + Jira/Confluence docs; Intercom 1/2 = pełny help center
> `intercom.com/help` + Knowledge Hub + Fin; Zendesk 1/2 = `support.zendesk.com/hc` + Answer Bot/Copilot).
> Wcześniejsze twierdzenia „z wiedzy własnej" potwierdzone lub skorygowane z tekstu artykułów; 3 realne
> zrzuty UI dociągnięte do `assets/knowledge-base/` (patrz §2). Folder Intercom 1 i część Zendesk 1 to
> głównie *developer/API docs* (Redoc), nie help-center — patrz nota na końcu.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature |
|---|---|---|
| **Intercom** (Help Center + Messenger + **Fin** + **Knowledge Hub**) | „Customer service w jednym oknie" — KB + czat + AI-agent splecione w produkcie | **Knowledge Hub** = JEDEN korpus (Sources/Content) zasilający Fin, Copilot i Help Center jednocześnie; **Fin AI Agent** odpowiada nad nim z bramkowaniem pewności i handoverem |
| **Zendesk** (Guide / help center + AI agents) | Enterprise service-desk z KB jako warstwą self-service zasilającą ticketing | **Help center IA** (knowledge base → kategorie → artykuł, search-first) + **Answer Bot/Copilot** sugerujący z „help center content" (cytowane źródło + confidence: High/Low) |
| **Atlassian / Confluence + Jira** | Wiki współpracy + service-desk docs; KB jako drzewo dokumentów na spaces/pages | **Drzewo dokumentów (lewy nav) + breadcrumb + search** + **Rovo** (AI chat ze slash-commands typu `/manage-jira-permissions`) wbudowany w docs; wzorzec hierarchii i autoringu, nie kontekstowej pomocy in-product |

Wniosek strategiczny: **Intercom to wzorzec dla połączenia KB↔AI↔in-product** (to jest dokładnie nasz
problem: digest → Anna/Teresa). **Zendesk to wzorzec IA help-center + autoring + „content cues"**.
**Confluence to wzorzec hierarchii i edytora artykułu**, ale NIE wzorzec kontekstowej pomocy w aplikacji.

## 2. Wzorce UX / IA (co działa)

> Zrzuty (realne UI, nie marketing): `assets/knowledge-base/zendesk-answerbot-copilot-citation.png` —
> Zendesk Answer Bot + **Copilot suggests** z **„Suggestion from help center content"** (cytowane źródło) i
> **Confidence: High/Low** przy makrach → żywa ilustracja AI grounding §4. `assets/knowledge-base/intercom-knowledge-hub-single-corpus.png`
> — Intercom **Knowledge Hub → Add content**: Public/Internal article + Snippet, sync z Zendesk/Guru/Notion/Confluence/PDF,
> kolumny **AI Agent / AI Copilot / Help Center** = jeden korpus dla ludzi i AI (§3). `assets/knowledge-base/intercom-inbox-macro.png`
> — Intercom Inbox: kontekst konwersacji + makra/akcje w miejscu pracy. (Confluence/Jara: w scrapach tylko fragmenty
> nav-trees i diagramy doc, brak czystego zrzutu „space tree" — pominięty jako nie-produktowy.)

- **Help-center IA: knowledge base → kategorie → artykuł (Zendesk Guide, potwierdzone z `support.zendesk.com/hc/en-us`).**
  Home = „Knowledge base" z kafelkami (Getting started, Help and FAQs, Product guides, Best practices, Agent guide,
  Policies), globalny search z **Recent searches** na górze + sekcja **News and updates** (datowane wpisy). Artykuł ma
  **breadcrumb (Home › kategoria › sekcja)**, autora + „Zendesk Documentation Team", **Edited <data>**, Follow, komentarze,
  **Related articles**. → *dlaczego działa:* płaska, przewidywalna nawigacja + search jako główny punkt wejścia. → *jak u nas:*
  odpowiednik to **moduł → dokument → sekcje (whatThisIs/whyItMatters/whatYouDoHere/howAiHelpsHere/whatComesNext) + quickGuides + FAQ**
  w `helpExperience.ts`. Mamy hierarchię, brakuje globalnego search po całym korpusie Help i widoku „popularne/ostatnio zmienione".
- **Help center jako kolekcje z licznikami (Intercom, potwierdzone z `intercom.com/help/en`).** Home = siatka **Collections**
  (Fin AI Agent — 94 artykuły, Knowledge — 52, Inbox — 109, Workflows — 66, Outbound — 137, …) każda z liczbą autorów/artykułów,
  search-first („Search for articles…"), bilingual (en/de/fr/es/ja/pt-BR). → *jak u nas:* nasz moduł↔dokument to płaski odpowiednik
  kolekcji; warto pokazywać liczność/świeżość treści jak Intercom.
- **Contextual in-product help (Intercom Messenger).** Widget, który **zna kontekst ekranu** i podsuwa trafione artykuły zanim
  user zapyta. → *dlaczego działa:* pomoc trafia w miejscu i momencie potrzeby. → *jak u nas:* mamy `viewToModuleMapping.ts`
  (view → documentId) — to **jest** nasz „kontekst ekranu". Anna już z tego korzysta; wzorzec do dociągnięcia: **proaktywne
  podsunięcie** najtrafniejszego dokumentu/FAQ przy wejściu w widok, nie tylko na żądanie.
- **AI-agent nad korpusem z cytowaniem (Fin / Zendesk, potwierdzone z artykułów).** Zendesk Copilot jawnie etykietuje
  „**Suggestion from help center content**" i pokazuje **Confidence** przy proponowanej akcji; Intercom Fin groundowany na
  Knowledge Hub. → *dlaczego działa:* zaufanie (cytaty) + brak halucynacji + płynna ścieżka do człowieka. → *jak u nas:*
  Teresa/Anna dostają **dygest** (summary+actions+methods), NIE pełny korpus quick-guides/FAQ. Świadomy kompromis na tokeny,
  ale tracimy „cytowanie konkretnego artykułu".
- **Autoring artykułu jako struktura, nie blob (Zendesk/Intercom).** Artykuł = tytuł + **Table of contents** (potwierdzone:
  Intercom „knowledge-explained" i Fin docs mają spis sekcji) + sekcje + metadane (autor, Edited, Related). Intercom dodatkowo
  rozróżnia **Public / Internal article / Snippet** (różne audytoria: Help Center vs tylko Copilot). → *jak u nas:* nasze dokumenty
  są już **ustrukturyzowane polami** (mocniejsze niż blob HTML) — przewaga do zachowania: struktura = render UI i źródło dygestu AI (zero driftu).
- **Single corpus → many surfaces (Intercom Knowledge Hub, potwierdzone z „knowledge-explained" + zrzutu).** „Knowledge w Intercom
  to scentralizowany system; z jednego miejsca decydujesz, która treść zasila **Fin**, **Copilot** i **Help Center**" + bulk-action
  „Change AI Agent state / Change AI Copilot state / Change Help Center status". → *jak u nas:* to dokładnie kierunek, który
  rekomendujemy zamiast naszych DWÓCH korpusów (digest vs server mirror) — patrz §3.

## 3. Model danych / architektura

Trzy modele referencyjne i nasz wybór (potwierdzone ze scrapów):
- **Atlassian/Confluence + Jira:** drzewo dokumentów w lewym nav (rozwijane gałęzie), breadcrumb, search; treść jako
  rich-content. AI = **Rovo Chat** ze slash-commands wprost w docs (np. `/manage-jira-permissions`). Wzorzec hierarchii/autoringu.
- **Zendesk Guide:** knowledge base → kategorie → artykuł, **search-first** (Recent searches), i18n per locale (`/hc/en-us`,
  `/hc/de`…). Artykuł: breadcrumb + autor/Documentation Team + Edited + Related articles. AI (Answer Bot/Copilot) sugeruje
  z „help center content" z confidence.
- **Intercom:** Help Center = **Collections → Articles** (z licznikami autorów/artykułów), a pod spodem **Knowledge Hub**
  (Sources/Content) — JEDEN korpus, z którego per-treść włączasz **Fin / Copilot / Help Center**. Można syncować/importować
  z Zendesk, Guru, Notion, Confluence, stron WWW i PDF. To jest najczystszy „jeden zbiór prawdy dla ludzi i AI".

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
- **Eskalacja / „nie wiem" (potwierdzone z Fin „understand-why-fin-may-not-provide-an-answer"):** Fin ma jawnie
  zdefiniowane powody nie-odpowiedzi: **brak treści z wystarczającą pewnością** (wtedy dzieli się kontekstem, wyraża
  niepewność, prosi o doprecyzowanie), **prośba o człowieka** (natychmiastowy handover, bez próby odpowiedzi),
  oraz niedopasowanie języka treści (real-time translation jako obejście). → U nas: jawne „tego nie ma w dokumentacji"
  zamiast konfabulacji + handover + logowanie do backlogu nowych dokumentów (patrz §5, „content recommendations").

## 5. Decyzje dla Consultify

- ✅ **Kradniemy (Intercom):** wzorzec **kontekstowej pomocy** — `viewToModuleMapping` jako sygnał do
  *proaktywnego* podsuwania dokumentu/FAQ przy wejściu w widok, nie tylko na pytanie.
- ✅ **Kradniemy (Fin/Zendesk):** **cytowanie źródła** w odpowiedziach Anny/Teresy („zobacz: Help → moduł → sekcja")
  + jawne „nie wiem" zamiast halucynacji.
- ✅ **Kradniemy (Intercom „AI-powered content recommendations" / Zendesk Content Cues):** analityka treści + logowanie
  pytań nieobsłużonych przez digest → backlog nowych dokumentów/FAQ (Intercom ma na to dedykowany artykuł „use AI-powered
  content recommendations to improve Fin").
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
- **Do dociągnięcia (czego scrap nie dał):** czysty zrzut „space tree" Confluence + end-user widoku **Messenger/Fin**
  z cytowanym artykułem (scrapy Intercom 1 to głównie developer/API docs; widok klienta Fin nie zachował się jako obraz).

## Załączniki
Zrzuty (realne UI ze scrapów, 2026-06-10) w `assets/knowledge-base/`:
- `zendesk-answerbot-copilot-citation.png` — Zendesk Answer Bot + Copilot suggests, „Suggestion from help center content" + Confidence High/Low (§2, §4).
- `intercom-knowledge-hub-single-corpus.png` — Intercom Knowledge Hub → Add content: Public/Internal/Snippet + sync z Zendesk/Guru/Notion/Confluence/PDF, kolumny AI Agent/AI Copilot/Help Center (§3).
- `intercom-inbox-macro.png` — Intercom Inbox: kontekst konwersacji + makra/akcje w miejscu pracy.

Surowe źródło: `Softs/0 Baza wiedzy/{Atlassion 1, Atlassion 2, Intercom 1, Intercom 2, Zendesk 1, Zendesk 2}`.
Uwaga o jakości źródeł: **Intercom 2** = pełny help center `intercom.com/help` (Collections + 94-artykułowy Fin) — najbogatsze.
**Intercom 1** = głównie developer/API docs (Redoc) — mało help-center. **Zendesk 2** = `support.zendesk.com/hc` (IA + Copilot)
— bogate; **Zendesk 1** = w większości developer.zendesk.com (API). **Atlassion 1/2** = support.atlassian.com + Jira/Confluence
docs (drzewo + Rovo), bez czystego „Confluence space" UI.
Nasza strona (zweryfikowana z notatki wdrożeniowej): `src/config/helpExperience.ts` (SSOT),
`src/config/viewToModuleMapping.ts`, `src/config/productHelpDigest.ts`, `src/utils/teresaVoiceInstruction.ts`,
`src/components/.../AnnaAssistantWidget.tsx`, `server/src/services/ai/productModuleCatalog.ts`,
`server/src/ai/persona.ts`, `server/src/routes/public-anna.routes.ts`.
