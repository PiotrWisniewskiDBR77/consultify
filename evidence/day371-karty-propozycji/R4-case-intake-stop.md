# R4 — Case Intake: STOP po pomiarze wariantu B

Producent `metadata.type='case_intake_proposal'` nie istnieje. Punkt składania
odpowiedzi wymaga zmian poza `AIChat/**`, więc wariant A nie mieści się w
licencji ani w koszcie jednego dnia w tej licencji.

Wariant B został zmierzony, a nie założony. Po usunięciu gałęzi i komponentu
reachability zmieniło się z `app=3053, unreachable=717` na
`app=3051, unreachable=718`; nowym osieroconym plikiem został
`src/components/CaseWorkspace/apiIntake.ts`, którego ten dyżur nie ma prawa
usuwać ani przebudowywać. Commit wariantu B został więc w całości odwrócony.
Po odtworzeniu stan wrócił do `app=3053, unreachable=717`.

Werdykt: **STOP**. A wykracza poza allowlistę, B powoduje regresję zasięgu poza
allowlistą, a stan pośredni nie został pozostawiony jako pozornie gotowy.
