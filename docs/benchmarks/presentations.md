---
brief: presentations
module: Presentation Studio (Deliverables / EE) + Outputs hub
sources: [Gamma developers.gamma.app (scrape 2026-03), Beautiful.ai support (2026-03), Pitch help (2026-03)]
status: done
updated: 2026-06-09
---

# Benchmark: Presentation Studio (Deliverables / EE)

> Po co: zaprojektować flow „prompt/treść → gotowa talia" dla naszego Presentation Studio
> tak, żeby Teresa generowała deck z materiałów klienta (insighty, inicjatywy, tabele),
> a nie tylko podpowiadała tekst. Gamma = wzorzec generacji AI (API-first), Beautiful.ai =
> wzorzec auto-layoutu (Smart Slides), Pitch = wzorzec współpracy nad talią.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature |
|---|---|---|
| **Gamma** | „AI design partner" — prompt/notatki → prezentacja, dokument, web, social; API-first | **Generate API** (`inputText → deck`) + **Create from Template API** (zachowuje brand) + Gamma MCP (Claude/Zapier/Make) |
| **Beautiful.ai** | Prezentacja, która sama się formatuje; design-as-code | **Smart Slides** — slajdy z wbudowaną logiką układu; treść dosypujesz, layout adaptuje się sam (zero ręcznego pozycjonowania) |
| **Pitch** | Collaborative deck building dla zespołów | Realtime współpraca + **smart formatting** (swap/tidy bloków) + co-presenting + analytics linka |

Wniosek strategiczny: **silnikiem generacji bierzemy wzorzec Gamma** (treść → karty → eksport),
**logikę „slajd sam się układa" bierzemy z Beautiful.ai**, a **warstwę współpracy z Pitch**
(łączy się z naszym `realtime-collab.md`).

## 2. Wzorce UX / IA (co działa)

- **Prompt-first, ale step-by-step (nie one-shot).** Beautiful.ai świadomie NIE skacze z jednego
  promptu do gotowej talii — prowadzi przez kroki (prompt → kontekst/pliki → outline → deck),
  żeby zachować intencję autora. To wzorzec dla Teresy: nasz flow ma być wieloetapowy z punktami
  kontroli, nie „czarna skrzynka".
- **Slide AI = edycja AI per-slajd.** Po wygenerowaniu talii Beautiful.ai pozwala iterować jeden
  slajd naraz: regeneruj treść z innym promptem, podejrzyj alternatywne układy (Smart Slide
  layouts), przegeneruj obraz niezależnie od tekstu, „uziem" pojedynczy slajd plikiem. → `assets/presentations/01-gamma-template-api-panel.png` (analogiczny panel edycji u Gamma) → *iteracja lokalna bez psucia reszty* → *u nas: każda karta deck'a ma własne menu „Regeneruj / Inny układ / Zmień obraz" obsługiwane przez Teresę.*
- **„Copy gammaId for API" z poziomu talii.** Gamma robi most między aplikacją a API: każdy
  template ma akcję skopiowania ID do użycia programatycznego. → `assets/presentations/02-gamma-copy-gammaid.png` → *user buduje brand w GUI, automatyzacja używa go po ID* → *u nas: każdy zapisany szablon Studio dostaje stabilne ID, którym Teresa/Outputs hub generuje warianty.*
- **Panel API wbudowany w edytor templatu.** → `assets/presentations/04-gamma-api-tab.png` — „Use this template with our API" siedzi w tej samej kanwie co edycja, nie w osobnym dev-portalu.
- **Smart formatting (Pitch): swap + tidy.** Swap = zamiana pozycji dwóch bloków tego samego typu
  (z guardrailami: ten sam styl/font/kolor, żeby nie zamienić nagłówka z treścią). Tidy =
  auto-wyrównanie wielu bloków „różdżką". → *u nas: manipulacja blokami bez ręcznego pikselowania.*
- **Theme/brand jako pierwszorzędny obiekt.** Wszystkie trzy: motyw definiowany raz (kolory, fonty,
  logo, header/footer), potem stosowany na całą talię i publikowany do workspace (Pitch: „Publish
  slide style to workspace"; Beautiful.ai: Team Theme; Gamma: custom themes + `themeId`).

## 3. Model danych / architektura

- **Karta/slajd jako jednostka, nie monolit.** Gamma operuje na „cards"; `numCards`, `cardSplit`
  (`auto` vs `inputTextBreaks`), `cardOptions` (wymiary `fluid`/aspect ratio, header/footer per-karta).
  → nasz Presentation Studio: deck = lista kart-rekordów, każda z własnym layoutem i źródłem treści.
- **Smart Slide = layout z logiką (Beautiful.ai).** Slajd to nie wolne pole, tylko komponent, który
  sam rozmieszcza zawartość gdy dosypujesz elementy. → dla nas: zestaw „inteligentnych" typów slajdów
  (Headline, Text, Chart, Org-chart, Timeline, Word-cloud, Table) zamiast pustego płótna.
- **Generacja sterowana parametrami (Gamma Generate API), kluczowe pola:**
  - `inputText` (1–100k tokenów: od jednej linijki po „messy notes"), `textMode` = `generate | condense | preserve`
  - `format` = `presentation | document | webpage | social`
  - `themeId`, `numCards` (1–60/75), `cardSplit`, `additionalInstructions` (1–2000 zn.)
  - `textOptions` { `amount` (brief→detailed), `tone`, `audience`, `language` (60+ języków, w tym PL) }
  - `imageOptions` { `source`: aiGenerated/web/pictographic/giphy/placeholder/none, `model`, `style` }
  - `cardOptions` { `dimensions`: fluid/aspect, `headerFooter` per-karta }
  - `sharingOptions` { workspaceAccess, externalAccess, emailOptions } · `exportAs`: `pdf | pptx`
  - **Wzorzec async:** POST zwraca `generationId`; GET odpytuje status `pending → completed` + zwraca URL plików.
  → To jest gotowy kontrakt do skopiowania dla naszego endpointu `POST /studio/generations`.
- **Create from Template API (Gamma, beta):** `gammaId` + `prompt` (treść + instrukcje) + `themeId`.
  Adaptuje NOWĄ treść do istniejącego, brandowanego szablonu. → krytyczne dla Consultify:
  „weź nasz szablon raportu DRD i wsadź wyniki tego klienta".

## 4. API / integracje

- **Gamma jest API-first i to nasz wzorzec.** Endpointy: `POST /v1.0/generations`,
  `POST /v1.0/generations/from-template`, `GET /v1.0/generations/{id}` (status + URL),
  `GET /list-themes`, `GET /list-folders`. Auth: `X-API-KEY` (OAuth „coming soon").
  Model rozliczeń: **kredyty** (1–5 kredytów/karta zależnie od modelu tekstu; obrazy 2–125;
  template-based „nieco drożej/kartę"). → `assets/presentations/03-gamma-credits-billing.png`.
  → mapuje się na nasze AI Credits (z pamięci projektu) — ten sam wzorzec kredytowy per-generacja.
- **MCP + connectors (Gamma & Beautiful.ai).** Gamma MCP daje asystentowi (np. Claude) 3 narzędzia:
  *generate content / browse themes / organize to folders*. Beautiful.ai MCP: `create_presentation`
  (OAuth, scopes `openid bai`, PKCE S256). → **wprost potwierdza nasz kierunek: Teresa jako agent
  z narzędziem „wygeneruj deck", nie czat obok edytora.** Wzorzec narzędzia Gamma MCP to nasza
  specyfikacja tool-calla dla Teresy.
- **Automation (Make/Zapier/N8N):** moduły „Generate a Gamma / Get a generation / Make an API call".
  → wzorzec dla integracji Outputs hub z resztą systemu (insight zamknięty → auto-deck).
- **Modele:** Beautiful.ai jawnie: tekst = Gemini + **Claude (Anthropic)** + inne; obrazy = Imagen + DALL·E.
  → potwierdza, że Claude jest produkcyjnie używany do generacji slajdów u konkurencji.

## 5. Decyzje dla Consultify

- ✅ **Kradniemy kontrakt Generate API Gammy 1:1** jako kształt naszego `POST /studio/generations`:
  `inputText/textMode/format/numCards/cardSplit/textOptions/imageOptions/exportAs` + async `generationId` → poll → URL.
- ✅ **Kradniemy Create-from-Template** jako rdzeń Consultify: szablon raportu DRD (brand) + `prompt`
  z danymi klienta → spójny deliverable. To nasza przewaga (grounding w insightach/inicjatywach klienta).
- ✅ **Kradniemy Smart Slides** — typy slajdów z wbudowaną logiką układu zamiast wolnego płótna;
  Teresa wybiera typ + dosypuje treść, layout sam się składa.
- ✅ **Kradniemy Slide-level AI** — menu „Regeneruj treść / Inny układ / Zmień obraz / Uziem plikiem" per-karta.
- ✅ **Kradniemy wzorzec narzędzia Gamma MCP** jako definicję tool-calla Teresy (generate / browse themes / organize).
- ⚠️ **Adaptujemy** model kredytowy Gammy do naszych AI Credits (koszt per-karta/per-obraz, GET zwraca zużycie).
- ⚠️ **Adaptujemy** współpracę Pitch (comments z @mention, co-presenting, smart swap/tidy) — przez naszą
  warstwę realtime (`realtime-collab.md`), nie budujemy od zera.
- ⚠️ **Adaptujemy** eksport PDF/PPTX jako pierwszorzędną funkcję (deliverable musi wyjść z systemu) — łączy się z Outputs hub.
- ❌ **Unikamy** one-shot „prompt → gotowa talia" bez kroków pośrednich — Beautiful.ai świadomie tego nie robi;
  konsultant musi widzieć i poprawić outline przed wygenerowaniem (zachowanie intencji + brak halucynacji w deliverable).
- ❌ **Unikamy** wolnego płótna PowerPoint-style (ręczne pozycjonowanie) jako domyślnego trybu — to antywzorzec wobec Smart Slides.
- ❌ **Unikamy** brandu „per-talia" — motyw/brand musi być obiektem workspace (Team Theme), stosowanym i wersjonowanym centralnie.

## 6. Otwarte pytania / do walidacji

- Generacja: własny silnik (Teresa + nasz renderer kart) vz integracja Gamma API jako backend? (koszt/kredyty vs kontrola brandu i danych klienta — RODO, dane wrażliwe).
- Render/eksport: jakiego rdzenia renderującego używamy do PPTX/PDF? (reuse z Document/Table Studio w EE).
- Smart Slides: budujemy własną bibliotekę typów slajdów z logiką układu — ile typów na v1? (Headline/Text/Chart/Table/Timeline jako MVP).
- Grounding: jak dokładnie Create-from-Template mapuje insighty/inicjatywy/tabele klienta na karty (schemat treści → karta)?
- Współpraca: realtime na talii w v1 czy odłożone? (zależne od `realtime-collab.md`).

## Załączniki
Zrzuty (realne UI Gammy) w `assets/presentations/`:
`01-gamma-template-api-panel.png` (edytor templatu + panel API), `02-gamma-copy-gammaid.png`
(„Copy gammaId for API"), `03-gamma-credits-billing.png` (model kredytowy), `04-gamma-api-tab.png` (zakładka API).
Surowe źródło (do usunięcia po akceptacji): `Softs/0 Prezentacje/{Gamma,Beautiul,Pitch help}.zip`.

Uwagi do źródeł:
- **Gamma** = najbogatsze i jedyne z pełną dokumentacją API/MCP (developers.gamma.app) — deep-dive zrobiony stąd. Realne screeny produktu dostępne.
- **Beautiful.ai** = help center (Zendesk); świetny na koncepty Smart Slides / Slide AI / „Creating with AI" (step-by-step) / What-Powers-AI (Claude+Gemini+Imagen) / MCP. Screeny to obrazki z artykułów (nie wycinałem — głównie ilustracje pomocy).
- **Pitch** = help center (Intercom); dobry na smart formatting (swap/tidy), slide styles → workspace, comments/@mention, co-presenting, analytics. Brak dokumentacji API generacji. Screeny niskiej wartości (ilustracje help) — pominięte.
