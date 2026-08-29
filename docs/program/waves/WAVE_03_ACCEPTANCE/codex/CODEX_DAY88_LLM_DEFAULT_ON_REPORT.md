# CODEX DAY 88 — LLM domyślnie ON — RAPORT

Data: 2026-08-29  
Gałąź: `codex/day88-llm-default-on-20260829`  
Baza: marker `800576e969432c583beae0293ad296c39b86d84d`

## Wynik

**STOP CAŁEGO DYŻURU W §B.1 — BRAK DOSTAWCY MODELU.**

Nie zmieniłem wartości domyślnej przełącznika. Włączenie go w tym środowisku nie
zmieniłoby wyniku, dopóki nie zostanie skonfigurowany klucz dostawcy modelu.
Przełącznika nie usunąłem. Kontraktu PPT w trybie szablonowym nie zmieniłem.

## §0.1 — baza, marker i sanity

Wolne miejsce przed utworzeniem worktree:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    82Gi    13%    459k  857M    0%   /
```

Wynik kroku (2), dosłownie:

```text
MARKER OK
```

Wynik kroku (7), dosłownie:

```text
800576e969432c583beae0293ad296c39b86d84d
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip gałęzi bazowej uciekł do przodu o jeden commit:

```text
f1c2ad5054 docs: dyzury 88 (LLM domyslnie ON) i 89 (naprawa szkieletu) + DEC-317/318
```

Pliki różnicy marker → tip:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_88_LLM_DOMYSLNIE_ON.md
```

Worktree utworzono z markera zgodnie z §0.1; `config.worktree` zawiera:

```text
[core]
	bare = false
```

Porty `5960` i `4820` nie miały procesu nasłuchującego.

## §A — weryfikacja stanu wejściowego

W1 potwierdził oba domyślne stany `false`:

```text
src/components/Presentations/PresentationTemplateArchitectView.tsx:231:
const [useLlm, setUseLlm] = useState(false);

server/src/routes/deliverableTemplates.routes.ts:272:
{ useLlm: useLlm === true }
```

W2 wykazał, że `useLlm` steruje ścieżkami frontu i serwera. W3 wykazał, że
`.env.example` przewiduje `GEMINI_API_KEY`, `OPENAI_API_KEY` i
`ANTHROPIC_API_KEY`.

## §B.1 — pomiar dostawcy przed zmianą

Komenda nieujawniająca wartości:

```bash
env | sed 's/=.*//' | grep -E '^(GEMINI_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)$' \
  || echo 'BRAK ZMIENNYCH DOSTAWCY'
```

Wynik dosłownie:

```text
BRAK ZMIENNYCH DOSTAWCY
```

Nie wykonano żadnego realnego wywołania modelu. Odczyt kodu potwierdza, że
ścieżka `useLlm=true` zachowuje wynik deterministyczny przy braku wyniku LLM:
`server/src/services/presentationTemplateDraftService.ts` zwraca bazowy draft
z `llmRefined: false`, jeżeli refiner nie zwróci wyniku, a
`server/src/services/deliverableTemplateSuggestService.ts` po błędzie LLM
przechodzi do deterministycznego keyword-matchera. Oznacza to cichy fallback,
nie dowód dostarczenia treści przez model.

### STOP — B.1 dostawca modelu

Rodzaj: MERYTORYCZNY  
Powód: żadna z przewidzianych zmiennych dostawcy modelu nie jest obecna w środowisku; instrukcja nakazuje w tym przypadku zakończyć dyżur przed zmianą.  
Licencja, którą sprawdziłem: §0.2 `Z12` wymienia cztery pliki z licencją wyłączną; nie zmieniłem żadnego z nich. §D dopuszcza zapis tylko czterech plików z licencji i raportu; przy STOP B.1 zapisuję wyłącznie raport.  
Dowód: komenda obecności nazw zmiennych zwróciła `BRAK ZMIENNYCH DOSTAWCY`; wartości sekretów nie odczytywano ani nie logowano.  
Co dostarczyłem ZAMIAST zmiany: pomiar obecności dostawcy, weryfikację stanu wejściowego W1–W3 i odczyt zachowania fallbacku bez uruchamiania modelu.  
Co zrobiłbym, gdyby zapadła decyzja X: po bezpiecznym skonfigurowaniu dostawcy powtórzyłbym §B.1, a dopiero po jego realnej odpowiedzi zmienił najmniejszą możliwą wartość domyślną, zachowując przełącznik i kontrakt PPT.  
Rekomendacja dla nadzorcy: zapewnić w kontrolowanym środowisku dyżuru dokładnie jeden skonfigurowany klucz dostawcy i ponowić dyżur od §B.1; nie scalać zmiany domyślnej bez dowodu odpowiedzi dostawcy.  
Stan: zacommitowano wyłącznie raport STOP.  
Czy kontynuowałem pozostałe pozycje: NIE — jawny warunek §B.1 i decyzja właściciela brzmią `BRAK DOSTAWCY = STOP, koniec dyżuru`.

## Kryteria K1–K7

- K1: **STOP / SPEŁNIONE** — dostawcę zmierzono przed zmianą; brak dostawcy.
- K2–K6: **NIE WYKONANO** — zabronione po wyniku STOP w §B.1.
- K7: **SPEŁNIONE PRZEZ BRAK ZMIANY** — kontrakt PPT w trybie szablonowym nietknięty.

## Korekty wobec instrukcji

Brak rozbieżności wymagającej improwizacji. Wynik pomiaru §B.1 uruchomił jawny
warunek zakończenia dyżuru.

## Zakres zmian

Jedyny zapis w repozytorium to ten raport. Nie uruchomiono bazy, migracji,
serwera, drenaży outboxu ani generatorów dokumentów. Nie wykonano żadnej
wysyłki zewnętrznej, żadnego połączenia z Railway, demo, stagingiem ani
produkcją.
