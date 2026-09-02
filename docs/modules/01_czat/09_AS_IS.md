---
module_id: MODULE_CHAT
doc_kind: AS_IS
status: canonical
owner: documentation-maintainer
last_updated: 2026-07-29
---

# Chat — AS-IS

> ### ★ AKTUALIZACJA 2026-09-01 (dyżur 223) — governed proposal potwierdzona na realnej ścieżce
>
> Pełny pomiar: `docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md` §2.
> Realny render (nie dev-render, nie storybook): wiadomość `execution_proposal`
> przechodzi przez prawdziwy `UnifiedChatPanel` i `MessageRenderer.tsx` na
> `/chat/:conversationId`; DOM potwierdził kartę „Governed execution proposal",
> wiadomość użytkownika i kompozytor, light/dark. **Nie klikano**
> Approve/Reject/View run — to dowód renderu, nie wykonania cyklu życia.
>
> **Sprostowanie liczby „widm" akcji czatu:** brief wcześniej mówił o „~10";
> zmierzona liczba to **11**. Po wygaszeniu trzech (`CREATE_TASK`,
> `CREATE_DECISION`, `CREATE_INITIATIVE` — dostały realnych producentów przez
> governed `CREATE_DRAFT_*`) zostało **8 z 14** zadeklarowanych typów akcji bez
> żadnego producenta w UI: `START_TOOL`, `OPEN_PREVIEW`, `ASSIGN_INTERVIEW`,
> `START_ARTIFACT_REVIEW`, `CHECK_TRUST_STATE`, `ANALYZE_STATEMENT`,
> `REVIEW_MODEL`, `CHECK_LANE_STATUS` — każdy wymaga osobnej decyzji
> właściciela, nie jest to luka techniczna do domknięcia bez rozstrzygnięcia.
>
> Canvas **bez zmiany** — pozostaje `NO_GO` (patrz niżej), dyżur 223 nie
> dotyczył Canvas.

> ### ★ WEJŚCIE DO CANVAS — PYTANIE ZAMKNIĘTE, ALE NIEWYKREŚLONE (2026-08-29)
>
> `00_META.md` §Open Questions nadal pyta, które wejście uruchamia Canvas —
> wybrany wynik rozmowy, osobna pozycja Menu 2 czy wspólna trasa. **`STATUS.md`
> §Next Implementation Decision odpowiada: decyzja właściciela jest zamknięta —
> wejściem jest WYBRANY WYNIK ROZMOWY.** Pytanie w `00_META.md` jest martwe
> i nie jest powodem do zatrzymania pracy.
>
> **Uwaga o skali braku.** Ten plik mówi „Canvas ma znaczącą implementację, lecz nie
> ma kompletnego dowodu ścieżki". Macierz odbioru tego samego modułu mówi więcej:
> **brakuje wymaganej trasy startowej, komponentu pustego stanu i kontrolek przeglądu**.
> Wiążąca jest macierz — to nie jest brak dowodu, to brak elementów.
>
> Ten moduł jako **jedyny z szesnastu nie ma pliku `CURRENT_CONTRACT.md`**; punktem
> wejścia wskazanym w spisie menu jest ten plik.


## Rola w aplikacji

Chat jest głównym interfejsem współpracy z Teresą. Użytkownik rozpoczyna lub
otwiera rozmowę, przekazuje kontekst i pliki, otrzymuje odpowiedzi, źródła oraz
propozycje dalszych działań. Chat może przekazać wynik do powierzchni pracy,
ale nie jest właścicielem danych biznesowych innych modułów.

## Wejścia i powierzchnie

- menu `Chat` prowadzi do `/chat`;
- rozmowa ma adres `/chat/:conversationId`;
- oba adresy używają `ConversationRouteSync` i `UnifiedChatPanel mode="full"`;
- `/internal/v10-runtime` jest powierzchnią wewnętrzną, nie pozycją menu;
- starsze wejścia Work Canvas przekierowują do kanonicznego Chat w trybie
  dzielonym.

## Odpowiedzialności

- tworzenie, otwieranie, edycja, archiwizacja i usuwanie rozmów;
- przechowywanie wiadomości i metadanych rozmowy;
- rozmowy osobiste i zespołowe oraz grupowanie w projektach Chat;
- generowanie odpowiedzi AI, cytowań, załączników i propozycji działań;
- udostępnianie rozmowy;
- przekazanie wybranego wyniku do Canvas lub modułu docelowego.

## Dane i backend

Kanoniczne encje to `conversations` i `conversation_messages`. Rozmowa zawiera
m.in. organizację, twórcę, projekt, język, tytuł, tagi, stan
archiwizacji/usunięcia i skrót ostatniej wiadomości. API rozmów jest montowane
pod `/api/conversations`; żądania przechodzą uwierzytelnienie i kontrolę
członkostwa w organizacji. Projekty Chat i udostępnienia mają osobne trasy.
Usunięcie jest miękkie, a trwałe czyszczenie wykonuje harmonogram po okresie
ochronnym.

## Granice i uczciwy stan

Chat jest obecny i potwierdzony w kodzie oraz testach tras. Canvas ma znaczącą
implementację, lecz nie ma kompletnego dowodu ścieżki
`wybrany wynik -> szkic -> przegląd -> akceptacja/odrzucenie -> odczyt w
module właścicielskim`. Dlatego Canvas pozostaje `NO_GO`, a moduł nie spełnia
jeszcze poziomu `A`.

## Źródła wykonawcze

- routing: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`;
- UI: `src/components/AIChat/UnifiedChatPanel.tsx`,
  `src/components/AIChat/ConversationRouteSync.tsx`;
- API: `server/src/routes/conversations.routes.ts`,
  `server/src/routes/ai.routes.ts`, `server/src/routes/chat-projects.routes.ts`,
  `server/src/routes/share.routes.ts`;
- dane: `server/src/database/DatabaseInitializer.ts`;
- retencja: `server/src/services/conversationPurgeScheduler.ts`.
