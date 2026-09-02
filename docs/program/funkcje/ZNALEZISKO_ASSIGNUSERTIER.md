---
doc_id: funkcje-znalezisko-assignusertier
status: canonical
owner: piotr
truth_type: runtime
established: 2026-08-31
---

# `assignUserTier` — luka walidacji, NIE wyciek. Sprostowanie własnego znaleziska

## Co zgłosił robotnik
„`assignUserTier` (`aiSettingsService.ts:606-615`) nie sprawdza, czy `userId` należy
do `orgId`. **Admin organizacji A może przypisać tier AI dowolnemu userId z
organizacji B.**" Zgłoszone jako realna dziura do osobnego odbioru.

## Co zmierzył nadzorca — zanim to powtórzył właścicielowi

**Twierdzenie o braku walidacji: PRAWDA.** Funkcja wykonuje `INSERT ... ON CONFLICT`
z kluczem `(organization_id, user_id)`, bez jakiegokolwiek sprawdzenia, czy wskazany
użytkownik należy do wskazanej organizacji. Obie trasy weryfikują wyłącznie, że
**wołający** jest administratorem `:orgId`.

**Twierdzenie o skutku: ZAWYŻONE.** Zmierzono wszystkie odczyty tabeli
`ai_user_tiers` w `server/src` — jest **dokładnie jeden**:

```
aiSettingsService.ts:601
  SELECT user_id, tier, created_at, updated_at FROM ai_user_tiers
   WHERE organization_id = ?
```

Nie istnieje żaden odczyt rozstrzygający „jaki tier ma ten użytkownik" ponad
organizacjami. Wiersz zapisany przez administratora organizacji A ląduje **w
przestrzeni organizacji A** i jest czytany wyłącznie przy listowaniu tierów tej
organizacji.

**Wniosek: administrator A nie zmienia niczego użytkownikowi z organizacji B.**
Wstawia śmieciowy wiersz do własnej tabeli, wskazujący cudzy identyfikator, który
sam podał.

## Właściwa klasyfikacja

| co to jest | co to NIE jest |
| --- | --- |
| luka **walidacji wejścia** — brak kontroli spójności celu z organizacją | eskalacja uprawnień między organizacjami |
| zanieczyszczenie danych: obce identyfikatory w tabeli własnej organizacji | wpływ na cudzego użytkownika |
| powierzchnia rozpoznawcza **bardzo słaba** — zapis udaje się niezależnie od istnienia użytkownika, więc nie jest wyrocznią istnienia | wyciek danych |

Do naprawy: **tak**, bo brak walidacji to dług, który jutro może zacząć znaczyć
więcej, gdy ktoś dopisze odczyt po użytkowniku. Jako **P3**, nie P0.

## Kontekst, który to jeszcze osadza
Tier z tej tabeli **nie jest dziś nigdzie konsumowany** poza listowaniem — nie
znaleziono kodu, który by go czytał przy wyborze modelu. Funkcja wygląda na w dużej
części martwą; to trzeba rozstrzygnąć przy naprawie.

## Dlaczego to zapisuję osobno
Robotnik zachował się dobrze: znalazł, nie łatał, zgłosił. Ale opisał **skutek**
mocniej, niż wynika z pomiaru. Gdybym powtórzył to właścicielowi bez sprawdzenia,
byłby to dziewiąty raz tego dnia, gdy hipoteza jedzie w górę jako fakt.

**Reguła: przed nazwaniem czegoś dziurą policz, kto to czyta.** Zapis bez odczytu
nie jest wyciekiem.
