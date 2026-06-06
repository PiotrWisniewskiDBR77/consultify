# Formatka odpowiedzi w Interview — analiza + plan redesignu

**Komponent:** `src/components/Interview/InterviewSingleQuestionRuntime.tsx` (2295 linii)
**Data:** 2026-06-05 · zlecenie ownera: „to nie może być takie tandetne… nagrywanie ma się dokładać do istniejącego okna, nie tworzyć kolejnych; chcę dokładać obrazy i załączniki; pod info instrukcja+przykład; ikonka która lekko błyska 'wciśnij mnie'."
**Status:** analiza (NIE implementacja). Owner w międzyczasie podłącza Google.

---

## 1. Jak to działa DZIŚ (teardown z kodu)

### A. Pole odpowiedzi
- `renderedInput` (linia 1776) — textarea/typowane inputy zależnie od `answerType`. Stan: `answerDraft` (196).
- Pod nim toolbar (1778): **Record** (1782) + **AI improve** dropdown (1799, tylko gdy `answerDraft ≥ 3 znaki`).

### B. Nagrywanie głosem — ŹRÓDŁO „tandety" (644–805)
1. `startRecording`: równolegle Web Speech API (live transcript, `pl-PL`/`en-US`) **+** MediaRecorder (blob audio).
2. `recorder.onstop` (702): POST audio → `/voice/stt`, dostaje tekst.
3. **Tu jest problem** (744–760): ustawia `inputMode='voice_answer'`, `setVoiceTranscriptDraft(finalText)`, `setAnswerDraft(finalText)` **i** `voiceTranscriptStatus='draft'`.
   - `setAnswerDraft(finalText)` → **NADPISUJE** to, co user wpisał (nie dokłada).
   - `voiceTranscriptStatus='draft'` → odpala `voiceNeedsApproval` (383) → renderuje **OSOBNE bursztynowe okno** „Sprawdź transkrypcję i zatwierdź" (1946–1998) z drugą textareą zawierającą `voiceTranscriptDraft`.
4. Efekt na ekranie: ten sam tekst w **dwóch** boxach (głównym + review) + krok „Approve/Discard & retry". To jest dokładnie to „pisanie dodatkowych okien", o którym mówił owner.

### C. Trzy stany potranskrypcyjne (osobne bloki renderu)
- `voiceNeedsApproval` → bursztynowe okno approve (1946).
- `inputMode==='voice_answer' && !needsApproval` → niebieski box „Transkrypcja zatwierdzona / Trwa transkrypcja" (2000) — **kolejny** dodatkowy box.
- Czyli głos = do 2 dodatkowych paneli pod odpowiedzią. Wizualnie ciężkie.

### D. Załączniki (2049–2095) — oderwane od odpowiedzi
- Pasek pod sekcją **„Dodatkowy kontekst"** (osobny `<textarea contextDraft>` 2032), niżej guziki: **Plik** (`fileInputRef`, dowolny typ), **Link** (formularz), **Artefakt** (`ArtifactAttachPopover`).
- **Brak:** dedykowanego „Obraz", podglądu miniatur, drag&drop, paste-image. Plik ląduje jako evidence, ale **nie widać go** inline przy odpowiedzi — żadnej listy miniatur/chipów dodanych plików w tej formatce.

### E. „Explain this question" (1712–1772) — schowane
- Zwykły **tekstowy link** „Wyjaśnij to pytanie" (HelpCircle 12px, szary). Klik → `/interview/questions/:id/ai-explain` → zwraca `{explanation, exampleAnswers[], whyItMatters}` i renderuje ładny blok (1744).
- **Problemy:** (a) wygląda jak drobny link, nie zachęca; (b) treść jest **w 100% AI-generowana on-demand** — brak statycznej instrukcji/przykładu zapisanego przy pytaniu w template; (c) zero „przyciągania wzroku" (owner chce lekko pulsującą ikonę „wciśnij mnie").

---

## 2. Diagnoza — dlaczego to „tandetne"

| # | Problem | Przyczyna w kodzie |
|---|---|---|
| P1 | Nagranie tworzy osobne okno zamiast dokładać do odpowiedzi | `voiceTranscriptStatus='draft'` → `voiceNeedsApproval` box (744, 1946) |
| P2 | Nagranie **nadpisuje** wpisany tekst | `setAnswerDraft(finalText)` zamiast insert-at-cursor (746) |
| P3 | Do 2 dodatkowych paneli pod polem (approve + status) | osobne bloki 1946 + 2000 |
| P4 | Załączniki oderwane od odpowiedzi, brak podglądu/miniatur | pasek w sekcji „kontekst", brak render listy evidence (2049) |
| P5 | Brak obrazów inline (paste/drag/preview) | brak handlerów paste/drop; „Plik" generyczny (2052) |
| P6 | „Explain" wygląda jak szary link, nie zachęca | tekstowy button, brak animacji (1714) |
| P7 | Instrukcja do pytania tylko z AI, brak statycznej z template | brak pola `guidance/example` w modelu pytania |

---

## 3. Plan redesignu (propozycja do akceptacji)

### R1 — Dyktowanie DOKŁADA do pola, zero osobnego okna ⭐ (P1+P2+P3)
**Zachowanie docelowe (jak Granola/Otter/Notion AI):**
- W trakcie nagrywania: pole odpowiedzi pokazuje **live interim** szarym kursywą (Web Speech `interimResults=true` — dziś `false`, 659), dopisywane na końcu istniejącego tekstu.
- Po stopie: finalny tekst STT **wstawiany w miejscu kursora** (albo dopisywany z separatorem), `answerDraft = before + finalText + after`. Bez nadpisania.
- **Usuwamy** krok approve jako osobny box. Tekst jest od razu edytowalny w głównym polu (to JEST „review"). Zatwierdzenie = normalny zapis odpowiedzi.
- Audio dalej zapisywane jako evidence (`onAddVoiceEvidence`) — zostaje, tylko bez UI-ceremoniału. Pasek nagrywania = subtelny inline indicator (puls na ikonie mic + „● 0:12"), nie wielki panel.
- **Zmiany:** `recorder.onstop` (744–760) — insert-at-cursor zamiast set+draft+status; wyciąć `voiceNeedsApproval` (383, 1946) i status-box (2000) albo zredukować do mikro-toasta. `interimResults=true` + live append.

### R2 — Jeden „composer" odpowiedzi z załącznikami inline ⭐ (P4+P5)
**Model: jedno pole = tekst + chips/miniatury załączników pod spodem (jak composer w czacie/Slack).**
- Pod textareą: **rząd miniatur** dodanych evidence (obraz → thumbnail, plik → chip z ikoną typu + nazwa + ×, link → favicon+tytuł, artefakt → chip). Dziś tego nie ma — dodać render listy z `linkedItems`/evidence dla danego pytania.
- **Obraz:** osobny przycisk „Obraz" (ImageIcon) + **paste z schowka** (Ctrl/Cmd+V obrazu → upload+miniatura) + **drag&drop** na pole. Reuse `handleUploadFile`.
- Toolbar ujednolicić: `[🎤 Nagraj] [📎 Plik] [🖼 Obraz] [🔗 Link] [◆ Artefakt] [✨ AI]` jako jeden spójny rząd chipów tuż pod polem (nie rozbity między „odpowiedź" a „kontekst").
- Drag&drop + paste to standard, którego ludzie oczekują — największy „pro feel" za małą robotę.

### R3 — Guidance: pulsująca ikona + instrukcja + przykład ⭐ (P6+P7)
- Zamiast szarego linku: **ikona ⓘ/💡 przy tytule pytania**, z subtelnym `animate-pulse`/ring gdy user jeszcze nie odpowiedział i nie rozwinął (owner: „lekko błyska, wciśnij mnie"). Po pierwszym kliknięciu — przestaje pulsować (zapamiętać per-pytanie w localStorage).
- Po rozwinięciu panel z **dwóch źródeł**:
  1. **Statyczna instrukcja z template** (nowe pole `question.guidance` + `question.exampleAnswer` w modelu/templatce) — pisana przez autora ankiety, deterministyczna.
  2. **AI „rozwiń/daj przykład"** (istniejące `ai-explain`) jako uzupełnienie on-demand.
- To realizuje „pod info instrukcja do pytania, ja go rozwinę, i przykład" — i jest kluczowe dla jakości odpowiedzi (ludzie wiedzą JAK odpowiadać).
- **Zmiany backend:** dodać kolumny `guidance`, `example_answer` do pytań w template (lazy-ensure), wystawić w API, wczytać w runtime.

### R4 — Mikro-polish jakości wypełniania (pomysły dodatkowe)
- **Licznik/jakość odpowiedzi:** subtelny hint „za krótko / dobrze" (dziś jest `expectedAnswerShape` 1706 i AI-improve — rozbudować w nienachalny pasek postępu jakości).
- **Auto-save bez ceremoniału:** „Saved" już jest (dół ekranu) — OK, zostaw.
- **Enter=next / Esc=save** już są (widać w stopce) — dobre, utrzymać; dodać `Cmd+Enter`=submit.
- **„Explain" i „AI improve" na jednym modelu** (OpenRouter, już skonfigurowany) — spójność.
- **Tryb dyktowania ciągłego** dla całej ankiety (opcja): mów dalej, system sam przechodzi do następnego pytania po pauzie — to byłby prawdziwy wyróżnik dla wywiadów terenowych.

---

## 4. Kolejność implementacji (gdy owner da zielone światło)
1. **R1** (dyktowanie→inline, kasacja osobnych okien) — największy „odtandetniacz", czysto frontend.
2. **R2** (composer + obraz/paste/drag + miniatury) — frontend + reuse istniejących uploadów.
3. **R3** (guidance: pulsująca ikona + statyczna instrukcja/przykład) — frontend + mała zmiana schematu pytań (backend).
4. **R4** (polish jakości) — iteracyjnie.

**Ryzyka:** R3 dotyka modelu pytań/template (schema + autor template UI). R1 trzeba przetestować na Safari (MediaRecorder=mp4) i gdy brak Web Speech (fallback tylko STT serwerowy — wtedy bez live interim, ale wciąż insert-at-cursor po stopie).

**Nietknięte teraz:** czekam na akceptację kierunku. Nic nie koduję.
