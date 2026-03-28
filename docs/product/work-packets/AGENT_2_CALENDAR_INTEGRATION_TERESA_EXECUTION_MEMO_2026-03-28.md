# Agent 2 Execution Memo

> Date: 2026-03-28
> Scope: `Kalendarz` / `Integracja` / `Teresa`
> Scope rule: no `Notatki`, no standalone `Komunikacja`, no `Outputs`, no broad `Settings / Admin`

## Scope truth
- `Integracja` ma najmocniejszy runtime w tym klastrze: governed inventory, auth state, refresh/error/conflict flows i test coverage istnieja.
- Najwiekszy problem `Integracja` jest user-facing: glowny entry surface nadal miesza realny stan z mock-like/local UI, wiec produktowa prawda nie jest jeszcze rowna.
- `Kalendarz` jest realny jako internal-first surface w `My Work`: ma unified read, conflict preview i create flow, ale create realnie dowozi tylko `task`.
- `Kalendarz` nie dowozi jeszcze uczciwego Google/Outlook parity; jego external truth zalezy od `Integracja`.
- `Teresa` ma prawdziwy chat/voice/history runtime, ale jako produkt nadal jest bardziej promising copilot shell niz w pelni uproduktowiona powierzchnia pracy.

## First packet
- `Integracja - control-plane honesty pass`

## Acceptance proof
- Uzytkownik widzi jedno glowne miejsce integracji z realna lista providerow i prawdziwym statusem, bez lokalnych toggle'i udajacych polaczenie.
- Dla kluczowych providerow widac rzeczywisty next step: `auth`, `config`, `validation`, `ready` albo `reauth required`.
- Ten sam provider ma ten sam status na glownym surface i w sync health, bez sprzecznych etykiet.
- Widoczna jest minimalna prawda operacyjna: ostatni run lub validation oraz jasny recovery action.
- `Kalendarz` po tym packetcie pokazuje tylko takie external semantics, ktore runtime integracyjny naprawde dowozi.

## Blockers / dependencies
- `Kalendarz` zalezy od prawdy `Integracja`; nie powinien wyprzedzac provider/auth/runtime truth.
- Czesc integracyjnego entry UI nadal jest placeholderowa lub lokalnie stanowa, co psuje trust.
- Statusy sa rozproszone miedzy kilkoma surface'ami, wiec jeden model statusu wymaga lekkiej koordynacji cross-surface.
- `Teresa` zalezy od ustabilizowanych handoffow do realnych surface'ow; nie powinna maskowac ich niedomkniecia.
- Brak pelnej productized Teresa jest blockerem dla startu od `Teresy` jako pierwszego packetu.

## Start now or wait
- `wait` - caly klaster powinien czekac, ale waski packet `Integracja - control-plane honesty pass` mozna uruchomic jako przygotowanie, bo redukuje falszywe obietnice bez otwierania nowego programu.
