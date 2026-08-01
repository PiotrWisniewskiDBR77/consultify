---
program_id: WK-TERESA-001
status: READY_FOR_BASELINE
owner: piotr
prepared_by: codex
reference_product: FizzUp/Malcolm
last_reviewed: 2026-07-30
---

# Teresa — program naprawy rozmowy

## Wniosek

Teresa ma transport głosowy, instrukcję, kontekst ekranu, wiedzę o produkcie i
governance akcji. Nie ma jeszcze jednego, testowalnego systemu prowadzenia
rozmowy. Problemem nie jest wyłącznie głos ani model, lecz rozproszony kontrakt
zachowania.

## Wzorzec Malcolma z FizzUp

| Warstwa | Dowód w FizzUp | Odpowiednik dla Teresy |
| --- | --- | --- |
| kanon persony | `DOC/AI_Speaking_Coach_COACH_PERSONA_MALCOLM.md`, `coach_persona.ts` | Teresa Character Bible |
| łuk rozmowy | `conversation_arcs.ts`, `lesson_conductor.ts` | conductor konsultingowy |
| pamięć i powrót | `session_handoff.ts`, `0200_session_handoff.sql` | handoff między sesjami |
| kontrola tur | `conversation_modes.ts` | polityka jednej decyzji na turę |
| domknięcie | gwarantowany `wrapup` w `lesson_conductor.ts` | decyzja, artefakt lub następny krok |
| testy charakteru | `coach_persona_malcolm_test.dart`, `persona_integrity_integ.ts` | „Czy Teresa tak mówi?” |

Nie kopiujemy języka Malcolma. Kopiujemy architekturę odpowiedzialności i
metodę testowania.

## Stan Teresy

### Mamy

- Gemini Live i recovery: `src/config/teresaVoice.ts`;
- kontekst organizacji, ekranu i propozycji: `src/utils/teresaVoiceInstruction.ts`;
- diagnostykę runtime: `src/hooks/v10/useV10TeresaRuntime.ts`;
- strumieniowanie i artefakty: `src/hooks/useAIStream.ts`;
- projekty rozmów i project brief: `src/store/useChatProjectStore.ts`;
- manifesty akcji i potwierdzanie: `src/actions/teresaActionManifest.ts`.

### Brakuje albo jest rozproszone

- jednego kanonu osobowości wspólnego dla tekstu i głosu;
- łuku: orientacja → diagnoza → wybór → praca → domknięcie;
- krótkiego, priorytetyzowanego handoffu na kolejną sesję;
- kontrolowanej długości tur i adaptacji do użytkownika;
- kontraktu, kiedy Teresa pyta, odpowiada lub proponuje artefakt;
- testów jakości na pełnych transkryptach;
- jednej ścieżki kompozycji promptu;
- pewnej materializacji wyniku do Canvas/Materials/modułu właściciela.

## Docelowy kontrakt

1. Otwórz kontekstowo jednym zdaniem.
2. Odpowiedz albo zadaj jedno pytanie — bez ankiety.
3. Prowadź jedną rzeczą na turę.
4. Pamiętaj decyzje, zobowiązania, otwarte pytania i następny krok.
5. Dostosuj konkretność, ciepło, wyzwanie, formalność i długość.
6. Oddziel rozmowę od akcji: propozycja → podgląd → zgoda → wykonanie.
7. Domknij ustalenie dokładnie jednym następnym krokiem.
8. Duży wynik iteruj w Canvas, a finalnie przekaż do modułu właściciela.

## Pakiety wykonawcze

### T1 — baseline

Zebrać 20 rozmów tekstowych i 10 głosowych. Ocenić naturalność, trafność,
pamięć, liczbę pytań, długość tur, materializację i domknięcie.

### T2 — Teresa Character Bible

Rola, charakter, granice, pięć osi tonu i przykłady „tak mówi / tak nie mówi”
po polsku i angielsku. Jedno źródło dla tekstu i głosu.

### T3 — Conversation Conductor

Pięć faz, tryb krótki, maksymalnie jedno pytanie w turze, wykrywanie gotowości
do artefaktu/akcji oraz gwarantowane domknięcie.

### T4 — Session Handoff

Karta: cel, ostatnia decyzja, otwarta sprawa, obiecany krok, ostatni artefakt i
preferowany styl. Pamięć faktów oddzielona od sformułowania wypowiedzi.

### T5 — Materialization Bridge

Rozmowa → Canvas → moduł właściciela, z podglądem, zgodą, źródłem i wersją.

### T6 — eval i release gate

Testy „Czy Teresa tak mówi?”, pełne scenariusze oraz ślepe porównanie baseline
z nową wersją. Brak wdrożenia przy wzroście halucynacji lub błędnych akcji.

## Golden flow

Użytkownik wraca, Teresa trafnie przypomina ostatnią decyzję, pomaga
doprecyzować jeden problem, wspólnie buduje wynik w Canvas, pokazuje podgląd
przekazania, czeka na akceptację, zapisuje i kończy jednym następnym krokiem.

Kolejność: T1 → T2 → T3 → T4 → T5 → T6. Stabilność audio mierzymy równolegle,
ale nie mieszamy problemów transportu z jakością dialogu.
