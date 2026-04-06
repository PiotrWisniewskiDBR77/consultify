# Co dobra sensitivity analysis powinna pokazac przed approval

Target persona: industrial engineer / project engineer prezentujacy finance i operations sponsors  
Funnel stage: Consideration  
Core problem: sensitivity slides czesto pokazuja colorful tornado charts bez wyjasnienia ktore levers realnie ruszaja decision albo kto je posiada  
Main promise: jasny standard tego co sensitivity musi expose przed sign-off zeby approvers widzieli consequence, ownership i failure order, nie decoration

**Bezposrednia odpowiedz:** dobra sensitivity analysis przed approval pokazuje rankowane levers z direction of impact, band ktory testowales versus to co history supports, jak rankings sie zmieniaja gdy levers ruszaja razem, ktore outcomes breach guardrails jako pierwsze i kto ownuje kazdy lever. Jesli sensitivity nie potrafi odpowiedziec co pierwsze sie psuje i kto to naprawia, nie jest ready na approval.

Tornado charts to nie decisions.

To invitations zeby zadawac lepsze pytania.

## Jak wyglada slaba sensitivity

Slabe packs zwykle dziela te cechy:

- wiele parameters listed, few tied do real operating controls  
- one-at-a-time tweaks ktore ignoruja coupled effects w fabryce  
- brak guardrail lines dla service, cash albo safety-related outcomes  
- brak assumption owners, wiec debate staje sie abstract  

Digital Twin powinien wspierac decision system.

Sensitivity to jak pokazujesz gdzie ten system jest fragile.

## Framework: szesc elementow ktore approvers powinni zobaczyc

1. **Lever list z ownership:** kazdy moving input nazywa business owner, nie tylko cell.  
2. **Tested band versus evidence band:** co symulowales versus co ostatnie dwanascie do dwudziestu cztery miesiace uzasadniaja.  
3. **Direction i monotonicity notes:** czy gorsze supplier performance zawsze boli tak samo, czy bottleneck migrates?  
4. **Joint movement cases:** przynajmniej jeden combined stress ktory pasuje do tego jak zle kwartaly realnie przychodza.  
5. **Guardrail breaches:** pierwszy KPI albo operational limit ktory failuje gdy levers sie ruszaja.  
6. **Decision flip map:** ktore paired changes w levers zmienilyby recommended option.

## Checklist: sensitivity pack readiness

- [ ] top five levers sa agreed miedzy engineering, operations i finance  
- [ ] przynajmniej jeden combined case odzwierciedla correlated downside ktore przezyliscie  
- [ ] bottleneck migration pojawia sie w narrative gdy dzieje sie w modelu  
- [ ] procurement i planning widza swoje levers explicit  
- [ ] invalidation triggers odnosza sie do measurable signals, nie vibes  

## Kiedy to dziala a kiedy failuje

**Dziala** gdy model boundary pasuje do decision i levers mapuja na controls ktorych ludzie realnie uzywaja.

**Failuje** gdy team optymalizuje metric ktorego leadership nie obroni gdy service peka.

## Co zmienia Digital Twin

Digital Twin to scenario-testing environment do de-risk layout, flow i CAPEX zanim reality sie zmieni.

To nie 3D showcase.

Silna sensitivity zamienia abstract uncertainty w ordered operational risk.

## Co dodaje DBR77 Digital Twin

DBR77 Digital Twin wspiera praktyczne scenario comparison ze sciezka od manual inputs do bogatszej integracji.

Dla approval conversations pomaga zespolom:

- utrzymac consistent sensitivity narratives across projects  
- wiazac lever movement z traceable assumptions  
- skrocic sciezke od chart do accountable next step  

## Bottom line

Sensitivity istnieje zeby reveal fragility w business language.

Jesli approvers nie widza failure order i ownership, kontynuuj prace.
