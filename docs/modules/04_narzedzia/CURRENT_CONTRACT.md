---
module_id: MODULE_TOOLS
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-30
---

# Tools — aktualny kontrakt funkcjonalny

## Cel i granica

Tools udostępnia katalog metod konsultingowych i prowadzi użytkownika przez
sesję narzędzia do wyniku analizy. Assessment jest osobną pozycją menu i nie
może być opisywany jako podzakładka Tools tylko dlatego, że historycznie
dzielił routing lub komponenty.

Tools nie jest również Audits. Narzędzie służy elastycznej pracy nad problemem
i nie wymaga normy, niezależności audytora ani formalnego evidence chain.
Audits może użyć wyniku Tool jako materiału pomocniczego, ale formalny finding
powstaje wyłącznie w Audits.

## Mapa funkcji

| ID | Funkcja | Stan |
| --- | --- | --- |
| `TLS-F-001` | Katalog i wyszukiwanie narzędzi | AS-IS |
| `TLS-F-002` | Szczegóły i uruchomienie metody | AS-IS |
| `TLS-F-003` | Sesja narzędzia i zapis postępu | AS-IS / partial |
| `TLS-F-004` | Wynik, rekomendacje i eksport | AS-IS / partial |
| `TLS-F-005` | Megatrendy i kontekst | AS-IS |
| `TLS-F-006` | Handoff do Initiatives/Materials | partial |

## Przepływ

Użytkownik odnajduje metodę, poznaje wymagane dane, uruchamia sesję, zapisuje
odpowiedzi, otrzymuje wynik i decyduje o utworzeniu rekomendacji, inicjatywy
lub materiału. Przerwana sesja powinna dać się wznowić.

## Dane, role, AI i integracje

Tools jest właścicielem definicji narzędzia, sesji, odpowiedzi i wyniku sesji.
AI może wyjaśniać metodę, pomagać w uzupełnieniu i generować wersję roboczą
wniosków. Publikacja lub utworzenie obiektu w innym module wymaga akceptacji.
Administrator katalogu i zwykły użytkownik mają rozdzielone uprawnienia.

## AS-IS

Trasy Tools są zamontowane, a sześć historycznie opisanych funkcji ma
reprezentację w runtime. Zakres jest szeroki, lecz brak lokalnego, pełnego
zestawu testów całego lifecycle sesji. Dawne dokumenty mieszają Tools,
Assessment i megatrendy; ten kontrakt rozdziela ich własność.

## TO-BE

Spójny katalog metod z jednolitym szkieletem sesji, autosave, provenance,
porównywalnym wynikiem, rekomendacjami Teresy i kontrolowanym handoffem.

Pierwszym wzorcowym golden flow jest SWOT. Jego pełny kontrakt musi zostać
domknięty koncepcyjnie przed implementacją brakujących części.

## Luki i bramka

- zinwentaryzować faktycznie dostępny katalog i status każdej metody;
- potwierdzić tworzenie, autosave, wznowienie, zakończenie i ponowne otwarcie;
- ujednolicić format wyniku oraz eksport;
- oddzielić definitywnie dane Tools od Assessment;
- dodać testy sesji, błędów, uprawnień i handoffu.

Ocena: `B`. Dowody: `STATUS.md`, `CODEMAP.md`, pliki zachowania/danych,
`DiscoveryToolsHub` i zamontowane trasy.
