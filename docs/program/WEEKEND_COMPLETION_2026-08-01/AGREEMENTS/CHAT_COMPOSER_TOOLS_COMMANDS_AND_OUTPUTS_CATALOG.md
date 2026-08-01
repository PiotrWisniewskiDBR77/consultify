---
document_id: CHAT-COMPOSER-TOOLS-COMMANDS-OUTPUTS
module: Chat
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Chat — composer, narzędzia, komendy i outputy

## 1. Anatomia composera

Composer zawiera tylko funkcje potrzebne przed wysłaniem:

1. pole tekstowe z autosizing i draft recovery;
2. chips załączników i references;
3. `+` dla dodawania źródeł/narzędzi;
4. aktywny tryb/model/scope w kompaktowej formie;
5. mikrofon z rozdzieleniem dictation/voice;
6. Send, podczas streamingu Stop;
7. palette `/` i `@` otwierana kontekstowo.

Nie wolno zamienić composera w panel ustawień. Rzadkie opcje znajdują się w
menu, a aktywne ograniczenia pozostają widoczne.

## 2. Załączniki i references

Obsługiwane klasy: local file, URL, Client Vault file, Canvas artifact, Note,
Idea, Initiative, Task, Decision, project, person/team i wynik modułu.

Pipeline:

```text
select -> upload/fetch -> malware/type/size validation -> extract/index
       -> preview + scope -> attach reference -> retrieval -> citation
```

Każdy chip pokazuje loading/ready/failed/stale oraz pozwala usunąć referencję.
Usunięcie z promptu nie kasuje źródłowego pliku. URL i cloud source nie mogą być
oznaczone jako aktywne przed udanym ingestem.

## 3. Mentions `@`

Mention jest stabilną referencją, nie tekstową nazwą. Picker grupuje wyniki:
people, projects, files, artifacts, business objects. Po wysłaniu backend
sprawdza ponownie ACL i zapisuje resolved ID/version. Dwuznaczna nazwa wymaga
wyboru.

## 4. Slash commands `/`

Slash command jest skrótem do jawnej intencji, nie osobną logiką biznesową.
Docelowe rodziny:

- `/research`, `/think`, `/summarize`, `/compare`;
- `/canvas`, `/document`, `/sheet`, `/deck`, `/diagram`;
- `/note`, `/idea`, `/task`, `/decision`, `/initiative`;
- `/tool`, `/assessment`, `/interview`, `/agent`;
- `/scope`, `/sources`, `/private`, `/language`.

Komenda pokazuje opis, wymagane argumenty i ryzyko. `/task` i `/decision` tworzą
proposal, a nie pomijają właściwego kontraktu domeny.

## 5. Tool picker

Picker opisuje cel użytkownika: Research, Analyze data, Create artifact, Use
consulting tool, Work with organization, Run process. Wybór konfiguruje
intention hint i dozwolony toolset. Nie jest gwarancją, że Teresa użyje narzędzia,
jeżeli zadanie nie wymaga wykonania; przy wymuszonym użyciu system komunikuje
brak capability.

## 6. Modele i jakość

Preferowany UX oferuje profile Fast, Balanced, Deep oraz jawny model w sekcji
zaawansowanej. Zmiana modelu w wątku zapisuje się per response. Niedostępny model
nie powoduje cichego downgrade; system pokazuje zamiennik i przyczynę. Zadania
o wysokim ryzyku mogą wymagać quality tier niezależnie od preferencji szybkości.

## 7. Voice

Trzy funkcje nie mogą się mieszać:

- dictation: mowa -> tekst w composerze, użytkownik edytuje i wysyła;
- voice conversation: turn-taking, STT, automatyczne wysłanie według ustawień;
- TTS/auto-read: odczyt odpowiedzi Teresy.

UI pokazuje recording, timer, poziom audio, interim transcript, język, stop i
błąd. Mikrofon wymaga zgody. Raw audio ma osobną retencję i nie jest pamięcią.

## 8. Akcje na wiadomości

Wiadomość użytkownika: edit/fork, copy, retry after error. Odpowiedź Teresy:
copy, read aloud, feedback, regenerate, continue, show sources, open artifact,
save as Note/Idea, create proposal, report. Menu jest kontekstowe; nie pokazuje
akcji bez realnego runtime.

## 9. Output routing

Duży wynik powinien opuścić bubble:

- tekst roboczy -> Canvas document;
- dane -> Table/Sheet Canvas;
- slajdy -> Deck runtime;
- mapa/proces -> Ideas visual runtime;
- insight -> Insight Candidate;
- działanie -> proposal Task/Decision/Initiative;
- finalny materiał -> Outputs/Materials.

Chat pokazuje artifact card z tytułem, typem, statusem, wersją, open action i
lineage. Nie wkleja pełnego dokumentu równocześnie do wiadomości i Canvasu.

## 10. Stany composera

Empty, drafting, attaching, attachment failed, ready, sending, streaming,
stopping, offline, rate limited, permission blocked i frozen. Draft pozostaje
po błędzie. Enter/Shift+Enter i mobile behavior muszą być przewidywalne.
