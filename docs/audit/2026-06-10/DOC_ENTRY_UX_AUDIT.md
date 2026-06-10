# Audyt wejścia do Dokumentów — live walkthrough vs Kimi/Gamma (2026-06-10)

> **Metoda:** przeklikane na żywo (dev local @332cf6a06e, staging DB, konto demo-org ADMIN,
> viewport 1600×900 + 800px). Każda ścieżka wejścia do „zrób dokument" zmierzona:
> liczba ekranów/pól do **pierwszej realnej treści**. Wzorzec: `docs/benchmarks/chat-and-ai.md` (Kimi)
> i `docs/benchmarks/presentations.md` (Gamma). Kontrast wewnętrzny: świeży deck-flow L1
> (`feat/deliverables-light`, ten sam dzień).
>
> **Werdykt: wejście do dokumentów NIE spełnia standardu. Strukturalnie, nie kosmetycznie.**
> Dokument na końcu ścieżki **nie powstaje** (placeholdery), a jedyna lekka ścieżka jest ukryta i martwa.

---

## 1. Zmierzone ścieżki (4)

### Ścieżka A — czat: „Napisz raport o stanie transformacji…" → redirect do `/wordy`
| Krok | Co się dzieje | Problem |
|---|---|---|
| 1 | Wiadomość w czacie | — |
| 2 | Twarda nawigacja do Document Studio | **Kontekst ginie** — `setChatKickoffMessage` nie zasila formularza; pole Description jest PUSTE |
| 3 | Zimny formularz: **8 pól** (template, Description*, Title, Type, Language, Density, Goal, Audience) + checkbox „Refine outline with AI" | Użytkownik musi **przepisać od nowa** to, co już napisał w czacie |
| 4 | „Plan document" → outline 5 sekcji | Outline wygląda dobrze (typ/registr/styl wykryte), ale karty **read-only** — brak edycji tytułu, toggle, reorder (Gamma ma pełną edycję) |
| 5 | „Generate document" → podgląd | **DOKUMENT TO PLACEHOLDERY** — patrz §2 |

**Do pierwszej treści: nigdy.** 4 ekrany, 2× wpisany ten sam prompt, wynik pusty.

### Ścieżka B — chip „Documents" przy inpucie czatu
Jawny wybór narzędzia → ta sama twarda nawigacja do `/wordy` → identycznie jak A (od kroku 3).

### Ścieżka C — Document Studio bezpośrednio (sidebar)
Jak A od kroku 3. Dodatkowe obserwacje na podglądzie po generacji:
- toolbar governance **nad pustym dokumentem**: QA ●, „Override allowed ●", Share, AI Editor, Export DOCX — ceremonia przed wartością;
- CTA **„Open in Sheets Builder"** na podglądzie *dokumentu* (zły target, dezorientuje);
- bug wizualny: breadcrumb nachodzi na „History" („Documen🕓Hustory");
- prawa szyna ~12 ikon bez etykiet.

### Ścieżka D — Canvas split-view (ukryta lekka ścieżka)
Wymaga **magicznego słowa** („otwórz canvas…"). Po otwarciu:
- ✅ **Kształt jest właściwy** (= Kimi): czat lewo ↔ dokument prawo, TipTap, czysty editor.
- ❌ Dokument to **statyczny boilerplate** („Company Work Note", „Write the situation…") — intencja
  użytkownika („dokument o strategii rozwoju") **zignorowana w treści**.
- ❌ „Napisz w dokumencie sekcję o celach…" → **cichy no-op**: wiadomość znika z czatu, dokument
  bez zmian, zero komunikatu. (Detektor `canvasStreamIntentDetector` matchuje — strumień nie
  dociera do edytora albo ginie po drodze; do debugu osobno.)
- ❌ Komunikaty AI interceptów idą przez `addChatMessage` (appStore), a czat renderuje
  `ConversationStore.activeMessages` — **wszystkie są niewidoczne**. Ten sam root-cause, który
  naprawiliśmy dziś dla checklisty decka (332cf6a06e); dotyczy też canvas/doc/tabel interceptów.
- ❌ Bug renderu: literalne `&gt;` zamiast cytatu w sekcji Notes.

---

## 2. Najcięższe odkrycie: dokument NIE powstaje (by design)

Wynik „Generate document" przy braku podpiętych źródeł:

> „Substantive content for "Context". **MVP-1 ships this as a structured placeholder; MVP-1
> finalization replaces it** with AI-generated narrative grounded in the source pack."
> — *każda sekcja, badge „ASSUMPTION — NEEDS SOURCE", 0 sources · 6 assumptions*

1. **Wewnętrzny żargon deweloperski (MVP-1) wycieka do użytkownika końcowego.**
2. Doktryna „deterministic, no hallucination, sources required" doprowadzona do absurdu:
   bez źródeł silnik produkuje **rusztowanie zamiast treści**. Kimi/Gamma generują użyteczną
   treść z samego prompta + kontekstu organizacji, a braki oznaczają **inline**, nie zamiast treści.
3. To wprost wyjaśnia obserwację ownera: *„dokumenty później nie powstawały"* — bo literalnie
   nie powstają; „MVP-1 finalization" nigdy nie zostało dokończone.

---

## 3. Porównanie z benchmarkiem

| Kryterium | Kimi (czat) | Gamma (deck) | Consultify Doc dziś | Consultify Deck L1 (dziś zbudowany) |
|---|---|---|---|---|
| Kroki do pierwszej treści | 1 (prompt) | 2 (prompt → outline → karty) | **nigdy** (placeholder) | 1 (prompt → checklista → żywe karty) |
| Formularz przed wartością | brak | brak (opcje przy outline) | **8 pól + checkbox** | brak |
| Kontekst czatu przenoszony | tak | tak | **nie** (2× ten sam prompt) | tak |
| Widoczny plan/postęp | checklista | outline edytowalny + progress | spinner → placeholder | checklista w czacie |
| Artefakt rośnie na oczach | tak | tak | nie | tak (self-poll panelu) |
| Wynik = artefakt, nie tekst | tak | tak | „artefakt"-wydmuszka | tak |

Wniosek z kontrastu wewnętrznego: **wzorzec już mamy zaimplementowany** — deck-flow L1 spełnia
standard Kimi end-to-end. Dokumenty potrzebują tego samego plastra (faza **L2** z
`docs/plans/DELIVERABLES_LIGHT_TARGET.md` §8), nie poprawek w obecnym formularzu.

---

## 4. Co naprawić w L2 (kolejność wg bólu)

1. **Treść zamiast rusztowania** — gałąź `doc` w `deliverablesGenerationService`: generacja realnej
   prozy z prompta + kontekstu org; braki źródeł znakowane inline (badge przy akapicie), nigdy
   placeholder-zamiast-treści. Usunąć tekst „MVP-1…" z outputu użytkownika niezależnie od reszty.
2. **Czat = wejście** — intercept dokumentowy (za flagą, wzorzec deck-flow): plan → generate → poll,
   artefakt w prawym panelu (starter `'document'` na żywym artefakcie, nie boilerplate),
   checklista w czacie. Koniec z redirectem do `/wordy` i przepisywaniem prompta.
3. **Naprawić niewidoczne komunikaty interceptów** — wszystkie `addChatMessage` w interceptach
   UnifiedChatPanel → ConversationStore (wzorzec z 332cf6a06e).
4. **Canvas streaming** — zdebugować cichy no-op `canvas-stream-request` (obietnica split-view
   bez treści jest gorsza niż brak split-view).
5. Outline edytowalny inline (tytuł/toggle/reorder) — bramka kontroli jak w Gamma i jak w kontrakcie
   (`StartGenerationRequest.plan` już to przyjmuje — UI brakuje).
6. Sprzątnięcie chrome: governance toolbar dopiero gdy jest treść; usunąć „Open in Sheets Builder"
   z podglądu dokumentu; naprawić `&gt;` i overlap breadcrumba.

**Czego NIE robić:** nie poprawiać formularza 8 pól (lepszy formularz to nadal formularz —
anti-scope §5 planu). Opcje (język/gęstość/audience) → ustawienia przy outline, po wartości.

---

*Dowody: screenshoty w transkrypcie sesji 2026-06-10 (formularz /wordy, outline, placeholder-dokument,
canvas-boilerplate, split-view). Run: dev local, branch `feat/deliverables-light`.*
