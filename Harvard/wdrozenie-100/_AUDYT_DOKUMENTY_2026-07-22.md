# AUDYT — grupa DOKUMENTY (Prezentacja · Word · Excel/Sheet)
**Data:** 2026-07-22 · **Baza:** świeży `origin/demo` (HEAD `fe5c86d279`) · **Metoda:** runtime, nie docy — każde znalezisko z dowodem plik:linia.

> ## WYKONANIE (2026-07-22, gałąź `fix/deck-teresa-brief`, 5 commitów, NIC nie pushowane)
> Metoda oczekiwanie-vs-wynik, każda naprawa z testem/harnessem. Kolejność wg kosztu dla klienta.
> | # | Commit | Naprawa | Weryfikacja |
> |---|---|---|---|
> | Deck#1 | `e76af0f8c6` | brief z prośby zamiast hardkodu internal/inform + tytuł; register→executive | ✅ wykonany kod before/after + 18 testów |
> | Word | `7c330f57d3` | audience z czatu do promptu dokumentu (kabel gotowy) | ✅ realny szablon prompt + 3 testy |
> | Word | `4e9564cecd` | domyślnie generuj treść (useLlm ON) + uczciwa etykieta | ⏳ akcept wizualny intake |
> | Sheet | `e59c3f19bf` | odsłoń silnik formuł pod /excele za flagą (default OFF) | ⏳ akcept wizualny ekranu |
> | Deck#2 | `5bf421d945` | brief→Narrative Engine (user_instruction), poszerz bramkę arc; anty-fabrykacja strukturalna | ✅ dyskryminator+bramka 6 testów; ⏳ jakość treści na żywym LLM |
>
> **Do domknięcia (poza offline):** (a) jakość treści decka #2 na środowisku z LLM; (b) wizualny akcept intake Word i ekranu Excel (dev-render stanów). Nic nie idzie na demo bez akceptu Piotra. Nowe moduły: `server/src/services/ai/deckChatBrief.ts`, `src/utils/exceleFlag.ts`.
>
> ---

> Weryfikacja: 3 audytorów runtime (per narzędzie) + własny trop `audience→prompt`, znaleziska sprawdzone adwersaryjnie. Zero live-klik na bazie demo (osobny harness w Fazie 3). Wnioski o „generycznej treści" to wnioski z przepływu danych w kodzie, nie z obejrzanego outputu.

---

## WERDYKT (jedno zdanie)

**Nie „kaszanka" wyglądu — kaszanka jest w tym, że wejście przez czat (Teresa), czyli cała obietnica „AI-native", jest we wszystkich trzech narzędziach tekturową atrapą prawdziwych silników: odrzuca to, o co user prosił (intent + odbiorca), omija gotową, dobrą maszynerię i produkuje generyczny/nieugruntowany/okrojony artefakt — a bogaty silnik siedzi podłączony do INNEGO wejścia (kreator/formularz), do którego produkt czatowy nikogo nie prowadzi.**

---

## TABELA 3 narzędzia × 3 warstwy

| | **SILNIK** | **TERESA (z czatu)** | **KOLABORACJA** |
|---|---|---|---|
| **Word** | ⚠️ Manual domyślnie robi PUSTY szkielet („This section is awaiting content"), bo `useLlm` = false, a checkbox to ukrywa | 🔴 Teresa NIE zna odbiorcy — narzędzie nie ma pola `audience`; downstream gotowy, kabel niepodłączony → fallback „internal stakeholders" | ✅ Komentarze realne (pełny cykl) · 🔴 „presence" to statyczna etykieta, nie realtime; brak historii wersji z diffami |
| **Deck** | ✅ Persist/reload/PPTX realne · ⚠️ 4 z 5 bramek jakości to martwy kod dla realnego Decka (tylko premium-bundle, flaga OFF, fail-soft) · obrazy na cudzym CDN | 🔴 Odrzucony NIE tylko odbiorca (hardkod `internal/inform`) — odrzucony CAŁY `intent`; `sourceArtifacts:[]` → generyczny domyślny konspekt oderwany od prośby | ✅ Komentarze/wersje/WS realne · 🔴 UI presence martwe w domyślnym widoku (MELS) — pokazuje się tylko w porzuconym legacy |
| **Excel/Sheet** | 🔴 Najlepszy silnik (formuły + quality-gate + ExcelJS) OSIEROCONY z UI — `/excele` to redirect na `/tabele`, ekran nie montowany | 🔴 „Stwórz arkusz" robi tabelkę Markdown (max 10×15), nie arkusz z formułami; eksport .xlsx domyślnie = płaski zrzut wartości | ⚠️ Arkusz sam nigdy nie jest współedytowalny — trzeba ręcznie „Send to Table Studio" (przepisanie na inny byt) |

Legenda: ✅ działa · ⚠️ działa warunkowo / mylące · 🔴 defekt bolesny dla klienta.

---

## ★ CO BOLI NAJBARDZIEJ (wg kosztu dla klienta)

1. **[Sheet] Najlepszy silnik arkuszy jest nieosiągalny z produktu.** Realny 5-fazowy pipeline z formułami, quality-gate (818 linii realnych czeków) i ExcelJS żyje w backendzie (`Gateway.ts:474`), ale jego jedyny ekran (`ExceleView.tsx`) nie jest nigdzie zamontowany — trasa `/excele` to czysty redirect na `/tabele` (`AppRoutes.tsx:1440`). Klient nigdy tego nie zobaczy, choć kod działa.

2. **[Deck] Prezentacja z czatu powstaje „w ciemno".** `intent` (to, co user napisał) jest odrzucany — `generateOutline()` dostaje `setup`, nie intent (`deliverablesGenerationService.ts:190`, intent tylko logowany w :205); `audience/goal/theme` zahardkodowane (`generateDeliverable.ts:592-600`) i nawet nieobecne w schemacie narzędzia (`mcpServer.ts:141-165`); `sourceArtifacts:[]` → pusty ContextPack → generyczny domyślny łuk problem→approach→findings→… (`presentationGeneratorService.ts:326`). Cała maszyneria audience/goal-aware DZIAŁA — ale tylko z Kreatora (`wizard/SetupStep.tsx:227`), nie z czatu.

3. **[Word] Teresa nie wie, dla kogo pisze — a mechanizm naprawy już istnieje.** Narzędzie `generate_deliverable` nie ma pola `audience` (`mcpServer.ts:141-166`), setup doc = `{intent,title,language,conversationId}` (`generateDeliverable.ts:603`). Downstream jest gotowy: `docGenerationRuntime.ts:395/515` → `documentBlockProseGenerator.ts:162` realnie wstawia „written for the audience: …" do promptu. To niepodłączony kabel, nie fantom — pole zbierane i używane, ale WYŁĄCZNIE w formularzu manualnym (`DocumentStudioIntakeForm.tsx:179`), nigdy w czacie.

4. **[Word] Manualny dokument domyślnie wychodzi PUSTY.** `useLlm` domyślnie `false` (`DocumentStudioIntakeForm.tsx:143`), a ten jeden przełącznik bramkuje CAŁĄ generację treści (`documentStudioService.ts:657`), nie tylko „kolejność sekcji", jak mówi etykieta „Refine outline with AI (optional)". Trasa `/generate` nie ma bramki anty-placeholder → dokument ze stubami „awaiting content" zapisuje się jako sukces. User nie ma sygnału, że dokument jest pusty, póki go nie otworzy.

5. **[Deck] Bramki jakości McKinsey-style nie dotykają realnego outputu.** `deckDesignCritic` / `deckAntiPatternDetector` / `deckLayoutBeautyGate` / `bundleDeckQa` są importowane tylko przez premium-bundle (`ENABLE_DELIVERABLES_PREMIUM` = false) i nawet tam są fail-soft (nic nie blokują). Zwykły Deck przechodzi tylko lekki skan placeholderów.

---

## UI/UX kontra TREŚĆ — która noga słabsza

**Zdecydowanie słabsza noga to TREŚĆ / silnik-z-czatu, nie UI.** Powłoki działają, komentarze/wersje/autosave są realne. Zgnilizna jest głębiej: potok treści z czatu jest wydrążony — dobre silniki (audience-aware prompt, engine narracyjny Decka, silnik formuł arkusza, bramki jakości) istnieją i są dobre, ale front-door (czat) to ich kartonowa replika. To dlatego „wygląda, a jest kaszanką": UI obiecuje, treść nie dowozi.

Wspólny wzorzec (wszystkie 3): **bogata maszyneria podłączona do wejścia manualnego (Kreator/Formularz), a wejście czatowe — sztandarowe dla produktu AI-native — omija ją hardkodem lub pominięciem.**

---

## ★ JAK PISAŁBY SENIOR PARTNER BCG vs CO PRODUKUJE NARZĘDZIE

Scenariusz realny: user pisze do Teresy *„zrób prezentację dla zarządu z wyników pilota automatyzacji faktur"*.

**CO REALNIE ROBI NARZĘDZIE (z kodu):** `audience`→wyrzucony (hardkod `internal`), `goal`→`inform`, `intent`→odrzucony (tylko tytuł przeżywa), źródła→puste. Deck spada na domyślny szkielet (`generateDefaultOutline`): *Problem → Podejście → Ustalenia → Rekomendacje → Mapa drogowa → Ryzyka* — sekcje wypełnione generycznie, bez zakotwiczenia w rozmowie. Pierwszy slajd exec-summary brzmi mniej więcej: *„Niniejsza prezentacja przedstawia analizę pilota automatyzacji faktur oraz podejście do dalszych działań. W kolejnych sekcjach omówiono ustalenia i rekomendacje."* — czyli powtórzenie tematu, zero konkluzji, zero liczby.

**JAK NAPISAŁBY TO PARTNER BCG (answer-first, piramida Minto):** *„Pilot zwrócił się w 4 miesiące — rekomendujemy skalowanie na 3 kolejne procesy w Q3. Decyzja dla zarządu: uwolnić 480 tys. PLN capex teraz, żeby złapać 2,1 mln PLN rocznych oszczędności od 2027. Ryzyko główne: integracja z ERP (mitigacja: faza pilotażowa 6 tyg. przed skalowaniem)."* (liczby ilustracyjne — u partnera każda ma mostek do źródła).

Luka nie jest w formatowaniu slajdu. Jest w tym, że narzędzie **nie wie, że to decyzja zarządu o pieniądzach**, więc pisze broszurę, nie rekomendację. Cała różnica siedzi w `audience` i `intent`, które ścieżka czatu wyrzuca — mimo że engine narracyjny (`presentationGeneratorService.ts:1498`, `communication_register: executive`) umie napisać tę drugą wersję, gdy dostanie sygnał z Kreatora.

---

## DO DECYZJI PIOTRA

- **P-1. Sheet: reanimować silnik czy pogodzić się ze split-brain?** Czy `/excele` → prawdziwy `ExceleView` (silnik z formułami), czy świadomie zostawiamy „Sheet = generator, edytujesz w Tabeli"? Dziś jest najgorszy wariant: dobry silnik ukryty, a user dostaje tabelkę Markdown.
- **P-2. Czat vs Kreator — jedna jakość czy dwie klasy?** Czy ścieżka czatu ma dostać te same pola (audience/goal/intent→źródła) co Kreator, czy czat zostaje „szybki szkic", a jakość jest tylko w Kreatorze? To decyzja produktowa o obietnicy „napisz do Teresy i masz deliverable".
- **P-3. Word: domyślnie z AI czy bez?** Czy `useLlm` ma być domyślnie ON (dokument od razu z treścią), czy zostaje opt-in — i wtedy poprawiamy przynajmniej mylącą etykietę + dodajemy sygnał „to jest pusty szkielet".
- **P-4. Bramki jakości Decka** — włączyć design/anti-pattern/beauty na realnym Decku (dziś martwe), czy uznać strukturalny gate za wystarczający na demo?
- **P-5. Presence** (Deck i Word) — dokończyć realtime (Deck: WS działa, brakuje UI w MELS) czy zdjąć obietnicę „presence" z etykiet?

---

## CZEGO NIE ZWERYFIKOWANO (uczciwie)

- **Żywy stan flag na Railway/demo** (`ENABLE_DELIVERABLES_PREMIUM`, `_DOC_STREAMING`, `_LIGHT`) — kod pokazuje tylko domyślne wartości. To zmienia, która ścieżka jest realnie żywa na demo.
- **Realny output** — nie odpalono generacji na żywej bazie; wnioski o „generyczności" to analiza przepływu, nie obejrzany slajd/dokument. To zadanie na harness w Fazie 3.
- **Wierność eksportu** DOCX/PPTX/XLSX wizualnie (czy tabele/obrazy/formuły przeżywają) — czytany kod ścieżki, nie zainspekowany plik.
- **Podwójna rejestracja artefaktu Sheet** (`originRuntime: 'sheet'` vs `'native_artifact'`, `generateDeliverable.ts:670` vs `docGenerationRuntime.ts:1076`) — realne ryzyko duplikatu karty; nie doczytano, czy jest mechanizm deduplikacji.
- **Trwałość URL-i obrazów** Unsplash/Pexels w Decku (zależność zewnętrzna) i finalne źródło URL (martwy `deckImageResolverService` vs `presentationVisualDirectorService`).
