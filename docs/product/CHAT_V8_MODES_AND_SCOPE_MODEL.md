# Chat v8 - Modes and scope model

> Status: Draft v8
> Cel: Zdefiniowac kanoniczny model trybow, source scope, model selection i persona behavior dla `Chat v8`.

---

## 1. Po co istnieje ten dokument

Chat liderow rynku nie polega tylko na jednym textboxie.
Uzytkownik musi rozumiec:
- co model robi inaczej,
- z jakich zrodel korzysta,
- jak bardzo odpowiedz ma byc research-heavy,
- kiedy prywatnosc lub personalizacja jest ograniczona.

Ten dokument zamyka te semantyki.

---

## 2. Nadrzedna zasada

Kazdy mode albo scope toggle musi odpowiadac na jedno z dwoch pytan:
- `jak AI ma pracowac?`
- `z czego AI ma korzystac?`

Jesli toggle nie daje jednoznacznej odpowiedzi na zadne z nich, nie powinien byc traktowany jako canonical.

---

## 3. Mode taxonomy

### 3.1 Work-style modes

To tryby zmieniajace sposob pracy AI:
- `deepResearch`
- `showReasoning`
- `multiAgent`
- `coThinkerMode`
- `marketResearch`

### 3.2 Scope and source modes

To tryby zmieniajace zakres zrodel:
- `workspace context`
- `conversation history`
- `attachments`
- `webSearch`
- `organizational memory`

### 3.3 Privacy and personalization modes

- `privateMode`
- `custom instructions`

These connect directly to:
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_AI_GOVERNANCE.md`

### 3.4 Output behavior modes

- `textToSpeech`
- `responseStyle`
- `selectedTier`
- `selectedModelId`

---

## 4. Canonical mode semantics

### 4.1 `deepResearch`

Znaczenie:
- advanced path,
- confirm gate before deeper run,
- slower, more structured, more reviewable output.

### 4.2 `showReasoning`

Znaczenie:
- system moze ujawnic wiecej procesu i intermediate logic tam, gdzie runtime to wspiera.

### 4.3 `multiAgent`

Znaczenie:
- odpowiedz moze byc zlozona z wielu perspektyw / decision-room style reasoning,
- nie jest to ten sam path co zwykly fast answer.

### 4.4 `coThinkerMode`

Znaczenie:
- persona config dla sposobu myslenia AI,
- behavior musi byc opisany uczciwie jako config-backed, nie jako gwarantowany osobny agent, jesli runtime tego nie dowodzi.

### 4.5 `marketResearch`

Znaczenie:
- specjalizacja research-oriented,
- moze laczyc sie z web behavior,
- nie moze byc mylona z generic co-thinker semantics.

### 4.6 `privateMode`

Znaczenie:
- ograniczenie memory/personalization injection,
- user rozumie, ze to nie jest zwykly chat state.

### 4.7 `textToSpeech`

Znaczenie:
- output behavior toggle,
- nie zmienia merytorycznej tresci odpowiedzi, tylko sposob delivery.

### 4.8 Prompt-composition implication

Kazdy mode powinien miec jawny wplyw na prompt composition:
- czy zmienia base instructions,
- czy dopina runtime modifier,
- czy zmienia retrieval behavior,
- czy zmienia output expectations,
- czy tylko steruje UI/runtime behavior bez zmiany promptu.

Ten mapping jest normatywnie opisany w:
- `CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`

---

## 5. Scope model

### 5.1 Canonical source scope

Chat v8 musi jawnie rozumiec:
- `all/general`
- `workspace`
- `attachments`
- `web/research`
- `private/no-memory`

### 5.2 Scope rule

Jesli user nie moze latwo rozumiec aktualnego scope, system nie spelnia `v8` quality bar.

### 5.3 Current truth note

Obecny runtime ma mieszane state paths dla `focusMode` i source visibility.
`v8` ustawia target contract niezaleznie od obecnych luk UI.

---

## 6. Model selection contract

User-facing model selection powinno znaczyc:
- jaki model lub tier zostanie uzyty,
- czy to zmienia koszt, latency lub capability,
- czy zmiana jest per-message, per-conversation czy global preference.

Jesli to nie jest jeszcze w pelni domkniete w produkcie, docs musza opisywac current truth, nie aspiracje.

---

## 7. Custom instructions contract

Custom instructions to nie luźny notatnik.
To controlled personalization layer.

Rules:
- user powinien rozumiec, ze instructions moga wplywac na przyszle odpowiedzi,
- private mode moze ograniczac ten influence,
- instructions nie moga ukrywac mocniejszych governance rules.

---

## 8. UI requirements

`Chat v8` powinien spelniac:
- toggles grouped logicznie,
- scope visible enough for trust,
- advanced modes nie mieszaja sie z basic ask path,
- shell nie ukrywa kluczowych mode semantics,
- leader-grade clarity beats toggle overload.

---

## 9. Anti-patterns

- focus/scope exists in data, but not in user-visible product,
- toggle changes backend behavior, but user does not know how,
- persona implies stronger runtime than system really delivers,
- private mode sounds strong but has vague semantics,
- model selection exists without clear scope of effect.

---

## 10. Definition of done

Modes and scope model jest domkniety, gdy:
- kazdy mode ma jednoznaczne znaczenie,
- user rozumie, z jakich sources AI korzysta,
- privacy and personalization rules sa czytelne,
- model/tier selection ma uczciwy contract,
- docs odrozniaja `real`, `partial` i `target` semantics.

Related specs:
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_MESSAGE_AND_THREAD_OPERATIONS.md`
- `CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`
