# Voice & Text-to-Speech Module

> **Document:** VOICE_TTS_MODULE.md  
> **Version:** 1.0  
> **Created:** 2026-02-08  
> **Status:** IMPLEMENTED  
> **Related:** AI_CHAT_SYSTEM_DESIGN.md, DEEP_THINKING_MODULE.md

---

## 1. Przegląd

Moduł Voice & TTS odpowiada za syntezę mowy (Text-to-Speech) w czacie AI. Umożliwia automatyczne czytanie na głos odpowiedzi AI w trakcie ich generowania (streaming) oraz ręczne odtwarzanie wybranych wiadomości.

### Kluczowe funkcjonalności

| Funkcja                     | Opis                                                                           |
| --------------------------- | ------------------------------------------------------------------------------ |
| **Auto-read responses**     | Automatyczne czytanie odpowiedzi AI po włączeniu "Read responses" w ToolsMenu  |
| **Incremental TTS**         | Czytanie zdanie po zdaniu w czasie rzeczywistym (nie czeka na pełną odpowiedź) |
| **6 języków**               | Pełna obsługa PL, EN, DE, AR, JP, ES z automatycznym wyborem najlepszego głosu |
| **Smart Voice Selection**   | Priorytetyzacja głosów premium/naturalnych (np. "Zosia" dla PL)                |
| **Per-message Speak**       | Przycisk "Speak" na każdej wiadomości AI do ręcznego odtworzenia               |
| **Voice Conversation Mode** | Pełna rozmowa głosowa (STT + TTS) z trybem ciągłym                             |

---

## 2. Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
├──────────────────┬──────────────────┬───────────────────────┤
│  UnifiedChatPanel│ AIChatWelcomeView│  ToolsMenu            │
│  (split mode)    │ (full mode)      │  (Read responses      │
│                  │                  │   toggle)              │
│  ┌────────────┐  │  ┌────────────┐  │                       │
│  │ useEffect  │  │  │ useEffect  │  │  aiConfig.textToSpeech│
│  │ incremental│  │  │ incremental│  │  ────────────────────▶│
│  │ TTS        │  │  │ TTS        │  │                       │
│  └─────┬──────┘  │  └─────┬──────┘  │                       │
│        │         │        │         │                       │
│        ▼         │        ▼         │                       │
│  speak(text)     │  speak(text)     │                       │
└────────┬─────────┴────────┬─────────┴───────────────────────┘
         │                  │
         ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                useUniversalVoice Hook                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  speak(text)                                          │   │
│  │  ├─ ttsProvider === 'web'                             │   │
│  │  │  ├─ LANG_TO_BCP47[language]  →  locale             │   │
│  │  │  ├─ pickBestVoice(locale)    →  SpeechSynthesisVoice│  │
│  │  │  ├─ SpeechSynthesisUtterance                       │   │
│  │  │  │  ├─ .lang   = locale                            │   │
│  │  │  │  ├─ .voice  = bestVoice                         │   │
│  │  │  │  ├─ .rate   = ttsSpeed                          │   │
│  │  │  │  └─ .pitch  = 1.05                              │   │
│  │  │  └─ window.speechSynthesis.speak(utterance)        │   │
│  │  │                                                    │   │
│  │  └─ ttsProvider === 'openai'  (fallback – serwer)     │   │
│  │     └─ POST /api/voice/tts                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Mapowanie języków

### 3.1 App Language → BCP-47 Locale

```typescript
const LANG_TO_BCP47: Record<string, string> = {
  pl: 'pl-PL',
  en: 'en-US',
  de: 'de-DE',
  ar: 'ar-SA',
  jp: 'ja-JP', // uwaga: app używa 'jp', BCP-47 to 'ja-JP'
  es: 'es-ES',
};
```

### 3.2 Preferowane głosy (per język)

System automatycznie wybiera najlepszy dostępny głos przeglądarki:

| Język | Preferowane głosy (priorytet malejący)          | Fallback       |
| ----- | ----------------------------------------------- | -------------- |
| PL    | Zosia, Paulina, Google polski                   | Dowolny `pl-*` |
| EN    | Samantha, Karen, Google US English, Alex, Moira | Dowolny `en-*` |
| DE    | Anna, Petra, Google Deutsch, Helena             | Dowolny `de-*` |
| AR    | Maged, Google العربية                           | Dowolny `ar-*` |
| JP    | Kyoko, O-Ren, Google 日本語, Otoya              | Dowolny `ja-*` |
| ES    | Monica, Paulina, Google español, Jorge          | Dowolny `es-*` |

### 3.3 Algorytm wyboru głosu — `pickBestVoice(locale)`

```
1. Szukaj w PREFERRED_VOICES[locale] — case-insensitive partial match
2. Szukaj głosów z "premium"/"enhanced"/"natural"/"neural" w nazwie
3. Dowolny głos z locale match (np. pl-PL)
4. Dowolny głos z language prefix match (np. pl-*)
5. null (browser default)
```

---

## 4. Incremental TTS — Streaming czytanie zdanie po zdaniu

### 4.1 Mechanizm

Zamiast czekać na pełną odpowiedź AI, system czyta odpowiedź w trakcie jej generowania:

```
AI stream: "Sztuczna inteligencja to dziedzina informatyki. Zajmuje się..."
                                                      ↑
                                         Wykryto koniec zdania (.)
                                         → speak("Sztuczna inteligencja to dziedzina informatyki.")
                                         → spokenCharsRef = 51
```

### 4.2 Implementacja (useEffect)

```typescript
// Reset na nowy stream
useEffect(() => {
  if (isStreaming) spokenCharsRef.current = 0;
}, [isStreaming]);

// Monitoruj streaming content
useEffect(() => {
  if (!autoReadEnabled || !isStreaming || !streamedContent) return;

  const text = cleanTextForSpeech(streamedContent);
  if (text.length <= spokenCharsRef.current) return;

  const unspoken = text.slice(spokenCharsRef.current);
  const sentenceEnd = /(?<=[.!?])\s+|(?<=\n)\s*/g;
  const parts = unspoken.split(sentenceEnd).filter(Boolean);

  if (parts.length > 1) {
    const toSpeak = parts.slice(0, -1).join(' ').trim();
    speak(toSpeak);
    spokenCharsRef.current += unspoken.length - parts[parts.length - 1].length;
  }
}, [isStreaming, streamedContent, speak]);
```

### 4.3 Po zakończeniu streamu

```typescript
// handleStreamDone — mówi TYLKO pozostały (niewypowiedziany) tekst
const remaining = cleanTextForSpeech(content).slice(spokenCharsRef.current).trim();
if (remaining) speak(remaining);
spokenCharsRef.current = 0;
```

### 4.4 Text cleaning — `cleanTextForSpeech()`

Przed syntezą mowy tekst jest czyszczony z elementów nieodpowiednich do odczytu:

| Element                      | Akcja          |
| ---------------------------- | -------------- |
| Bloki kodu (` ```...``` `)   | Usuwane        |
| Inline code (`` `...` ``)    | Usuwane        |
| Linki markdown `[text](url)` | Zachowaj tekst |
| Obrazy `![alt](url)`         | Usuwane        |
| Headery `## ...`             | Usuwane `#`    |
| Bold/Italic `**text**`       | Zachowaj tekst |
| Listy `- item`               | Usuwane `-`    |
| URL-e `https://...`          | Usuwane        |
| Emoji                        | Usuwane        |

---

## 5. Konfiguracja użytkownika

### 5.1 ToolsMenu — "Read responses"

- Lokalizacja: Menu narzędzi AI (ikona klucza) przy input czatu
- Stan: `aiConfig.textToSpeech` (Zustand store)
- Wizualne: ikonka głośnika + badge gdy aktywne

### 5.2 Voice Settings submenu

- **Speed**: szybkość czytania (`ttsSpeed`, domyślnie `1.0`)
- Dostępne w submenu "Voice settings" po rozwinięciu ToolsMenu

### 5.3 Stan per-komponent

| Komponent           | Zmienna stanu                | Źródło                                        |
| ------------------- | ---------------------------- | --------------------------------------------- |
| `UnifiedChatPanel`  | `autoReadEnabled` (useState) | Sync z `aiConfig.textToSpeech`                |
| `AIChatWelcomeView` | `ttsEnabled` (computed)      | `voiceModeEnabled \|\| aiConfig.textToSpeech` |

---

## 6. useUniversalVoice Hook — API

### 6.1 Inicjalizacja

```typescript
const { speak, stopSpeaking, state, isSupported } = useUniversalVoice({
  onSendMessage: (msg) => handleSend(msg),
  settings: {
    autoSpeakResponses: true,
    sttProvider: 'whisper',
    ttsProvider: 'web', // 'web' | 'openai' | 'edge'
    language: chatLanguage, // 'pl' | 'en' | 'de' | 'ar' | 'jp' | 'es'
  },
});
```

### 6.2 Metody

| Metoda                | Opis                                                 |
| --------------------- | ---------------------------------------------------- |
| `speak(text: string)` | Wypowiedz tekst. Automatycznie anuluje bieżącą mowę. |
| `stopSpeaking()`      | Zatrzymaj syntezę mowy (`speechSynthesis.cancel()`)  |
| `startListening()`    | Rozpocznij rozpoznawanie mowy (STT)                  |
| `stopListening()`     | Zatrzymaj rozpoznawanie mowy                         |
| `state.isSpeaking`    | Czy aktualnie mówi                                   |
| `state.isListening`   | Czy aktualnie słucha                                 |
| `isSupported`         | Czy przeglądarka obsługuje voice API                 |

### 6.3 TTS Provider: `'web'` vs `'openai'`

| Cecha          | `web`                  | `openai`               |
| -------------- | ---------------------- | ---------------------- |
| Wymaga serwera | Nie                    | Tak (`/api/voice/tts`) |
| Wymaga API key | Nie                    | Tak (`OPENAI_API_KEY`) |
| Jakość         | Dobra (premium voices) | Wysoka (neural)        |
| Opóźnienie     | Minimalne (~50ms)      | 200-500ms (sieć)       |
| Offline        | Tak                    | Nie                    |
| Domyślny       | **Tak**                | Nie                    |

---

## 7. Przycisk "Speak" na wiadomościach

Każda wiadomość AI ma przycisk "Speak" w `MessageActions`:

```typescript
onSpeak={voiceSupported ? (content) => speak(cleanTextForSpeech(content)) : undefined}
```

- Widoczny gdy `voiceSupported === true` (przeglądarka wspiera Web Speech API)
- Czyści tekst przed odtworzeniem
- Nie wymaga włączenia "Read responses"

---

## 8. Obsługa błędów

| Scenariusz                          | Obsługa                                                        |
| ----------------------------------- | -------------------------------------------------------------- |
| Brak głosu dla języka               | Fallback na dowolny głos z prefix match, potem browser default |
| `speechSynthesis.speak()` error     | `onerror` callback → log + state reset                         |
| Serwer TTS niedostępny              | Zmiana na `ttsProvider: 'web'`                                 |
| Głosy nie załadowane (Chrome async) | `voiceschanged` event listener + preload w `useEffect`         |
| Tekst pusty po czyszczeniu          | Wczesny return w `speak()`                                     |
| `speak()` Promise rejection         | `.catch()` w useEffect, console.warn                           |

---

## 9. Pliki źródłowe

| Plik                                          | Rola                                                               |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `src/hooks/useUniversalVoice.ts`              | Główny hook TTS/STT, `speak()`, `pickBestVoice()`, `LANG_TO_BCP47` |
| `src/components/AIChat/UnifiedChatPanel.tsx`  | Incremental TTS (split mode), `autoReadEnabled` state              |
| `src/views/AIChatWelcomeView.tsx`             | Incremental TTS (full mode), `ttsEnabled` computed                 |
| `src/components/AIChat/ToolsMenu.tsx`         | UI toggle "Read responses", voice settings submenu                 |
| `src/components/AIChat/EnhancedChatInput.tsx` | Dictation (STT), language mapping                                  |
| `src/utils/textCleaning.ts`                   | `cleanTextForSpeech()`                                             |
| `server/src/routes/voice.routes.ts`           | Server TTS endpoint (OpenAI), health check                         |

---

## 10. Wymagania przeglądarki

| Przeglądarka  | Web Speech API | Głosy premium                         | Uwagi                |
| ------------- | -------------- | ------------------------------------- | -------------------- |
| Chrome 80+    | ✅             | ✅ (Google voices + system)           | Głosy ładowane async |
| Safari 14+    | ✅             | ✅ (macOS voices: Zosia, Samantha...) | Najlepsza jakość     |
| Firefox 80+   | ✅             | ⚠️ (ograniczone)                      | Mniej głosów         |
| Edge 80+      | ✅             | ✅ (Microsoft voices)                 | Dobre głosy          |
| Mobile Chrome | ✅             | ⚠️                                    | Zależy od systemu    |
| Mobile Safari | ✅             | ✅                                    | iOS voices           |

---

## 11. Znane ograniczenia

1. **Chrome autoplay policy**: `speechSynthesis.speak()` wymaga wcześniejszej interakcji użytkownika na stronie (kliknięcie/klawisz). W praktyce nie jest problemem — użytkownik najpierw pisze wiadomość.

2. **Chrome ~15s limit**: Chrome może wstrzymać długie wypowiedzi. Incremental TTS (zdanie po zdaniu) naturalnie omija ten limit.

3. **Jakość głosów zależy od systemu**: na macOS dostępne są premium voices (Zosia, Samantha), na Linux mogą być tylko głosy espeak (niższa jakość).

4. **RTL (Arabic)**: Web Speech API obsługuje arabski, ale jakość i dostępność głosów jest ograniczona.
