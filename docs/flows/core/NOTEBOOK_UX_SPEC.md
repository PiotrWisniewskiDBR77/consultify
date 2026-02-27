# Living Notebook — Spec UX i formuła tworzenia notatek

> **Status:** PROTO TYP  
> **Data:** 2026-02-24  
> **Cel:** Wypracować elegancką formułę tworzenia i wykorzystywania notatek — najlepszy notatnik kontekstowy.

---

## 1. Obecny stan (co mamy)

- **NotebookToolbar** — formatowanie (bold, headings, listy, callout, toggle, tabela)
- **Slash menu** (`/`) — szybkie wstawianie bloków + AI (ask, expand, challenge, action)
- **AIInlineResponse** — odpowiedzi AI z opcją wstawienia do notatki
- **Convert bar** (Ready for action) — Initiative / Task / Decision + Checklist→Tasks, AI Extract
- **Panele boczne:** Linked Ideas, Knowledge Pulse, AI Topics, Action Items
- **Callout purple** — standard dla treści AI (oznaczenie „AI komentarz”)

---

## 2. Nowe elementy (prototyp)

### 2.1 Pole poleceń AI (AI Command Prompt)

**Lokalizacja:** Nad edytorem, w jednym rzędzie z toolbar (lub tuż pod nim).

**Zachowanie:**
- Pole tekstowe z placeholderem: *„np. dopisz plan w 5 krokach jak wdrożyć…”*
- Po Enter / przycisk „Wykonaj” → AI otrzymuje:
  - polecenie użytkownika
  - kontekst: tytuł notatki, treść, tagi
- AI generuje tekst → wstawia do notatki jako **callout purple** (oznaczenie AI)
- Skrót: `Cmd+Shift+A` otwiera focus na polu

**Przykłady poleceń:**
- „dopisz plan w 5 krokach jak wdrożyć X”
- „podsumuj ryzyka w 3 punktach”
- „rozwiń ten akapit o przykłady”

---

### 2.2 Okno AI Chat (stream of thought)

**Lokalizacja:** Panel boczny (analogicznie do Linked Ideas / AI Topics), toggle w headerze.

**Zachowanie:**
- Okno czatu z historią wiadomości
- Użytkownik pisze swobodnie (strumień myśli)
- AI odpowiada i może zaproponować **„Wstaw do notatki”** — wtedy tekst trafia jako callout purple
- Kontekst: tytuł + treść notatki + tagi
- Ikona: `MessageSquare` lub `Sparkles`

---

### 2.3 Menu Wstaw (Insert Menu)

**Lokalizacja:** Przycisk „+ Wstaw” w toolbarze notatki (obok formatowania).

**Zawartość dropdownu:**
- **Bloki:** Callout, Toggle, Tabela, Separator, Lista punktowana, Checklista
- **AI:** Polecenie AI (otwiera pole 2.1), Czat AI (otwiera panel 2.2)
- **Szybkie:** Nagłówek 1/2/3, Kod

**Alternatywa:** Floating buttons (jak na screenshocie) — pionowy stos ikon po prawej stronie edytora.

---

### 2.4 Sterowanie konwersją (dobrobienie)

**Obecne:** Przyciski Initiative / Task / Decision w pasku „Ready for action”.

**Dobrobienie:**
- Modal konwersji z opcją edycji tytułu i opisu przed utworzeniem
- Link do utworzonego elementu w notatce (callout z odnośnikiem)
- Toast z linkiem „Otwórz [Task/Decision/Initiative]”

---

## 3. Architektura komponentów

```
NotebookContent
├── NotebookToolbar (+ InsertMenu dropdown)
├── AICommandPrompt (pole nad/below toolbar)
├── Convert bar (Ready for action)
├── Editor (TipTap)
├── SlashMenu
├── AIInlineResponse (dla /ask, /expand, etc.)
├── Panele boczne:
│   ├── Linked Ideas
│   ├── Knowledge Pulse
│   ├── AI Topics
│   ├── Action Items
│   └── AIChatInlinePanel (NOWY)
```

---

## 4. Zasady DBR77

- **Monochromatic chrome** — jedyny kolorowy CTA: pole AI / przycisk Wstaw
- **Callout purple** — wszystkie wstawki AI
- **Invisible borders** — separacja przez tło/spacing
- **i18n** — PL + EN

---

## 5. Kolejność implementacji (prototyp)

1. **AICommandPrompt** — pole + obsługa custom commands
2. **AIChatInlinePanel** — panel czatu z opcją wstawienia
3. **InsertMenu** — dropdown w toolbarze
4. **Dobrobienie konwersji** — modal z edycją przed utworzeniem
