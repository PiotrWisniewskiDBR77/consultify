---
document_id: INTERVIEW-ANSWER-ASSISTANCE-VERIFICATION-CONTRACT
module: Interview
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Interview — pomoc w odpowiedzi i system weryfikacji

## 1. Cel

System ma jednocześnie:

- ułatwić człowiekowi udzielenie prawdziwej, konkretnej odpowiedzi;
- nie zamieniać pomocy AI w odpowiadanie za człowieka;
- przed wysyłką wykryć realne braki i umożliwić ich szybkie poprawienie;
- po wysyłce dać managerowi/reviewerowi kontrolę jakości;
- zachować autorstwo, historię, dowody i odpowiedzialność za każdą zmianę.

To jeden przepływ, nie trzy niezależne funkcje.

`Answer with Teresa → Respondent readiness check → Submit → Manager review →
Approve / Supplement / Send back → Resubmit → Confirmed Answer Set`

## 2. Warstwa 1 — łatwe odpowiadanie z Teresą

Respondent może odpowiadać ręcznie, głosowo albo w rozmowie. Teresa:

1. zadaje canonical question prostym językiem;
2. odpowiada na pytanie „co to znaczy?”;
3. rozbija trudne pytanie na krótkie follow-ups;
4. dopytuje o przykład, zakres, czas, ownera, metrykę lub evidence;
5. rozpoznaje niepewność i sprzeczność;
6. podsumowuje wypowiedź jako `Answer Proposal`;
7. pokazuje dokładnie, co trafi do odpowiedzi;
8. zapisuje dopiero po akceptacji respondenta.

Teresa może prowadzić naturalną rozmowę, ale każde podsumowanie musi zostać
zmapowane do konkretnego `questionId`. Fragment, którego nie da się przypisać,
pozostaje notatką rozmowy, a nie odpowiedzią.

### Niedozwolone zachowania

- odpowiadanie za respondenta na podstawie wiedzy organizacyjnej;
- dopisywanie faktów, przykładów albo evidence;
- zamiana „nie wiem” na prawdopodobną odpowiedź;
- sugerowanie odpowiedzi pożądanej przez managera;
- cichy zapis transkrypcji jako zaakceptowanej odpowiedzi;
- ujawnianie odpowiedzi innych osób.

## 3. Model Answer Proposal i Answer

`Answer Proposal` zachowuje transcript/source spans, proponowany tekst,
question version, AI provenance i status akceptacji.

Po akceptacji powstaje/zmienia się `Answer`, który ma:

- respondent i exact question version;
- answer value oraz context/rationale;
- evidence i source links;
- declared uncertainty i `not applicable` reason;
- author/AI contribution markers;
- save/submission/review status;
- wersje oraz pełną historię zmian.

## 4. Warstwa 2 — weryfikacja przed wysyłką

Przycisk `Sprawdź i wyślij` uruchamia `Respondent Readiness Check`, a nie od razu
zamyka sesję.

### 4.1 Wymiary jakości

Każda odpowiedź jest oceniana względem konkretnego pytania:

- **Answered** — czy odpowiedź istnieje;
- **Relevant** — czy odpowiada na intent pytania;
- **Specific** — czy zawiera wystarczający konkret;
- **Complete** — czy pokrywa wymagane elementy expected answer shape;
- **Understandable** — czy znaczenie jest jednoznaczne;
- **Grounded** — czy wymagane przykłady/evidence są podane;
- **Consistent** — czy nie przeczy innym odpowiedziom bez wyjaśnienia;
- **Attributable** — czy wiadomo, co powiedział respondent, a co zaproponowała AI.

Długość odpowiedzi nie jest samodzielnym miernikiem jakości. Krótka odpowiedź
może być wystarczająca dla pytania zamkniętego; długa może nie odpowiadać na
intent.

### 4.2 Klasy wyniku

- `Ready` — odpowiedź spełnia wymagania;
- `Could improve` — można ją wysłać, ale system pokazuje konkretną sugestię;
- `Needs clarification` — znaczenie jest niejednoznaczne lub brak ważnego
  elementu;
- `Blocked` — brak required answer, błędny format, brak wymaganego reason albo
  evidence określonego jako twardy warunek Template;
- `Not applicable` — prawidłowo uzasadnione;
- `Unresolved / I don't know` — jawny brak wiedzy z dalszym działaniem.

### 4.3 Hard i soft gate

Hard gate może wynikać wyłącznie z deterministycznej reguły opublikowanego
Template: required, schema/format, wymagany reason, wymagany evidence albo
niezamknięty branching. Niedostępność AI nie może zablokować wysyłki.

Ocena AI dotycząca trafności, konkretności lub jakości języka jest domyślnie
soft gate. Respondent może wrócić i poprawić albo wybrać `Wyślij mimo sugestii`
z acknowledgement. Jeżeli Method Owner chce twardego progu merytorycznego,
musi on być jawnie zdefiniowany, testowalny i znany przed przypisaniem.

### 4.4 Ekran podsumowania

Przed wysłaniem użytkownik widzi:

- progress i liczbę `Ready / Could improve / Blocked`;
- listę dokładnych pytań wymagających uwagi;
- konkretny powód i oczekiwane uzupełnienie;
- akcję `Przejdź do pytania` z powrotem do tego samego miejsca;
- możliwość poproszenia Teresy o doprecyzowanie;
- informację, co zobaczy reviewer;
- finalne potwierdzenie zakresu i privacy.

Po wysłaniu powstaje immutable submission snapshot. Autosave nie jest submit.

## 5. Warstwa 3 — review managera

Manager przypisujący zadanie albo wskazany Reviewer otrzymuje kolejkę w
`Managed/Pending Review`, powiadomienie i deep link do konkretnego submission.

Reviewer widzi:

- pytanie obok odpowiedzi i evidence;
- respondent readiness result oraz AI recommendations;
- historię i wkład Teresy;
- braki, sprzeczności i flagged sensitive content;
- kontekst celu Interview;
- poprzednie wersje po send-back;
- coverage całego przypisania.

### 5.1 Dozwolone decyzje

- `Approve` — akceptuje snapshot;
- `Send back` — zwraca z reason i konkretnymi missing items;
- `Request evidence` — tworzy kontrolowany follow-up;
- `Add reviewer note` — komentarz niezmieniający odpowiedzi;
- `Add reviewer supplement` — osobna wypowiedź reviewera z jego autorstwem;
- `Answer assigned follow-up` — reviewer odpowiada jako osobny respondent, jeśli
  ma przypisane pytanie;
- `Escalate` — przekazuje do właściwego eksperta/decydenta;
- `Approve with limitations` — tylko jeśli policy dopuszcza i ograniczenia są
  jawne downstream.

### 5.2 Granica autorstwa

Manager nie edytuje cicho odpowiedzi respondenta i nie „poprawia jej” pod swoim
nazwiskiem. Jeżeli posiada brakującą wiedzę, może:

1. dodać `Reviewer Supplement` widoczny jako oddzielne źródło;
2. przejąć/przyjąć osobne follow-up assignment i odpowiedzieć jako respondent;
3. odesłać odpowiedź do uzupełnienia.

Approved Answer Set zachowuje odpowiedź pierwotną, supplementy, decyzję review
i ewentualne różnice. Synteza może korzystać z nich jako z osobnych źródeł.

## 6. Send-back i ponowna wysyłka

Send-back wymaga:

- powodu zrozumiałego dla respondenta;
- wskazania konkretnych pytań/elementów;
- oczekiwanego rodzaju poprawy;
- ownera i opcjonalnego terminu;
- rozdzielenia blockerów od sugestii;
- zachowania submission snapshot.

Respondent otwiera listę braków, przechodzi deep linkiem do pytania, może
porozmawiać z Teresą, poprawić wybrane odpowiedzi i wykonać resubmit. Reviewer
widzi before/after oraz status każdego missing item.

## 7. Statusy

### Odpowiedź

`Not started → Draft → Answered → Ready / Needs attention → Submitted →
Confirmed / Sent back → Revised → Resubmitted → Confirmed → Superseded`

### Assignment

`Assigned → In progress → Submitted → In review → Approved / Sent back →
Resubmitted → Approved → Completed`

Stany są audytowalne. Tylko uprawniona rola może wykonać review transition.

## 8. Odpowiedzialności

| Rola | Odpowiedzialność |
| --- | --- |
| Respondent | prawdziwość, akceptacja Answer Proposal i finalny submit |
| Teresa | pomoc, pytania pogłębiające, propozycje i jawna ocena jakości |
| Assignment Manager | coverage, terminy, właściwi respondenci i routing |
| Reviewer | ocena wystarczalności oraz decyzja approve/send-back |
| Template Owner | required rules, expected answer shape i hard gates |
| Method Owner | progi metodologiczne dla Assessment/Audit |

Manager i Reviewer mogą być tą samą osobą, ale nie musi tak być.

## 9. AS-IS i luka

Runtime posiada już:

- tryb Conversational i review propozycji odpowiedzi;
- help, voice, evidence i poprawianie odpowiedzi;
- lokalne oraz AI quality review;
- pre-submit quality gate i przejście do słabego pytania;
- server-side blokadę wymaganych braków;
- persisted AI review snapshot;
- Managed Assignments, notification, approve i send-back;
- missing items oraz historię ponownej pracy.

Do dopracowania/odbioru:

- zastąpić długość tekstu kryteriami zależnymi od typu i intentu pytania;
- upewnić się, że subiektywny werdykt AI nie staje się niejawnie hard gate;
- dodać jawne `Reviewer Supplement` zamiast edycji cudzej odpowiedzi;
- ujednolicić `Approve with limitations` i evidence request;
- przetestować cały cykl submit → send-back → revise → resubmit → approve;
- potwierdzić before/after i pełne attribution w Insight Generatorze.

## 10. Golden flows

### Respondent z pomocą Teresy

`open question → ask/explain → conversational follow-ups → review Answer
Proposal → accept → readiness check → fix blockers → submit`

### Manager review

`notification → open submitted snapshot → inspect answer/evidence/AI notes →
approve OR send back missing items OR add attributed supplement → respondent
revises → compare versions → approve`

## 11. Definition of Done

1. Teresa prowadzi rozmowę i proponuje zapis bez odpowiadania za człowieka.
2. Każda propozycja wymaga akceptacji i zachowuje provenance.
3. Pre-submit check ocenia odpowiedź względem question intent/schema.
4. Hard blockers są deterministyczne i identyczne frontend/backend.
5. Soft AI feedback można świadomie pominąć.
6. Użytkownik wraca deep linkiem do dokładnego braku.
7. Submit tworzy immutable snapshot i powiadamia reviewera.
8. Reviewer może approve, send back, request evidence lub dodać supplement.
9. Nikt nie edytuje cudzej wypowiedzi bez attribution.
10. Resubmit pokazuje before/after i zamknięcie missing items.
11. Approved Answer Set jest jedynym domyślnym wejściem do Insight Generatora.
12. Pełny lifecycle ma test E2E, permission test i audit history.
