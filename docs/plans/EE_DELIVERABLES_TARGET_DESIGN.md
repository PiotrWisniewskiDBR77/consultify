# EE / Deliverables Module — Stan docelowy i benchmark rynkowy (Faza 2)

> **Data:** 2026-06-02
> **Bazuje na:** [EE_DELIVERABLES_MODULE_ANALYSIS.md](EE_DELIVERABLES_MODULE_ANALYSIS.md) (Faza 1 — stan obecny) + 6 równoległych researchów konkurencji (Gamma, Airtable, Kimi, Genspark, edytory dokumentów, wzorce shell/biblioteka).
> **Cel:** zdefiniować docelowy poziom 4 zakładek z uwspólnioną nawigacją, dorównać liderom i ich pobić w wybranych miejscach. To dokument PROJEKTOWY (przed implementacją).

---

## 0. Naczelna zasada (z całego researchu)

> **"Stałe chrome, zmienny canvas."**
> Notion, Canva, Google Workspace, Microsoft 365, Gamma — wszyscy trzymają menu boczne, pasek górny, command palette, wejście do AI i kontrolki share/wersji w **tej samej pozycji z tymi samymi etykietami** niezależnie od typu dokumentu. Zmienia się tylko środkowa powierzchnia edycji i **jeden** panel kontekstowy. To jest dokładnie to, czego potrzebujesz: użytkownik Prezentacji od razu jest biegły w Dokumentach.

Drugi wniosek przekrojowy (Genspark): **prawdziwym spoiwem nie są zakładki, tylko (a) wspólny prompt/AI oraz (b) wspólna biblioteka, z której każde narzędzie może czytać.** Tab 1 nie jest archiwum — jest substratem, z którego Teresa i wszystkie edytory biorą materiał ("zrób deck z tej tabeli").

---

## 1. Model 4 zakładek

```
┌──────────────────────────────────────────────────────────────────────┐
│  EE — Centrum dokumentów        [⌘K]  [+ Nowy ▾]  [Teresa ◆]          │  ← wspólny pasek górny
├──────────────────────────────────────────────────────────────────────┤
│ [1] Biblioteka  │ [2] Dokument │ [3] Tabela │ [4] Prezentacja         │  ← 4 zakładki
└──────────────────────────────────────────────────────────────────────┘
```

- **Zakładka 1 — Biblioteka deliverables** = jedno przeglądalne, filtrowalne, reużywalne miejsce dla WSZYSTKICH gotowych dokumentów. Dziś istnieje jako `ReportsAndPresentationsHub` na rejestrze artefaktów — ale rozbita w sidebarze i niedopracowana.
- **Zakładki 2–4 — edytory** Dokument / Tabela / Prezentacja, ze **wspólnym shellem** (menu boczne, pasek górny, narzędzia, command palette, skróty).

Wzorce: **Dokument** = Notion/Docs/Word (+ wzorzec chat→artifact z Kimi/Genspark); **Tabela** = Airtable (+ Excel/Sheets); **Prezentacja** = Gamma (+ Genspark/Kimi).

---

## 2. Wspólny shell (zakładki 2–4) — specyfikacja

### Stałe MENU BOCZNE (identyczne w 3 edytorach)
- Zwijany rail: **← Powrót do Biblioteki**, **Ostatnie**, **Ulubione (⭐)**, drzewo **Folderów/Teamspace**.
- **Struktura bieżącego artefaktu** (model page-list z Notion/Coda): nagłówki (Dokument) / zakładki arkuszy (Tabela) / miniatury slajdów (Prezentacja). **Ten sam kontener, ta sama interakcja** drag-to-reorder + hover-`⋯`-ustawienia.
- Hover-to-peek / click-to-pin (Canva).

### Stały PASEK GÓRNY (identyczny układ, lewo→prawo)
1. **Breadcrumb + edytowalny tytuł** (Workspace › Folder › Deliverable), klik w człon = skok (Notion).
2. **Przełącznik trybu:** Edycja / Komentarz / Podgląd (Canva) — + Sugestie tylko dla Dokumentu.
3. **Środek (jedyna zmienna strefa paska):** główne akcje narzędzia — Dokument = formatowanie; Tabela = filtr/sort/widok; Prezentacja = layout/motyw.
4. **Prawy klaster (stały, nigdy się nie rusza):** awatary współpracowników → **Udostępnij** → **Prezentuj** → **Eksport** (wspólny przycisk, różne formaty: Doc→PDF/DOCX, Tabela→XLSX/CSV, Prez→PDF/PPTX) → **Historia wersji** → **Teresa AI** jako **stała ikona ◆ w prawym górnym rogu** otwierająca panel (wzorzec Gemini — ta sama ikona, ten sam róg, w każdym narzędziu).

### Stały PANEL PRAWY (wspólny kontener, wymienna treść)
Jeden panel ~350px (Canva), zakładki na górze: **Teresa (chat AI)** · **Komentarze** · **Właściwości/Inspector** (format zaznaczenia / schemat komórki / ustawienia slajdu) · **Oś wersji**. Kontener nigdy się nie rusza. Model "peek" z Notion do otwierania szczegółów bez utraty kontekstu.

### Uniwersalny COMMAND PALETTE + skróty
- **⌘K** w 3 edytorach: nawigacja (skok do dowolnego deliverable) + akcje (Udostępnij, Eksport, Wstaw, Przełącz narzędzie).
- **`/`** slash-menu w canvasie do wstawiania (Notion/Coda/Gamma).
- **Ujednolicona mapa skrótów** (dyscyplina Google): `⌘/` = ściąga skrótów we wszystkich; identyczne mapowanie Ctrl↔⌘, Alt↔Option; te same skróty Share/Export/Comment/AI.

**Co wspólne vs per-narzędzie (reguła jednej linijki):**
- *Wspólne:* lewy rail, breadcrumb/tytuł, przełącznik trybu, prawy klaster (Share/Present/Export/Version/AI), kontener panelu prawego, command palette, slash-menu, gramatyka skrótów.
- *Per-narzędzie:* środkowy canvas, środkowa grupa akcji paska, pozycje w outline, pozycje w slash-menu, formaty eksportu.

---

## 3. Zakładka 1 — Biblioteka deliverables

Wzorzec: lista decków Gamma + Canva Projects + Google Drive 2025 (chipy).

**Układ (góra→dół):**
1. **Nagłówek:** "Dokumenty" · globalne wyszukiwanie (spięte z ⌘K) · **+ Nowy** (split-button: Dokument / Tabela / Prezentacja / **Z szablonu** / **Generuj z Teresą** — model 4 ścieżek Gammy).
2. **Raile poziome (stałe):** **Ostatnio otwierane** (już masz — M2), **Ulubione (⭐)**, **Szablony** (osobna sekcja, nie zakopana).
3. **Pasek filtr/sort:** **chipy** (Drive 2025) dla **Typ** (Dokument/Tabela/Prezentacja), **Właściciel**, **Data**, **Status** (Szkic/Review/Final/Wysłane), **Tag/Klient**. Liczniki wyników per opcja, widoczny stan aktywnych filtrów, badge liczby. **Sort:** Trafność / Edytowane / Nazwa. **Toggle widoku:** Siatka ↔ Lista.
4. **Karty:** miniatura dla Prezentacji; **ikona-typu + metadane** dla Dokumentów/Tabel (Drive: miniatury tekstu są bezwartościowe). Hover-preview. Metadane: tytuł, badge typu, **badge statusu** (governance), awatar właściciela, edytowane, awatary współpracowników + wskaźnik "Udostępnione".
5. **`•••` na karcie**, pierwsza pozycja **"Duplikuj"**, dalej **"Użyj jako szablon", "Zapisz jako szablon"**, Udostępnij, Przenieś, Zmień nazwę, Usuń.
6. **Akcje masowe:** checkbox multi-select → pływający pasek (Przenieś / Udostępnij / Usuń / Tag / Status).

**Różnicowniki Consultify (czego rynek nie robi dobrze):**
- **Status jako first-class chip** na każdej karcie i facet filtra (Szkic/Internal Review/Client-Ready/Sent) — deliverable konsultingowy tego wymaga.
- **Biblioteka adresowalna przez AI** (lekcja Genspark): każdy deliverable wybieralny jako kontekst dla Teresy ("zrób nową ofertę z tych trzech").

---

## 4. Zakładka 2 — Dokument (Word) | bar: Notion/Docs/Word

**Stan obecny:** ~50–55%, **brak edytora rich-text** (read-only preview), treść = placeholdery, edycja tylko przez diff/proposal. Mocny backend governance + realne renderery DOCX/PDF.

**Minimum (żeby nie wyglądać na zepsute obok Notion/Docs/Word):**
1. Edycja blokowa z **slash-menu `/`** i **uchwytem drag** (reorder + menu akcji bloku).
2. Bloki: H1–H3, paragraf, listy (punkt/numer/checkbox), cytat, kod, callout, toggle, divider, obraz/embed, **kolumny**, **tabela inline**.
3. Formatowanie inline: bold/italic/underline/strike/code, linki, kolor tekstu/tła; **find/replace**.
4. **Komentarze na zaznaczeniu** + wątki + @mention.
5. **Multiplayer real-time:** kursory + presence (Yjs).
6. **Inline AI:** pływający toolbar zaznaczenia + slash-AI (rewrite / skróć / rozwiń / ton / streść / kontynuuj) z **podglądem + accept/reject**.
7. **Auto-outline / floating TOC** z nagłówków.
8. **Historia wersji.**
9. **Wysokiej wierności eksport PDF + DOCX** (już mamy renderery — dopiąć do nowego edytora).
10. **Galeria szablonów** + one-click instancja.

**Gdzie pobijamy rynek:**
- **Tryb sugestii / track-changes (redline)** z czystym accept/reject — #1 sygnał "profesjonalnego review"; Notion tu słaby.
- **Szablony brandowane, ze strukturą zablokowaną** (oferta, SOW, raport z ustaleń).
- **Najlepsza wierność DOCX/PDF** (realna słabość Notion) — już mamy backend.
- **Agentic AI Teresa** edytująca cały dokument / wiele dokumentów.

**Rekomendacja techniczna:** **budować na TipTap** (już używany w DeckBuilderze) — fundament ProseMirror, natywne Yjs (kursory/presence/komentarze), produktowe **TipTap Content AI / AI Toolkit / AI Suggestion** (streaming inline + sugestie). Alternatywa dla gotowych bloków: **BlockNote** (na TipTap). Eksport DOCX/PDF zostaje osobnym pipeline'em renderującym (mamy go).

**Wzorce z Kimi/Genspark (chat→dokument):** edytowalny outline PRZED generacją; AI generuje **realną treść** (nie placeholdery) do **walidowanego szablonu** (nie surowy token-dump); edycja dwutorowa (chat-iteracja + bezpośredni WYSIWYG + selection-scoped AI edit).

---

## 5. Zakładka 3 — Tabela (Excel) | bar: Airtable (+ Excel/Sheets)

**Stan obecny:** ~65%, model klasy Airtable (30+ typów pól, 8 widoków, ~120 endpointów). **ALE** `/tabele` to read-only preview; edytowalny grid żyje osobno w MyWork `IdeaTableTool`. Silnik formuł zabawkowy.

**Minimum (parytet Airtable):**
1. **Model:** bases→tables→fields→records; primary field; **linked record** (mamy).
2. **Katalog pól:** text/long-text(rich)/number/currency/percent/rating/date/email/phone/URL/checkbox/single+multi-select/attachment/barcode/user; systemowe (autonumber, created/modified time+by); **formula, lookup, rollup, count, button**; **pola AI** (mamy większość).
3. **Grid:** edycja inline, pełna nawigacja klawiaturą, kopiuj/wklej zakresu, **fill handle**, grupowanie z wierszami sumarycznymi, zamrożona kolumna primary, wysokości wierszy, **modal rozwinięcia rekordu z komentarzami + historią**. → **Zunifikować na `/tabele` (przenieść edytowalny grid z IdeaTableTool).**
4. **Silnik formuł:** solidna biblioteka per-record (text/logic/number/date) **+** mechanizm relacyjny **lookup/rollup/count** z agregacją warunkową. *(Uwaga architektoniczna: Airtable celowo NIE ma zakresów A1:B2 — cross-record robi przez linked+rollup. Nasz bar to porządne funkcje per-record + rollup, nie tablice Excela.)*
5. **Widoki:** grid, kanban, calendar, gallery, form (min.); **zapis per-widok** filtr/sort/group/hide.
6. **Współpraca:** real-time, komentarze rekordu + @mention, historia, **udostępniany link widoku read-only**, granularne uprawnienia.
7. **Import/eksport/API:** CSV/Excel z **merge/upsert**, czyste **REST API**, webhooks (mamy większość).

**Gdzie pobijamy rynek:**
- **Hybrydowy silnik formuł** — rollupy relacyjne Airtable **+** Excelowe odwołania zakresowe/range + pivot + natywne wykresy. To uderza w najczęstszą skargę na Airtable i przyciąga uchodźców z arkuszy.
- **AI domenowe (Teresa)** zamiast generycznego Omni — prompt-to-table/app świadome konsultingu.
- **Wbudowana analiza/wizualizacja** (pivoty + wykresy natywnie, nie przez Interface).
- **Niższa krzywa uczenia** (start jak arkusz, relacje odsłaniane progresywnie).

**Domknąć:** AI Editor — część poziomów to stuby (live'ować); usunąć zacommitowane markery konfliktu w plikach flag.

---

## 6. Zakładka 4 — Prezentacja | bar: Gamma (+ Genspark/Kimi)

**Stan obecny:** DeckBuilder (`/presentations/builder`) ~70% — **najlepsza część modułu** (realny WYSIWYG, 17 bloków, PPTX/PDF/PNG, present mode, AI Teresa, wersje, kolaboracja). ALE: dwa pipeline'y, osierocony `/presentation-studio`, martwy `PresentationsHub.tsx`, zero testów edytora.

**Minimum (parytet Gamma):**
- **Flow outline-first:** Generuj / Wklej tekst / Importuj plik, z **edytowalnym outline przed generacją** (kluczowy element kontroli) + ustawienia pre-gen (liczba kart, ton, audytorium, długość, język, źródło obrazów, motyw).
- Edytor kart/bloków (Notion-style) ze **Smart Layouts + tekst→diagram**, pełny zestaw bloków (mamy 17).
- **Rozprzężenie treść/motyw** — natychmiastowy restyle całości, custom motywy, **brand kit + import motywu z PPTX** (Gamma wyciąga kolory/fonty/logo z wgranego PPTX).
- AI obrazy multi-model + stock/ikony/animacje; **agent AI z web research + cytowaniami**.
- Real-time collab, uprawnienia, linki z hasłem, foldery, historia wersji (mamy większość).
- Publish-as-webpage + anal, present mode (mamy present mode).

**Gdzie pobijamy rynek (słabości Gammy):**
- **Eksport PPTX/Google Slides natywnie edytowalny** (tekst/kształty/wykresy) — #1 skarga na Gammę (~30% edytowalnego tekstu vs 84–95% u rywali slide-native).
- **Kontrolowalny agent:** edycje scoped, **live diff/preview przed zatwierdzeniem**, niezawodny undo, **"zablokuj kartę/element"** by AI nie ruszało dopieszczonych slajdów. (Gamma robi nieproszone zmiany cross-card, bez diffa.)
- **Realny system animacji/przejść** z wyborem stylów.
- **Głębsza biblioteka:** subfoldery, foldery prywatne, nazwane snapshoty, niedestrukcyjny restore.
- **Agentic Fact Check** (lekcja Genspark) — one-click weryfikacja źródeł claimów na slajdach — różnicownik dla decków klienckich.

**Domknąć:** skonsolidować dwa pipeline'y (wpiąć lub usunąć `/presentation-studio`), usunąć martwy `PresentationsHub.tsx`, dopisać testy FE edytora.

---

## 7. Przekrojowe — AI (Teresa) i flow chat→deliverable

Wzorce do skopiowania (Kimi OK Computer + Genspark Super Agent):
1. **Plan-first, pokaż to-do list.** Rozłóż prompt na widoczną listę kroków PRZED generacją, streamuj odhaczanie. Najczęściej chwalona cecha UX Kimi — czyni czekanie czytelnym.
2. **Persona-per-typ-deliverable, nie jeden mega-prompt.** Routuj intencje Dokument/Tabela/Prezentacja do dedykowanych system-promptów + zestawów narzędzi (architektura realnego Kimi).
3. **Warstwa szablon/skill między LLM a plikiem.** Generuj do **walidowanych** scaffoldów DOCX/XLSX/PPTX zamiast surowego outputu → znacznie lepsza wierność i eksportowalność (dlatego eksporty Kimi są czyste).
4. **Bramka edytowalnego outline przed pełną generacją** (wzorzec Slides) — tanio zmienić, daje poczucie kontroli.
5. **Dwutorowa edycja: chat-iteracja + edycja natywna formatu.** Pełny WYSIWYG gdzie się da, selection-scoped AI edit ("popraw tylko to"), nie zamykaj usera w chacie.
6. **Deliverable-jako-wynik, nie tekst-jako-wynik.** Renderuj artefakt jako główny rezultat + share link + eksport; chat = powierzchnia sterowania.
7. **Wspólny substrat (AI Drive):** każdy deliverable w Bibliotece wybieralny jako wejście dla każdego narzędzia (sheet→deck, pdf→doc). To czyni cross-tool flow realnym.

Unikać błędów konkurencji: trace AI ma być **informatywny** (nie nadmiernie skrócony — błąd Kimi); robust ingest plików; przewidywalny/widoczny koszt (opaque credits = główna skarga na Genspark); UI **czytelne** (zaleta naszych nazwanych zakładek vs agent-first chaos Genspark).

---

## 8. Tabela: gdzie jesteśmy vs cel

| Filar | Teraz | Bar rynkowy | Największa luka |
|---|---|---|---|
| Biblioteka (Tab 1) | hub na rejestrze, rozbity w nav, surowy | Gamma list + Canva Projects + Drive chips | Jeden wpis, chipy filtrów, status, reuse, AI-addressable |
| Dokument | ~50% brak edytora | Notion/Docs/Word | **Edytor rich-text (TipTap) + AI generuje treść** |
| Tabela | ~65% read-only na `/tabele` | Airtable + Excel/Sheets | **Edytowalny grid na `/tabele` + realne formuły** |
| Prezentacja | ~70% (najlepsza) | Gamma | **Konsolidacja pipeline'ów + edytowalny eksport PPTX** |
| Shell/nav | brak uwspólnienia | constant-chrome/variable-canvas | **Wspólny shell 3 edytorów** |

---

## 9. Proponowane fazowanie budowy (Faza 3)

> Kolejność: najpierw **fundament wspólny + rdzeń edycji** (najmniej skończone, najwyższa wartość), potem różnicowniki.

- **F3.0 — Fundament shell:** wspólny komponent shell (lewy rail + pasek górny + panel prawy + ⌘K + mapa skrótów), zaadoptowany przez 3 edytory. Plus uzupełnienie i18n PL.
- **F3.1 — Biblioteka (Tab 1):** przebudowa huba w prawdziwe centrum (chipy filtrów, status, reuse `•••`, raile, akcje masowe, AI-addressable).
- **F3.2 — Dokument rich-text:** edytor TipTap + bloki + slash + inline AI + komentarze + wersje + spięcie z rendererami DOCX/PDF. AI generuje realną treść.
- **F3.3 — Tabela unifikacja:** edytowalny grid na `/tabele` (z IdeaTableTool), wzmocnienie silnika formuł, live'owanie stubów AI Editor.
- **F3.4 — Prezentacja konsolidacja:** jeden pipeline, edytowalny eksport PPTX, testy, fact-check.
- **F3.5 — Różnicowniki:** track-changes (Doc), hybryda formuł/pivot (Tabela), kontrolowalny agent + animacje (Prez), governance/status w całości.

---

## 10. Decyzje dla Piotra (przed Fazą 3)

1. **Edytor dokumentu:** TipTap (spójne z DeckBuilder) — potwierdzić.
2. **Tabela:** unifikować na `/tabele` czy uczynić `IdeaTableTool` kanonicznym i osadzić w EE? (dwie powierzchnie do scalenia).
3. **Prezentacja:** `/presentation-studio` — wpiąć governance w DeckBuilder i usunąć osierocony route, czy zachować jako osobną powierzchnię?
4. **Zakres "centrum":** czy EE ma wchłonąć też KIMI `/wordy` `/prezentacje` i Report Builder, czy zostają osobno?
5. **Priorytet startu:** shell+biblioteka najpierw, czy rdzeń edytora (Dokument) najpierw?
