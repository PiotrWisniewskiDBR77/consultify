# Chat v8 - Voice and multimodal

> Status: Draft v8
> Cel: Zdefiniowac kanoniczny user-facing i runtime contract dla voice capabilities w `Chat v8`.

---

## 1. Zasada nadrzedna

Voice w `Chat v8` ma byc jednym systemem zrozumialym dla usera.
Nie zbiorem ukrytych lub czesciowo podpietych sciezek.

---

## 2. Voice modes

### 2.1 Dictation

User mowi, system zamienia to na tekst w inpucie.
User nadal reviewuje prompt i wysyla go standardowym flow.

To jest canonical baseline voice mode.

### 2.2 Voice conversation

User mowi, system transkrybuje i przechodzi szybciej do send/response loop.

To moze byc:
- promoted feature, jesli ma pelny contract,
- albo partial capability, jesli runtime istnieje, ale UX nie jest jeszcze leader-grade.

### 2.3 TTS / auto-read

System czyta odpowiedz na glos.
To output mode, nie osobny conversation mode.

---

## 3. Runtime model

### 3.1 STT

Speech-to-text moze byc realizowane:
- browser-native path,
- server STT path.

### 3.2 TTS

Text-to-speech moze byc realizowane:
- browser TTS,
- server TTS path, jesli runtime to wspiera.

### 3.3 Health and availability

Voice docs musza jasno mowic:
- jakie capabilities zaleza od browsera,
- jakie od backendu i kluczy,
- jakie sa fallbacki.

---

## 4. User-visible state model

Voice state machine musi rozroznic:
- idle
- listening
- dictating
- recording
- transcribing
- speaking
- muted
- failed

User musi wiedziec:
- czy system nagrywa,
- czy system jeszcze przetwarza audio,
- czy AI mowi,
- jak zatrzymac kazdy z tych stanow.

---

## 5. Privacy and trust rules

- user musi wiedziec, czy audio idzie do serwera,
- user musi miec czytelny `stop`,
- voice errors nie moga wygladac jak ghost states,
- auto-read nie moze zaskakiwac usera bez widocznego stanu.

---

## 6. UX rules

### 6.1 Dictation UX

Must-have:
- start and stop clearly visible,
- transcript feedback,
- graceful failure,
- no confusion with full voice conversation.

### 6.2 Voice conversation UX

Must-have if promoted:
- one clear entry point,
- visible recording state,
- predictable auto-send or explicit send semantics,
- response playback rules.

### 6.3 Auto-read UX

Must-have:
- one obvious toggle,
- mute-now behavior,
- current speaking state.

---

## 7. Multimodal boundaries

`Chat v8` voice docs obejmuja:
- STT,
- TTS,
- audio-driven prompt entry.

Nie obejmuja automatycznie:
- image understanding,
- video conversation,
- generalized multimodal assistant parity,

chyba ze osobny runtime contract to potwierdzi.

---

## 8. Classification rules

- `dictation` = canonical baseline,
- `auto-read/TTS` = canonical where runtime exists,
- `voice conversation` = partial until one coherent end-user contract exists,
- everything else = explicit extension only if documented.

---

## 9. Anti-patterns

- dwa rozne voice stories dla roznych shelli,
- hidden voice path in code treated as shipped feature,
- brak rozroznienia dictation vs voice conversation,
- no clear privacy semantics,
- no clear failure state.

---

## 10. Definition of done

Voice and multimodal sa domkniete, gdy:
- user-facing modes sa jednoznaczne,
- state machine jest czytelny,
- browser/server boundaries sa opisane,
- privacy and stop controls sa obvious,
- docs nie overpromise'uja relative do runtime.
