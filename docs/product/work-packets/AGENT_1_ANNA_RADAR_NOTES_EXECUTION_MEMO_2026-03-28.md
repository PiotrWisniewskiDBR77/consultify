# Agent 1 Execution Memo

> Date: 2026-03-28
> Scope: `Anna` / `Radar` / `Notatki`
> Constraint: no broad `Landing`, no `Kalendarz`, no `Integracja`, no `Komunikacja`, no `Outputs`

## Scope truth
- `Anna`, `Radar` i `Notatki` sa manager-defined first spine: `Anna -> Radar -> Notatki`.
- `Anna` ma realny public-entry flow w repo: hero prompts, widget, text/voice seams, fallbacki i handoff do `demo / trial / contact`.
- `Radar` ma prawdziwy backend i recommendation model, ale aktywny UX jest nadal glownie rozlany po `Home V2`, a nie domkniety jako jeden czytelny decision surface.
- `Notatki` sa najmocniej domkniete funkcjonalnie: create, edit, autosave, attachments, AI proposals, classify, convert, linked context.
- Istnienie ekranow nie oznacza gotowosci produktu: dzis tylko `Anna` i `Notatki` wygladaja blizej odbioru; `Radar` nadal ryzykuje bycie inteligentnym dashboardem zamiast jasnym next-step surface.

## First packet
- `Anna entry / CTA coherence`

## Acceptance proof
- User po wejsciu na `/` rozumie, czym jest produkt, dla kogo jest i jaki jest pierwszy sensowny next step.
- User moze wejsc w `Anna` z hero lub entry bez poczucia, ze to osobny, doklejony widget.
- User moze z `Anna` przejsc do jednego z realnych handoffow: `demo`, `trial` albo `contact`.
- User widzi uczciwy fallback przy rate limit, degraded state albo braku voice i nadal wie, co zrobic dalej.
- User nie musi zgadywac, czy glowny CTA to rozmowa z Anna, demo czy trial, bo te sciezki sa spojne i hierarchiczne.

## Blockers / dependencies
- Nie wolno rozszerzyc packetu do broad `Landing`; scope musi zostac przy `Anna` i entry coherence.
- `Radar` nie daje jeszcze wystarczajacego proof na `decision surface ready`; to kandydat na kolejny packet, nie pierwszy.
- `Notatki` sa mocne, ale nie usuwaja first-use ambiguity; to kolejny krok po domknieciu wejscia.
- Jakosc packetu zalezy od tego, czy `Anna` prowadzi usera do decyzji, a nie tylko poprawnie odpowiada technicznie.
- Evidence testowe dla `Radar` jest slabsze niz dla `Anna` i `Notatki`; to ryzyko przy dalszej sekwencji klastra.

## Start now or wait
`start now` - bo `Anna entry / CTA coherence` jest bounded, zgodny z manager order i usuwa pierwsza user-facing niejasnosc bez udawania, ze `Radar` albo caly klaster sa juz produktowo gotowe.
