# Was man vor der Erweiterung einer Produktionslinie simulieren sollte

Target persona: plant director / industrial engineering lead / program sponsor  
Funnel stage: Decision  
Core problem: Linienexpansion wird oft aus statischer Kapazitaetsrechnung und Anbieterunterlagen dimensioniert, waehrend das reale Risiko in Kopplung, Ramp-Verhalten und Mix-/Variabilitaetswirkungen steckt  
Main promise: ein kompakter Simulationsumfang, der Expansionsentscheidungen testet, bevor Beton, Personal und Lieferantenbindungen festliegen

**Direkte Antwort:** simulieren Sie vor einer Linienexpansion die Baseline unter realistischer Variabilitaet, die kleinste Menge glaubhafter Expansionsvarianten, Ramp- und Lernkurven, Konkurrenz um geteilte Ressourcen und die Intralogistik, die das neue Segment versorgt. Verzichten Sie nur dann, wenn die Expansion eine triviale Kopie einer bestehenden Zelle mit gleichem Mix und ohne geteilte Engpaesse ist.

Linienexpansion ist selten nur mehr Maschinen in derselben Halle.

Sie aendert, wie Arbeit ankommt, wartet und sich erholt.

## Warum Expansionsfreigaben operativen Nachweis brauchen, nicht nur CAPEX-Pakete

Ein starkes Expansionsmemo kann trotzdem verpassen:

- wie sich WIP und Warteschlangen starten, wenn das neue Segment live geht
- ob der Engpass nach oben oder unten wandert
- wie Ruestungen und Mix interagieren, wenn der Durchsatz steigt
- ob Materialzufuhr, Staging oder Kitting zum versteckten Limit wird

Solche Fehler sind teuer, wenn Beton steht und Vertraege unterschrieben sind.

## Mindestszenariensatz fuer eine Linienexpansion

Fahren Sie diese Szenarien mit denselben Modellannahmen:

1. **Baseline heute:** schlechte Wochen einbeziehen, nicht nur Durchschnitt.  
2. **Ziel-Durchsatzband:** die Spanne, die das Management tragen will.  
3. **Mix-Stress:** der Familienmix, der Zykluszeiten und Ruestungen am meisten belastet.  
4. **Ramp-Fall:** ehrliche Annahmen zu Training, Ausschuss und Stabilitaet in den ersten Monaten.  
5. **Gekoppelte Ressourcen:** geteilte Anlagen, Pruefer, Krane, AGV-Schleifen oder Aushelfpersonal, das beide Linien beruehrt.

Sie vergleichen, wie das System versagt, nicht wie es glaenzt.

## Rahmen zum Vergleich von Expansionsvarianten

Nutzen Sie ein einfaches Scoreboard, damit Finance und Operations dieselben Fakten diskutieren:

| Kriterium | Warum es zaehlt |
|---|---|
| Durchsatz am Engpass unter Stress | zeigt, ob die Expansion den wahren Limitierer wirklich entlastet |
| WIP und Wartezeit an Top-Constraints | entlarvt Scheinkapazitaet, die nur Warten verschiebt |
| Ueberstunden- und Leiharbeitsrisiko | uebersetzt Betriebsrisiko in Kostensprache |
| Zeit bis stabiler Output nach Go-live | prueft, ob der Business Case sofortige Reife annimmt |
| Sensitivitaet gegen Liefer- oder Eingangsverzoegerungen | macht Logistikkopplung sichtbar |

Wenn zwei Varianten im Mittel nah beieinander liegen, unter Stress aber auseinanderlaufen, ist Stress die Wahrheit vor der Ausgabe.

## Checkliste: Inputs, die das Management vor Modellstart fixieren sollte

- **Entscheidungssatz:** was genau gewaehlt wird (Kapazitaet, Layout, Lieferantenscope, Personalmodell).  
- **Nachfrageform:** Level-, Mix- und Saisonannahmen mit klarem Owner aus Vertrieb und Planung.  
- **Constraint-Liste:** was in den ersten 90 Tagen nach Start nicht flexibel ist.  
- **Fail-Definition:** welcher KPI-Bruch eine Option disqualifiziert.

Ohne diese vier Punkte wird das Modell ein Rorschach-Test.

## Typischer Fehler: die neue Linie isoliert modellieren

Isolierte Linienmodelle wirken sauber.

Sie luegen oft.

Wenn die Expansion indirekte Zeit, Instandhaltungsfenster oder Materialfluss-Kapazitaet vom Rest des Werks frisst, lernt das Werk das in der Ramp-Phase, nicht im Freigabetermin.

## Was Digital Twin hier aendert

Digital Twin ist ein Szenario-Testumfeld fuer kapitalnahe Betriebsentscheidungen.

Es ist keine 3D-Show.

Es erlaubt Fuehrung zu sehen, wie eine erweiterte Linie mit Fluss, Puffern und geteilten Ressourcen interagiert, bevor Layout- und Beschaffungsentscheide schwer rueckgaengig sind.

## Was DBR77 Digital Twin ergaenzt

DBR77 Digital Twin ist als praktisches Entscheidungssystem positioniert, mit einem Weg von manuellen Eingaben zu tieferer Integration.

Fuer Expansionsentscheidungen unterstuetzt es:

- vergleichendes Testen glaubhafter Varianten unter Variabilitaet
- klarere Trade-offs zwischen Durchsatz, Flexibilitaet, Bestand und Ramp-Risiko
- Entscheidungsprotokolle, auf die Finance und Operations sich ohne Slide-Optimismus einigen koennen

## Bottom line

Simulieren Sie vor einer Linienexpansion, wenn geteilte Ressourcen, Mix oder Ramp-Risiko eine CAPEX-Geschichte kippen koennen, die statisch gut aussieht.

Wenn die Expansion eine echte isolierte Zellkopie mit stabilem Mix ist, koennen Sie mit messungsgesteuerten Piloten schneller sein.

Ziel sind weniger Ueberraschungen, wenn Ausgaben zu Beton werden.
